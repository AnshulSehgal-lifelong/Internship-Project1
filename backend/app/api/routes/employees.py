from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.user import User
from app.db.models.department import Department
from app.schemas.employee import EmployeeCreate, EmployeeRead, EmployeeUpdate
from app.api.routes.auth import get_current_user, hash_password
from app.api.routes.utils import format_full_name, is_hr_department


router = APIRouter(prefix="/employees", tags=["employees"])

ALLOWED_EMPLOYEE_ROLES = {"Manager", "Employee", "Intern"}


async def _can_access_employee_directory(current_user: User, db: AsyncSession) -> bool:
    """Return True when the current user may view and manage the employee directory."""
    role = current_user.role or ""
    if role == "Administrator" or role == "HR":
        return True
    if role != "Manager" or current_user.department_id is None:
        return False
    department = await db.get(Department, current_user.department_id)
    return department is not None and is_hr_department(department.name)


def _build_employee_payload(user: User, department_name: str | None = None) -> dict[str, object]:
    """Serialize a User into the EmployeeRead response payload."""
    resolved_department = department_name
    if resolved_department is None:
        resolved_department = user.department.name if user.department else None

    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "name": format_full_name(user.first_name, user.last_name, fallback=""),
        "email": user.email,
        "department_id": user.department_id,
        "department_name": resolved_department,
        "role": user.role,
        "salary": user.salary,
        "hire_date": user.hire_date,
        "is_active": user.is_active,
    }


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new employee user."""
    can_access_directory = await _can_access_employee_directory(current_user, db)
    if not can_access_directory:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create employees")

    if payload.role and payload.role not in ALLOWED_EMPLOYEE_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be Manager, Employee, or Intern")

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        role=payload.role,
        department_id=payload.department_id,
        salary=payload.salary,
        hire_date=payload.hire_date,
        hashed_password=hash_password(payload.password),
        is_active=False
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Load department name when available for the response payload.
    department_name = None
    if user.department_id:
        dept = await db.get(Department, user.department_id)
        if dept:
            department_name = dept.name

    return _build_employee_payload(user, department_name=department_name)


@router.get("/", response_model=list[EmployeeRead])
async def list_employees(search: str | None = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return the employee directory with optional search."""
    can_access_directory = await _can_access_employee_directory(current_user, db)
    if not can_access_directory:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view employee directory")

    query = (
        select(User)
        .options(selectinload(User.department))
        .outerjoin(Department, User.department_id == Department.id)
        .order_by(User.id)
    )
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(User.first_name).like(search_term),
                func.lower(User.last_name).like(search_term),
                func.lower(User.email).like(search_term),
                func.lower(User.role).like(search_term),
                func.lower(Department.name).like(search_term)
            )
        )

    result = await db.execute(query)
    employees = result.scalars().all()
    
    return [_build_employee_payload(emp) for emp in employees]


@router.get("/{employee_id}", response_model=EmployeeRead)
async def get_employee(employee_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return an employee profile when authorized."""
    query = select(User).options(selectinload(User.department)).where(User.id == employee_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    can_access_directory = await _can_access_employee_directory(current_user, db)
    if can_access_directory or current_user.email == user.email:
        return _build_employee_payload(user)

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this profile")


@router.put("/{employee_id}", response_model=EmployeeRead)
async def update_employee(employee_id: int, payload: EmployeeUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update an employee profile when authorized."""
    query = select(User).options(selectinload(User.department)).where(User.id == employee_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        
    can_access_directory = await _can_access_employee_directory(current_user, db)
    if not can_access_directory:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit employee")

    if payload.role and payload.role not in ALLOWED_EMPLOYEE_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be Manager, Employee, or Intern")

    payload_dict = payload.model_dump(exclude_unset=True)
    for key, value in payload_dict.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)

    return _build_employee_payload(user)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(employee_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    """Delete an employee account when authorized."""
    can_access_directory = await _can_access_employee_directory(current_user, db)
    if not can_access_directory:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete employee")

    user = await db.get(User, employee_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    await db.delete(user)
    await db.commit()