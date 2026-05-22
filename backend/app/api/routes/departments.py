from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.department import Department
from app.db.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate, DepartmentOverview
from app.api.routes.auth import get_current_user
from app.api.routes.utils import format_full_name


router = APIRouter(prefix="/departments", tags=["departments"])


def _build_manager_payload(manager: User | None) -> dict[str, object] | None:
    """Serialize a department manager."""
    if manager is None:
        return None
    return {
        "id": manager.id,
        "name": format_full_name(manager.first_name, manager.last_name, fallback=""),
        "role": manager.role,
        "email": manager.email,
    }


def _build_member_payload(member: User) -> dict[str, object]:
    """Serialize a department member."""
    return {
        "id": member.id,
        "name": format_full_name(member.first_name, member.last_name, fallback=""),
        "role": member.role,
        "email": member.email,
        "is_active": member.is_active,
    }


@router.post("/", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Department:
    """Create a department without assigning a manager."""
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create departments")

    if payload.manager_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assign a manager after creating the department")

    department = Department(**payload.model_dump())
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@router.get("/", response_model=list[DepartmentRead])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Department]:
    """List all departments."""
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    result = await db.execute(select(Department).order_by(Department.id))
    return list(result.scalars().all())


@router.get("/my", response_model=DepartmentOverview)
async def get_my_department(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DepartmentOverview:
    """Return the current user's department with manager and members."""
    if current_user.department_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No department assigned")

    department = await db.get(Department, current_user.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    manager = await db.get(User, department.manager_id) if department.manager_id else None
    result = await db.execute(select(User).where(User.department_id == department.id).order_by(User.id))
    members = result.scalars().all()

    manager_payload = _build_manager_payload(manager)
    members_payload = [_build_member_payload(member) for member in members]

    return {
        "id": department.id,
        "name": department.name,
        "manager": manager_payload,
        "members": members_payload,
    }


@router.get("/{department_id}", response_model=DepartmentRead)
async def get_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Department:
    """Return a single department by id."""
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    department = await db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return department


@router.put("/{department_id}", response_model=DepartmentRead)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Department:
    """Update a department and optionally assign a manager."""
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit departments")

    department = await db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    if payload.manager_id is not None:
        manager = await db.get(User, payload.manager_id)
        if manager is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")
        if manager.department_id != department.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager must belong to the selected department")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, key, value)

    await db.commit()
    await db.refresh(department)
    return department


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a department."""
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete departments")

    department = await db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    await db.delete(department)
    await db.commit()