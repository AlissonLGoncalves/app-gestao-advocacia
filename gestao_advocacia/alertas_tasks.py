from extensions import db
from mail_service import enviar_alerta_email
from models import ItemAgenda, User
from utils.datas import hoje_brasil


def job_verificar_prazos(app):
    """
    Job APScheduler: analisa eventos da agenda e dispara alertas por
    email pra eventos a 7/3 dias do prazo.

    PR D4.4 — migrado de EventoAgenda pra ItemAgenda (tipo='evento').
    Mantem semantica original: so eventos com tipo=evento e categoria
    Prazo/Audiencia disparam alertas. Tarefas (kanban) tem fluxo proprio
    de notificacao.
    """
    with app.app_context():
        # Dia civil no Brasil — evita off-by-one quando o servidor (UTC)
        # já virou o dia mas Brasília ainda não. Ver utils/datas.py.
        hoje = hoje_brasil()

        # Filtros equivalentes ao legado:
        #   - tipo_evento -> categoria (vocab novo, sem acento)
        #   - status_evento Pendente -> status Pendente
        # ItemAgenda nao tem data_inicio obrigatoria pra tarefa, mas
        # nesse job filtramos tipo=evento (que sempre tem data_inicio).
        categorias_alvo = ["Prazo", "Audiencia", "Audiência"]
        eventos = ItemAgenda.query.filter(
            ItemAgenda.tipo == "evento",
            ItemAgenda.status == "Pendente",
            ItemAgenda.categoria.in_(categorias_alvo),
            ItemAgenda.data_inicio.isnot(None),
        ).all()

        for ev in eventos:
            diff_dias = (ev.data_inicio.date() - hoje).days

            marcador_tag = None
            if diff_dias == 7:
                marcador_tag = "7d"
            elif diff_dias == 3:
                marcador_tag = "3d"

            if marcador_tag:
                notificacoes = ev.notificacoes_enviadas or {}
                if not notificacoes.get(marcador_tag, False):
                    user = User.query.get(ev.user_id)
                    if user and user.email:
                        # Texto do email mantem "evento" — pra usuario
                        # nao soou termico falar "ItemAgenda".
                        categoria_legivel = ev.categoria or "evento"
                        assunto = (
                            f"[Patronus] Alerta de {categoria_legivel}: "
                            f"{ev.titulo} em {diff_dias} dias!"
                        )
                        corpo = f"""
                        <h2>Aviso de {categoria_legivel}</h2>
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
                            # JSON nao detecta mutacao in-place; reatribui
                            # pra forcar UPDATE.
                            import copy

                            ev.notificacoes_enviadas = copy.deepcopy(notificacoes)
                            try:
                                db.session.commit()
                            except Exception as e:
                                app.logger.error(f"Erro salvando confirmação do email: {str(e)}")
