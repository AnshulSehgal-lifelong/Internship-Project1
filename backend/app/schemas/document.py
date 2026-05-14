from app.schemas.common import ORMBaseModel


class DocumentRead(ORMBaseModel):
    id: int
    filename: str
    content_type: str | None = None
    text_preview: str | None = None