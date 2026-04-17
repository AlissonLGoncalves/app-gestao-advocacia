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


def _item_get(item, *keys):
    """Busca valor em dicionário aceitando variações de chave (case/camel/snake)."""
    if not isinstance(item, dict):
        return None

    for key in keys:
        if key in item and item.get(key) not in (None, ""):
            return item.get(key)

    lower_map = {str(k).lower(): v for k, v in item.items()}
    for key in keys:
        value = lower_map.get(str(key).lower())
        if value not in (None, ""):
            return value

    return None


def _salvar_publicacao(db, PublicacaoDJEN, user_id, tenant_id, caso_id, item, origem):
    """Persiste uma publicação se ainda não existir no banco."""
    hash_com = _item_get(item, "hash", "id", "codigo")
    numero_proc = (
        _item_get(item, "numeroProcesso", "numeroprocesso")
        or (item.get("processo") or {}).get("numero")
        or ""
    )
    data_disp = _item_get(item, "dataDisponibilizacao", "datadisponibilizacao", "data")
    data_disp_dt = _parse_data_disponibilizacao(data_disp)

    # Dedup principal por hash + tenant.
    if hash_com:
        exists = PublicacaoDJEN.query.filter_by(
            tenant_id=tenant_id,
            hash_comunicacao=str(hash_com),
        ).first()
        if exists:
            return False

    # Dedup secundário por processo + data (mesmo que exista hash distinto da fonte).
    if numero_proc and data_disp_dt:
        exists = PublicacaoDJEN.query.filter_by(
            tenant_id=tenant_id,
            numero_processo=numero_proc,
            data_disponibilizacao=data_disp_dt,
        ).first()
        if exists:
            return False

    sigla_trib = (
        _item_get(item, "siglaTribunal", "siglatribunal")
        or (item.get("tribunal") or {}).get("sigla")
        or ""
    )
    tipo_com = _item_get(item, "tipoComunicacao", "tipocomunicacao", "tipo") or ""
    tipo_doc = _item_get(item, "tipoDocumento", "tipodocumento") or ""
    nome_classe = _item_get(item, "nomeClasse", "nomeclasse") or ""
    nome_orgao = _item_get(item, "nomeOrgao", "nomeorgao") or ""
    texto = _item_get(item, "texto", "conteudo") or ""
    meio_val = _item_get(item, "meio", "meiocompleto") or "D"
    numero_com = _item_get(item, "numeroComunicacao", "numerocomunicacao")
    djen_id = _item_get(item, "id")
    link = _item_get(item, "link", "url") or ""
    numero_proc_masc = _item_get(item, "numeroProcessoMascara", "numeroprocessomascara") or ""

    pub = PublicacaoDJEN(
        user_id=user_id,
        tenant_id=tenant_id,
        caso_id=caso_id,
        djen_id=djen_id,
        hash_comunicacao=str(hash_com) if hash_com else None,
        numero_comunicacao=numero_com,
        numero_processo=numero_proc,
        numero_processo_mascara=str(numero_proc_masc)[:50] if numero_proc_masc else None,
        sigla_tribunal=sigla_trib,
        nome_orgao=str(nome_orgao)[:200] if nome_orgao else None,
        tipo_comunicacao=str(tipo_com)[:200],
        tipo_documento=str(tipo_doc)[:100] if tipo_doc else None,
        nome_classe=str(nome_classe)[:200] if nome_classe else None,
        data_disponibilizacao=data_disp_dt,
        texto=texto,
        link=link,
        meio=str(meio_val)[:1],
        raw_json=item,
        origem_busca=origem,
        status_origem='pendente',
        triagem_ignorada=False,
    )
    db.session.add(pub)
    return True


def _parse_data_disponibilizacao(valor):
    if not valor:
        return None
    valor_str = str(valor).strip()

    # Remove sufixo UTC para normalizar parsing
    normalizado = valor_str.replace("Z", "").replace("z", "")

    # Datas no padrão brasileiro (ex.: 17/04/2026)
    for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
        try:
            dt = datetime.strptime(normalizado[:10], fmt)
            return dt.date()
        except ValueError:
            continue

    # ISO e variações com horário/milisegundos
    for fmt in (
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
    ):
        try:
            recorte = normalizado[:26] if "%f" in fmt else normalizado[:19]
            dt = datetime.strptime(recorte, fmt)
            return dt.date()
        except ValueError:
            continue
    return None


def job_monitorar_djen(app, lookback_days=None, tenant_id=None):
    """Job APScheduler: monitora publicações DJEN por OAB e por processo."""
    with app.app_context():
        logger = _get_logger(app)

        if not app.config.get("DJEN_JOB_ENABLED", True):
            logger.info("JOB DJEN: desabilitado nas configurações. Pulando.")
            return

        try:
            from app import db, PublicacaoDJEN, User, Caso, DjenOabMonitoramento
        except ImportError as e:
            logger.critical(f"JOB DJEN: falha ao importar modelos: {e}")
            return {
                "ok": False,
                "message": "Falha ao importar modelos DJEN.",
                "erro": str(e),
            }

        janela_dias = lookback_days if lookback_days is not None else app.config.get("DJEN_LOOKBACK_DAYS", 30)
        try:
            janela_dias = int(janela_dias)
        except (TypeError, ValueError):
            janela_dias = 30
        janela_dias = max(1, min(janela_dias, 30))
        data_fim = datetime.utcnow().date()
        data_inicio = data_fim - timedelta(days=janela_dias)

        logger.info(
            "JOB DJEN: iniciando monitoramento de publicações "
            f"(janela: {janela_dias} dia(s), de {data_inicio} até {data_fim})."
        )
        total_novas = 0
        total_itens_encontrados = 0
        total_oabs_processadas = 0
        total_casos_processados = 0
        erros = 0

        # ── Vetor 1: busca pelas OABs monitoradas no tenant ─────────────────
        q_oabs = DjenOabMonitoramento.query.filter_by(ativo=True)
        if tenant_id is not None:
            q_oabs = q_oabs.filter_by(tenant_id=tenant_id)
        oabs_monitoradas = q_oabs.all()

        logger.info(f"JOB DJEN: {len(oabs_monitoradas)} OAB(s) monitorada(s).")

        for oab_mon in oabs_monitoradas:
            logger.info(
                f"JOB DJEN: buscando por OAB {oab_mon.numero_oab}/{oab_mon.uf_oab or '--'} "
                f"(tenant: {oab_mon.tenant_id})"
            )
            try:
                data = consultar_comunicacoes(
                    numero_oab=oab_mon.numero_oab,
                    sigla_tribunal=(oab_mon.uf_oab or '').strip().upper() or None,
                    meio="D",
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                )
                items = _extrair_items(data)
                total_itens_encontrados += len(items)
                for item in items:
                    saved = _salvar_publicacao(
                        db, PublicacaoDJEN, oab_mon.user_id, oab_mon.tenant_id, None, item, "oab"
                    )
                    if saved:
                        total_novas += 1

                oab_mon.ultima_sincronizacao = datetime.utcnow()
                db.session.commit()
                total_oabs_processadas += 1
                logger.info(
                    f"JOB DJEN: OAB {oab_mon.numero_oab}/{oab_mon.uf_oab or '--'} — {len(items)} publicações encontradas."
                )
            except DjenRateLimitError:
                logger.warning(f"JOB DJEN: rate limit atingido. Aguardando {RATE_LIMIT_SLEEP}s.")
                db.session.rollback()
                erros += 1
                time.sleep(RATE_LIMIT_SLEEP)
                continue
            except DjenAPIError as e:
                logger.error(f"JOB DJEN: erro na busca por OAB {oab_mon.numero_oab}: {e}")
                db.session.rollback()
                erros += 1
            except Exception as e:
                logger.error(f"JOB DJEN: exceção inesperada (OAB {oab_mon.numero_oab}): {e}", exc_info=True)
                db.session.rollback()
                erros += 1

            time.sleep(DELAY_ENTRE_REQUISICOES)

        # ── Vetor 2: busca por número de processo dos casos ativos ──────────
        intervalo_dias = app.config.get("DJEN_JOB_PROCESSO_INTERVAL_DAYS", 1)
        limite_tempo = datetime.utcnow() - timedelta(days=intervalo_dias)
        max_casos = app.config.get("DJEN_JOB_MAX_CASOS_POR_RUN", 20)

        casos_query = Caso.query.filter(
            Caso.numero_processo.isnot(None),
            Caso.numero_processo != "",
            db.or_(
                Caso.data_ultima_verificacao_djen.is_(None),
                Caso.data_ultima_verificacao_djen < limite_tempo,
            ),
        )
        if tenant_id is not None:
            casos_query = casos_query.filter_by(tenant_id=tenant_id)

        casos = casos_query.order_by(Caso.data_ultima_verificacao_djen.asc().nulls_first()).limit(max_casos).all()

        logger.info(f"JOB DJEN: {len(casos)} caso(s) para verificar por processo.")

        for caso in casos:
            logger.info(f"JOB DJEN: buscando processo {caso.numero_processo} (caso {caso.id})")
            try:
                data = consultar_comunicacoes(
                    numero_processo=caso.numero_processo,
                    meio="D",
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                )
                items = _extrair_items(data)
                total_itens_encontrados += len(items)
                user = User.query.get(caso.user_id)
                tenant_id_caso = user.tenant_id if user else None

                for item in items:
                    saved = _salvar_publicacao(
                        db, PublicacaoDJEN, caso.user_id, tenant_id_caso, caso.id, item, "processo"
                    )
                    if saved:
                        total_novas += 1

                caso.data_ultima_verificacao_djen = datetime.utcnow()
                db.session.commit()
                total_casos_processados += 1
                logger.info(
                    f"JOB DJEN: processo {caso.numero_processo} — {len(items)} publicações."
                )
            except DjenRateLimitError:
                logger.warning(f"JOB DJEN: rate limit atingido. Aguardando {RATE_LIMIT_SLEEP}s.")
                db.session.rollback()
                erros += 1
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
                erros += 1
            except Exception as e:
                logger.error(
                    f"JOB DJEN: exceção inesperada (processo {caso.numero_processo}): {e}",
                    exc_info=True,
                )
                db.session.rollback()
                erros += 1

            time.sleep(DELAY_ENTRE_REQUISICOES)

        logger.info(f"JOB DJEN: concluído. {total_novas} nova(s) publicação(ões) salva(s).")
        return {
            "ok": True,
            "lookback_days": janela_dias,
            "oabs_processadas": total_oabs_processadas,
            "casos_processados": total_casos_processados,
            "itens_encontrados": total_itens_encontrados,
            "publicacoes_salvas": total_novas,
            "erros": erros,
        }


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
