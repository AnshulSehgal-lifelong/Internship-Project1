from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user
from app.db.session import get_db
from app.models.department import Department
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.task import TaskCreate, TaskRead


router = APIRouter(prefix="/tasks", tags=["tasks"])


def _ensure_manager(current_user: User, department: Department) -> None:
    if department.manager_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to assign tasks")


@router.post("/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    if current_user.department_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assign a department before creating tasks")

    department = await db.get(Department, current_user.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    _ensure_manager(current_user, department)

    assignee = await db.get(User, payload.assigned_to)
    if assignee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found")

    if assignee.department_id != department.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignee must be in your department")

    task = Task(
        title=payload.title,
        description=payload.description,
        department_id=department.id,
        assigned_by=current_user.id,
        assigned_to=assignee.id,
        status=TaskStatus.assigned,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/my", response_model=list[TaskRead])
async def list_my_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Task]:
    result = await db.execute(
        select(Task).where(Task.assigned_to == current_user.id).order_by(Task.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/department", response_model=list[TaskRead])
async def list_department_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Task]:
    if current_user.department_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No department assigned")

    department = await db.get(Department, current_user.department_id)
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    _ensure_manager(current_user, department)

    result = await db.execute(
        select(Task).where(Task.department_id == department.id).order_by(Task.created_at.desc())
    )
    return list(result.scalars().all())


@router.patch("/{task_id}/complete", response_model=TaskRead)
async def complete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to complete this task")

    if task.status != TaskStatus.completed:
        task.status = TaskStatus.completed
        task.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(task)

    return task
