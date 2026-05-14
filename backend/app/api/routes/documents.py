from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.document import Document
from app.schemas.document import DocumentRead
from app.api.routes.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/", response_model=list[DocumentRead])
async def list_documents(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Document]:
    # Any authenticated user may view the knowledge base
    result = await db.execute(select(Document).order_by(Document.id.desc()))
    return list(result.scalars().all())


@router.post("/upload", response_model=DocumentRead)
async def upload_document(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> Document:
    # Only admin may upload policies/documents
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to upload documents")

    contents = await file.read()
    preview = contents[:200].decode(errors="ignore")
    document = Document(
        filename=file.filename or "document",
        content_type=file.content_type,
        text_preview=preview,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    if (current_user.role or "") != "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete documents")

    document = await db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await db.delete(document)
    await db.commit()