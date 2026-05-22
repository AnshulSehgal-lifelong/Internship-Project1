from datetime import datetime

from app.db.models.task import TaskStatus
from app.schemas.common import ORMBaseModel


class TaskCreate(ORMBaseModel):
    title: str
    description: str | None = None
    assigned_to: int


class TaskRead(ORMBaseModel):
    id: int
    title: str
    description: str | None = None
    status: TaskStatus
    department_id: int
    assigned_by: int
    assigned_to: int
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
