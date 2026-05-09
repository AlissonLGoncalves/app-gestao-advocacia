from datetime import datetime, timedelta

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from cnj_service import consultar_processo_cnj
from djen_service import DjenAPIError, DjenRateLimitError
from djen_tasks import (
    _consultar_processo_com_fallback,
    _inferir_sigla_tribunal_por_numero_processo,
    _salvar_publicacao,
)
from extensions import db
from gemini_service import get_gemini_client
from gemini_service import is_enabled as gemini_is_enabled
from helpers import get_item_or_404, get_tenant_id, query_for_tenant, tenant_scoped
from models import (
    Caso,
    Cliente,
    ContratoHonorario,
    Documento,
    MovimentacaoCNJ,
    ProcuracaoAnalise,
    PublicacaoDJEN,
    TarefaPrazo,
    User,
    log_audit,
)
from ocr_service import extract_case_data_from_file
from utils.oab_match import (
    identificar_cliente_no_processo,
    oab_do_tenant,
    parsear_polos_datajud,
)


def register_casos_routes(
    app, casos_ns, caso_input_model_dto, caso_model_dto, movimentacao_cnj_output_model_dto
):
    def _normalizar_data_yyyy_mm_dd(valor):
        if not valor:
            return ""
        texto = str(valor).strip()
        if len(texto) >= 10 and texto[4:5] == "-" and texto[7:8] == "-":
            return texto[:10]
        digitos = "".join(ch for ch in texto if ch.isdigit())
        if len(digitos) >= 8:
            return f"{digitos[0:4]}-{digitos[4:6]}-{digitos[6:8]}"
        return ""

    def _preencher_caso_from_data(caso, data):
        """Helper para preencher campos do caso a partir dos dados recebidos."""
        caso.titulo = data.get("titulo", caso.titulo)
        caso.status = data.get("status", caso.status)
        caso.tipo_acao = data.get("tipo_acao", caso.tipo_acao)
        caso.area_direito = data.get("area_direito", caso.area_direito)
        caso.fase_processual = data.get("fase_processual", caso.fase_processual)
        caso.vara_juizo = data.get("vara_juizo", caso.vara_juizo)
        caso.comarca = data.get("comarca", caso.comarca)
        caso.instancia = data.get("instancia", caso.instancia)
        caso.parte_contraria = data.get("parte_contraria", caso.parte_contraria)
        caso.adv_parte_contraria = data.get("adv_parte_contraria", caso.adv_parte_contraria)
        vc = data.get("valor_causa")
        if vc is not None:
            try:
                caso.valor_causa = float(vc) if vc != "" else None
            except (ValueError, TypeError):
                pass
        dd = data.get("data_distribuicao")
        if dd:
            try:
                caso.data_distribuicao = datetime.strptime(dd, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                pass
        elif dd == "" or dd is None:
            caso.data_distribuicao = None
        caso.notas_caso = data.get("notas_caso", caso.notas_caso)
        return caso

    @casos_ns.route("/extrair-eventos-ia")
    class CasoExtrairEventosIAAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @casos_ns.doc(
            security="jsonWebToken",
            description=(
                "Extrai eventos juridicos (audiencias, prazos de contestacao, recursos, "
                "embargos) de um PDF/imagem via Gemini. Retorna lista estruturada para o "
                "usuario selecionar quais criar como eventos na agenda."
            ),
        )
        def post(self):
            from eventos_extractor_service import extrair_eventos

            arquivo = request.files.get("documento") or request.files.get("file")
            if not arquivo or not getattr(arquivo, "filename", ""):
                return {"message": 'Nenhum arquivo enviado. Use o campo "documento".'}, 400

            contexto = {
                "data_distribuicao": (request.form.get("data_distribuicao") or "").strip(),
                "tipo_acao": (request.form.get("tipo_acao") or "").strip(),
                "vara_juizo": (request.form.get("vara_juizo") or "").strip(),
            }

            resultado = extrair_eventos(arquivo, contexto=contexto)

            if not resultado.get("ok"):
                code = resultado.get("code", "")
                if code == "rate_limit":
                    status = 429
                elif code in ("ai_overloaded", "ai_disabled", "ai_unavailable"):
                    status = 503
                elif code in ("no_file", "parse_error"):
                    status = 400
                else:
                    status = 502
                return {
                    "message": resultado.get("error", "Falha ao extrair eventos."),
                    "code": code,
                }, status

            return {
                "message": f"{len(resultado['eventos'])} evento(s) detectado(s).",
                "eventos": resultado["eventos"],
            }, 200

    @casos_ns.route("/extrair-eventos-de-documento/<int:documento_id>")
    class CasoExtrairEventosDeDocumentoAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @casos_ns.doc(
            security="jsonWebToken",
            description=(
                "Extrai eventos juridicos de um Documento JA ANEXADO ao caso "
                "(sem precisar fazer re-upload). Le o arquivo do storage e "
                "passa para o extrator de eventos."
            ),
        )
        def post(self, documento_id):
            from werkzeug.datastructures import FileStorage

            from eventos_extractor_service import extrair_eventos

            tenant_id = get_tenant_id()
            documento = Documento.query.filter_by(id=documento_id, tenant_id=tenant_id).first()
            if not documento:
                return {"message": "Documento não encontrado neste tenant."}, 404

            # Le o arquivo do storage (caminho local em produção)
            try:
                from os.path import exists

                if not documento.path_arquivo or not exists(documento.path_arquivo):
                    return {
                        "message": "Arquivo físico do documento não encontrado no storage."
                    }, 404
                with open(documento.path_arquivo, "rb") as fh:
                    conteudo = fh.read()
                from io import BytesIO

                file_storage = FileStorage(
                    stream=BytesIO(conteudo),
                    filename=documento.nome_arquivo or f"documento-{documento_id}.pdf",
                )
            except Exception as exc:
                app.logger.error("Erro lendo documento %s: %s", documento_id, exc)
                return {"message": "Falha ao ler arquivo do documento."}, 500

            # Contexto opcional via query params (se Caso vinculado)
            contexto = {}
            if documento.caso_id:
                caso = Caso.query.filter_by(id=documento.caso_id, tenant_id=tenant_id).first()
                if caso:
                    contexto = {
                        "data_distribuicao": (
                            caso.data_distribuicao.isoformat() if caso.data_distribuicao else ""
                        ),
                        "tipo_acao": caso.tipo_acao or "",
                        "vara_juizo": caso.vara_juizo or "",
                    }

            resultado = extrair_eventos(file_storage, contexto=contexto)
            if not resultado.get("ok"):
                code = resultado.get("code", "")
                if code == "rate_limit":
                    status = 429
                elif code in ("ai_overloaded", "ai_disabled", "ai_unavailable"):
                    status = 503
                elif code in ("no_file", "parse_error"):
                    status = 400
                else:
                    status = 502
                return {
                    "message": resultado.get("error", "Falha ao extrair eventos."),
                    "code": code,
                }, status

            return {
                "message": f"{len(resultado['eventos'])} evento(s) detectado(s).",
                "eventos": resultado["eventos"],
                "documento": {
                    "id": documento.id,
                    "nome_arquivo": documento.nome_arquivo,
                },
            }, 200

    @casos_ns.route("/leitura-peticao")
    class CasoLeituraPeticaoAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @casos_ns.doc(
            security="jsonWebToken",
            description="Extrai dados da petição para auto-preenchimento do caso.",
        )
        def post(self):
            arquivo = request.files.get("documento") or request.files.get("file")
            if not arquivo or not getattr(arquivo, "filename", ""):
                return {
                    "message": 'Nenhum arquivo enviado. Use o campo "documento" (ou "file").'
                }, 400

            resultado = extract_case_data_from_file(arquivo.stream, arquivo.filename)
            if not isinstance(resultado, dict):
                return {"message": "Falha ao processar arquivo enviado."}, 500

            if resultado.get("error"):
                return {
                    "message": resultado.get("error") or "Falha ao extrair dados da petição.",
                    "dados": None,
                }, 400

            # texto_extraido vai junto para o frontend persistir como .md
            # vinculado ao caso (~50 KB vs ~5 MB do PDF original).
            texto_extraido = (resultado.get("texto_extraido") or "").strip()
            return {
                "message": "Leitura da petição concluída.",
                "dados": {
                    "numero_processo": (resultado.get("numero_processo") or "").strip(),
                    "valor_causa": resultado.get("valor_causa"),
                    "titulo": (resultado.get("titulo") or "").strip(),
                    "resumo_fatos": (resultado.get("resumo_fatos") or "").strip(),
                    "parte_contraria": (resultado.get("parte_contraria") or "").strip(),
                    "vara_juizo": (resultado.get("vara_juizo") or "").strip(),
                    "comarca": (resultado.get("comarca") or "").strip(),
                    "instancia": (resultado.get("instancia") or "").strip(),
                    "tipo_acao": (resultado.get("tipo_acao") or "").strip(),
                    "fase_processual": (resultado.get("fase_processual") or "").strip(),
                    "data_distribuicao": _normalizar_data_yyyy_mm_dd(
                        resultado.get("data_distribuicao")
                    ),
                    "fonte": resultado.get("fonte") or "OCR",
                },
                "texto_extraido": texto_extraido,
                "nome_arquivo_original": arquivo.filename,
            }, 200

    @casos_ns.route("/buscar-processo-local")
    class CasoBuscarProcessoLocalAPI(Resource):
        @jwt_required()
        @casos_ns.doc(
            security="jsonWebToken",
            description=(
                "Busca um processo dentro do tenant (Caso cadastrado e/ou "
                "Publicacoes DJEN) por numero_processo. Antes de cair no "
                "DataJud (que tem cobertura limitada em 2a instancia/JF), "
                "verifica se ja existe localmente."
            ),
        )
        @casos_ns.param("numero", "Numero do processo (com ou sem mascara)")
        def get(self):
            from helpers import get_tenant_id
            from models import Caso, PublicacaoDJEN

            user_id = get_jwt_identity()
            numero = (request.args.get("numero") or "").strip()
            if not numero:
                return {"message": "Informe o número do processo."}, 400

            tenant_id = get_tenant_id()
            digitos = "".join(filter(str.isdigit, numero))

            # Casos: match exato (com mascara) OU match por digitos
            casos_query = Caso.query.filter(Caso.tenant_id == tenant_id)
            if digitos:
                # Compara apenas digitos pra casar com/sem mascara
                from sqlalchemy import func

                casos = (
                    casos_query.filter(
                        func.regexp_replace(Caso.numero_processo, "[^0-9]", "", "g").contains(
                            digitos
                        )
                    )
                    .limit(20)
                    .all()
                )
            else:
                casos = (
                    casos_query.filter(Caso.numero_processo.ilike(f"%{numero}%")).limit(20).all()
                )

            casos_out = [
                {
                    "id": c.id,
                    "titulo": c.titulo,
                    "numero_processo": c.numero_processo,
                    "status": c.status,
                    "tipo_acao": c.tipo_acao,
                    "vara_juizo": c.vara_juizo,
                    "cliente_id": c.cliente_id,
                    "cliente_nome": (
                        c.cliente.nome_razao_social if getattr(c, "cliente", None) else None
                    ),
                }
                for c in casos
            ]

            # Publicacoes DJEN: match por digitos
            pubs_query = PublicacaoDJEN.query.filter(
                PublicacaoDJEN.tenant_id == tenant_id, PublicacaoDJEN.ativo.is_(True)
            )
            if digitos:
                from sqlalchemy import func

                pubs = (
                    pubs_query.filter(
                        func.regexp_replace(
                            PublicacaoDJEN.numero_processo, "[^0-9]", "", "g"
                        ).contains(digitos)
                    )
                    .order_by(PublicacaoDJEN.data_disponibilizacao.desc())
                    .limit(10)
                    .all()
                )
            else:
                pubs = []

            pubs_out = [
                {
                    "id": p.id,
                    "numero_processo": p.numero_processo,
                    "numero_processo_mascara": p.numero_processo_mascara,
                    "sigla_tribunal": p.sigla_tribunal,
                    "nome_orgao": p.nome_orgao,
                    "tipo_comunicacao": p.tipo_comunicacao,
                    "data_disponibilizacao": (
                        p.data_disponibilizacao.isoformat() if p.data_disponibilizacao else None
                    ),
                    "caso_id": p.caso_id,
                    "lida": p.lida,
                }
                for p in pubs
            ]

            app.logger.info(
                "buscar_processo_local user=%s numero=%s casos=%d pubs=%d",
                user_id,
                numero,
                len(casos_out),
                len(pubs_out),
            )

            return {
                "numero_consultado": numero,
                "casos": casos_out,
                "publicacoes": pubs_out,
                "total_local": len(casos_out) + len(pubs_out),
            }, 200

    @casos_ns.route("/importar-cnjs")
    class CasoImportarCNJsAPI(Resource):
        """Epic #5: triagem em lote de CNJs (paste de ate 40 numeros).

        Inspirado no fluxo "Busca de processo automatica > Pelo numero CNJ"
        do Astrea, que aceita varios CNJs separados por virgula. Aqui retornamos
        o status de cada um para que o usuario decida quais adicionar/buscar
        em seguida (a busca real fica para Epic #12).
        """

        MAX_CNJS_POR_REQUISICAO = 40

        @jwt_required()
        @tenant_scoped
        @casos_ns.doc(
            security="jsonWebToken",
            description=(
                "Triagem de varios CNJs de uma vez. Aceita ate 40 numeros por "
                "requisicao. Para cada CNJ retorna status: valido | invalido | "
                "duplicado (ja existe Caso no tenant). Nao cria casos — apenas "
                "informa o status para o usuario decidir o proximo passo."
            ),
        )
        def post(self):
            from utils.cnj import (  # noqa: PLC0415
                CNJ_REGEX_STRICT,
                somente_digitos_cnj,
                validar_dv_cnj,
            )

            data = request.get_json(silent=True) or {}
            cnjs_brutos = data.get("cnjs")
            if not isinstance(cnjs_brutos, list):
                return {
                    "message": (
                        "Campo 'cnjs' deve ser uma lista de strings. "
                        "Envie ate 40 numeros CNJ por requisicao."
                    ),
                    "code": "invalid_payload",
                }, 400

            if len(cnjs_brutos) == 0:
                return {
                    "message": "Lista vazia. Envie pelo menos um numero CNJ.",
                    "code": "empty_list",
                }, 400

            if len(cnjs_brutos) > self.MAX_CNJS_POR_REQUISICAO:
                return {
                    "message": (
                        f"Maximo de {self.MAX_CNJS_POR_REQUISICAO} CNJs por requisicao. "
                        f"Recebidos: {len(cnjs_brutos)}."
                    ),
                    "code": "too_many",
                }, 400

            tenant_id = get_tenant_id()
            resultados = []
            stats = {"valido": 0, "invalido": 0, "duplicado": 0}
            cnjs_vistos_neste_lote: set[str] = set()

            for cnj_input in cnjs_brutos:
                if not isinstance(cnj_input, str):
                    resultados.append(
                        {
                            "cnj_input": str(cnj_input),
                            "cnj_normalizado": None,
                            "status": "invalido",
                            "motivo": "tipo_invalido",
                            "caso_id": None,
                        }
                    )
                    stats["invalido"] += 1
                    continue

                # Tenta extrair numero formatado ou de digitos puros
                cnj_strip = cnj_input.strip()
                cnj_digits = somente_digitos_cnj(cnj_strip)
                if len(cnj_digits) != 20:
                    resultados.append(
                        {
                            "cnj_input": cnj_strip,
                            "cnj_normalizado": None,
                            "status": "invalido",
                            "motivo": "tamanho_invalido",
                            "caso_id": None,
                        }
                    )
                    stats["invalido"] += 1
                    continue

                cnj_canonico = (
                    f"{cnj_digits[0:7]}-{cnj_digits[7:9]}.{cnj_digits[9:13]}."
                    f"{cnj_digits[13:14]}.{cnj_digits[14:16]}.{cnj_digits[16:20]}"
                )

                if not CNJ_REGEX_STRICT.match(cnj_canonico):
                    resultados.append(
                        {
                            "cnj_input": cnj_strip,
                            "cnj_normalizado": None,
                            "status": "invalido",
                            "motivo": "formato_invalido",
                            "caso_id": None,
                        }
                    )
                    stats["invalido"] += 1
                    continue

                if not validar_dv_cnj(cnj_canonico):
                    resultados.append(
                        {
                            "cnj_input": cnj_strip,
                            "cnj_normalizado": cnj_canonico,
                            "status": "invalido",
                            "motivo": "dv_invalido",
                            "caso_id": None,
                        }
                    )
                    stats["invalido"] += 1
                    continue

                # Duplicado dentro do mesmo payload
                if cnj_canonico in cnjs_vistos_neste_lote:
                    resultados.append(
                        {
                            "cnj_input": cnj_strip,
                            "cnj_normalizado": cnj_canonico,
                            "status": "duplicado",
                            "motivo": "duplicado_no_lote",
                            "caso_id": None,
                        }
                    )
                    stats["duplicado"] += 1
                    continue
                cnjs_vistos_neste_lote.add(cnj_canonico)

                # Duplicado em relacao ao tenant
                caso_existente = (
                    Caso.query.filter_by(tenant_id=tenant_id, numero_processo=cnj_canonico)
                    .order_by(Caso.id.asc())
                    .first()
                )
                if caso_existente:
                    resultados.append(
                        {
                            "cnj_input": cnj_strip,
                            "cnj_normalizado": cnj_canonico,
                            "status": "duplicado",
                            "motivo": "ja_existe_no_tenant",
                            "caso_id": caso_existente.id,
                            "caso_titulo": caso_existente.titulo,
                        }
                    )
                    stats["duplicado"] += 1
                    continue

                # Tudo OK — pronto para usuario decidir buscar/criar
                resultados.append(
                    {
                        "cnj_input": cnj_strip,
                        "cnj_normalizado": cnj_canonico,
                        "status": "valido",
                        "motivo": "pronto_para_adicionar",
                        "caso_id": None,
                    }
                )
                stats["valido"] += 1

            return {
                "total": len(cnjs_brutos),
                "stats": stats,
                "resultados": resultados,
            }, 200

    @casos_ns.route("/buscar-cnj")
    class CasoBuscarCNJOnDemandAPI(Resource):
        """Epic #12 (#186): busca on-demand de processo a partir do CNJ.

        Inspirado no Astrea ('Busca de processo automatica > Pelo numero CNJ'):
        usuario cola o CNJ, sistema detecta o tribunal, escolhe o adapter
        certo e devolve dados estruturados. Frontend pode entao exibir e
        permitir criar Caso a partir do resultado.

        MVP sincrono: retorna direto. Versao com fila/credito fica para
        proxima iteracao.
        """

        @jwt_required()
        @tenant_scoped
        @casos_ns.doc(
            security="jsonWebToken",
            description=(
                "Recebe {cnj} no body, detecta o tribunal e busca dados via "
                "adapter (DataJud no MVP). Retorna dados padronizados ou erro "
                "explicito caso o tribunal nao seja suportado/esteja fora do ar."
            ),
        )
        def post(self):
            from tribunal_adapters import selecionar_adapter  # noqa: PLC0415
            from utils.tribunal_detector import detectar_tribunal_do_cnj  # noqa: PLC0415

            data = request.get_json(silent=True) or {}
            cnj_input = data.get("cnj") or data.get("numero")
            if not cnj_input or not isinstance(cnj_input, str):
                return {
                    "message": "Campo 'cnj' (string) e obrigatorio.",
                    "code": "missing_cnj",
                }, 400

            tribunal_info = detectar_tribunal_do_cnj(cnj_input)
            if tribunal_info.get("erro") == "cnj_formato_invalido":
                return {
                    "message": "Numero CNJ invalido. Esperado 20 digitos.",
                    "code": "cnj_invalido",
                    "tribunal": tribunal_info,
                }, 400

            if not tribunal_info.get("suportado"):
                return {
                    "message": (
                        f"Tribunal {tribunal_info.get('tribunal_codigo')} nao suportado "
                        f"pela busca automatica nesta versao."
                    ),
                    "code": "tribunal_nao_suportado",
                    "tribunal": tribunal_info,
                }, 422

            # Verifica duplicado no tenant
            cnj_normalizado = tribunal_info["cnj_normalizado"]
            tenant_id = get_tenant_id()
            existente = (
                Caso.query.filter_by(tenant_id=tenant_id, numero_processo=cnj_normalizado)
                .order_by(Caso.id.asc())
                .first()
            )

            adapter = selecionar_adapter(tribunal_info)
            if not adapter:
                return {
                    "message": "Nenhum adapter disponivel para este tribunal.",
                    "code": "sem_adapter",
                    "tribunal": tribunal_info,
                }, 422

            app.logger.info(
                "epic_186_busca_cnj_iniciada",
                extra={
                    "event": "epic_186_busca_cnj",
                    "cnj": cnj_normalizado,
                    "tribunal": tribunal_info.get("tribunal_codigo"),
                    "adapter": adapter.nome,
                },
            )

            resultado = adapter.buscar(cnj_normalizado)

            response = {
                "tribunal": tribunal_info,
                "resultado": resultado.to_dict(),
                "ja_cadastrado": {
                    "caso_id": existente.id if existente else None,
                    "titulo": existente.titulo if existente else None,
                }
                if existente
                else None,
            }
            return response, 200 if resultado.sucesso else 200  # 200 mesmo em erro de adapter

    @casos_ns.route("/consulta-publica-cnj")
    class CasoConsultaPublicaCNJAPI(Resource):
        @jwt_required()
        @casos_ns.doc(
            security="jsonWebToken",
            description="Consulta a API do DataJud/TJPR para um CNJ genérico e extrai auto-preenchimentos.",
        )
        @casos_ns.param("numero", "O Número Único de Processo CNJ (20 dígitos recomendados)")
        def get(self):
            user_id = get_jwt_identity()
            numero = request.args.get("numero", "").strip()
            if not numero:
                return {"message": "Informe o número do processo."}, 400

            numero_limpo = "".join(filter(str.isdigit, numero))
            if len(numero_limpo) != 20:
                return {"message": "Informe um número CNJ válido com 20 dígitos."}, 400

            if not app.config.get("CNJ_API_KEY"):
                app.logger.error("Consulta publica CNJ indisponivel: CNJ_API_KEY nao configurada.")
                return {
                    "message": "Servico de consulta CNJ indisponivel no momento. Configuracao de API pendente.",
                    "detalhes": "Defina CNJ_API_KEY no backend para habilitar consultas DataJud.",
                }, 503

            app.logger.info(
                f"Consulta pública live CNJ solicitada por user {user_id} para '{numero}'."
            )
            dados_resposta_cnj, status_http = consultar_processo_cnj(numero)

            if status_http >= 400:
                app.logger.warning(f"Consulta live falhou com status {status_http}")
                msg = "Falha na comunicacao com o Tribunal/DataJud."
                if isinstance(dados_resposta_cnj, dict):
                    msg = dados_resposta_cnj.get("erro") or dados_resposta_cnj.get("message") or msg
                status_retorno = (
                    status_http
                    if status_http in [400, 401, 403, 404, 429, 500, 502, 503, 504]
                    else 500
                )
                return {"message": msg, "detalhes": dados_resposta_cnj}, status_retorno

            hits = dados_resposta_cnj.get("hits", {}).get("hits", [])
            if not hits:
                # Detecta 2a instancia (segmento 4 do CNJ NNNNNNN-DD.AAAA.J.TR.OOOO)
                # Codigos de orgao terminados em 0000 ou >= 9000 sao tipicamente
                # Camaras/Turmas (2a inst). DataJud tem cobertura limitada nesses.
                seg_orgao = numero_limpo[-4:] if len(numero_limpo) == 20 else ""
                eh_2a_instancia = seg_orgao == "0000" or (
                    seg_orgao.isdigit() and int(seg_orgao) >= 9000
                )
                msg_extra = ""
                if eh_2a_instancia:
                    msg_extra = (
                        " Este número parece ser de 2ª instância (Câmara/Turma) — "
                        "a base do DataJud/CNJ tem cobertura limitada nesses casos. "
                        "O processo pode existir; verifique no portal do tribunal "
                        "ou cadastre manualmente."
                    )
                return {
                    "message": (
                        "Nenhum caso encontrado no sistema do Tribunal/CNJ com este número."
                        + msg_extra
                    ),
                    "eh_2a_instancia": eh_2a_instancia,
                }, 404

            dados_processo = hits[0].get("_source", {})

            vara_juizo = dados_processo.get("orgaoJulgador", {}).get("nomeOrgao", "")
            classe_acao = dados_processo.get("classe", {}).get("nome", "")

            instancia_raw = dados_processo.get("grau", "")
            instancia = (
                "1ª Instância"
                if instancia_raw == "G1"
                else "2ª Instância" if instancia_raw == "G2" else instancia_raw
            )

            data_distribuicao = _normalizar_data_yyyy_mm_dd(
                dados_processo.get("dataAjuizamento", "")
            )

            valor_causa = dados_processo.get("valorAcao")
            resumo = dados_processo.get("resumo", "")
            nivel_sigilo = dados_processo.get("nivelSigilo")
            movimento_mais_recente = None
            movimentos = dados_processo.get("movimentos", [])
            if movimentos and isinstance(movimentos, list):
                try:
                    movimentos_ordenados = sorted(
                        movimentos,
                        key=lambda m: m.get("dataHora", ""),
                        reverse=True,
                    )
                    mov0 = movimentos_ordenados[0]
                    movimento_mais_recente = {
                        "data_hora": mov0.get("dataHora"),
                        "descricao": mov0.get("nome")
                        or mov0.get("movimentoNacional", {}).get("descricao"),
                    }
                except Exception:
                    movimento_mais_recente = None

            partes = dados_processo.get("polos", [])
            parte_contraria = ""
            if partes and isinstance(partes, list):
                nomes_partes = []
                for polo in partes:
                    participantes = polo.get("partes", [])
                    for p in participantes:
                        nome = p.get("nome")
                        if nome:
                            nomes_partes.append(nome)
                parte_contraria = ", ".join(nomes_partes[:5])

            # Epic #11: auto-detecta qual polo e cliente cruzando OAB do escritorio
            # com OABs dos advogados de cada parte (vindas do DataJud).
            cliente_detectado = {
                "polo": None,
                "parte": None,
                "motivo": "tenant_sem_oab",
                "oab_match": None,
            }
            try:
                user_obj = User.query.get(int(user_id)) if user_id else None
                tenant_obj = user_obj.tenant if user_obj else None
                oab_escritorio = oab_do_tenant(tenant_obj)
                if oab_escritorio:
                    polos_normalizados = parsear_polos_datajud(partes)
                    cliente_detectado = identificar_cliente_no_processo(
                        polos_normalizados,
                        [oab_escritorio],
                    )
                    # Reduz a parte ao essencial pra UI (nome + tipo)
                    parte_match = cliente_detectado.get("parte")
                    if isinstance(parte_match, dict):
                        cliente_detectado["parte"] = {
                            "nome": parte_match.get("nome"),
                            "tipo": parte_match.get("tipo"),
                        }
            except Exception as exc:
                app.logger.warning(
                    "epic_185_falha_auto_detectar_cliente",
                    extra={"event": "epic_185_falha", "erro": str(exc)},
                )

            return {
                "numero_processo": numero_limpo,
                "classe_acao": classe_acao,
                "vara_juizo": vara_juizo,
                "instancia": instancia,
                "data_distribuicao": data_distribuicao,
                "valor_causa": valor_causa,
                "resumo": resumo,
                "nivel_sigilo": nivel_sigilo,
                "parte_contraria": parte_contraria,
                "movimento_mais_recente": movimento_mais_recente,
                "cliente_detectado": cliente_detectado,
                "raw": dados_processo,
            }, 200

    @casos_ns.route("/")
    class CasoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @casos_ns.marshal_list_with(caso_model_dto)
        @casos_ns.doc(security="jsonWebToken")
        def get(self):
            query = query_for_tenant(Caso).join(Cliente, Caso.cliente_id == Cliente.id)

            search = request.args.get("search", "").strip()
            status = request.args.get("status", "").strip()
            cliente_id = request.args.get("cliente_id", "").strip()
            data_criacao_inicio = request.args.get("data_criacao_inicio", "").strip()
            data_criacao_fim = request.args.get("data_criacao_fim", "").strip()
            data_atualizacao_inicio = request.args.get("data_atualizacao_inicio", "").strip()
            data_atualizacao_fim = request.args.get("data_atualizacao_fim", "").strip()
            area_direito = request.args.get("area_direito", "").strip()
            fase_processual = request.args.get("fase_processual", "").strip()
            vara_juizo = request.args.get("vara_juizo", "").strip()
            instancia = request.args.get("instancia", "").strip()
            valor_causa_min = request.args.get("valor_causa_min", "").strip()
            valor_causa_max = request.args.get("valor_causa_max", "").strip()
            data_distribuicao_inicio = request.args.get("data_distribuicao_inicio", "").strip()
            data_distribuicao_fim = request.args.get("data_distribuicao_fim", "").strip()
            sort_by = request.args.get("sort_by", "data_atualizacao").strip()
            sort_order = request.args.get("sort_order", request.args.get("order", "desc")).strip()

            if search:
                like = f"%{search}%"
                query = query.filter(
                    db.or_(
                        Caso.titulo.ilike(like),
                        Caso.numero_processo.ilike(like),
                        Caso.parte_contraria.ilike(like),
                        Cliente.nome_razao_social.ilike(like),
                    )
                )

            if status:
                query = query.filter(Caso.status == status)

            if cliente_id:
                try:
                    query = query.filter(Caso.cliente_id == int(cliente_id))
                except ValueError:
                    return {"message": "cliente_id inválido."}, 400

            def _parse_date(value, field_name):
                if not value:
                    return None
                try:
                    return datetime.strptime(value, "%Y-%m-%d").date()
                except ValueError:
                    casos_ns.abort(400, f"{field_name} inválida. Use o formato YYYY-MM-DD.")

            criacao_inicio = _parse_date(data_criacao_inicio, "data_criacao_inicio")
            criacao_fim = _parse_date(data_criacao_fim, "data_criacao_fim")
            atualizacao_inicio = _parse_date(data_atualizacao_inicio, "data_atualizacao_inicio")
            atualizacao_fim = _parse_date(data_atualizacao_fim, "data_atualizacao_fim")

            if criacao_inicio:
                query = query.filter(db.func.date(Caso.data_criacao) >= criacao_inicio)
            if criacao_fim:
                query = query.filter(db.func.date(Caso.data_criacao) <= criacao_fim)
            if atualizacao_inicio:
                query = query.filter(db.func.date(Caso.data_atualizacao) >= atualizacao_inicio)
            if atualizacao_fim:
                query = query.filter(db.func.date(Caso.data_atualizacao) <= atualizacao_fim)

            if area_direito:
                query = query.filter(Caso.area_direito == area_direito)
            if fase_processual:
                query = query.filter(Caso.fase_processual == fase_processual)
            if vara_juizo:
                query = query.filter(Caso.vara_juizo.ilike(f"%{vara_juizo}%"))
            if instancia:
                query = query.filter(Caso.instancia == instancia)

            def _parse_float(value, field_name):
                if not value:
                    return None
                try:
                    return float(value)
                except ValueError:
                    casos_ns.abort(400, f"{field_name} inválido. Use um número.")

            vc_min = _parse_float(valor_causa_min, "valor_causa_min")
            vc_max = _parse_float(valor_causa_max, "valor_causa_max")
            if vc_min is not None:
                query = query.filter(Caso.valor_causa >= vc_min)
            if vc_max is not None:
                query = query.filter(Caso.valor_causa <= vc_max)

            distrib_inicio = _parse_date(data_distribuicao_inicio, "data_distribuicao_inicio")
            distrib_fim = _parse_date(data_distribuicao_fim, "data_distribuicao_fim")
            if distrib_inicio:
                query = query.filter(Caso.data_distribuicao >= distrib_inicio)
            if distrib_fim:
                query = query.filter(Caso.data_distribuicao <= distrib_fim)

            allowed_sort_fields = {
                "titulo": Caso.titulo,
                "cliente_nome": Cliente.nome_razao_social,
                "numero_processo": Caso.numero_processo,
                "status": Caso.status,
                "data_criacao": Caso.data_criacao,
                "data_atualizacao": Caso.data_atualizacao,
            }
            sort_column = allowed_sort_fields.get(sort_by, Caso.data_atualizacao)
            sort_order = "asc" if sort_order == "asc" else "desc"
            query = query.order_by(sort_column.asc() if sort_order == "asc" else sort_column.desc())

            casos = query.all()
            return casos

        @jwt_required()
        @tenant_scoped
        @casos_ns.expect(caso_input_model_dto)
        @casos_ns.marshal_with(caso_model_dto, code=201)
        @casos_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not data.get("titulo") or not data.get("cliente_id"):
                return {"message": "Título e cliente_id são obrigatórios para o caso."}, 400

            cliente = query_for_tenant(Cliente).filter_by(id=data["cliente_id"]).first()
            if not cliente:
                return {"message": "Cliente informado não encontrado."}, 404

            num_proc_strip = data.get("numero_processo", "").strip() or None
            if (
                num_proc_strip
                and query_for_tenant(Caso).filter_by(numero_processo=num_proc_strip).first()
            ):
                return {
                    "message": f"Já existe um caso com número de processo '{num_proc_strip}'."
                }, 409

            novo_caso = Caso(
                titulo=data["titulo"],
                numero_processo=num_proc_strip,
                cliente_id=data["cliente_id"],
                user_id=user_id,
                tenant_id=get_tenant_id(),
            )
            _preencher_caso_from_data(novo_caso, data)

            db.session.add(novo_caso)
            db.session.flush()
            log_audit(
                "CREATE",
                "Caso",
                novo_caso.id,
                f"Caso criado: {novo_caso.numero_processo or novo_caso.titulo}",
            )
            db.session.commit()
            app.logger.info(
                f"Novo caso '{novo_caso.titulo}' (ID: {novo_caso.id}) criado para usuário ID {user_id}."
            )
            return novo_caso, 201

    @casos_ns.route("/<int:caso_id_param>")
    @casos_ns.response(404, "Caso não encontrado.")
    @casos_ns.param("caso_id_param", "O ID do caso jurídico")
    class CasoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @casos_ns.marshal_with(caso_model_dto)
        @casos_ns.doc(security="jsonWebToken", description="Obtém os detalhes de um caso jurídico.")
        def get(self, caso_id_param):
            caso = get_item_or_404(Caso, caso_id_param)
            return caso

        @jwt_required()
        @tenant_scoped
        @casos_ns.expect(caso_input_model_dto)
        @casos_ns.marshal_with(caso_model_dto)
        @casos_ns.doc(security="jsonWebToken", description="Atualiza um caso jurídico existente.")
        def put(self, caso_id_param):
            user_id = get_jwt_identity()
            caso = get_item_or_404(Caso, caso_id_param)
            data = request.get_json()
            if not data.get("titulo"):
                return {"message": "Título do caso é obrigatório."}, 400
            novo_numero_processo = data.get("numero_processo", "").strip() or None
            if novo_numero_processo and novo_numero_processo != caso.numero_processo:
                if (
                    query_for_tenant(Caso)
                    .filter(Caso.numero_processo == novo_numero_processo, Caso.id != caso_id_param)
                    .first()
                ):
                    return {
                        "message": f"Outro caso já utiliza o número de processo '{novo_numero_processo}'."
                    }, 409
            caso.numero_processo = novo_numero_processo
            _preencher_caso_from_data(caso, data)
            log_audit(
                "UPDATE",
                "Caso",
                caso.id,
                f"Alteração no caso ({caso.numero_processo or caso.titulo}).",
            )
            db.session.commit()
            app.logger.info(f"Caso ID {caso.id} atualizado pelo usuário ID {user_id}.")
            return caso

        @jwt_required()
        @tenant_scoped
        @casos_ns.response(204, "Caso deletado com sucesso.")
        @casos_ns.doc(security="jsonWebToken", description="Deleta um caso jurídico.")
        def delete(self, caso_id_param):
            user_id = get_jwt_identity()
            caso = get_item_or_404(Caso, caso_id_param)
            log_audit("DELETE", "Caso", caso.id, f"Caso deletado: {caso.titulo}.")
            db.session.delete(caso)
            db.session.commit()
            app.logger.info(
                f"Caso ID {caso.id} ('{caso.titulo}') deletado pelo usuário ID {user_id}."
            )
            return "", 204

    @casos_ns.route("/<int:caso_id>/atualizar-cnj")
    @casos_ns.param("caso_id", "O ID do caso para o qual buscar e registrar atualizações do CNJ")
    class CasoAtualizarCNJAPI(Resource):
        @casos_ns.doc(
            "atualizar_caso_via_cnj_endpoint",
            security="jsonWebToken",
            description="Consulta a API do CNJ para um caso específico, buscando as últimas movimentações e atualizando o status do caso e registrando novas movimentações no sistema local.",
        )
        @jwt_required()
        @tenant_scoped
        def post(self, caso_id):
            user_id_atual = get_jwt_identity()
            caso_para_atualizar = query_for_tenant(Caso).filter_by(id=caso_id).first()

            if not caso_para_atualizar:
                app.logger.info(
                    f"API CNJ: Tentativa de atualizar caso inexistente ID {caso_id} por usuário {user_id_atual}"
                )
                return {"message": f"Caso com ID {caso_id} não encontrado."}, 404

            if (
                not caso_para_atualizar.numero_processo
                or not caso_para_atualizar.numero_processo.strip()
            ):
                app.logger.info(
                    f"API CNJ: Caso {caso_id} não possui número de processo para consulta."
                )
                return {
                    "message": "Este caso não possui um número de processo válido para consulta ao CNJ."
                }, 400

            app.logger.info(
                f"API CNJ: Iniciando atualização para caso ID {caso_id}, processo '{caso_para_atualizar.numero_processo}'. Solicitado por usuário {user_id_atual}."
            )
            dados_resposta_cnj, status_http_cnj = consultar_processo_cnj(
                caso_para_atualizar.numero_processo
            )

            if status_http_cnj >= 400:
                app.logger.error(
                    f"API CNJ: Falha na consulta ao cnj_service para caso {caso_id}. Status: {status_http_cnj}. Erro: {dados_resposta_cnj.get('erro')}"
                )
                response_status_api = (
                    status_http_cnj
                    if status_http_cnj in [400, 401, 403, 404, 429, 500, 502, 503, 504]
                    else 500
                )
                return {
                    "message": "Falha ao consultar o serviço do CNJ.",
                    "details": dados_resposta_cnj.get("erro", "Detalhes do erro indisponíveis."),
                    "cnj_service_response_details": dados_resposta_cnj.get("detalhes_servico_cnj"),
                }, response_status_api

            try:
                hits_cnj_api = dados_resposta_cnj.get("hits", {}).get("hits", [])
                if not hits_cnj_api:
                    app.logger.info(
                        f"API CNJ: Nenhum 'hit' encontrado para '{caso_para_atualizar.numero_processo}' (caso {caso_id})."
                    )
                    caso_para_atualizar.data_ultima_verificacao_cnj = datetime.utcnow()
                    db.session.commit()
                    return {
                        "message": "Nenhum dado de processo encontrado no CNJ para o número fornecido.",
                        "cnj_raw_response": dados_resposta_cnj,
                    }, 200

                dados_processo_cnj = hits_cnj_api[0].get("_source", {})
                movimentos_api_cnj = dados_processo_cnj.get("movimentos", [])
                if not isinstance(movimentos_api_cnj, list):
                    movimentos_api_cnj = []

                if not movimentos_api_cnj:
                    app.logger.info(
                        f"API CNJ: Processo '{caso_para_atualizar.numero_processo}' encontrado, mas sem lista 'movimentos'."
                    )
                    caso_para_atualizar.data_ultima_verificacao_cnj = datetime.utcnow()
                    db.session.commit()
                    return {
                        "message": "Processo encontrado no CNJ, mas sem detalhamento de movimentações."
                    }, 200

                novas_movs_count = 0
                backfill_movs_count = 0
                data_mov_recente_lote = None
                desc_mov_recente_lote = "Nenhuma nova movimentação significativa identificada."
                movimentos_api_cnj.sort(
                    key=lambda m: m.get("dataHora", "1900-01-01T00:00:00Z"), reverse=True
                )

                def _extrair_descricao_movimento(movimento_json):
                    desc_parts = []

                    if movimento_json.get("nome"):
                        desc_parts.append(str(movimento_json["nome"]))

                    for comp in movimento_json.get("complementosTabelados", []):
                        if isinstance(comp, dict) and comp.get("nome"):
                            desc_parts.append(str(comp["nome"]))

                    mov_nacional = movimento_json.get("movimentoNacional")
                    if (
                        not desc_parts
                        and mov_nacional
                        and isinstance(mov_nacional, dict)
                        and mov_nacional.get("descricao")
                    ):
                        desc_parts.append(mov_nacional["descricao"])

                    mov_local = movimento_json.get("movimentoLocal")
                    if (
                        not desc_parts
                        and mov_local
                        and isinstance(mov_local, dict)
                        and mov_local.get("descricao")
                    ):
                        desc_parts.append(mov_local["descricao"])

                    complementos_api = movimento_json.get("complementos", [])
                    if not desc_parts and isinstance(complementos_api, list):
                        for comp_item in complementos_api:
                            if isinstance(comp_item, dict) and comp_item.get("descricao"):
                                desc_parts.append(comp_item["descricao"])

                    descricao = " | ".join(filter(None, desc_parts))
                    if not descricao:
                        descricao = (
                            movimento_json.get("descricao")
                            or movimento_json.get("nome")
                            or f"Movimento Cód: {movimento_json.get('codigoNacional', {}).get('codigo', 'N/A')}"
                        )
                    return descricao

                def _parse_data_movimento(movimento_json):
                    data_mov_str_api = movimento_json.get("dataHora")
                    if not data_mov_str_api:
                        return None
                    try:
                        data_mov = datetime.fromisoformat(data_mov_str_api.replace("Z", "+00:00"))
                        return data_mov.replace(tzinfo=None) if data_mov.tzinfo else data_mov
                    except ValueError:
                        app.logger.warning(
                            f"API CNJ: Formato de 'dataHora' ('{data_mov_str_api}') inválido para caso {caso_id}. Ignorando no fluxo normal."
                        )
                        return None

                movimento_api_recente = movimentos_api_cnj[0] if movimentos_api_cnj else {}
                desc_mov_recente_api = _extrair_descricao_movimento(movimento_api_recente)
                data_mov_recente_api = _parse_data_movimento(movimento_api_recente)

                for movimento_json in movimentos_api_cnj:
                    data_mov_obj_utc = _parse_data_movimento(movimento_json)
                    if not data_mov_obj_utc:
                        continue

                    descricao_db = _extrair_descricao_movimento(movimento_json)

                    mov_existente = (
                        MovimentacaoCNJ.query.filter_by(
                            caso_id=caso_para_atualizar.id, data_movimentacao=data_mov_obj_utc
                        )
                        .filter(MovimentacaoCNJ.descricao.startswith(descricao_db[:150]))
                        .first()
                    )

                    if not mov_existente:
                        nova_mov = MovimentacaoCNJ(
                            tenant_id=caso_para_atualizar.tenant_id,
                            caso_id=caso_para_atualizar.id,
                            data_movimentacao=data_mov_obj_utc,
                            descricao=descricao_db,
                            dados_integra_cnj=movimento_json,
                        )
                        db.session.add(nova_mov)
                        novas_movs_count += 1
                        if (
                            data_mov_recente_lote is None
                            or data_mov_obj_utc > data_mov_recente_lote
                        ):
                            data_mov_recente_lote = data_mov_obj_utc
                            desc_mov_recente_lote = descricao_db

                # Se o CNJ retornou histórico mas nada foi considerado "novo" e o caso ainda
                # não possui movimentações locais, faz backfill completo para preencher timeline.
                movs_existentes_count = MovimentacaoCNJ.query.filter_by(
                    caso_id=caso_para_atualizar.id
                ).count()
                if novas_movs_count == 0 and movs_existentes_count == 0 and movimentos_api_cnj:
                    base_dt_backfill = data_mov_recente_api or datetime.utcnow()
                    for idx, movimento_json in enumerate(movimentos_api_cnj):
                        descricao_db = _extrair_descricao_movimento(movimento_json)
                        data_mov_obj_utc = _parse_data_movimento(movimento_json)
                        if not data_mov_obj_utc:
                            data_mov_obj_utc = base_dt_backfill - timedelta(seconds=idx)

                        mov_existente = (
                            MovimentacaoCNJ.query.filter_by(
                                caso_id=caso_para_atualizar.id,
                                data_movimentacao=data_mov_obj_utc,
                            )
                            .filter(MovimentacaoCNJ.descricao.startswith(descricao_db[:150]))
                            .first()
                        )
                        if mov_existente:
                            continue

                        db.session.add(
                            MovimentacaoCNJ(
                                tenant_id=caso_para_atualizar.tenant_id,
                                caso_id=caso_para_atualizar.id,
                                data_movimentacao=data_mov_obj_utc,
                                descricao=descricao_db,
                                dados_integra_cnj=movimento_json,
                            )
                        )
                        backfill_movs_count += 1

                # Mantém status do caso alinhado com o último retorno do CNJ, mesmo sem novas.
                status_ref = desc_mov_recente_lote if novas_movs_count > 0 else desc_mov_recente_api
                data_ref = data_mov_recente_lote if novas_movs_count > 0 else data_mov_recente_api
                if status_ref:
                    caso_para_atualizar.status = status_ref[:255]
                if data_ref:
                    caso_para_atualizar.data_atualizacao = data_ref

                caso_para_atualizar.data_ultima_verificacao_cnj = datetime.utcnow()
                db.session.commit()

                if novas_movs_count > 0:
                    msg_final = f"Caso atualizado. {novas_movs_count} nova(s) movimentação(ões) registrada(s)."
                elif backfill_movs_count > 0:
                    msg_final = (
                        "Nenhuma nova movimentação encontrada, mas histórico completo foi sincronizado "
                        f"({backfill_movs_count} registro(s))."
                    )
                else:
                    msg_final = "Nenhuma nova movimentação encontrada para registrar."

                app.logger.info(f"API CNJ: Atualização para caso {caso_id} concluída. {msg_final}")
                return {
                    "message": msg_final,
                    "novas_movimentacoes_registradas": novas_movs_count,
                    "movimentacoes_backfill_registradas": backfill_movs_count,
                    "descricao_ultima_movimentacao_nova": (
                        desc_mov_recente_lote if novas_movs_count > 0 else None
                    ),
                }, 200

            except (KeyError, IndexError, TypeError, AttributeError) as e_proc:
                db.session.rollback()
                app.logger.error(
                    f"API CNJ: Erro crítico ao processar dados da resposta CNJ para caso {caso_id}: {str(e_proc)}. Resposta CNJ (parcial): {str(dados_resposta_cnj)[:500]}",
                    exc_info=True,
                )
                return {"message": "Erro interno ao processar os dados recebidos do CNJ."}, 500
            except Exception as e_geral:
                db.session.rollback()
                app.logger.critical(
                    f"API CNJ: Erro geral INESPERADO no endpoint de atualização CNJ para caso {caso_id}: {str(e_geral)}",
                    exc_info=True,
                )
                return {"message": "Ocorreu um erro interno inesperado no sistema."}, 500

    @casos_ns.route("/<int:caso_id>/atualizar-djen")
    @casos_ns.param("caso_id", "ID do caso para buscar publicações no DJEN")
    class CasoAtualizarDJENAPI(Resource):
        @casos_ns.doc(
            "atualizar_caso_via_djen",
            security="jsonWebToken",
            description="Consulta o DJEN (ComunicaAPI) pelo número de processo do caso e "
            "registra novas publicações na timeline.",
        )
        @jwt_required()
        @tenant_scoped
        def post(self, caso_id):
            user_id_atual = get_jwt_identity()
            tenant_id = get_tenant_id()
            caso = query_for_tenant(Caso).filter_by(id=caso_id).first()

            if not caso:
                return {"message": f"Caso {caso_id} não encontrado."}, 404

            numero = (caso.numero_processo or "").strip()
            if not numero:
                return {
                    "message": "Este caso não possui número de processo para consulta ao DJEN."
                }, 400

            app.logger.info(
                f"DJEN: buscando publicações para caso {caso_id}, processo '{numero}', "
                f"solicitado por usuário {user_id_atual}."
            )

            sigla_trib = _inferir_sigla_tribunal_por_numero_processo(numero)

            try:
                _, items = _consultar_processo_com_fallback(
                    numero_processo=numero,
                    sigla_tribunal=sigla_trib,
                    data_inicio=None,
                    data_fim=None,
                    logger=app.logger,
                )
            except DjenRateLimitError:
                return {
                    "message": "DJEN: limite de requisições atingido. Tente novamente em 1 minuto."
                }, 429
            except DjenAPIError as e:
                return {"message": f"Erro ao consultar o DJEN: {str(e)}"}, 502

            novas = 0
            for item in items:
                try:
                    salvo = _salvar_publicacao(
                        db,
                        PublicacaoDJEN,
                        user_id=user_id_atual,
                        tenant_id=tenant_id,
                        caso_id=caso_id,
                        item=item,
                        origem="processo",
                    )
                    if salvo:
                        novas += 1
                except Exception as e_item:
                    app.logger.warning(
                        f"DJEN: erro ao salvar item para caso {caso_id}: {e_item}", exc_info=True
                    )

            try:
                db.session.commit()
            except Exception as e_commit:
                db.session.rollback()
                app.logger.error(
                    f"DJEN: erro no commit para caso {caso_id}: {e_commit}", exc_info=True
                )
                return {"message": "Erro interno ao salvar publicações."}, 500

            if novas > 0:
                msg = f"{novas} nova(s) publicação(ões) do DJEN registrada(s) para este caso."
            elif items:
                msg = "Nenhuma publicação nova. O DJEN já estava sincronizado."
            else:
                msg = "Nenhuma publicação encontrada no DJEN para este número de processo."

            app.logger.info(f"DJEN: caso {caso_id} — {msg}")
            return {
                "message": msg,
                "novas_publicacoes_registradas": novas,
                "total_retornado_djen": len(items),
            }, 200

    @casos_ns.route("/<int:caso_id>/movimentacoes-cnj")
    @casos_ns.param(
        "caso_id", "O ID do caso para o qual listar as movimentações CNJ registradas no sistema"
    )
    class CasoListarMovimentacoesCNJAPI(Resource):
        @casos_ns.doc("listar_movimentacoes_cnj_registradas_caso_endpoint", security="jsonWebToken")
        @casos_ns.marshal_list_with(movimentacao_cnj_output_model_dto)
        @jwt_required()
        @tenant_scoped
        def get(self, caso_id):
            caso_db = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso_db:
                casos_ns.abort(404, message=f"Caso com ID {caso_id} não foi encontrado.")
            movimentacoes = (
                MovimentacaoCNJ.query.filter_by(caso_id=caso_db.id)
                .order_by(MovimentacaoCNJ.data_movimentacao.desc(), MovimentacaoCNJ.id.desc())
                .all()
            )
            return movimentacoes, 200

    @casos_ns.route("/<int:caso_id>/publicacoes-djen")
    @casos_ns.param("caso_id", "ID do caso para listar publicações DJEN vinculadas")
    class CasoListarPublicacoesDjenAPI(Resource):
        @casos_ns.doc("listar_publicacoes_djen_caso_endpoint", security="jsonWebToken")
        @jwt_required()
        @tenant_scoped
        def get(self, caso_id):
            tenant_id = get_tenant_id()
            caso_db = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso_db:
                casos_ns.abort(404, message=f"Caso com ID {caso_id} não foi encontrado.")
            publicacoes = (
                PublicacaoDJEN.query.filter_by(tenant_id=tenant_id, caso_id=caso_db.id)
                .order_by(PublicacaoDJEN.data_disponibilizacao.desc(), PublicacaoDJEN.id.desc())
                .all()
            )
            return [
                {
                    "id": p.id,
                    "tipo_comunicacao": p.tipo_comunicacao,
                    "texto": p.texto,
                    "data_disponibilizacao": (
                        p.data_disponibilizacao.isoformat() if p.data_disponibilizacao else None
                    ),
                    "sigla_tribunal": p.sigla_tribunal,
                    "nome_orgao": p.nome_orgao,
                    "lida": p.lida,
                    "link": p.link,
                    "data_captura": p.data_captura.isoformat() if p.data_captura else None,
                }
                for p in publicacoes
            ], 200

    @casos_ns.route("/<int:caso_id>/documentos")
    @casos_ns.param("caso_id", "ID do caso para listar procuracoes e contratos vinculados")
    class CasoListarDocumentosAPI(Resource):
        @casos_ns.doc(
            "listar_documentos_caso_endpoint",
            security="jsonWebToken",
            description=(
                "Retorna procuracoes e contratos vinculados ao caso. "
                "Inclui contratos ligados ao cliente do caso mas sem caso especifico, "
                "para que o usuario veja todo o contexto documental."
            ),
        )
        @jwt_required()
        @tenant_scoped
        def get(self, caso_id):
            tenant_id = get_tenant_id()
            caso_db = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso_db:
                casos_ns.abort(404, message=f"Caso com ID {caso_id} nao foi encontrado.")

            procuracoes = (
                ProcuracaoAnalise.query.filter_by(tenant_id=tenant_id)
                .filter(
                    (ProcuracaoAnalise.caso_id == caso_db.id)
                    | (
                        (ProcuracaoAnalise.caso_id.is_(None))
                        & (ProcuracaoAnalise.cliente_id == caso_db.cliente_id)
                    )
                )
                .order_by(ProcuracaoAnalise.criado_em.desc())
                .all()
            )

            contratos = (
                ContratoHonorario.query.filter_by(tenant_id=tenant_id)
                .filter(
                    (ContratoHonorario.caso_id == caso_db.id)
                    | (
                        (ContratoHonorario.caso_id.is_(None))
                        & (ContratoHonorario.cliente_id == caso_db.cliente_id)
                    )
                )
                .order_by(
                    ContratoHonorario.data_assinatura.desc().nullslast(),
                    ContratoHonorario.id.desc(),
                )
                .all()
            )

            return {
                "procuracoes": [p.to_dict() for p in procuracoes],
                "contratos": [c.to_dict() for c in contratos],
            }, 200

    @casos_ns.route("/<int:caso_id>/apensar")
    @casos_ns.param("caso_id", "ID do caso que sera APENSADO ao caso principal")
    class CasoApensarAPI(Resource):
        """Epic #8 (#182): apensar este caso a outro processo principal.

        Inspirado no Astrea ("Apensar este processo a outro"). Ao apensar,
        o caso passa a apontar para o caso_principal_id e a UI passa a
        mostrar essa relacao.
        """

        @casos_ns.doc("apensar_caso_endpoint", security="jsonWebToken")
        @jwt_required()
        @tenant_scoped
        def post(self, caso_id):
            data = request.get_json(silent=True) or {}
            caso_principal_id = data.get("caso_principal_id")

            if not caso_principal_id or not isinstance(caso_principal_id, int):
                return {
                    "message": "Campo 'caso_principal_id' (int) e obrigatorio.",
                    "code": "missing_caso_principal_id",
                }, 400

            if caso_principal_id == caso_id:
                return {
                    "message": "Um caso nao pode ser apensado a si mesmo.",
                    "code": "self_apensar",
                }, 400

            caso = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso:
                casos_ns.abort(404, message=f"Caso {caso_id} nao encontrado.")

            principal = query_for_tenant(Caso).filter_by(id=caso_principal_id).first()
            if not principal:
                return {
                    "message": (f"Caso principal {caso_principal_id} nao encontrado neste tenant."),
                    "code": "principal_nao_encontrado",
                }, 404

            # Evita ciclos: principal nao pode estar apensado ao caso atual
            if principal.caso_principal_id == caso.id:
                return {
                    "message": (
                        "Apensar criaria ciclo: o caso principal indicado ja esta "
                        "apensado a este caso."
                    ),
                    "code": "ciclo_detectado",
                }, 400

            # Se o principal indicado tambem e apenso de outro, apensa ao topo da cadeia
            principal_efetivo = principal
            visitados = {principal.id}
            while principal_efetivo.caso_principal_id is not None:
                if principal_efetivo.caso_principal_id in visitados:
                    return {
                        "message": "Cadeia de apensos contem ciclo. Verifique os dados.",
                        "code": "cadeia_com_ciclo",
                    }, 400
                proximo = (
                    query_for_tenant(Caso).filter_by(id=principal_efetivo.caso_principal_id).first()
                )
                if not proximo:
                    break
                visitados.add(proximo.id)
                principal_efetivo = proximo

            caso.caso_principal_id = principal_efetivo.id
            log_audit(
                "UPDATE",
                "Caso",
                caso.id,
                f"Caso {caso.id} apensado ao caso principal {principal_efetivo.id}.",
            )
            db.session.commit()

            return {
                "message": "Caso apensado com sucesso.",
                "caso": caso.to_dict(),
                "caso_principal": {
                    "id": principal_efetivo.id,
                    "titulo": principal_efetivo.titulo,
                    "numero_processo": principal_efetivo.numero_processo,
                },
            }, 200

        @casos_ns.doc("desapensar_caso_endpoint", security="jsonWebToken")
        @jwt_required()
        @tenant_scoped
        def delete(self, caso_id):
            """Desapensa o caso (set caso_principal_id = NULL)."""
            tenant_id = get_tenant_id()  # noqa: F841 — usado pelo @tenant_scoped
            caso = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso:
                casos_ns.abort(404, message=f"Caso {caso_id} nao encontrado.")

            if caso.caso_principal_id is None:
                return {
                    "message": "Este caso nao esta apensado a nenhum outro.",
                    "code": "nao_apensado",
                }, 400

            principal_anterior = caso.caso_principal_id
            caso.caso_principal_id = None
            log_audit(
                "UPDATE",
                "Caso",
                caso.id,
                f"Caso {caso.id} desapensado (era apenso de {principal_anterior}).",
            )
            db.session.commit()

            return {"message": "Caso desapensado com sucesso.", "caso": caso.to_dict()}, 200

    @casos_ns.route("/<int:caso_id>/apensos")
    @casos_ns.param("caso_id", "ID do caso PRINCIPAL para listar seus apensos")
    class CasoListarApensosAPI(Resource):
        """Lista os casos apensados ao caso indicado."""

        @casos_ns.doc("listar_apensos_endpoint", security="jsonWebToken")
        @jwt_required()
        @tenant_scoped
        def get(self, caso_id):
            principal = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not principal:
                casos_ns.abort(404, message=f"Caso {caso_id} nao encontrado.")

            apensos = (
                query_for_tenant(Caso)
                .filter_by(caso_principal_id=caso_id)
                .order_by(Caso.id.asc())
                .all()
            )
            return {
                "caso_principal_id": caso_id,
                "total": len(apensos),
                "apensos": [a.to_dict() for a in apensos],
            }, 200

    @casos_ns.route("/<int:caso_id>/instancia")
    @casos_ns.param("caso_id", "ID do caso para alterar instancia")
    class CasoAlterarInstanciaAPI(Resource):
        """Epic #8 (#182): atualizar a instancia atual do caso.

        Inspirado no menu "Alterar instancia atual" do Astrea, usado quando
        um processo sobe de 1a para 2a instancia (recurso).
        """

        @casos_ns.doc("alterar_instancia_endpoint", security="jsonWebToken")
        @jwt_required()
        @tenant_scoped
        def patch(self, caso_id):
            data = request.get_json(silent=True) or {}
            nova_instancia = data.get("instancia")

            if not nova_instancia or not isinstance(nova_instancia, str):
                return {
                    "message": "Campo 'instancia' (string) e obrigatorio.",
                    "code": "missing_instancia",
                }, 400

            nova_instancia = nova_instancia.strip()
            if not nova_instancia:
                return {
                    "message": "Instancia nao pode ser vazia.",
                    "code": "instancia_vazia",
                }, 400

            caso = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso:
                casos_ns.abort(404, message=f"Caso {caso_id} nao encontrado.")

            instancia_anterior = caso.instancia
            caso.instancia = nova_instancia
            log_audit(
                "UPDATE",
                "Caso",
                caso.id,
                f"Instancia alterada de '{instancia_anterior}' para '{nova_instancia}'.",
            )
            db.session.commit()

            return {
                "message": "Instancia atualizada com sucesso.",
                "instancia_anterior": instancia_anterior,
                "instancia_atual": caso.instancia,
                "caso": caso.to_dict(),
            }, 200

    @casos_ns.route("/<int:caso_id>/gerar-resumo")
    @casos_ns.param("caso_id", "ID do caso para gerar resumo via IA")
    class CasoGerarResumoAPI(Resource):
        @casos_ns.doc("gerar_resumo_caso_endpoint", security="jsonWebToken")
        @jwt_required()
        @tenant_scoped
        def post(self, caso_id):
            if not gemini_is_enabled():
                casos_ns.abort(503, message="Serviço de IA não configurado.")

            tenant_id = get_tenant_id()
            caso_db = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso_db:
                casos_ns.abort(404, message=f"Caso com ID {caso_id} não foi encontrado.")

            publicacoes = (
                PublicacaoDJEN.query.filter_by(tenant_id=tenant_id, caso_id=caso_db.id)
                .order_by(PublicacaoDJEN.data_disponibilizacao.desc(), PublicacaoDJEN.id.desc())
                .limit(10)
                .all()
            )
            if not publicacoes:
                casos_ns.abort(422, message="Nenhuma publicação DJEN disponível para resumir.")

            # Ordenar do mais antigo para o mais recente para dar contexto cronológico à IA
            publicacoes_cronologicas = sorted(
                publicacoes,
                key=lambda p: p.data_disponibilizacao or datetime.min,
            )

            trechos = []
            for publicacao in publicacoes_cronologicas:
                data_str = (
                    publicacao.data_disponibilizacao.strftime("%d/%m/%Y")
                    if publicacao.data_disponibilizacao
                    else "data desconhecida"
                )
                orgao = publicacao.nome_orgao or publicacao.sigla_tribunal or "órgão não informado"
                texto = (publicacao.texto or "").strip()[:2500]
                trechos.append(
                    f"[{data_str}] Tipo: {publicacao.tipo_comunicacao or 'Publicação'} | Órgão: {orgao}\n{texto}"
                )
            contexto = "\n\n---\n\n".join(trechos)

            data_mais_recente = publicacoes_cronologicas[-1].data_disponibilizacao
            data_mais_antiga = publicacoes_cronologicas[0].data_disponibilizacao
            periodo_str = (
                f"{data_mais_antiga.strftime('%d/%m/%Y')} a {data_mais_recente.strftime('%d/%m/%Y')}"
                if data_mais_antiga and data_mais_recente
                else "período desconhecido"
            )

            prompt = (
                "Você é um assistente jurídico sênior. Analise as publicações do DJEN fornecidas e produza um "
                "resumo processual objetivo para uso interno em um software jurídico. "
                "Responda em português do Brasil.\n\n"
                "REGRAS OBRIGATÓRIAS:\n"
                "1. Baseie o resumo EXCLUSIVAMENTE no conteúdo das publicações abaixo. Não invente fatos.\n"
                "2. A situação do processo deve refletir a ÚLTIMA publicação disponível — não presuma "
                "o estado atual se ele não constar nas publicações.\n"
                "3. Se a última publicação indicar arquivamento, encerramento ou trânsito em julgado, "
                "mencione isso claramente como o estado final registrado.\n"
                "4. Não sugira 'próximo passo' se o processo aparenta encerrado.\n\n"
                f"Período coberto pelas publicações: {periodo_str}\n\n"
                "Estruture em um único parágrafo com no máximo 6 linhas, cobrindo: partes identificáveis, "
                "natureza da ação, situação processual conforme última publicação disponível, e "
                "última providência registrada. Omita o que não constar nas publicações.\n\n"
                f"Publicações DJEN (ordem cronológica, da mais antiga à mais recente):\n\n{contexto}"
            )

            client = get_gemini_client()
            if client is None:
                casos_ns.abort(503, message="Cliente de IA indisponível.")

            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                )
                resumo = (getattr(response, "text", None) or "").strip()
            except Exception as exc:
                msg = str(exc)
                # 429 RESOURCE_EXHAUSTED do Gemini API: cota free-tier (20/dia)
                # ou rate limit por minuto. Resposta amigavel ao inves de
                # despejar JSON cru de erro do Google.
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                    casos_ns.abort(
                        429,
                        message=(
                            "Cota da IA do Google esgotada (free tier = 20 resumos/dia). "
                            "Para gerar mais, habilite billing em "
                            "https://console.cloud.google.com/billing — apos isso a cota "
                            "sobe para milhares por minuto e o custo por resumo e centavos."
                        ),
                    )
                # 503 / model overloaded: indisponibilidade temporaria
                if (
                    "503" in msg
                    or "UNAVAILABLE" in msg
                    or "high demand" in msg.lower()
                    or "overloaded" in msg.lower()
                ):
                    casos_ns.abort(
                        503,
                        message=(
                            "Servico de IA do Google esta sobrecarregado no momento. "
                            "Tente novamente em alguns minutos."
                        ),
                    )
                # Outros erros: log completo no servidor, mensagem curta para o cliente
                app.logger.error("Erro inesperado ao chamar Gemini: %s", msg, exc_info=True)
                casos_ns.abort(
                    502,
                    message="Falha ao gerar resumo via IA. Tente novamente em instantes.",
                )

            if not resumo:
                casos_ns.abort(502, message="IA retornou resposta vazia.")

            caso_db.descricao = resumo
            db.session.commit()

            return {
                "resumo": resumo,
                "message": "Resumo gerado e salvo na descrição do caso.",
            }, 200

    @casos_ns.route("/<int:caso_id>/timeline")
    @casos_ns.param("caso_id", "ID do caso")
    class CasoTimelineAPI(Resource):
        """Linha do Tempo: agrega publicacoes DJEN, documentos e tarefas/prazos
        ordenados por data desc. Movimentacoes DataJud (CNJ) removidas — o DJEN
        e a fonte primaria com texto completo das intimacoes e decisoes."""

        @casos_ns.doc("listar_timeline_caso_endpoint", security="jsonWebToken")
        @jwt_required()
        @tenant_scoped
        def get(self, caso_id):
            tenant_id = get_tenant_id()
            caso_db = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso_db:
                casos_ns.abort(404, message=f"Caso com ID {caso_id} não foi encontrado.")

            eventos = []

            for pub in PublicacaoDJEN.query.filter_by(
                tenant_id=tenant_id, caso_id=caso_db.id
            ).all():
                data_iso = None
                if pub.data_disponibilizacao:
                    data_iso = pub.data_disponibilizacao.isoformat()
                elif pub.data_captura:
                    data_iso = pub.data_captura.isoformat()
                if not data_iso:
                    continue
                eventos.append(
                    {
                        "tipo": "publicacao_djen",
                        "id": pub.id,
                        "data": data_iso,
                        "titulo": pub.tipo_comunicacao or "Publicação DJEN",
                        "descricao": (pub.texto or "")[:500],
                        "metadata": {
                            "sigla_tribunal": pub.sigla_tribunal,
                            "nome_orgao": pub.nome_orgao,
                            "lida": pub.lida,
                            "link": pub.link,
                            "hash_comunicacao": pub.hash_comunicacao,
                            "tem_texto_completo": bool(pub.texto and len(pub.texto) > 500),
                        },
                    }
                )

            for doc in Documento.query.filter_by(tenant_id=tenant_id, caso_id=caso_db.id).all():
                if not doc.data_upload:
                    continue
                eventos.append(
                    {
                        "tipo": "documento",
                        "id": doc.id,
                        "data": doc.data_upload.isoformat(),
                        "titulo": doc.nome_arquivo,
                        "descricao": "Documento anexado ao caso",
                        "metadata": {
                            "url_download": f"/api/v1/documentos/download/{doc.id}",
                        },
                    }
                )

            for tarefa in TarefaPrazo.query.filter_by(
                tenant_id=tenant_id, caso_id=caso_db.id
            ).all():
                # Usa data_vencimento como ancora; cai para data_criacao se ausente.
                if tarefa.data_vencimento:
                    data_iso = tarefa.data_vencimento.isoformat()
                elif tarefa.data_criacao:
                    data_iso = tarefa.data_criacao.isoformat()
                else:
                    continue
                eventos.append(
                    {
                        "tipo": "tarefa",
                        "id": tarefa.id,
                        "data": data_iso,
                        "titulo": tarefa.titulo,
                        "descricao": tarefa.descricao or "",
                        "metadata": {
                            "status": tarefa.status,
                            "prioridade": tarefa.prioridade,
                            "tipo_tarefa": tarefa.tipo_tarefa,
                        },
                    }
                )

            eventos.sort(key=lambda e: e["data"], reverse=True)
            return {"caso_id": caso_db.id, "items": eventos}, 200
