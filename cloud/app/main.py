# apps/main.py

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from .routes import router as main_router
# We’ll keep this import for future token-based protection, but we’re not
# wiring it as a global dependency yet so the dashboard can work:
from app.security.embed_token import require_embed_token


# Domains we trust as callers / embedders
ALLOWED_REFERERS = [
    "https://fullstackjedi.dev",
    "https://www.fullstackjedi.dev",
    "https://mesh-daq.fullstackjedi.dev",
]


class RefererMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # For same-origin XHR from the mesh-daq UI, referer will normally be
        # https://mesh-daq.fullstackjedi.dev/...
        referer = request.headers.get("referer")

        # Allow if no Referer (curl, privacy modes, some proxies)
        if not referer:
            return await call_next(request)

        # Allow any request whose Referer starts with one of our trusted prefixes
        for prefix in ALLOWED_REFERERS:
            if referer.startswith(prefix):
                return await call_next(request)

        # Anything else is rejected
        raise HTTPException(status_code=403, detail="Access forbidden: invalid referer.")


app = FastAPI(
    title="Wireless Mesh DAQ API",
    description="FastAPI backend for daq-ui dashboard",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    # When you’re ready to enforce the embed token, uncomment this:
    # dependencies=[Depends(require_embed_token("mesh-daq"))],
)

# Enforce referer checks
app.add_middleware(RefererMiddleware)

# CORS is mostly for cross-origin XHR; we mirror the same allowed domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fullstackjedi.dev",
        "https://www.fullstackjedi.dev",
        "https://mesh-daq.fullstackjedi.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Main API
app.include_router(main_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Wireless DAQ API root"}
