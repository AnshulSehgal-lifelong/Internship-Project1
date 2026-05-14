from app.schemas.common import ORMBaseModel


class ChatRequest(ORMBaseModel):
    message: str


class ChatResponse(ORMBaseModel):
    reply: str