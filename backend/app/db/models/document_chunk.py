from __future__ import annotations

from datetime import datetime
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, Index, Computed
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    full_text: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Matches the 'generated always as ... stored' feature from your Postgres schema
    search_vector: Mapped[str | None] = mapped_column(
        TSVECTOR, 
        Computed("to_tsvector('english', full_text)", persisted=True),
        nullable=True
    )

    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    heading: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    page: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Explicitly map the existing PG Vector and GIN indexes so Alembic tracks them
    __table_args__ = (
        Index(
            'document_chunks_embedding_idx', 
            'embedding', 
            postgresql_using='hnsw', 
            postgresql_ops={'embedding': 'vector_cosine_ops'}
        ),
        Index(
            'idx_embedding_hnsw', 
            'embedding', 
            postgresql_using='hnsw', 
            postgresql_ops={'embedding': 'vector_cosine_ops'}
        ),
        Index(
            'idx_search_vector', 
            'search_vector', 
            postgresql_using='gin'
        ),
    )
