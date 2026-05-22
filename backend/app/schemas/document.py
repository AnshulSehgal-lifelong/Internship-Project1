from datetime import datetime
import uuid

from app.db.models.document import DocumentStatus, DocumentType
from app.schemas.common import ORMBaseModel


class DocumentRead(ORMBaseModel):
    id: uuid.UUID
    storage_path: str
    original_name: str
    file_size_bytes: int
    mime_type: str
    user_id: int
    status: DocumentStatus
    vector_collection_id: str | None = None
    document_type: DocumentType
    created_at: datetime
    updated_at: datetime