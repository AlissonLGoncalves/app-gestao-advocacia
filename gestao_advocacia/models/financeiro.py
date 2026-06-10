"""Financeiro: contratos, recebimentos, despesas e NFS-e.

Issue #300 — extraído do models/__init__.py monolítico.
"""

from datetime import datetime

from extensions import db


class ContratoHonorario(db.Model):
    __tablename__ = "contrato_honorario"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_contrato_tenant_id"), nullable=True
    )
    tipo_honorario = db.Column(db.String(50), nullable=False)  # Fixo, Êxito, Mensal, Horas
    valor_total = db.Column(db.Numeric(14, 2), nullable=True)
    percentual_exito = db.Column(db.Numeric(5, 2), nullable=True)
    percentual_recurso = db.Column(db.Numeric(5, 2), nullable=True)
    data_assinatura = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(30), nullable=True, default="Ativo")
    notas_condicoes = db.Column(db.Text, nullable=True)
    objeto = db.Column(db.Text, nullable=True)
    vigencia_condicao = db.Column(db.Text, nullable=True)
    arquivo_hash = db.Column(db.String(64), nullable=True)
    arquivo_nome = db.Column(db.String(255), nullable=True)
    arquivo_path = db.Column(db.String(500), nullable=True)
    parcelas_json = db.Column(db.Text, nullable=True)

    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_contrato_caso_id"), nullable=True
    )
    cliente_id = db.Column(
        db.Integer, db.ForeignKey("cliente.id", name="fk_contrato_cliente_id"), nullable=False
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_contrato_user_id"), nullable=False
    )

    recebimentos_contrato = db.relationship(
        "Recebimento",
        backref="contrato_recebimento_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo_honorario": self.tipo_honorario,
            "valor_total": str(self.valor_total) if self.valor_total else None,
            "percentual_exito": str(self.percentual_exito) if self.percentual_exito else None,
            "percentual_recurso": (
                str(self.percentual_recurso) if self.percentual_recurso else None
            ),
            "data_assinatura": self.data_assinatura.isoformat() if self.data_assinatura else None,
            "status": self.status,
            "notas_condicoes": self.notas_condicoes,
            "objeto": self.objeto,
            "vigencia_condicao": self.vigencia_condicao,
            "arquivo_nome": self.arquivo_nome,
            "tem_pdf": bool(self.arquivo_path),
            "parcelas_json": self.parcelas_json,
            "caso_id": self.caso_id,
            "cliente_id": self.cliente_id,
            "user_id": self.user_id,
        }


class RecorrenciaDespesa(db.Model):
    """Configuracao de recorrencia/parcelamento de DESPESAS.

    Espelha RecorrenciaRecebimento. Tipo RECORRENTE = pagamento mensal/
    semanal indefinido (aluguel, conta de luz, mensalidade SaaS). Tipo
    PARCELADO = divida fechada em N parcelas (compra de software anual em
    12x, divida acordada com fornecedor).

    A geracao das parcelas individuais (Despesas) eh feita pelo endpoint
    POST /despesas/serie.
    """

    __tablename__ = "recorrencia_despesa"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_recorrencia_despesa_tenant_id"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_recorrencia_despesa_user_id"),
        nullable=False,
    )
    tipo = db.Column(db.String(20), nullable=False)  # RECORRENTE | PARCELADO
    frequencia = db.Column(db.String(20), nullable=True)  # MENSAL|SEMANAL|QUINZENAL|ANUAL
    valor_parcela = db.Column(db.Numeric(10, 2), nullable=False)
    total_parcelas = db.Column(db.Integer, nullable=True)
    data_inicio = db.Column(db.Date, nullable=False)
    data_fim = db.Column(db.Date, nullable=True)
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    descricao = db.Column(db.String(200), nullable=True)
    fornecedor = db.Column(db.String(200), nullable=True)
    caso_id = db.Column(
        db.Integer,
        db.ForeignKey("caso.id", name="fk_recorrencia_despesa_caso_id"),
        nullable=True,
    )
    cliente_id = db.Column(
        db.Integer,
        db.ForeignKey("cliente.id", name="fk_recorrencia_despesa_cliente_id"),
        nullable=True,
    )
    categoria = db.Column(db.String(80), nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)

    parcelas = db.relationship("Despesa", backref="recorrencia", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "frequencia": self.frequencia,
            "valor_parcela": str(self.valor_parcela) if self.valor_parcela else None,
            "total_parcelas": self.total_parcelas,
            "data_inicio": self.data_inicio.isoformat() if self.data_inicio else None,
            "data_fim": self.data_fim.isoformat() if self.data_fim else None,
            "ativo": self.ativo,
            "descricao": self.descricao,
            "fornecedor": self.fornecedor,
            "caso_id": self.caso_id,
            "cliente_id": self.cliente_id,
            "categoria": self.categoria,
        }


class Despesa(db.Model):
    __tablename__ = "despesa"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_despesa_tenant_id"), nullable=True
    )
    descricao = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    # DEPRECATED: mantido por compat. Use data_vencimento/data_pagamento.
    data_despesa = db.Column(db.Date, nullable=True)
    # DEPRECATED: use status. Sincronizado (status=="Pago" <=> True).
    pago = db.Column(db.Boolean, default=False)
    # === Fase 1 "Despesa Robusto" — novos campos ===
    # Cliente vinculado: pra despesas reembolsaveis (custas que o cliente
    # devolve, despesas de viagem de audiencia, etc).
    cliente_id = db.Column(
        db.Integer,
        db.ForeignKey("cliente.id", name="fk_despesa_cliente_id"),
        nullable=True,
        index=True,
    )
    status = db.Column(db.String(30), nullable=True, default="Pendente", index=True)
    data_vencimento = db.Column(db.Date, nullable=True, index=True)
    data_pagamento = db.Column(db.Date, nullable=True)
    categoria = db.Column(db.String(80), nullable=True)
    forma_pagamento = db.Column(db.String(50), nullable=True)
    notas = db.Column(db.Text, nullable=True)
    # Texto livre — quem recebeu o pagamento (loja, prestador, etc).
    # Nao eh entidade propria pra evitar overhead de cadastro de fornecedor.
    fornecedor = db.Column(db.String(200), nullable=True)
    recorrencia_id = db.Column(
        db.Integer,
        db.ForeignKey("recorrencia_despesa.id", name="fk_despesa_recorrencia_id"),
        nullable=True,
        index=True,
    )
    numero_parcela = db.Column(db.Integer, nullable=True)
    # === Fim dos campos novos ===
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_despesa_caso_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_despesa_user_id"), nullable=False
    )
    # Relationships read-only para o DTO expor cliente_nome/caso_titulo na
    # listagem. overlaps silencia o warning do SQLAlchemy sobre os backrefs
    # ja existentes (Caso.despesas_caso/User.despesas_registradas).
    cliente = db.relationship("Cliente", foreign_keys=[cliente_id], viewonly=True)
    caso = db.relationship(
        "Caso",
        foreign_keys=[caso_id],
        viewonly=True,
        overlaps="caso_despesa_associado,despesas_caso",
    )
    __table_args__ = (db.Index("ix_despesa_tenant_created", "tenant_id", "data_despesa"),)

    def sync_legacy_fields(self):
        """Sincroniza campos deprecated (pago, data_despesa) com novos."""
        self.pago = self.status == "Pago"
        self.data_despesa = self.data_pagamento or self.data_vencimento

    def to_dict(self):
        return {
            "id": self.id,
            "descricao": self.descricao,
            "valor": str(self.valor),
            "status": self.status,
            "data_vencimento": (self.data_vencimento.isoformat() if self.data_vencimento else None),
            "data_pagamento": (self.data_pagamento.isoformat() if self.data_pagamento else None),
            "categoria": self.categoria,
            "forma_pagamento": self.forma_pagamento,
            "notas": self.notas,
            "fornecedor": self.fornecedor,
            "cliente_id": self.cliente_id,
            "caso_id": self.caso_id,
            "user_id": self.user_id,
            "recorrencia_id": self.recorrencia_id,
            "numero_parcela": self.numero_parcela,
            # Deprecated mas devolvidos por compat retroativa.
            "data_despesa": self.data_despesa.isoformat() if self.data_despesa else None,
            "pago": self.pago,
        }


class RecorrenciaRecebimento(db.Model):
    """Configuracao de recorrencia/parcelamento.

    Tipo "RECORRENTE" representa honorario mensal/semanal indefinido (ex:
    R$ 1.500/mes ate cancelar). Tipo "PARCELADO" representa uma divida
    fechada dividida em N parcelas (ex: acordo R$ 12.000 em 12x).

    A geracao das parcelas individuais (objetos Recebimento) eh feita pelo
    endpoint POST /recebimentos/serie. Esta tabela so guarda a config.
    """

    __tablename__ = "recorrencia_recebimento"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_recorrencia_recebimento_tenant_id"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_recorrencia_recebimento_user_id"),
        nullable=False,
    )
    # "RECORRENTE" | "PARCELADO"
    tipo = db.Column(db.String(20), nullable=False)
    # "MENSAL" | "SEMANAL" | "QUINZENAL" | "ANUAL" (apenas RECORRENTE usa)
    frequencia = db.Column(db.String(20), nullable=True)
    valor_parcela = db.Column(db.Numeric(10, 2), nullable=False)
    # PARCELADO: numero total de parcelas. RECORRENTE: opcional (limite).
    total_parcelas = db.Column(db.Integer, nullable=True)
    data_inicio = db.Column(db.Date, nullable=False)
    data_fim = db.Column(db.Date, nullable=True)
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    descricao = db.Column(db.String(200), nullable=True)
    cliente_id = db.Column(
        db.Integer,
        db.ForeignKey("cliente.id", name="fk_recorrencia_recebimento_cliente_id"),
        nullable=True,
    )
    caso_id = db.Column(
        db.Integer,
        db.ForeignKey("caso.id", name="fk_recorrencia_recebimento_caso_id"),
        nullable=True,
    )
    categoria = db.Column(db.String(80), nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)

    parcelas = db.relationship(
        "Recebimento",
        backref="recorrencia",
        lazy="dynamic",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "frequencia": self.frequencia,
            "valor_parcela": str(self.valor_parcela) if self.valor_parcela else None,
            "total_parcelas": self.total_parcelas,
            "data_inicio": self.data_inicio.isoformat() if self.data_inicio else None,
            "data_fim": self.data_fim.isoformat() if self.data_fim else None,
            "ativo": self.ativo,
            "descricao": self.descricao,
            "cliente_id": self.cliente_id,
            "caso_id": self.caso_id,
            "categoria": self.categoria,
        }


class Recebimento(db.Model):
    __tablename__ = "recebimento"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_recebimento_tenant_id"), nullable=True
    )
    descricao = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    # DEPRECATED: mantido por compat retroativa (codigo antigo + dashboard
    # antigo). Em ambiente novo, usar data_vencimento e data_pagamento. O
    # endpoint mantem ambos sincronizados durante a transicao.
    data_recebimento = db.Column(db.Date, nullable=True)
    # DEPRECATED: usar `status`. Mantido sincronizado (status="Pago" <=> True).
    recebido = db.Column(db.Boolean, default=False)
    # === Campos adicionados na Fase 1 do Recebimento Robusto ===
    cliente_id = db.Column(
        db.Integer,
        db.ForeignKey("cliente.id", name="fk_recebimento_cliente_id"),
        nullable=True,
        index=True,
    )
    # "Pendente" | "Pago" | "Vencido" | "Cancelado" | "Em Negociacao"
    status = db.Column(db.String(30), nullable=True, default="Pendente", index=True)
    # Data prevista pra receber. Nullable: permite "sem vencimento" (Fase 4).
    data_vencimento = db.Column(db.Date, nullable=True, index=True)
    # Data efetiva do recebimento (preenchida quando status=Pago).
    data_pagamento = db.Column(db.Date, nullable=True)
    categoria = db.Column(db.String(80), nullable=True)
    forma_pagamento = db.Column(db.String(50), nullable=True)
    notas = db.Column(db.Text, nullable=True)
    # Vinculo opcional a uma serie recorrente/parcelada.
    recorrencia_id = db.Column(
        db.Integer,
        db.ForeignKey("recorrencia_recebimento.id", name="fk_recebimento_recorrencia_id"),
        nullable=True,
        index=True,
    )
    # Para PARCELADO: 3 de 12. Para RECORRENTE: numero sequencial.
    numero_parcela = db.Column(db.Integer, nullable=True)
    # === Etapa 6 (pedido do Emerson via WhatsApp) ===
    # Ano de previsao de recebimento — independente de data_vencimento.
    # Util pra precatorio/RPV que demoram anos e o advogado so sabe "deve
    # cair em 2028". Quando o pagamento sai de verdade, vira data_pagamento.
    ano_previsao = db.Column(db.Integer, nullable=True, index=True)
    # Fonte/meio do recebimento. Diferente de "categoria" (natureza do
    # dinheiro: honorario, acordo, consultoria). Opcoes validas:
    # "Diretamente do cliente" | "Precatorio" | "RPV" |
    # "Deposito judicial" | "Acordo extrajudicial" | "Outros".
    tipo_recebimento = db.Column(db.String(50), nullable=True, index=True)
    # === Fim dos campos adicionados ===
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_recebimento_caso_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_recebimento_user_id"), nullable=False
    )
    contrato_id = db.Column(
        db.Integer,
        db.ForeignKey("contrato_honorario.id", name="fk_recebimento_contrato_id"),
        nullable=True,
    )
    # Relationships read-only para o DTO expor cliente_nome/caso_titulo na
    # listagem. overlaps silencia o warning do SQLAlchemy sobre os backrefs
    # ja existentes (Caso.recebimentos_caso/User.recebimentos_registrados).
    cliente = db.relationship("Cliente", foreign_keys=[cliente_id], viewonly=True)
    caso = db.relationship(
        "Caso",
        foreign_keys=[caso_id],
        viewonly=True,
        overlaps="caso_recebimento_associado,recebimentos_caso",
    )
    __table_args__ = (db.Index("ix_recebimento_tenant_created", "tenant_id", "data_recebimento"),)

    def sync_legacy_fields(self):
        """Mantem campos deprecated (data_recebimento, recebido) sincronizados.

        Chamado pelos endpoints antes do commit. Evita drift entre os campos
        novos (status, data_vencimento, data_pagamento) e os antigos enquanto
        existir codigo legado lendo recebido/data_recebimento.
        """
        self.recebido = self.status == "Pago"
        # data_recebimento legado = data_pagamento se pago, senao vencimento.
        self.data_recebimento = self.data_pagamento or self.data_vencimento

    def to_dict(self):
        return {
            "id": self.id,
            "descricao": self.descricao,
            "valor": str(self.valor),
            "status": self.status,
            "data_vencimento": (self.data_vencimento.isoformat() if self.data_vencimento else None),
            "data_pagamento": (self.data_pagamento.isoformat() if self.data_pagamento else None),
            "categoria": self.categoria,
            "forma_pagamento": self.forma_pagamento,
            "notas": self.notas,
            "cliente_id": self.cliente_id,
            "caso_id": self.caso_id,
            "user_id": self.user_id,
            "contrato_id": self.contrato_id,
            "recorrencia_id": self.recorrencia_id,
            "numero_parcela": self.numero_parcela,
            "ano_previsao": self.ano_previsao,
            "tipo_recebimento": self.tipo_recebimento,
            # Deprecated mas devolvidos por compat retroativa.
            "data_recebimento": (
                self.data_recebimento.isoformat() if self.data_recebimento else None
            ),
            "recebido": self.recebido,
        }


class ConfigNFSe(db.Model):
    """Configuracao de emissao de NFS-e por tenant.

    Uma config por tenant (uq em tenant_id). Guarda os dados que vao no
    XML/JSON da nota e o ambiente (sandbox|producao). O certificado A1
    em si NAO eh armazenado aqui nesta fase — `tem_certificado` apenas
    indica se o tenant ja enviou um. Upload de certificado fica pra PR
    de adapter real (Etapa 5.6). Enquanto isso, mock funciona sem.
    """

    __tablename__ = "config_nfse"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_config_nfse_tenant_id"),
        nullable=False,
        unique=True,
        index=True,
    )
    # === Dados do emissor (advogado/escritorio) ===
    # Etapa 5.6.5: app suporta tanto advogado PF (autonomo) quanto PJ
    # (escritorio). Cada tipo usa certificado diferente: e-CPF (PF) ou
    # e-CNPJ (PJ). documento_emissor guarda CPF (11) ou CNPJ (14).
    # "PF" | "PJ". Default "PJ" pra retrocompat com configs antigas que
    # so tinham cnpj_emissor.
    tipo_pessoa_emissor = db.Column(db.String(2), nullable=False, default="PJ")
    documento_emissor = db.Column(db.String(20), nullable=True)
    # DEPRECATED: mantido sincronizado com documento_emissor quando
    # tipo_pessoa_emissor='PJ'. Codigo legado le isso.
    cnpj_emissor = db.Column(db.String(20), nullable=True)
    inscricao_municipal = db.Column(db.String(30), nullable=True)
    razao_social = db.Column(db.String(200), nullable=True)
    municipio = db.Column(db.String(100), nullable=True)
    uf = db.Column(db.String(2), nullable=True)
    # Codigo de servico municipal. Padrao p/ advocacia eh "17.06" (consultoria
    # juridica) ou "17.14" (advocacia). Texto livre pq cada municipio tem o seu.
    codigo_servico = db.Column(db.String(20), nullable=True)
    # "Simples Nacional" | "Lucro Presumido" | "Lucro Real" | "MEI"
    regime_tributario = db.Column(db.String(50), nullable=True)
    # Aliquota ISS em %. Texto livre pq varia por municipio (2 a 5%).
    aliquota_iss = db.Column(db.Numeric(5, 2), nullable=True)
    # Ambiente do gateway: "sandbox" (homologacao) | "producao".
    ambiente = db.Column(db.String(20), nullable=False, default="sandbox")
    # Tipo de gateway/adapter: "mock" (default ate adapter real),
    # "portal_nacional" (gov.br), "focus_nfe", "plugnotas".
    gateway_tipo = db.Column(db.String(30), nullable=False, default="mock")
    # Flag indicando se o tenant ja enviou o certificado A1. Setado
    # automaticamente quando certificado_pfx_encrypted nao e None.
    tem_certificado = db.Column(db.Boolean, nullable=False, default=False)
    # Etapa 5.6.2: storage do certificado A1 (.pfx) criptografado com
    # Fernet usando NFSE_CERT_ENCRYPTION_KEY (env var). LargeBinary cabe
    # arquivos de ate alguns MB (pfx tipico tem 4-10 KB).
    certificado_pfx_encrypted = db.Column(db.LargeBinary, nullable=True)
    certificado_senha_encrypted = db.Column(db.LargeBinary, nullable=True)
    # Metadata extraida do cert no momento do upload (ajuda UI mostrar
    # info ao usuario sem precisar descriptografar tudo de novo).
    certificado_nome_titular = db.Column(db.String(300), nullable=True)
    certificado_valido_ate = db.Column(db.Date, nullable=True)
    # === Etapa 5.6.1: campos para Portal Nacional NFS-e (gov.br) ===
    # URLs base configuraveis pra cada ambiente. Mantidas opcionais
    # porque gateway "mock" nao precisa delas. Defaults indicativos
    # (provaveis) sao aplicados pelo service quando vazias.
    nfse_base_url_homologacao = db.Column(db.String(300), nullable=True)
    nfse_base_url_producao = db.Column(db.String(300), nullable=True)
    # Codigo IBGE do municipio do prestador. Obrigatorio pra montar a
    # DPS conforme o leiaute (Anexo I do manual oficial out/2025).
    codigo_municipio_ibge = db.Column(db.String(10), nullable=True)
    # Numeracao sequencial da DPS — controlada pelo emissor. Comeca em
    # 1 e incrementa a cada emissao bem-sucedida.
    nfse_serie_atual = db.Column(db.Integer, nullable=False, default=1)
    nfse_numero_atual = db.Column(db.Integer, nullable=False, default=0)
    # Etapa 5.6.6.3: contador de eventos. Incrementa a cada pedido de
    # registro de evento bem-sucedido (cancelamento, substituicao etc).
    # Vai pro campo nPedRegEvento do XML (0-999 por tipo de evento).
    nfse_num_evento_atual = db.Column(db.Integer, nullable=False, default=0)
    # === Fim dos campos da Etapa 5.6.1 ===
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo_pessoa_emissor": self.tipo_pessoa_emissor,
            "documento_emissor": self.documento_emissor,
            "cnpj_emissor": self.cnpj_emissor,  # alias deprecated
            "inscricao_municipal": self.inscricao_municipal,
            "razao_social": self.razao_social,
            "municipio": self.municipio,
            "uf": self.uf,
            "codigo_servico": self.codigo_servico,
            "regime_tributario": self.regime_tributario,
            "aliquota_iss": str(self.aliquota_iss) if self.aliquota_iss is not None else None,
            "ambiente": self.ambiente,
            "gateway_tipo": self.gateway_tipo,
            "tem_certificado": self.tem_certificado,
            "nfse_base_url_homologacao": self.nfse_base_url_homologacao,
            "nfse_base_url_producao": self.nfse_base_url_producao,
            "codigo_municipio_ibge": self.codigo_municipio_ibge,
            "nfse_serie_atual": self.nfse_serie_atual,
            "nfse_numero_atual": self.nfse_numero_atual,
            "nfse_num_evento_atual": self.nfse_num_evento_atual,
            "certificado_nome_titular": self.certificado_nome_titular,
            "certificado_valido_ate": (
                self.certificado_valido_ate.isoformat() if self.certificado_valido_ate else None
            ),
            "configurado": bool(self.documento_emissor and self.codigo_servico),
        }


class EmissaoNFSe(db.Model):
    """Registro de uma emissao de NFS-e (1:N com Recebimento).

    Cada tentativa de emissao gera um registro novo. Permite reemitir
    apos erro mantendo historico auditavel de tentativas e respostas
    do gateway.
    """

    __tablename__ = "emissao_nfse"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_emissao_nfse_tenant_id"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_emissao_nfse_user_id"),
        nullable=False,
    )
    recebimento_id = db.Column(
        db.Integer,
        db.ForeignKey("recebimento.id", name="fk_emissao_nfse_recebimento_id"),
        nullable=False,
        index=True,
    )
    # "Pendente" | "EmProcessamento" | "Autorizada" | "Rejeitada" | "Cancelada"
    status = db.Column(db.String(30), nullable=False, default="Pendente", index=True)
    # ID que o gateway retorna pra rastreio (UUID, ID municipal, etc).
    gateway_id = db.Column(db.String(120), nullable=True)
    # Tipo de gateway usado nesta emissao (mock, portal_nacional, etc).
    # Copiado de ConfigNFSe no momento da emissao pra preservar historico
    # mesmo se a config mudar depois.
    gateway_tipo = db.Column(db.String(30), nullable=False, default="mock")
    numero_nfse = db.Column(db.String(40), nullable=True)
    serie = db.Column(db.String(20), nullable=True)
    codigo_verificacao = db.Column(db.String(60), nullable=True)
    xml_url = db.Column(db.String(500), nullable=True)
    pdf_url = db.Column(db.String(500), nullable=True)
    mensagem_erro = db.Column(db.Text, nullable=True)
    tentativas = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (db.Index("ix_emissao_nfse_recebimento_status", "recebimento_id", "status"),)

    def to_dict(self):
        return {
            "id": self.id,
            "recebimento_id": self.recebimento_id,
            "status": self.status,
            "gateway_id": self.gateway_id,
            "gateway_tipo": self.gateway_tipo,
            "numero_nfse": self.numero_nfse,
            "serie": self.serie,
            "codigo_verificacao": self.codigo_verificacao,
            "xml_url": self.xml_url,
            "pdf_url": self.pdf_url,
            "mensagem_erro": self.mensagem_erro,
            "tentativas": self.tentativas,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
