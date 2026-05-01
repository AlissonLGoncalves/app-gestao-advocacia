"""denormalize tenant_id em movimentacao_cnj (Onda 3.1 Fase 4 Batch 1, pre-RLS)

Decisao #1 do plano (docs/onda-3.1-rls-plano.md): denormalizar tenant_id
diretamente em movimentacao_cnj em vez de policy via subquery em caso_id.
Razao: hot-path de ingestao DJEN/CNJ — subquery por linha seria caro.

Steps:
1. ADD COLUMN tenant_id (nullable temporario)
2. Backfill via UPDATE ... FROM caso WHERE caso_id = caso.id
3. Validar COUNT(*) WHERE tenant_id IS NULL == 0 (defensivo)
4. ALTER COLUMN NOT NULL
5. Adicionar FK + indice composto (tenant_id, data_registro_sistema)
6. Drop indice antigo (caso_id, data_registro_sistema) — substituido pelo
   novo (tenant_id, data_registro_sistema) que serve queries por tenant
   listadas no dashboard. Queries por caso especifico continuam usando
   o indice em caso_id (criado pela FK ix em linha 319 do model).

A migration e idempotente em re-runs parciais (Postgres apenas) e usa
GUARDS pra SQLite (no-op em testes/dev).

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-04-28 21:30:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("movimentacao_cnj")}

    if "tenant_id" not in cols:
        op.add_column(
            "movimentacao_cnj", sa.Column("tenant_id", sa.Integer(), nullable=True)
        )

    # Backfill: tenant_id de cada movimentacao vem do caso pai
    op.execute(
        """
        UPDATE movimentacao_cnj
           SET tenant_id = caso.tenant_id
          FROM caso
         WHERE movimentacao_cnj.caso_id = caso.id
           AND movimentacao_cnj.tenant_id IS NULL
        """
        if bind.dialect.name == "postgresql"
        else """
        UPDATE movimentacao_cnj
           SET tenant_id = (SELECT caso.tenant_id FROM caso WHERE caso.id = movimentacao_cnj.caso_id)
         WHERE tenant_id IS NULL
        """
    )

    # Defensivo: zero linhas com tenant_id NULL antes do NOT NULL
    orfas = bind.execute(
        sa.text("SELECT COUNT(*) FROM movimentacao_cnj WHERE tenant_id IS NULL")
    ).scalar()
    if orfas:
        raise RuntimeError(
            f"Backfill incompleto: {orfas} movimentacoes sem tenant_id. "
            "Investigar caso_id orfaos antes de prosseguir."
        )

    # NOT NULL + FK + indice composto
    with op.batch_alter_table("movimentacao_cnj") as batch:
        batch.alter_column("tenant_id", nullable=False)

    # FK + indice composto so se ainda nao existem
    fks = {fk["name"] for fk in inspector.get_foreign_keys("movimentacao_cnj")}
    if "fk_movimentacao_cnj_tenant_id" not in fks:
        with op.batch_alter_table("movimentacao_cnj") as batch:
            batch.create_foreign_key(
                "fk_movimentacao_cnj_tenant_id", "tenant", ["tenant_id"], ["id"]
            )

    indexes = {ix["name"] for ix in inspector.get_indexes("movimentacao_cnj")}
    if "ix_movimentacao_cnj_tenant_data_registro" not in indexes:
        op.create_index(
            "ix_movimentacao_cnj_tenant_data_registro",
            "movimentacao_cnj",
            ["tenant_id", "data_registro_sistema"],
        )

    # Indice antigo (caso_id, data_registro_sistema) era util para listagens
    # por tenant via JOIN; agora o (tenant_id, data_registro_sistema) cobre
    # diretamente. Remover so se existir.
    if "ix_movimentacao_cnj_tenant_created" in indexes:
        op.drop_index("ix_movimentacao_cnj_tenant_created", table_name="movimentacao_cnj")


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {ix["name"] for ix in inspector.get_indexes("movimentacao_cnj")}

    if "ix_movimentacao_cnj_tenant_data_registro" in indexes:
        op.drop_index(
            "ix_movimentacao_cnj_tenant_data_registro", table_name="movimentacao_cnj"
        )

    # Recria indice composto antigo
    if "ix_movimentacao_cnj_tenant_created" not in indexes:
        op.create_index(
            "ix_movimentacao_cnj_tenant_created",
            "movimentacao_cnj",
            ["caso_id", "data_registro_sistema"],
        )

    fks = {fk["name"] for fk in inspector.get_foreign_keys("movimentacao_cnj")}
    if "fk_movimentacao_cnj_tenant_id" in fks:
        with op.batch_alter_table("movimentacao_cnj") as batch:
            batch.drop_constraint("fk_movimentacao_cnj_tenant_id", type_="foreignkey")

    cols = {c["name"] for c in inspector.get_columns("movimentacao_cnj")}
    if "tenant_id" in cols:
        op.drop_column("movimentacao_cnj", "tenant_id")
