"""Drop and recreate the database schema and tables."""

import asyncio

from sqlalchemy import text

from app.db.session import engine
from backend.app.db.base import Base

# Import all models to register with Base.
from backend.app.db.models.department import Department
from backend.app.db.models.document import Document
from backend.app.db.models.job_application import JobApplication
from backend.app.db.models.job_opening import JobOpening
from backend.app.db.models.task import Task
from backend.app.db.models.user import User


async def main() -> None:
    async with engine.begin() as conn:
        print("Dropping schema public cascade...")
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
