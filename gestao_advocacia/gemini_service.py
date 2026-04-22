from __future__ import annotations

from flask import current_app


def is_enabled() -> bool:
    key = (current_app.config.get("GEMINI_API_KEY") or "").strip()
    return bool(key)


def get_gemini_client():
    if not is_enabled():
        return None

    try:
        from google import genai
    except Exception:
        return None

    api_key = (current_app.config.get("GEMINI_API_KEY") or "").strip()
    if not api_key:
        return None

    return genai.Client(api_key=api_key)
