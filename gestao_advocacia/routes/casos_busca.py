"""Rotas de busca/consulta/importação CNJ do Caso (#300, parte 4).

Extraído de routes/casos.py: buscar-processo-local, importar-cnjs,
buscar-cnj e consulta-publica-cnj. Mesmo namespace (casos_ns), zero
mudança de URL ou comportamento.
"""

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from cnj_service import consultar_processo_cnj
from helpers import get_tenant_id, tenant_scoped
from models import Caso, PublicacaoDJEN, User
from services.caso_service import normalizar_data_yyyy_mm_dd as _normalizar_data_yyyy_mm_dd
from utils.oab_match import (
    identificar_cliente_no_processo,
    oab_do_tenant,
    parsear_polos_datajud,
)


def register_casos_busca_routes(app, casos_ns):
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
            from models import Caso

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
                "ja_cadastrado": (
                    {
                        "caso_id": existente.id if existente else None,
                        "titulo": existente.titulo if existente else None,
                    }
                    if existente
                    else None
                ),
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
