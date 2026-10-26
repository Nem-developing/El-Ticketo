"""Comptes rattachés au SSO (OpenID Connect).

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("sso_subject", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_users_sso_subject"), "users", ["sso_subject"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_sso_subject"), table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("sso_subject")
