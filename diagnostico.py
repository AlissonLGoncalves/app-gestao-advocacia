#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'gestao_advocacia'))

from gestao_advocacia.app import create_app, db, Cliente, User

app = create_app()
with app.app_context():
    print('\n=== DIAGNÓSTICO DETALHADO ===\n')
    
    # Usuários
    usuarios = User.query.all()
    print('Usuários cadastrados:')
    for u in usuarios:
        print(f'  ID {u.id}: {u.username} | tenant_id={u.tenant_id}')
    
    # Clientes SEM tenant_id
    print('\nClientes SEM tenant_id (ÓRFÃOS):')
    orfaos = Cliente.query.filter_by(tenant_id=None).all()
    if orfaos:
        for c in orfaos:
            user = User.query.get(c.user_id)
            username = user.username if user else '?'
            print(f'  ID {c.id}: {c.nome_razao_social} | CPF: {c.cpf_cnpj} | user_id={c.user_id} ({username})')
    else:
        print('  Nenhum')
    
    # Clientes COM tenant_id
    print('\nClientes COM tenant_id:')
    com_tenant = Cliente.query.filter(Cliente.tenant_id != None).all()
    for c in com_tenant:
        user = User.query.get(c.user_id)
        username = user.username if user else '?'
        print(f'  ID {c.id}: {c.nome_razao_social} | tenant={c.tenant_id} | user={username}')
