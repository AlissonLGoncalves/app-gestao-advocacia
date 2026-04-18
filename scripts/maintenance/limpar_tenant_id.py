#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de migração para atribuir tenant_id a registros órfãos.
Executa: python limpar_tenant_id.py
"""
import os
import sys
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

# Adiciona o diretório ao path para importar módulos do projeto
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'gestao_advocacia'))

from app import create_app, db, Cliente, Caso, EventoAgenda, Documento, Despesa, Recebimento, ContratoHonorario, TarefaPrazo, User

def limpar_tenant_ids():
    """Atribui tenant_id aos registros órfãos baseado no user_id"""
    app = create_app()
    with app.app_context():
        models_com_tenant = [
            Cliente, Caso, EventoAgenda, Documento, Despesa, Recebimento, ContratoHonorario, TarefaPrazo
        ]
        
        total_atualizados = 0
        
        for model in models_com_tenant:
            table_name = model.__tablename__
            print(f"\n🔍 Verificando {table_name}...")
            
            # Encontra registros com tenant_id = NULL
            orphaned = model.query.filter_by(tenant_id=None).all()
            
            if not orphaned:
                print(f"  ✅ Nenhum registro órfão encontrado")
                continue
            
            print(f"  ⚠️  Encontrados {len(orphaned)} registros órfãos")
            
            atualizados_nesta_tabela = 0
            for item in orphaned:
                # Se o item tem user_id, usa o tenant_id do usuário
                if hasattr(item, 'user_id') and item.user_id:
                    user = User.query.get(item.user_id)
                    if user and user.tenant_id:
                        item.tenant_id = user.tenant_id
                        atualizados_nesta_tabela += 1
                        print(f"  ✅ {table_name} ID {item.id} → tenant_id {user.tenant_id}")
                    else:
                        print(f"  ❌ {table_name} ID {item.id} → usuário não tem tenant_id")
                else:
                    print(f"  ❌ {table_name} ID {item.id} → sem user_id válido")
            
            if atualizados_nesta_tabela > 0:
                db.session.commit()
                print(f"  📊 {atualizados_nesta_tabela} atualizados em {table_name}")
                total_atualizados += atualizados_nesta_tabela
        
        print(f"\n✨ Total de registros limpos: {total_atualizados}")
        print("✅ Limpeza concluída com sucesso!")

if __name__ == '__main__':
    limpar_tenant_ids()
