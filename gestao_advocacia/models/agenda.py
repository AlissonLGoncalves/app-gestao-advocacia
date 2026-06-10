"""Agenda unificada (prazos/tarefas/eventos) e notificações.

Issue #300 — extraído do models/__init__.py monolítico.
"""

from datetime import datetime

from extensions import db


class ItemAgenda(db.Model):
    """Modelo unificado de Prazos/Tarefas/Eventos da Agenda (PR D1).

    Unifica TarefaPrazo (kanban) + EventoAgenda (calendario) num unico
    modelo. Antes, o mesmo conceito "prazo" podia existir em duas tabelas
    diferentes (tarefa_prazo com tipo_tarefa='Prazo' OU evento_agenda com
    tipo_evento='Prazo'), causando duplicidade e confusao no fluxo de
    trabalho do usuario.

    Estrategia de migracao (Expand → Migrate → Contract):
      - D1 (este PR): modelo + endpoint paralelo. Nao toca em tarefa_prazo
        nem evento_agenda — backend tem 3 tabelas em paralelo.
      - D2: backfill + dual-write. Toda escrita em /tarefas ou /eventos
        replica em item_agenda. Backfill copia dados existentes via script
        idempotente.
      - D3: frontend migra pra /v1/itens-agenda como fonte unica de verdade.
      - D4: deprecation + drop das tabelas/endpoints legados.

    Discriminador `tipo`:
      - 'tarefa': sem data fixa obrigatoria, kanban-friendly. Usa posicao
        e (opcional) data_vencimento. Mapeia TarefaPrazo.
      - 'evento': calendar-bound. Usa data_inicio (obrigatorio) +
        data_fim (opcional). Mapeia EventoAgenda.

    Campos `legacy_*_id`: durante D2/D3 apontam pro registro de origem nas
    tabelas legadas. Permite dual-write idempotente (re-rodar o backfill
    nao duplica) e rollback. Sao removidos em D4.
    """

    __tablename__ = "item_agenda"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_item_agenda_tenant_id"),
        nullable=True,
    )

    # Discriminador: 'tarefa' (kanban) ou 'evento' (calendario)
    tipo = db.Column(db.String(20), nullable=False, default="tarefa")

    # Categoria semantica (substitui tipo_tarefa + tipo_evento).
    # Valores: Prazo, Audiencia, Reuniao, Peticionamento, Ligacao,
    # Lembrete, Outros.
    categoria = db.Column(db.String(50), nullable=True, default="Outros")

    titulo = db.Column(db.String(250), nullable=False)
    descricao = db.Column(db.Text, nullable=True)

    # Status unificado: Pendente | Em Andamento | Concluido | Cancelado.
    # Mapeamento de TarefaPrazo.status:
    #   "A Fazer"    -> "Pendente"
    #   "Fazendo"    -> "Em Andamento"
    #   "Concluido"  -> "Concluido"
    # Mapeamento de EventoAgenda.status_evento:
    #   "Pendente"   -> "Pendente"
    #   "Concluido"  -> "Concluido"
    #   "Cancelado"  -> "Cancelado"
    status = db.Column(db.String(30), nullable=False, default="Pendente")
    prioridade = db.Column(db.String(30), nullable=True, default="Normal")

    # Datas: tipo=tarefa usa data_vencimento (opcional, dia unico);
    # tipo=evento usa data_inicio (obrigatorio) + data_fim (opcional).
    data_inicio = db.Column(db.DateTime, nullable=True)
    data_fim = db.Column(db.DateTime, nullable=True)
    data_vencimento = db.Column(db.DateTime, nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)

    # Kanban ordering (so faz sentido para tipo=tarefa).
    posicao = db.Column(db.Integer, nullable=True, default=0)

    # FKs comuns
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_item_agenda_user_id"),
        nullable=False,
    )
    caso_id = db.Column(
        db.Integer,
        db.ForeignKey("caso.id", name="fk_item_agenda_caso_id"),
        nullable=True,
    )
    publicacao_djen_id = db.Column(
        db.Integer,
        db.ForeignKey("publicacao_djen.id", name="fk_item_agenda_publicacao_djen_id"),
        nullable=True,
        index=True,
    )

    # IA / validacao (de TarefaPrazo)
    prazo_validado = db.Column(db.Boolean, nullable=False, default=True)
    prazo_calculado_por_ia = db.Column(db.Boolean, nullable=False, default=False)
    prazo_dias_origem = db.Column(db.Integer, nullable=True)
    origem_id = db.Column(db.String(100), nullable=True)
    # Issue #304 — tipo de providencia detectado pelo calculador de prazo
    # (nome da regra: contestacao_15d, recurso_15d, manifestacao_15d, ...).
    # Permite a UI mostrar O QUE a intimacao exige e sugerir o modelo de
    # peca certo no "Gerar peca". Nullable: itens manuais nao tem.
    tipo_providencia = db.Column(db.String(40), nullable=True)

    # Notificacoes (de EventoAgenda) — estado de envio {"7d": True, ...}.
    notificacoes_enviadas = db.Column(db.JSON, nullable=True, default=dict)

    # PR "Tratar Prazo" (Onda 1) — registro de como o advogado tratou
    # o prazo. Distinto de status=Concluido pois:
    #   - status = onde o card vive (kanban A Fazer/Em Andamento/Concluido)
    #   - tratado_em = TIMESTAMP de quando o tratamento foi registrado
    #   - como_tratado = texto livre ("peticionei contestacao", "prazo nao
    #     era meu — equivoco do tribunal", "aditei prorrogacao 5 dias")
    #   - peticao_cumpridora_id = doc que prova o cumprimento (opcional)
    tratado_em = db.Column(db.DateTime, nullable=True)
    como_tratado = db.Column(db.Text, nullable=True)
    peticao_cumpridora_id = db.Column(
        db.Integer,
        db.ForeignKey("documento.id", name="fk_item_agenda_peticao_cumpridora_id"),
        nullable=True,
    )

    # PR D4.4 — legacy_tarefa_id / legacy_evento_id removidos. Eram usados
    # apenas pelo backfill (D2) pra evitar duplicar dados durante a
    # transicao. Apos D4.4 drop, nao ha mais tabelas legadas que referenciar.

    __table_args__ = (
        db.Index(
            "ix_item_agenda_tenant_tipo_data",
            "tenant_id",
            "tipo",
            "data_inicio",
        ),
        db.Index("ix_item_agenda_tenant_status", "tenant_id", "status"),
        db.Index("ix_item_agenda_caso", "caso_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "categoria": self.categoria,
            "titulo": self.titulo,
            "descricao": self.descricao,
            "status": self.status,
            "prioridade": self.prioridade,
            "data_inicio": self.data_inicio.isoformat() if self.data_inicio else None,
            "data_fim": self.data_fim.isoformat() if self.data_fim else None,
            "data_vencimento": (
                self.data_vencimento.date().isoformat() if self.data_vencimento else None
            ),
            "data_criacao": self.data_criacao.isoformat() if self.data_criacao else None,
            "posicao": self.posicao,
            "user_id": self.user_id,
            "caso_id": self.caso_id,
            "publicacao_djen_id": self.publicacao_djen_id,
            "prazo_validado": bool(self.prazo_validado),
            "prazo_calculado_por_ia": bool(self.prazo_calculado_por_ia),
            "prazo_dias_origem": self.prazo_dias_origem,
            "tipo_providencia": self.tipo_providencia,
            "origem_id": self.origem_id,
            "notificacoes_enviadas": self.notificacoes_enviadas,
            "tratado_em": self.tratado_em.isoformat() if self.tratado_em else None,
            "como_tratado": self.como_tratado,
            "peticao_cumpridora_id": self.peticao_cumpridora_id,
        }


class Notificacao(db.Model):
    """Notificacao in-app pro usuario.

    Criada pelo cron de vencimentos (notificacoes_tasks.py) ou outras
    fontes futuras (DJEN, prazos, convites). `dedupe_key` previne
    duplicacao quando o cron roda multiplas vezes pra mesma situacao.
    """

    __tablename__ = "notificacao"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_notificacao_tenant_id"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_notificacao_user_id"),
        nullable=False,
        index=True,
    )
    # recebimento_vencendo|recebimento_atrasado|despesa_vencendo|
    # despesa_atrasada|prazo_vencendo|djen_nova|etc.
    tipo = db.Column(db.String(50), nullable=False, index=True)
    # info|success|warning|danger (cor do badge no frontend)
    severidade = db.Column(db.String(20), nullable=False, default="info")
    titulo = db.Column(db.String(200), nullable=False)
    mensagem = db.Column(db.Text, nullable=True)
    # Link pra navegar quando user clicar (ex: /recebimentos/editar/42)
    link = db.Column(db.String(500), nullable=True)
    lida = db.Column(db.Boolean, nullable=False, default=False, index=True)
    data_criacao = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    data_leitura = db.Column(db.DateTime, nullable=True)
    # Chave de dedup por (user_id, dedupe_key) — evita criar a mesma
    # notificacao 2x. Ex: "recebimento_vencendo:42:2026-06-01".
    dedupe_key = db.Column(db.String(200), nullable=True, index=True)

    __table_args__ = (
        db.Index("ix_notificacao_user_lida", "user_id", "lida"),
        db.UniqueConstraint("user_id", "dedupe_key", name="uq_notificacao_user_dedupe"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "severidade": self.severidade,
            "titulo": self.titulo,
            "mensagem": self.mensagem,
            "link": self.link,
            "lida": self.lida,
            "data_criacao": self.data_criacao.isoformat() if self.data_criacao else None,
            "data_leitura": self.data_leitura.isoformat() if self.data_leitura else None,
        }
