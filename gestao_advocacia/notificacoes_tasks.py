"""Job que detecta vencimentos proximos/atrasados de Recebimentos e Despesas
e cria notificacoes in-app pros usuarios.

Roda diariamente as 7:00 da manha (registrado no app_runtime.py quando
FLY_PROCESS_GROUP == 'scheduler').

Regras (avaliadas pra cada user_id ativo do tenant):
  - Recebimento vencendo em 3 dias  -> tipo=recebimento_vencendo, sev=warning
  - Recebimento vencendo hoje       -> tipo=recebimento_vencendo, sev=warning
  - Recebimento atrasado (1-30 dias)-> tipo=recebimento_atrasado, sev=danger
  - Despesa vencendo em 3 dias      -> tipo=despesa_vencendo,     sev=warning
  - Despesa vencendo hoje           -> tipo=despesa_vencendo,     sev=warning
  - Despesa atrasada (1-30 dias)    -> tipo=despesa_atrasada,     sev=danger

`dedupe_key` evita re-criar quando o cron roda novamente no dia seguinte
e o item ainda esta pendente. Formato:
  "<tipo>:<item_id>:<data_referencia>"
"""

from datetime import date, datetime, timedelta

from sqlalchemy.exc import IntegrityError

from extensions import db
from models import Despesa, Notificacao, Recebimento, User

# App atual injetado pelo job_verificar_vencimentos pra logar/enviar email.
# Modulo-level pra nao precisar passar app por toda cadeia de helpers.
_current_app = None


def _enviar_email_se_optin(notif):
    """Dispara e-mail do aviso de vencimento se o usuario tiver opt-in ativo.

    Best-effort: falha de e-mail nunca derruba a criacao da notificacao
    (que ja foi commitada). Usa o mail_service existente (modo simulacao
    quando SMTP nao configurado).
    """
    if _current_app is None:
        return
    try:
        user = User.query.get(notif.user_id)
        if not user or not user.email:
            return
        # Default True quando a coluna ainda esta NULL (registros pre-migration).
        optin = user.notif_email_vencimentos
        if optin is False:
            return

        from mail_service import enviar_email

        cor = {
            "danger": "#dc3545",
            "warning": "#fd7e14",
            "info": "#0dcaf0",
        }.get(notif.severidade, "#0d6efd")
        corpo_html = (
            f'<div style="font-family:Arial,sans-serif;max-width:520px">'
            f'<h2 style="color:{cor};margin:0 0 8px">{notif.titulo}</h2>'
            f'<p style="font-size:15px;color:#333">{notif.mensagem or ""}</p>'
            f'<p style="font-size:13px;color:#888;margin-top:16px">'
            f"Voce recebe este aviso porque tem notificacoes de vencimento por "
            f"e-mail ativas. Para desativar, acesse seu Perfil no Patronus.</p>"
            f"</div>"
        )
        corpo_texto = f"{notif.titulo}\n\n{notif.mensagem or ''}"
        enviar_email(
            _current_app, user.email, f"[Patronus] {notif.titulo}", corpo_html, corpo_texto
        )
    except Exception as e:
        # Best-effort — nao propaga
        if _current_app is not None:
            _current_app.logger.warning(f"Falha ao enviar email de vencimento: {e}")


def _criar_notificacao(user_id, tenant_id, dedupe_key, **kwargs):
    """Cria uma Notificacao com unique constraint em (user_id, dedupe_key).

    Retorna True se criou (e dispara e-mail opt-in), False se ja existia
    (IntegrityError tolerado — e nao reenvia e-mail).
    """
    notif = Notificacao(
        user_id=user_id,
        tenant_id=tenant_id,
        dedupe_key=dedupe_key,
        data_criacao=datetime.utcnow(),
        **kwargs,
    )
    db.session.add(notif)
    try:
        db.session.commit()
    except IntegrityError:
        # ja existe (provavelmente cron rodou de novo) — OK, segue
        db.session.rollback()
        return False
    # So envia e-mail pra notificacao recem-criada (idempotencia: nao
    # reenvia em re-execucoes do cron, porque ai cai no IntegrityError acima).
    _enviar_email_se_optin(notif)
    return True


def _processar_recebimentos(hoje, criados_log):
    """Recebimentos pendentes vencendo em 3 dias / hoje / atrasados (1-30 dias)."""
    em_3_dias = hoje + timedelta(days=3)
    atrasados_min = hoje - timedelta(days=30)

    recebimentos = Recebimento.query.filter(
        ~Recebimento.status.in_(["Pago", "Cancelado"]),
        Recebimento.data_vencimento.isnot(None),
        Recebimento.data_vencimento >= atrasados_min,
        Recebimento.data_vencimento <= em_3_dias,
    ).all()

    for r in recebimentos:
        venc = r.data_vencimento
        if venc > hoje:
            dias = (venc - hoje).days
            tipo = "recebimento_vencendo"
            severidade = "warning"
            titulo = f"Recebimento vence em {dias} dia(s)"
            mensagem = (
                f'"{r.descricao}" — R$ {float(r.valor):.2f} — vence em '
                f"{venc.strftime('%d/%m/%Y')}."
            )
        elif venc == hoje:
            tipo = "recebimento_vencendo"
            severidade = "warning"
            titulo = "Recebimento vence hoje"
            mensagem = f'"{r.descricao}" — R$ {float(r.valor):.2f} — vence HOJE.'
        else:
            dias_atrasado = (hoje - venc).days
            tipo = "recebimento_atrasado"
            severidade = "danger"
            titulo = f"Recebimento atrasado ({dias_atrasado} dia(s))"
            mensagem = (
                f'"{r.descricao}" — R$ {float(r.valor):.2f} — venceu em '
                f"{venc.strftime('%d/%m/%Y')}."
            )

        dedupe = f"{tipo}:{r.id}:{venc.isoformat()}"
        if _criar_notificacao(
            user_id=r.user_id,
            tenant_id=r.tenant_id,
            dedupe_key=dedupe,
            tipo=tipo,
            severidade=severidade,
            titulo=titulo,
            mensagem=mensagem,
            link=f"/recebimentos/editar/{r.id}",
        ):
            criados_log.append(f"{tipo} (rec_id={r.id}, user={r.user_id})")


def _processar_despesas(hoje, criados_log):
    """Despesas pendentes vencendo em 3 dias / hoje / atrasadas (1-30 dias)."""
    em_3_dias = hoje + timedelta(days=3)
    atrasadas_min = hoje - timedelta(days=30)

    despesas = Despesa.query.filter(
        ~Despesa.status.in_(["Pago", "Cancelado"]),
        Despesa.data_vencimento.isnot(None),
        Despesa.data_vencimento >= atrasadas_min,
        Despesa.data_vencimento <= em_3_dias,
    ).all()

    for d in despesas:
        venc = d.data_vencimento
        if venc > hoje:
            dias = (venc - hoje).days
            tipo = "despesa_vencendo"
            severidade = "warning"
            titulo = f"Despesa vence em {dias} dia(s)"
            mensagem = (
                f'"{d.descricao}" — R$ {float(d.valor):.2f} — vence em '
                f"{venc.strftime('%d/%m/%Y')}."
            )
        elif venc == hoje:
            tipo = "despesa_vencendo"
            severidade = "warning"
            titulo = "Despesa vence hoje"
            mensagem = f'"{d.descricao}" — R$ {float(d.valor):.2f} — vence HOJE.'
        else:
            dias_atrasada = (hoje - venc).days
            tipo = "despesa_atrasada"
            severidade = "danger"
            titulo = f"Despesa atrasada ({dias_atrasada} dia(s))"
            mensagem = (
                f'"{d.descricao}" — R$ {float(d.valor):.2f} — venceu em '
                f"{venc.strftime('%d/%m/%Y')}."
            )

        dedupe = f"{tipo}:{d.id}:{venc.isoformat()}"
        if _criar_notificacao(
            user_id=d.user_id,
            tenant_id=d.tenant_id,
            dedupe_key=dedupe,
            tipo=tipo,
            severidade=severidade,
            titulo=titulo,
            mensagem=mensagem,
            link=f"/despesas/editar/{d.id}",
        ):
            criados_log.append(f"{tipo} (desp_id={d.id}, user={d.user_id})")


def job_verificar_vencimentos(app):
    """Entrypoint do APScheduler — rodar dentro de app_context."""
    global _current_app
    with app.app_context():
        _current_app = app
        try:
            hoje = date.today()
            criados = []
            _processar_recebimentos(hoje, criados)
            _processar_despesas(hoje, criados)
            app.logger.info(f"job_verificar_vencimentos OK: {len(criados)} notificacoes criadas")
        except Exception as e:
            app.logger.exception(f"job_verificar_vencimentos falhou: {e}")
            db.session.rollback()
        finally:
            _current_app = None
