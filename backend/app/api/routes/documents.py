from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.models.department import Department
from app.models.document import Document, DocumentStatus, DocumentType
from app.models.user import User
from app.schemas.document import DocumentRead

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)

CHUNK_SIZE_BYTES = 1024 * 1024


def _parse_allowed_mime_types() -> set[str]:
    return {value.strip().lower() for value in settings.allowed_mime_types.split(",") if value.strip()}


def _get_storage_root() -> Path:
    base_path = Path(settings.storage_base_path)
    if base_path.is_absolute():
        return base_path
    base_dir = Path(__file__).resolve().parents[3]
    return base_dir / base_path


def _build_storage_dir(storage_root: Path, timestamp: datetime) -> Path:
    return storage_root / f"{timestamp.year:04d}" / f"{timestamp.month:02d}"


def _is_hr_department(name: str | None) -> bool:
    if not name:
        return False
    normalized = name.strip().lower()
    return normalized in {"hr", "human resources"}


async def _can_manage_policies(current_user: User, db: AsyncSession) -> bool:
    if (current_user.role or "") == "Administrator":
        return True
    if (current_user.role or "") != "Manager" or current_user.department_id is None:
        return False
    department = await db.get(Department, current_user.department_id)
    return department is not None and _is_hr_department(department.name)


async def _trigger_ai_pipeline(document_id: uuid.UUID, storage_path: str) -> None:
    try:
        async with AsyncSessionLocal() as session:
            document = await session.get(Document, document_id)
            if document is None:
                return
            document.status = DocumentStatus.processing
            await session.commit()

            # Mock AI pipeline: mark indexed and assign a placeholder vector collection id.
            document.status = DocumentStatus.indexed
            document.vector_collection_id = str(uuid.uuid4())
            await session.commit()
    except Exception:
        async with AsyncSessionLocal() as session:
            document = await session.get(Document, document_id)
            if document is None:
                return
            document.status = DocumentStatus.failed
            await session.commit()


@router.get("/", response_model=list[DocumentRead])
async def list_documents(
    document_type: DocumentType | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Document]:
    # Any authenticated user may view documents; filter by type if requested.
    query = select(Document).order_by(Document.created_at.desc())
    if document_type is not None:
        query = query.where(Document.document_type == document_type)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/upload", response_model=DocumentRead)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: DocumentType = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    # Only admin may upload policies; resumes can be uploaded by any authenticated user.
    if document_type == DocumentType.policy and not await _can_manage_policies(current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to upload policies")

    allowed_mime_types = _parse_allowed_mime_types()
    content_type = (file.content_type or "").lower()
    if content_type not in allowed_mime_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    storage_root = _get_storage_root()
    now = datetime.now(timezone.utc)
    storage_dir = _build_storage_dir(storage_root, now)
    storage_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename or "").suffix
    stored_filename = f"{uuid.uuid4()}{extension}"
    storage_path = storage_dir / stored_filename

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    size_bytes = 0

    try:
        with storage_path.open("wb") as output_file:
            while True:
                chunk = await file.read(CHUNK_SIZE_BYTES)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > max_bytes:
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
                output_file.write(chunk)
    except HTTPException:
        if storage_path.exists():
            storage_path.unlink(missing_ok=True)
        raise
    except Exception as exc:  # noqa: BLE001
        if storage_path.exists():
            storage_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save file") from exc
    finally:
        await file.close()

    document = Document(
        storage_path=str(storage_path.resolve()),
        original_name=file.filename or "document",
        file_size_bytes=size_bytes,
        mime_type=content_type,
        user_id=current_user.id,
        status=DocumentStatus.uploaded,
        document_type=document_type,
    )

    try:
        db.add(document)
        await db.commit()
        await db.refresh(document)
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        storage_path.unlink(missing_ok=True)
        logger.exception("Failed to store document metadata")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to store metadata") from exc

    background_tasks.add_task(_trigger_ai_pipeline, document.id, document.storage_path)
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    document = await db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if document.document_type == DocumentType.policy and not await _can_manage_policies(current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete policies")

    if document.document_type == DocumentType.resume and document.user_id != current_user.id:
        if (current_user.role or "") != "Administrator":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete resumes")

    await db.delete(document)
    await db.commit()

    storage_path = Path(document.storage_path)
    try:
        if storage_path.exists():
            storage_path.unlink()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete file") from exc