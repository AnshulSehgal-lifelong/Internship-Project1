from fastapi import APIRouter

from app.api.routes import ai, auth, departments, documents, employees, health, jobs, dashboard, tasks


api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(departments.router)
api_router.include_router(employees.router)
api_router.include_router(jobs.router)
api_router.include_router(documents.router)
api_router.include_router(ai.router)
api_router.include_router(dashboard.router)
api_router.include_router(tasks.router)