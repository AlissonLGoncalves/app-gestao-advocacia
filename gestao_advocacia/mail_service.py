import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

logger = logging.getLogger(__name__)


def _credenciais_smtp():
    return {
        "server": os.environ.get("SMTP_SERVER"),
        "port": int(os.environ.get("SMTP_PORT", 587)),
        "user": os.environ.get("SMTP_USER"),
        "password": os.environ.get("SMTP_PASSWORD"),
        "from_email": os.environ.get("SMTP_FROM_EMAIL") or os.environ.get("SMTP_USER"),
        "from_name": os.environ.get("SMTP_FROM_NAME", "Patronus"),
        "use_ssl": os.environ.get("SMTP_USE_SSL", "false").lower() in ("true", "1", "yes"),
    }


def enviar_email(app, para_email, assunto, corpo_html, corpo_texto=None, headers=None):
    """Envia email multipart (text + html) com From amigável.

    Em ausência de credenciais SMTP, simula no logger (modo dev).
    Retorna True/False conforme sucesso.
    """
    cfg = _credenciais_smtp()

    if not all([cfg["server"], cfg["user"], cfg["password"]]):
        app.logger.info(
            f"[SIMULACAO email] Para: {para_email} | Assunto: {assunto} | "
            f"HTML: {corpo_html[:120]}..."
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = assunto
        msg["From"] = formataddr((cfg["from_name"], cfg["from_email"]))
        msg["To"] = para_email
        if headers:
            for k, v in headers.items():
                msg[k] = v

        if corpo_texto:
            msg.attach(MIMEText(corpo_texto, "plain", "utf-8"))
        msg.attach(MIMEText(corpo_html, "html", "utf-8"))

        if cfg["use_ssl"]:
            server = smtplib.SMTP_SSL(cfg["server"], cfg["port"])
        else:
            server = smtplib.SMTP(cfg["server"], cfg["port"])
            server.starttls()
        server.login(cfg["user"], cfg["password"])
        server.sendmail(cfg["from_email"], para_email, msg.as_string())
        server.quit()

        app.logger.info(f"Email enviado para {para_email} via SMTP.")
        return True
    except Exception as e:
        app.logger.error(f"Falha ao enviar email via SMTP para {para_email}: {str(e)}")
        return False


def enviar_alerta_email(app, para_email, assunto, corpo_html):
    """Wrapper retrocompatível usado por convites/alertas legados."""
    return enviar_email(app, para_email, assunto, corpo_html)
