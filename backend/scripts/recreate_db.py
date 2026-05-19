import asyncio
from app.db.session import engine
from app.models.base import Base

# Import all models to ensure they are registered with Base.metadata
from app.models.user import User
from app.models.department import Department
from app.models.job_opening import JobOpening
from app.models.document import Document

async def main():
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
    print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
