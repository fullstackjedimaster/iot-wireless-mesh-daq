# cloud/apps/main.py
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from .routes import router as main_router

ALLOWED_REFERER = "https://fullstackjedi.dev"

class RefererMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        referer = request.headers.get("referer")
        if referer and referer.startswith(ALLOWED_REFERER):
            return await call_next(request)
        else:
            raise HTTPException(status_code=403, detail="Access forbidden: invalid referer.")

app = FastAPI(
    title="Wireless Mesh DAQ API",
    description="FastAPI backend for daq-ui dashboard",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# app.add_middleware(RefererMiddleware)
#
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

app.include_router(main_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Wireless DAQ API root"}
