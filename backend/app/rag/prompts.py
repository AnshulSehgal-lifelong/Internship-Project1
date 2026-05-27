from __future__ import annotations
from app.rag.retrieval import RetrievedChunk

# Takes the question and the retrived chunks and builds a prompt for the LLM to answer the question based on the retrieved context.
def build_policy_answer_prompt(question: str, chunks: list[RetrievedChunk]) -> str:
    """Build a strict context-grounded prompt for policy Q&A."""
    #
    #FOR TESTING, REMOVE LATER
    #
    print(chunks)
    if chunks:
        context_parts = []
        for chunk in chunks:
            context_parts.append(f"""
Source: {chunk.source}
Heading: {chunk.heading}
Page: {chunk.page}

{chunk.content}
            """)
        context = "\n\n".join(context_parts)
    else:
        context = "No relevant policy context was found in the knowledge base."
    
    #
    #FOR TESTING, REMOVE LATER
    #
    print(f"Context = {context} \n Question = {question}")
    return (
        "You are a helpful assistant for answering questions about company policies. "
        "Answer ONLY using the provided context. "
        "If the answer is not in the context, say you cannot find it in company policies.\n\n"
        f"Context:\n{context}\n\n"
        f"Question:\n{question}"
    )
