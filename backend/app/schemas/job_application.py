from datetime import datetime

from app.schemas.common import ORMBaseModel


class JobApplicationRead(ORMBaseModel):
    id: int
    job_opening_id: int
    full_name: str
    email: str
    phone: str
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    resume_original_name: str
    resume_mime_type: str
    resume_size_bytes: int
    status: str
    selected_at: datetime | None = None
    rejected_at: datetime | None = None
    created_at: datetime
