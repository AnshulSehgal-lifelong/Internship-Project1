from datetime import date

from app.schemas.common import ORMBaseModel


class EmployeeCreate(ORMBaseModel):
    name: str
    email: str
    department_id: int | None = None
    role: str | None = None
    salary: float | None = None
    hire_date: date | None = None


class EmployeeUpdate(ORMBaseModel):
    name: str | None = None
    email: str | None = None
    department_id: int | None = None
    role: str | None = None
    salary: float | None = None
    hire_date: date | None = None


class EmployeeRead(ORMBaseModel):
    id: int
    name: str
    email: str
    department_id: int | None = None
    role: str | None = None
    salary: float | None = None
    hire_date: date | None = None