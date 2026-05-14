from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate


router = APIRouter(prefix="/departments", tags=["departments"])


@router.post("/", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
async def create_department(payload: DepartmentCreate, db: AsyncSession = Depends(get_db)) -> Department:
    department = Department(**payload.model_dump())
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@router.get("/", response_model=list[DepartmentRead])
async def list_departments(db: AsyncSession = Depends(get_db)) -> list[Department]:
    result = await db.execute(select(Department).order_by(Department.id))
    return list(result.scalars().all())


@router.get("/{department_id}", response_model=DepartmentRead)
async def get_department(department_id: int, db: AsyncSession = Depends(get_db)) -> Department:
    department = await db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return department


@router.put("/{department_id}", response_model=DepartmentRead)
async def update_department(
    department_id: int, payload: DepartmentUpdate, db: AsyncSession = Depends(get_db)
) -> Department:
    department = await db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, key, value)

    await db.commit()
    await db.refresh(department)
    return department


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(department_id: int, db: AsyncSession = Depends(get_db)) -> None:
    department = await db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    await db.delete(department)
    await db.commit()