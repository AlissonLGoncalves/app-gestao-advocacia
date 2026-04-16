# ==============================================================================
# ARQUIVO: gestao_advocacia/djen_tasks.py
# Job agendado para monitorar publicações no DJEN (ComunicaAPI/CNJ).
#
# Estratégia de busca (2 vetores por usuário):
#   1. Por número OAB — captura TODAS as publicações do advogado no tribunal
#      configurado, independentemente de estar cadastrado no sistema.
#   2. Por número de processo — captura publicações dos casos ativos cadastrados,
#      mesmo que não tenham OAB configurada.
# ==============================================================================
import time
import logging
from datetime import datetime, timedelta

from djen_service import consultar_comunicacoes, DjenAPIError, DjenRateLimitError

RATE_LIMIT_SLEEP = 65  # segundos a aguardar após HTTP 429
DELAY_ENTRE_REQUISICOES = 3  # segundos entre cada requisição


def _get_logger(app):
    try:
        return app.logger
    except Exception:
        return logging.getLogger(__name__)


def _salvar_publicacao(db, DjenPublicacao, user_id, tenant_id, caso_id, item, origem):
    """Persiste uma publicação se ainda não existir no banco."""
    hash_com = item.get("hash") or item.get("id") or item.get("codigo")

    # Tenta deduplicar por hash; se não tiver hash, usa processo + data
    if hash_com:
        exists = DjenPublicacao.query.filter_by(hash_comunicacao=str(hash_com)).first()
        if exists:
            return False
    else:
        numero_proc = item.get("numeroProcesso") or item.get("processo", {}).get("numero")
        data_disp = item.get("dataDisponibilizacao")
        if numero_proc and data_disp:
            exists = DjenPublicacao.query.filter_by(
                user_id=user_id,
                numero_processo=numero_proc,
                data_disponibilizacao_str=str(data_disp),
            ).first()
            if exists:
                return False

    numero_proc = (
        item.get("numeroProcesso")
        or (item.get("processo") or {}).get("numero")
        or ""
    )
    sigla_trib = (
        item.get("siglaTribunal")
        or (item.get("tribunal") or {}).get("sigla")
        or ""
    )
    tipo_com = item.get("tipoComunicacao") or item.get("tipo") or ""
    data_disp_str = item.get("dataDisponibilizacao") or item.get("data") or ""
    texto = item.get("texto") or item.get("conteudo") or ""
    nome_parte = item.get("nomeParte") or ""
    meio_val = item.get("meio") or "D"

    data_disp_dt = None
    if data_disp_str:
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                data_disp_dt = datetime.strptime(str(data_disp_str)[:19], fmt)
                break
            except ValueError:
                continue

    pub = DjenPublicacao(
        user_id=user_id,
        tenant_id=tenant_id,
        caso_id=caso_id,
        hash_comunicacao=str(hash_com) if hash_com else None,
        numero_processo=numero_proc,
        sigla_tribunal=sigla_trib,
        tipo_comunicacao=str(tipo_com)[:200],
        data_disponibilizacao=data_disp_dt,
        data_disponibilizacao_str=str(data_disp_str)[:50],
        texto=texto,
        nome_parte=str(nome_parte)[:300],
        meio=str(meio_val)[:1],
        dados_raw=item,
        origem_busca=origem,
    )
    db.session.add(pub)
    return True


def job_monitorar_djen(app):
    """Job APScheduler: monitora publicações DJEN por OAB e por processo."""
    with app.app_context():
        logger = _get_logger(app)

        if not app.config.get("DJEN_JOB_ENABLED", True):
            logger.info("JOB DJEN: desabilitado nas configurações. Pulando.")
            return

        try:
            from app import db, DjenPublicacao, User, Caso
        except ImportError as e:
            logger.critical(f"JOB DJEN: falha ao importar modelos: {e}")
            return

        logger.info("JOB DJEN: iniciando monitoramento de publicações...")
        total_novas = 0

        # ── Vetor 1: busca por OAB de cada usuário ──────────────────────────
        usuarios = User.query.filter(
            User.numero_oab.isnot(None),
            User.numero_oab != "",
            User.djen_monitoramento_ativo == True,
        ).all()

        logger.info(f"JOB DJEN: {len(usuarios)} usuário(s) com OAB configurada.")

        for user in usuarios:
            logger.info(
                f"JOB DJEN: buscando por OAB {user.numero_oab} "
                f"(tribunal: {user.sigla_oab_tribunal or 'todos'})"
            )
            try:
                data = consultar_comunicacoes(
                    numero_oab=user.numero_oab,
                    sigla_tribunal=user.sigla_oab_tribunal or None,
                    meio="D",
                )
                items = _extrair_items(data)
                for item in items:
                    saved = _salvar_publicacao(
                        db, DjenPublicacao, user.id, user.tenant_id, None, item, "oab"
                    )
                    if saved:
                        total_novas += 1
                db.session.commit()
                logger.info(
                    f"JOB DJEN: OAB {user.numero_oab} — {len(items)} publicações encontradas."
                )
            except DjenRateLimitError:
                logger.warning(f"JOB DJEN: rate limit atingido. Aguardando {RATE_LIMIT_SLEEP}s.")
                db.session.rollback()
                time.sleep(RATE_LIMIT_SLEEP)
                continue
            except DjenAPIError as e:
                logger.error(f"JOB DJEN: erro na busca por OAB {user.numero_oab}: {e}")
                db.session.rollback()
            except Exception as e:
                logger.error(f"JOB DJEN: exceção inesperada (OAB {user.numero_oab}): {e}", exc_info=True)
                db.session.rollback()

            time.sleep(DELAY_ENTRE_REQUISICOES)

        # ── Vetor 2: busca por número de processo dos casos ativos ──────────
        intervalo_dias = app.config.get("DJEN_JOB_PROCESSO_INTERVAL_DAYS", 1)
        limite_tempo = datetime.utcnow() - timedelta(days=intervalo_dias)
        max_casos = app.config.get("DJEN_JOB_MAX_CASOS_POR_RUN", 20)

        casos = Caso.query.filter(
            Caso.numero_processo.isnot(None),
            Caso.numero_processo != "",
            db.or_(
                Caso.data_ultima_verificacao_djen.is_(None),
                Caso.data_ultima_verificacao_djen < limite_tempo,
            ),
        ).order_by(Caso.data_ultima_verificacao_djen.asc().nulls_first()).limit(max_casos).all()

        logger.info(f"JOB DJEN: {len(casos)} caso(s) para verificar por processo.")

        for caso in casos:
            logger.info(f"JOB DJEN: buscando processo {caso.numero_processo} (caso {caso.id})")
            try:
                data = consultar_comunicacoes(
                    numero_processo=caso.numero_processo,
                    meio="D",
                )
                items = _extrair_items(data)
                user = User.query.get(caso.user_id)
                tenant_id = user.tenant_id if user else None

                for item in items:
                    saved = _salvar_publicacao(
                        db, DjenPublicacao, caso.user_id, tenant_id, caso.id, item, "processo"
                    )
                    if saved:
                        total_novas += 1

                caso.data_ultima_verificacao_djen = datetime.utcnow()
                db.session.commit()
                logger.info(
                    f"JOB DJEN: processo {caso.numero_processo} — {len(items)} publicações."
                )
            except DjenRateLimitError:
                logger.warning(f"JOB DJEN: rate limit atingido. Aguardando {RATE_LIMIT_SLEEP}s.")
                db.session.rollback()
                time.sleep(RATE_LIMIT_SLEEP)
                continue
            except DjenAPIError as e:
                logger.error(f"JOB DJEN: erro ao buscar processo {caso.numero_processo}: {e}")
                db.session.rollback()
                caso.data_ultima_verificacao_djen = datetime.utcnow()
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            except Exception as e:
                logger.error(
                    f"JOB DJEN: exceção inesperada (processo {caso.numero_processo}): {e}",
                    exc_info=True,
                )
                db.session.rollback()

            time.sleep(DELAY_ENTRE_REQUISICOES)

        logger.info(f"JOB DJEN: concluído. {total_novas} nova(s) publicação(ões) salva(s).")


def _extrair_items(data):
    """Normaliza a resposta da ComunicaAPI para uma lista de itens."""
    if not data:
        return []
    # A API retorna { "content": [...], "totalElements": N, ... }
    if isinstance(data, dict):
        if "content" in data:
            return data["content"] or []
        if "comunicacoes" in data:
            return data["comunicacoes"] or []
    if isinstance(data, list):
        return data
    return []
