from __future__ import annotations

import asyncio
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.document import Document
from app.db.models.document_chunk import DocumentChunk
from app.rag.chunking import chunk_text
from app.rag.embeddings import create_document_embedding
from app.rag.pdf_parse import process_pdf, token_count


def extract_text_from_file(file_path: Path, mime_type: str) -> str:
    """Extract text from supported knowledge-base file formats."""
    if mime_type == "text/plain":
        return file_path.read_text(encoding="utf-8", errors="ignore")

    # Best-effort fallback for unsupported MIME types.
    return file_path.read_text(encoding="utf-8", errors="ignore")


def _build_plain_text_chunks(text: str) -> list[dict[str, object]]:
    """Build chunk payloads for non-PDF documents."""
    chunk_texts = chunk_text(
        text,
        chunk_size=settings.rag_chunk_size,
        overlap=settings.rag_chunk_overlap,
    )

    return [
        {
            "heading": "",
            "page": 1,
            "content": chunk,
            "full_text": chunk,
            "tokens": token_count(chunk),
        }
        for chunk in chunk_texts
    ]


async def ingest_document_chunks(db: AsyncSession, document: Document) -> int:
    """Extract, chunk, embed, and persist vectors for one uploaded document."""
    source_path = Path(document.storage_path)
    if document.mime_type == "application/pdf":
        chunks = process_pdf(str(source_path))
    else:
        text = extract_text_from_file(source_path, document.mime_type)
        if not text.strip():
            raise ValueError("No text could be extracted from the uploaded file")
        chunks = _build_plain_text_chunks(text)

    if not chunks:
        raise ValueError("No chunks were created from extracted text")

    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))

    for index, chunk in enumerate(chunks):
        embedding_text = str(chunk["content"])
        embedding = create_document_embedding(embedding_text)
        db.add(
            DocumentChunk(
                content=embedding_text,
                embedding=embedding,
                source=document.original_name,
                full_text=str(chunk["full_text"]),
                heading=str(chunk["heading"]),
                page=int(chunk["page"]),
                chunk_index=index,
                tokens=int(chunk["tokens"]),
                document_id=document.id,
            )
        )

        if settings.rag_embedding_interval_seconds > 0 and index < len(chunks) - 1:
            await asyncio.sleep(settings.rag_embedding_interval_seconds)

    return len(chunks)
