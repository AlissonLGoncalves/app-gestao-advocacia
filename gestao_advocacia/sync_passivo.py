import os
import sqlite3

db_path = os.path.join(os.path.dirname(__file__), "app.db")
if not os.path.exists(db_path):
    print("Banco de dados não encontrado em:", db_path)
else:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id FROM tenant ORDER BY id ASC LIMIT 1;")
    tenant = cur.fetchone()

    if not tenant:
        print("Criando tenant MESTRE 1 para os órfãos...")
        cur.execute(
            "INSERT INTO tenant (id, nome, cnpj, email_admin) VALUES (1, 'Escritório Fundamental', '00000', 'admin@admin.com')"
        )
        conn.commit()
        tenant_id = 1
    else:
        tenant_id = tenant[0]

    print(f"Sincronizando banco usando Tenant ID: {tenant_id}")

    tables = [
        "user",
        "cliente",
        "caso",
        "despesa",
        "recebimento",
        "documento",
        "evento_agenda",
        "contrato_honorario",
    ]
    for table in tables:
        try:
            cur.execute(f"UPDATE {table} SET tenant_id = ? WHERE tenant_id IS NULL", (tenant_id,))
            print(f"Tabela {table}: {cur.rowcount} registros passivos atualizados.")
        except sqlite3.OperationalError as e:
            print(f"Erro na tabela {table} (pode ser que tenant_id ainda nao exista lá): {e}")

    conn.commit()
    print("Sincronização passiva de banco concluída e resolvida! Adeus Erro 403!")
    conn.close()
