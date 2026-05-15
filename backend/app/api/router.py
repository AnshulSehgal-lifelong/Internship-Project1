from fastapi import APIRouter, Depends

from app.api.routes import ai, auth, departments, documents, employees, health, jobs
from app.api.routes.auth import get_current_user


api_router = APIRouter()
# Keep auth routes public
api_router.include_router(auth.router)

# Protect all other routers with the `get_current_user` dependency so
# no API route (except `/auth/*`) can be accessed without a valid token.
api_router.include_router(health.router, dependencies=[Depends(get_current_user)])
api_router.include_router(departments.router, dependencies=[Depends(get_current_user)])
api_router.include_router(employees.router, dependencies=[Depends(get_current_user)])
api_router.include_router(jobs.router, dependencies=[Depends(get_current_user)])
api_router.include_router(documents.router, dependencies=[Depends(get_current_user)])
api_router.include_router(ai.router, dependencies=[Depends(get_current_user)])