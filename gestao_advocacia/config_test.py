# config_test.py
import os

basedir = os.path.abspath(os.path.dirname(__file__))


class ConfigTest:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL") or "sqlite:///" + os.path.join(
        basedir, "app_test.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get("SECRET_KEY", "test-only-secret-key")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "test-only-jwt-secret-key")

    UPLOAD_FOLDER = os.path.join(basedir, "uploads_test")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

    # Desabilitar o job CNJ nos testes
    CNJ_JOB_ENABLED = False
    # Desabilitar o job DJEN nos testes
    DJEN_JOB_ENABLED = False
    # Desabilitar rate limiting nos testes (para não atrapalhar outros testes)
    RATELIMIT_ENABLED = False
