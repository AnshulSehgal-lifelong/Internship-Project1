from typing import Literal

from pydantic import Field

from app.schemas.common import ORMBaseModel


class ChatMessage(ORMBaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str


class ChatRequest(ORMBaseModel):
    message: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(ORMBaseModel):
    reply: str