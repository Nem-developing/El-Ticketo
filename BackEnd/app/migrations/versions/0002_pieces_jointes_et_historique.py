"""Pièces jointes et historique des tickets.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UTC_DATETIME = sa.DateTime()
CHUNK_DATA = sa.LargeBinary().with_variant(mysql.MEDIUMBLOB(), "mysql", "mariadb")


def upgrade() -> None:
    op.create_table(
        "ticket_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("field", sa.String(length=20), nullable=False),
        sa.Column("value", sa.String(length=200), nullable=True),
        sa.Column("created_at", UTC_DATETIME, nullable=False),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            name=op.f("fk_ticket_events_ticket_id_tickets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name=op.f("fk_ticket_events_actor_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ticket_events")),
    )
    op.create_index(op.f("ix_ticket_events_ticket_id"), "ticket_events", ["ticket_id"])

    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=200), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("created_at", UTC_DATETIME, nullable=False),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            name=op.f("fk_attachments_ticket_id_tickets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by_id"], ["users.id"], name=op.f("fk_attachments_uploaded_by_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_attachments")),
    )
    op.create_index(op.f("ix_attachments_ticket_id"), "attachments", ["ticket_id"])

    op.create_table(
        "attachment_chunks",
        sa.Column("attachment_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("data", CHUNK_DATA, nullable=False),
        sa.ForeignKeyConstraint(
            ["attachment_id"],
            ["attachments.id"],
            name=op.f("fk_attachment_chunks_attachment_id_attachments"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("attachment_id", "position", name=op.f("pk_attachment_chunks")),
    )


def downgrade() -> None:
    op.drop_table("attachment_chunks")
    op.drop_table("attachments")
    op.drop_table("ticket_events")
