"""Add job_application_embeddings table

Revision ID: 9a7b8c1f2d3f
Revises: 3edecbf64a36
Create Date: 2026-05-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = "9a7b8c1f2d3f"
down_revision: Union[str, Sequence[str], None] = "3edecbf64a36"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "job_application_embeddings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_application_id", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(dim=768), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_application_id"], ["job_applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_job_application_embeddings_job_application_id"), "job_application_embeddings", ["job_application_id"], unique=False)
    op.create_index(op.f("idx_job_application_embeddings_embedding"), "job_application_embeddings", ["embedding"], unique=False, postgresql_ops={"embedding": "vector_cosine_ops"}, postgresql_using="hnsw")


def downgrade() -> None:
    op.drop_index(op.f("idx_job_application_embeddings_embedding"), table_name="job_application_embeddings")
    op.drop_index(op.f("ix_job_application_embeddings_job_application_id"), table_name="job_application_embeddings")
    op.drop_table("job_application_embeddings")
