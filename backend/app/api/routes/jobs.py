from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.job_opening import JobOpening
from app.schemas.job_opening import JobOpeningCreate, JobOpeningRead, JobOpeningUpdate
from app.api.routes.auth import get_current_user
from app.models.user import User


router = APIRouter(prefix="/job-openings", tags=["job-openings"])


@router.post("/", response_model=JobOpeningRead, status_code=status.HTTP_201_CREATED)
async def create_job_opening(payload: JobOpeningCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> JobOpening:
    if (current_user.role or "") not in ("Administrator", "HR"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create job openings")

    job_opening = JobOpening(**payload.model_dump())
    db.add(job_opening)
    await db.commit()
    await db.refresh(job_opening)
    return job_opening


@router.get("/", response_model=list[JobOpeningRead])
async def list_job_openings(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[JobOpening]:
    if (current_user.role or "") not in ("Administrator", "HR"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view recruitment listings")

    result = await db.execute(select(JobOpening).order_by(JobOpening.id))
    return list(result.scalars().all())


@router.get("/{job_opening_id}", response_model=JobOpeningRead)
async def get_job_opening(job_opening_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> JobOpening:
    if (current_user.role or "") not in ("Administrator", "HR"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this resource")

    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")
    return job_opening


@router.put("/{job_opening_id}", response_model=JobOpeningRead)
async def update_job_opening(
    job_opening_id: int, payload: JobOpeningUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> JobOpening:
    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")
    if (current_user.role or "") not in ("Administrator", "HR"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit job openings")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(job_opening, key, value)

    await db.commit()
    await db.refresh(job_opening)
    return job_opening


@router.delete("/{job_opening_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_opening(job_opening_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    if (current_user.role or "") not in ("Administrator", "HR"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete job openings")

    job_opening = await db.get(JobOpening, job_opening_id)
    if job_opening is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")

    await db.delete(job_opening)
    await db.commit()