#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Atribui tenant_id para registros orfaos com base no user_id.

Comportamento padrao: dry-run (nao persiste alteracoes).
Para aplicar de fato, use --execute.
"""
import os
import sys
import argparse
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

# Adiciona o diretorio correto para importar modulos do projeto
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'gestao_advocacia'))

from app import create_app, db, Cliente, Caso, EventoAgenda, Documento, Despesa, Recebimento, ContratoHonorario, TarefaPrazo, User

def limpar_tenant_ids(execute=False):
    """Atribui tenant_id aos registros orfaos baseado no user_id."""
    app = create_app()
    with app.app_context():
        models_com_tenant = [
            Cliente, Caso, EventoAgenda, Documento, Despesa, Recebimento, ContratoHonorario, TarefaPrazo
        ]
        
        total_atualizados = 0
        
        for model in models_com_tenant:
            table_name = model.__tablename__
            print(f"\nVerificando {table_name}...")
            
            # Encontra registros com tenant_id = NULL
            orphaned = model.query.filter_by(tenant_id=None).all()
            
            if not orphaned:
                print("  Nenhum registro orfao encontrado")
                continue
            
            print(f"  Encontrados {len(orphaned)} registros orfaos")
            
            atualizados_nesta_tabela = 0
            for item in orphaned:
                # Se o item tem user_id, usa o tenant_id do usuário
                if hasattr(item, 'user_id') and item.user_id:
                    user = User.query.get(item.user_id)
                    if user and user.tenant_id:
                        if execute:
                            item.tenant_id = user.tenant_id
                        atualizados_nesta_tabela += 1
                        acao = 'atualizado' if execute else 'seria atualizado'
                        print(f"  {table_name} ID {item.id} {acao} para tenant_id {user.tenant_id}")
                    else:
                        print(f"  {table_name} ID {item.id} sem tenant_id no usuario")
                else:
                    print(f"  {table_name} ID {item.id} sem user_id valido")
            
            if atualizados_nesta_tabela > 0:
                if execute:
                    db.session.commit()
                print(f"  {atualizados_nesta_tabela} {'atualizados' if execute else 'planejados'} em {table_name}")
                total_atualizados += atualizados_nesta_tabela
        
        modo = 'EXECUTE' if execute else 'DRY-RUN'
        print(f"\n[{modo}] Total de registros processados: {total_atualizados}")
        if not execute:
            print('[DRY-RUN] Nenhuma alteracao foi persistida. Use --execute para aplicar.')


def parse_args():
    parser = argparse.ArgumentParser(description='Atribui tenant_id para registros orfaos.')
    parser.add_argument('--execute', action='store_true', help='Aplica alteracoes no banco. Sem essa flag, roda em dry-run.')
    return parser.parse_args()

if __name__ == '__main__':
    args = parse_args()
    limpar_tenant_ids(execute=args.execute)
