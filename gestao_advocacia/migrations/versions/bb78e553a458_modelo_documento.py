"""epic_183_modelo_documento

Revision ID: bb78e553a458
Revises: a0e85cd69f97
Create Date: 2026-05-09 19:00:00.000000

Cria tabela `modelo_documento` para Epic #9 (#183) — templates editáveis de
Procuração PF/PJ, Contrato PF/PJ etc. com placeholders Jinja2 renderizados
server-side a partir de dados do cliente/caso.

Os 4 modelos padrão (procuracao_pf, procuracao_pj, contrato_pf, contrato_pj)
são inseridos via data migration nos dois cenários (cada tenant herda).
"""

import sqlalchemy as sa
from alembic import op


revision = "bb78e553a458"
down_revision = "a0e85cd69f97"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "modelo_documento",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_modelo_documento_tenant_id"),
            nullable=True,
        ),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("conteudo_html", sa.Text(), nullable=False),
        sa.Column("variaveis_disponiveis", sa.JSON(), nullable=True),
        sa.Column(
            "padrao",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "ativo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", name="fk_modelo_documento_user_id"),
            nullable=True,
        ),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_modelo_documento_tenant_id", "modelo_documento", ["tenant_id"]
    )
    op.create_index("ix_modelo_documento_tipo", "modelo_documento", ["tipo"])

    # Os 4 modelos padrão. tenant_id=NULL nesses registros: vão funcionar como
    # "fábrica" globalmente disponível pra todos os tenants. CRUDs filtram com
    # `or_(tenant_id == user.tenant_id, tenant_id IS NULL)` no GET.
    from datetime import datetime

    bind = op.get_bind()
    seeds = [
        {
            "titulo": "Procuração — Pessoa Física",
            "tipo": "procuracao_pf",
            "descricao": "Procuração ad judicia para cliente PF",
            "conteudo_html": _PROCURACAO_PF_HTML,
            "variaveis_disponiveis": _VARIAVEIS_CLIENTE_PF + _VARIAVEIS_ADVOGADO,
        },
        {
            "titulo": "Procuração — Pessoa Jurídica",
            "tipo": "procuracao_pj",
            "descricao": "Procuração ad judicia para cliente PJ (com representante)",
            "conteudo_html": _PROCURACAO_PJ_HTML,
            "variaveis_disponiveis": _VARIAVEIS_CLIENTE_PJ + _VARIAVEIS_ADVOGADO,
        },
        {
            "titulo": "Contrato de Honorários — Pessoa Física",
            "tipo": "contrato_pf",
            "descricao": "Contrato de honorários advocatícios para cliente PF",
            "conteudo_html": _CONTRATO_PF_HTML,
            "variaveis_disponiveis": _VARIAVEIS_CLIENTE_PF
            + _VARIAVEIS_ADVOGADO
            + ["caso.titulo", "caso.numero_processo"],
        },
        {
            "titulo": "Contrato de Honorários — Pessoa Jurídica",
            "tipo": "contrato_pj",
            "descricao": "Contrato de honorários advocatícios para cliente PJ",
            "conteudo_html": _CONTRATO_PJ_HTML,
            "variaveis_disponiveis": _VARIAVEIS_CLIENTE_PJ
            + _VARIAVEIS_ADVOGADO
            + ["caso.titulo", "caso.numero_processo"],
        },
    ]
    import json

    now = datetime.utcnow()
    for s in seeds:
        bind.execute(
            sa.text(
                """
                INSERT INTO modelo_documento
                  (tenant_id, titulo, tipo, descricao, conteudo_html,
                   variaveis_disponiveis, padrao, ativo, criado_em, atualizado_em)
                VALUES (NULL, :titulo, :tipo, :descricao, :conteudo_html,
                        :variaveis, true, true, :now, :now)
                """
            ),
            {
                **s,
                "variaveis": json.dumps(s["variaveis_disponiveis"]),
                "now": now,
            },
        )


def downgrade():
    op.drop_index("ix_modelo_documento_tipo", table_name="modelo_documento")
    op.drop_index("ix_modelo_documento_tenant_id", table_name="modelo_documento")
    op.drop_table("modelo_documento")


# ─── Conteúdo dos modelos padrão ─────────────────────────────────────────────
# HTML simples + placeholders Jinja2. Cada placeholder é resolvido pelo
# backend ao renderizar (POST /modelos/{id}/gerar). Variáveis disponíveis:
#   - cliente.nome_razao_social, cliente.cpf_cnpj, cliente.tipo_pessoa
#   - cliente.responsavel_nome, cliente.responsavel_cpf (PJ)
#   - cliente.endereco_completo, cliente.cidade, cliente.estado
#   - advogado.nome, advogado.oab, advogado.uf_oab
#   - caso.titulo, caso.numero_processo
#   - data_atual, cidade_local

_VARIAVEIS_CLIENTE_PF = [
    "cliente.nome_razao_social",
    "cliente.cpf_cnpj",
    "cliente.rg",
    "cliente.estado_civil",
    "cliente.profissao",
    "cliente.nacionalidade",
    "cliente.endereco_completo",
    "cliente.cidade",
    "cliente.estado",
]
_VARIAVEIS_CLIENTE_PJ = [
    "cliente.nome_razao_social",
    "cliente.cpf_cnpj",
    "cliente.responsavel_nome",
    "cliente.responsavel_cpf",
    "cliente.responsavel_cargo",
    "cliente.endereco_completo",
    "cliente.cidade",
    "cliente.estado",
]
_VARIAVEIS_ADVOGADO = [
    "advogado.nome",
    "advogado.oab",
    "advogado.uf_oab",
    "data_atual",
    "cidade_local",
]


_PROCURACAO_PF_HTML = """<h2 style="text-align:center">PROCURAÇÃO AD JUDICIA ET EXTRA</h2>

<p><strong>OUTORGANTE:</strong> {{cliente.nome_razao_social}}, {{cliente.nacionalidade}},
{{cliente.estado_civil}}, {{cliente.profissao}}, portador(a) do RG nº
{{cliente.rg}} e CPF nº {{cliente.cpf_cnpj}}, residente e domiciliado(a) à
{{cliente.endereco_completo}}, {{cliente.cidade}}/{{cliente.estado}}.</p>

<p><strong>OUTORGADO:</strong> {{advogado.nome}}, advogado(a), inscrito(a)
na OAB/{{advogado.uf_oab}} sob o nº {{advogado.oab}}.</p>

<p><strong>PODERES:</strong> O OUTORGANTE confere ao OUTORGADO os poderes da
cláusula <em>ad judicia et extra</em> para o foro em geral, podendo propor
qualquer ação contra qualquer pessoa, defender-se em qualquer processo,
juízo, instância ou tribunal, podendo ainda transigir, desistir, renunciar,
firmar compromissos, dar e receber quitação, fazer acordos, receber valores,
substabelecer com ou sem reservas, e praticar todos os demais atos
necessários ao bom e fiel cumprimento deste mandato.</p>

<p style="margin-top:2em">{{cidade_local}}, {{data_atual}}.</p>

<p style="margin-top:4em">_____________________________________________<br>
{{cliente.nome_razao_social}}<br>
CPF: {{cliente.cpf_cnpj}}</p>
"""


_PROCURACAO_PJ_HTML = """<h2 style="text-align:center">PROCURAÇÃO AD JUDICIA ET EXTRA</h2>

<p><strong>OUTORGANTE:</strong> {{cliente.nome_razao_social}}, pessoa
jurídica de direito privado, inscrita no CNPJ sob o nº
{{cliente.cpf_cnpj}}, com sede à {{cliente.endereco_completo}},
{{cliente.cidade}}/{{cliente.estado}}, neste ato representada por seu(sua)
{{cliente.responsavel_cargo}}, {{cliente.responsavel_nome}}, portador(a)
do CPF nº {{cliente.responsavel_cpf}}.</p>

<p><strong>OUTORGADO:</strong> {{advogado.nome}}, advogado(a), inscrito(a)
na OAB/{{advogado.uf_oab}} sob o nº {{advogado.oab}}.</p>

<p><strong>PODERES:</strong> O OUTORGANTE confere ao OUTORGADO os poderes da
cláusula <em>ad judicia et extra</em> para o foro em geral, podendo propor
qualquer ação, defender-se em qualquer processo, transigir, desistir,
renunciar, firmar compromissos, dar e receber quitação, fazer acordos,
receber valores, substabelecer com ou sem reservas, e praticar todos os
demais atos necessários ao bom e fiel cumprimento deste mandato.</p>

<p style="margin-top:2em">{{cidade_local}}, {{data_atual}}.</p>

<p style="margin-top:4em">_____________________________________________<br>
{{cliente.nome_razao_social}}<br>
CNPJ: {{cliente.cpf_cnpj}}<br>
Por: {{cliente.responsavel_nome}} ({{cliente.responsavel_cargo}})</p>
"""


_CONTRATO_PF_HTML = """<h2 style="text-align:center">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h2>

<p><strong>CONTRATANTE:</strong> {{cliente.nome_razao_social}},
{{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}},
inscrito(a) no CPF nº {{cliente.cpf_cnpj}}, residente à
{{cliente.endereco_completo}}, {{cliente.cidade}}/{{cliente.estado}}.</p>

<p><strong>CONTRATADO:</strong> {{advogado.nome}}, advogado(a) inscrito(a)
na OAB/{{advogado.uf_oab}} sob o nº {{advogado.oab}}.</p>

<p><strong>OBJETO:</strong> Prestação de serviços advocatícios para
patrocínio do caso <em>{{caso.titulo}}</em>, processo nº
{{caso.numero_processo}}, em todas as suas fases, instâncias e recursos.</p>

<p><strong>HONORÁRIOS:</strong> [Edite este campo no editor para
especificar os valores e a forma de pagamento. Exemplos: honorários fixos,
percentual sobre o êxito, mensalidade etc.]</p>

<p><strong>DESPESAS:</strong> Custas processuais, peritos e demais despesas
correrão por conta do(a) CONTRATANTE.</p>

<p><strong>VIGÊNCIA:</strong> O presente contrato vigora a partir da
assinatura até o trânsito em julgado da decisão final, ressalvados os
recursos cabíveis.</p>

<p style="margin-top:2em">{{cidade_local}}, {{data_atual}}.</p>

<p style="margin-top:4em">_____________________________________________<br>
{{cliente.nome_razao_social}} (CONTRATANTE)</p>

<p style="margin-top:2em">_____________________________________________<br>
{{advogado.nome}} (CONTRATADO)<br>
OAB/{{advogado.uf_oab}} {{advogado.oab}}</p>
"""


_CONTRATO_PJ_HTML = """<h2 style="text-align:center">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h2>

<p><strong>CONTRATANTE:</strong> {{cliente.nome_razao_social}}, pessoa
jurídica inscrita no CNPJ sob o nº {{cliente.cpf_cnpj}}, com sede à
{{cliente.endereco_completo}}, {{cliente.cidade}}/{{cliente.estado}},
representada por {{cliente.responsavel_nome}}, {{cliente.responsavel_cargo}},
CPF nº {{cliente.responsavel_cpf}}.</p>

<p><strong>CONTRATADO:</strong> {{advogado.nome}}, advogado(a) inscrito(a)
na OAB/{{advogado.uf_oab}} sob o nº {{advogado.oab}}.</p>

<p><strong>OBJETO:</strong> Prestação de serviços advocatícios no caso
<em>{{caso.titulo}}</em>, processo nº {{caso.numero_processo}}, em todas as
suas fases, instâncias e recursos cabíveis.</p>

<p><strong>HONORÁRIOS:</strong> [Edite este campo no editor para especificar
valores. Sugestões: fixo, percentual de êxito, mensalidade.]</p>

<p><strong>DESPESAS:</strong> Custas processuais, peritos e demais
desembolsos correm por conta da CONTRATANTE, mediante apresentação dos
respectivos comprovantes.</p>

<p><strong>VIGÊNCIA:</strong> Inicia-se na assinatura e vai até o trânsito
em julgado da decisão final, ressalvados os recursos cabíveis.</p>

<p style="margin-top:2em">{{cidade_local}}, {{data_atual}}.</p>

<p style="margin-top:4em">_____________________________________________<br>
{{cliente.nome_razao_social}} (CONTRATANTE)<br>
Por: {{cliente.responsavel_nome}} ({{cliente.responsavel_cargo}})</p>

<p style="margin-top:2em">_____________________________________________<br>
{{advogado.nome}} (CONTRATADO)<br>
OAB/{{advogado.uf_oab}} {{advogado.oab}}</p>
"""
