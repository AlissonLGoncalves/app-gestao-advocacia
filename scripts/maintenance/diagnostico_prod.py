#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Diagnostico rapido para verificar isolamento por `tenant_id` na tabela `cliente`.
Uso:
  - Defina a variavel de ambiente `DATABASE_URL` (ou passe --db)
  - Execute: `python scripts/maintenance/diagnostico_prod.py --cpf 62985302668`

Suporta Postgres (recomenda-se usar o URL do Render). O script apenas le dados (somente SELECT).
"""
import os
import argparse
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


def main():
    parser = argparse.ArgumentParser(description="Diagnostico de isolamento de tenants (tabela cliente)")
    parser.add_argument(
        "--db",
        help="Database URL (ex: postgres://user:pass@host:5432/dbname)",
        default=os.environ.get("DATABASE_URL"),
    )
    parser.add_argument("--cpf", help="CPF/CNPJ para buscar (pode ser so digitos)", default=None)
    args = parser.parse_args()
    db_url = args.db
    if not db_url:
        print("ERRO: Forneca DATABASE_URL via --db ou variavel de ambiente DATABASE_URL")
        return

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(db_url, pool_pre_ping=True)

    try:
        with engine.connect() as conn:
            print("Conectado ao banco:", conn.engine.url.host or conn.engine.url)

            print("\n1) Contagem de clientes por tenant_id:")
            q1 = text("SELECT tenant_id, COUNT(*) AS qt FROM cliente GROUP BY tenant_id ORDER BY tenant_id;")
            res1 = conn.execute(q1).mappings().all()
            if res1:
                for row in res1:
                    print(f" tenant_id={row['tenant_id']} -> {row['qt']} clientes")
            else:
                print(" Nenhum cliente encontrado na tabela cliente")

            print("\nUSUARIOS (id, username, email, tenant_id):")
            q_users = text('SELECT id, username, email, tenant_id FROM "user" ORDER BY id;')
            res_users = conn.execute(q_users).mappings().all()
            for u in res_users:
                print(f" id={u['id']} | {u['username']} | {u['email']} | tenant_id={u['tenant_id']}")

            print("\n2) Registros com tenant_id IS NULL (ORFAOS):")
            q2 = text(
                "SELECT id, nome_razao_social, cpf_cnpj, tenant_id, user_id FROM cliente "
                "WHERE tenant_id IS NULL LIMIT 200;"
            )
            res2 = conn.execute(q2).mappings().all()
            if res2:
                for r in res2:
                    print(
                        f" id={r['id']} | {r['nome_razao_social']} | cpf={r['cpf_cnpj']} | "
                        f"user_id={r['user_id']}"
                    )
            else:
                print(" Nenhum registro com tenant_id NULL")

            if args.cpf:
                cpf = args.cpf
                print(f"\n3) Buscando CPF/CNPJ contendo: {cpf}")
                q3 = text(
                    "SELECT id, nome_razao_social, cpf_cnpj, tenant_id, user_id FROM cliente "
                    "WHERE cpf_cnpj LIKE :cpf LIMIT 50;"
                )
                res3 = conn.execute(q3, {"cpf": f"%{cpf}%"}).mappings().all()
                if res3:
                    for r in res3:
                        print(
                            f" id={r['id']} | {r['nome_razao_social']} | cpf={r['cpf_cnpj']} | "
                            f"tenant={r['tenant_id']} | user={r['user_id']}"
                        )
                else:
                    print(" Nenhum resultado para esse CPF/CNPJ")

            print("\n4) Tenants cadastrados (id, nome_escritorio, documento):")
            q4 = text("SELECT id, nome_escritorio, documento FROM tenant ORDER BY id LIMIT 200;")
            res4 = conn.execute(q4).mappings().all()
            if res4:
                for t in res4:
                    print(f" id={t['id']} | {t['nome_escritorio']} | doc={t['documento']}")
            else:
                print(" Nenhum tenant encontrado")

    except SQLAlchemyError as e:
        print("Erro de conexao/consulta:", e)


if __name__ == "__main__":
    main()
