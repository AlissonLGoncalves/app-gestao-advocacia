from datetime import datetime

from extensions import db
from mail_service import enviar_alerta_email
from models import EventoAgenda, User


def job_verificar_prazos(app):
    """
    Função executada pelo APScheduler para analisar os Alertas e Disparar Emails.
    """
    with app.app_context():
        hoje = datetime.utcnow().date()

        # Filtramos eventos Pendentes que sejam Prazos ou Audiências.
        tipos_alvo = ["Prazo", "Audiência"]
        eventos = EventoAgenda.query.filter(
            EventoAgenda.status_evento == "Pendente", EventoAgenda.tipo_evento.in_(tipos_alvo)
        ).all()

        for ev in eventos:
            diff_dias = (ev.data_inicio.date() - hoje).days

            # Identificar qual marcador checar dependendo do dia
            marcador_tag = None
            if diff_dias == 7:
                marcador_tag = "7d"
            elif diff_dias == 3:
                marcador_tag = "3d"

            if marcador_tag:
                notificacoes = ev.notificacoes_enviadas or {}
                if not notificacoes.get(marcador_tag, False):
                    # O Alerta deste limite ainda NÃO foi enviado. Disparar!
                    user = User.query.get(ev.user_id)
                    if user and user.email:
                        assunto = f"[Patronus] Alerta de {ev.tipo_evento}: {ev.titulo} em {diff_dias} dias!"
                        corpo = f"""
                        <h2>Aviso de {ev.tipo_evento}</h2>
                        <p>Olá, <b>{user.username}</b>,</p>
                        <p>O evento <strong style="color: red;">{ev.titulo}</strong> (Prioridade: {ev.prioridade}) está agendado para o dia {ev.data_inicio.strftime('%d/%m/%Y às %H:%M')}.</p>
                        <p>Faltam exatamente <b>{diff_dias} dias</b>.</p>
                        <p>Descrição/Notas: {ev.descricao or 'Nenhuma anotação.'}</p>
                        <br>
                        <p><i>Patronus - O seu Sistema de Gestão Jurídica</i></p>
                        """

                        enviado = enviar_alerta_email(app, user.email, assunto, corpo)
                        if enviado:
                            notificacoes[marcador_tag] = True

                            # Atualiza a coluna no banco
                            # Para forçar o SQLAlchemy salvar colunas JSON, reatribuímos
                            import copy

                            evento_atualizado = copy.deepcopy(notificacoes)
                            ev.notificacoes_enviadas = evento_atualizado
                            try:
                                db.session.commit()
                            except Exception as e:
                                app.logger.error(f"Erro salvando confirmação do email: {str(e)}")
