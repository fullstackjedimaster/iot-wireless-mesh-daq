# app/security/embed_token.py
import os
import hmac
import json
import time
import base64
import hashlib
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

EMBED_SECRET = os.getenv("EMBED_SECRET", "")

class EmbedPayload(dict):
    """
    Minimal payload type: aud, iat, exp, jti.
    Use dict subclass here to avoid pulling in Pydantic if you don't want to.
    """
    @property
    def aud(self) -> Optional[str]:
        return self.get("aud")

    @property
    def exp(self) -> Optional[int]:
        return self.get("exp")


def _b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def verify_embed_token_raw(token: str, expected_aud: str) -> EmbedPayload:
    if not EMBED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Embed secret not configured",
        )

    try:
        header_b64, body_b64, sig_b64 = token.split(".")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")

    signing_input = f"{header_b64}.{body_b64}".encode("utf-8")

    expected_sig = base64.urlsafe_b64encode(
        hmac.new(EMBED_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    ).rstrip(b"=").decode("utf-8")

    if not hmac.compare_digest(expected_sig, sig_b64):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

    try:
        body_json = json.loads(_b64url_decode(body_b64).decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    payload = EmbedPayload(body_json)

    now = int(time.time())
    if payload.exp is None or payload.exp < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")

    if payload.aud != expected_aud:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token audience")

    return payload


def require_embed_token(expected_aud: str):
    """
    FastAPI dependency factory.
    Usage:
        @router.get("/stuff")
        async def get_stuff(embed=Depends(require_embed_token("mesh-daq"))):
            ...
    """
    async def _dep(x_embed_token: str = Header(None, alias="X-Embed-Token")) -> EmbedPayload:
        # Optional bypass for "public mode" when you want to run app standalone later.
        if os.getenv("EMBED_ENFORCEMENT", "1") in ("0", "false", "False"):
            return EmbedPayload({})

        if not x_embed_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing embed token")

        return verify_embed_token_raw(x_embed_token, expected_aud)

    return _dep
