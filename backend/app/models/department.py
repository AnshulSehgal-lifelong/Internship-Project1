from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    employees = relationship("User", back_populates="department", foreign_keys="User.department_id")