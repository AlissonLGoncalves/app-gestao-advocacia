#!/bin/bash
set -e
echo '==> Rodando migrações do banco de dados...'
flask db upgrade
echo "==> Iniciando servidor na porta: ${PORT:-8080}"
exec gunicorn "app:create_app()" --bind "0.0.0.0:${PORT:-8080}" --workers "${WEB_CONCURRENCY:-1}" --timeout 600 --access-logfile - --error-logfile -
