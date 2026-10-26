"""Journal d'administration.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UTC_DATETIME = sa.DateTime()
LOG_LEVEL = sa.Enum("info", "warning", "error", name="loglevel", native_enum=False, length=20)


def upgrade() -> None:
    op.create_table(
        "log_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", UTC_DATETIME, nullable=False),
        sa.Column("level", LOG_LEVEL, nullable=False),
        sa.Column("actor", sa.String(length=32), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_log_entries")),
    )
    op.create_index(op.f("ix_log_entries_created_at"), "log_entries", ["created_at"])


def downgrade() -> None:
    op.drop_table("log_entries")
