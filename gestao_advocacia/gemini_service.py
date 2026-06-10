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

    # Timeout (ms) em todas as chamadas: sem ele, uma indisponibilidade da
    # API do Gemini pendura o worker/job indefinidamente (auditoria 06/2026).
    from google.genai import types  # noqa: PLC0415

    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=60_000),
    )
