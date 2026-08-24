from __future__ import annotations

import json
import logging
from typing import Any

from google import genai

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is not None:
        return _client
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _call_extraction_llm(prompt: str) -> str:
    """Call the LLM to extract structured JSON from the resume text.

    The prompt should instruct the model to return a single JSON object.
    """
    client = _get_client()

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
    )

    response_text = getattr(response, "text", None)
    if isinstance(response_text, str) and response_text.strip():
        return response_text

    candidates = getattr(response, "candidates", None)
    if candidates:
        first_candidate = candidates[0]
        content = getattr(first_candidate, "content", None)
        parts = getattr(content, "parts", None) if content is not None else None
        if parts:
            part_text = getattr(parts[0], "text", None)
            if isinstance(part_text, str):
                return part_text

    return str(response)


def extract_structured_resume(text: str, jd_summary: str | None = None) -> dict[str, Any]:
    """Return structured resume data as a dict.

    Output keys (best-effort): full_name, email, phone, skills (list), experience_years (float),
    work_history (list of {company,title,start,end,description}), education (list), linkedin_url, github_url
    """
    prompt = (
        "You are a resume parser. Given the raw resume text, extract a JSON object with the following fields: "
        "full_name, email, phone, skills (array of strings), total_experience_years (number or null), "
        "work_history (array of objects with company,title,start,end,description), education (array), "
        "linkedin_url, github_url, portfolio_url. If a field is missing, use null or empty list. "
        "Respond with ONLY valid JSON and no additional commentary.\n\n"
    )

    if jd_summary:
        prompt += f"Context - job description summary: {jd_summary}\n\n"

    prompt += "Resume:\n" + text

    raw = _call_extraction_llm(prompt)

    # Try to parse JSON from the model output. Be forgiving if the model wraps in code fences.
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            # strip code fence
            cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("\n", 1)[0]

        # Attempt to find first JSON object in text
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            json_text = cleaned[start : end + 1]
            return json.loads(json_text)

        # As a last resort, try to json.loads the whole string
        return json.loads(cleaned)
    except Exception:
        logger.exception("Failed to parse JSON from LLM output; returning minimal fallback")
        return {
            "full_name": None,
            "email": None,
            "phone": None,
            "skills": [],
            "total_experience_years": None,
            "work_history": [],
            "education": [],
            "linkedin_url": None,
            "github_url": None,
            "portfolio_url": None,
        }


def generate_explanation(job_summary: str, resume_text: str) -> str:
    """Generate a concise explanation of fit between a job and a resume."""
    prompt = (
        "You are an assistant that explains why a candidate is a good or poor fit.\n"
        f"Job:\n{job_summary}\n\nCandidate resume text:\n{resume_text}\n\n"
        "Provide a 2-3 sentence explanation highlighting strengths and gaps."
    )

    return _call_extraction_llm(prompt)
