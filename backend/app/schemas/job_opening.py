from app.schemas.common import ORMBaseModel


class JobOpeningCreate(ORMBaseModel):
    title: str
    description: str
    requirements: str


class JobOpeningUpdate(ORMBaseModel):
    title: str | None = None
    description: str | None = None
    requirements: str | None = None


class JobOpeningRead(ORMBaseModel):
    id: int
    title: str
    description: str
    requirements: str