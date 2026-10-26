"""Catégories par défaut plus générales : Problème, Demande, Question, Suggestion.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = "Support technique\nDemande d'information\nProblème de compte\nBug\nSuggestion"
NEW = "Problème\nDemande\nQuestion\nSuggestion"

projects = sa.table("projects", sa.column("categories", sa.Text()))


def _replace(before: str, after: str) -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.alter_column("categories", existing_type=sa.Text(), server_default=after)
    # Seuls les projets restés sur la liste par défaut changent ; une liste retouchée est gardée.
    op.execute(projects.update().where(projects.c.categories == before).values(categories=after))


def upgrade() -> None:
    _replace(OLD, NEW)


def downgrade() -> None:
    _replace(NEW, OLD)
