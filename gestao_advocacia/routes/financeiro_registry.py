from flask_restx import Namespace, fields

from .contratos import register_contratos_routes
from .despesas import register_despesas_routes
from .recebimentos import register_recebimentos_routes


def register_financeiro_api(app, api, finance_access_required):
    despesas_ns = Namespace("despesas", description="Operacoes de Despesas")
    recebimentos_ns = Namespace("recebimentos", description="Operacoes de Recebimentos")
    contratos_ns = Namespace(
        "contratos", description="Operacoes relacionadas aos Contratos de Honorarios"
    )

    api.add_namespace(despesas_ns)
    api.add_namespace(recebimentos_ns)
    api.add_namespace(contratos_ns)

    despesa_input_model_dto = despesas_ns.model(
        "DespesaInput",
        {
            "descricao": fields.String(required=True, description="Descricao da despesa"),
            "valor": fields.Float(required=True, description="Valor (ex: 150.75)", min=0.01),
            "data_vencimento": fields.Date(description="Data de vencimento (opcional)"),
            "data_pagamento": fields.Date(description="Data efetiva do pagamento"),
            "status": fields.String(
                description='"Pendente"|"Pago"|"Vencido"|"Cancelado"|"Em Negociacao"',
                enum=["Pendente", "Pago", "Vencido", "Cancelado", "Em Negociacao"],
            ),
            "categoria": fields.String(),
            "forma_pagamento": fields.String(),
            "notas": fields.String(),
            "fornecedor": fields.String(description="Loja/prestador (texto livre, opcional)"),
            "cliente_id": fields.Integer(description="Cliente vinculado (para reembolso)"),
            "caso_id": fields.Integer(),
            # Aliases legados retidos por compat com clients antigos
            "data_despesa": fields.Date(description="[DEPRECATED] use data_vencimento"),
            "pago": fields.Boolean(description='[DEPRECATED] use status=="Pago"'),
        },
    )

    despesa_model_dto = despesas_ns.model(
        "DespesaOutput",
        {
            "id": fields.Integer(readonly=True),
            "descricao": fields.String,
            "valor": fields.String(attribute=lambda x: str(x.valor)),
            "status": fields.String,
            "data_vencimento": fields.Date(dt_format="iso8601"),
            "data_pagamento": fields.Date(dt_format="iso8601"),
            "categoria": fields.String,
            "forma_pagamento": fields.String,
            "notas": fields.String,
            "fornecedor": fields.String,
            "cliente_id": fields.Integer(nullable=True),
            "caso_id": fields.Integer(nullable=True),
            "user_id": fields.Integer,
            "recorrencia_id": fields.Integer(nullable=True),
            "numero_parcela": fields.Integer(nullable=True),
            # Compat retroativa
            "data_despesa": fields.Date(dt_format="iso8601"),
            "pago": fields.Boolean,
        },
    )

    despesa_serie_input_dto = despesas_ns.model(
        "DespesaSerieInput",
        {
            "tipo": fields.String(
                required=True,
                enum=["RECORRENTE", "PARCELADO"],
                description="RECORRENTE (aluguel mensal) ou PARCELADO (compra em N x).",
            ),
            "frequencia": fields.String(enum=["MENSAL", "SEMANAL", "QUINZENAL", "ANUAL"]),
            "valor_parcela": fields.Float(required=True, min=0.01),
            "total_parcelas": fields.Integer(
                description="Obrigatorio se PARCELADO; default 12 se RECORRENTE."
            ),
            "data_inicio": fields.Date(required=True),
            "descricao": fields.String(required=True),
            "categoria": fields.String(),
            "fornecedor": fields.String(),
            "cliente_id": fields.Integer(),
            "caso_id": fields.Integer(),
            "notas": fields.String(),
        },
    )

    despesa_serie_output_dto = despesas_ns.model(
        "DespesaSerieOutput",
        {
            "recorrencia_id": fields.Integer,
            "tipo": fields.String,
            "total_geradas": fields.Integer,
            "parcelas": fields.List(fields.Nested(despesa_model_dto)),
        },
    )

    recebimento_input_model_dto = recebimentos_ns.model(
        "RecebimentoInput",
        {
            "descricao": fields.String(
                required=True, description="Descricao do recebimento/honorario"
            ),
            "valor": fields.Float(
                required=True, description="Valor do recebimento (ex: 1200.50)", min=0.01
            ),
            "data_vencimento": fields.Date(
                description=(
                    "Data de vencimento (YYYY-MM-DD). Opcional desde Fase 4 "
                    "(permite 'sem vencimento')."
                )
            ),
            "data_pagamento": fields.Date(
                description=(
                    "Data em que o valor foi efetivamente recebido (preenche "
                    "automaticamente quando status passa a 'Pago' sem data)."
                )
            ),
            "status": fields.String(
                description=(
                    'Status: "Pendente" | "Pago" | "Vencido" | "Cancelado" | '
                    '"Em Negociacao". Default: "Pendente".'
                ),
                enum=["Pendente", "Pago", "Vencido", "Cancelado", "Em Negociacao"],
            ),
            "categoria": fields.String(description="Categoria do recebimento."),
            "forma_pagamento": fields.String(description="PIX, Boleto, etc."),
            "notas": fields.String(description="Observacoes livres."),
            "cliente_id": fields.Integer(description="ID do cliente vinculado (opcional)."),
            "caso_id": fields.Integer(description="ID do caso vinculado (opcional)."),
            "ano_previsao": fields.Integer(
                description=(
                    "Ano de previsao de recebimento (YYYY). Util para precatorio/"
                    "RPV. Independe de data_vencimento."
                )
            ),
            "tipo_recebimento": fields.String(
                description="Fonte/meio do recebimento.",
                enum=[
                    "Diretamente do cliente",
                    "Precatorio",
                    "RPV",
                    "Deposito judicial",
                    "Acordo extrajudicial",
                    "Outros",
                ],
            ),
            # Aliases retidos por compat com clients antigos (POST/PUT da Fase 0).
            "data_recebimento": fields.Date(
                description=(
                    "[DEPRECATED] Alias de data_pagamento ou data_vencimento. "
                    "Preferir os campos novos."
                )
            ),
            "recebido": fields.Boolean(description='[DEPRECATED] Alias de status=="Pago".'),
        },
    )

    recebimento_model_dto = recebimentos_ns.model(
        "RecebimentoOutput",
        {
            "id": fields.Integer(readonly=True),
            "descricao": fields.String,
            "valor": fields.String(
                attribute=lambda x: str(x.valor),
                description="Valor do recebimento formatado como string",
            ),
            "status": fields.String,
            "data_vencimento": fields.Date(dt_format="iso8601"),
            "data_pagamento": fields.Date(dt_format="iso8601"),
            "categoria": fields.String,
            "forma_pagamento": fields.String,
            "notas": fields.String,
            "cliente_id": fields.Integer(nullable=True),
            "caso_id": fields.Integer(nullable=True),
            "user_id": fields.Integer,
            "recorrencia_id": fields.Integer(nullable=True),
            "numero_parcela": fields.Integer(nullable=True),
            "ano_previsao": fields.Integer(nullable=True),
            "tipo_recebimento": fields.String,
            # Compat retroativa — clientes antigos ainda leem esses campos.
            "data_recebimento": fields.Date(dt_format="iso8601"),
            "recebido": fields.Boolean,
        },
    )

    recebimento_serie_input_dto = recebimentos_ns.model(
        "RecebimentoSerieInput",
        {
            "tipo": fields.String(
                required=True,
                description='"RECORRENTE" (indefinido) ou "PARCELADO" (N fechado).',
                enum=["RECORRENTE", "PARCELADO"],
            ),
            "frequencia": fields.String(
                description='Para RECORRENTE/PARCELADO: "MENSAL"|"SEMANAL"|"QUINZENAL"|"ANUAL".',
                enum=["MENSAL", "SEMANAL", "QUINZENAL", "ANUAL"],
            ),
            "valor_parcela": fields.Float(
                required=True, description="Valor de cada parcela.", min=0.01
            ),
            "total_parcelas": fields.Integer(
                description=(
                    "Numero de parcelas a gerar. Obrigatorio se PARCELADO. "
                    "Para RECORRENTE: opcional (default=12)."
                )
            ),
            "data_inicio": fields.Date(
                required=True, description="Data de vencimento da 1a parcela."
            ),
            "descricao": fields.String(required=True),
            "categoria": fields.String(),
            "cliente_id": fields.Integer(),
            "caso_id": fields.Integer(),
            "notas": fields.String(),
        },
    )

    recebimento_serie_output_dto = recebimentos_ns.model(
        "RecebimentoSerieOutput",
        {
            "recorrencia_id": fields.Integer,
            "tipo": fields.String,
            "total_geradas": fields.Integer,
            "parcelas": fields.List(fields.Nested(recebimento_model_dto)),
        },
    )

    contrato_input_model_dto = contratos_ns.model(
        "ContratoInput",
        {
            "tipo_honorario": fields.String(
                required=True,
                description="Fixo, Exito, Mensal ou Horas",
                enum=["Fixo", "Exito", "Mensal", "Horas"],
            ),
            "valor_total": fields.Float(
                description="Valor total ou Mensal (se aplicavel)", min=0.0
            ),
            "percentual_exito": fields.Float(
                description="Percentual de Exito (%) se aplicavel", min=0.0, max=100.0
            ),
            "data_assinatura": fields.Date(
                description="Data de assinatura do contrato (YYYY-MM-DD)"
            ),
            "status": fields.String(
                description="Status",
                default="Ativo",
                enum=["Ativo", "Finalizado", "Cancelado", "Inadimplente"],
            ),
            "notas_condicoes": fields.String(description="Notas/Condicoes"),
            "caso_id": fields.Integer(required=True, description="ID do caso vinculado"),
            "cliente_id": fields.Integer(required=True, description="ID do cliente"),
        },
    )
    contrato_model_dto = contratos_ns.model(
        "ContratoOutput",
        {
            "id": fields.Integer(readonly=True),
            "tipo_honorario": fields.String,
            "valor_total": fields.String(
                attribute=lambda x: str(x.valor_total) if x.valor_total else None
            ),
            "percentual_exito": fields.String(
                attribute=lambda x: str(x.percentual_exito) if x.percentual_exito else None
            ),
            "data_assinatura": fields.Date(dt_format="iso8601"),
            "status": fields.String,
            "notas_condicoes": fields.String,
            "caso_id": fields.Integer,
            "cliente_id": fields.Integer,
            "user_id": fields.Integer,
        },
    )

    register_despesas_routes(
        app,
        despesas_ns,
        despesa_input_model_dto,
        despesa_model_dto,
        despesa_serie_input_dto,
        despesa_serie_output_dto,
        finance_access_required,
    )

    register_recebimentos_routes(
        app,
        recebimentos_ns,
        recebimento_input_model_dto,
        recebimento_model_dto,
        recebimento_serie_input_dto,
        recebimento_serie_output_dto,
        finance_access_required,
    )

    register_contratos_routes(
        app,
        contratos_ns,
        contrato_input_model_dto,
        contrato_model_dto,
        finance_access_required,
    )
