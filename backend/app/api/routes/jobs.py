from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.config import settings
from app.models.department import Department
from app.models.job_application import JobApplication, JobApplicationStatus
from app.models.job_opening import JobOpening
from app.schemas.job_application import JobApplicationRead
from app.schemas.job_opening import JobOpeningCreate, JobOpeningRead, JobOpeningUpdate
from app.api.routes.auth import get_current_user
from app.models.user import User


router = APIRouter(prefix="/job-openings", tags=["job-openings"])

CHUNK_SIZE_BYTES = 1024 * 1024


def _is_hr_department(name: str | None) -> bool:
    if not name:
        return False
    normalized = name.strip().lower()
    return normalized in {"hr", "human resources"}


async def _require_hr_access(current_user: User, db: AsyncSession) -> None:
    if (current_user.role or "") == "Administrator":
        return
    if (current_user.role or "") != "Manager" or current_user.department_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage recruitment")
    department = await db.get(Department, current_user.department_id)
    if department is None or not _is_hr_department(department.name):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage recruitment")


def _parse_allowed_mime_types() -> set[str]:
    return {value.strip().lower() for value in settings.allowed_mime_types.split(",") if value.strip()}


def _get_resume_root() -> Path:
    base_dir = Path(__file__).resolve().parents[3]
    return base_dir / "resumes"


def _build_resume_dir(resume_root: Path, timestamp: datetime, job_opening_id: int) -> Path:
    return resume_root / f"job-{job_opening_id}" / f"{timestamp.year:04d}" / f"{timestamp.month:02d}"


def _sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower()
    return cleaned[:60] if cleaned else "candidate"


def _delete_resume_file(resume_path: str) -> None:
    path = Path(resume_path)
    try:
        if path.exists():
            path.unlink()
        preview_path = path.parent / "preview" / f"{path.stem}.pdf"
        if preview_path.exists():
            preview_path.unlink()
    except Exception:
        pass


def _get_resume_preview_path(resume_path: Path, mime_type: str) -> Path:
    if mime_type == "application/pdf":
        return resume_path

    if mime_type not in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    }:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Preview not supported for this file type")

    preview_dir = resume_path.parent / "preview"
    preview_dir.mkdir(parents=True, exist_ok=True)
    preview_path = preview_dir / f"{resume_path.stem}.pdf"
    if preview_path.exists():
        return preview_path

    try:
        from docx2pdf import convert
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="docx2pdf is required for resume preview") from exc

    try:
        convert(str(resume_path), str(preview_path))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to convert resume to PDF") from exc

    return preview_path


class ApplicationDecision(BaseModel):
    status: Literal["selected", "rejected"]


@router.post("/", response_model=JobOpeningRead, status_code=status.HTTP_201_CREATED)
async def create_job_opening(payload: JobOpeningCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> JobOpening:
    await _require_hr_access(current_user, db)

    job_opening = JobOpening(**payload.model_dump())
    db.add(job_opening)
    await db.commit()
    await db.refresh(job_opening)
    return job_opening


@router.get("/", response_model=list[JobOpeningRead])
async def list_job_openings(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[JobOpening]:
    await _require_hr_access(current_user, db)

    result = await db.execute(select(JobOpening).order_by(JobOpening.id))
    return list(result.scalars().all())


@router.get("/public", response_model=list[JobOpeningRead])
async def list_public_job_openings(db: AsyncSession = Depends(get_db)) -> list[JobOpening]:
    result = await db.execute(select(JobOpening).order_by(JobOpening.id))
    return list(result.scalars().all())


@router.get("/{job_opening_id}", response_model=JobOpeningRead)
async def get_job_opening(job_opening_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> JobOpening:
    await _require_hr_access(current_user, db)

    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")
    return job_opening


@router.get("/{job_opening_id}/applications", response_model=list[JobApplicationRead])
async def list_job_applications(
    job_opening_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JobApplication]:
    await _require_hr_access(current_user, db)

    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    result = await db.execute(
        select(JobApplication).where(JobApplication.job_opening_id == job_opening_id).order_by(JobApplication.created_at.desc())
    )
    return list(result.scalars().all())


@router.put("/{job_opening_id}", response_model=JobOpeningRead)
async def update_job_opening(
    job_opening_id: int, payload: JobOpeningUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> JobOpening:
    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")
    await _require_hr_access(current_user, db)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(job_opening, key, value)

    await db.commit()
    await db.refresh(job_opening)
    return job_opening


@router.delete("/{job_opening_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_opening(job_opening_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    await _require_hr_access(current_user, db)

    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    result = await db.execute(select(JobApplication).where(JobApplication.job_opening_id == job_opening_id))
    applications = list(result.scalars().all())
    for application in applications:
        _delete_resume_file(application.resume_path)
        db.delete(application)

    await db.delete(job_opening)
    await db.commit()


@router.post("/{job_opening_id}/apply", response_model=JobApplicationRead, status_code=status.HTTP_201_CREATED)
async def apply_job_opening(
    job_opening_id: int,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    github_url: str | None = Form(None),
    linkedin_url: str | None = Form(None),
    portfolio_url: str | None = Form(None),
    resume: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> JobApplication:
    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    allowed_mime_types = _parse_allowed_mime_types()
    content_type = (resume.content_type or "").lower()
    if content_type not in allowed_mime_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    resume_root = _get_resume_root()
    now = datetime.now(timezone.utc)
    resume_dir = _build_resume_dir(resume_root, now, job_opening_id)
    resume_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(resume.filename or "").suffix
    safe_name = _sanitize_filename(full_name)
    timestamp_label = now.strftime("%Y%m%d-%H%M%S")
    stored_filename = f"{timestamp_label}-{safe_name}-{uuid.uuid4().hex}{extension}"
    resume_path = resume_dir / stored_filename

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    size_bytes = 0

    try:
        with resume_path.open("wb") as output_file:
            while True:
                chunk = await resume.read(CHUNK_SIZE_BYTES)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > max_bytes:
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
                output_file.write(chunk)
    except HTTPException:
        if resume_path.exists():
            resume_path.unlink(missing_ok=True)
        raise
    except Exception as exc:  # noqa: BLE001
        if resume_path.exists():
            resume_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save file") from exc
    finally:
        await resume.close()

    application = JobApplication(
        job_opening_id=job_opening_id,
        full_name=full_name,
        email=email,
        phone=phone,
        github_url=github_url,
        linkedin_url=linkedin_url,
        portfolio_url=portfolio_url,
        resume_path=str(resume_path.resolve()),
        resume_original_name=resume.filename or "resume",
        resume_mime_type=content_type,
        resume_size_bytes=size_bytes,
        status=JobApplicationStatus.pending,
    )

    try:
        db.add(application)
        await db.commit()
        await db.refresh(application)
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        resume_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to store application") from exc

    return application


@router.get("/applications/{application_id}/resume")
async def preview_application_resume(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_hr_access(current_user, db)

    application = await db.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    resume_path = Path(application.resume_path)
    if not resume_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume file missing")

    preview_path = _get_resume_preview_path(resume_path, application.resume_mime_type)
    headers = {"Content-Disposition": f"inline; filename=\"{preview_path.name}\""}
    return FileResponse(path=str(preview_path), media_type="application/pdf", headers=headers)


@router.post("/applications/{application_id}/decision", response_model=JobApplicationRead)
async def decide_application(
    application_id: int,
    payload: ApplicationDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobApplication:
    await _require_hr_access(current_user, db)

    application = await db.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    now = datetime.now(timezone.utc)
    if payload.status == "selected":
        application.status = JobApplicationStatus.selected
        application.selected_at = now
        application.rejected_at = None
    else:
        application.status = JobApplicationStatus.rejected
        application.rejected_at = now
        application.selected_at = None

    await db.commit()
    await db.refresh(application)
    return application


@router.delete("/applications/cleanup-rejected")
async def cleanup_rejected_applications(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    await _require_hr_access(current_user, db)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.status == JobApplicationStatus.rejected,
            JobApplication.rejected_at.is_not(None),
            JobApplication.rejected_at <= cutoff,
        )
    )
    applications = list(result.scalars().all())
    for application in applications:
        _delete_resume_file(application.resume_path)
        db.delete(application)

    await db.commit()
    return {"deleted": len(applications)}