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
            "valor": fields.Float(
                required=True, description="Valor da despesa (ex: 150.75)", min=0.01
            ),
            "data_despesa": fields.Date(
                required=True, description="Data em que a despesa ocorreu (formato YYYY-MM-DD)"
            ),
            "pago": fields.Boolean(description="Indica se a despesa ja foi paga", default=False),
            "caso_id": fields.Integer(
                description="ID do caso ao qual esta despesa esta associada (opcional)"
            ),
        },
    )
    despesa_model_dto = despesas_ns.model(
        "DespesaOutput",
        {
            "id": fields.Integer(readonly=True),
            "descricao": fields.String,
            "valor": fields.String(
                attribute=lambda x: str(x.valor),
                description="Valor da despesa formatado como string",
            ),
            "data_despesa": fields.Date(dt_format="iso8601"),
            "pago": fields.Boolean,
            "caso_id": fields.Integer(nullable=True),
            "user_id": fields.Integer,
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
            "data_recebimento": fields.Date(
                required=True,
                description="Data em que o valor foi ou sera recebido (YYYY-MM-DD)",
            ),
            "recebido": fields.Boolean(
                description="Indica se o valor ja foi efetivamente recebido", default=False
            ),
            "caso_id": fields.Integer(
                description="ID do caso ao qual este recebimento esta associado (opcional)"
            ),
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
            "data_recebimento": fields.Date(dt_format="iso8601"),
            "recebido": fields.Boolean,
            "caso_id": fields.Integer(nullable=True),
            "user_id": fields.Integer,
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
        finance_access_required,
    )

    register_recebimentos_routes(
        app,
        recebimentos_ns,
        recebimento_input_model_dto,
        recebimento_model_dto,
        finance_access_required,
    )

    register_contratos_routes(
        app,
        contratos_ns,
        contrato_input_model_dto,
        contrato_model_dto,
        finance_access_required,
    )
