"""Reusable RAG building blocks isolated from API route logic."""

from app.rag.chunking import chunk_text
from app.rag.embeddings import create_document_embedding, create_query_embedding
from app.rag.ingestion import ingest_document_chunks
from app.rag.prompts import build_policy_answer_prompt
from app.rag.retrieval import RetrievedChunk, retrieve_policy_chunks

__all__ = [
    "RetrievedChunk",
    "build_policy_answer_prompt",
    "chunk_text",
    "create_document_embedding",
    "create_query_embedding",
    "ingest_document_chunks",
    "retrieve_policy_chunks",
]
