#!/bin/bash
set -e
echo '==> Rodando migrações do banco de dados...'
flask db upgrade
echo '==> Iniciando servidor...'
exec gunicorn "app:create_app()"
