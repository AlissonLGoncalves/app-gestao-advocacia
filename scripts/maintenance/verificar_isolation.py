#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from gestao_advocacia.app import create_app, db, Cliente, User, Caso

app = create_app()
with app.app_context():
    print('\n=== VERIFICAÇÃO DE ISOLAMENTO POR TENANT ===\n')
    
    # Mostra todos os usuários
    usuarios = User.query.all()
    print('Usuários:')
    for u in usuarios:
        print(f'  ID {u.id}: {u.username} (tenant_id={u.tenant_id})')
    
    print('\nClientes:')
    clientes = Cliente.query.all()
    for c in clientes:
        user = User.query.get(c.user_id)
        username = user.username if user else '?'
        print(f'  ID {c.id}: {c.nome_razao_social} | {c.cpf_cnpj} | user={username} | tenant={c.tenant_id}')
    
    print('\nCasos:')
    casos = Caso.query.all()
    for cs in casos:
        user = User.query.get(cs.user_id)
        cli = Cliente.query.get(cs.cliente_id)
        username = user.username if user else '?'
        cliente_nome = cli.nome_razao_social if cli else '?'
        print(f'  ID {cs.id}: {cs.titulo} | cliente={cliente_nome} | user={username} | tenant={cs.tenant_id}')
