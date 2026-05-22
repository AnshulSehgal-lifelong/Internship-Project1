from app.schemas.common import ORMBaseModel


class Token(ORMBaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(ORMBaseModel):
    email: str
    password: str


class UserCreate(ORMBaseModel):
    first_name: str | None = None
    last_name: str | None = None
    role: str | None = None
    email: str
    password: str


class UserRead(ORMBaseModel):
    id: int
    first_name: str | None = None
    last_name: str | None = None
    role: str | None = None
    email: str
    is_active: bool
    department_id: int | None = None
    department_name: str | None = None