from datetime import date

from sqlalchemy import Boolean, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    first_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    role: Mapped[str | None] = mapped_column(String(120), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Employee fields merged into User
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    salary: Mapped[float | None] = mapped_column(Float, nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])

    @property
    def name(self) -> str:
        parts = [p for p in ((self.first_name or "").strip(), (self.last_name or "").strip()) if p]
        return " ".join(parts)