from __future__ import annotations

import asyncio
from pathlib import Path

from pypdf import PdfReader
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.document import Document
from app.db.models.document_chunk import DocumentChunk
from app.rag.chunking import chunk_text
from app.rag.embeddings import create_document_embedding


def extract_text_from_pdf(file_path: Path) -> str:
    """Extract text from all pages of a PDF file."""
    reader = PdfReader(str(file_path))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def extract_text_from_file(file_path: Path, mime_type: str) -> str:
    """Extract text from supported knowledge-base file formats."""
    if mime_type == "application/pdf":
        return extract_text_from_pdf(file_path)

    if mime_type == "text/plain":
        return file_path.read_text(encoding="utf-8", errors="ignore")

    # Best-effort fallback for unsupported MIME types.
    return file_path.read_text(encoding="utf-8", errors="ignore")


async def ingest_document_chunks(db: AsyncSession, document: Document) -> int:
    """Extract, chunk, embed, and persist vectors for one uploaded document."""
    source_path = Path(document.storage_path)
    text = extract_text_from_file(source_path, document.mime_type)
    if not text.strip():
        raise ValueError("No text could be extracted from the uploaded file")

    chunks = chunk_text(
        text,
        chunk_size=settings.rag_chunk_size,
        overlap=settings.rag_chunk_overlap,
    )
    if not chunks:
        raise ValueError("No chunks were created from extracted text")

    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))

    for index, chunk in enumerate(chunks):
        embedding = create_document_embedding(chunk)
        db.add(
            DocumentChunk(
                content=chunk,
                embedding=embedding,
                source=document.original_name,
                chunk_index=index,
                document_id=document.id,
            )
        )

        if settings.rag_embedding_interval_seconds > 0 and index < len(chunks) - 1:
            await asyncio.sleep(settings.rag_embedding_interval_seconds)

    return len(chunks)
