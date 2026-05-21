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


class DepartmentMember(ORMBaseModel):
    id: int
    name: str
    role: str | None = None
    email: str
    is_active: bool


class DepartmentManager(ORMBaseModel):
    id: int
    name: str
    role: str | None = None
    email: str


class DepartmentOverview(ORMBaseModel):
    id: int
    name: str
    manager: DepartmentManager | None = None
    members: list[DepartmentMember]