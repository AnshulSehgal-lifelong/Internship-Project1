﻿"""Print record counts for the main application tables."""

import asyncio
import os
import sys

# Add the current directory to sys.path so we can import 'app'.
sys.path.append(os.getcwd())

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from backend.app.db.models.department import Department
from backend.app.db.models.document import Document
from backend.app.db.models.job_application import JobApplication
from backend.app.db.models.job_opening import JobOpening
from backend.app.db.models.task import Task
from backend.app.db.models.user import User


async def get_counts() -> None:
    async with AsyncSessionLocal() as session:
        models = [
            ("Users", User),
            ("Departments", Department),
            ("JobOpenings", JobOpening),
            ("JobApplications", JobApplication),
            ("Tasks", Task),
            ("Documents", Document),
        ]
        for name, model in models:
            stmt = select(func.count()).select_from(model)
            result = await session.execute(stmt)
            count = result.scalar()
            print(f"{name}: {count}")


if __name__ == "__main__":
    try:
        asyncio.run(get_counts())
    except Exception:
        import traceback

        traceback.print_exc()
