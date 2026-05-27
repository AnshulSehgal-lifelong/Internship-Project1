"""Shared helpers for API route modules."""

from __future__ import annotations


def format_full_name(first_name: str | None, last_name: str | None, fallback: str = "Unknown") -> str:
    """Return a trimmed full name or the fallback when missing."""
    full_name = f"{first_name or ''} {last_name or ''}".strip()
    return full_name or fallback


def is_hr_department(name: str | None) -> bool:
    """Return True when a department name represents HR."""
    if not name:
        return False
    normalized = name.strip().lower()
    return normalized in {"hr", "human resources"}
