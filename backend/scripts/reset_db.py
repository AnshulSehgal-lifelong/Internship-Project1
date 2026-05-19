import asyncio
from sqlalchemy import text
from app.db.session import engine
from app.models.base import Base
# Import all models to register with Base
from app.models.user import User
from app.models.department import Department
from app.models.job_opening import JobOpening
from app.models.document import Document

async def main():
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
