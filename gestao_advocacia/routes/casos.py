from datetime import datetime, timedelta

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from cnj_service import consultar_processo_cnj
from extensions import db
from helpers import get_item_or_404, get_tenant_id, query_for_tenant, tenant_scoped
from models import Caso, Cliente, Documento, MovimentacaoCNJ, PublicacaoDJEN, TarefaPrazo, log_audit
from ocr_service import extract_case_data_from_file


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
            }, 200

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
                return {
                    "message": "Nenhum caso encontrado no sistema do Tribunal/CNJ com este número."
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

            data_distribuicao = _normalizar_data_yyyy_mm_dd(dados_processo.get("dataAjuizamento", ""))

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
                    msg_final = (
                        f"Caso atualizado. {novas_movs_count} nova(s) movimentação(ões) registrada(s)."
                    )
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

    @casos_ns.route("/<int:caso_id>/timeline")
    @casos_ns.param("caso_id", "ID do caso")
    class CasoTimelineAPI(Resource):
        """Linha do Tempo: agrega 4 fontes (movimentacoes CNJ, publicacoes DJEN,
        documentos e tarefas/prazos) ordenado por data desc para visualizacao
        unificada do andamento do caso. Eventos da Agenda nao aparecem porque
        EventoAgenda atualmente nao tem caso_id (ver TODO em models)."""

        @casos_ns.doc("listar_timeline_caso_endpoint", security="jsonWebToken")
        @jwt_required()
        @tenant_scoped
        def get(self, caso_id):
            tenant_id = get_tenant_id()
            caso_db = query_for_tenant(Caso).filter_by(id=caso_id).first()
            if not caso_db:
                casos_ns.abort(404, message=f"Caso com ID {caso_id} não foi encontrado.")

            eventos = []

            for mov in MovimentacaoCNJ.query.filter_by(caso_id=caso_db.id).all():
                if not mov.data_movimentacao:
                    continue
                eventos.append(
                    {
                        "tipo": "movimentacao_cnj",
                        "id": mov.id,
                        "data": mov.data_movimentacao.isoformat(),
                        "titulo": "Movimentação processual",
                        "descricao": mov.descricao or "",
                        "metadata": {
                            "dados_integra_cnj": mov.dados_integra_cnj or {},
                        },
                    }
                )

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
