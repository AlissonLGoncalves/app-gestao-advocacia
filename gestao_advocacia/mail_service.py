import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def enviar_alerta_email(app, para_email, assunto, corpo_html):
    """
    Envia um email de alerta com o corpo fornecido em HTML.
    Utiliza credenciais do .env (SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD).
    Se as credenciais não existirem, simula o envio no Logger.
    """
    smtp_server = os.environ.get("SMTP_SERVER")
    smtp_port = os.environ.get("SMTP_PORT", 587)
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")

    if not all([smtp_server, smtp_user, smtp_password]):
        app.logger.info(
            f"[SIMULAÇÃO e-mail] Para: {para_email} | Assunto: {assunto} | Corpo: {corpo_html[:100]}..."
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = assunto
        msg["From"] = smtp_user
        msg["To"] = para_email

        parte_html = MIMEText(corpo_html, "html")
        msg.attach(parte_html)

        server = smtplib.SMTP(smtp_server, int(smtp_port))
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, para_email, msg.as_string())
        server.quit()

        app.logger.info(f"E-mail eviado para {para_email} com sucesso via SMTP.")
        return True
    except Exception as e:
        app.logger.error(f"Falha ao enviar e-mail via SMTP para {para_email}: {str(e)}")
        return False
