from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.db.models.document import Document, DocumentStatus, DocumentType
from app.db.models.job_application import JobApplication, JobApplicationStatus
from app.db.models.job_opening import JobOpening
from app.db.models.user import User
from app.rag.ingestion import ingest_document_chunks, extract_text_from_file
from app.rag.extraction import extract_structured_resume, generate_explanation
from app.rag.embeddings import create_query_embedding
from app.db.models.job_application_embedding import JobApplicationEmbedding

router = APIRouter(prefix="/recruitment", tags=["recruitment"])
logger = logging.getLogger(__name__)


@router.get("/{job_opening_id}/rank")
async def rank_candidates(job_opening_id: int, top_k: int = 10, db: AsyncSession = Depends(get_db)):
    """Return top-k ranked applications for a job based on semantic similarity."""
    # Build job summary
    job = await db.get(JobOpening, job_opening_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    jd_summary = job.title + "\n" + (job.requirements or "")
    query_embedding = create_query_embedding(jd_summary)
    vector_value = "[" + ",".join(f"{v:.8f}" for v in query_embedding) + "]"

    candidate_limit = max(top_k * 3, top_k)

    sql = """
    SELECT
        ja.id AS application_id,
        ja.full_name,
        ja.email,
        ja.phone,
        ja.resume_original_name,
        ja.status,
        jae.embedding,
        jae.embedding <=> CAST(:embedding AS vector) AS distance
    FROM job_application_embeddings jae
    JOIN job_applications ja ON ja.id = jae.job_application_id
    WHERE ja.job_opening_id = :job_id
    ORDER BY distance ASC
    LIMIT :limit
    """

    from sqlalchemy import text

    result = await db.execute(
        text(sql), {"embedding": vector_value, "job_id": job_opening_id, "limit": candidate_limit}
    )

    rows = result.mappings().all()
    # Convert to simple list with score = 1/(1+distance)
    ranked = []
    for row in rows[:top_k]:
        distance = row.get("distance")
        score = 1.0 / (1.0 + float(distance)) if distance is not None else 0.0
        ranked.append(
            {
                "application_id": row["application_id"],
                "full_name": row["full_name"],
                "email": row["email"],
                "phone": row["phone"],
                "resume": row["resume_original_name"],
                "score": score,
            }
        )

    return {"job_id": job_opening_id, "ranked": ranked}


@router.get("/applications/{application_id}/explain")
async def explain_application(application_id: int, db: AsyncSession = Depends(get_db)):
    """Generate a short LLM explanation why the candidate fits (or not) for the job."""
    application = await db.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    job = await db.get(JobOpening, application.job_opening_id)
    jd_summary = job.title + "\n" + (job.requirements or "") if job else ""

    # Extract resume text
    try:
        resume_text = ""
        if application.resume_path:
            from pathlib import Path

            p = Path(application.resume_path)
            if p.exists():
                resume_text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        resume_text = ""

    try:
        explanation = generate_explanation(jd_summary, resume_text)
    except Exception:
        logger.exception("LLM explanation failed for application %s", application_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate explanation")

    return {"application_id": application_id, "explanation": explanation}


async def _process_resume(document_id: uuid.UUID, job_opening_id: int, provided_name: str | None, provided_email: str | None, provided_phone: str | None) -> None:
    try:
        async with AsyncSessionLocal() as session:
            document = await session.get(Document, document_id)
            if document is None:
                return

            document.status = DocumentStatus.processing
            await session.commit()

            # create chunks + embeddings (reuse existing pipeline)
            try:
                await ingest_document_chunks(session, document)
            except Exception:
                logger.exception("Failed to ingest document chunks for resume %s", document_id)

            # Extract text for structured parsing
            source_path = Path(document.storage_path)
            text = extract_text_from_file(source_path, document.mime_type)

            # Attempt to get job description summary if job exists
            jd_summary = None
            job = await session.get(JobOpening, job_opening_id)
            if job is not None:
                jd_summary = job.title + "\n" + (job.requirements or "")

            structured = extract_structured_resume(text, jd_summary=jd_summary)

            application = JobApplication(
                job_opening_id=job_opening_id,
                full_name=provided_name or structured.get("full_name") or "",
                email=provided_email or structured.get("email") or "",
                phone=provided_phone or structured.get("phone") or "",
                github_url=structured.get("github_url"),
                linkedin_url=structured.get("linkedin_url"),
                portfolio_url=structured.get("portfolio_url"),
                resume_path=document.storage_path,
                resume_original_name=document.original_name,
                resume_mime_type=document.mime_type,
                resume_size_bytes=document.file_size_bytes if hasattr(document, "file_size_bytes") else 0,
                status=JobApplicationStatus.pending,
            )

            session.add(application)
            await session.commit()

            # Create per-application embedding contextualised to the JD
            try:
                candidate_text = (
                    f"Name: {application.full_name}\nEmail: {application.email}\nPhone: {application.phone}\n"
                    + "Skills: " + ",".join(structured.get("skills") or []) + "\n"
                    + "Work history: " + str(structured.get("work_history") or [])
                )
                if jd_summary:
                    embedding_input = f"{candidate_text}\nApplying for: {jd_summary}"
                else:
                    embedding_input = candidate_text

                embedding = create_query_embedding(embedding_input)
                session.add(
                    JobApplicationEmbedding(job_application_id=application.id, embedding=embedding)
                )
                await session.commit()
            except Exception:
                logger.exception("Failed to create application embedding for application %s", application.id)
    except Exception:
        logger.exception("Background resume processing failed for document %s", document_id)
        try:
            async with AsyncSessionLocal() as session:
                document = await session.get(Document, document_id)
                if document is not None:
                    document.status = DocumentStatus.failed
                    await session.commit()
        except Exception:
            logger.exception("Failed to mark document failed: %s", document_id)


def _get_storage_root() -> Path:
    base_path = Path(settings.storage_base_path)
    if base_path.is_absolute():
        return base_path
    base_dir = Path(__file__).resolve().parents[4]
    return base_dir / base_path


@router.post("/apply")
async def apply_for_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_opening_id: int = Form(...),
    full_name: str | None = Form(None),
    email: str | None = Form(None),
    phone: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Upload a resume and create a job application asynchronously."""
    # Basic validation
    storage_root = _get_storage_root()
    now = datetime.now(timezone.utc)
    storage_dir = storage_root / f"{now.year:04d}" / f"{now.month:02d}"
    storage_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename or "").suffix
    stored_filename = f"{uuid.uuid4()}{extension}"
    storage_path = storage_dir / stored_filename

    try:
        with storage_path.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    finally:
        await file.close()

    document = Document(
        storage_path=str(storage_path.resolve()),
        original_name=file.filename or "resume",
        file_size_bytes=storage_path.stat().st_size,
        mime_type=(file.content_type or "application/octet-stream"),
        user_id=current_user.id,
        status=DocumentStatus.uploaded,
        document_type=DocumentType.resume,
    )

    try:
        db.add(document)
        await db.commit()
        await db.refresh(document)
    except Exception:
        await db.rollback()
        storage_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to store metadata")

    background_tasks.add_task(_process_resume, document.id, job_opening_id, full_name, email, phone)

    return JSONResponse({"status": "ok", "document_id": str(document.id)})
