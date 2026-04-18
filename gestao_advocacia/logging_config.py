import logging
from datetime import datetime, timezone

from flask import g, has_request_context, request
from flask_jwt_extended import get_jwt_identity
from pythonjsonlogger import jsonlogger


class RequestContextFilter(logging.Filter):
    def filter(self, record):
        record.request_id = getattr(record, "request_id", "-")
        record.user_id = getattr(record, "user_id", None)
        record.tenant_id = getattr(record, "tenant_id", None)

        if has_request_context():
            if record.request_id in (None, "-"):
                record.request_id = getattr(g, "request_id", "-")
            if record.user_id is None:
                record.user_id = getattr(g, "user_id", None)
            if record.tenant_id is None:
                record.tenant_id = getattr(g, "tenant_id", None)
            record.path = request.path
            record.method = request.method

            if record.user_id is None:
                try:
                    record.user_id = get_jwt_identity()
                except Exception:
                    pass

        return True


class PatronusJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)

        if not log_record.get("timestamp"):
            log_record["timestamp"] = datetime.now(timezone.utc).isoformat()
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record["message"] = record.getMessage()

        log_record.setdefault("request_id", getattr(record, "request_id", "-"))
        log_record.setdefault("user_id", getattr(record, "user_id", None))
        log_record.setdefault("tenant_id", getattr(record, "tenant_id", None))


LOG_FORMAT = (
    "%(timestamp)s %(level)s %(logger)s %(message)s "
    "%(request_id)s %(user_id)s %(tenant_id)s %(path)s %(method)s %(event)s"
)


def configure_json_logging(app):
    level_name = str(app.config.get("LOG_LEVEL", "INFO")).upper()
    level = getattr(logging, level_name, logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    has_json_handler = any(getattr(handler, "_patronus_json", False) for handler in root_logger.handlers)
    if not has_json_handler:
        stream_handler = logging.StreamHandler()
        stream_handler.setLevel(level)
        stream_handler.setFormatter(PatronusJsonFormatter(LOG_FORMAT))
        stream_handler.addFilter(RequestContextFilter())
        stream_handler._patronus_json = True
        root_logger.addHandler(stream_handler)

    app.logger.propagate = True
    app.logger.setLevel(level)
