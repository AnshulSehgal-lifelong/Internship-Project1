"""
Production-grade PDF parser for RAG systems.

FEATURES:
- PDF extraction
- Dynamic heading detection
- Font-size analysis
- Header/footer removal
- Structure-aware parsing
- Sentence-aware chunking
- Token-aware chunking
- Overlap support
- Metadata support

INSTALL:
pip install pymupdf nltk tiktoken

FIRST RUN:
python -m nltk.downloader punkt
"""

import re
import fitz
import tiktoken

from nltk.tokenize import sent_tokenize
from app.core.config import settings


# =========================================================
# CONFIG
# =========================================================

MAX_TOKENS = settings.rag_chunk_size
OVERLAP_SENTENCES = settings.rag_chunk_overlap // 20  # Approximate sentence count for overlap

ENCODER = tiktoken.get_encoding("cl100k_base")


# =========================================================
# TOKEN COUNT
# =========================================================

def token_count(text: str) -> int:
    return len(ENCODER.encode(text))

# =========================================================
# TEXT CLEANING
# =========================================================

def clean_text(text: str) -> str:
    """
    IMPORTANT:
    Preserve line breaks.
    They are critical for heading detection.
    """

    # Remove excessive spaces
    text = re.sub(r"[ \t]+", " ", text)

    # Remove excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# =========================================================
# HEADING DETECTION
# =========================================================

def is_heading(
    text: str,
    font_size: float,
    avg_font_size: float,
    font_name: str
) -> bool:

    text = text.strip()

    if not text:
        return False

    score = 0

    # Larger font
    if font_size > avg_font_size * 1.2:
        score += 2

    # Bold font
    if "bold" in font_name.lower():
        score += 1

    # Short line
    if len(text) < 80:
        score += 1

    # Uppercase
    if text.isupper():
        score += 1

    # Numbered headings
    if re.match(r"^\d+(\.\d+)*", text):
        score += 1

    return score >= 3


# =========================================================
# EXTRACT STRUCTURED PDF
# =========================================================

def extract_pdf_structure(pdf_path: str):
    """
    Extract structured lines with font metadata.
    """

    doc = fitz.open(pdf_path)

    structured_lines = []

    font_sizes = []

    # -----------------------------------------
    # PASS 1: Collect font sizes
    # -----------------------------------------

    try:
        for page in doc:

            data = page.get_text("dict")

            for block in data["blocks"]:

                if "lines" not in block:
                    continue

                for line in block["lines"]:

                    for span in line["spans"]:
                        font_sizes.append(span["size"])

        avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 0

        # -----------------------------------------
        # PASS 2: Extract structured lines
        # -----------------------------------------

        for page_num, page in enumerate(doc):

            data = page.get_text("dict")

            for block in data["blocks"]:

                if "lines" not in block:
                    continue

                for line in block["lines"]:

                    line_text = ""
                    max_font_size = 0
                    font_name = ""

                    for span in line["spans"]:

                        line_text += span["text"]

                        if span["size"] > max_font_size:
                            max_font_size = span["size"]
                            font_name = span["font"]

                    line_text = clean_text(line_text)

                    if not line_text:
                        continue

                    heading = is_heading(
                        text=line_text,
                        font_size=max_font_size,
                        avg_font_size=avg_font_size,
                        font_name=font_name
                    )

                    structured_lines.append({
                        "page": page_num + 1,
                        "text": line_text,
                        "font_size": max_font_size,
                        "font_name": font_name,
                        "is_heading": heading
                    })

        return structured_lines
    finally:
        doc.close()


# =========================================================
# REMOVE REPEATED HEADERS/FOOTERS
# =========================================================

def remove_repeated_lines(lines):
    """
    Remove lines repeated across many pages.
    """

    line_counts = {}

    for line in lines:

        text = line["text"].strip()

        if not text:
            continue

        line_counts[text] = line_counts.get(text, 0) + 1

    repeated = {
        text
        for text, count in line_counts.items()
        if count >= 3
    }

    cleaned = []

    for line in lines:

        if line["text"] not in repeated:
            cleaned.append(line)

    return cleaned


# =========================================================
# PARSE SECTIONS
# =========================================================

def parse_sections(structured_lines):
    """
    Convert lines into semantic sections.
    """

    sections = []

    current_heading = "INTRODUCTION"
    current_content = []
    current_page = 1

    for line in structured_lines:

        if line["is_heading"]:

            # Save previous section
            if current_content:

                sections.append({
                    "heading": current_heading,
                    "content": " ".join(current_content),
                    "page": current_page
                })

            # Start new section
            current_heading = line["text"]
            current_content = []
            current_page = line["page"]

        else:
            current_content.append(line["text"])

    # Final section
    if current_content:

        sections.append({
            "heading": current_heading,
            "content": " ".join(current_content),
            "page": current_page
        })

    return sections


# =========================================================
# CHUNK SECTION
# =========================================================

def chunk_section(section):
    """
    Sentence-aware + token-aware chunking.
    """

    heading = section["heading"]
    content = section["content"]
    page = section["page"]

    try:
        sentences = sent_tokenize(content)
    except LookupError:
        sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", content) if sentence.strip()]

    chunks = []

    current_chunk = []
    current_tokens = 0

    for sentence in sentences:

        sentence_tokens = token_count(sentence)

        # Exceeds chunk limit
        if current_tokens + sentence_tokens > MAX_TOKENS and current_chunk:

            chunk_text = " ".join(current_chunk)

            full_text = f"{heading}\n\n{chunk_text}"

            chunks.append({
                "heading": heading,
                "page": page,
                "content": chunk_text,
                "full_text": full_text,
                "tokens": token_count(full_text)
            })

            # OVERLAP
            overlap = current_chunk[-OVERLAP_SENTENCES:]

            current_chunk = overlap
            current_tokens = token_count(
                " ".join(current_chunk)
            )

        current_chunk.append(sentence)
        current_tokens += sentence_tokens

    # Final chunk
    if current_chunk:

        chunk_text = " ".join(current_chunk)

        full_text = f"{heading}\n\n{chunk_text}"

        chunks.append({
            "heading": heading,
            "page": page,
            "content": chunk_text,
            "full_text": full_text,
            "tokens": token_count(full_text)
        })

    return chunks


# =========================================================
# MAIN PIPELINE
# =========================================================

def process_pdf(pdf_path: str):

    # 1. Extract structured lines
    structured_lines = extract_pdf_structure(pdf_path)

    # 2. Remove repeated headers/footers
    structured_lines = remove_repeated_lines(
        structured_lines
    )

    # 3. Parse semantic sections
    sections = parse_sections(structured_lines)

    # 4. Chunk sections
    final_chunks = []

    for section in sections:

        chunks = chunk_section(section)

        final_chunks.extend(chunks)

    return final_chunks


# =========================================================
# EXAMPLE
# =========================================================

if __name__ == "__main__":

    pdf_path = "Leave Policy.pdf"

    chunks = process_pdf(pdf_path)

    print(f"\nGenerated {len(chunks)} chunks\n")

    for i, chunk in enumerate(chunks):

        print("=" * 80)
        print(f"CHUNK {i + 1}")
        print("=" * 80)

        print(f"Heading: {chunk['heading']}")
        print(f"Page: {chunk['page']}")
        print(f"Tokens: {chunk['tokens']}")

        print("\nContent:")
        print(chunk["content"])

        print("\n")