import hashlib
import re

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def mask_email(email: str) -> str:
    raw = str(email or "").strip()
    if _EMAIL_RE.match(raw):
        local, domain = raw.split("@", 1)
        return f"{local[0]}***@{domain}"
    return f"{raw[:3]}***"


def mask_user_id(user_id) -> str:
    return hashlib.sha256(str(user_id).encode()).hexdigest()[:8]
