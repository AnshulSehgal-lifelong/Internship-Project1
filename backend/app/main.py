import logging
from urllib.parse import urlsplit, urlunsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.db.session import AsyncSessionLocal


logging.basicConfig(level=logging.INFO)
app = FastAPI(title=settings.app_name)
logger = logging.getLogger(__name__)


def _mask_database_url(url: str) -> str:
    try:
        parts = urlsplit(url)
    except Exception:
        return "<unparseable>"
    if parts.password is None:
        return url
    netloc = parts.netloc.replace(parts.password, "***")
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))

# Add CORS middleware first, before other middlewares and routers
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom exception handler to return JSON for all errors
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__},
    )

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
async def startup_diagnostics() -> None:
    logger.info("Database URL: %s", _mask_database_url(settings.database_url))
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'documents' AND column_name = 'storage_path'"
            )
        )
        if result.first() is None:
            logger.warning("documents.storage_path not found in connected database.")
        else:
            logger.info("documents.storage_path found in connected database.")


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}