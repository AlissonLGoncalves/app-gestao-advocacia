# ==============================================================================
# ARQUIVO: gestao_advocacia/djen_routes.py
# Rotas da API DJEN — Diário de Justiça Eletrônico Nacional.
# Chamado via registrar_rotas_djen() de dentro de create_app() em app.py
# para evitar importação circular.
# ==============================================================================
from datetime import datetime, timedelta

from flask import request, send_file
from flask_restx import Resource, fields
import io


def registrar_rotas_djen(djen_ns, db, DjenOabMonitoramento, PublicacaoDJEN, Caso,
                          jwt_required, get_jwt_identity, logger):

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
        'dias': fields.Integer(description='Janela de busca em dias (padrão = 30, máximo = 30)', default=30),
    })

    # ── OABs monitoradas ──────────────────────────────────────────────────────
    @djen_ns.route('/oabs')
    class DjenOabListAPI(Resource):
        @djen_ns.marshal_list_with(oab_output_dto)
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def get(self):
            """Lista as OABs configuradas para monitoramento no tenant."""
            user_id = get_jwt_identity()
            from app import User
            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401, "Usuário não encontrado.")
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
            from app import User
            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401, "Usuário não encontrado.")
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
            db.session.add(oab)
            db.session.commit()
            return oab, 201

    @djen_ns.route('/oabs/<int:oab_id>')
    class DjenOabDetailAPI(Resource):
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def delete(self, oab_id):
            """Remove uma OAB do monitoramento."""
            user_id = get_jwt_identity()
            from app import User
            user = User.query.get(int(user_id))
            oab = DjenOabMonitoramento.query.filter_by(id=oab_id, tenant_id=user.tenant_id).first()
            if not oab:
                djen_ns.abort(404, "OAB não encontrada.")
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
        })
        @jwt_required()
        def get(self):
            """Lista publicações DJEN capturadas, com filtros."""
            user_id = get_jwt_identity()
            from app import User
            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)

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
            items = q.order_by(PublicacaoDJEN.data_disponibilizacao.desc()).offset(offset).limit(limit).all()

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

            q = PublicacaoDJEN.query.filter_by(tenant_id=user.tenant_id)

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
            from app import User, Cliente
            from djen_triagem import analisar_publicacao

            user = User.query.get(int(user_id))
            if not user:
                djen_ns.abort(401)

            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")

            if pub.caso_id:
                return {
                    'message': 'Publicação já está vinculada a um caso.',
                    'publicacao': pub.to_dict(),
                }, 200

            analise = analisar_publicacao(pub)
            numero_processo = (analise.get('numero_processo') or pub.numero_processo or '').strip()

            nome_cliente = None
            if (analise.get('partes_autoras') or []):
                nome_cliente = analise['partes_autoras'][0]
            elif (analise.get('partes_reus') or []):
                nome_cliente = analise['partes_reus'][0]
            else:
                nome_cliente = f"Cliente DJEN {pub.id}"

            cliente = Cliente.query.filter(
                Cliente.tenant_id == user.tenant_id,
                Cliente.user_id == int(user_id),
                Cliente.nome_razao_social.ilike(nome_cliente),
            ).first()

            cliente_criado = False
            if not cliente:
                documento_base = f"DJEN-{pub.id}"
                documento = documento_base
                contador = 1
                while Cliente.query.filter_by(
                    tenant_id=user.tenant_id,
                    user_id=int(user_id),
                    cpf_cnpj=documento,
                ).first():
                    contador += 1
                    documento = f"{documento_base}-{contador}"[:20]

                cliente = Cliente(
                    tenant_id=user.tenant_id,
                    user_id=int(user_id),
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
                    user_id=int(user_id),
                    numero_processo=numero_processo,
                ).first()

            caso_criado = False
            if not caso:
                titulo = f"Processo {numero_processo}" if numero_processo else f"Caso DJEN #{pub.id}"
                parte_contraria = (analise.get('partes_reus') or [None])[0]
                adv_parte_contraria = (analise.get('representantes') or [None])[0]

                caso = Caso(
                    tenant_id=user.tenant_id,
                    user_id=int(user_id),
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

            notas_auto = f"[TRIAGEM DJEN] Vinculado ao caso #{caso.id}."
            pub.notas = f"{pub.notas}\n{notas_auto}".strip() if pub.notas else notas_auto

            db.session.commit()

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
            }, 200

    @djen_ns.route('/publicacoes/<int:pub_id>')
    class PublicacaoDetailAPI(Resource):
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def get(self, pub_id):
            """Retorna o detalhe de uma publicação."""
            user_id = get_jwt_identity()
            from app import User
            user = User.query.get(int(user_id))
            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")
            return pub.to_dict()

        @djen_ns.expect(pub_patch_dto)
        @djen_ns.doc(security='jsonWebToken')
        @jwt_required()
        def patch(self, pub_id):
            """Marca como lida, vincula a caso ou adiciona notas."""
            user_id = get_jwt_identity()
            from app import User
            user = User.query.get(int(user_id))
            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")
            data = request.json or {}
            if 'lida' in data:
                pub.lida = bool(data['lida'])
            if 'caso_id' in data:
                caso_id = data['caso_id']
                if caso_id is not None:
                    caso = Caso.query.filter_by(id=int(caso_id), user_id=int(user_id)).first()
                    if not caso:
                        djen_ns.abort(404, "Caso não encontrado ou sem permissão.")
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
            user_id = get_jwt_identity()
            from app import User
            from djen_service import obter_certidao, DjenAPIError
            user = User.query.get(int(user_id))
            pub = PublicacaoDJEN.query.filter_by(id=pub_id, tenant_id=user.tenant_id).first()
            if not pub:
                djen_ns.abort(404, "Publicação não encontrada.")
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
            data = request.json or {}
            try:
                dias = int(data.get('dias', 30))
            except (TypeError, ValueError):
                dias = 30
            dias = max(1, min(dias, 30))

            from flask import current_app
            try:
                resumo = job_monitorar_djen(
                    current_app._get_current_object(),
                    lookback_days=dias,
                    tenant_id=user.tenant_id,
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
            count = PublicacaoDJEN.query.filter_by(
                tenant_id=user.tenant_id, lida=False
            ).count()
            return {'count': count}
