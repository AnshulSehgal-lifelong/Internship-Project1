from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeRead, EmployeeUpdate
from app.api.routes.auth import get_current_user, require_roles, hash_password
from sqlalchemy import insert


router = APIRouter(prefix="/employees", tags=["employees"])


async def get_accessible_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    employee = await db.get(User, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if (current_user.role or "") in ("Administrator", "HR") or current_user.email == employee.email:
        return employee

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this profile")


@router.post(
    "/",
    response_model=EmployeeRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("Administrator", detail="Not authorized to create employees"))],
)
async def create_employee(payload: EmployeeCreate, db: AsyncSession = Depends(get_db)) -> User:
    # Map EmployeeCreate to User. Use name -> first/last split and generate a random password.
    name = payload.name or ""
    parts = name.split(" ", 1)
    first_name = parts[0] if parts else None
    last_name = parts[1] if len(parts) > 1 else None

    import uuid
    random_pw = str(uuid.uuid4())
    hashed = hash_password(random_pw)

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=payload.email,
        role=payload.role,
        department_id=payload.department_id,
        salary=payload.salary,
        hire_date=payload.hire_date,
        hashed_password=hashed,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get(
    "/",
    response_model=list[EmployeeRead],
    dependencies=[Depends(require_roles("Administrator", "HR", detail="Not authorized to view employee directory"))],
)
async def list_employees(db: AsyncSession = Depends(get_db)) -> list[User]:
    result = await db.execute(select(User).order_by(User.id))
    return list(result.scalars().all())


@router.get("/{employee_id}", response_model=EmployeeRead)
async def get_employee(employee: User = Depends(get_accessible_employee)) -> User:
    return employee


@router.put(
    "/{employee_id}",
    response_model=EmployeeRead,
    dependencies=[Depends(require_roles("Administrator", detail="Not authorized to edit employee"))],
)
async def update_employee(employee_id: int, payload: EmployeeUpdate, db: AsyncSession = Depends(get_db)) -> User:
    employee = await db.get(User, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "name":
            parts = (value or "").split(" ", 1)
            employee.first_name = parts[0] if parts else None
            employee.last_name = parts[1] if len(parts) > 1 else None
            continue
        setattr(employee, key, value)

    await db.commit()
    await db.refresh(employee)
    return employee


@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("Administrator", detail="Not authorized to delete employee"))],
)
async def delete_employee(employee_id: int, db: AsyncSession = Depends(get_db)) -> None:
    employee = await db.get(User, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    await db.delete(employee)
    await db.commit()