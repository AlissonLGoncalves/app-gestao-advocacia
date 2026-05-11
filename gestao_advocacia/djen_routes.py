# ==============================================================================
# ARQUIVO: gestao_advocacia/djen_routes.py
# Rotas da API DJEN — Diário de Justiça Eletrônico Nacional.
# Chamado via registrar_rotas_djen() de dentro de create_app() em app.py
# para evitar importação circular.
# ==============================================================================
import hashlib
import io
import re
import unicodedata
from decimal import Decimal, InvalidOperation

from flask import current_app, request, send_file
from flask_restx import Resource, fields


def registrar_rotas_djen(
    djen_ns, db, DjenOabMonitoramento, PublicacaoDJEN, Caso, jwt_required, get_jwt_identity, logger
):
    _LABEL_SPLIT_RE = re.compile(
        r"(?i)\b(?:autor(?:\(s\))?|reu(?:\(s\))?|requerente|requerido|exequente|executado|"
        r"polo\s*ativo|polo\s*passivo|vitima(?:\(s\))?|investigad(?:o|a)(?:\(s\))?)\s*:\s*"
    )
    _PARTS_SPLIT_RE = re.compile(r"\s*(?:;|\||\bvs\.?\b|\be\b|/|,)\s*", re.IGNORECASE)
    _INSTITUTION_KEYWORDS = {
        "ministerio publico",
        "estado do",
        "uniao",
        "municipio",
        "prefeitura",
        "banco",
        "cooperativa",
        "s/a",
        "ltda",
        "me",
        "eireli",
        "tribunal",
        "subdivisao policial",
        "delegacia",
        "secretaria",
        "fazenda publica",
    }

    def _normalize_text(value):
        text = (value or "").strip()
        text = unicodedata.normalize("NFD", text)
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        text = re.sub(r"\s+", " ", text)
        return text.lower().strip()

    def _clean_party_candidate(value):
        text = re.sub(r"\s+", " ", (value or "")).strip(" -:;")
        text = re.sub(r"^(?:de|da|do|das|dos)\s+", "", text, flags=re.IGNORECASE)
        return text.strip()

    def _expand_party_candidates(value):
        text = re.sub(r"\s+", " ", (value or "")).strip()
        if not text:
            return []

        normalized = _LABEL_SPLIT_RE.sub("|", text)
        chunks = [c.strip() for c in normalized.split("|") if c.strip()]
        out = []
        for chunk in chunks:
            parts = [p.strip() for p in _PARTS_SPLIT_RE.split(chunk) if p.strip()]
            if not parts:
                parts = [chunk]
            out.extend(parts)

        dedup = []
        seen = set()
        for item in out:
            cleaned = _clean_party_candidate(item)
            if len(cleaned) < 3:
                continue
            key = _normalize_text(cleaned)
            if key in seen:
                continue
            seen.add(key)
            dedup.append(cleaned)
        return dedup

    def _looks_institutional(name):
        n = _normalize_text(name)
        if any(keyword in n for keyword in _INSTITUTION_KEYWORDS):
            return True
        if re.search(r"\\d", n):
            return True
        return False

    def _person_score(name):
        if not name:
            return -999
        score = 0
        tokens = [t for t in re.split(r"\s+", name.strip()) if t]
        if 2 <= len(tokens) <= 6:
            score += 3
        if _looks_institutional(name):
            score -= 6
        if any(len(t) >= 3 for t in tokens):
            score += 1
        if re.search(r"[A-Za-zÀ-ÿ]", name):
            score += 1
        return score

    def _pick_best_cliente_name(autores, reus):
        candidates = []

        for raw in reus or []:
            for part in _expand_party_candidates(raw):
                candidates.append((part, "reu"))
        for raw in autores or []:
            for part in _expand_party_candidates(raw):
                candidates.append((part, "autor"))

        if not candidates:
            return None, None

        ranked = sorted(candidates, key=lambda item: _person_score(item[0]), reverse=True)
        best_name, best_role = ranked[0]

        if _person_score(best_name) >= 0:
            return best_name, best_role

        # Fallback: manter comportamento previsível com a primeira opção disponível.
        return candidates[0]

    def _pick_opposing_party(autores, reus, papel_cliente):
        origem = reus if papel_cliente == "autor" else autores
        for raw in origem or []:
            expanded = _expand_party_candidates(raw)
            if expanded:
                return expanded[0]
        return None

    def _tenant_djen_habilitado(tenant_id):
        enabled_csv = (current_app.config.get("DJEN_ENABLED_TENANTS") or "").strip()
        rollout = max(0, min(int(current_app.config.get("DJEN_ROLLOUT_PERCENT", 100)), 100))

        if enabled_csv:
            enabled = {p.strip() for p in enabled_csv.split(",") if p.strip()}
            if str(tenant_id) not in enabled:
                return False

        if rollout >= 100:
            return True
        digest = hashlib.sha256(str(tenant_id).encode("utf-8")).hexdigest()
        bucket = int(digest[:8], 16) % 100
        return bucket < rollout

    def _get_user_or_401():
        from app import User

        user_id = get_jwt_identity()
        user = User.query.get(int(user_id))
        if not user:
            djen_ns.abort(401, "Usuário não encontrado.")
        if user.tenant_id is None:
            djen_ns.abort(403, "Acesso Negado (LGPD): Usuário sem tenant atribuído.")
        return user

    def _log_cross_tenant(user, model_name, target_id, tenant_alvo):
        logger.warning(
            "Cross-tenant access blocked | user_id=%s tenant_id_atual=%s tenant_id_alvo=%s endpoint=%s item_id=%s model=%s",
            user.id,
            user.tenant_id,
            tenant_alvo,
            request.path,
            target_id,
            model_name,
        )

    def _get_scoped_or_404(model, user, item_id, model_name, mensagem_404):
        item = model.query.filter_by(id=item_id, tenant_id=user.tenant_id).first()
        if item:
            return item
        alvo = model.query.filter_by(id=item_id).first()
        if alvo and getattr(alvo, "tenant_id", None) != user.tenant_id:
            _log_cross_tenant(user, model_name, item_id, getattr(alvo, "tenant_id", None))
        djen_ns.abort(404, mensagem_404)

    def _registrar_decisao(
        pub,
        user_id,
        acao,
        origem_acao="manual",
        cliente_id=None,
        caso_id=None,
        confianca=None,
        motivo=None,
        payload=None,
    ):
        from app import DjenVinculoDecisao

        decisao = DjenVinculoDecisao(
            tenant_id=pub.tenant_id,
            user_id=user_id,
            publicacao_id=pub.id,
            acao=acao,
            origem_acao=origem_acao,
            cliente_id=cliente_id,
            caso_id=caso_id,
            confianca=confianca,
            motivo=motivo,
            payload=payload or {},
        )
        db.session.add(decisao)

    def _parse_decimal_or_none(value):
        if value in (None, ""):
            return None
        if isinstance(value, (int, float, Decimal)):
            return Decimal(str(value))
        value_str = str(value).strip()
        if not value_str:
            return None
        value_str = value_str.replace("R$", "").replace(" ", "")
        if "," in value_str:
            value_str = value_str.replace(".", "").replace(",", ".")
        try:
            return Decimal(value_str)
        except (InvalidOperation, ValueError):
            djen_ns.abort(400, "valor_causa inválido no caso_payload.")

    def _processar_triagem_criar_cliente_caso(user, pub, payload=None):
        from app import Cliente
        from djen_triagem import analisar_publicacao

        payload = payload or {}

        if pub.caso_id:
            return {
                "message": "Publicação já está vinculada a um caso.",
                "cliente_criado": False,
                "caso_criado": False,
                "cliente": None,
                "caso": None,
                "publicacao": pub.to_dict(),
            }

        analise = analisar_publicacao(pub)
        if not payload:
            nome_cliente_auto, papel_auto = _pick_best_cliente_name(
                analise.get("partes_autoras") or [],
                analise.get("partes_reus") or [],
            )
            if not nome_cliente_auto:
                nome_cliente_auto = f"Cliente DJEN {pub.id}"
                papel_auto = "autor"

            parte_contraria_auto = _pick_opposing_party(
                analise.get("partes_autoras") or [],
                analise.get("partes_reus") or [],
                papel_auto,
            )

            payload = {
                "cliente_id": None,
                "cliente_payload": {
                    "nome_razao_social": nome_cliente_auto,
                    "tipo_pessoa": "PF",
                    "cpf_cnpj": None,
                    "email": None,
                },
                "papel_cliente": papel_auto,
                "caso_payload": {
                    "titulo": f"Processo {analise.get('numero_processo') or pub.numero_processo or pub.id}",
                    "numero_processo": analise.get("numero_processo") or pub.numero_processo,
                    "tipo_acao": analise.get("classe_processual") or pub.nome_classe,
                    "vara_juizo": pub.nome_orgao,
                    "comarca": analise.get("comarca"),
                    "valor_causa": analise.get("valor_causa"),
                    "parte_contraria": parte_contraria_auto,
                    "notas_caso": "Caso criado automaticamente pela triagem DJEN (validar dados extraídos).",
                },
            }
        cliente_id = payload.get("cliente_id")
        cliente_payload = payload.get("cliente_payload")
        caso_payload = payload.get("caso_payload") or {}
        papel_cliente = (payload.get("papel_cliente") or "").strip().lower()

        if papel_cliente not in {"autor", "reu"}:
            djen_ns.abort(400, "papel_cliente é obrigatório e deve ser 'autor' ou 'reu'.")

        if bool(cliente_id) == bool(cliente_payload):
            djen_ns.abort(
                400,
                "Informe exatamente um entre cliente_id e cliente_payload.",
            )

        cliente = None
        cliente_criado = False
        if cliente_id:
            cliente = Cliente.query.filter_by(
                id=int(cliente_id),
                tenant_id=user.tenant_id,
            ).first()
            if not cliente:
                djen_ns.abort(404, "Cliente não encontrado para este tenant.")
        else:
            nome_cliente = (cliente_payload.get("nome_razao_social") or "").strip()
            if not nome_cliente:
                djen_ns.abort(400, "cliente_payload.nome_razao_social é obrigatório.")
            tipo_pessoa = (cliente_payload.get("tipo_pessoa") or "PF").strip().upper()
            if tipo_pessoa not in {"PF", "PJ"}:
                djen_ns.abort(400, "cliente_payload.tipo_pessoa deve ser PF ou PJ.")

            cpf_cnpj = (cliente_payload.get("cpf_cnpj") or "").strip()[:20] or None

            # ANTI-DUPLICATA: busca cliente existente por CPF/CNPJ (digitos)
            # ou por nome normalizado. Reusa em vez de duplicar.
            from djen_triagem import normalizar_nome  # noqa: PLC0415

            cliente_existente = None
            if cpf_cnpj:
                digitos_novo = re.sub(r"\D", "", cpf_cnpj)
                if digitos_novo and not digitos_novo.startswith("DJEN"):
                    cands = Cliente.query.filter(
                        Cliente.tenant_id == user.tenant_id,
                        Cliente.cpf_cnpj.isnot(None),
                        Cliente.cpf_cnpj != "",
                    ).all()
                    for c in cands:
                        d = re.sub(r"\D", "", c.cpf_cnpj or "")
                        if d == digitos_novo:
                            cliente_existente = c
                            break
            if not cliente_existente and nome_cliente:
                nome_norm = normalizar_nome(nome_cliente)
                if nome_norm:
                    cands = Cliente.query.filter(
                        Cliente.tenant_id == user.tenant_id,
                    ).all()
                    for c in cands:
                        if normalizar_nome(c.nome_razao_social or "") == nome_norm:
                            cliente_existente = c
                            break

            if cliente_existente:
                cliente = cliente_existente
                cliente_criado = False
            else:
                if not cpf_cnpj:
                    documento_base = f"DJEN-{pub.id}"
                    documento = documento_base
                    contador = 1
                    while Cliente.query.filter_by(
                        tenant_id=user.tenant_id,
                        user_id=user.id,
                        cpf_cnpj=documento,
                    ).first():
                        contador += 1
                        documento = f"{documento_base}-{contador}"[:20]
                    cpf_cnpj = documento

                cliente = Cliente(
                    tenant_id=user.tenant_id,
                    user_id=user.id,
                    nome_razao_social=nome_cliente[:200],
                    tipo_pessoa=tipo_pessoa,
                    cpf_cnpj=cpf_cnpj,
                    email=(cliente_payload.get("email") or "").strip()[:120] or None,
                    notas_gerais="Criado manualmente pela triagem DJEN.",
                )
                db.session.add(cliente)
                db.session.flush()
                cliente_criado = True

        numero_processo = (
            caso_payload.get("numero_processo") or analise.get("numero_processo") or ""
        ).strip()
        if numero_processo:
            caso_existente = Caso.query.filter_by(
                tenant_id=user.tenant_id,
                numero_processo=numero_processo,
            ).first()
            if caso_existente:
                return {
                    "mensagem": "Já existe caso com este número de processo neste tenant.",
                    "caso_existente": {
                        "id": caso_existente.id,
                        "titulo": caso_existente.titulo,
                        "numero_processo": caso_existente.numero_processo,
                    },
                }, 409

        parte_contraria_default = _pick_opposing_party(
            analise.get("partes_autoras") or [],
            analise.get("partes_reus") or [],
            papel_cliente,
        )

        titulo_caso = (caso_payload.get("titulo") or "").strip()
        if not titulo_caso:
            if numero_processo:
                titulo_caso = f"Processo {numero_processo}"
            else:
                titulo_caso = f"Caso DJEN #{pub.id}"

        caso = Caso(
            tenant_id=user.tenant_id,
            user_id=user.id,
            cliente_id=cliente.id,
            titulo=titulo_caso[:200],
            numero_processo=numero_processo or None,
            status="Ativo",
            tipo_acao=(
                caso_payload.get("tipo_acao")
                or analise.get("classe_processual")
                or pub.nome_classe
                or ""
            )[:100]
            or None,
            vara_juizo=(caso_payload.get("vara_juizo") or pub.nome_orgao or "")[:100] or None,
            comarca=(caso_payload.get("comarca") or analise.get("comarca") or "")[:100] or None,
            valor_causa=_parse_decimal_or_none(
                caso_payload.get("valor_causa") or analise.get("valor_causa")
            ),
            parte_contraria=(caso_payload.get("parte_contraria") or parte_contraria_default or "")[
                :200
            ]
            or None,
            notas_caso=(caso_payload.get("notas_caso") or "")[:4000] or None,
        )
        db.session.add(caso)
        db.session.flush()
        caso_criado = True

        pub.caso_id = caso.id
        pub.lida = True
        pub.triagem_ignorada = False
        pub.status_origem = "criado_automaticamente"

        notas_auto = f"[TRIAGEM DJEN] Vinculado ao caso #{caso.id}."
        pub.notas = f"{pub.notas}\n{notas_auto}".strip() if pub.notas else notas_auto

        _registrar_decisao(
            pub=pub,
            user_id=user.id,
            acao="criar",
            origem_acao="manual",
            cliente_id=cliente.id,
            caso_id=caso.id,
            confianca=analise.get("confianca"),
            motivo="Criação cliente/caso na triagem",
            payload=payload,
        )

        return {
            "message": "Cliente/Caso processados com sucesso pela triagem.",
            "cliente_criado": cliente_criado,
            "caso_criado": caso_criado,
            "cliente": {
                "id": cliente.id,
                "nome_razao_social": cliente.nome_razao_social,
                "cpf_cnpj": cliente.cpf_cnpj,
            },
            "caso": {
                "id": caso.id,
                "titulo": caso.titulo,
                "numero_processo": caso.numero_processo,
            },
            "publicacao": pub.to_dict(),
        }, 201

    # ── DTOs ──────────────────────────────────────────────────────────────────
    oab_input_dto = djen_ns.model(
        "DjenOabInput",
        {
            "numero_oab": fields.String(
                required=True, description="Número da OAB (somente números ou no formato original)"
            ),
            "uf_oab": fields.String(
                required=True, description="UF de inscrição da OAB, ex: PR, SP"
            ),
            "nome_advogado": fields.String(
                description="Nome do advogado (opcional, apenas para identificação)"
            ),
        },
    )

    oab_output_dto = djen_ns.model(
        "DjenOabOutput",
        {
            "id": fields.Integer(readonly=True),
            "numero_oab": fields.String(),
            "uf_oab": fields.String(),
            "nome_advogado": fields.String(),
            "ativo": fields.Boolean(),
            "ultima_sincronizacao": fields.String(),
            "data_criacao": fields.String(),
        },
    )

    djen_ns.model(
        "PublicacaoDjenOutput",
        {
            "id": fields.Integer(readonly=True),
            "djen_id": fields.Integer(),
            "hash_comunicacao": fields.String(),
            "numero_processo": fields.String(),
            "numero_processo_mascara": fields.String(),
            "sigla_tribunal": fields.String(),
            "nome_orgao": fields.String(),
            "tipo_comunicacao": fields.String(),
            "tipo_documento": fields.String(),
            "nome_classe": fields.String(),
            "data_disponibilizacao": fields.String(),
            "texto": fields.String(),
            "link": fields.String(),
            "meio": fields.String(),
            "ativo": fields.Boolean(),
            "origem_busca": fields.String(),
            "status_origem": fields.String(),
            "triagem_ignorada": fields.Boolean(),
            "lida": fields.Boolean(),
            "notas": fields.String(),
            "caso_id": fields.Integer(),
            "data_captura": fields.String(),
        },
    )

    pub_patch_dto = djen_ns.model(
        "PublicacaoDjenPatch",
        {
            "lida": fields.Boolean(description="Marcar como lida/não lida"),
            "caso_id": fields.Integer(description="Vincular a um caso existente"),
            "notas": fields.String(description="Anotações sobre esta publicação"),
        },
    )

    sync_input_dto = djen_ns.model(
        "DjenSyncInput",
        {
            "oab_id": fields.Integer(
                description="ID da OAB a sincronizar (omitir = todas as ativas)"
            ),
            "dias": fields.Integer(
                description="Janela de busca em dias (padrão = 30, máximo = 365)", default=30
            ),
        },
    )

    # ── OABs monitoradas ──────────────────────────────────────────────────────
    @djen_ns.route("/oabs")
    class DjenOabListAPI(Resource):
        @djen_ns.marshal_list_with(oab_output_dto)
        @djen_ns.doc(security="jsonWebToken")
        @jwt_required()
        def get(self):
            """Lista as OABs configuradas para monitoramento no tenant."""
            user = _get_user_or_401()
            return (
                DjenOabMonitoramento.query.filter_by(tenant_id=user.tenant_id)
                .order_by(DjenOabMonitoramento.data_criacao.desc())
                .all()
            )

        @djen_ns.expect(oab_input_dto, validate=True)
        @djen_ns.marshal_with(oab_output_dto, code=201)
        @djen_ns.doc(security="jsonWebToken")
        @jwt_required()
        def post(self):
            """Cadastra uma OAB para monitoramento automático."""
            user_id = get_jwt_identity()
            user = _get_user_or_401()
            data = request.json
            numero = (data.get("numero_oab") or "").strip()
            uf = (data.get("uf_oab") or "").strip().upper()
            if not numero or not uf:
                djen_ns.abort(400, "numero_oab e uf_oab são obrigatórios.")
            existente = DjenOabMonitoramento.query.filter_by(
                tenant_id=user.tenant_id, numero_oab=numero, uf_oab=uf
            ).first()
            if existente:
                djen_ns.abort(409, "Esta OAB já está cadastrada para monitoramento.")
            oab = DjenOabMonitoramento(
                tenant_id=user.tenant_id,
                user_id=int(user_id),
                numero_oab=numero,
                uf_oab=uf,
                nome_advogado=(data.get("nome_advogado") or "").strip() or None,
            )
            sigla_raw = (data.get("sigla_tribunal") or "").strip().upper()
            if sigla_raw:
                oab.sigla_tribunal = sigla_raw
            db.session.add(oab)
            db.session.commit()
            return oab, 201

    @djen_ns.route("/oabs/<int:oab_id>")
    class DjenOabDetailAPI(Resource):
        @djen_ns.doc(security="jsonWebToken")
        @jwt_required()
        def delete(self, oab_id):
            """Remove uma OAB do monitoramento."""
            user = _get_user_or_401()
            oab = _get_scoped_or_404(
                DjenOabMonitoramento, user, oab_id, "DjenOabMonitoramento", "OAB não encontrada."
            )
            db.session.delete(oab)
            db.session.commit()
            return "", 204

    # ── Publicações ───────────────────────────────────────────────────────────
    @djen_ns.route("/publicacoes")
    class PublicacaoListAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            params={
                "lida": "Filtrar por lida (true/false)",
                "sigla_tribunal": "Filtrar por tribunal (ex: TJPR)",
                "numero_processo": "Filtrar por número de processo",
                "origem": "Filtrar por origem: oab ou processo",
                "data_inicio": "Data início disponibilização (yyyy-mm-dd)",
                "data_fim": "Data fim disponibilização (yyyy-mm-dd)",
                "limit": "Itens por página (padrão 50, máx 200)",
                "offset": "Paginação",
                "ordenar": "Ordenação: data_desc (padrão), data_asc, tribunal_asc, orgao_asc, tipo_asc",
            },
        )
        @jwt_required()
        def get(self):
            """Lista publicações DJEN capturadas, com filtros."""
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            q = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id)

            lida_param = request.args.get("lida")
            if lida_param is not None:
                q = q.filter_by(lida=(lida_param.lower() == "true"))

            sigla = request.args.get("sigla_tribunal")
            if sigla:
                q = q.filter(PublicacaoDJEN.sigla_tribunal.ilike(sigla))

            numero_proc = request.args.get("numero_processo")
            if numero_proc:
                numero_proc_clean = numero_proc.strip()
                numero_proc_digits = re.sub(r"\D", "", numero_proc_clean)

                numero_proc_expr = db.func.replace(
                    db.func.replace(
                        db.func.replace(
                            db.func.replace(
                                db.func.coalesce(PublicacaoDJEN.numero_processo, ""), ".", ""
                            ),
                            "-",
                            "",
                        ),
                        "/",
                        "",
                    ),
                    " ",
                    "",
                )
                numero_proc_masc_expr = db.func.replace(
                    db.func.replace(
                        db.func.replace(
                            db.func.replace(
                                db.func.coalesce(PublicacaoDJEN.numero_processo_mascara, ""),
                                ".",
                                "",
                            ),
                            "-",
                            "",
                        ),
                        "/",
                        "",
                    ),
                    " ",
                    "",
                )

                filtros_numero = [
                    PublicacaoDJEN.numero_processo.ilike(f"%{numero_proc_clean}%"),
                    PublicacaoDJEN.numero_processo_mascara.ilike(f"%{numero_proc_clean}%"),
                    PublicacaoDJEN.texto.ilike(f"%{numero_proc_clean}%"),
                ]

                if numero_proc_digits:
                    filtros_numero.extend(
                        [
                            numero_proc_expr.ilike(f"%{numero_proc_digits}%"),
                            numero_proc_masc_expr.ilike(f"%{numero_proc_digits}%"),
                        ]
                    )

                q = q.filter(db.or_(*filtros_numero))

            nome_parte = request.args.get("nome_parte")
            if nome_parte:
                q = q.filter(
                    db.or_(
                        PublicacaoDJEN.polo_ativo.ilike(f"%{nome_parte}%"),
                        PublicacaoDJEN.polo_passivo.ilike(f"%{nome_parte}%"),
                        PublicacaoDJEN.texto.ilike(f"%{nome_parte}%"),
                    )
                )

            numero_oab = request.args.get("numero_oab")
            if numero_oab:
                q = q.filter(PublicacaoDJEN.texto.ilike(f"%{numero_oab}%"))

            origem = request.args.get("origem")
            if origem:
                q = q.filter_by(origem_busca=origem)

            data_inicio = request.args.get("data_inicio")
            if data_inicio:
                q = q.filter(PublicacaoDJEN.data_disponibilizacao >= data_inicio)

            data_fim = request.args.get("data_fim")
            if data_fim:
                q = q.filter(PublicacaoDJEN.data_disponibilizacao <= data_fim)

            # Epic #10 (#184): filtro de vinculacao. Permite as abas
            # "Pendentes" (sem caso) / "Vinculadas" (com caso) na UI.
            vinculacao = (request.args.get("vinculacao") or "").strip().lower()
            if vinculacao == "sem_caso":
                q = q.filter(PublicacaoDJEN.caso_id.is_(None))
            elif vinculacao == "com_caso":
                q = q.filter(PublicacaoDJEN.caso_id.isnot(None))

            # Epic #2 (#176): filtro de classificacao IA (Importantes vs todas).
            importante_param = (request.args.get("importante") or "").strip().lower()
            if importante_param == "true":
                q = q.filter(PublicacaoDJEN.importante.is_(True))
            elif importante_param == "false":
                q = q.filter(PublicacaoDJEN.importante.is_(False))

            limit = min(int(request.args.get("limit", 50)), 200)
            offset = int(request.args.get("offset", 0))
            total = q.count()

            ordenar = request.args.get("ordenar", "data_desc")
            _ordem = {
                "data_asc": PublicacaoDJEN.data_disponibilizacao.asc(),
                "tribunal_asc": PublicacaoDJEN.sigla_tribunal.asc(),
                "orgao_asc": PublicacaoDJEN.nome_orgao.asc(),
                "tipo_asc": PublicacaoDJEN.tipo_comunicacao.asc(),
            }
            items = (
                q.order_by(_ordem.get(ordenar, PublicacaoDJEN.data_disponibilizacao.desc()))
                .offset(offset)
                .limit(limit)
                .all()
            )

            # Epic #10 (#184): contagens por categoria pra alimentar as
            # abas no DjenPage. 4 queries de count baratas (cada uma usa
            # indice tenant_id; nao_lidas e pendentes ja tem indice
            # composto). Nao filtra pelos filtros aplicados — sempre conta
            # do tenant inteiro pra que o badge da aba reflita o universo
            # total, nao o subset filtrado.
            base_q = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id)
            nao_lidas = base_q.filter_by(lida=False).count()
            pendentes = base_q.filter(PublicacaoDJEN.caso_id.is_(None)).count()
            vinculadas = base_q.filter(PublicacaoDJEN.caso_id.isnot(None)).count()
            # Epic #2 (#176): conta importantes (importante=True; NULL nao
            # entra — sao publicacoes ainda nao classificadas).
            importantes = base_q.filter(PublicacaoDJEN.importante.is_(True)).count()
            total_geral = base_q.count()

            return {
                "total": total,
                "nao_lidas": nao_lidas,
                "limit": limit,
                "offset": offset,
                "items": [p.to_dict() for p in items],
                "contagens": {
                    "todas": total_geral,
                    "nao_lidas": nao_lidas,
                    "pendentes": pendentes,
                    "vinculadas": vinculadas,
                    "importantes": importantes,
                },
            }

    @djen_ns.route("/triagem")
    class PublicacaoTriagemAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            params={
                "limit": "Itens por página (padrão 20, máx 100)",
                "offset": "Paginação",
                "somente_pendentes": "Quando true, retorna apenas publicações sem caso vinculado (padrão true)",
            },
        )
        @jwt_required()
        def get(self):
            """Fila de triagem com análise de partes/representantes e sugestões de vínculo."""
            user_id = get_jwt_identity()
            from app import Cliente, User
            from djen_triagem import analisar_publicacao, sugerir_vinculos

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            q = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id, triagem_ignorada=False)

            somente_pendentes = request.args.get("somente_pendentes", "true").lower() != "false"
            if somente_pendentes:
                q = q.filter(PublicacaoDJEN.caso_id.is_(None))

            limit = min(int(request.args.get("limit", 20)), 100)
            offset = int(request.args.get("offset", 0))

            total = q.count()
            pubs = (
                q.order_by(PublicacaoDJEN.data_disponibilizacao.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )

            # Modo lite: o wizard de triagem assistida so precisa da lista de
            # publicacoes (sem analise/sugestoes). Para 200+ pendentes, rodar
            # regex em todas em serie e' lento; sugerir_vinculos faz queries
            # extras por pub. Lite pula tudo isso.
            lite = request.args.get("lite", "false").lower() == "true"

            itens = []
            for pub in pubs:
                if lite:
                    itens.append({"publicacao": pub.to_dict()})
                    continue
                # Apenas regex (rapido, gratis). Gemini fica reservado ao endpoint
                # /triagem/<id>/analise-ia que o wizard chama por publicacao.
                analise = analisar_publicacao(pub)
                sugestoes = sugerir_vinculos(db, Cliente, Caso, user.tenant_id, analise)
                itens.append(
                    {
                        "publicacao": pub.to_dict(),
                        "analise": analise,
                        "sugestoes": sugestoes,
                        "sugestoes_vinculo": sugestoes,
                    }
                )

            return {
                "total": total,
                "limit": limit,
                "offset": offset,
                "items": itens,
            }, 200

    @djen_ns.route("/triagem/auto-vincular-pendentes")
    class PublicacaoTriagemAutoVincularAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Reprocessa todas as publicacoes pendentes do tenant aplicando "
                "auto-vinculo por CPF/CNPJ ou nome de cliente cadastrado. "
                "Resolve o backlog de pubs ingeridas antes do auto-vinculo expandido."
            ),
        )
        @jwt_required()
        def post(self):
            user_id = get_jwt_identity()
            from app import Cliente, User
            from djen_triagem import (
                analisar_publicacao,
                construir_indices_auto_vinculo,
                tentar_auto_vincular_via_indices,
            )

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            tenant_id = user.tenant_id

            # OTIMIZACAO: pre-carrega clientes + casos UMA VEZ (2 queries) e
            # monta indices em memoria. Para 200 pendentes, reduz de ~600
            # queries pra 3 (clientes, casos, pubs).
            indices = construir_indices_auto_vinculo(Cliente, Caso, tenant_id)

            pendentes = PublicacaoDJEN.query.filter(
                PublicacaoDJEN.tenant_id == tenant_id,
                PublicacaoDJEN.caso_id.is_(None),
                PublicacaoDJEN.triagem_ignorada.is_(False),
            ).all()

            total = len(pendentes)
            vinculadas = 0
            ainda_pendentes = 0

            for pub in pendentes:
                try:
                    analise = analisar_publicacao(pub)
                    caso_id_auto = tentar_auto_vincular_via_indices(analise, indices)
                    if caso_id_auto:
                        pub.caso_id = caso_id_auto
                        pub.status_origem = "criado_automaticamente"
                        vinculadas += 1
                    else:
                        ainda_pendentes += 1
                except Exception as exc:
                    current_app.logger.warning(
                        "djen_auto_vincular_pendente_falha pub_id=%s: %s", pub.id, exc
                    )
                    ainda_pendentes += 1

            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                current_app.logger.error("djen_auto_vincular_commit_falha: %s", exc)
                djen_ns.abort(500, "Falha ao salvar vinculos.")

            return {
                "total": total,
                "vinculadas": vinculadas,
                "ainda_pendentes": ainda_pendentes,
            }, 200

    @djen_ns.route("/auto-tarefas/run")
    class DjenAutoTarefasRunAPI(Resource):
        """Feature Kanban<>DJEN: dispara a geracao retroativa de TarefaPrazo
        a partir de publicacoes ja classificadas como importantes e vinculadas
        a caso. Idempotente — chamar varias vezes nao duplica."""

        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Cria TarefaPrazo automaticamente para toda publicacao DJEN do "
                "tenant que seja importante=true, com caso_id NOT NULL e que "
                "ainda nao tenha tarefa associada. Util apos um deploy desta "
                "feature para gerar o backlog de prazos das publicacoes ja "
                "existentes."
            ),
        )
        @jwt_required()
        def post(self):
            from app import User  # noqa: PLC0415
            from djen_tasks import executar_auto_criacao_tarefas  # noqa: PLC0415

            user_id = get_jwt_identity()
            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Modulo DJEN desabilitado para este tenant.")

            try:
                criadas = executar_auto_criacao_tarefas(current_app, tenant_id=user.tenant_id)
            except Exception as exc:
                current_app.logger.error("djen_auto_tarefas_run_falha: %s", exc, exc_info=True)
                db.session.rollback()
                djen_ns.abort(500, "Falha ao gerar tarefas automaticas.")

            return {"tarefas_criadas": criadas}, 200

    @djen_ns.route("/triagem/casos-compativeis")
    class PublicacaoTriagemCasosCompativeisAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Lista Casos do tenant que sao candidatos a receber a publicacao "
                "(em vez de criar caso novo). Match por CNJ exato/aproximado e/ou "
                "por cliente_id."
            ),
            params={
                "numero_processo": "CNJ extraido (com ou sem mascara)",
                "cliente_id": "(opcional) ID do cliente escolhido — lista outros casos dele",
            },
        )
        @jwt_required()
        def get(self):
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            tenant_id = user.tenant_id
            numero_processo = (request.args.get("numero_processo") or "").strip()
            cliente_id_raw = request.args.get("cliente_id")
            cliente_id = None
            if cliente_id_raw:
                try:
                    cliente_id = int(cliente_id_raw)
                except (TypeError, ValueError):
                    cliente_id = None

            casos_dict = {}

            # 1) Match por CNJ — exato (com mascara) e por digitos
            if numero_processo:
                exato = Caso.query.filter_by(
                    tenant_id=tenant_id, numero_processo=numero_processo
                ).all()
                for c in exato:
                    casos_dict[c.id] = {
                        "id": c.id,
                        "titulo": c.titulo,
                        "numero_processo": c.numero_processo,
                        "status": c.status,
                        "vara_juizo": c.vara_juizo,
                        "cliente_id": c.cliente_id,
                        "cliente_nome": (
                            c.cliente.nome_razao_social if getattr(c, "cliente", None) else None
                        ),
                        "motivo": "Mesmo numero CNJ",
                        "score": 1.0,
                    }
                digitos = "".join(filter(str.isdigit, numero_processo))
                if digitos:
                    from sqlalchemy import func

                    aprox = (
                        Caso.query.filter(
                            Caso.tenant_id == tenant_id,
                            func.regexp_replace(Caso.numero_processo, "[^0-9]", "", "g").contains(
                                digitos
                            ),
                        )
                        .limit(20)
                        .all()
                    )
                    for c in aprox:
                        if c.id in casos_dict:
                            continue
                        casos_dict[c.id] = {
                            "id": c.id,
                            "titulo": c.titulo,
                            "numero_processo": c.numero_processo,
                            "status": c.status,
                            "vara_juizo": c.vara_juizo,
                            "cliente_id": c.cliente_id,
                            "cliente_nome": (
                                c.cliente.nome_razao_social if getattr(c, "cliente", None) else None
                            ),
                            "motivo": "CNJ aproximado",
                            "score": 0.85,
                        }

            # 2) Match por cliente — outros casos do mesmo cliente
            if cliente_id:
                outros = (
                    Caso.query.filter(Caso.tenant_id == tenant_id, Caso.cliente_id == cliente_id)
                    .order_by(Caso.id.desc())
                    .limit(20)
                    .all()
                )
                for c in outros:
                    if c.id in casos_dict:
                        # Sobe o score se ja era CNJ exato + mesmo cliente
                        casos_dict[c.id]["motivo"] += " + cliente correspondente"
                        casos_dict[c.id]["score"] = max(casos_dict[c.id]["score"], 0.95)
                        continue
                    casos_dict[c.id] = {
                        "id": c.id,
                        "titulo": c.titulo,
                        "numero_processo": c.numero_processo,
                        "status": c.status,
                        "vara_juizo": c.vara_juizo,
                        "cliente_id": c.cliente_id,
                        "cliente_nome": (
                            c.cliente.nome_razao_social if getattr(c, "cliente", None) else None
                        ),
                        "motivo": "Outro caso do cliente",
                        "score": 0.5,
                    }

            casos_out = sorted(casos_dict.values(), key=lambda x: -x["score"])[:10]
            return {"casos": casos_out, "total": len(casos_out)}, 200

    @djen_ns.route("/triagem/grupos")
    class PublicacaoTriagemGruposAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Agrupa publicacoes pendentes em buckets: mesmo processo, "
                "cliente cadastrado, mesmo nome (novo), isoladas."
            ),
        )
        @jwt_required()
        def get(self):
            user_id = get_jwt_identity()
            from app import Cliente, User
            from djen_triagem import montar_grupos_pendentes

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            grupos = montar_grupos_pendentes(db, Cliente, Caso, PublicacaoDJEN, user.tenant_id)
            return {"grupos": grupos, "total_grupos": len(grupos)}, 200

    @djen_ns.route("/triagem/vincular-em-lote")
    class PublicacaoTriagemVincularLoteAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Vincula um conjunto de publicacoes pendentes ao mesmo Caso. "
                "Recebe pub_ids[] e ou cliente_id+caso_id (vinculo direto) "
                "ou cliente_payload+caso_payload (cria cliente/caso primeiro)."
            ),
        )
        @jwt_required()
        def post(self):
            user_id = get_jwt_identity()
            from app import Cliente, User
            from djen_triagem import analisar_publicacao

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            payload = request.get_json(silent=True) or {}
            pub_ids = payload.get("pub_ids") or []
            if not isinstance(pub_ids, list) or not pub_ids:
                djen_ns.abort(400, "pub_ids deve ser uma lista nao vazia.")

            cliente_id = payload.get("cliente_id")
            cliente_payload = payload.get("cliente_payload")
            caso_id_existente = payload.get("caso_id")
            caso_payload = payload.get("caso_payload") or {}
            papel_cliente = (payload.get("papel_cliente") or "").strip().lower()

            pubs = PublicacaoDJEN.query.filter(
                PublicacaoDJEN.id.in_(pub_ids),
                PublicacaoDJEN.tenant_id == user.tenant_id,
            ).all()
            if not pubs:
                djen_ns.abort(404, "Nenhuma publicacao encontrada para os ids informados.")

            cliente = None
            cliente_criado = False
            if cliente_id:
                cliente = Cliente.query.filter_by(
                    id=int(cliente_id), tenant_id=user.tenant_id
                ).first()
                if not cliente:
                    djen_ns.abort(404, "Cliente nao encontrado para este tenant.")
            elif cliente_payload:
                if papel_cliente not in {"autor", "reu"}:
                    djen_ns.abort(400, "papel_cliente obrigatorio quando criar cliente novo.")
                nome_cliente = (cliente_payload.get("nome_razao_social") or "").strip()
                if not nome_cliente:
                    djen_ns.abort(400, "cliente_payload.nome_razao_social obrigatorio.")
                tipo_pessoa = (cliente_payload.get("tipo_pessoa") or "PF").strip().upper()
                if tipo_pessoa not in {"PF", "PJ"}:
                    djen_ns.abort(400, "tipo_pessoa deve ser PF ou PJ.")
                cpf_cnpj = (cliente_payload.get("cpf_cnpj") or "").strip()[:20] or None

                # ANTI-DUPLICATA: antes de criar, busca cliente existente do
                # tenant que bata por (a) CPF/CNPJ exato (digitos) ou
                # (b) nome normalizado. Reusa o existente em vez de criar novo.
                from djen_triagem import normalizar_nome  # noqa: PLC0415

                cliente_existente = None
                if cpf_cnpj:
                    digitos_novo = re.sub(r"\D", "", cpf_cnpj)
                    if digitos_novo and not digitos_novo.startswith("DJEN"):
                        cands = Cliente.query.filter(
                            Cliente.tenant_id == user.tenant_id,
                            Cliente.cpf_cnpj.isnot(None),
                            Cliente.cpf_cnpj != "",
                        ).all()
                        for c in cands:
                            d = re.sub(r"\D", "", c.cpf_cnpj or "")
                            if d == digitos_novo:
                                cliente_existente = c
                                break
                if not cliente_existente and nome_cliente:
                    nome_norm = normalizar_nome(nome_cliente)
                    if nome_norm:
                        cands = Cliente.query.filter(
                            Cliente.tenant_id == user.tenant_id,
                        ).all()
                        for c in cands:
                            if normalizar_nome(c.nome_razao_social or "") == nome_norm:
                                cliente_existente = c
                                break

                if cliente_existente:
                    cliente = cliente_existente
                    cliente_criado = False
                else:
                    if not cpf_cnpj:
                        base = f"DJEN-LOTE-{pubs[0].id}"
                        documento = base
                        contador = 1
                        while Cliente.query.filter_by(
                            tenant_id=user.tenant_id, user_id=user.id, cpf_cnpj=documento
                        ).first():
                            contador += 1
                            documento = f"{base}-{contador}"[:20]
                        cpf_cnpj = documento

                    cliente = Cliente(
                        tenant_id=user.tenant_id,
                        user_id=user.id,
                        nome_razao_social=nome_cliente[:200],
                        tipo_pessoa=tipo_pessoa,
                        cpf_cnpj=cpf_cnpj,
                        email=(cliente_payload.get("email") or "").strip()[:120] or None,
                        notas_gerais="Criado via triagem em lote (DJEN).",
                    )
                    db.session.add(cliente)
                    db.session.flush()
                    cliente_criado = True
            else:
                djen_ns.abort(400, "Informe cliente_id ou cliente_payload.")

            # Determina o Caso a vincular
            caso_obj = None
            caso_criado = False
            if caso_id_existente:
                caso_obj = Caso.query.filter_by(
                    id=int(caso_id_existente), tenant_id=user.tenant_id
                ).first()
                if not caso_obj:
                    djen_ns.abort(404, "Caso nao encontrado para este tenant.")
            else:
                # Cria 1 caso novo a partir de caso_payload + dados da primeira pub
                pub_principal = pubs[0]
                analise = analisar_publicacao(pub_principal)
                titulo = (
                    caso_payload.get("titulo")
                    or f"Processo {analise.get('numero_processo') or pub_principal.numero_processo or pub_principal.id}"
                )
                numero_processo = (
                    caso_payload.get("numero_processo")
                    or analise.get("numero_processo")
                    or pub_principal.numero_processo
                )
                if numero_processo:
                    existente = Caso.query.filter_by(
                        tenant_id=user.tenant_id, numero_processo=numero_processo
                    ).first()
                    if existente:
                        # Reusa o caso existente em vez de duplicar
                        caso_obj = existente
                if caso_obj is None:
                    # Trunca defensivamente todos os campos string para os
                    # tamanhos do schema. A IA pode retornar campos enormes
                    # (ex.: tipo_acao com texto inteiro da decisao colado).
                    def _trim(v, n):
                        if v is None:
                            return None
                        s = str(v).strip()
                        return s[:n] if s else None

                    tipo_acao_raw = (
                        caso_payload.get("tipo_acao")
                        or analise.get("classe_processual")
                        or pub_principal.nome_classe
                    )
                    vara_juizo_raw = caso_payload.get("vara_juizo") or pub_principal.nome_orgao
                    comarca_raw = caso_payload.get("comarca") or analise.get("comarca")

                    caso_obj = Caso(
                        tenant_id=user.tenant_id,
                        user_id=user.id,
                        cliente_id=cliente.id,
                        titulo=_trim(titulo, 200),
                        numero_processo=_trim(numero_processo, 30),
                        tipo_acao=_trim(tipo_acao_raw, 100),
                        vara_juizo=_trim(vara_juizo_raw, 100),
                        comarca=_trim(comarca_raw, 100),
                        valor_causa=_parse_decimal_or_none(
                            caso_payload.get("valor_causa") or analise.get("valor_causa")
                        ),
                        parte_contraria=_trim(caso_payload.get("parte_contraria"), 200),
                        status="Ativo",
                        notas_caso=caso_payload.get("notas_caso")
                        or "Caso criado via triagem em lote (DJEN).",
                    )
                    db.session.add(caso_obj)
                    db.session.flush()
                    caso_criado = True

            # Vincula todas as pubs
            vinculadas = 0
            ja_vinculadas = 0
            for pub in pubs:
                if pub.caso_id:
                    ja_vinculadas += 1
                    continue
                pub.caso_id = caso_obj.id
                pub.status_origem = "revisado_manual"
                vinculadas += 1

            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                current_app.logger.error("djen_vincular_lote_falha: %s", exc)
                djen_ns.abort(500, "Falha ao salvar.")

            return {
                "cliente_id": cliente.id,
                "cliente_criado": cliente_criado,
                "caso_id": caso_obj.id,
                "caso_criado": caso_criado,
                "vinculadas": vinculadas,
                "ja_vinculadas": ja_vinculadas,
                "total_recebidas": len(pubs),
            }, 200

    @djen_ns.route("/triagem/<int:pub_id>/analise-ia")
    class PublicacaoTriagemAnaliseIAAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Roda Gemini sobre a publicacao e retorna analise estruturada para "
                "o wizard de triagem assistida: partes (autoras/reus) com docs/oab "
                "associados, dados do caso (numero, classe, valor, comarca, vara, "
                "tipo_acao). Custo: ~\\$0.001/chamada."
            ),
        )
        @jwt_required()
        def get(self, pub_id):
            user_id = get_jwt_identity()
            from app import User
            from djen_triagem import analisar_publicacao_com_fallback_ia

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")

            # Sempre tenta IA mesmo se confianca regex >= limiar — neste fluxo o
            # usuario pediu explicitamente para reconhecer dados pra cadastrar
            # (background do botao "Cadastrar com IA"), entao queremos a IA.
            analise = analisar_publicacao_com_fallback_ia(pub, limiar=1.1)

            # Tenta classificar cada parte com possiveis docs/oab a partir do texto
            texto = pub.texto or ""
            import re

            from djen_triagem import CPF_CNPJ_REGEX

            docs_no_texto = [re.sub(r"\D", "", d) for d in CPF_CNPJ_REGEX.findall(texto) if d]

            def _enriquecer_parte(nome, papel):
                nome_norm = re.sub(r"\s+", " ", (nome or "").strip())
                if not nome_norm:
                    return None
                # Heuristica simples: tipo_pessoa pelo doc associado (se tiver)
                # ou pelo nome (LTDA/SA/ME -> PJ).
                tipo_pessoa = "PF"
                cpf_cnpj_sugerido = None
                up = nome_norm.upper()
                marcadores_pj = (" LTDA", " S/A", " S.A", " SA", " ME ", " EIRELI", " EPP")
                if any(m in f" {up} " for m in marcadores_pj):
                    tipo_pessoa = "PJ"

                # Tenta achar um doc no texto cuja vizinhanca menciona o nome
                if nome_norm and docs_no_texto:
                    primeiro_token = nome_norm.split()[0].upper()
                    if primeiro_token in texto.upper():
                        idx = texto.upper().find(primeiro_token)
                        # Procura doc num raio de 200 chars do nome
                        janela = texto[max(0, idx - 100) : idx + 300]
                        m = CPF_CNPJ_REGEX.search(janela)
                        if m:
                            doc_bruto = m.group(0)
                            digitos = re.sub(r"\D", "", doc_bruto)
                            if len(digitos) == 14:
                                tipo_pessoa = "PJ"
                                cpf_cnpj_sugerido = (
                                    f"{digitos[:2]}.{digitos[2:5]}.{digitos[5:8]}/"
                                    f"{digitos[8:12]}-{digitos[12:]}"
                                )
                            elif len(digitos) == 11:
                                tipo_pessoa = "PF"
                                cpf_cnpj_sugerido = (
                                    f"{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}"
                                )

                return {
                    "nome": nome_norm,
                    "papel": papel,
                    "tipo_pessoa": tipo_pessoa,
                    "cpf_cnpj_sugerido": cpf_cnpj_sugerido,
                }

            partes_estruturadas = []

            # Caminho preferido: a IA ja retornou objetos estruturados (com
            # cpf_cnpj associado a cada parte). Nesse caso usamos direto.
            for parte_obj in analise.get("partes_autoras_estruturadas") or []:
                nome_obj = (parte_obj.get("nome") or "").strip()
                if not nome_obj:
                    continue
                partes_estruturadas.append(
                    {
                        "nome": nome_obj,
                        "papel": "autor",
                        "tipo_pessoa": parte_obj.get("tipo_pessoa") or "PF",
                        "cpf_cnpj_sugerido": parte_obj.get("cpf_cnpj"),
                        "advogados": parte_obj.get("advogados") or [],
                        "oabs": parte_obj.get("oabs") or [],
                    }
                )
            for parte_obj in analise.get("partes_reus_estruturadas") or []:
                nome_obj = (parte_obj.get("nome") or "").strip()
                if not nome_obj:
                    continue
                partes_estruturadas.append(
                    {
                        "nome": nome_obj,
                        "papel": "reu",
                        "tipo_pessoa": parte_obj.get("tipo_pessoa") or "PF",
                        "cpf_cnpj_sugerido": parte_obj.get("cpf_cnpj"),
                        "advogados": parte_obj.get("advogados") or [],
                        "oabs": parte_obj.get("oabs") or [],
                    }
                )

            # Fallback: regex retornou só strings — enriquece com heuristica.
            if not partes_estruturadas:
                for nome in analise.get("partes_autoras") or []:
                    parte = _enriquecer_parte(nome, "autor")
                    if parte:
                        partes_estruturadas.append(parte)
                for nome in analise.get("partes_reus") or []:
                    parte = _enriquecer_parte(nome, "reu")
                    if parte:
                        partes_estruturadas.append(parte)

            dados_caso = {
                "titulo": (
                    f"Processo {analise.get('numero_processo') or pub.numero_processo or pub.id}"
                ),
                "numero_processo": analise.get("numero_processo") or pub.numero_processo,
                "tipo_acao": analise.get("classe_processual") or pub.nome_classe,
                "vara_juizo": pub.nome_orgao,
                "comarca": analise.get("comarca"),
                "valor_causa": analise.get("valor_causa"),
                "tribunal": analise.get("tribunal") or pub.sigla_tribunal,
                "assunto_principal": analise.get("assunto_principal"),
            }

            return {
                "publicacao": pub.to_dict(),
                "analise": analise,
                "partes": partes_estruturadas,
                "dados_caso_sugeridos": dados_caso,
                "fonte_analise": analise.get("fonte_analise", "regex"),
            }, 200

    @djen_ns.route("/triagem/<int:pub_id>/criar-cliente-caso")
    class PublicacaoTriagemCriarCasoAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description="Cria cliente/caso a partir da publicação e vincula automaticamente.",
        )
        @jwt_required()
        def post(self, pub_id):
            """Ação manual segura da triagem: cria cliente + caso e vincula a publicação."""
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")

            payload = request.get_json(silent=True) or {}
            result, status_code = _processar_triagem_criar_cliente_caso(user, pub, payload)
            if status_code == 409:
                db.session.rollback()
                return result, 409

            db.session.commit()
            return result, status_code

    @djen_ns.route("/triagem/processar-lote")
    class PublicacaoTriagemProcessarLoteAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description="Processa várias publicações da triagem de uma vez.",
        )
        @jwt_required()
        def post(self):
            """Processa lote de publicações: cria cliente/caso e vincula em sequência."""
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            payload = request.get_json(silent=True) or {}
            pub_ids = payload.get("pub_ids") or []
            if not isinstance(pub_ids, list) or len(pub_ids) == 0:
                djen_ns.abort(400, "Informe pub_ids como lista não vazia.")

            resultados = []
            processadas = 0
            erros = 0

            for pub_id in pub_ids:
                try:
                    pub_id_int = int(pub_id)
                except (TypeError, ValueError):
                    erros += 1
                    resultados.append(
                        {
                            "pub_id": pub_id,
                            "ok": False,
                            "erro": "pub_id inválido.",
                        }
                    )
                    continue

                pub = PublicacaoDJEN.query.filter_by(
                    id=pub_id_int, tenant_id=user.tenant_id
                ).first()
                if not pub:
                    erros += 1
                    resultados.append(
                        {
                            "pub_id": pub_id_int,
                            "ok": False,
                            "erro": "Publicação não encontrada.",
                        }
                    )
                    continue

                try:
                    result, status_code = _processar_triagem_criar_cliente_caso(
                        user, pub, payload={}
                    )
                    if status_code == 409:
                        erros += 1
                        resultados.append(
                            {
                                "pub_id": pub_id_int,
                                "ok": False,
                                "erro": result.get("mensagem") or "Conflito de número de processo.",
                                "detalhe": result,
                            }
                        )
                    else:
                        processadas += 1
                        resultados.append(
                            {
                                "pub_id": pub_id_int,
                                "ok": True,
                                "resultado": result,
                            }
                        )
                except Exception as e:
                    db.session.rollback()
                    erros += 1
                    resultados.append(
                        {
                            "pub_id": pub_id_int,
                            "ok": False,
                            "erro": str(e),
                        }
                    )

            db.session.commit()

            return {
                "message": "Processamento em lote concluído.",
                "total_recebidas": len(pub_ids),
                "processadas": processadas,
                "erros": erros,
                "resultados": resultados,
            }, 200

    @djen_ns.route("/triagem/<int:pub_id>/mesclar")
    class PublicacaoTriagemMesclarAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description="Vincula uma publicação a um caso existente (ação manual).",
        )
        @jwt_required()
        def post(self, pub_id):
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            payload = request.json or {}
            caso_id = payload.get("caso_id")
            if not caso_id:
                djen_ns.abort(400, "caso_id é obrigatório.")

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")

            caso = Caso.query.filter_by(
                id=int(caso_id), tenant_id=user.tenant_id, user_id=user.id
            ).first()
            if not caso:
                djen_ns.abort(404, "Caso não encontrado para este usuário/tenant.")

            pub.caso_id = caso.id
            pub.lida = True
            pub.triagem_ignorada = False
            pub.status_origem = "revisado_manual"
            _registrar_decisao(
                pub=pub,
                user_id=user.id,
                acao="mesclar",
                origem_acao="manual",
                caso_id=caso.id,
                motivo="Mesclagem manual na triagem",
            )
            db.session.commit()

            return {
                "message": "Publicação vinculada manualmente ao caso.",
                "publicacao": pub.to_dict(),
                "caso": {
                    "id": caso.id,
                    "titulo": caso.titulo,
                    "numero_processo": caso.numero_processo,
                },
            }, 200

    @djen_ns.route("/triagem/<int:pub_id>/vincular-caso")
    class PublicacaoTriagemVincularCasoAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description="Vincula uma publicação da triagem a um caso existente.",
        )
        @jwt_required()
        def post(self, pub_id):
            user_id = get_jwt_identity()
            from app import User
            from djen_triagem import analisar_publicacao

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            payload = request.json or {}
            caso_id = payload.get("caso_id")
            if not caso_id:
                djen_ns.abort(400, "caso_id é obrigatório.")

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")

            caso = Caso.query.filter_by(id=int(caso_id), tenant_id=user.tenant_id).first()
            if not caso:
                djen_ns.abort(404, "Caso não encontrado para este tenant.")

            analise = analisar_publicacao(pub)
            pub.caso_id = caso.id
            pub.lida = True
            pub.triagem_ignorada = False
            pub.status_origem = "criado_automaticamente"

            _registrar_decisao(
                pub=pub,
                user_id=user.id,
                acao="mesclar",
                origem_acao="manual",
                caso_id=caso.id,
                confianca=analise.get("confianca"),
                motivo="Vinculação manual a caso existente na triagem",
                payload=payload,
            )
            db.session.commit()

            return {
                "message": "Publicação vinculada ao caso existente.",
                "publicacao": pub.to_dict(),
                "caso": {
                    "id": caso.id,
                    "titulo": caso.titulo,
                    "numero_processo": caso.numero_processo,
                },
            }, 200

    @djen_ns.route("/triagem/<int:pub_id>/ignorar")
    class PublicacaoTriagemIgnorarAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken", description="Marca uma publicação da triagem como ignorada."
        )
        @jwt_required()
        def post(self, pub_id):
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")

            payload = request.json or {}
            motivo = (payload.get("motivo") or "Sem ação necessária").strip()

            pub.triagem_ignorada = True
            pub.status_origem = "ignorado"
            pub.lida = True
            anotacao = f"[TRIAGEM DJEN] Ignorado: {motivo}"
            pub.notas = f"{pub.notas}\n{anotacao}".strip() if pub.notas else anotacao
            _registrar_decisao(
                pub=pub,
                user_id=user.id,
                acao="ignorar",
                origem_acao="manual",
                motivo=motivo,
                payload={"motivo": motivo},
            )
            db.session.commit()

            return {
                "message": "Publicação ignorada com sucesso.",
                "publicacao": pub.to_dict(),
            }, 200

    @djen_ns.route("/publicacoes/<int:pub_id>")
    class PublicacaoDetailAPI(Resource):
        @djen_ns.doc(security="jsonWebToken")
        @jwt_required()
        def get(self, pub_id):
            """Retorna o detalhe de uma publicação."""
            user = _get_user_or_401()
            pub = _get_scoped_or_404(
                PublicacaoDJEN, user, pub_id, "PublicacaoDJEN", "Publicação não encontrada."
            )
            return pub.to_dict()

        @djen_ns.expect(pub_patch_dto)
        @djen_ns.doc(security="jsonWebToken")
        @jwt_required()
        def patch(self, pub_id):
            """Marca como lida, vincula a caso ou adiciona notas."""
            user_id = get_jwt_identity()
            user = _get_user_or_401()
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")
            pub = _get_scoped_or_404(
                PublicacaoDJEN, user, pub_id, "PublicacaoDJEN", "Publicação não encontrada."
            )
            data = request.json or {}
            if "lida" in data:
                pub.lida = bool(data["lida"])
            if "caso_id" in data:
                caso_id = data["caso_id"]
                if caso_id is not None:
                    caso = Caso.query.filter_by(
                        id=int(caso_id), user_id=int(user_id), tenant_id=user.tenant_id
                    ).first()
                    if not caso:
                        djen_ns.abort(404, "Caso não encontrado ou sem permissão.")
                    pub.status_origem = "revisado_manual"
                    pub.triagem_ignorada = False
                    _registrar_decisao(
                        pub=pub,
                        user_id=int(user_id),
                        acao="mesclar",
                        origem_acao="manual",
                        caso_id=caso.id,
                        motivo="Vínculo manual por PATCH",
                    )
                pub.caso_id = caso_id
            if "notas" in data:
                pub.notas = data["notas"]
            db.session.commit()
            return pub.to_dict()

    @djen_ns.route("/publicacoes/<int:pub_id>/reclassificar")
    class PublicacaoReclassificarAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Epic #2 (#176): força reclassificação via IA da publicação, "
                "ignorando short-circuit. Util quando o usuario discorda da "
                "classificacao automatica e quer empurrar pro Gemini de novo."
            ),
        )
        @jwt_required()
        def post(self, pub_id):
            user = _get_user_or_401()
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")
            pub = _get_scoped_or_404(
                PublicacaoDJEN, user, pub_id, "PublicacaoDJEN", "Publicação não encontrada."
            )
            from djen_classifier import classificar_publicacao  # noqa: PLC0415
            from gemini_service import get_gemini_client, is_enabled  # noqa: PLC0415

            if not is_enabled():
                djen_ns.abort(503, "Servico IA indisponivel.")
            modelo = current_app.config.get("GEMINI_TRIAGEM_MODEL", "gemini-2.5-flash")
            resultado = classificar_publicacao(pub, get_gemini_client(), modelo)
            if resultado["importante"] is None:
                djen_ns.abort(502, "Falha ao classificar via IA. Tente novamente.")
            pub.importante = resultado["importante"]
            pub.classificado_em = resultado["classificado_em"]
            pub.classificacao_motivo = resultado["motivo"]
            db.session.commit()
            return pub.to_dict()

    @djen_ns.route("/publicacoes/<int:pub_id>/certidao")
    class PublicacaoCertidaoAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description="Baixa a certidão PDF da publicação diretamente do CNJ.",
        )
        @jwt_required()
        def get(self, pub_id):
            """Proxy para baixar a certidão da publicação no CNJ."""
            _ = get_jwt_identity()
            from djen_service import DjenAPIError, obter_certidao

            user = _get_user_or_401()
            pub = _get_scoped_or_404(
                PublicacaoDJEN, user, pub_id, "PublicacaoDJEN", "Publicação não encontrada."
            )
            if not pub.hash_comunicacao:
                djen_ns.abort(422, "Esta publicação não possui hash para emissão de certidão.")
            try:
                conteudo, content_type = obter_certidao(pub.hash_comunicacao)
                return send_file(
                    io.BytesIO(conteudo),
                    mimetype=content_type or "application/pdf",
                    as_attachment=True,
                    download_name=f"certidao_djen_{pub_id}.pdf",
                )
            except DjenAPIError as e:
                djen_ns.abort(502, f"Erro ao buscar certidão no CNJ: {str(e)}")

    # ── Sincronização manual ──────────────────────────────────────────────────
    @djen_ns.route("/sync")
    class DjenSyncAPI(Resource):
        @djen_ns.expect(sync_input_dto)
        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Enfileira sync DJEN para o tenant atual. Retorna 202 + job_id."
                " Use GET /djen/sync/<id> para acompanhar status."
            ),
        )
        @jwt_required()
        def post(self):
            """Enfileira sync DJEN (B1 2026-05-01: async via djen-worker)."""
            user_id = get_jwt_identity()
            from app import User
            from models import DjenSyncJob

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")
            data = request.json or {}
            try:
                dias = int(data.get("dias", 30))
            except (TypeError, ValueError):
                dias = 30
            dias = max(1, min(dias, 365))

            # De-duplicacao simples: se ja ha job pending OR running para o
            # mesmo tenant, reusar (em vez de empilhar varios). Evita rajadas
            # se o user clicar 5x no botao.
            existente = (
                DjenSyncJob.query.filter(
                    DjenSyncJob.tenant_id == user.tenant_id,
                    DjenSyncJob.status.in_(["pending", "running"]),
                )
                .order_by(DjenSyncJob.criado_em.desc())
                .first()
            )
            if existente:
                return {
                    "message": "Sync ja esta em andamento.",
                    "job_id": existente.id,
                    "status": existente.status,
                    "reused": True,
                }, 202

            job = DjenSyncJob(
                tenant_id=user.tenant_id,
                user_id=user.id,
                status="pending",
                lookback_days=dias,
            )
            db.session.add(job)
            db.session.commit()

            logger.info(
                "djen_sync_enqueued",
                extra={
                    "event": "djen_sync_enqueued",
                    "job_id": job.id,
                    "tenant_id": user.tenant_id,
                    "lookback_days": dias,
                },
            )

            return {
                "message": "Sync enfileirado. Processamento em background.",
                "job_id": job.id,
                "status": "pending",
            }, 202

    @djen_ns.route("/sync/diario")
    class DjenSyncDiarioAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description=(
                "Sync DJEN automatico do dia. Se ja houve um job concluido com "
                "sucesso para este tenant em qualquer hora do dia atual (timezone "
                "America/Sao_Paulo), retorna 200 com skipped=true. Caso contrario, "
                "enfileira novo sync (lookback default 7 dias) e retorna 202. "
                "Frontend deve chamar este endpoint na primeira renderizacao do dia."
            ),
        )
        @jwt_required()
        def post(self):
            from datetime import datetime as _dt
            from zoneinfo import ZoneInfo

            from app import User
            from models import DjenSyncJob

            user_id = get_jwt_identity()
            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                # Nao e erro: tenants sem DJEN habilitado simplesmente skipam.
                return {"skipped": True, "motivo": "djen_nao_habilitado"}, 200

            # Ja teve sync hoje? Considera "hoje" no fuso de Sao Paulo (cliente
            # tem expectativa de "primeira vez no dia" pelo dia LOCAL, nao UTC).
            try:
                tz = ZoneInfo("America/Sao_Paulo")
            except Exception:
                tz = None
            agora_local = _dt.now(tz=tz) if tz else _dt.utcnow()
            inicio_dia = agora_local.replace(hour=0, minute=0, second=0, microsecond=0)
            # criado_em e UTC naive no banco — converte inicio_dia local pra UTC.
            inicio_dia_utc = (
                inicio_dia.astimezone(ZoneInfo("UTC")).replace(tzinfo=None) if tz else inicio_dia
            )

            ja_hoje = (
                DjenSyncJob.query.filter(
                    DjenSyncJob.tenant_id == user.tenant_id,
                    DjenSyncJob.criado_em >= inicio_dia_utc,
                    # Status reais do DjenSyncJob: pending | running | done | failed.
                    # Bug original usava "success" — dedup nunca matched, cada visita
                    # criava job novo (gasto de chamada DJEN). Inclui "failed" pra
                    # NAO refazer um sync que falhou hoje (deixa o user clicar manual
                    # no botao se quiser tentar de novo).
                    DjenSyncJob.status.in_(["pending", "running", "done", "failed"]),
                )
                .order_by(DjenSyncJob.criado_em.desc())
                .first()
            )
            if ja_hoje:
                return {
                    "skipped": True,
                    "motivo": "ja_sincronizado_hoje",
                    "job_id": ja_hoje.id,
                    "status": ja_hoje.status,
                }, 200

            job = DjenSyncJob(
                tenant_id=user.tenant_id,
                user_id=user.id,
                status="pending",
                lookback_days=7,
            )
            db.session.add(job)
            db.session.commit()
            logger.info(
                "djen_sync_diario_enqueued",
                extra={
                    "event": "djen_sync_diario_enqueued",
                    "job_id": job.id,
                    "tenant_id": user.tenant_id,
                },
            )
            return {
                "skipped": False,
                "job_id": job.id,
                "status": "pending",
            }, 202

    @djen_ns.route("/sync/<int:job_id>")
    class DjenSyncJobStatusAPI(Resource):
        @djen_ns.doc(
            security="jsonWebToken",
            description="Status de um job de sync DJEN (filtrado por tenant do JWT).",
        )
        @jwt_required()
        def get(self, job_id):
            user_id = get_jwt_identity()
            from app import User
            from models import DjenSyncJob

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            job = DjenSyncJob.query.get(job_id)
            if not job or job.tenant_id != user.tenant_id:
                djen_ns.abort(404, "Job nao encontrado.")
            return job.to_dict(), 200

    # ── Tribunais (proxy) ─────────────────────────────────────────────────────
    @djen_ns.route("/tribunais")
    class DjenTribunaisAPI(Resource):
        @djen_ns.doc(security="jsonWebToken")
        @jwt_required()
        def get(self):
            """Retorna a lista de tribunais disponíveis na ComunicaAPI."""
            from djen_service import DjenAPIError, listar_tribunais

            try:
                return listar_tribunais()
            except DjenAPIError as e:
                djen_ns.abort(502, f"Erro ao consultar tribunais no CNJ: {str(e)}")

    # ── Contagem de não lidas (para badge no sidebar) ─────────────────────────
    @djen_ns.route("/nao-lidas")
    class DjenNaoLidasAPI(Resource):
        @djen_ns.doc(security="jsonWebToken")
        @jwt_required()
        def get(self):
            """Retorna o total de publicações não lidas — usado para badge na sidebar."""
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                return {"count": 0}
            if not _tenant_djen_habilitado(user.tenant_id):
                return {"count": 0}
            count = PublicacaoDJEN.query.filter_by(
                tenant_id=user.tenant_id, lida=False, triagem_ignorada=False
            ).count()
            return {"count": count}

    @djen_ns.route("/qualidade")
    class DjenQualidadeAPI(Resource):
        @djen_ns.doc(security="jsonWebToken")
        @jwt_required()
        def get(self):
            """Métricas de qualidade para rollout gradual por tenant."""
            user_id = get_jwt_identity()
            from app import DjenVinculoDecisao, User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, "Módulo DJEN desabilitado para este tenant no rollout atual.")

            base = DjenVinculoDecisao.query.filter_by(tenant_id=user.tenant_id)
            total = base.count()
            ignoradas = base.filter_by(acao="ignorar").count()
            mescladas = base.filter_by(acao="mesclar").count()
            criadas = base.filter_by(acao="criar").count()

            publicacoes_total = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id).count()
            vinculadas = (
                PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id)
                .filter(PublicacaoDJEN.caso_id.isnot(None))
                .count()
            )

            taxa_vinculo = (
                round((vinculadas / publicacoes_total) * 100, 2) if publicacoes_total else 0.0
            )
            taxa_decisao = round((total / publicacoes_total) * 100, 2) if publicacoes_total else 0.0

            return {
                "rollout_percent": current_app.config.get("DJEN_ROLLOUT_PERCENT", 100),
                "total_publicacoes": publicacoes_total,
                "publicacoes_vinculadas": vinculadas,
                "taxa_vinculo_percent": taxa_vinculo,
                "total_decisoes": total,
                "taxa_decisao_percent": taxa_decisao,
                "decisoes_por_acao": {
                    "criar": criadas,
                    "mesclar": mescladas,
                    "ignorar": ignoradas,
                },
            }
