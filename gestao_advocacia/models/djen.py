"""DJEN/ComunicaAPI: publicações, monitoramento e triagem.

Issue #300 — extraído do models/__init__.py monolítico.
"""

from datetime import datetime

from extensions import db
from models._helpers import _iniciais_de_nome


class DjenOabMonitoramento(db.Model):
    """OABs configuradas para monitoramento automático de publicações DJEN."""

    __tablename__ = "djen_oab_monitoramento"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_djen_oab_tenant_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_djen_oab_user_id"), nullable=False
    )
    numero_oab = db.Column(db.String(30), nullable=False)
    uf_oab = db.Column(db.String(2), nullable=True)
    sigla_tribunal = db.Column(db.String(120), nullable=True)
    nome_advogado = db.Column(db.String(200), nullable=True)
    ativo = db.Column(db.Boolean, default=True)
    ultima_sincronizacao = db.Column(db.DateTime, nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (
        db.UniqueConstraint("tenant_id", "numero_oab", "uf_oab", name="uq_djen_oab_tenant"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "tenant_id": self.tenant_id,
            "numero_oab": self.numero_oab,
            "uf_oab": self.uf_oab,
            "sigla_tribunal": self.sigla_tribunal,
            "nome_advogado": self.nome_advogado,
            "ativo": self.ativo,
            "ultima_sincronizacao": (
                self.ultima_sincronizacao.isoformat() if self.ultima_sincronizacao else None
            ),
            "data_criacao": self.data_criacao.isoformat() if self.data_criacao else None,
        }


class PublicacaoDJEN(db.Model):
    """Publicações do Diário de Justiça Eletrônico capturadas via ComunicaAPI."""

    __tablename__ = "publicacao_djen"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_pub_djen_tenant_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_pub_djen_user_id"), nullable=False
    )
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_pub_djen_caso_id"), nullable=True
    )
    djen_id = db.Column(db.BigInteger, nullable=True, index=True)
    hash_comunicacao = db.Column(db.String(100), nullable=True, index=True)
    numero_comunicacao = db.Column(db.Integer, nullable=True)
    numero_processo = db.Column(db.String(50), nullable=True, index=True)
    numero_processo_mascara = db.Column(db.String(50), nullable=True)
    sigla_tribunal = db.Column(db.String(20), nullable=True, index=True)
    nome_orgao = db.Column(db.String(200), nullable=True)
    tipo_comunicacao = db.Column(db.String(100), nullable=True)
    tipo_documento = db.Column(db.String(100), nullable=True)
    nome_classe = db.Column(db.String(200), nullable=True)
    data_disponibilizacao = db.Column(db.Date, nullable=True, index=True)
    texto = db.Column(db.Text, nullable=True)
    link = db.Column(db.Text, nullable=True)
    meio = db.Column(db.String(1), nullable=True)
    ativo = db.Column(db.Boolean, default=True)
    origem_busca = db.Column(db.String(20), nullable=True)  # 'oab' ou 'processo'
    status_origem = db.Column(
        db.String(40), nullable=True, index=True
    )  # pendente, criado_automaticamente, revisado_manual, ignorado
    lida = db.Column(db.Boolean, default=False, index=True)
    triagem_ignorada = db.Column(db.Boolean, default=False, index=True)
    notas = db.Column(db.Text, nullable=True)
    polo_ativo = db.Column(db.Text, nullable=True)
    polo_passivo = db.Column(db.Text, nullable=True)
    nome_juiz = db.Column(db.String(200), nullable=True)
    raw_json = db.Column(db.JSON, nullable=True)
    data_captura = db.Column(db.DateTime, default=datetime.utcnow)
    # Epic #2 (#176): classificacao via IA (Gemini). Marca publicacoes
    # 'importantes' (decisoes, intimacoes, sentencas) vs 'rotina' (juntada,
    # vista, conclusos, expedicoes). NULL = ainda nao classificado.
    importante = db.Column(db.Boolean, nullable=True, index=True)
    classificado_em = db.Column(db.DateTime, nullable=True)
    classificacao_motivo = db.Column(db.Text, nullable=True)
    __table_args__ = (
        db.UniqueConstraint("tenant_id", "djen_id", name="uq_pub_djen_tenant_djenid"),
        db.Index("ix_publicacao_djen_tenant_created", "tenant_id", "data_captura"),
    )

    responsavel_user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        responsavel = self.responsavel_user if hasattr(self, "responsavel_user") else None
        responsavel_nome = (
            responsavel.nome_completo or responsavel.username if responsavel else None
        )
        return {
            "id": self.id,
            "user_id": self.user_id,
            "responsavel_nome": responsavel_nome,
            "responsavel_iniciais": _iniciais_de_nome(responsavel_nome),
            "tenant_id": self.tenant_id,
            "caso_id": self.caso_id,
            "djen_id": self.djen_id,
            "hash_comunicacao": self.hash_comunicacao,
            "numero_processo": self.numero_processo,
            "numero_processo_mascara": self.numero_processo_mascara,
            "sigla_tribunal": self.sigla_tribunal,
            "nome_orgao": self.nome_orgao,
            "tipo_comunicacao": self.tipo_comunicacao,
            "tipo_documento": self.tipo_documento,
            "nome_classe": self.nome_classe,
            "data_disponibilizacao": (
                self.data_disponibilizacao.isoformat() if self.data_disponibilizacao else None
            ),
            "texto": self.texto,
            "link": self.link,
            "meio": self.meio,
            "ativo": self.ativo,
            "origem_busca": self.origem_busca,
            "status_origem": self.status_origem,
            "triagem_ignorada": self.triagem_ignorada,
            "lida": self.lida,
            "notas": self.notas,
            "polo_ativo": self.polo_ativo,
            "polo_passivo": self.polo_passivo,
            "nome_juiz": self.nome_juiz,
            "data_captura": self.data_captura.isoformat() if self.data_captura else None,
            # Epic #2 (#176): exposto pra UI desenhar selo "Importante"
            # e tooltip do motivo. None = ainda nao classificado.
            "importante": self.importante,
            "classificado_em": (self.classificado_em.isoformat() if self.classificado_em else None),
            "classificacao_motivo": self.classificacao_motivo,
        }


class DjenVinculoDecisao(db.Model):
    """Trilha auditável de decisões humanas/automáticas da triagem DJEN."""

    __tablename__ = "djen_vinculo_decisao"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_djen_decisao_tenant_id"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_djen_decisao_user_id"),
        nullable=False,
        index=True,
    )
    publicacao_id = db.Column(
        db.Integer,
        db.ForeignKey("publicacao_djen.id", name="fk_djen_decisao_publicacao_id"),
        nullable=False,
        index=True,
    )
    acao = db.Column(db.String(30), nullable=False, index=True)  # criar, mesclar, ignorar
    origem_acao = db.Column(db.String(20), nullable=False, default="manual")  # manual ou automatica
    cliente_id = db.Column(
        db.Integer, db.ForeignKey("cliente.id", name="fk_djen_decisao_cliente_id"), nullable=True
    )
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_djen_decisao_caso_id"), nullable=True
    )
    confianca = db.Column(db.Float, nullable=True)
    motivo = db.Column(db.String(255), nullable=True)
    payload = db.Column(db.JSON, nullable=True)
    data_decisao = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "publicacao_id": self.publicacao_id,
            "acao": self.acao,
            "origem_acao": self.origem_acao,
            "cliente_id": self.cliente_id,
            "caso_id": self.caso_id,
            "confianca": self.confianca,
            "motivo": self.motivo,
            "payload": self.payload,
            "data_decisao": self.data_decisao.isoformat() if self.data_decisao else None,
        }


class DjenSyncJob(db.Model):
    """Fila persistente de jobs de sincronizacao DJEN (B1 do roteiro 2026-05-01).

    Endpoint POST /djen/sync enfileira aqui (status=pending) e retorna 202.
    Processo djen-worker poll a cada 5s, pega job FOR UPDATE SKIP LOCKED, marca
    running, executa job_monitorar_djen, marca done/failed com resumo.

    Categoria C (sem RLS): worker e cross-tenant; tenant_id e dado da linha,
    nao filtro de policy. Filtragem por tenant na leitura via /djen/sync/<id>
    e na camada de aplicacao (endpoint exige user.tenant_id == job.tenant_id).
    """

    __tablename__ = "djen_sync_job"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_djen_sync_job_tenant_id"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_djen_sync_job_user_id"),
        nullable=False,
    )
    # status: pending | running | done | failed
    status = db.Column(
        db.String(20), nullable=False, default="pending", server_default="pending", index=True
    )
    lookback_days = db.Column(db.Integer, nullable=False, default=30)
    resumo = db.Column(db.JSON, nullable=True)
    erro = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    iniciado_em = db.Column(db.DateTime, nullable=True)
    concluido_em = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "status": self.status,
            "lookback_days": self.lookback_days,
            "resumo": self.resumo,
            "erro": self.erro,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "iniciado_em": self.iniciado_em.isoformat() if self.iniciado_em else None,
            "concluido_em": self.concluido_em.isoformat() if self.concluido_em else None,
        }
