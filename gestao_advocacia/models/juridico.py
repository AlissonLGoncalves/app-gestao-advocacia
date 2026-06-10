"""Núcleo jurídico: clientes, casos, documentos e modelos.

Issue #300 — extraído do models/__init__.py monolítico.
"""

from datetime import datetime

from extensions import db
from models._helpers import _iniciais_de_nome


class Cliente(db.Model):
    __tablename__ = "cliente"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_cliente_tenant_id"), nullable=True
    )
    # Dados principais
    nome_razao_social = db.Column(db.String(200), nullable=False)
    cpf_cnpj = db.Column(db.String(20), nullable=False)
    tipo_pessoa = db.Column(db.String(2), nullable=False, default="PF")  # PF ou PJ
    email = db.Column(db.String(120), nullable=True)
    telefone = db.Column(db.String(20), nullable=True)
    # Campos PF
    rg = db.Column(db.String(20), nullable=True)
    orgao_emissor = db.Column(db.String(20), nullable=True)
    data_nascimento = db.Column(db.Date, nullable=True)
    estado_civil = db.Column(db.String(30), nullable=True)
    profissao = db.Column(db.String(100), nullable=True)
    nacionalidade = db.Column(db.String(60), nullable=True, default="Brasileiro(a)")
    # Campos PJ
    nome_fantasia = db.Column(db.String(200), nullable=True)
    nire = db.Column(db.String(30), nullable=True)
    inscricao_estadual = db.Column(db.String(30), nullable=True)
    inscricao_municipal = db.Column(db.String(30), nullable=True)
    cnpj_secundario = db.Column(db.String(20), nullable=True)
    descricao_cnpj_secundario = db.Column(db.String(200), nullable=True)
    cnpj_terciario = db.Column(db.String(20), nullable=True)
    descricao_cnpj_terciario = db.Column(db.String(200), nullable=True)
    # Representante legal (PJ): pessoa fisica que assina procuracoes em nome
    # da empresa. Obrigatorio na pratica para validade da procuracao.
    responsavel_nome = db.Column(db.String(200), nullable=True)
    responsavel_cpf = db.Column(db.String(14), nullable=True)
    responsavel_cargo = db.Column(db.String(100), nullable=True)  # ex: Sócio Administrador
    # Endereço
    cep = db.Column(db.String(10), nullable=True)
    rua = db.Column(db.String(200), nullable=True)
    numero = db.Column(db.String(20), nullable=True)
    bairro = db.Column(db.String(100), nullable=True)
    cidade = db.Column(db.String(100), nullable=True)
    estado = db.Column(db.String(2), nullable=True)
    pais = db.Column(db.String(60), nullable=True, default="Brasil")
    # Outros
    notas_gerais = db.Column(db.Text, nullable=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_cliente_user_id"), nullable=False
    )

    casos = db.relationship(
        "Caso", backref="cliente_associado", lazy="dynamic", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nome_razao_social": self.nome_razao_social,
            "cpf_cnpj": self.cpf_cnpj,
            "tipo_pessoa": self.tipo_pessoa,
            "email": self.email,
            "telefone": self.telefone,
            "rg": self.rg,
            "orgao_emissor": self.orgao_emissor,
            "data_nascimento": self.data_nascimento.isoformat() if self.data_nascimento else None,
            "estado_civil": self.estado_civil,
            "profissao": self.profissao,
            "nacionalidade": self.nacionalidade,
            "nome_fantasia": self.nome_fantasia,
            "nire": self.nire,
            "inscricao_estadual": self.inscricao_estadual,
            "inscricao_municipal": self.inscricao_municipal,
            "cnpj_secundario": self.cnpj_secundario,
            "descricao_cnpj_secundario": self.descricao_cnpj_secundario,
            "cnpj_terciario": self.cnpj_terciario,
            "descricao_cnpj_terciario": self.descricao_cnpj_terciario,
            "responsavel_nome": self.responsavel_nome,
            "responsavel_cpf": self.responsavel_cpf,
            "responsavel_cargo": self.responsavel_cargo,
            "cep": self.cep,
            "rua": self.rua,
            "numero": self.numero,
            "bairro": self.bairro,
            "cidade": self.cidade,
            "estado": self.estado,
            "pais": self.pais,
            "notas_gerais": self.notas_gerais,
            "user_id": self.user_id,
            # Flag derivada: True quando o cpf_cnpj eh placeholder gerado por
            # backfill DJEN ou Projudi (sem documento real). Frontend usa pra
            # exibir badge "Dados pendentes" e priorizar complemento manual.
            "dados_pendentes": bool(
                self.cpf_cnpj and self.cpf_cnpj.startswith(("DJEN-", "PROJUDI-"))
            ),
        }


class Caso(db.Model):
    __tablename__ = "caso"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_caso_tenant_id"), nullable=True
    )
    titulo = db.Column(db.String(200), nullable=False)
    numero_processo = db.Column(db.String(30), unique=False, nullable=True, index=True)
    status = db.Column(db.String(50), nullable=True, default="Ativo")
    # Dados processuais
    tipo_acao = db.Column(db.String(100), nullable=True)
    area_direito = db.Column(db.String(80), nullable=True)
    fase_processual = db.Column(db.String(80), nullable=True)
    vara_juizo = db.Column(db.String(100), nullable=True)
    comarca = db.Column(db.String(100), nullable=True)
    instancia = db.Column(db.String(50), nullable=True)
    # Partes
    parte_contraria = db.Column(db.String(200), nullable=True)
    adv_parte_contraria = db.Column(db.String(200), nullable=True)
    # Valores e datas
    valor_causa = db.Column(db.Numeric(14, 2), nullable=True)
    data_distribuicao = db.Column(db.Date, nullable=True)
    notas_caso = db.Column(db.Text, nullable=True)
    descricao = db.Column(db.Text, nullable=True)
    # Epico 4: triagem visual via CardMeta. Mesmo set de valores
    # ('Urgente'/'Alta'/'Normal'/'Baixa') usado em TarefaPrazo.
    prioridade = db.Column(db.String(20), nullable=False, default="Normal", server_default="Normal")
    # Timestamps e relações
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    data_atualizacao = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cliente_id = db.Column(
        db.Integer, db.ForeignKey("cliente.id", name="fk_caso_cliente_id"), nullable=False
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_caso_user_id"), nullable=False
    )
    # Epic #8 (#182): apensar processo. Quando preenchido, este caso e
    # apenso ao caso indicado. Self-FK nullable.
    caso_principal_id = db.Column(
        db.Integer,
        db.ForeignKey("caso.id", name="fk_caso_caso_principal_id"),
        nullable=True,
        index=True,
    )
    data_ultima_verificacao_cnj = db.Column(db.DateTime, nullable=True)
    data_ultima_verificacao_djen = db.Column(db.DateTime, nullable=True)

    movimentacoes_cnj = db.relationship(
        "MovimentacaoCNJ",
        backref="caso_cnj_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    documentos_caso = db.relationship(
        "Documento",
        backref="caso_documento_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    despesas_caso = db.relationship(
        "Despesa", backref="caso_despesa_associado", lazy="dynamic", cascade="all, delete-orphan"
    )
    recebimentos_caso = db.relationship(
        "Recebimento",
        backref="caso_recebimento_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    contratos_caso = db.relationship(
        "ContratoHonorario",
        backref="caso_contrato_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    # PR D4.4 — tarefas_caso (TarefaPrazo) removido. Tarefas vinculadas
    # ao caso sao acessiveis via ItemAgenda.query.filter_by(caso_id=...).
    # Alias read-only para Caso.cliente. O backref de Cliente.casos ja cria
    # Caso.cliente_associado, mas varios pontos do codigo (caso_model_dto,
    # GET /casos/buscar-processo-local, triagem DJEN) usam c.cliente — que
    # silenciosamente retornava None desde o PR #148. Mantem padrao das
    # relationships de Recebimento/Despesa.
    cliente = db.relationship(
        "Cliente",
        foreign_keys=[cliente_id],
        viewonly=True,
        overlaps="casos,cliente_associado",
    )

    def __repr__(self):
        return f"<Caso {self.id} - {self.titulo}>"

    def to_dict(self):
        cliente_obj = self.cliente_associado if hasattr(self, "cliente_associado") else None
        responsavel = self.responsavel_user if hasattr(self, "responsavel_user") else None
        responsavel_nome = (
            responsavel.nome_completo or responsavel.username if responsavel else None
        )
        return {
            "id": self.id,
            "titulo": self.titulo,
            "numero_processo": self.numero_processo,
            "status": self.status,
            "tipo_acao": self.tipo_acao,
            "area_direito": self.area_direito,
            "fase_processual": self.fase_processual,
            "vara_juizo": self.vara_juizo,
            "comarca": self.comarca,
            "instancia": self.instancia,
            "parte_contraria": self.parte_contraria,
            "adv_parte_contraria": self.adv_parte_contraria,
            "valor_causa": str(self.valor_causa) if self.valor_causa else None,
            "data_distribuicao": (
                self.data_distribuicao.isoformat() if self.data_distribuicao else None
            ),
            "notas_caso": self.notas_caso,
            "descricao": self.descricao,
            "prioridade": self.prioridade,
            "data_criacao": self.data_criacao.isoformat() if self.data_criacao else None,
            "data_atualizacao": (
                self.data_atualizacao.isoformat() if self.data_atualizacao else None
            ),
            "cliente_id": self.cliente_id,
            "cliente": (
                {"id": cliente_obj.id, "nome_razao_social": cliente_obj.nome_razao_social}
                if cliente_obj
                else None
            ),
            "user_id": self.user_id,
            "responsavel_nome": responsavel_nome,
            "responsavel_iniciais": _iniciais_de_nome(responsavel_nome),
            "caso_principal_id": self.caso_principal_id,
            "eh_apenso": self.caso_principal_id is not None,
            "data_ultima_verificacao_cnj": (
                self.data_ultima_verificacao_cnj.isoformat()
                if self.data_ultima_verificacao_cnj
                else None
            ),
            "movimentacoes_cnj_count": self.movimentacoes_cnj.count(),
        }


class MovimentacaoCNJ(db.Model):
    __tablename__ = "movimentacao_cnj"
    id = db.Column(db.Integer, primary_key=True)
    # tenant_id denormalizado (Onda 3.1 Fase 4 Batch 1, decisao #1 do plano):
    # categoria B no design original — tenant resolvido via FK caso_id.
    # Denormalizado para evitar subquery por linha em policy RLS no hot-path
    # de ingestao DJEN/CNJ. Sempre populado a partir do caso pai.
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_movimentacao_cnj_tenant_id"),
        nullable=False,
    )
    caso_id = db.Column(
        db.Integer,
        db.ForeignKey("caso.id", name="fk_movimentacao_cnj_caso_id"),
        nullable=False,
        index=True,
    )
    data_movimentacao = db.Column(db.DateTime, nullable=False, index=True)
    descricao = db.Column(db.Text, nullable=False)
    dados_integra_cnj = db.Column(db.JSON, nullable=True)
    data_registro_sistema = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (
        db.Index(
            "ix_movimentacao_cnj_tenant_data_registro",
            "tenant_id",
            "data_registro_sistema",
        ),
    )

    def __repr__(self):
        return f'<MovimentacaoCNJ id={self.id} caso_id={self.caso_id} data="{self.data_movimentacao.strftime("%Y-%m-%d %H:%M")}">'

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "caso_id": self.caso_id,
            "data_movimentacao": (
                self.data_movimentacao.isoformat() if self.data_movimentacao else None
            ),
            "descricao": self.descricao,
            "dados_integra_cnj": self.dados_integra_cnj,
            "data_registro_sistema": (
                self.data_registro_sistema.isoformat() if self.data_registro_sistema else None
            ),
        }


class Documento(db.Model):
    __tablename__ = "documento"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_documento_tenant_id"), nullable=True
    )
    nome_arquivo = db.Column(db.String(255), nullable=False)
    path_arquivo = db.Column(db.String(500), nullable=False)
    data_upload = db.Column(db.DateTime, default=datetime.utcnow)
    # Hash SHA-256 do conteudo do arquivo. Usado pra dedup idempotente quando
    # o mesmo PDF eh re-enviado (ex: agent PROJUDI roda sync 2x). Nullable
    # porque docs antigos nao tinham esse campo populado.
    hash_arquivo = db.Column(db.String(64), nullable=True, index=True)
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_documento_caso_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_documento_user_id"), nullable=False
    )
    __table_args__ = (
        db.Index("ix_documento_tenant_created", "tenant_id", "data_upload"),
        db.Index("ix_documento_caso_hash", "caso_id", "hash_arquivo"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nome_arquivo": self.nome_arquivo,
            "data_upload": self.data_upload.isoformat(),
            "caso_id": self.caso_id,
            "user_id": self.user_id,
            "hash_arquivo": self.hash_arquivo,
            "url_download": f"/api/documentos/download/{self.id}",
        }


class ProcuracaoAnalise(db.Model):
    __tablename__ = "procuracao_analise"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_procuracao_analise_tenant_id"),
        nullable=False,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_procuracao_analise_user_id"),
        nullable=False,
    )
    cliente_id = db.Column(
        db.Integer,
        db.ForeignKey("cliente.id", name="fk_procuracao_analise_cliente_id"),
        nullable=True,
        index=True,
    )
    caso_id = db.Column(
        db.Integer,
        db.ForeignKey("caso.id", name="fk_procuracao_analise_caso_id"),
        nullable=True,
        index=True,
    )
    arquivo_path = db.Column(db.String(500), nullable=False)
    arquivo_hash = db.Column(db.String(64), nullable=False)
    status = db.Column(
        db.Enum("pending", "processing", "done", "failed", name="procuracao_analise_status"),
        nullable=False,
        default="pending",
    )
    dados_extraidos = db.Column(db.JSON, nullable=True)
    erro = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    processado_em = db.Column(db.DateTime, nullable=True)

    __table_args__ = (db.Index("ix_procuracao_analise_tenant_status", "tenant_id", "status"),)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "cliente_id": self.cliente_id,
            "caso_id": self.caso_id,
            "arquivo_path": self.arquivo_path,
            "arquivo_hash": self.arquivo_hash,
            "tem_pdf": bool(self.arquivo_path),
            "status": self.status,
            "dados_extraidos": self.dados_extraidos,
            "erro": self.erro,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "processado_em": self.processado_em.isoformat() if self.processado_em else None,
        }


class ModeloDocumento(db.Model):
    """Templates editáveis de documentos (Procuração PF/PJ, Contrato PF/PJ, etc.)
    com placeholders Jinja2-like ({{cliente.nome}}, {{caso.numero_processo}})
    que são renderizados em HTML pelo backend a partir dos dados do cliente
    e caso. Epic #9 (#183).

    `tipo` agrupa modelos por finalidade (procuracao_pf, procuracao_pj,
    contrato_pf, contrato_pj, peticao, outro). `padrao=True` indica que é um
    template de "fábrica" criado via seed — pode ser editado pelo tenant
    mas sobrescreve só pra esse tenant (clone-on-write opcional no futuro).
    """

    __tablename__ = "modelo_documento"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_modelo_documento_tenant_id"),
        nullable=True,
        index=True,
    )
    titulo = db.Column(db.String(200), nullable=False)
    tipo = db.Column(db.String(50), nullable=False, index=True)
    descricao = db.Column(db.Text, nullable=True)
    conteudo_html = db.Column(db.Text, nullable=False)
    # Documenta as variáveis que o template aceita pra ajudar o user a editar
    # sem ter que decorar (ex.: ["cliente.nome_razao_social", "caso.numero_processo"]).
    variaveis_disponiveis = db.Column(db.JSON, nullable=True)
    # Modelos com padrao=True vêm do seed; padrao=False são customizados pelo
    # tenant. Ambos podem ser editados; só os custom podem ser deletados.
    padrao = db.Column(db.Boolean, nullable=False, default=False, server_default="false")
    ativo = db.Column(db.Boolean, nullable=False, default=True, server_default="true")
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_modelo_documento_user_id"),
        nullable=True,
    )
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    atualizado_em = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "titulo": self.titulo,
            "tipo": self.tipo,
            "descricao": self.descricao,
            "conteudo_html": self.conteudo_html,
            "variaveis_disponiveis": self.variaveis_disponiveis or [],
            "padrao": self.padrao,
            "ativo": self.ativo,
            "user_id": self.user_id,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "atualizado_em": (self.atualizado_em.isoformat() if self.atualizado_em else None),
        }
