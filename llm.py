"""Gemini 2.5 Flash client with graceful fallback.

If GEMINI_API_KEY is set and the SDK is installed, real calls are made;
otherwise `complete()` returns None and callers fall back to templated text.
The agent must never stall on the LLM — it is off the pricing critical path.
"""
from __future__ import annotations
import os

import config  # noqa: F401 — ensures .env is loaded (GEMINI_API_KEY) regardless of import order

MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
_client = None
_tried = False


def _get_client():
    global _client, _tried
    if _tried:
        return _client
    _tried = True
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        print("[llm] GEMINI_API_KEY not set in environment/.env → LLM disabled")
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=key)
    except Exception as e:
        print(f"[llm] client init failed ({type(e).__name__}: {e}) → "
              f"is google-genai installed? (pip install google-genai)")
        _client = None
    return _client


def available() -> bool:
    return _get_client() is not None


def complete(prompt: str, system: str | None = None,
             max_tokens: int = 512, json_mode: bool = False) -> str | None:
    """Return model text, or None if the LLM is unavailable / errors."""
    client = _get_client()
    if client is None:
        return None
    import time
    from google.genai import types
    cfg = types.GenerateContentConfig(
        temperature=1.0, top_p=0.95, top_k=64,
        max_output_tokens=max_tokens,
        system_instruction=system,
        response_mime_type="application/json" if json_mode else None,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )
    last = None
    for attempt in range(3):                       # retry transient 429/503 (Flash "high demand")
        try:
            resp = client.models.generate_content(model=MODEL, contents=prompt, config=cfg)
            return (resp.text or "").strip()
        except Exception as e:
            last = e
            msg = str(e)
            if any(c in msg for c in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED")) and attempt < 2:
                time.sleep(2 * (attempt + 1))      # 2s, 4s backoff
                continue
            break
    print(f"[llm] error: {type(last).__name__}: {last}")
    return None
