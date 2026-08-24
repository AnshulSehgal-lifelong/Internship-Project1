from datetime import datetime
import enum

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class JobApplicationStatus(str, enum.Enum):
    pending = "pending"
    selected = "selected"
    rejected = "rejected"


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_opening_id: Mapped[int] = mapped_column(ForeignKey("job_openings.id"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    github_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    resume_original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    resume_mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    resume_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[JobApplicationStatus] = mapped_column(
        Enum(JobApplicationStatus, name="job_application_status"),
        default=JobApplicationStatus.pending,
        nullable=False,
    )
    selected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
