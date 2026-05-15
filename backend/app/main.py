from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse, Response
from jose import jwt

from app.api.router import api_router
from app.core.config import settings


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BrowserAuthRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        public_paths = (
            "/",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/favicon.ico",
        )

        is_auth_route = path.startswith(f"{settings.api_v1_prefix}/auth")
        is_public_path = path in public_paths or path.startswith("/static/")
        is_browser_request = "text/html" in request.headers.get("accept", "")

        if not is_auth_route and not is_public_path:
            auth_header = request.headers.get("authorization", "")
            token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

            if is_browser_request and not token:
                return RedirectResponse(url=f"{settings.frontend_url}/login", status_code=302)

            if token:
                try:
                    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
                    if payload.get("type") != "access":
                        raise ValueError("Invalid token type")
                except Exception:  # noqa: BLE001
                    if is_browser_request:
                        return RedirectResponse(url=f"{settings.frontend_url}/login", status_code=302)

        return await call_next(request)


app.add_middleware(BrowserAuthRedirectMiddleware)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}