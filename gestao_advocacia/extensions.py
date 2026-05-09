from flask_apscheduler import APScheduler
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
scheduler = APScheduler()
limiter = Limiter(key_func=get_remote_address, default_limits=[], storage_uri="memory://")
