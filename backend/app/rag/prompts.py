from __future__ import annotations

from app.rag.retrieval import RetrievedChunk


def build_policy_answer_prompt(question: str, chunks: list[RetrievedChunk]) -> str:
    """Build a strict context-grounded prompt for policy Q&A."""

    if chunks:
        context_parts = []
        for chunk in chunks:
            context_parts.append(
                f"""
Source: {chunk.source}
Heading: {chunk.heading}
Page: {chunk.page}

{chunk.content}
                """.strip()
            )
        context = "\n\n".join(context_parts)
    else:
        context = "No relevant policy context was found in the knowledge base."
    print(f"Context: {context}")
    return (
        "You are a helpful assistant for answering questions about company policies. "
        "Answer ONLY using the provided context. And mention the provided source of the information you are using. Use the following format for your answer:\n"
        f"[The answer like usual.]\n\nSource: [the source of the information you are using, e.g. the document name or URL]\nPage: [the page number of the information you are using, if available]\n\n"
        "If the answer is not in the context, say 'I cannot find it in company policies'.\n\n DO NOT answer questions that are not related to company policies. "
        f"Context:\n{context}\n\n"
        f"Question:\n{question}"
    )
