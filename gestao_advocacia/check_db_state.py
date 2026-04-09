"""Script de diagnóstico do estado do banco de dados SQLite local."""
import sqlite3

db_path = r'c:\Users\aliss\app-gestao-advocacia\gestao_advocacia\app.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Tabelas existentes
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
tables = [t[0] for t in c.fetchall()]
print("=== TABELAS EXISTENTES ===")
for t in tables:
    print(f"  {t}")

# Versao Alembic
c.execute("SELECT version_num FROM alembic_version;")
ver = c.fetchone()
print(f"\n=== VERSAO ALEMBIC: {ver[0] if ver else 'NENHUMA'} ===")

# Verificar tenant_id em cada tabela
print("\n=== PRESENCA DE tenant_id ===")
check_tables = ['cliente', 'caso', 'user', 'recebimento', 'despesa', 'documento', 'evento_agenda', 'contrato_honorario']
for table in check_tables:
    if table in tables:
        c.execute(f"PRAGMA table_info({table});")
        cols = [col[1] for col in c.fetchall()]
        has_tenant = 'tenant_id' in cols
        print(f"  {table}: tenant_id={has_tenant}")

# Verificar se audit_log existe
print(f"\n=== audit_log existe: {'audit_log' in tables} ===")
if 'audit_log' in tables:
    c.execute("PRAGMA table_info(audit_log);")
    cols = [col[1] for col in c.fetchall()]
    print(f"  Colunas: {cols}")

# Verificar dados no tenant
if 'tenant' in tables:
    c.execute("SELECT COUNT(*) FROM tenant;")
    count = c.fetchone()[0]
    print(f"\n=== Tenants cadastrados: {count} ===")
    if count > 0:
        c.execute("SELECT id, nome_escritorio, documento FROM tenant LIMIT 5;")
        for row in c.fetchall():
            print(f"  ID={row[0]}, Nome={row[1]}, Doc={row[2]}")

# Verificar users e seus tenant_ids
if 'user' in tables:
    c.execute("PRAGMA table_info(user);")
    user_cols = [col[1] for col in c.fetchall()]
    if 'tenant_id' in user_cols:
        c.execute("SELECT id, username, tenant_id FROM user LIMIT 10;")
        print("\n=== Users e seus Tenants ===")
        for row in c.fetchall():
            print(f"  ID={row[0]}, User={row[1]}, TenantID={row[2]}")

# Tabela tmp residual
if '_alembic_tmp_caso' in tables:
    print("\n=== AVISO: Tabela temporaria _alembic_tmp_caso encontrada (residual de migracao falha) ===")

conn.close()
