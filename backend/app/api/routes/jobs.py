from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.config import settings
from app.db.models.department import Department
from app.db.models.job_application import JobApplication, JobApplicationStatus
from app.db.models.job_application_embedding import JobApplicationEmbedding
from app.db.models.job_opening import JobOpening
from app.schemas.job_application import JobApplicationRead
from app.schemas.job_opening import JobOpeningCreate, JobOpeningRead, JobOpeningUpdate
from app.api.routes.auth import get_current_user
from app.api.routes.utils import is_hr_department
from app.db.models.user import User
from app.rag.embeddings import create_query_embedding
from app.rag.extraction import generate_explanation
from app.rag.pdf_parse import process_pdf


router = APIRouter(prefix="/job-openings", tags=["job-openings"])

CHUNK_SIZE_BYTES = 1024 * 1024


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    """Return cosine similarity in the 0..1 range."""
    if not left or not right or len(left) != len(right):
        return 0.0

    dot_product = sum(l_value * r_value for l_value, r_value in zip(left, right))
    left_norm = sum(value * value for value in left) ** 0.5
    right_norm = sum(value * value for value in right) ** 0.5
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0

    return max(0.0, min(1.0, dot_product / (left_norm * right_norm)))

async def _require_hr_access(current_user: User, db: AsyncSession) -> None:
    """Ensure the current user can manage recruitment data."""
    role = current_user.role or ""
    if role == "Administrator" or role == "HR":
        return
    if role != "Manager" or current_user.department_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage recruitment")
    department = await db.get(Department, current_user.department_id)
    if department is None or not is_hr_department(department.name):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage recruitment")


def _parse_allowed_mime_types() -> set[str]:
    """Return the allowed resume MIME types from settings."""
    return {value.strip().lower() for value in settings.allowed_mime_types.split(",") if value.strip()}


def _get_resume_root() -> Path:
    """Return the base resume directory for uploads."""
    base_dir = Path(__file__).resolve().parents[3]
    return base_dir / "resumes"


def _build_resume_dir(resume_root: Path, timestamp: datetime, job_opening_id: int) -> Path:
    """Build the date-based resume directory for a job opening."""
    return resume_root / f"job-{job_opening_id}" / f"{timestamp.year:04d}" / f"{timestamp.month:02d}"


def _sanitize_filename(value: str) -> str:
    """Return a safe, lowercase filename fragment."""
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower()
    return cleaned[:60] if cleaned else "candidate"


def _delete_resume_file(resume_path: str) -> None:
    """Delete resume and any generated preview file."""
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
    """Return or generate a PDF preview for a resume."""
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


async def _save_upload_file(upload: UploadFile, destination: Path, max_bytes: int) -> int:
    """Write the upload to disk and return the size in bytes."""
    size_bytes = 0

    try:
        with destination.open("wb") as output_file:
            while True:
                chunk = await upload.read(CHUNK_SIZE_BYTES)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > max_bytes:
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
                output_file.write(chunk)
    except HTTPException:
        destination.unlink(missing_ok=True)
        raise
    except Exception as exc:  # noqa: BLE001
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save file") from exc

    return size_bytes


class ApplicationDecision(BaseModel):
    status: Literal["selected", "rejected"]


@router.post("/", response_model=JobOpeningRead, status_code=status.HTTP_201_CREATED)
async def create_job_opening(payload: JobOpeningCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> JobOpening:
    """Create a job opening."""
    await _require_hr_access(current_user, db)

    job_opening = JobOpening(**payload.model_dump())
    db.add(job_opening)
    await db.commit()
    await db.refresh(job_opening)
    return job_opening


@router.get("/", response_model=list[JobOpeningRead])
async def list_job_openings(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[JobOpening]:
    """List job openings for HR users."""
    await _require_hr_access(current_user, db)

    result = await db.execute(select(JobOpening).order_by(JobOpening.id))
    return list(result.scalars().all())


@router.get("/public", response_model=list[JobOpeningRead])
async def list_public_job_openings(db: AsyncSession = Depends(get_db)) -> list[JobOpening]:
    """List public job openings for candidates."""
    result = await db.execute(select(JobOpening).order_by(JobOpening.id))
    return list(result.scalars().all())


@router.get("/{job_opening_id}", response_model=JobOpeningRead)
async def get_job_opening(job_opening_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> JobOpening:
    """Fetch a job opening for HR users."""
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
    """List applications for a specific opening."""
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
    """Update a job opening."""
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
    """Delete a job opening and its applications."""
    await _require_hr_access(current_user, db)

    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    result = await db.execute(select(JobApplication).where(JobApplication.job_opening_id == job_opening_id))
    applications = list(result.scalars().all())
    for application in applications:
        _delete_resume_file(application.resume_path)
        await db.delete(application)

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
    address: str | None = Form(None),
    resume: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> JobApplication:
    """Submit a job application with a resume upload."""
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

    try:
        size_bytes = await _save_upload_file(resume, resume_path, max_bytes)
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
        address=address,
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


def _extract_resume_text(resume_path: Path, mime_type: str) -> str:
    """Extract readable resume text for text search gating."""
    if mime_type == "application/pdf":
        chunks = process_pdf(str(resume_path))
        return "\n".join(str(chunk.get("full_text") or chunk.get("content") or "") for chunk in chunks).strip()

    if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            from docx import Document as DocxDocument
        except Exception:
            return resume_path.read_text(encoding="utf-8", errors="ignore")

        try:
            document = DocxDocument(str(resume_path))
            return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()).strip()
        except Exception:
            return resume_path.read_text(encoding="utf-8", errors="ignore")

    return resume_path.read_text(encoding="utf-8", errors="ignore")


def _build_job_search_query(job: JobOpening) -> str:
    """Build a compact search query from the title and requirements."""
    raw_query = f"{job.title} {job.requirements}".lower()
    tokens = re.findall(r"[a-z0-9+.#-]{2,}", raw_query)
    seen: set[str] = set()
    compact_tokens: list[str] = []
    for token in tokens:
        if token in seen:
            continue
        seen.add(token)
        compact_tokens.append(token)
    return " ".join(compact_tokens[:20])


async def _resume_matches_job(db: AsyncSession, resume_text: str, job_query: str) -> float:
    """Return a full-text match score for a resume against a job query."""
    if not resume_text.strip() or not job_query.strip():
        return 0.0

    statement = text(
        """
        SELECT ts_rank_cd(
            to_tsvector('english', :resume_text),
            websearch_to_tsquery('english', :job_query)
        ) AS score,
        to_tsvector('english', :resume_text) @@ websearch_to_tsquery('english', :job_query) AS matches
        """
    )
    result = await db.execute(statement, {"resume_text": resume_text, "job_query": job_query})
    row = result.mappings().one()
    score = float(row.get("score") or 0.0)
    matches = bool(row.get("matches"))
    return score if matches else 0.0


@router.post("/{job_opening_id}/rank")
async def rank_applications(job_opening_id: int, top_k: int = 10, db: AsyncSession = Depends(get_db)):
    """Gate candidates with text search first, then embed and rank the survivors."""
    job = await db.get(JobOpening, job_opening_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    job_query = _build_job_search_query(job)
    job_embedding = create_query_embedding(f"{job.title}\n{job.description}\n{job.requirements}")

    applications_result = await db.execute(
        select(JobApplication)
        .where(JobApplication.job_opening_id == job_opening_id)
        .where(JobApplication.status.in_([JobApplicationStatus.pending, JobApplicationStatus.selected]))
        .order_by(JobApplication.created_at.desc())
    )
    applications = list(applications_result.scalars().all())

    shortlisted: list[dict[str, object]] = []
    rejected_ids: list[int] = []

    for application in applications:
        resume_path = Path(application.resume_path)
        if not resume_path.exists():
            application.status = JobApplicationStatus.rejected
            application.rejected_at = datetime.now(timezone.utc)
            rejected_ids.append(application.id)
            continue

        resume_text = _extract_resume_text(resume_path, application.resume_mime_type)
        match_score = await _resume_matches_job(db, resume_text, job_query)
        if match_score <= 0.0:
            application.status = JobApplicationStatus.rejected
            application.rejected_at = datetime.now(timezone.utc)
            rejected_ids.append(application.id)
            continue

        embedding_result = await db.execute(
            select(JobApplicationEmbedding).where(JobApplicationEmbedding.job_application_id == application.id)
        )
        application_embedding = embedding_result.scalar_one_or_none()
        if application_embedding is None:
            candidate_text = f"{application.full_name}\n{application.email}\n{resume_text}\nApplying for: {job.title}"
            embedding = create_query_embedding(candidate_text)
            application_embedding = JobApplicationEmbedding(job_application_id=application.id, embedding=embedding)
            db.add(application_embedding)

        semantic_score = _cosine_similarity(job_embedding, list(application_embedding.embedding))

        shortlisted.append(
            {
                "application_id": application.id,
                "full_name": application.full_name,
                "email": application.email,
                "phone": application.phone,
                "resume_original_name": application.resume_original_name,
                "text_score": match_score,
                "semantic_score": semantic_score,
            }
        )

    await db.commit()

    shortlisted.sort(key=lambda row: (float(row["text_score"]), float(row["semantic_score"])), reverse=True)
    ranked = shortlisted[:top_k]

    return {"job_id": job_opening_id, "rejected_count": len(rejected_ids), "ranked": ranked}


@router.get("/applications/{application_id}/explanation")
async def explain_application(application_id: int, db: AsyncSession = Depends(get_db)):
    """Generate a short fit explanation on demand."""
    application = await db.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    job = await db.get(JobOpening, application.job_opening_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    resume_path = Path(application.resume_path)
    if not resume_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume file missing")

    resume_text = _extract_resume_text(resume_path, application.resume_mime_type)
    explanation = generate_explanation(f"{job.title}\n{job.requirements}", resume_text)
    return {"application_id": application_id, "explanation": explanation}


@router.get("/applications/{application_id}/resume")
async def preview_application_resume(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return an inline PDF preview for a resume."""
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
    """Select or reject an application."""
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
    """Delete rejected applications older than the retention window."""
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
        await db.delete(application)

    await db.commit()
    return {"deleted": len(applications)}