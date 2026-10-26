"""
LegalDesk AI - FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog

from app.core.config import settings
from app.core.store import store
from app.core.logging import configure_logging
from app.api.v1.router import api_router

configure_logging()
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("LegalDesk AI starting up", environment=settings.ENVIRONMENT)
    yield
    log.info("LegalDesk AI shutting down")


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="LegalDesk AI",
    description="AI-powered legal case workspace for Indian lawyers",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pathlib import Path
from fastapi.responses import JSONResponse, FileResponse

STATIC_FILE = Path(__file__).parent / "static" / "index.html"

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
@app.get("/workspace")
@app.get("/case/{case_id}")
async def serve_ui():
    if STATIC_FILE.exists():
        return FileResponse(str(STATIC_FILE))
    return JSONResponse({"status": "ok", "service": "legaldesk-ai"})


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "legaldesk-ai",
        "database": "local_store (zero external db)",
        "openai_configured": bool(settings.OPENAI_API_KEY),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("Unhandled exception", exc_info=exc, path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )
