# cloud/apps/security/embed_token.py

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Callable

from fastapi import HTTPException, Request

EMBED_SECRET = os.getenv("EMBED_SECRET", "")

TOKEN_COOKIE = "pf_embed_token"
SESSION_COOKIE = "pf_embed_sid"

ALLOWED_TYP = {"JWT"}
ALLOWED_ALG = {"HS256"}

SKEW_SECONDS = 30
MIN_SECRET_LENGTH = 32


def _b64url_decode(value: str) -> bytes:
    value = value.strip()
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _b64url_json(value: str) -> dict[str, Any]:
    return json.loads(_b64url_decode(value).decode("utf-8"))


def _server_secret() -> str:
    if not EMBED_SECRET or len(EMBED_SECRET) < MIN_SECRET_LENGTH:
        raise HTTPException(
            status_code=500,
            detail="Server misconfigured: EMBED_SECRET",
        )

    return EMBED_SECRET


def _extract_cookie_token(request: Request) -> str:
    return (request.cookies.get(TOKEN_COOKIE) or "").strip()


def verify_embed_token(
    token: str,
    *,
    audience: str,
    sid: str,
) -> dict[str, Any]:
    secret = _server_secret()

    token = token.strip()
    sid = sid.strip()

    if not token:
        raise HTTPException(status_code=401, detail="Missing embed token")

    if not sid:
        raise HTTPException(status_code=401, detail="Missing session cookie")

    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid token format")

    header_b64, payload_b64, sig_b64 = parts

    try:
        header = _b64url_json(header_b64)
        payload = _b64url_json(payload_b64)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token encoding")

    alg = str(header.get("alg") or "")
    typ = str(header.get("typ") or "")

    if alg not in ALLOWED_ALG:
        raise HTTPException(status_code=401, detail="Invalid token alg")

    if typ not in ALLOWED_TYP:
        raise HTTPException(status_code=401, detail="Invalid token typ")

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    expected_sig = hmac.new(
        secret.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()

    actual_sig = _b64url_decode(sig_b64)

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise HTTPException(status_code=401, detail="Invalid token signature")

    if payload.get("aud") != audience:
        raise HTTPException(status_code=403, detail="Invalid token audience")

    now = int(time.time())

    exp = payload.get("exp")
    if not isinstance(exp, int):
        raise HTTPException(status_code=401, detail="Invalid token exp")

    if now > exp + SKEW_SECONDS:
        raise HTTPException(status_code=401, detail="Token expired")

    iat = payload.get("iat")
    if not isinstance(iat, int):
        raise HTTPException(status_code=401, detail="Invalid token iat")

    if iat > now + SKEW_SECONDS:
        raise HTTPException(status_code=401, detail="Invalid token iat")

    sid_claim = payload.get("sid")
    if not isinstance(sid_claim, str) or not sid_claim.strip():
        raise HTTPException(status_code=401, detail="Missing token sid")

    if sid_claim.strip() != sid:
        raise HTTPException(status_code=403, detail="Session binding failed")

    return payload


def require_embed_token(audience: str) -> Callable[[Request], bool]:
    async def _dep(request: Request) -> bool:
        token = _extract_cookie_token(request)
        sid = request.cookies.get(SESSION_COOKIE, "")

        verify_embed_token(
            token,
            audience=audience,
            sid=sid,
        )

        return True

    return _dep