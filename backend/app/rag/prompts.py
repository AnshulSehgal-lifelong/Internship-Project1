from __future__ import annotations

from app.rag.retrieval import RetrievedChunk


def build_policy_answer_prompt(question: str, chunks: list[RetrievedChunk]) -> str:
    """Build a strict context-grounded prompt for policy Q&A."""
    if chunks:
        context = "\n\n".join(
            f"[{index + 1}] Source: {chunk.source} | Chunk: {chunk.chunk_index}\n{chunk.content}"
            for index, chunk in enumerate(chunks)
        )
    else:
        context = "No relevant policy context was found in the knowledge base."

    return (
        "Answer ONLY using the provided context. "
        "If the answer is not in the context, say you cannot find it in company policies.\n\n"
        f"Context:\n{context}\n\n"
        f"Question:\n{question}"
    )
