from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.rag.embeddings import create_query_embedding


@dataclass
class RetrievedChunk:
    content: str
    source: str
    chunk_index: int
    distance: float


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in values) + "]"


async def retrieve_policy_chunks(db: AsyncSession, question: str, limit: int | None = None) -> list[RetrievedChunk]:
    """Fetch the nearest indexed policy chunks for the user question."""
    query_embedding = create_query_embedding(question)
    vector_value = _vector_literal(query_embedding)
    top_k = limit or settings.rag_top_k

    query = text(
        """
        SELECT
            dc.content,
            dc.source,
            dc.chunk_index,
            dc.embedding <=> CAST(:embedding AS vector) AS distance
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.document_type = 'policy'
          AND d.status = 'indexed'
        ORDER BY dc.embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
        """
    )

    result = await db.execute(query, {"embedding": vector_value, "top_k": top_k})
    rows = result.mappings().all()

    return [
        RetrievedChunk(
            content=row["content"],
            source=row["source"],
            chunk_index=row["chunk_index"],
            distance=float(row["distance"]),
        )
        for row in rows
    ]
