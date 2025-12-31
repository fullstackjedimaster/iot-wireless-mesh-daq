# app/security/embed_token.py
import os
import hmac
import json
import time
import base64
import hashlib
from typing import Optional, Dict, Any

from fastapi import Header, HTTPException, status

EMBED_SECRET = os.getenv("EMBED_SECRET", "")

# Allow small clock skew between client/server/container hosts
DEFAULT_LEEWAY_SECONDS = int(os.getenv("EMBED_LEEWAY_SECONDS", "30"))


class EmbedPayload(dict):
    """
    Minimal payload: aud, iat, exp, jti.
    Dict subclass to avoid pulling in Pydantic.
    """
    @property
    def aud(self) -> Optional[str]:
        v = self.get("aud")
        return str(v) if v is not None else None

    @property
    def iat(self) -> Optional[int]:
        v = self.get("iat")
        try:
            return int(v) if v is not None else None
        except Exception:
            return None

    @property
    def exp(self) -> Optional[int]:
        v = self.get("exp")
        try:
            return int(v) if v is not None else None
        except Exception:
            return None

    @property
    def jti(self) -> Optional[str]:
        v = self.get("jti")
        return str(v) if v is not None else None


def _b64url_decode(s: str) -> bytes:
    """
    Strict-ish base64url decode (accepts missing padding).
    Raises ValueError on invalid inputs.
    """
    if not isinstance(s, str) or not s:
        raise ValueError("empty b64")
    # Restore padding
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + pad).encode("utf-8"))


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("utf-8")


def _parse_jws(token: str) -> tuple[Dict[str, Any], Dict[str, Any], bytes, bytes, str, str]:
    """
    Returns: (header_dict, payload_dict, signing_input_bytes, sig_bytes, header_b64, payload_b64)
    """
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")

    try:
        header_raw = _b64url_decode(header_b64)
        payload_raw = _b64url_decode(payload_b64)
        sig_bytes = _b64url_decode(sig_b64)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token encoding")

    try:
        header = json.loads(header_raw.decode("utf-8"))
        payload = json.loads(payload_raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token JSON")

    if not isinstance(header, dict) or not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token structure")

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    return header, payload, signing_input, sig_bytes, header_b64, payload_b64


def verify_embed_token_raw(token: str, expected_aud: str, leeway_seconds: int = DEFAULT_LEEWAY_SECONDS) -> EmbedPayload:
    """
    Verifies a compact JWS-like token: base64url(header).base64url(payload).base64url(signature)
    Signature = HMAC-SHA256(secret, header_b64 + "." + payload_b64)
    """
    if not EMBED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Embed secret not configured (EMBED_SECRET missing)",
        )

    header, payload_dict, signing_input, sig_bytes, _, _ = _parse_jws(token)

    alg = header.get("alg")
    typ = header.get("typ")

    # Hard-enforce HS256; reject "none" and anything else.
    if alg != "HS256":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token algorithm")
    # Optional sanity check
    if typ is not None and str(typ).upper() not in ("JWT", "EMBED", "JWS"):
        # not fatal, but you can choose to be strict. We'll be strict.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    expected_sig = hmac.new(
        EMBED_SECRET.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()

    # Constant-time compare on raw bytes, not base64 strings
    if not hmac.compare_digest(expected_sig, sig_bytes):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

    payload = EmbedPayload(payload_dict)

    now = int(time.time())

    # exp required
    exp = payload.exp
    if exp is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing exp")
    if exp < (now - leeway_seconds):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")

    # aud required
    if payload.aud != expected_aud:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token audience")

    # Optional: iat must not be too far in the future
    iat = payload.iat
    if iat is not None and iat > (now + leeway_seconds):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token used before issued")

    return payload


def require_embed_token(expected_aud: str):
    """
    FastAPI dependency factory.
    Supports:
      - X-Embed-Token: <token>
      - Authorization: Bearer <token>   (optional convenience)
    """
    async def _dep(
        x_embed_token: Optional[str] = Header(None, alias="X-Embed-Token"),
        authorization: Optional[str] = Header(None, alias="Authorization"),
    ) -> EmbedPayload:
        # Optional bypass for "public mode"
        if os.getenv("EMBED_ENFORCEMENT", "1").lower() in ("0", "false", "off", "no"):
            return EmbedPayload({})

        token = None

        if x_embed_token:
            token = x_embed_token.strip()

        # If no X-Embed-Token, accept Authorization: Bearer ...
        if not token and authorization:
            parts = authorization.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1].strip()

        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing embed token")

        return verify_embed_token_raw(token, expected_aud)

    return _dep


# Optional helper: generate a token (useful for admin scripts / debugging)
def mint_embed_token(expected_aud: str, ttl_seconds: int = 3600) -> str:
    """
    Creates a signed token with HS256 HMAC.
    """
    if not EMBED_SECRET:
        raise RuntimeError("EMBED_SECRET missing")

    now = int(time.time())
    header = {"alg": "HS256", "typ": "EMBED"}
    payload = {"aud": expected_aud, "iat": now, "exp": now + int(ttl_seconds)}

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    sig = hmac.new(EMBED_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)

    return f"{header_b64}.{payload_b64}.{sig_b64}"
