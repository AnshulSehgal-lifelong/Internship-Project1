import asyncio
import os
import sys

# Add the current directory to sys.path so we can import 'app'
sys.path.append(os.getcwd())

from sqlalchemy import select, func
from app.db.session import SessionLocal
from app.models.user import User
from app.models.department import Department
from app.models.employee import Employee
from app.models.job_opening import JobOpening
from app.models.document import Document

async def get_counts():
    async with SessionLocal() as session:
        models = [
            ("Users", User),
            ("Departments", Department),
            ("Employees", Employee),
            ("JobOpenings", JobOpening),
            ("Documents", Document)
        ]
        for name, model in models:
            stmt = select(func.count()).select_from(model)
            result = await session.execute(stmt)
            count = result.scalar()
            print(f"{name}: {count}")

if __name__ == "__main__":
    try:
        asyncio.run(get_counts())
    except Exception as e:
        import traceback
        traceback.print_exc()
