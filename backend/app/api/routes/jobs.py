from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.job_opening import JobOpening
from app.schemas.job_opening import JobOpeningCreate, JobOpeningRead, JobOpeningUpdate
from app.api.routes.auth import require_roles


router = APIRouter(prefix="/job-openings", tags=["job-openings"])


@router.post(
    "/",
    response_model=JobOpeningRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("Administrator", "HR", detail="Not authorized to create job openings"))],
)
async def create_job_opening(payload: JobOpeningCreate, db: AsyncSession = Depends(get_db)) -> JobOpening:
    job_opening = JobOpening(**payload.model_dump())
    db.add(job_opening)
    await db.commit()
    await db.refresh(job_opening)
    return job_opening


@router.get(
    "/",
    response_model=list[JobOpeningRead],
    dependencies=[Depends(require_roles("Administrator", "HR", detail="Not authorized to view recruitment listings"))],
)
async def list_job_openings(db: AsyncSession = Depends(get_db)) -> list[JobOpening]:
    result = await db.execute(select(JobOpening).order_by(JobOpening.id))
    return list(result.scalars().all())


@router.get(
    "/{job_opening_id}",
    response_model=JobOpeningRead,
    dependencies=[Depends(require_roles("Administrator", "HR", detail="Not authorized to view this resource"))],
)
async def get_job_opening(job_opening_id: int, db: AsyncSession = Depends(get_db)) -> JobOpening:
    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")
    return job_opening


@router.put(
    "/{job_opening_id}",
    response_model=JobOpeningRead,
    dependencies=[Depends(require_roles("Administrator", "HR", detail="Not authorized to edit job openings"))],
)
async def update_job_opening(
    job_opening_id: int,
    payload: JobOpeningUpdate,
    db: AsyncSession = Depends(get_db),
) -> JobOpening:
    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(job_opening, key, value)

    await db.commit()
    await db.refresh(job_opening)
    return job_opening


@router.delete(
    "/{job_opening_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("Administrator", "HR", detail="Not authorized to delete job openings"))],
)
async def delete_job_opening(job_opening_id: int, db: AsyncSession = Depends(get_db)) -> None:
    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    await db.delete(job_opening)
    await db.commit()