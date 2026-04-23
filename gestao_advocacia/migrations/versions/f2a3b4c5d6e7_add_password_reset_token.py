"""add_password_reset_token

Revision ID: f2a3b4c5d6e7
Revises: 44d93d733c33
Create Date: 2026-04-23 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "f2a3b4c5d6e7"
down_revision = "44d93d733c33"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "password_reset_token" not in inspector.get_table_names():
        op.create_table(
            "password_reset_token",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("requested_ip", sa.String(length=45), nullable=True),
            sa.Column("requested_user_agent", sa.String(length=500), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["user.id"],
                name="fk_password_reset_user_id",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash", name="uq_password_reset_token_hash"),
        )
        op.create_index(
            "ix_password_reset_token_user_id",
            "password_reset_token",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "ix_password_reset_token_token_hash",
            "password_reset_token",
            ["token_hash"],
            unique=False,
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "password_reset_token" in inspector.get_table_names():
        op.drop_index(
            "ix_password_reset_token_token_hash", table_name="password_reset_token"
        )
        op.drop_index(
            "ix_password_reset_token_user_id", table_name="password_reset_token"
        )
        op.drop_table("password_reset_token")
