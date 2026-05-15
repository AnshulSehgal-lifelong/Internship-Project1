"""Seed the TalentFlow database with sample HR data.

This script inserts:
- two departments: Engineering and Human Resources
- two employees: one engineer and one HR manager
- one department manager assignment for Engineering
- two job openings: Backend Engineer and HR Generalist
- one sample document record for the knowledge base
- one sample user account for testing login
"""

from __future__ import annotations

import asyncio
from datetime import date

import bcrypt
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.department import Department
from app.models.document import Document
# Employee table removed; employees are now stored in `users` table via User model
from app.models.user import User
from app.models.job_opening import JobOpening
from app.models.user import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        # Sample departments for the org chart.
        engineering = (await session.execute(select(Department).where(Department.name == "Engineering"))).scalar_one_or_none()
        hr = (await session.execute(select(Department).where(Department.name == "Human Resources"))).scalar_one_or_none()

        if engineering is None:
            engineering = Department(name="Engineering")
            session.add(engineering)

        if hr is None:
            hr = Department(name="Human Resources")
            session.add(hr)

        await session.flush()

        # Sample employees for dashboard, directory, and auth testing.
        alice = (await session.execute(select(User).where(User.email == "alice.johnson@talentflow.local"))).scalar_one_or_none()
        if alice is None:
            alice = User(
                first_name="Alice",
                last_name="Johnson",
                name="Alice Johnson" if False else None,
                email="alice.johnson@talentflow.local",
                role="Senior Backend Engineer",
                department_id=engineering.id,
                salary=98000,
                hire_date=date(2024, 2, 12),
                hashed_password=hash_password("Employee@123"),
            )
            session.add(alice)

        bob = (await session.execute(select(User).where(User.email == "bob.singh@talentflow.local"))).scalar_one_or_none()
        if bob is None:
            bob = User(
                first_name="Bob",
                last_name="Singh",
                name="Bob Singh" if False else None,
                email="bob.singh@talentflow.local",
                role="HR Manager",
                department_id=hr.id,
                salary=86000,
                hire_date=date(2023, 9, 4),
                hashed_password=hash_password("Employee@123"),
            )
            session.add(bob)

        await session.flush()

        # Link Engineering to Alice as the department manager.
        engineering.manager_id = alice.id

        # Sample openings for the recruitment screen.
        if not (await session.execute(select(JobOpening).where(JobOpening.title == "Backend Engineer"))).scalar_one_or_none():
            session.add(
                JobOpening(
                    title="Backend Engineer",
                    description="Build FastAPI services for HR workflows, reporting, and AI integrations.",
                    requirements="Python, FastAPI, PostgreSQL, async SQLAlchemy, APIs, testing",
                )
            )

        if not (await session.execute(select(JobOpening).where(JobOpening.title == "HR Generalist"))).scalar_one_or_none():
            session.add(
                JobOpening(
                    title="HR Generalist",
                    description="Support employee lifecycle operations, policies, onboarding, and HR documentation.",
                    requirements="HR operations, documentation, communication, employee support",
                )
            )

        # Sample document for the knowledge base.
        if not (await session.execute(select(Document).where(Document.filename == "Employee Handbook - Sample.pdf"))).scalar_one_or_none():
            session.add(
                Document(
                    filename="Employee Handbook - Sample.pdf",
                    content_type="application/pdf",
                    text_preview="Sample handbook content: leave policy, code of conduct, onboarding, and benefits overview.",
                )
            )

        # Sample login account for testing the auth flow.
        if not (await session.execute(select(User).where(User.email == "admin@talentflow.local"))).scalar_one_or_none():
            session.add(
                User(
                    first_name="Admin",
                    last_name="User",
                    role="Administrator",
                    email="admin@talentflow.local",
                    hashed_password=hash_password("Admin@1234"),
                )
            )

        await session.commit()

    print("Seed complete: departments, employees, job openings, document, and admin user inserted.")


if __name__ == "__main__":
    asyncio.run(main())