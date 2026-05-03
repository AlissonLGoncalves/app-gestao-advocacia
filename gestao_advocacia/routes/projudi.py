"""Rotas /api/projudi/* — integracao com o projudi-agent (scraper local).

Fase 1: gestao de tokens API (gerar, listar, revogar) + endpoint /me.
Fase 2: POST /processos — recebe carteira do advogado e cria/sync Casos.
Fases 3-4 (a vir): /movimentacoes, /pecas.
"""

import hashlib
import re
import secrets
from datetime import datetime
from decimal import Decimal, InvalidOperation

from flask import g, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import projudi_agent_required, tenant_scoped
from models import (
    Caso,
    Cliente,
    Documento,
    MovimentacaoCNJ,
    ProjudiAgentToken,
    ProjudiSyncLog,
    TarefaPrazo,
    User,
)
from prazo_detector import detectar_prazo, prioridade_por_dias_ate_vencer, titulo_prazo


def register_projudi_routes(app, projudi_ns):
    @projudi_ns.route("/auth/me")
    class ProjudiAuthMe(Resource):
        @projudi_ns.doc(
            description=(
                "Endpoint de teste pro agent confirmar que o token esta valido. "
                "Retorna info do tenant/user vinculado ao token."
            ),
        )
        @projudi_agent_required
        def get(self):
            user = User.query.get(g.user_id)
            return {
                "tenant_id": g.tenant_id,
                "user_id": g.user_id,
                "user_email": user.email if user else None,
                "token_id": g.projudi_token_id,
            }, 200

    @projudi_ns.route("/auth/tokens")
    class ProjudiTokenList(Resource):
        @jwt_required()
        @tenant_scoped
        @projudi_ns.doc(
            security="jsonWebToken",
            description=(
                "Lista os tokens API do projudi-agent do tenant atual. "
                "Nao revela o valor cru — so metadados."
            ),
        )
        def get(self):
            tokens = (
                ProjudiAgentToken.query.filter_by(tenant_id=g.tenant_id)
                .order_by(ProjudiAgentToken.created_at.desc())
                .all()
            )
            return [t.to_dict() for t in tokens], 200

        @jwt_required()
        @tenant_scoped
        @projudi_ns.doc(
            security="jsonWebToken",
            description=(
                "Gera novo token API. Retorna o valor cru UMA UNICA VEZ — "
                "depois so o hash fica no banco. Use no .env do projudi-agent."
            ),
        )
        def post(self):
            payload = request.get_json(silent=True) or {}
            nome = (payload.get("nome") or "").strip()[:100] or None

            # 32 bytes urlsafe ~ 43 chars base64
            token_raw = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token_raw.encode("utf-8")).hexdigest()

            token = ProjudiAgentToken(
                tenant_id=g.tenant_id,
                user_id=get_jwt_identity(),
                token_hash=token_hash,
                nome=nome,
                ativo=True,
            )
            db.session.add(token)
            db.session.commit()

            return {
                "token": token_raw,  # so aqui — depois nao volta mais
                "info": token.to_dict(),
                "aviso": (
                    "Guarde este token — ele nao sera exibido de novo. "
                    "Configure no .env do projudi-agent como APP_GESTAO_API_TOKEN."
                ),
            }, 201

    @projudi_ns.route("/auth/tokens/<int:token_id>")
    class ProjudiTokenItem(Resource):
        @jwt_required()
        @tenant_scoped
        @projudi_ns.doc(
            security="jsonWebToken",
            description="Revoga um token API (corte de acesso imediato pro agent).",
        )
        def delete(self, token_id):
            token = ProjudiAgentToken.query.filter_by(id=token_id, tenant_id=g.tenant_id).first()
            if not token:
                return {"message": "Token nao encontrado neste tenant."}, 404
            token.ativo = False
            token.revoked_at = datetime.utcnow()
            db.session.commit()
            return {"message": "Token revogado.", "info": token.to_dict()}, 200

    # =====================================================================
    # Helper compartilhado pra registrar log de sync
    # =====================================================================

    def _registrar_sync(tipo, counts, duracao_ms=None):
        """Registra ProjudiSyncLog com counts do request. Best-effort."""
        try:
            log = ProjudiSyncLog(
                tenant_id=g.tenant_id,
                token_id=getattr(g, "projudi_token_id", None),
                tipo=tipo,
                counts=counts or {},
                duracao_ms=duracao_ms,
            )
            db.session.add(log)
            db.session.commit()
        except Exception:
            db.session.rollback()

    # =====================================================================
    # FASE 2 — Sync de processos da carteira do PROJUDI
    # =====================================================================

    def _normalizar_nome(s):
        """Normaliza nome para comparacao: lowercase, sem acentos, espacos."""
        import unicodedata as _ud  # noqa: PLC0415

        s = (s or "").strip()
        s = _ud.normalize("NFD", s)
        s = "".join(c for c in s if _ud.category(c) != "Mn")
        s = re.sub(r"\s+", " ", s)
        return s.lower().strip()

    def _parse_decimal_or_none(value):
        if value in (None, ""):
            return None
        if isinstance(value, (int, float, Decimal)):
            try:
                return Decimal(str(value))
            except InvalidOperation:
                return None
        v = str(value).strip().replace("R$", "").replace(" ", "")
        if "," in v:
            v = v.replace(".", "").replace(",", ".")
        try:
            return Decimal(v)
        except (InvalidOperation, ValueError):
            return None

    def _parse_date_or_none(value):
        if not value:
            return None
        s = str(value).strip()[:10]
        try:
            return datetime.strptime(s, "%Y-%m-%d").date()
        except ValueError:
            return None

    def _trim(v, n):
        if v is None:
            return None
        s = str(v).strip()
        return s[:n] if s else None

    def _achar_cliente_por_partes(tenant_id, partes):
        """Tenta casar nome de cliente cadastrado com qualquer das partes
        (polo ativo + polo passivo). Match exato por nome normalizado."""
        if not partes:
            return None
        nomes_norm = set()
        for p in partes:
            for sub in re.split(r"\s*[|;,]\s*", str(p or "")):
                k = _normalizar_nome(sub)
                if k and len(k) >= 4:
                    nomes_norm.add(k)
        if not nomes_norm:
            return None
        clientes = Cliente.query.filter_by(tenant_id=tenant_id).all()
        for c in clientes:
            if _normalizar_nome(c.nome_razao_social or "") in nomes_norm:
                return c
        return None

    @projudi_ns.route("/processos")
    class ProjudiProcessos(Resource):
        @projudi_ns.doc(
            description=(
                "Recebe lista de processos da carteira do PROJUDI e cria/sincroniza "
                "Casos no tenant. Idempotente: re-envio nao duplica. Vincula "
                "automaticamente ao Cliente quando alguma das partes (polo ativo "
                "ou passivo) bate por nome normalizado. Caso nao haja match, "
                "retorna o processo na lista 'sem_cliente' para triagem manual."
            ),
        )
        @projudi_agent_required
        def post(self):
            payload = request.get_json(silent=True) or {}
            processos = payload.get("processos") or []
            if not isinstance(processos, list):
                return {"message": "Campo 'processos' deve ser uma lista."}, 400

            tenant_id = g.tenant_id
            user_id = g.user_id

            criados = 0
            atualizados = 0
            sem_cliente = []  # lista de {numero_cnj, partes_polo_ativo, partes_polo_passivo}
            erros = []

            for p in processos:
                if not isinstance(p, dict):
                    continue
                cnj = (p.get("numero_cnj") or "").strip()
                if not cnj:
                    erros.append({"erro": "numero_cnj vazio", "raw": p})
                    continue

                # Idempotencia: busca Caso por (tenant_id, numero_processo)
                caso = Caso.query.filter_by(tenant_id=tenant_id, numero_processo=cnj).first()

                polo_ativo = p.get("polo_ativo") or ""
                polo_passivo = p.get("polo_passivo") or ""
                partes = []
                if isinstance(polo_ativo, list):
                    partes.extend(polo_ativo)
                elif polo_ativo:
                    partes.append(polo_ativo)
                if isinstance(polo_passivo, list):
                    partes.extend(polo_passivo)
                elif polo_passivo:
                    partes.append(polo_passivo)

                if caso:
                    # Atualiza SO campos vazios — nao sobrescreve trabalho manual
                    mudou = False
                    if not caso.tipo_acao and p.get("classe"):
                        caso.tipo_acao = _trim(p["classe"], 100)
                        mudou = True
                    if not caso.vara_juizo and p.get("vara"):
                        caso.vara_juizo = _trim(p["vara"], 100)
                        mudou = True
                    if not caso.valor_causa and p.get("valor_causa") is not None:
                        v = _parse_decimal_or_none(p["valor_causa"])
                        if v is not None:
                            caso.valor_causa = v
                            mudou = True
                    if not caso.data_distribuicao and p.get("data_distribuicao"):
                        d = _parse_date_or_none(p["data_distribuicao"])
                        if d:
                            caso.data_distribuicao = d
                            mudou = True
                    if not caso.parte_contraria and partes:
                        # Se cliente vinculado bate com algum, parte_contraria eh a outra
                        if caso.cliente_id:
                            cli = Cliente.query.get(caso.cliente_id)
                            if cli:
                                cli_norm = _normalizar_nome(cli.nome_razao_social or "")
                                outras = [
                                    pt for pt in partes if _normalizar_nome(str(pt)) != cli_norm
                                ]
                                if outras:
                                    caso.parte_contraria = _trim(
                                        " | ".join(str(o) for o in outras), 200
                                    )
                                    mudou = True
                    if mudou:
                        atualizados += 1
                    continue

                # Caso novo — precisa de cliente_id (NOT NULL)
                cliente = _achar_cliente_por_partes(tenant_id, partes)
                if not cliente:
                    sem_cliente.append(
                        {
                            "numero_cnj": cnj,
                            "polo_ativo": polo_ativo,
                            "polo_passivo": polo_passivo,
                            "categoria_projudi": p.get("categoria_projudi"),
                        }
                    )
                    continue

                # Define parte_contraria como a outra parte do polo oposto
                cli_norm = _normalizar_nome(cliente.nome_razao_social or "")
                outras = [pt for pt in partes if _normalizar_nome(str(pt)) != cli_norm]
                parte_contraria = " | ".join(str(o) for o in outras) if outras else None

                novo = Caso(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    cliente_id=cliente.id,
                    titulo=_trim(f"Processo {cnj}", 200),
                    numero_processo=_trim(cnj, 30),
                    status="Ativo",
                    tipo_acao=_trim(p.get("classe"), 100),
                    vara_juizo=_trim(p.get("vara"), 100),
                    valor_causa=_parse_decimal_or_none(p.get("valor_causa")),
                    data_distribuicao=_parse_date_or_none(p.get("data_distribuicao")),
                    parte_contraria=_trim(parte_contraria, 200),
                    notas_caso="Importado automaticamente do PROJUDI.",
                )
                db.session.add(novo)
                criados += 1

            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                return {"message": "Falha ao salvar.", "erro": str(exc)}, 500

            resposta = {
                "criados": criados,
                "atualizados": atualizados,
                "sem_cliente": sem_cliente,
                "total_recebidos": len(processos),
                "erros": erros,
            }
            _registrar_sync("processos", resposta)
            return resposta, 200

    # =====================================================================
    # FASE 3 — Sync de movimentacoes do PROJUDI + deteccao de prazos
    # =====================================================================

    @projudi_ns.route("/movimentacoes")
    class ProjudiMovimentacoes(Resource):
        @projudi_ns.doc(
            description=(
                "Recebe movimentacoes processuais (delta incremental) e: "
                "(1) cria MovimentacaoCNJ no log do Caso (idempotente por "
                "fingerprint), (2) detecta prazo via regex+IA e cria "
                "TarefaPrazo no Kanban quando aplicavel."
            ),
        )
        @projudi_agent_required
        def post(self):
            payload = request.get_json(silent=True) or {}
            movs = payload.get("movimentacoes") or []
            if not isinstance(movs, list):
                return {"message": "Campo 'movimentacoes' deve ser uma lista."}, 400

            tenant_id = g.tenant_id
            user_id = g.user_id

            # Cache de Caso por numero_processo (evita query por movimentacao)
            casos_cache = {}

            def _achar_caso(cnj):
                if not cnj:
                    return None
                cnj = cnj.strip()
                if cnj in casos_cache:
                    return casos_cache[cnj]
                caso = Caso.query.filter_by(tenant_id=tenant_id, numero_processo=cnj).first()
                casos_cache[cnj] = caso
                return caso

            mov_criadas = 0
            mov_duplicadas = 0
            mov_sem_caso = 0
            prazos_criados = 0
            erros = []

            for m in movs:
                if not isinstance(m, dict):
                    continue
                cnj = (m.get("numero_cnj") or "").strip()
                fingerprint = (m.get("fingerprint") or "").strip()
                descricao = (m.get("descricao") or "").strip()
                data_str = (m.get("data") or "").strip()

                caso = _achar_caso(cnj)
                if not caso:
                    mov_sem_caso += 1
                    continue

                # Parse da data (aceita YYYY-MM-DD e ISO completo)
                data_mov = None
                if data_str:
                    try:
                        data_mov = datetime.fromisoformat(data_str.replace("Z", "+00:00"))
                    except ValueError:
                        try:
                            data_mov = datetime.strptime(data_str[:10], "%Y-%m-%d")
                        except ValueError:
                            erros.append({"erro": "data invalida", "mov": m})
                            continue
                if not data_mov:
                    data_mov = datetime.utcnow()

                # IDEMPOTENCIA: dedup por fingerprint dentro de dados_integra_cnj
                # (campo JSON do MovimentacaoCNJ). Para 1a fase usa query simples.
                # Otimizacao futura: indice GIN em (caso_id, fingerprint).
                if fingerprint:
                    existente = (
                        MovimentacaoCNJ.query.filter(
                            MovimentacaoCNJ.tenant_id == tenant_id,
                            MovimentacaoCNJ.caso_id == caso.id,
                        )
                        .filter(
                            MovimentacaoCNJ.dados_integra_cnj.op("->>")("fingerprint")
                            == fingerprint
                        )
                        .first()
                        if db.engine.dialect.name == "postgresql"
                        else MovimentacaoCNJ.query.filter_by(
                            tenant_id=tenant_id,
                            caso_id=caso.id,
                            descricao=descricao,
                        )
                        .filter(MovimentacaoCNJ.data_movimentacao == data_mov)
                        .first()
                    )
                    if existente:
                        mov_duplicadas += 1
                        continue

                # Cria a movimentacao no log
                nova_mov = MovimentacaoCNJ(
                    tenant_id=tenant_id,
                    caso_id=caso.id,
                    data_movimentacao=data_mov,
                    descricao=descricao[:5000] if descricao else "(sem descricao)",
                    dados_integra_cnj={
                        "fonte": "projudi",
                        "fingerprint": fingerprint,
                        "seq": m.get("seq"),
                        "tipo": m.get("tipo"),
                        "raw": m.get("raw"),
                    },
                )
                db.session.add(nova_mov)
                mov_criadas += 1

                # DETECCAO DE PRAZO — gera TarefaPrazo se houver
                try:
                    info = detectar_prazo(descricao, data_referencia=data_mov.date())
                except Exception as exc:
                    info = None
                    erros.append({"erro": f"detector falhou: {exc}", "mov_id": cnj})

                if info and info.get("vencimento_iso"):
                    try:
                        venc = datetime.strptime(info["vencimento_iso"], "%Y-%m-%d")
                    except ValueError:
                        venc = None
                    if venc:
                        # Idempotencia do prazo: nao cria se ja existe um prazo
                        # com mesmo (caso_id, vencimento, tipo) — evita
                        # duplicar quando o agent re-envia mov antiga.
                        ja_existe = (
                            TarefaPrazo.query.filter_by(
                                tenant_id=tenant_id,
                                caso_id=caso.id,
                                tipo_tarefa="Prazo",
                                data_vencimento=venc,
                            )
                            .filter(TarefaPrazo.titulo.like(f"%{titulo_prazo(info['tipo'])[:30]}%"))
                            .first()
                        )
                        if not ja_existe:
                            tarefa = TarefaPrazo(
                                tenant_id=tenant_id,
                                user_id=user_id,
                                caso_id=caso.id,
                                titulo=titulo_prazo(info["tipo"], cnj)[:250],
                                descricao=(
                                    f"Detectado automaticamente do PROJUDI.\n\n"
                                    f"Tipo: {info['tipo']}\n"
                                    f"Dias: {info.get('dias') or '?'} "
                                    f"({'úteis' if info.get('uteis') else 'corridos'})\n"
                                    f"Fonte: {info.get('fonte', 'regex')}\n\n"
                                    f"Movimentação:\n{descricao[:500]}"
                                ),
                                status="A Fazer",
                                prioridade=prioridade_por_dias_ate_vencer(venc.date()),
                                data_vencimento=venc,
                                tipo_tarefa="Prazo",
                                origem_id=f"projudi:{fingerprint}" if fingerprint else None,
                            )
                            db.session.add(tarefa)
                            prazos_criados += 1

            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                return {"message": "Falha ao salvar.", "erro": str(exc)}, 500

            resposta = {
                "movimentacoes_criadas": mov_criadas,
                "movimentacoes_duplicadas": mov_duplicadas,
                "movimentacoes_sem_caso": mov_sem_caso,
                "prazos_criados": prazos_criados,
                "total_recebidas": len(movs),
                "erros": erros[:20],
            }
            _registrar_sync("movimentacoes", resposta)
            return resposta, 200

    # =====================================================================
    # FASE 4 — Upload de pecas (PDF) exportadas do PROJUDI
    # =====================================================================

    @projudi_ns.route("/pecas")
    class ProjudiPecas(Resource):
        @projudi_ns.doc(
            description=(
                "Upload de PDF consolidado exportado do PROJUDI. Cria Documento "
                "vinculado ao Caso. Idempotencia por hash SHA-256: re-envio do "
                "mesmo arquivo ao mesmo caso nao duplica. Multipart/form-data "
                "com campos: file (PDF), numero_cnj, escopo (tudo|capa|...), "
                "data_exportacao (YYYY-MM-DD opcional)."
            ),
        )
        @projudi_agent_required
        def post(self):
            import os

            from werkzeug.utils import secure_filename

            from app import app as flask_app

            file_storage = request.files.get("file")
            if not file_storage or not getattr(file_storage, "filename", ""):
                return {"message": "Campo 'file' (multipart) obrigatorio."}, 400

            cnj = (request.form.get("numero_cnj") or "").strip()
            if not cnj:
                return {"message": "Campo 'numero_cnj' obrigatorio."}, 400

            escopo = (request.form.get("escopo") or "tudo").strip().lower()[:20]
            data_exp = (request.form.get("data_exportacao") or "").strip()[:10]

            tenant_id = g.tenant_id
            user_id = g.user_id

            # Acha o Caso (precisa existir — Fase 2 deve ter criado)
            caso = Caso.query.filter_by(tenant_id=tenant_id, numero_processo=cnj).first()
            if not caso:
                return {
                    "message": (
                        f"Caso com numero_processo '{cnj}' nao encontrado neste tenant. "
                        "Envie /processos primeiro pra criar o Caso."
                    ),
                }, 404

            # Le conteudo + valida tipo + tamanho
            conteudo = file_storage.stream.read()
            file_storage.stream.seek(0)

            # Limite 50 MB (autos consolidados PROJUDI podem ser pesados)
            limite_bytes = 50 * 1024 * 1024
            if len(conteudo) > limite_bytes:
                mb = len(conteudo) / (1024 * 1024)
                return {"message": f"Arquivo muito grande ({mb:.1f} MB). Limite 50 MB."}, 400

            # Valida MIME via libmagic (header bytes)
            try:
                import magic  # type: ignore

                mime = magic.from_buffer(conteudo[:2048], mime=True)
                if mime != "application/pdf":
                    return {
                        "message": f"Tipo invalido (detectado: {mime}). Apenas PDF aceito."
                    }, 400
            except ImportError:
                # Fallback: assume PDF se nome termina .pdf E primeiros bytes %PDF
                nome_lower = file_storage.filename.lower()
                if not nome_lower.endswith(".pdf") or not conteudo[:4] == b"%PDF":
                    return {"message": "Apenas PDF aceito."}, 400

            # Calcula hash pra dedup
            hash_arquivo = hashlib.sha256(conteudo).hexdigest()

            # Idempotencia: se ja existe doc com mesmo hash + caso, skipa
            existente = Documento.query.filter_by(
                tenant_id=tenant_id, caso_id=caso.id, hash_arquivo=hash_arquivo
            ).first()
            if existente:
                return {
                    "message": "Peca ja foi enviada antes (mesmo hash).",
                    "documento_id": existente.id,
                    "duplicado": True,
                }, 200

            # Salva arquivo no storage local (mesmo padrao do /documentos/upload)
            user_folder = os.path.join(flask_app.config["UPLOAD_FOLDER"], str(user_id))
            os.makedirs(user_folder, exist_ok=True)

            data_label = data_exp or datetime.utcnow().strftime("%Y-%m-%d")
            nome_padronizado = f"PROJUDI - {escopo} - {cnj} - {data_label}.pdf"
            safe_name = secure_filename(nome_padronizado)
            file_path = os.path.join(user_folder, safe_name)
            counter = 1
            while os.path.exists(file_path):
                base, ext = os.path.splitext(safe_name)
                file_path = os.path.join(user_folder, f"{base}_{counter}{ext}")
                counter += 1

            try:
                with open(file_path, "wb") as fh:
                    fh.write(conteudo)
            except Exception as exc:
                return {"message": f"Falha ao gravar arquivo: {exc}"}, 500

            # Cria Documento
            doc = Documento(
                tenant_id=tenant_id,
                user_id=user_id,
                caso_id=caso.id,
                nome_arquivo=os.path.basename(file_path),
                path_arquivo=file_path,
                hash_arquivo=hash_arquivo,
            )
            db.session.add(doc)
            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                # Tenta apagar o arquivo orfão
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                return {"message": f"Falha ao salvar registro: {exc}"}, 500

            resposta = {
                "message": "Peca importada do PROJUDI.",
                "documento_id": doc.id,
                "caso_id": caso.id,
                "nome_arquivo": doc.nome_arquivo,
                "hash_arquivo": hash_arquivo,
                "duplicado": False,
            }
            _registrar_sync("pecas", {"enviadas": 1, "duplicadas": 0})
            return resposta, 201

    # =====================================================================
    # FASE 6 — Status / observabilidade da integracao
    # =====================================================================

    @projudi_ns.route("/sync/status")
    class ProjudiSyncStatus(Resource):
        @jwt_required()
        @tenant_scoped
        @projudi_ns.doc(
            security="jsonWebToken",
            description=(
                "Retorna status do ultimo sync por tipo (processos, "
                "movimentacoes, pecas). Usado pelo Dashboard pra mostrar "
                "'PROJUDI: sync ha X minutos'."
            ),
        )
        def get(self):
            from helpers import get_tenant_id

            tenant_id = get_tenant_id()
            ultimos = {}
            for tipo in ("processos", "movimentacoes", "pecas"):
                log = (
                    ProjudiSyncLog.query.filter_by(tenant_id=tenant_id, tipo=tipo)
                    .order_by(ProjudiSyncLog.created_at.desc())
                    .first()
                )
                ultimos[tipo] = log.to_dict() if log else None

            # Calcula tempo desde ultimo sync de qualquer tipo
            datas = [
                datetime.fromisoformat(u["created_at"])
                for u in ultimos.values()
                if u and u.get("created_at")
            ]
            ultimo_sync_iso = max(datas).isoformat() if datas else None
            minutos_desde = None
            if datas:
                delta = datetime.utcnow() - max(datas)
                minutos_desde = int(delta.total_seconds() / 60)

            # Conta tokens ativos
            tokens_ativos = ProjudiAgentToken.query.filter_by(
                tenant_id=tenant_id, ativo=True
            ).count()

            return {
                "tokens_ativos": tokens_ativos,
                "ultimo_sync_iso": ultimo_sync_iso,
                "minutos_desde_ultimo_sync": minutos_desde,
                "ultimo_por_tipo": ultimos,
            }, 200
