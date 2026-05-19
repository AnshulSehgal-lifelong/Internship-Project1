from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.department import Department
from app.schemas.employee import EmployeeCreate, EmployeeRead, EmployeeUpdate
from app.api.routes.auth import get_current_user, hash_password


router = APIRouter(prefix="/employees", tags=["employees"])


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create employees")

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
    
    # Eager load department if necessary, but here we can just do a query or return None for department_name
    department_name = None
    if user.department_id:
        dept = await db.get(Department, user.department_id)
        if dept:
            department_name = dept.name

    return {
        "id": user.id,
        "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
        "email": user.email,
        "department_id": user.department_id,
        "department_name": department_name,
        "role": user.role,
        "salary": user.salary,
        "hire_date": user.hire_date,
        "is_active": user.is_active
    }


@router.get("/", response_model=list[EmployeeRead])
async def list_employees(search: str | None = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if (current_user.role or "") not in ("Administrator", "HR"):
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
    
    response_list = []
    for emp in employees:
        emp_dict = {
            "id": emp.id,
            "name": f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
            "email": emp.email,
            "department_id": emp.department_id,
            "department_name": emp.department.name if emp.department else None,
            "role": emp.role,
            "salary": emp.salary,
            "hire_date": emp.hire_date,
            "is_active": emp.is_active
        }
        response_list.append(emp_dict)
        
    return response_list


@router.get("/{employee_id}", response_model=EmployeeRead)
async def get_employee(employee_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(User).options(selectinload(User.department)).where(User.id == employee_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if (current_user.role or "") in ("Administrator", "HR") or current_user.email == user.email:
        return {
            "id": user.id,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
            "email": user.email,
            "department_id": user.department_id,
            "department_name": user.department.name if user.department else None,
            "role": user.role,
            "salary": user.salary,
            "hire_date": user.hire_date,
            "is_active": user.is_active
        }

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this profile")


@router.put("/{employee_id}", response_model=EmployeeRead)
async def update_employee(employee_id: int, payload: EmployeeUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(User).options(selectinload(User.department)).where(User.id == employee_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit employee")

    payload_dict = payload.model_dump(exclude_unset=True)
    for key, value in payload_dict.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)
    
    return {
        "id": user.id,
        "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
        "email": user.email,
        "department_id": user.department_id,
        "department_name": user.department.name if user.department else None,
        "role": user.role,
        "salary": user.salary,
        "hire_date": user.hire_date,
        "is_active": user.is_active
    }


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(employee_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete employee")

    user = await db.get(User, employee_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    await db.delete(user)
    await db.commit()