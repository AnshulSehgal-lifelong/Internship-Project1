from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    role: Mapped[str | None] = mapped_column(String(120), nullable=True)
    salary: Mapped[float | None] = mapped_column(Float, nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])