from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.rag.embeddings import create_query_embedding

# data container for retrieved chunks to be passed into the prompt builder
@dataclass
class RetrievedChunk:
    source: str
    heading: str
    page: int
    content: str


def _vector_literal(values: list[float]) -> str:
    """Convert a list of floats into PostgreSQL vector literal format."""
    return "[" + ",".join(f"{value:.8f}" for value in values) + "]"


async def retrieve_policy_chunks(db: AsyncSession, question: str, limit: int | None = None) -> list[RetrievedChunk]:
    """Fetch the nearest indexed policy chunks for the user question."""
    # get embedding for the user question
    query_embedding = create_query_embedding(question)

    # get formatted vector for the query embedding so we can pass it safely into the SQL query
    vector_value = _vector_literal(query_embedding)

    # returns the top K results, defaulting to the value in settings
    top_k = limit or settings.rag_top_k

    # build the query for searching the nearest chunks based on cosine similarity (using the <=> operator provided by pgvector)
    query = text(
        """
        SELECT
            dc.heading,
            dc.content,
            dc.source,
            dc.page,
            dc.embedding <=> CAST(:embedding AS vector) AS distance
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.document_type = 'policy'
          AND d.status = 'indexed'
        ORDER BY distance
        LIMIT :top_k
        """
    )

    # execute the query and fetch results
    result = await db.execute(query, {"embedding": vector_value, "top_k": top_k})

    # convert results into list of RetrievedChunk dataclass instances
    rows = result.mappings().all()

    # return list of RetrievedChunk objects
    return [
        RetrievedChunk(
            source=row["source"],
            heading=row["heading"],
            page=int(row["page"]),
            content=row["content"],
        )
        for row in rows
    ]
