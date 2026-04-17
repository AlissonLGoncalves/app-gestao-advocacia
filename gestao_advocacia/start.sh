#!/bin/bash
set -e
echo '==> Rodando migrações do banco de dados...'
flask db upgrade
echo '==> Iniciando servidor...'
exec gunicorn "app:create_app()" --bind "0.0.0.0:${PORT:-10000}" --workers "${WEB_CONCURRENCY:-1}"
