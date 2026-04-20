from __future__ import annotations

from flask import current_app


def is_enabled() -> bool:
    key = (current_app.config.get("GEMINI_API_KEY") or "").strip()
    return bool(key)


def get_gemini_client():
    if not is_enabled():
        return None

    try:
        import google.generativeai as genai
    except Exception:
        return None

    api_key = (current_app.config.get("GEMINI_API_KEY") or "").strip()
    if not api_key:
        return None

    genai.configure(api_key=api_key)
    return genai
