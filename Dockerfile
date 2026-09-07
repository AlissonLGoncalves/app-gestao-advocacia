# ==============================================================================
# Dockerfile — Backend Gestão Advocacia
# Construído para deploy no Fly.io, região gru (São Paulo).
# ==============================================================================
FROM python:3.11-slim

# Tesseract OCR (usado pelo ocr_service.py)
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-por \
    libmagic1 \
        libpq-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências Python
COPY gestao_advocacia/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY gestao_advocacia/ ./

# Pasta de uploads (volume persistente montado em /data no Fly.io)
RUN mkdir -p /data/uploads

ENV FLASK_APP=app.py
ENV UPLOAD_FOLDER=/data/uploads

EXPOSE 8080

# Cloud Run: a API sobe direto no gunicorn (mesmo comando do antigo processo
# `app` do Fly). Migrations NAO rodam no boot — rodam no Cloud Run Job
# `patronus-migrate` (jobs_cli.py migrate) antes do deploy. start.sh continua
# existindo para uso local/Render.
CMD ["sh", "-c", "exec gunicorn -b 0.0.0.0:${PORT:-8080} --workers 2 --timeout 600 --access-logfile - --error-logfile - app:app"]
