from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.rag.embeddings import create_query_embedding


VECTOR_WEIGHT = 0.7
KEYWORD_WEIGHT = 0.3
SEARCH_CANDIDATE_MULTIPLIER = 3
SIMILARITY_THRESHOLD = 0.95


# Data container for retrieved chunks passed into the prompt builder.
@dataclass
class RetrievedChunk:
    chunk_id: int
    source: str
    heading: str
    page: int
    content: str
    embedding: list[float]
    score: float = 0.0


def _vector_literal(values: list[float]) -> str:
    """Convert a list of floats into PostgreSQL vector literal format."""
    return "[" + ",".join(f"{value:.8f}" for value in values) + "]"


def _score_vector_distance(distance: float | None) -> float:
    """Convert a cosine distance into a bounded similarity score."""
    if distance is None:
        return 0.0
    return 1.0 / (1.0 + float(distance))


def _score_keyword_rank(rank: float | None) -> float:
    """Clamp the text-search rank into a predictable range for merging."""
    if rank is None:
        return 0.0
    return max(0.0, min(1.0, float(rank)))


def _normalize_embedding(raw_embedding: Any) -> list[float]:
    """Convert database embedding payloads into a clean list of floats."""
    if raw_embedding is None:
        return []

    if isinstance(raw_embedding, str):
        stripped = raw_embedding.strip().strip("[]")
        if not stripped:
            return []
        return [float(value) for value in stripped.split(",")]

    if isinstance(raw_embedding, (list, tuple)):
        return [float(value) for value in raw_embedding]

    return [float(value) for value in list(raw_embedding)]


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    """Return cosine similarity in [0, 1] range for two embedding vectors."""
    if not left or not right:
        return 0.0
    if len(left) != len(right):
        return 0.0

    dot_product = sum(l_value * r_value for l_value, r_value in zip(left, right))
    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))

    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0

    cosine = dot_product / (left_norm * right_norm)
    return max(0.0, min(1.0, cosine))


def _deduplicate_chunks(chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
    """Remove near-duplicate chunks while keeping the highest-scoring entries first."""
    deduplicated: list[RetrievedChunk] = []

    for chunk in chunks:
        is_duplicate = False
        for existing_chunk in deduplicated:
            similarity = _cosine_similarity(chunk.embedding, existing_chunk.embedding)
            if similarity >= SIMILARITY_THRESHOLD:
                is_duplicate = True
                break

        if not is_duplicate:
            deduplicated.append(chunk)

    return deduplicated


def _merge_chunk_scores(rows: list[dict[str, Any]]) -> list[RetrievedChunk]:
    """Merge vector and keyword candidates into a single ranked result list."""
    merged: dict[int, dict[str, Any]] = {}

    for row in rows:
        chunk_id = int(row["chunk_id"])
        entry = merged.setdefault(
            chunk_id,
            {
                "chunk_id": chunk_id,
                "source": row["source"],
                "heading": row["heading"],
                "page": int(row["page"]),
                "content": row["content"],
                "embedding": _normalize_embedding(row.get("embedding")),
                "vector_similarity": 0.0,
                "keyword_score": 0.0,
            },
        )

        entry["vector_similarity"] = max(entry["vector_similarity"], _score_vector_distance(row.get("distance")))
        entry["keyword_score"] = max(entry["keyword_score"], _score_keyword_rank(row.get("keyword_score")))

    ranked_chunks = []
    for entry in merged.values():
        vector_component = entry["vector_similarity"] * VECTOR_WEIGHT
        keyword_component = entry["keyword_score"] * KEYWORD_WEIGHT
        combined_score = vector_component + keyword_component

        if entry["vector_similarity"] > 0.0 and entry["keyword_score"] > 0.0:
            combined_score += 0.05

        ranked_chunks.append(
            RetrievedChunk(
                chunk_id=entry["chunk_id"],
                source=entry["source"],
                heading=entry["heading"],
                page=entry["page"],
                content=entry["content"],
                embedding=entry["embedding"],
                score=combined_score,
            )
        )

    ranked_chunks.sort(key=lambda chunk: chunk.score, reverse=True)
    return ranked_chunks


async def retrieve_policy_chunks(db: AsyncSession, question: str, limit: int | None = None) -> list[RetrievedChunk]:
    """Fetch the best policy chunks using hybrid vector and keyword search."""
    if not question.strip():
        return []

    query_embedding = create_query_embedding(question)
    vector_value = _vector_literal(query_embedding)
    top_k = limit or settings.rag_top_k
    candidate_limit = max(top_k * SEARCH_CANDIDATE_MULTIPLIER, top_k)

    vector_query = text(
        """
        SELECT
            dc.id AS chunk_id,
            dc.heading,
            dc.content,
            dc.source,
            dc.page,
            dc.embedding,
            dc.embedding <=> CAST(:embedding AS vector) AS distance,
            NULL::double precision AS keyword_score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.document_type = 'policy'
          AND d.status = 'indexed'
        ORDER BY distance ASC
        LIMIT :candidate_limit
        """
    )

    keyword_query = text(
        """
        SELECT
            dc.id AS chunk_id,
            dc.heading,
            dc.content,
            dc.source,
            dc.page,
            dc.embedding,
            NULL::double precision AS distance,
            ts_rank_cd(dc.search_vector, websearch_to_tsquery('english', :question)) AS keyword_score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.document_type = 'policy'
          AND d.status = 'indexed'
          AND dc.search_vector @@ websearch_to_tsquery('english', :question)
        ORDER BY keyword_score DESC
        LIMIT :candidate_limit
        """
    )

    vector_result = await db.execute(
        vector_query,
        {"embedding": vector_value, "candidate_limit": candidate_limit},
    )
    keyword_result = await db.execute(
        keyword_query,
        {"question": question, "candidate_limit": candidate_limit},
    )

    rows = [*vector_result.mappings().all(), *keyword_result.mappings().all()]
    ranked_chunks = _merge_chunk_scores(rows)
    deduplicated_chunks = _deduplicate_chunks(ranked_chunks)

    return deduplicated_chunks[:top_k]
