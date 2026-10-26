"""Pièces jointes rattachées à un commentaire.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("attachments") as batch_op:
        batch_op.add_column(sa.Column("comment_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f("fk_attachments_comment_id_comments"),
            "comments",
            ["comment_id"],
            ["id"],
            ondelete="CASCADE",
        )
    op.create_index(op.f("ix_attachments_comment_id"), "attachments", ["comment_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_attachments_comment_id"), table_name="attachments")
    with op.batch_alter_table("attachments") as batch_op:
        batch_op.drop_constraint("fk_attachments_comment_id_comments", type_="foreignkey")
        batch_op.drop_column("comment_id")
