from collections.abc import Iterator
import logging
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from google import genai
from ollama import Client
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.rag.prompts import build_policy_answer_prompt
from app.rag.retrieval import retrieve_policy_chunks
from app.schemas.ai import ChatRequest


router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)


def _clean_messages(payload: ChatRequest) -> list[dict[str, str]]:
    """Remove empty chat messages and normalize the payload into plain dicts."""
    messages = [message.model_dump() for message in payload.messages if message.content.strip()]

    # If the client only sent the single-message field, convert it into the same
    # message shape used by the conversation history.
    if not messages and payload.message and payload.message.strip():
        messages.append({"role": "user", "content": payload.message.strip()})

    return messages


def _split_prompt(messages: list[dict[str, str]], payload: ChatRequest) -> tuple[list[dict[str, str]], str]:
    """Split the conversation into prior history and the latest user prompt."""
    if messages:
        latest_user_index = next((index for index in range(len(messages) - 1, -1, -1) if messages[index]["role"] == "user"), -1)
        if latest_user_index >= 0:
            return messages[:latest_user_index], messages[latest_user_index]["content"]

    if payload.message and payload.message.strip():
        return messages, payload.message.strip()

    raise HTTPException(status_code=400, detail="message is required")


def _gemini_history(messages: list[dict[str, str]]) -> list[dict[str, object]]:
    """Convert app chat messages into Gemini's history format."""
    history: list[dict[str, object]] = []
    for message in messages:
        # Gemini uses "model" for assistant turns, so map the role here.
        role = "model" if message["role"] == "assistant" else message["role"]
        if role not in {"user", "model"}:
            continue

        history.append(
            {
                "role": role,
                "parts": [{"text": message["content"]}],
            }
        )

    return history


def _stream_gemini(messages: list[dict[str, str]], prompt: str) -> Iterator[bytes]:
    """Stream the assistant response from Gemini as UTF-8 text chunks."""
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=settings.gemini_api_key)
    chat = client.chats.create(
        model=settings.gemini_model,
        history=cast(list[Any], _gemini_history(messages)),
    )

    for chunk in chat.send_message_stream(prompt):
        text = getattr(chunk, "text", None)
        if text:
            yield text.encode("utf-8")


def _stream_ollama(messages: list[dict[str, str]], prompt: str) -> Iterator[bytes]:
    """Stream the assistant response from Ollama as a fallback provider."""
    client = Client(host=settings.ollama_host)
    ollama_messages = [*messages, {"role": "user", "content": prompt}]
    stream = client.chat(
        model=settings.ollama_model,
        messages=ollama_messages,
        stream=True,
    )

    for chunk in stream:
        content = chunk.get("message", {}).get("content") if isinstance(chunk, dict) else None
        if content:
            yield content.encode("utf-8")


@router.post("/chat")
async def chat(payload: ChatRequest, db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    """Stream a policy-grounded answer using RAG and Gemini with Ollama fallback."""
    messages = _clean_messages(payload)
    messages_for_model, user_question = _split_prompt(messages, payload)
    prompt = user_question

    # Build a strict context prompt from policy chunks so the assistant answers
    # from uploaded knowledge-base documents.
    try:
        chunks = await retrieve_policy_chunks(db, user_question)
        prompt = build_policy_answer_prompt(user_question, chunks)
    except Exception as exc:
        logger.warning("RAG retrieval unavailable, continuing without context: %s", exc)

    def stream_reply() -> Iterator[bytes]:
        # Try Gemini first so the chat feels faster and more capable when the
        # API key is configured; fall back to Ollama only if Gemini is missing
        # or fails before any text has been streamed.
        gemini_started = False

        if settings.gemini_api_key:
            try:
                for chunk in _stream_gemini(messages_for_model, prompt):
                    gemini_started = True
                    yield chunk
                return
            except Exception as exc:
                if gemini_started:
                    logger.exception("Gemini stream failed after starting")
                    raise
                logger.warning("Gemini unavailable, falling back to Ollama: %s", exc)
        yield from _stream_ollama(messages_for_model, prompt)

    return StreamingResponse(
        stream_reply(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )