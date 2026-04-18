#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import sys
from dotenv import load_dotenv

load_dotenv()
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, PROJECT_ROOT)

from gestao_advocacia.app import create_app, db, Cliente, User

def main():
    app = create_app()
    with app.app_context():
        print('\n=== DIAGNOSTICO DETALHADO ===\n')

        usuarios = User.query.all()
        print('Usuarios cadastrados:')
        for u in usuarios:
            print(f'  ID {u.id}: {u.username} | tenant_id={u.tenant_id}')

        print('\nClientes sem tenant_id (orfaos):')
        orfaos = Cliente.query.filter_by(tenant_id=None).all()
        if orfaos:
            for c in orfaos:
                user = User.query.get(c.user_id)
                username = user.username if user else '?'
                print(f'  ID {c.id}: {c.nome_razao_social} | CPF: {c.cpf_cnpj} | user_id={c.user_id} ({username})')
        else:
            print('  Nenhum')

        print('\nClientes com tenant_id:')
        com_tenant = Cliente.query.filter(Cliente.tenant_id != None).all()
        for c in com_tenant:
            user = User.query.get(c.user_id)
            username = user.username if user else '?'
            print(f'  ID {c.id}: {c.nome_razao_social} | tenant={c.tenant_id} | user={username}')


if __name__ == '__main__':
    main()
