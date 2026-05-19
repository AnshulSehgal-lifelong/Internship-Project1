from datetime import date

from app.schemas.common import ORMBaseModel


class EmployeeCreate(ORMBaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    department_id: int | None = None
    role: str | None = None
    salary: float | None = None
    hire_date: date | None = None


class EmployeeUpdate(ORMBaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    department_id: int | None = None
    role: str | None = None
    salary: float | None = None
    hire_date: date | None = None


class EmployeeRead(ORMBaseModel):
    id: int
    first_name: str | None = None
    last_name: str | None = None
    name: str
    email: str
    department_id: int | None = None
    department_name: str | None = None
    role: str | None = None
    salary: float | None = None
    hire_date: date | None = None
    is_active: bool