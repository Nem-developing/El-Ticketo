"""Catégories propres à chaque projet.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Les catégories jusqu'ici proposées à tous les projets.
DEFAULT_CATEGORIES = "Support technique\nDemande d'information\nProblème de compte\nBug\nSuggestion"


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("categories", sa.Text(), nullable=False, server_default=DEFAULT_CATEGORIES),
    )


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_column("categories")
