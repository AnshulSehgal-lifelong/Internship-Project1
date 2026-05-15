"""Add employee columns to `users` table and migrate data from `employees` if present.

Run from the backend virtualenv (where the app's settings apply):

    python backend/scripts/migrate_users_add_columns.py

This script:
- ALTERs `users` to add `department_id`, `salary`, `hire_date` (if not exists)
- Adds FK users.department_id -> departments(id)
- Re-adds departments.manager_id FK to users(id)
- Copies rows from `employees` into `users` (if any) and assigns a temporary password

WARNING: Review before running on production. Back up your DB first.
"""

import asyncio
from datetime import date
import uuid

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.api.routes.auth import hash_password


ALTER_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS salary DOUBLE PRECISION;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;",
    # Add FK from users.department_id -> departments.id if not exists
    "DO $$\nBEGIN\nIF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_department_id_fkey') THEN\n    ALTER TABLE users ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id);\nEND IF;\nEND$$;",
    # Recreate departments.manager_id FK to users(id)
    "ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_manager_id_fkey;",
    "DO $$\nBEGIN\nIF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_manager_id_fkey') THEN\n    ALTER TABLE departments ADD CONSTRAINT departments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id);\nEND IF;\nEND$$;",
]


async def migrate():
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        print("Applying schema ALTERs...")
        for stmt in ALTER_STATEMENTS:
            try:
                await session.execute(text(stmt))
            except Exception as exc:
                print(f"Warning executing: {stmt}\n  -> {exc}")
        await session.commit()

        # Check if employees table exists and has rows
        try:
            res = await session.execute(text("SELECT to_regclass('public.employees')"))
            exists = res.scalar_one()
            if not exists:
                print("No employees table found; skipping data copy.")
                return
        except Exception:
            print("Failed to check employees table presence; skipping data copy.")
            return

        # Select rows from employees
        try:
            rows = await session.execute(text("SELECT id, name, email, department_id, role, salary, hire_date FROM employees"))
            employees = rows.fetchall()
        except Exception as exc:
            print(f"Failed to read employees table: {exc}")
            return

        if not employees:
            print("No rows in employees table to migrate.")
            return

        print(f"Found {len(employees)} employee rows; migrating to users (if not present)...")

        for emp in employees:
            emp_id, name, email, department_id, role, salary, hire_date = emp
            # Skip if a user with this email already exists
            existing = await session.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email})
            if existing.scalar_one_or_none():
                print(f"User with email {email} already exists; skipping.")
                continue

            parts = (name or "").split(" ", 1)
            first_name = parts[0] if parts else None
            last_name = parts[1] if len(parts) > 1 else None

            temp_pw = str(uuid.uuid4())
            hashed = hash_password(temp_pw)

            insert_stmt = text(
                "INSERT INTO users (first_name, last_name, role, email, hashed_password, is_active, department_id, salary, hire_date)"
                " VALUES (:first_name, :last_name, :role, :email, :hashed_password, true, :department_id, :salary, :hire_date)"
            )
            try:
                await session.execute(insert_stmt, {
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "email": email,
                    "hashed_password": hashed,
                    "department_id": department_id,
                    "salary": salary,
                    "hire_date": hire_date,
                })
                print(f"Inserted user for {email} (temporary password generated).")
            except Exception as exc:
                print(f"Failed to insert user for {email}: {exc}")

        await session.commit()
        print("Migration finished. Please ensure users update their passwords and remove the employees table when safe.")


if __name__ == '__main__':
    asyncio.run(migrate())
