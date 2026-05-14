import asyncio
from sqlalchemy import select, func
from database import SessionLocal
from models import User, Department, Employee, JobOpening, Document

async def get_counts():
    async with SessionLocal() as session:
        counts = {}
        for model in [User, Department, Employee, JobOpening, Document]:
            stmt = select(func.count()).select_from(model)
            result = await session.execute(stmt)
            counts[model.__name__] = result.scalar()
        
        for name, count in counts.items():
            print(f"{name}: {count}")

if __name__ == "__main__":
    try:
        asyncio.run(get_counts())
    except Exception as e:
        import traceback
        traceback.print_exc()
