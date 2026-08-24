"""Add address to job_applications

Revision ID: b7e4d8a9c1f2
Revises: dcb241bb9d5f
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7e4d8a9c1f2"
down_revision: Union[str, Sequence[str], None] = "dcb241bb9d5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("job_applications", sa.Column("address", sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("job_applications", "address")