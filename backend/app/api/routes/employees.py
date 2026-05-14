from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeRead, EmployeeUpdate
from app.api.routes.auth import get_current_user
from app.models.user import User


router = APIRouter(prefix="/employees", tags=["employees"])


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> Employee:
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create employees")

    employee = Employee(**payload.model_dump())
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return employee


@router.get("/", response_model=list[EmployeeRead])
async def list_employees(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Employee]:
    if (current_user.role or "") not in ("Administrator", "HR"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view employee directory")

    result = await db.execute(select(Employee).order_by(Employee.id))
    return list(result.scalars().all())


@router.get("/{employee_id}", response_model=EmployeeRead)
async def get_employee(employee_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> Employee:
    employee = await db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Admin and HR can view any employee; others can view only their own profile
    if (current_user.role or "") in ("Administrator", "HR") or current_user.email == employee.email:
        return employee

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this profile")


@router.put("/{employee_id}", response_model=EmployeeRead)
async def update_employee(employee_id: int, payload: EmployeeUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> Employee:
    employee = await db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    # Only admin can edit employee records
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit employee")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, key, value)

    await db.commit()
    await db.refresh(employee)
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(employee_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    # Only admin may delete employees
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete employee")

    employee = await db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    await db.delete(employee)
    await db.commit()