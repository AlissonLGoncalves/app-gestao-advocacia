# ==============================================================================
# ARQUIVO: gestao_advocacia/djen_routes.py
# Rotas da API DJEN — Diário de Justiça Eletrônico Nacional.
# Chamado via registrar_rotas_djen() de dentro de create_app() em app.py
# para evitar importação circular.
# ==============================================================================
from datetime import datetime, timedelta
import hashlib

from flask import request, send_file, current_app
from flask_restx import Resource, fields
import io


def registrar_rotas_djen(djen_ns, db, DjenOabMonitoramento, PublicacaoDJEN, Caso,
                          jwt_required, get_jwt_identity, logger):

    def _tenant_djen_habilitado(tenant_id):
        enabled_csv = (current_app.config.get('DJEN_ENABLED_TENANTS') or '').strip()
        rollout = max(0, min(int(current_app.config.get('DJEN_ROLLOUT_PERCENT', 100)), 100))

        if enabled_csv:
            enabled = {p.strip() for p in enabled_csv.split(',') if p.strip()}
            if str(tenant_id) not in enabled:
                return False

        if rollout >= 100:
            return True
        digest = hashlib.sha256(str(tenant_id).encode('utf-8')).hexdigest()
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
        if alvo and getattr(alvo, 'tenant_id', None) != user.tenant_id:
            _log_cross_tenant(user, model_name, item_id, getattr(alvo, 'tenant_id', None))
        djen_ns.abort(404, mensagem_404)

    def _registrar_decisao(pub, user_id, acao, origem_acao='manual', cliente_id=None, caso_id=None, confianca=None, motivo=None, payload=None):
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

    def _processar_triagem_criar_cliente_caso(user, pub):
        from app import Cliente
        from djen_triagem import analisar_publicacao

        if pub.caso_id:
            return {
                'message': 'Publicação já está vinculada a um caso.',
                'cliente_criado': False,
                'caso_criado': False,
                'cliente': None,
                'caso': None,
                'publicacao': pub.to_dict(),
            }

        analise = analisar_publicacao(pub)
        numero_processo = (analise.get('numero_processo') or pub.numero_processo or '').strip()

        if (analise.get('partes_autoras') or []):
            nome_cliente = analise['partes_autoras'][0]
        elif (analise.get('partes_reus') or []):
            nome_cliente = analise['partes_reus'][0]
        else:
            nome_cliente = f"Cliente DJEN {pub.id}"

        cliente = Cliente.query.filter(
            Cliente.tenant_id == user.tenant_id,
            Cliente.user_id == user.id,
            Cliente.nome_razao_social.ilike(nome_cliente),
        ).first()

        cliente_criado = False
        if not cliente:
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

            cliente = Cliente(
                tenant_id=user.tenant_id,
                user_id=user.id,
                nome_razao_social=nome_cliente[:200],
                cpf_cnpj=documento,
                tipo_pessoa='PF',
                notas_gerais='Criado automaticamente pela triagem DJEN (revisão manual recomendada).',
            )
            db.session.add(cliente)
            db.session.flush()
            cliente_criado = True

        caso = None
        if numero_processo:
            caso = Caso.query.filter_by(
                tenant_id=user.tenant_id,
                user_id=user.id,
                numero_processo=numero_processo,
            ).first()

        caso_criado = False
        if not caso:
            titulo = f"Processo {numero_processo}" if numero_processo else f"Caso DJEN #{pub.id}"
            parte_contraria = (analise.get('partes_reus') or [None])[0]
            adv_parte_contraria = (analise.get('representantes') or [None])[0]

            caso = Caso(
                tenant_id=user.tenant_id,
                user_id=user.id,
                cliente_id=cliente.id,
                titulo=titulo[:200],
                numero_processo=numero_processo or None,
                status='Ativo',
                tipo_acao=(pub.nome_classe or 'A definir')[:100],
                parte_contraria=(parte_contraria or '')[:200] or None,
                adv_parte_contraria=(adv_parte_contraria or '')[:200] or None,
                notas_caso='Caso criado automaticamente pela triagem DJEN (validar dados extraídos).',
            )
            db.session.add(caso)
            db.session.flush()
            caso_criado = True

        pub.caso_id = caso.id
        pub.lida = True
        pub.triagem_ignorada = False
        pub.status_origem = 'criado_automaticamente'

        notas_auto = f"[TRIAGEM DJEN] Vinculado ao caso #{caso.id}."
        pub.notas = f"{pub.notas}\n{notas_auto}".strip() if pub.notas else notas_auto

        _registrar_decisao(
            pub=pub,
            user_id=user.id,
            acao='criar',
            origem_acao='manual',
            cliente_id=cliente.id,
            caso_id=caso.id,
            confianca=analise.get('confianca'),
            motivo='Criação cliente/caso na triagem',
            payload={'cliente_criado': cliente_criado, 'caso_criado': caso_criado},
        )

        return {
            'message': 'Cliente/Caso processados com sucesso pela triagem.',
            'cliente_criado': cliente_criado,
            'caso_criado': caso_criado,
            'cliente': {
                'id': cliente.id,
                'nome_razao_social': cliente.nome_razao_social,
                'cpf_cnpj': cliente.cpf_cnpj,
            },
            'caso': {
                'id': caso.id,
                'titulo': caso.titulo,
                'numero_processo': caso.numero_processo,
            },
            'publicacao': pub.to_dict(),
        }

    # ── DTOs ──────────────────────────────────────────────────────────────────
    oab_input_dto = djen_ns.model('DjenOabInput', {
        'numero_oab': fields.String(required=True, description='Número da OAB (somente números ou no formato original)'),
        'uf_oab': fields.String(required=True, description='UF de inscrição da OAB, ex: PR, SP'),
        'nome_advogado': fields.String(description='Nome do advogado (opcional, apenas para identificação)'),
    })

    oab_output_dto = djen_ns.model('DjenOabOutput', {
        'id': fields.Integer(readonly=True),
        'numero_oab': fields.String(),
        'uf_oab': fields.String(),
        'nome_advogado': fields.String(),
        'ativo': fields.Boolean(),
        'ultima_sincronizacao': fields.String(),
        'data_criacao': fields.String(),
    })

    pub_output_dto = djen_ns.model('PublicacaoDjenOutput', {
        'id': fields.Integer(readonly=True),
        'djen_id': fields.Integer(),
        'hash_comunicacao': fields.String(),
        'numero_processo': fields.String(),
        'numero_processo_mascara': fields.String(),
        'sigla_tribunal': fields.String(),
        'nome_orgao': fields.String(),
        'tipo_comunicacao': fields.String(),
        'tipo_documento': fields.String(),
        'nome_classe': fields.String(),
        'data_disponibilizacao': fields.String(),
        'texto': fields.String(),
        'link': fields.String(),
        'meio': fields.String(),
        'ativo': fields.Boolean(),
        'origem_busca': fields.String(),
        'status_origem': fields.String(),
        'triagem_ignorada': fields.Boolean(),
        'lida': fields.Boolean(),
        'notas': fields.String(),
        'caso_id': fields.Integer(),
        'data_captura': fields.String(),
    })

    pub_patch_dto = djen_ns.model('PublicacaoDjenPatch', {
        'lida': fields.Boolean(description='Marcar como lida/não lida'),
        'caso_id': fields.Integer(description='Vincular a um caso existente'),
        'notas': fields.String(description='Anotações sobre esta publicação'),
    })

    sync_input_dto = djen_ns.model('DjenSyncInput', {
        'oab_id': fields.Integer(description='ID da OAB a sincronizar (omitir = todas as ativas)'),
        'dias': fields.Integer(description='Janela de busca em dias (padrão = 30, máximo = 365)', default=30),
    })

    # ── OABs monitoradas ──────────────────────────────────────────────────────
    @djen_ns.route('/oabs')
    class DjenOabListAPI(Resource):
        @djen_ns.marshal_list_with(oab_output_dto)
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def get(self):
            """Lista as OABs configuradas para monitoramento no tenant."""
            user = _get_user_or_401()
            return DjenOabMonitoramento.query.filter_by(
                tenant_id=user.tenant_id
            ).order_by(DjenOabMonitoramento.data_criacao.desc()).all()

        @djen_ns.expect(oab_input_dto, validate=True)
        @djen_ns.marshal_with(oab_output_dto, code=201)
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def post(self):
            """Cadastra uma OAB para monitoramento automático."""
            user_id = get_jwt_identity()
            user = _get_user_or_401()
            data = request.json
            numero = (data.get('numero_oab') or '').strip()
            uf = (data.get('uf_oab') or '').strip().upper()
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
                nome_advogado=(data.get('nome_advogado') or '').strip() or None,
            )
            sigla_raw = (data.get('sigla_tribunal') or '').strip().upper()
            if sigla_raw:
                oab.sigla_tribunal = sigla_raw
            db.session.add(oab)
            db.session.commit()
            return oab, 201

    @djen_ns.route('/oabs/<int:oab_id>')
    class DjenOabDetailAPI(Resource):
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def delete(self, oab_id):
            """Remove uma OAB do monitoramento."""
            user = _get_user_or_401()
            oab = _get_scoped_or_404(DjenOabMonitoramento, user, oab_id, 'DjenOabMonitoramento', 'OAB não encontrada.')
            db.session.delete(oab)
            db.session.commit()
            return '', 204

    # ── Publicações ───────────────────────────────────────────────────────────
    @djen_ns.route('/publicacoes')
    class PublicacaoListAPI(Resource):
        @djen_ns.doc(security='jsonWebToken', params={
            'lida': 'Filtrar por lida (true/false)',
            'sigla_tribunal': 'Filtrar por tribunal (ex: TJPR)',
            'numero_processo': 'Filtrar por número de processo',
            'origem': 'Filtrar por origem: oab ou processo',
            'data_inicio': 'Data início disponibilização (yyyy-mm-dd)',
            'data_fim': 'Data fim disponibilização (yyyy-mm-dd)',
            'limit': 'Itens por página (padrão 50, máx 200)',
            'offset': 'Paginação',
            'ordenar': 'Ordenação: data_desc (padrão), data_asc, tribunal_asc, orgao_asc, tipo_asc',
        })
        @jwt_required()
        def get(self):
            """Lista publicações DJEN capturadas, com filtros."""
            user_id = get_jwt_identity()
            from app import User
            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')

            q = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id)

            lida_param = request.args.get('lida')
            if lida_param is not None:
                q = q.filter_by(lida=(lida_param.lower() == 'true'))

            sigla = request.args.get('sigla_tribunal')
            if sigla:
                q = q.filter(PublicacaoDJEN.sigla_tribunal.ilike(sigla))

            numero_proc = request.args.get('numero_processo')
            if numero_proc:
                q = q.filter(PublicacaoDJEN.numero_processo.ilike(f'%{numero_proc}%'))

            origem = request.args.get('origem')
            if origem:
                q = q.filter_by(origem_busca=origem)

            data_inicio = request.args.get('data_inicio')
            if data_inicio:
                q = q.filter(PublicacaoDJEN.data_disponibilizacao >= data_inicio)

            data_fim = request.args.get('data_fim')
            if data_fim:
                q = q.filter(PublicacaoDJEN.data_disponibilizacao <= data_fim)

            limit = min(int(request.args.get('limit', 50)), 200)
            offset = int(request.args.get('offset', 0))
            total = q.count()

            ordenar = request.args.get('ordenar', 'data_desc')
            _ordem = {
                'data_asc':     PublicacaoDJEN.data_disponibilizacao.asc(),
                'tribunal_asc': PublicacaoDJEN.sigla_tribunal.asc(),
                'orgao_asc':    PublicacaoDJEN.nome_orgao.asc(),
                'tipo_asc':     PublicacaoDJEN.tipo_comunicacao.asc(),
            }
            items = q.order_by(_ordem.get(ordenar, PublicacaoDJEN.data_disponibilizacao.desc())).offset(offset).limit(limit).all()

            nao_lidas = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id, lida=False).count()

            return {
                'total': total,
                'nao_lidas': nao_lidas,
                'limit': limit,
                'offset': offset,
                'items': [p.to_dict() for p in items],
            }

    @djen_ns.route('/triagem')
    class PublicacaoTriagemAPI(Resource):
        @djen_ns.doc(security='jsonWebToken', params={
            'limit': 'Itens por página (padrão 20, máx 100)',
            'offset': 'Paginação',
            'somente_pendentes': 'Quando true, retorna apenas publicações sem caso vinculado (padrão true)',
        })
        @jwt_required()
        def get(self):
            """Fila de triagem com análise de partes/representantes e sugestões de vínculo."""
            user_id = get_jwt_identity()
            from app import User, Cliente
            from djen_triagem import analisar_publicacao, sugerir_vinculos

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')

            q = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id, triagem_ignorada=False)

            somente_pendentes = request.args.get('somente_pendentes', 'true').lower() != 'false'
            if somente_pendentes:
                q = q.filter(PublicacaoDJEN.caso_id.is_(None))

            limit = min(int(request.args.get('limit', 20)), 100)
            offset = int(request.args.get('offset', 0))

            total = q.count()
            pubs = q.order_by(PublicacaoDJEN.data_disponibilizacao.desc()).offset(offset).limit(limit).all()

            itens = []
            for pub in pubs:
                analise = analisar_publicacao(pub)
                sugestoes = sugerir_vinculos(db, Cliente, Caso, user.tenant_id, analise)
                itens.append({
                    'publicacao': pub.to_dict(),
                    'analise': analise,
                    'sugestoes': sugestoes,
                })

            return {
                'total': total,
                'limit': limit,
                'offset': offset,
                'items': itens,
            }, 200

    @djen_ns.route('/triagem/<int:pub_id>/criar-cliente-caso')
    class PublicacaoTriagemCriarCasoAPI(Resource):
        @djen_ns.doc(security='jsonWebToken', description="Cria cliente/caso a partir da publicação e vincula automaticamente.")
        @jwt_required()
        def post(self, pub_id):
            """Ação manual segura da triagem: cria cliente + caso e vincula a publicação."""
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")

            result = _processar_triagem_criar_cliente_caso(user, pub)
            db.session.commit()
            return result, 200

    @djen_ns.route('/triagem/processar-lote')
    class PublicacaoTriagemProcessarLoteAPI(Resource):
        @djen_ns.doc(security='jsonWebToken', description="Processa várias publicações da triagem de uma vez.")
        @jwt_required()
        def post(self):
            """Processa lote de publicações: cria cliente/caso e vincula em sequência."""
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')

            payload = request.json or {}
            pub_ids = payload.get('pub_ids') or []
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
                    resultados.append({
                        'pub_id': pub_id,
                        'ok': False,
                        'erro': 'pub_id inválido.',
                    })
                    continue

                pub = PublicacaoDJEN.query.filter_by(id=pub_id_int, tenant_id=user.tenant_id).first()
                if not pub:
                    erros += 1
                    resultados.append({
                        'pub_id': pub_id_int,
                        'ok': False,
                        'erro': 'Publicação não encontrada.',
                    })
                    continue

                try:
                    result = _processar_triagem_criar_cliente_caso(user, pub)
                    processadas += 1
                    resultados.append({
                        'pub_id': pub_id_int,
                        'ok': True,
                        'resultado': result,
                    })
                except Exception as e:
                    db.session.rollback()
                    erros += 1
                    resultados.append({
                        'pub_id': pub_id_int,
                        'ok': False,
                        'erro': str(e),
                    })

            db.session.commit()

            return {
                'message': 'Processamento em lote concluído.',
                'total_recebidas': len(pub_ids),
                'processadas': processadas,
                'erros': erros,
                'resultados': resultados,
            }, 200

    @djen_ns.route('/triagem/<int:pub_id>/mesclar')
    class PublicacaoTriagemMesclarAPI(Resource):
        @djen_ns.doc(security='jsonWebToken', description='Vincula uma publicação a um caso existente (ação manual).')
        @jwt_required()
        def post(self, pub_id):
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')

            payload = request.json or {}
            caso_id = payload.get('caso_id')
            if not caso_id:
                djen_ns.abort(400, 'caso_id é obrigatório.')

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, 'Publicação não encontrada.')

            caso = Caso.query.filter_by(id=int(caso_id), tenant_id=user.tenant_id, user_id=user.id).first()
            if not caso:
                djen_ns.abort(404, 'Caso não encontrado para este usuário/tenant.')

            pub.caso_id = caso.id
            pub.lida = True
            pub.triagem_ignorada = False
            pub.status_origem = 'revisado_manual'
            _registrar_decisao(
                pub=pub,
                user_id=user.id,
                acao='mesclar',
                origem_acao='manual',
                caso_id=caso.id,
                motivo='Mesclagem manual na triagem',
            )
            db.session.commit()

            return {
                'message': 'Publicação vinculada manualmente ao caso.',
                'publicacao': pub.to_dict(),
                'caso': {
                    'id': caso.id,
                    'titulo': caso.titulo,
                    'numero_processo': caso.numero_processo,
                },
            }, 200

    @djen_ns.route('/triagem/<int:pub_id>/ignorar')
    class PublicacaoTriagemIgnorarAPI(Resource):
        @djen_ns.doc(security='jsonWebToken', description='Marca uma publicação da triagem como ignorada.')
        @jwt_required()
        def post(self, pub_id):
            user_id = get_jwt_identity()
            from app import User

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, 'Publicação não encontrada.')

            payload = request.json or {}
            motivo = (payload.get('motivo') or 'Sem ação necessária').strip()

            pub.triagem_ignorada = True
            pub.status_origem = 'ignorado'
            pub.lida = True
            anotacao = f"[TRIAGEM DJEN] Ignorado: {motivo}"
            pub.notas = f"{pub.notas}\n{anotacao}".strip() if pub.notas else anotacao
            _registrar_decisao(
                pub=pub,
                user_id=user.id,
                acao='ignorar',
                origem_acao='manual',
                motivo=motivo,
                payload={'motivo': motivo},
            )
            db.session.commit()

            return {
                'message': 'Publicação ignorada com sucesso.',
                'publicacao': pub.to_dict(),
            }, 200

    @djen_ns.route('/publicacoes/<int:pub_id>')
    class PublicacaoDetailAPI(Resource):
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def get(self, pub_id):
            """Retorna o detalhe de uma publicação."""
            user = _get_user_or_401()
            pub = _get_scoped_or_404(PublicacaoDJEN, user, pub_id, 'PublicacaoDJEN', 'Publicação não encontrada.')
            return pub.to_dict()

        @djen_ns.expect(pub_patch_dto)
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def patch(self, pub_id):
            """Marca como lida, vincula a caso ou adiciona notas."""
            user_id = get_jwt_identity()
            user = _get_user_or_401()
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')
            pub = _get_scoped_or_404(PublicacaoDJEN, user, pub_id, 'PublicacaoDJEN', 'Publicação não encontrada.')
            data = request.json or {}
            if 'lida' in data:
                pub.lida = bool(data['lida'])
            if 'caso_id' in data:
                caso_id = data['caso_id']
                if caso_id is not None:
                    caso = Caso.query.filter_by(id=int(caso_id), user_id=int(user_id), tenant_id=user.tenant_id).first()
                    if not caso:
                        djen_ns.abort(404, "Caso não encontrado ou sem permissão.")
                    pub.status_origem = 'revisado_manual'
                    pub.triagem_ignorada = False
                    _registrar_decisao(
                        pub=pub,
                        user_id=int(user_id),
                        acao='mesclar',
                        origem_acao='manual',
                        caso_id=caso.id,
                        motivo='Vínculo manual por PATCH',
                    )
                pub.caso_id = caso_id
            if 'notas' in data:
                pub.notas = data['notas']
            db.session.commit()
            return pub.to_dict()

    @djen_ns.route('/publicacoes/<int:pub_id>/certidao')
    class PublicacaoCertidaoAPI(Resource):
        @djen_ns.doc(security='jsonWebToken', description="Baixa a certidão PDF da publicação diretamente do CNJ.")
        @jwt_required()
        def get(self, pub_id):
            """Proxy para baixar a certidão da publicação no CNJ."""
            _ = get_jwt_identity()
            from djen_service import obter_certidao, DjenAPIError
            user = _get_user_or_401()
            pub = _get_scoped_or_404(PublicacaoDJEN, user, pub_id, 'PublicacaoDJEN', 'Publicação não encontrada.')
            if not pub.hash_comunicacao:
                djen_ns.abort(422, "Esta publicação não possui hash para emissão de certidão.")
            try:
                conteudo, content_type = obter_certidao(pub.hash_comunicacao)
                return send_file(
                    io.BytesIO(conteudo),
                    mimetype=content_type or 'application/pdf',
                    as_attachment=True,
                    download_name=f'certidao_djen_{pub_id}.pdf',
                )
            except DjenAPIError as e:
                djen_ns.abort(502, f"Erro ao buscar certidão no CNJ: {str(e)}")

    # ── Sincronização manual ──────────────────────────────────────────────────
    @djen_ns.route('/sync')
    class DjenSyncAPI(Resource):
        @djen_ns.expect(sync_input_dto)
        @djen_ns.doc(security='jsonWebToken', description="Dispara a sincronização manualmente.")
        @jwt_required()
        def post(self):
            """Dispara busca imediata no DJEN para as OABs e processos do tenant."""
            user_id = get_jwt_identity()
            from app import User
            from djen_tasks import job_monitorar_djen
            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')
            data = request.json or {}
            try:
                dias = int(data.get('dias', 30))
            except (TypeError, ValueError):
                dias = 30
            dias = max(1, min(dias, 365))

            from flask import current_app
            try:
                resumo = job_monitorar_djen(
                    current_app._get_current_object(),
                    lookback_days=dias,
                    tenant_id=user.tenant_id,
                    force=True,
                )
                return {
                    'message': f"Sincronização concluída (janela: {dias} dia(s)).",
                    'resumo': resumo,
                }, 200
            except Exception as e:
                logger.error(f"Erro no sync DJEN manual: {e}", exc_info=True)
                djen_ns.abort(500, "Erro ao iniciar sincronização.")

    # ── Tribunais (proxy) ─────────────────────────────────────────────────────
    @djen_ns.route('/tribunais')
    class DjenTribunaisAPI(Resource):
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def get(self):
            """Retorna a lista de tribunais disponíveis na ComunicaAPI."""
            from djen_service import listar_tribunais, DjenAPIError
            try:
                return listar_tribunais()
            except DjenAPIError as e:
                djen_ns.abort(502, f"Erro ao consultar tribunais no CNJ: {str(e)}")

    # ── Contagem de não lidas (para badge no sidebar) ─────────────────────────
    @djen_ns.route('/nao-lidas')
    class DjenNaoLidasAPI(Resource):
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def get(self):
            """Retorna o total de publicações não lidas — usado para badge na sidebar."""
            user_id = get_jwt_identity()
            from app import User
            user = User.query.get(int(user_id))
            if not user:
                return {'count': 0}
            if not _tenant_djen_habilitado(user.tenant_id):
                return {'count': 0}
            count = PublicacaoDJEN.query.filter_by(
                tenant_id=user.tenant_id, lida=False, triagem_ignorada=False
            ).count()
            return {'count': count}

    @djen_ns.route('/qualidade')
    class DjenQualidadeAPI(Resource):
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def get(self):
            """Métricas de qualidade para rollout gradual por tenant."""
            user_id = get_jwt_identity()
            from app import User, DjenVinculoDecisao

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)
            if not _tenant_djen_habilitado(user.tenant_id):
                djen_ns.abort(403, 'Módulo DJEN desabilitado para este tenant no rollout atual.')

            base = DjenVinculoDecisao.query.filter_by(tenant_id=user.tenant_id)
            total = base.count()
            ignoradas = base.filter_by(acao='ignorar').count()
            mescladas = base.filter_by(acao='mesclar').count()
            criadas = base.filter_by(acao='criar').count()

            publicacoes_total = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id).count()
            vinculadas = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id).filter(PublicacaoDJEN.caso_id.isnot(None)).count()

            taxa_vinculo = round((vinculadas / publicacoes_total) * 100, 2) if publicacoes_total else 0.0
            taxa_decisao = round((total / publicacoes_total) * 100, 2) if publicacoes_total else 0.0

            return {
                'rollout_percent': current_app.config.get('DJEN_ROLLOUT_PERCENT', 100),
                'total_publicacoes': publicacoes_total,
                'publicacoes_vinculadas': vinculadas,
                'taxa_vinculo_percent': taxa_vinculo,
                'total_decisoes': total,
                'taxa_decisao_percent': taxa_decisao,
                'decisoes_por_acao': {
                    'criar': criadas,
                    'mesclar': mescladas,
                    'ignorar': ignoradas,
                },
            }
