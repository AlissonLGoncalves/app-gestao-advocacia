"""
Script de manutenção: reseta clientes e casos de um tenant.

Apaga TODOS os clientes, casos e dados derivados de um tenant (escritório),
mantendo intactos:
  - usuários (login)
  - configurações (tokens PROJUDI, monitoramento DJEN OAB)
  - logs de auditoria, login_audit, consentimentos
  - tenant em si

Tabelas zeradas no escopo do tenant:
  movimentacao_cnj, documento, despesa, recebimento, tarefa_prazo,
  contrato_honorario, publicacao_djen, djen_vinculo_decisao,
  procuracao_analise, caso, cliente

Uso:
    # 1) Descobrir o tenant — busca user por nome/email
    python -m scripts.maintenance.reset_clientes_casos_tenant --find-user emerson

    # 2) Dry-run — mostra o que seria apagado
    python -m scripts.maintenance.reset_clientes_casos_tenant --tenant-id N

    # 3) Aplicar — exige --apply E --confirm-tenant N (dupla confirmação)
    python -m scripts.maintenance.reset_clientes_casos_tenant --tenant-id N --apply --confirm-tenant N
"""

from __future__ import annotations

import argparse
import os
import sys

_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, os.path.abspath(_BASE_DIR))


def _build_app():
    from app import create_app  # noqa: PLC0415

    return create_app()


# Ordem de deleção: filhos primeiro (FKs apontam pra caso/cliente).
# Cada item: (label, sql_count, sql_delete)
_DELETE_PLAN = [
    (
        "movimentacao_cnj",
        "SELECT COUNT(*) FROM movimentacao_cnj WHERE tenant_id = :tid",
        "DELETE FROM movimentacao_cnj WHERE tenant_id = :tid",
    ),
    (
        "documento",
        "SELECT COUNT(*) FROM documento WHERE tenant_id = :tid",
        "DELETE FROM documento WHERE tenant_id = :tid",
    ),
    (
        "despesa",
        "SELECT COUNT(*) FROM despesa WHERE tenant_id = :tid",
        "DELETE FROM despesa WHERE tenant_id = :tid",
    ),
    (
        "recebimento",
        "SELECT COUNT(*) FROM recebimento WHERE tenant_id = :tid",
        "DELETE FROM recebimento WHERE tenant_id = :tid",
    ),
    (
        "tarefa_prazo",
        "SELECT COUNT(*) FROM tarefa_prazo WHERE tenant_id = :tid",
        "DELETE FROM tarefa_prazo WHERE tenant_id = :tid",
    ),
    (
        "contrato_honorario",
        "SELECT COUNT(*) FROM contrato_honorario WHERE tenant_id = :tid",
        "DELETE FROM contrato_honorario WHERE tenant_id = :tid",
    ),
    (
        "djen_vinculo_decisao",
        "SELECT COUNT(*) FROM djen_vinculo_decisao WHERE tenant_id = :tid",
        "DELETE FROM djen_vinculo_decisao WHERE tenant_id = :tid",
    ),
    (
        "publicacao_djen",
        "SELECT COUNT(*) FROM publicacao_djen WHERE tenant_id = :tid",
        "DELETE FROM publicacao_djen WHERE tenant_id = :tid",
    ),
    (
        "procuracao_analise",
        "SELECT COUNT(*) FROM procuracao_analise WHERE tenant_id = :tid",
        "DELETE FROM procuracao_analise WHERE tenant_id = :tid",
    ),
    (
        "caso",
        "SELECT COUNT(*) FROM caso WHERE tenant_id = :tid",
        "DELETE FROM caso WHERE tenant_id = :tid",
    ),
    # user.portal_cliente_id pode apontar pra cliente — limpar antes de apagar cliente
    (
        "user.portal_cliente_id (NULL-out via tenant)",
        'SELECT COUNT(*) FROM "user" WHERE tenant_id = :tid AND portal_cliente_id IS NOT NULL',
        'UPDATE "user" SET portal_cliente_id = NULL WHERE tenant_id = :tid AND portal_cliente_id IS NOT NULL',
    ),
    (
        "cliente",
        "SELECT COUNT(*) FROM cliente WHERE tenant_id = :tid",
        "DELETE FROM cliente WHERE tenant_id = :tid",
    ),
]


def cmd_find_user(busca: str):
    from sqlalchemy import text  # noqa: PLC0415

    from helpers.admin_session import admin_session  # noqa: PLC0415

    pat = f"%{busca.lower()}%"
    with admin_session() as s:
        rows = s.execute(
            text(
                "SELECT u.id, u.email, u.nome_completo AS nome, u.username, u.role, u.tenant_id, t.nome_escritorio AS tenant_nome, t.email_contato AS tenant_email "
                'FROM "user" u LEFT JOIN tenant t ON t.id = u.tenant_id '
                "WHERE LOWER(u.email) LIKE :p OR LOWER(COALESCE(u.nome_completo, '')) LIKE :p "
                "OR LOWER(COALESCE(u.username, '')) LIKE :p "
                "ORDER BY u.id"
            ),
            {"p": pat},
        ).fetchall()

    if not rows:
        print(f"Nenhum usuário encontrado para '{busca}'.")
        return
    print(f"Encontrados {len(rows)} usuário(s):")
    print(f"{'ID':<5} {'TENANT':<7} {'TENANT_NOME':<30} {'ROLE':<12} {'EMAIL':<35} NOME")
    for r in rows:
        print(
            f"{r.id:<5} {str(r.tenant_id or '-'):<7} "
            f"{(r.tenant_nome or '-')[:28]:<30} {(r.role or '-'):<12} "
            f"{(r.email or '-')[:33]:<35} {r.nome or r.username or '-'}"
        )


def cmd_count_or_delete(tenant_id: int, apply: bool):
    from sqlalchemy import text  # noqa: PLC0415

    from helpers.admin_session import admin_session  # noqa: PLC0415

    with admin_session() as s:
        # Mostra info do tenant + usuários afetados
        tenant_row = s.execute(
            text("SELECT id, nome, email FROM tenant WHERE id = :tid"),
            {"tid": tenant_id},
        ).fetchone()
        if not tenant_row:
            print(f"ERRO: tenant_id={tenant_id} não existe.")
            sys.exit(2)
        users = s.execute(
            text(
                'SELECT id, email, nome_completo AS nome, role FROM "user" WHERE tenant_id = :tid ORDER BY id'
            ),
            {"tid": tenant_id},
        ).fetchall()

        print("=" * 70)
        print(f"TENANT: id={tenant_row.id} | nome={tenant_row.nome} | email={tenant_row.email}")
        print(f"Usuários do tenant ({len(users)}):")
        for u in users:
            print(f"  - id={u.id} role={u.role} email={u.email} nome={u.nome}")
        print("=" * 70)

        # Contagens
        print(f"{'TABELA':<40} {'LINHAS':>10}")
        print("-" * 52)
        totais = {}
        for label, sql_count, _ in _DELETE_PLAN:
            n = s.execute(text(sql_count), {"tid": tenant_id}).scalar()
            totais[label] = n
            print(f"{label:<40} {n:>10}")
        print("-" * 52)

        if not apply:
            print(
                "\n[DRY-RUN] Nenhuma linha alterada. Use --apply --confirm-tenant <ID> para executar."
            )
            return

        # Apply: executa em ordem, dentro da mesma transação (admin_session faz commit no exit)
        print("\n>>> EXECUTANDO DELEÇÃO <<<")
        for label, _, sql_delete in _DELETE_PLAN:
            res = s.execute(text(sql_delete), {"tid": tenant_id})
            print(f"  {label:<40} -> {res.rowcount} linha(s) afetada(s)")
        print("\nCommit pendente — admin_session fará commit no fim do bloco.")
    print("\n[OK] Reset concluído com sucesso.")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--find-user", metavar="BUSCA", help="busca user por email/nome/username (ILIKE)"
    )
    ap.add_argument("--tenant-id", type=int, help="tenant alvo")
    ap.add_argument("--apply", action="store_true", help="aplica de fato (default: dry-run)")
    ap.add_argument(
        "--confirm-tenant",
        type=int,
        help="repete o tenant-id como confirmação (deve bater com --tenant-id)",
    )
    args = ap.parse_args()

    app = _build_app()
    with app.app_context():
        if args.find_user:
            cmd_find_user(args.find_user)
            return
        if not args.tenant_id:
            ap.error("informe --find-user OU --tenant-id")
        if args.apply:
            if args.confirm_tenant != args.tenant_id:
                ap.error("--apply exige --confirm-tenant igual ao --tenant-id (dupla confirmação)")
        cmd_count_or_delete(args.tenant_id, apply=args.apply)


if __name__ == "__main__":
    main()
