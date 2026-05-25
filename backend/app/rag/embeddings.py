from __future__ import annotations

from math import sqrt

from google import genai
from google.genai import types

from app.core.config import settings


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is not None:
        return _client
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def create_embedding(text: str, task_type: str) -> list[float]:
    """Generate a single embedding vector using Gemini embeddings."""
    response = _get_client().models.embed_content(
        model=settings.rag_embedding_model,
        contents=text,
        config=types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=settings.rag_embedding_dimensions,
        ),
    )

    embeddings = getattr(response, "embeddings", None)
    values = getattr(embeddings[0], "values", None) if embeddings else None

    if not values:
        raise RuntimeError("Gemini did not return an embedding")

    numeric_values = [float(value) for value in values]
    if settings.rag_embedding_model == "gemini-embedding-001" and settings.rag_embedding_dimensions != 3072:
        magnitude = sqrt(sum(value * value for value in numeric_values))
        if magnitude:
            numeric_values = [value / magnitude for value in numeric_values]

    return numeric_values


def create_document_embedding(text: str) -> list[float]:
    return create_embedding(text=text, task_type="retrieval_document")


def create_query_embedding(text: str) -> list[float]:
    return create_embedding(text=text, task_type="retrieval_query")
