"""Clear all TalentFlow database data.

This script truncates all application tables and resets identity counters.
Use it when you want to wipe the sample and test data and start fresh.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.db.session import AsyncSessionLocal


TABLES = ["documents", "job_openings", "departments", "users"]


async def main() -> None:
    async with AsyncSessionLocal() as session:
        table_list = ", ".join(TABLES)
        await session.execute(text(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE"))
        await session.commit()

    print("Clear complete: all application tables were truncated and identities reset.")


if __name__ == "__main__":
    asyncio.run(main())