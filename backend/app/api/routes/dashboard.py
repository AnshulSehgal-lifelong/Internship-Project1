from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User
from app.models.department import Department
from app.models.job_opening import JobOpening
from app.api.routes.auth import get_current_user


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def build_activity_record(user: User, index: int) -> dict[str, object]:
    first_initial = user.first_name[0] if user.first_name else "E"
    last_initial = user.last_name[0] if user.last_name else ""
    initials = f"{first_initial}{last_initial}".upper()

    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "Unknown"
    return {
        "id": user.id,
        "initials": initials,
        "user": full_name,
        "email": user.email,
        "role": user.role,
        "department_id": user.department_id,
        "department_name": user.department.name if user.department else None,
        "status": "Active" if user.is_active else "Inactive",
        "action": f"joined the {user.role or 'team'}",
        "time": user.hire_date.isoformat() if user.hire_date else f"Recent hire #{index + 1}",
        "hire_date": user.hire_date.isoformat() if user.hire_date else None,
    }


async def fetch_activity_rows(
    db: AsyncSession,
    search: str | None = None,
    role: str | None = None,
    department_id: int | None = None,
    status_filter: str | None = None,
    sort_by: str = "recent",
    order: str = "desc",
    limit: int | None = None,
) -> list[User]:
    query = (
        select(User)
        .options(selectinload(User.department))
        .outerjoin(Department, User.department_id == Department.id)
    )

    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(User.first_name).like(search_term),
                func.lower(User.last_name).like(search_term),
                func.lower(User.email).like(search_term),
                func.lower(User.role).like(search_term),
                func.lower(Department.name).like(search_term),
            )
        )

    if role:
        query = query.filter(func.lower(User.role) == role.lower())

    if department_id is not None:
        query = query.filter(User.department_id == department_id)

    if status_filter == "active":
        query = query.filter(User.is_active.is_(True))
    elif status_filter == "inactive":
        query = query.filter(User.is_active.is_(False))

    order_is_desc = order.lower() != "asc"
    sort_key = sort_by.lower()

    if sort_key == "name":
        order_columns = [func.lower(User.first_name), func.lower(User.last_name), User.id]
    elif sort_key == "role":
        order_columns = [func.lower(User.role), User.id]
    elif sort_key == "department":
        order_columns = [func.lower(Department.name), User.id]
    elif sort_key == "status":
        order_columns = [User.is_active.desc() if order_is_desc else User.is_active.asc(), User.id.desc() if order_is_desc else User.id.asc()]
    else:
        order_columns = [User.hire_date.desc() if order_is_desc else User.hire_date.asc(), User.id.desc() if order_is_desc else User.id.asc()]

    query = query.order_by(*order_columns)

    if limit is not None:
        query = query.limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Count employees (now users)
    employee_count_result = await db.execute(select(func.count(User.id)))
    employee_count = employee_count_result.scalar() or 0

    # Count departments
    department_count_result = await db.execute(select(func.count(Department.id)))
    department_count = department_count_result.scalar() or 0

    # Count open jobs
    job_count_result = await db.execute(select(func.count(JobOpening.id)))
    job_count = job_count_result.scalar() or 0

    # Get recent 5 hires
    recent_employees = await fetch_activity_rows(db, sort_by="recent", order="desc", limit=5)
    activity = [build_activity_record(user, i) for i, user in enumerate(recent_employees)]

    return {
        "employeeCount": employee_count,
        "departmentCount": department_count,
        "jobCount": job_count,
        "recentActivity": activity
    }


@router.get("/activity-logs")
async def list_activity_logs(
    search: str | None = None,
    role: str | None = None,
    department_id: int | None = None,
    status: str | None = None,
    sort_by: str = "recent",
    order: str = "desc",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user is None:
        raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    rows = await fetch_activity_rows(
        db,
        search=search,
        role=role,
        department_id=department_id,
        status_filter=status,
        sort_by=sort_by,
        order=order,
    )

    return [build_activity_record(user, index) for index, user in enumerate(rows)]
