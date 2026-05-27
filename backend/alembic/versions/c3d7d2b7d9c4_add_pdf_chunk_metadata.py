"""add pdf chunk metadata

Revision ID: c3d7d2b7d9c4
Revises: 5f1f7cd0f4a1
Create Date: 2026-05-26 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d7d2b7d9c4"
down_revision: Union[str, Sequence[str], None] = "5f1f7cd0f4a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "document_chunks",
        sa.Column("full_text", sa.Text(), nullable=False, server_default=sa.text("''")),
    )
    op.add_column(
        "document_chunks",
        sa.Column("heading", sa.String(length=255), nullable=False, server_default=sa.text("''")),
    )
    op.add_column(
        "document_chunks",
        sa.Column("page", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "document_chunks",
        sa.Column("tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("document_chunks", "tokens")
    op.drop_column("document_chunks", "page")
    op.drop_column("document_chunks", "heading")
    op.drop_column("document_chunks", "full_text")