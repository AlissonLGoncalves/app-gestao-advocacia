from flask_apscheduler import APScheduler
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy


class NullMail:
    """Placeholder para manter ponto único de extensões sem alterar comportamento atual."""

    def init_app(self, app):
        return None


db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
scheduler = APScheduler()
mail = NullMail()
limiter = Limiter(key_func=get_remote_address, default_limits=[], storage_uri="memory://")
