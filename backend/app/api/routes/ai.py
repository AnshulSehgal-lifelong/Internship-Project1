from fastapi import APIRouter, WebSocket

from app.schemas.ai import ChatRequest, ChatResponse


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    return ChatResponse(reply=f"AI orchestration placeholder received: {payload.message}")


@router.websocket("/chat/stream")
async def chat_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:
        message = await websocket.receive_text()
        await websocket.send_text(f"placeholder stream: {message}")