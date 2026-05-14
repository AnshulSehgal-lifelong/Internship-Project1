from app.schemas.common import ORMBaseModel


class DepartmentCreate(ORMBaseModel):
    name: str
    manager_id: int | None = None


class DepartmentUpdate(ORMBaseModel):
    name: str | None = None
    manager_id: int | None = None


class DepartmentRead(ORMBaseModel):
    id: int
    name: str
    manager_id: int | None = None