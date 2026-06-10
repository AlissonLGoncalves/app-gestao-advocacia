"""Modelos editáveis de documentos jurídicos — Epic #9 (#183).

CRUD de templates HTML com placeholders Jinja2 (ex.: {{cliente.nome}})
+ endpoint para renderizar HTML pra um cliente/caso específico.

Modelos com `padrao=True` e `tenant_id=NULL` vêm do seed (fábrica) e ficam
disponíveis pra todos os tenants. Modelos custom têm `tenant_id` e
`padrao=False`. Editar um modelo padrão NÃO atualiza o seed — cria uma
cópia tenant-scoped (clone-on-edit) pra preservar o original.

Renderização: usa `jinja2.Environment` com `autoescape=True` (segurança XSS),
e contexto contém objetos rasos (`cliente`, `caso`, `advogado`) com atributos
Python-style (`{{cliente.nome}}` via `getattr`).
"""

from datetime import datetime

from flask import current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_tenant_id, tenant_scoped
from models import Caso, Cliente, ModeloDocumento, Tenant, User


def register_modelos_routes(modelos_ns):
    @modelos_ns.route("")
    class ModeloListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @modelos_ns.doc(security="jsonWebToken")
        def get(self):
            """Lista modelos disponíveis: os do tenant + os de fábrica (tenant_id NULL)."""
            tenant_id = get_tenant_id()
            modelos = (
                ModeloDocumento.query.filter(
                    db.or_(
                        ModeloDocumento.tenant_id == tenant_id,
                        ModeloDocumento.tenant_id.is_(None),
                    ),
                    ModeloDocumento.ativo.is_(True),
                )
                .order_by(ModeloDocumento.padrao.desc(), ModeloDocumento.titulo.asc())
                .all()
            )
            return [m.to_dict() for m in modelos]

        @jwt_required()
        @tenant_scoped
        @modelos_ns.doc(security="jsonWebToken")
        def post(self):
            """Cria modelo customizado pro tenant. Sempre padrao=False."""
            user_id = get_jwt_identity()
            tenant_id = get_tenant_id()
            data = request.get_json() or {}
            if not data.get("titulo") or not data.get("conteudo_html"):
                return {"message": "titulo e conteudo_html obrigatorios"}, 400

            novo = ModeloDocumento(
                tenant_id=tenant_id,
                user_id=int(user_id),
                titulo=data["titulo"][:200],
                tipo=data.get("tipo", "outro")[:50],
                descricao=data.get("descricao"),
                conteudo_html=data["conteudo_html"],
                variaveis_disponiveis=data.get("variaveis_disponiveis") or [],
                padrao=False,
                ativo=True,
            )
            db.session.add(novo)
            db.session.commit()
            return novo.to_dict(), 201

    @modelos_ns.route("/<int:modelo_id>")
    class ModeloDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @modelos_ns.doc(security="jsonWebToken")
        def get(self, modelo_id):
            modelo = _get_modelo_or_404(modelo_id)
            return modelo.to_dict()

        @jwt_required()
        @tenant_scoped
        @modelos_ns.doc(security="jsonWebToken")
        def put(self, modelo_id):
            """Atualiza modelo. Modelos padrão são clonados pro tenant ao editar
            (clone-on-edit), preservando o original do seed."""
            user_id = get_jwt_identity()
            tenant_id = get_tenant_id()
            modelo = _get_modelo_or_404(modelo_id)
            data = request.get_json() or {}

            # Clone-on-edit: editar modelo padrão (tenant_id=NULL) cria uma
            # cópia tenant-scoped em vez de modificar o original. O cliente
            # recebe o id do clone na resposta.
            if modelo.tenant_id is None and modelo.padrao:
                clone = ModeloDocumento(
                    tenant_id=tenant_id,
                    user_id=int(user_id),
                    titulo=data.get("titulo", modelo.titulo)[:200],
                    tipo=data.get("tipo", modelo.tipo)[:50],
                    descricao=data.get("descricao", modelo.descricao),
                    conteudo_html=data.get("conteudo_html", modelo.conteudo_html),
                    variaveis_disponiveis=data.get(
                        "variaveis_disponiveis", modelo.variaveis_disponiveis or []
                    ),
                    padrao=False,
                    ativo=True,
                )
                db.session.add(clone)
                db.session.commit()
                return clone.to_dict()

            # Custom do tenant: edita in-place
            if "titulo" in data:
                modelo.titulo = data["titulo"][:200]
            if "tipo" in data:
                modelo.tipo = data["tipo"][:50]
            if "descricao" in data:
                modelo.descricao = data["descricao"]
            if "conteudo_html" in data:
                modelo.conteudo_html = data["conteudo_html"]
            if "variaveis_disponiveis" in data:
                modelo.variaveis_disponiveis = data["variaveis_disponiveis"]
            if "ativo" in data:
                modelo.ativo = bool(data["ativo"])
            modelo.atualizado_em = datetime.utcnow()
            db.session.commit()
            return modelo.to_dict()

        @jwt_required()
        @tenant_scoped
        @modelos_ns.doc(security="jsonWebToken")
        def delete(self, modelo_id):
            """Soft-delete (marca ativo=False). Modelos padrão NÃO podem ser
            deletados — só desativados via PUT."""
            modelo = _get_modelo_or_404(modelo_id)
            if modelo.tenant_id is None:
                return {
                    "message": "Modelos padrão não podem ser excluídos. "
                    "Edite-os pra criar uma cópia customizada."
                }, 400
            modelo.ativo = False
            db.session.commit()
            return "", 204

    @modelos_ns.route("/<int:modelo_id>/gerar")
    class ModeloGerarAPI(Resource):
        @jwt_required()
        @modelos_ns.doc(
            security="jsonWebToken",
            description=(
                "Renderiza o modelo HTML substituindo placeholders pelos "
                "dados do cliente/caso. Body: {cliente_id, caso_id?}. "
                "Retorna HTML renderizado (string). Frontend pode usar pra "
                "preview ou imprimir."
            ),
        )
        def post(self, modelo_id):
            user_id = get_jwt_identity()
            user = User.query.get(int(user_id))
            if not user:
                return {"message": "Usuario nao encontrado."}, 401
            tenant_id = user.tenant_id
            modelo = ModeloDocumento.query.filter(
                ModeloDocumento.id == modelo_id,
                db.or_(
                    ModeloDocumento.tenant_id == tenant_id,
                    ModeloDocumento.tenant_id.is_(None),
                ),
            ).first()
            if not modelo or not modelo.ativo:
                return {"message": "Modelo nao encontrado."}, 404

            data = request.get_json() or {}
            cliente_id = data.get("cliente_id")
            caso_id = data.get("caso_id")
            if not cliente_id:
                return {"message": "cliente_id obrigatorio"}, 400

            cliente = Cliente.query.filter_by(id=int(cliente_id), tenant_id=tenant_id).first()
            if not cliente:
                return {"message": "Cliente nao encontrado neste tenant."}, 404

            caso = None
            if caso_id:
                caso = Caso.query.filter_by(id=int(caso_id), tenant_id=tenant_id).first()
                if not caso:
                    return {"message": "Caso nao encontrado neste tenant."}, 404

            tenant = Tenant.query.get(tenant_id) if tenant_id else None

            html_renderizado = _renderizar(modelo, cliente, caso, user, tenant)
            return {
                "html": html_renderizado,
                "modelo_id": modelo.id,
                "modelo_titulo": modelo.titulo,
                "cliente_id": cliente.id,
                "caso_id": caso.id if caso else None,
            }


def _get_modelo_or_404(modelo_id):
    """Busca modelo escopado pelo tenant ou padrão (tenant_id NULL)."""
    tenant_id = get_tenant_id()
    modelo = ModeloDocumento.query.filter(
        ModeloDocumento.id == modelo_id,
        db.or_(
            ModeloDocumento.tenant_id == tenant_id,
            ModeloDocumento.tenant_id.is_(None),
        ),
    ).first()
    if not modelo:
        from flask_restx import abort

        abort(404, "Modelo de documento nao encontrado.")
    return modelo


def _ctx_cliente(cliente):
    """Monta dict-like context do cliente — atributos chave esperados pelos
    placeholders ({{cliente.nome_razao_social}} etc.). Retorna SimpleNamespace
    pra Jinja2 acessar via ponto."""
    from types import SimpleNamespace

    if not cliente:
        return SimpleNamespace()

    # Endereço completo formatado
    partes_end = []
    if cliente.rua:
        partes_end.append(cliente.rua)
    if cliente.numero:
        partes_end.append(f"nº {cliente.numero}")
    if cliente.bairro:
        partes_end.append(f"bairro {cliente.bairro}")
    if cliente.cep:
        partes_end.append(f"CEP {cliente.cep}")
    endereco_completo = ", ".join(partes_end) if partes_end else "[endereço não informado]"

    return SimpleNamespace(
        nome_razao_social=cliente.nome_razao_social or "",
        cpf_cnpj=cliente.cpf_cnpj or "",
        tipo_pessoa=cliente.tipo_pessoa or "PF",
        rg=cliente.rg or "[RG]",
        estado_civil=cliente.estado_civil or "[estado civil]",
        profissao=cliente.profissao or "[profissão]",
        nacionalidade=cliente.nacionalidade or "Brasileiro(a)",
        responsavel_nome=cliente.responsavel_nome or "[representante legal]",
        responsavel_cpf=cliente.responsavel_cpf or "[CPF representante]",
        responsavel_cargo=cliente.responsavel_cargo or "Sócio Administrador",
        endereco_completo=endereco_completo,
        cidade=cliente.cidade or "[cidade]",
        estado=cliente.estado or "[estado]",
        email=cliente.email or "",
        telefone=cliente.telefone or "",
    )


def _ctx_caso(caso):
    from types import SimpleNamespace

    if not caso:
        return SimpleNamespace(
            titulo="[título do caso]",
            numero_processo="[número do processo]",
        )
    return SimpleNamespace(
        titulo=caso.titulo or "",
        numero_processo=caso.numero_processo or "",
        descricao=caso.descricao or "",
    )


def _ctx_advogado(user, tenant):
    from types import SimpleNamespace

    nome = (user.nome_completo or user.username) if user else "[advogado]"
    return SimpleNamespace(
        nome=nome,
        oab=(
            (user.numero_oab or (tenant.numero_oab_escritorio if tenant else "") or "[OAB]")
            if user
            else "[OAB]"
        ),
        uf_oab=(
            (user.sigla_oab_tribunal or (tenant.sigla_oab_escritorio if tenant else "") or "PR")
            if user
            else "PR"
        ),
        email=user.email if user else "",
    )


def _renderizar(modelo, cliente, caso, user, tenant):
    """Renderiza o template HTML com Jinja2 sandboxed + autoescape.

    Importante: usamos `autoescape=True` pra impedir injeção XSS via campos
    do cliente (o user pode ter colocado `<script>` no nome). Como o
    template em si JÁ É HTML (vem do nosso seed ou do editor admin), o
    template autor confia em si mesmo, mas as variáveis devem ser escapadas.
    Trade-off: se o user quiser HTML em uma variável (raro), terá que
    usar `{{ var | safe }}` explicitamente — opção desativada por padrão.

    Sandbox: o `conteudo_html` é editável pelo tenant, então é um template
    user-controlled. `SandboxedEnvironment` bloqueia acesso a atributos
    internos (`__class__`, `__mro__`, etc.) e operações inseguras — fecha
    SSTI sem mudar o comportamento dos templates legítimos (placeholders
    simples + if/for continuam funcionando).
    """
    import locale  # noqa: PLC0415

    from jinja2 import select_autoescape  # noqa: PLC0415
    from jinja2.sandbox import SandboxedEnvironment  # noqa: PLC0415

    env = SandboxedEnvironment(autoescape=select_autoescape(["html", "xml"]))
    try:
        template = env.from_string(modelo.conteudo_html)
    except Exception as e:
        current_app.logger.error(f"Falha ao parsear template do modelo {modelo.id}: {e}")
        return f"<p style='color:red'>Erro ao processar o template: {e}</p>"

    # Data formatada em português
    try:
        locale.setlocale(locale.LC_TIME, "pt_BR.UTF-8")
    except locale.Error:
        try:
            locale.setlocale(locale.LC_TIME, "Portuguese_Brazil")
        except locale.Error:
            pass  # cai no fallback abaixo

    hoje = datetime.now()
    meses_pt = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
    ]
    data_atual = f"{hoje.day} de {meses_pt[hoje.month - 1]} de {hoje.year}"

    contexto = {
        "cliente": _ctx_cliente(cliente),
        "caso": _ctx_caso(caso),
        "advogado": _ctx_advogado(user, tenant),
        "data_atual": data_atual,
        "cidade_local": (cliente.cidade if cliente and cliente.cidade else "[cidade]"),
        "tenant": {
            "nome_escritorio": tenant.nome_escritorio if tenant else "",
        },
    }
    try:
        return template.render(**contexto)
    except Exception as e:
        current_app.logger.error(f"Falha ao renderizar modelo {modelo.id}: {e}")
        return f"<p style='color:red'>Erro ao renderizar: {e}</p>"
