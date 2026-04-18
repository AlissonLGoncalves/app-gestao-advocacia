#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Corrige tenants para um usuário específico no banco de produção.
- Faz backup das linhas afetadas (CSV) em `backups/<timestamp>/`
- Cria um tenant novo (se necessário)
- Atualiza `user.tenant_id` e preenche `tenant_id` nas tabelas que tinham NULL para registros do `user_id`

Uso:
  python corrigir_tenants_prod.py --db "<DATABASE_URL>" --user-id 2 --tenant-name "Alisson - Patronus" --yes

IMPORTANTE: Este script aplica alterações no banco de produção. Use com cuidado.
"""
import os
import argparse
import csv
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

TABLES = [
    'cliente', 'caso', 'evento_agenda', 'documento',
    'contrato_honorario', 'despesa', 'recebimento', 'tarefa_prazo'
]


def backup_rows(conn, query_text, params, out_file):
    rows = conn.execute(text(query_text), params).mappings().all()
    if not rows:
        return 0
    keys = list(rows[0].keys())
    with open(out_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for r in rows:
            # convert values to plain strings for CSV
            row = {k: (str(v) if v is not None else '') for k, v in r.items()}
            writer.writerow(row)
    return len(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', required=True, help='Database URL')
    parser.add_argument('--user-id', type=int, default=2, help='ID do usuário a corrigir')
    parser.add_argument('--tenant-name', default=None, help='Nome do tenant a criar')
    parser.add_argument('--yes', action='store_true', help='Confirma execução sem pedir input')
    args = parser.parse_args()

    db_url = args.db
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)

    engine = create_engine(db_url, pool_pre_ping=True)

    timestamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    backup_dir = os.path.join('backups', timestamp)
    os.makedirs(backup_dir, exist_ok=True)

    try:
        # Leitura e backup em conexão separada
        with engine.connect() as conn:
            print('Conectado ao DB:', conn.engine.url.host)

            # Lista atual de usuários e tenant
            users = conn.execute(text('SELECT id, username, email, tenant_id FROM "user" ORDER BY id;')).mappings().all()
            print('\nUsuários:')
            for u in users:
                print(f" id={u['id']} | {u['username']} | {u['email']} | tenant_id={u['tenant_id']}")

            # Backup por tabela (somente leitura)
            total_backed = 0
            for t in TABLES:
                q = f"SELECT * FROM {t} WHERE user_id = :uid AND tenant_id IS NULL;"
                out_file = os.path.join(backup_dir, f"{t}_user_{args.user_id}.csv")
                n = backup_rows(conn, q, {'uid': args.user_id}, out_file)
                total_backed += n
                print(f"Backup {t}: {n} linhas -> {out_file}")

            print(f"\nTotal linhas em backup: {total_backed}")

        # Escrita/alterações em transação separada
        tenant_name = args.tenant_name or f'tenant_user_{args.user_id}_auto'
        print(f"\nAplicando alterações: criando tenant '{tenant_name}' e atualizando registros do user_id={args.user_id}")
        with engine.begin() as conn_tx:
            insert_t = text("INSERT INTO tenant (nome_escritorio, documento, created_at) VALUES (:nome, NULL, now()) RETURNING id;")
            res = conn_tx.execute(insert_t, {'nome': tenant_name})
            new_tenant = res.scalar()
            print('Novo tenant id =', new_tenant)

            # Atualizar user
            upd_user = text('UPDATE "user" SET tenant_id = :tid WHERE id = :uid RETURNING id;')
            ru = conn_tx.execute(upd_user, {'tid': new_tenant, 'uid': args.user_id})
            if ru.rowcount:
                print(f"Usuário {args.user_id} atualizado com tenant_id={new_tenant}")
            else:
                print('Aviso: usuário não atualizado (rowcount=0)')

            # Atualizar tabelas
            total_updated = 0
            for t in TABLES:
                uq = text(f'UPDATE {t} SET tenant_id = :tid WHERE user_id = :uid AND tenant_id IS NULL;')
                r = conn_tx.execute(uq, {'tid': new_tenant, 'uid': args.user_id})
                print(f"Tabela {t}: {r.rowcount} linhas atualizadas")
                total_updated += r.rowcount

            print(f"\nTotal linhas atualizadas: {total_updated}")

        print('\nAlterações aplicadas com sucesso.')
        print('Backups salvos em:', backup_dir)

    except SQLAlchemyError as e:
        print('Erro de DB:', e)

if __name__ == '__main__':
    main()
