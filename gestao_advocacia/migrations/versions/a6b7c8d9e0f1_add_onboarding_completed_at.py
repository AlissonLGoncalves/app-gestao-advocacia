"""add onboarding_completed_at to tenant (wizard pos-signup)

Revision ID: a6b7c8d9e0f1
Revises: ad05c0fea001
Create Date: 2026-04-26 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a6b7c8d9e0f1"
down_revision = "ad05c0fea001"
branch_labels = None
depends_on = None


def _column_exists(conn, table, column):
    cols = {c["name"] for c in sa.inspect(conn).get_columns(table)}
    return column in cols


def upgrade():
    conn = op.get_bind()

    if not _column_exists(conn, "tenant", "onboarding_completed_at"):
        with op.batch_alter_table("tenant") as batch:
            batch.add_column(sa.Column("onboarding_completed_at", sa.DateTime(), nullable=True))

        # Backfill: tenants existentes ja estao operando, marcar como onboarded
        # com a data de criacao para nao forcar wizard em quem ja usa o sistema.
        # Apenas tenants criados apos este deploy ficam com NULL e veem o wizard.
        op.execute(
            "UPDATE tenant SET onboarding_completed_at = created_at "
            "WHERE onboarding_completed_at IS NULL"
        )


def downgrade():
    conn = op.get_bind()
    if _column_exists(conn, "tenant", "onboarding_completed_at"):
        with op.batch_alter_table("tenant") as batch:
            batch.drop_column("onboarding_completed_at")
