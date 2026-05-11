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
import logging
import time
from datetime import datetime, timedelta

from flask import current_app

from djen_service import DjenAPIError, DjenRateLimitError, consultar_comunicacoes, listar_tribunais
from djen_triagem import CPF_CNPJ_REGEX, tentar_auto_vincular_a_caso

RATE_LIMIT_SLEEP = 65  # segundos a aguardar após HTTP 429
DELAY_ENTRE_REQUISICOES = 3  # segundos entre cada requisição

# Paginação: a ComunicaAPI só aceita itensPorPagina ∈ {5, 100}; o job usa 100
# por padrão e percorre páginas até que o servidor retorne um lote incompleto
# (< itens_por_pagina) ou o cap ``DJEN_MAX_PAGINAS_POR_CONSULTA`` seja atingido.
DJEN_ITENS_POR_PAGINA_PADRAO = 100
DJEN_MAX_PAGINAS_POR_CONSULTA_PADRAO = 50


def _get_config_int(chave, default):
    try:
        return int(current_app.config.get(chave, default))
    except (RuntimeError, TypeError, ValueError):
        return default


def _get_config_float(chave, default):
    try:
        return float(current_app.config.get(chave, default))
    except (RuntimeError, TypeError, ValueError):
        return default


# enriquecimento-cnj: consolidacao — regex unico no utilitario compartilhado
from utils.cnj import CNJ_REGEX_STRICT as _CNJ_REGEX  # noqa: E402


def _inferir_sigla_tribunal_por_numero_processo(numero_processo):
    """Infere sigla do tribunal (DJEN) a partir do número CNJ.

    Ex.: 0001234-12.2026.8.16.0001 -> TJPR
    """
    if not numero_processo:
        return None

    numero = str(numero_processo).strip()
    m = _CNJ_REGEX.match(numero)
    if not m:
        return None

    j = m.group(4)
    tt = m.group(5)

    if j == "1":
        return "STF"
    if j == "3":
        return "STJ"
    if j == "4":
        return f"TRF{int(tt)}"
    if j == "5":
        return f"TRT{int(tt)}"
    if j == "6":
        return f"TRE-{tt}"
    if j == "8":
        uf_por_codigo_estadual = {
            "01": "AC",
            "02": "AL",
            "03": "AP",
            "04": "AM",
            "05": "BA",
            "06": "CE",
            "07": "ES",
            "08": "GO",
            "09": "MA",
            "10": "MT",
            "11": "MS",
            "12": "MG",
            "13": "PA",
            "14": "PB",
            "15": "PE",
            "16": "PR",
            "17": "RN",
            "18": "RS",
            "19": "RO",
            "20": "RR",
            "21": "SC",
            "22": "SP",
            "23": "SE",
            "24": "TO",
            "25": "PI",
            "26": "RJ",
            "27": "RR",
        }
        uf = uf_por_codigo_estadual.get(tt)
        if uf:
            return f"TJ{uf}"

    return None


def _consultar_processo_com_fallback(
    *, numero_processo, sigla_tribunal, data_inicio, data_fim, logger
):
    """Consulta DJEN por processo com fallback de tribunal e paginação completa.

    Para cada sigla (com e sem filtro de tribunal) percorre páginas
    incrementando até a API devolver um lote incompleto ou o cap de páginas
    ser atingido. Retorna no primeiro bloco não-vazio encontrado.
    """
    siglas_a_tentar = []
    if sigla_tribunal:
        siglas_a_tentar.append(sigla_tribunal)
    siglas_a_tentar.append(None)

    itens_por_pagina = _get_config_int("DJEN_ITENS_POR_PAGINA", DJEN_ITENS_POR_PAGINA_PADRAO)
    max_paginas = _get_config_int(
        "DJEN_MAX_PAGINAS_POR_CONSULTA", DJEN_MAX_PAGINAS_POR_CONSULTA_PADRAO
    )
    delay = _get_config_float("DJEN_REQUEST_DELAY_SECONDS", 1.5)

    ultimo_payload = {}
    ultimo_items = []

    for sigla in siglas_a_tentar:
        acumulado_sigla = []
        pagina = 1
        while pagina <= max_paginas:
            payload = consultar_comunicacoes(
                numero_processo=numero_processo,
                sigla_tribunal=sigla,
                meio="D",
                data_inicio=data_inicio,
                data_fim=data_fim,
                pagina=pagina,
                itens_por_pagina=itens_por_pagina,
            )
            items = _extrair_items(payload)
            logger.info(
                "JOB DJEN: tentativa processo %s (sigla=%s, pagina=%s) retornou %s item(ns).",
                numero_processo,
                sigla or "sem_filtro",
                pagina,
                len(items),
            )
            ultimo_payload = payload
            ultimo_items = items
            acumulado_sigla.extend(items)
            if len(items) < itens_por_pagina:
                break
            pagina += 1
            if delay > 0:
                time.sleep(delay)

        if acumulado_sigla:
            dedup = _dedupe_items_djen(acumulado_sigla)
            return {"items": dedup}, dedup

    return ultimo_payload, ultimo_items


def _extrair_siglas_tribunais(payload):
    """Extrai siglas de tribunais de diferentes formatos de resposta do CNJ."""
    if isinstance(payload, list):
        itens = payload
    elif isinstance(payload, dict):
        if isinstance(payload.get("tribunais"), list):
            itens = payload.get("tribunais") or []
        elif isinstance(payload.get("data"), list):
            itens = payload.get("data") or []
        else:
            itens = _extrair_items(payload)
    else:
        itens = []

    siglas = []

    def _add_sigla(valor):
        if not valor:
            return
        sigla_str = str(valor).strip().upper()
        if sigla_str and sigla_str not in siglas:
            siglas.append(sigla_str)

    for item in itens:
        if not isinstance(item, dict):
            continue
        _add_sigla(_item_get(item, "sigla", "siglaTribunal", "siglatribunal"))

        instituicoes = item.get("instituicoes")
        if isinstance(instituicoes, list):
            for inst in instituicoes:
                if isinstance(inst, dict):
                    _add_sigla(_item_get(inst, "sigla", "siglaTribunal", "siglatribunal"))

    return siglas


def _dedupe_items_djen(items):
    """Deduplica itens retornados pelo CNJ para evitar salvar duplicidades em lotes multi-tribunal."""
    deduped = []
    chaves = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        chave = (
            _item_get(item, "hash", "id", "codigo"),
            _item_get(item, "numeroProcesso", "numeroprocesso"),
            _item_get(item, "dataDisponibilizacao", "datadisponibilizacao", "data"),
        )
        if chave in chaves:
            continue
        chaves.add(chave)
        deduped.append(item)
    return deduped


def _build_tentativas_consulta(*, sigla_tribunal, siglas_tribunais=None):
    """Monta sequência de tentativas por sigla com ordem estável e sem repetição.

    Cada tentativa começa na pagina=1; a paginação completa é feita dentro
    de ``_consultar_com_tentativas`` incrementando a página até a API
    retornar uma página incompleta (< itens_por_pagina) ou até o cap de
    segurança ``DJEN_MAX_PAGINAS_POR_CONSULTA``.
    """
    tentativas = []
    visitados = set()

    def _append(sigla):
        if sigla in visitados:
            return
        visitados.add(sigla)
        tentativas.append({"sigla_tribunal": sigla, "pagina": 1})

    if sigla_tribunal:
        _append(sigla_tribunal)

    for sigla in siglas_tribunais or []:
        if sigla:
            _append(sigla)

    _append(None)
    return tentativas


def _consultar_com_tentativas(
    *,
    tipo,
    numero_oab,
    numero_processo,
    sigla_tribunal,
    data_inicio,
    data_fim,
    logger,
    buscar_todos_tribunais=False,
    siglas_tribunais=None,
    uf_oab=None,
):
    """Executa tentativas de consulta no CNJ.

    Quando `buscar_todos_tribunais=True`, acumula resultados de todas as tentativas.
    Caso contrário, mantém o comportamento legado de parar no primeiro lote com itens.
    """
    tentativas = _build_tentativas_consulta(
        sigla_tribunal=sigla_tribunal,
        siglas_tribunais=siglas_tribunais if buscar_todos_tribunais else None,
    )

    itens_por_pagina = _get_config_int("DJEN_ITENS_POR_PAGINA", DJEN_ITENS_POR_PAGINA_PADRAO)
    max_paginas = _get_config_int(
        "DJEN_MAX_PAGINAS_POR_CONSULTA", DJEN_MAX_PAGINAS_POR_CONSULTA_PADRAO
    )
    delay = _get_config_float("DJEN_REQUEST_DELAY_SECONDS", 1.5)

    ultimo_payload = {}
    ultimo_items = []
    acumulado = []

    for t in tentativas:
        acumulado_tentativa = []
        pagina = max(1, int(t.get("pagina") or 1))
        while pagina <= max_paginas:
            payload = consultar_comunicacoes(
                numero_oab=numero_oab,
                uf_oab=uf_oab,
                numero_processo=numero_processo,
                sigla_tribunal=t["sigla_tribunal"],
                meio="D",
                data_inicio=data_inicio,
                data_fim=data_fim,
                pagina=pagina,
                itens_por_pagina=itens_por_pagina,
            )
            items = _extrair_items(payload)
            logger.info(
                "JOB DJEN: tentativa %s %s (sigla=%s, pagina=%s) retornou %s item(ns).",
                tipo,
                numero_oab or numero_processo,
                t["sigla_tribunal"] or "sem_filtro",
                pagina,
                len(items),
            )
            ultimo_payload = payload
            ultimo_items = items
            acumulado_tentativa.extend(items)
            if len(items) < itens_por_pagina:
                break
            pagina += 1
            if delay > 0:
                time.sleep(delay)

        if buscar_todos_tribunais:
            acumulado.extend(acumulado_tentativa)
            continue

        if acumulado_tentativa:
            dedup = _dedupe_items_djen(acumulado_tentativa)
            return {"items": dedup}, dedup

    if buscar_todos_tribunais:
        dedup = _dedupe_items_djen(acumulado)
        return {"items": dedup}, dedup
    return ultimo_payload, ultimo_items


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
    # enriquecimento-cnj: hot-path
    from utils.cnj import extrair_primeiro_cnj_valido  # noqa: PLC0415

    hash_com = _item_get(item, "hash", "id", "codigo")
    numero_proc = (
        _item_get(item, "numeroProcesso", "numeroprocesso")
        or (item.get("processo") or {}).get("numero")
        or ""
    )
    cnj_extraido_do_texto = False
    if not numero_proc:
        try:
            texto_para_busca = _item_get(item, "texto", "conteudo") or ""
            candidato = extrair_primeiro_cnj_valido(texto_para_busca)
            if candidato:
                numero_proc = candidato
                cnj_extraido_do_texto = True
        except Exception:
            # enriquecimento-cnj: nunca derrubar a ingestao por causa do enriquecimento
            cnj_extraido_do_texto = False

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

    # Extrai partes (polo ativo/passivo)
    partes_raw = _item_get(item, "partes", "polo") or []
    polo_ativo_list, polo_passivo_list = [], []
    if isinstance(partes_raw, list):
        for parte in partes_raw:
            if isinstance(parte, dict):
                nome_parte = _item_get(parte, "nome", "nomeAdvogado", "nomeParte") or ""
                tipo_parte = str(_item_get(parte, "tipoParte", "tipo") or "").upper()
                if nome_parte:
                    if "PASSIVO" in tipo_parte:
                        polo_passivo_list.append(nome_parte)
                    else:
                        polo_ativo_list.append(nome_parte)
    polo_ativo_str = " | ".join(polo_ativo_list) or None
    polo_passivo_str = " | ".join(polo_passivo_list) or None
    nome_juiz = str(_item_get(item, "nomeJuiz", "juiz", "magistrado") or "")[:200] or None

    # enriquecimento-cnj: hot-path — preencher mascara com canonico extraido
    if cnj_extraido_do_texto and not numero_proc_masc:
        numero_proc_masc = numero_proc

    # enriquecimento-cnj: hot-path — log estruturado quando preenchido pelo texto
    if cnj_extraido_do_texto:
        try:
            from flask import current_app  # noqa: PLC0415

            current_app.logger.info(
                "djen_cnj_extraido_do_texto",
                extra={
                    "event": "djen_cnj_extraido_do_texto",
                    "tenant_id": tenant_id,
                    "djen_id": djen_id,
                    "numero_processo": numero_proc,
                },
            )
        except Exception:
            pass

    # enriquecimento-cnj: hot-path — auto-vincular a Caso do MESMO tenant.
    # Caller pode ter passado caso_id explicitamente (ex.: busca por processo);
    # so vinculamos automaticamente quando caso_id veio None.
    status_origem_default = "pendente"

    # 1) Tentativa por numero de processo exato (caminho original).
    if caso_id is None and numero_proc:
        try:
            from models import Caso  # noqa: PLC0415

            caso_match = Caso.query.filter_by(
                tenant_id=tenant_id,
                numero_processo=numero_proc,
            ).first()
            if caso_match:
                caso_id = caso_match.id
                status_origem_default = "criado_automaticamente"
                try:
                    from flask import current_app  # noqa: PLC0415

                    current_app.logger.info(
                        "djen_auto_vinculado_a_caso",
                        extra={
                            "event": "djen_auto_vinculado_a_caso",
                            "tenant_id": tenant_id,
                            "djen_id": djen_id,
                            "caso_id": caso_id,
                            "numero_processo": numero_proc,
                            "estrategia": "numero_processo_exato",
                        },
                    )
                except Exception:
                    pass
        except Exception:
            # enriquecimento-cnj: nunca derrubar a ingestao por causa do enriquecimento
            pass

    # 2) Tentativa por CPF/CNPJ ou nome do cliente cadastrado. Resolve o caso
    # tipico: publicacao chega sem CNJ que bata, mas o cliente ja esta cadastrado
    # com CPF/CNPJ visivel no texto OU com nome identico ao polo ativo/passivo.
    if caso_id is None:
        try:
            from models import Caso, Cliente  # noqa: PLC0415

            # Monta uma "analise" minima compativel com tentar_auto_vincular_a_caso
            # usando o que ja temos extraido de polo_ativo/polo_passivo + texto.
            analise_min = {
                "partes_autoras": polo_ativo_list,
                "partes_reus": polo_passivo_list,
                "documentos_extraidos": list(CPF_CNPJ_REGEX.findall(texto or "")),
            }
            caso_id_auto = tentar_auto_vincular_a_caso(db, Cliente, Caso, tenant_id, analise_min)
            if caso_id_auto:
                caso_id = caso_id_auto
                status_origem_default = "criado_automaticamente"
                try:
                    from flask import current_app  # noqa: PLC0415

                    current_app.logger.info(
                        "djen_auto_vinculado_a_caso",
                        extra={
                            "event": "djen_auto_vinculado_a_caso",
                            "tenant_id": tenant_id,
                            "djen_id": djen_id,
                            "caso_id": caso_id,
                            "numero_processo": numero_proc,
                            "estrategia": "cliente_cadastrado",
                        },
                    )
                except Exception:
                    pass
        except Exception:
            pass

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
        polo_ativo=polo_ativo_str,
        polo_passivo=polo_passivo_str,
        nome_juiz=nome_juiz,
        raw_json=item,
        origem_busca=origem,
        # enriquecimento-cnj: hot-path — 'criado_automaticamente' quando auto-vinculado
        status_origem=status_origem_default,
        triagem_ignorada=False,
    )
    db.session.add(pub)
    return True


def _criar_tarefa_de_publicacao(db, TarefaPrazo, pub):
    """Cria TarefaPrazo automaticamente a partir de PublicacaoDJEN importante.

    Feature Kanban<>DJEN — fecha o ciclo Cliente -> Caso -> Intimacao -> Prazo.
    So' cria se:
      - pub.importante is True (classificada como relevante)
      - pub.caso_id nao e' None (sem caso vinculado, vai pra Triagem manual)
      - nao existe TarefaPrazo com publicacao_djen_id=pub.id (idempotente)

    Prazo calculado pela tabela de regras em djen_prazo_calculator.calcular_prazo.
    Nasce com prazo_validado=False e prazo_calculado_por_ia=True — o card no
    Kanban exibe badge "IA — confirmar prazo" ate o advogado confirmar.

    Retorna a TarefaPrazo criada (adicionada na sessao, sem commit) ou None
    se condicoes nao foram atendidas.
    """
    from djen_prazo_calculator import calcular_prazo  # noqa: PLC0415

    if not pub or pub.importante is not True or pub.caso_id is None:
        return None

    # Idempotencia: pub ja deu origem a uma tarefa?
    existe = TarefaPrazo.query.filter_by(publicacao_djen_id=pub.id).first()
    if existe is not None:
        return None

    calc = calcular_prazo(pub.tipo_comunicacao, pub.texto, pub.data_disponibilizacao)

    # Titulo curto pro card. Prefere tipo_comunicacao + numero do processo;
    # texto bruto da DJEN tem ruido (cabecalho de tribunal etc).
    tipo_label = (pub.tipo_comunicacao or "Intimacao").strip().capitalize()
    proc_label = pub.numero_processo_mascara or pub.numero_processo or ""
    titulo = f"{tipo_label}: {proc_label}".strip(": ").strip()
    if len(titulo) > 240:
        titulo = titulo[:237] + "..."

    descricao_parts = []
    if pub.classificacao_motivo:
        descricao_parts.append(f"Classificacao IA: {pub.classificacao_motivo}")
    if pub.texto:
        trecho = pub.texto.strip().replace("\n", " ")
        if len(trecho) > 500:
            trecho = trecho[:497] + "..."
        descricao_parts.append(f"Trecho: {trecho}")
    descricao = "\n\n".join(descricao_parts) or None

    tarefa = TarefaPrazo(
        tenant_id=pub.tenant_id,
        user_id=pub.user_id,
        caso_id=pub.caso_id,
        publicacao_djen_id=pub.id,
        titulo=titulo,
        descricao=descricao,
        status="A Fazer",
        prioridade=calc["prioridade"],
        data_vencimento=calc["data_vencimento"],
        tipo_tarefa="Prazo",
        origem_id=f"djen:{pub.id}",
        posicao=0,
        prazo_validado=False,
        prazo_calculado_por_ia=True,
        prazo_dias_origem=calc["dias"],
    )
    db.session.add(tarefa)
    return tarefa


def executar_auto_criacao_tarefas(app, tenant_id=None):
    """Feature Kanban<>DJEN: varre PublicacaoDJEN importantes ja vinculadas
    a caso e que ainda nao viraram TarefaPrazo, criando-as automaticamente.

    Idempotente (filtra NOT EXISTS em publicacao_djen_id). Usado tanto pelo
    job periodico quanto pela rota admin de regeneracao retroativa.

    Args:
        app: Flask app (precisa de app_context ja ativo; o caller cuida).
        tenant_id: opcional, restringe a um tenant especifico (multi-tenant).

    Retorna o numero de tarefas criadas no commit.
    """
    from extensions import db  # noqa: PLC0415
    from models import PublicacaoDJEN, TarefaPrazo  # noqa: PLC0415

    logger = logging.getLogger(__name__)
    tarefas_max = int(app.config.get("DJEN_AUTO_TAREFA_MAX_POR_RUN", 200))

    # NOT IN subquery: pubs sem tarefa associada via publicacao_djen_id.
    sub_pubs_com_tarefa = (
        db.session.query(TarefaPrazo.publicacao_djen_id)
        .filter(TarefaPrazo.publicacao_djen_id.isnot(None))
        .subquery()
    )
    q = (
        PublicacaoDJEN.query.filter(PublicacaoDJEN.importante.is_(True))
        .filter(PublicacaoDJEN.caso_id.isnot(None))
        .filter(
            ~PublicacaoDJEN.id.in_(db.session.query(sub_pubs_com_tarefa.c.publicacao_djen_id))
        )
    )
    if tenant_id is not None:
        q = q.filter_by(tenant_id=tenant_id)
    pubs = q.limit(tarefas_max).all()

    total = 0
    for pub in pubs:
        if _criar_tarefa_de_publicacao(db, TarefaPrazo, pub) is not None:
            total += 1
    if total:
        db.session.commit()
        logger.info(
            f"Kanban<>DJEN: criou {total} tarefa(s) automatica(s) "
            f"a partir de publicacoes importantes."
        )
    return total


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


def _normalizar_sigla_tribunal(uf_ou_sigla):
    """Normaliza UF/sigla para formato aceito pelo CNJ.

    - UF de 2 letras (ex.: PR) → TJPR
    - Siglas explícitas como TRT9, TST, STJ → retorna como está
    """
    if not uf_ou_sigla:
        return None
    valor = str(uf_ou_sigla).strip().upper()
    if not valor:
        return None
    # Siglas com mais de 2 chars são usadas diretamente (TRT9, TJPR, TST, etc.)
    if len(valor) > 2:
        return valor
    # UF de 2 chars → prefixo TJ
    return f"TJ{valor}"


def _normalizar_numero_oab(numero_oab):
    """Mantém apenas dígitos da OAB para reduzir erro de filtro no CNJ."""
    if numero_oab is None:
        return ""
    bruto = str(numero_oab).strip()
    if not bruto:
        return ""
    somente_digitos = "".join(ch for ch in bruto if ch.isdigit())
    return somente_digitos or bruto


def _consultar_oab_com_fallback(
    *, numero_oab, sigla_tribunal, data_inicio, data_fim, logger, uf_oab=None
):
    """Consulta DJEN para OAB com fallback de paginação e tribunal.

    Estratégia:
    1) Com tribunal e página 1
    2) Com tribunal e página 0
    3) Sem tribunal e página 1
    4) Sem tribunal e página 0
    """
    return _consultar_com_tentativas(
        tipo="OAB",
        numero_oab=numero_oab,
        numero_processo=None,
        sigla_tribunal=sigla_tribunal,
        data_inicio=data_inicio,
        data_fim=data_fim,
        logger=logger,
        buscar_todos_tribunais=False,
        siglas_tribunais=None,
        uf_oab=uf_oab,
    )


def _consultar_oab_em_todos_tribunais(
    *, numero_oab, sigla_tribunal, data_inicio, data_fim, logger, siglas_tribunais
):
    """Consulta OAB em todos os tribunais conhecidos, acumulando e deduplicando resultados."""
    return _consultar_com_tentativas(
        tipo="OAB",
        numero_oab=numero_oab,
        numero_processo=None,
        sigla_tribunal=sigla_tribunal,
        data_inicio=data_inicio,
        data_fim=data_fim,
        logger=logger,
        buscar_todos_tribunais=True,
        siglas_tribunais=siglas_tribunais,
    )


def _consultar_processo_em_todos_tribunais(
    *, numero_processo, sigla_tribunal, data_inicio, data_fim, logger, siglas_tribunais
):
    """Consulta processo em todos os tribunais conhecidos, acumulando e deduplicando resultados."""
    return _consultar_com_tentativas(
        tipo="processo",
        numero_oab=None,
        numero_processo=numero_processo,
        sigla_tribunal=sigla_tribunal,
        data_inicio=data_inicio,
        data_fim=data_fim,
        logger=logger,
        buscar_todos_tribunais=True,
        siglas_tribunais=siglas_tribunais,
    )


def job_monitorar_djen(app, lookback_days=None, tenant_id=None, force=False):
    """Job APScheduler: monitora publicações DJEN por OAB e por processo."""
    with app.app_context():
        # RLS: se invocado para um tenant especifico (ex: chamada manual via
        # /api/v1/djen/sync), seta g._rls_tenant_id para que o listener do
        # engine aplique set_config em cada transacao. Sem isso, as queries
        # batem nas policies RLS sem current_setting definido (erro
        # "unrecognized configuration parameter").
        # Para o caso scheduler com tenant_id=None (cross-tenant), o job
        # itera por tenant e seta g antes de cada bloco.
        if tenant_id is not None:
            from flask import g

            g._rls_tenant_id = int(tenant_id)

        logger = _get_logger(app)

        if not force and not app.config.get("DJEN_JOB_ENABLED", True):
            logger.info("JOB DJEN: desabilitado nas configurações. Pulando.")
            return {
                "ok": False,
                "skipped": True,
                "reason": "DJEN_JOB_ENABLED=false",
            }

        try:
            from app import Caso, DjenOabMonitoramento, PublicacaoDJEN, User, db
        except ImportError as e:
            logger.critical(f"JOB DJEN: falha ao importar modelos: {e}")
            return {
                "ok": False,
                "message": "Falha ao importar modelos DJEN.",
                "erro": str(e),
            }

        janela_dias = (
            lookback_days if lookback_days is not None else app.config.get("DJEN_LOOKBACK_DAYS", 30)
        )
        try:
            janela_dias = int(janela_dias)
        except (TypeError, ValueError):
            janela_dias = 30
        janela_dias = max(1, min(janela_dias, 365))
        data_fim = datetime.utcnow().date()
        data_inicio = data_fim - timedelta(days=janela_dias)

        # ── Verificação de backlog: pula sync se fila de triagem pendente for grande ──
        if not force:
            backlog_limit = int(app.config.get("DJEN_SYNC_BACKLOG_LIMIT", 50))
            backlog_query = PublicacaoDJEN.query.filter_by(status_origem="pendente")
            if tenant_id is not None:
                backlog_query = backlog_query.filter_by(tenant_id=tenant_id)
            backlog_count = backlog_query.count()
            if backlog_count > backlog_limit:
                logger.warning(
                    "JOB DJEN: sync pulado — backlog de %d pendentes (limite: %d). "
                    "Processe a triagem antes de buscar novas publicações.",
                    backlog_count,
                    backlog_limit,
                )
                return {
                    "ok": False,
                    "skipped": True,
                    "reason": f"backlog={backlog_count} > limit={backlog_limit}",
                }

        logger.info(
            "JOB DJEN: iniciando monitoramento de publicações "
            f"(janela: {janela_dias} dia(s), de {data_inicio} até {data_fim})."
        )
        total_novas = 0
        total_itens_encontrados = 0
        total_oabs_processadas = 0
        total_casos_processados = 0
        erros = 0
        buscar_todos_tribunais = bool(app.config.get("DJEN_BUSCAR_TODOS_TRIBUNAIS", True))
        siglas_tribunais = []

        if buscar_todos_tribunais:
            try:
                payload_tribunais = listar_tribunais()
                siglas_tribunais = _extrair_siglas_tribunais(payload_tribunais)
                logger.info(
                    "JOB DJEN: busca em todos os tribunais ativada (%s sigla(s) carregada(s)).",
                    len(siglas_tribunais),
                )
            except Exception as e:
                logger.warning(
                    "JOB DJEN: falha ao carregar lista de tribunais (%s). Seguindo sem varredura completa.",
                    e,
                )
                buscar_todos_tribunais = False

        # ── Vetor 1: busca pelas OABs monitoradas no tenant ─────────────────
        q_oabs = DjenOabMonitoramento.query.filter(
            db.or_(
                DjenOabMonitoramento.ativo.is_(True),
                DjenOabMonitoramento.ativo.is_(None),
            )
        )
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
                numero_oab = _normalizar_numero_oab(oab_mon.numero_oab)
                # A ComunicaAPI já agrega publicações de TODOS os tribunais quando
                # apenas o número da OAB é informado (sigla_tribunal=None).
                # Não é necessário iterar por cada tribunal individualmente — isso
                # gera 178+ requests e causa rate limit. Dois requests bastam.
                data, items = _consultar_oab_com_fallback(
                    numero_oab=numero_oab,
                    sigla_tribunal=None,
                    data_inicio=data_inicio,
                    data_fim=data_fim,
                    logger=logger,
                    uf_oab=oab_mon.uf_oab or None,
                )

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
                logger.error(
                    f"JOB DJEN: exceção inesperada (OAB {oab_mon.numero_oab}): {e}", exc_info=True
                )
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
            db.func.lower(Caso.status) == "ativo",
            db.or_(
                Caso.data_ultima_verificacao_djen.is_(None),
                Caso.data_ultima_verificacao_djen < limite_tempo,
            ),
        )
        if tenant_id is not None:
            casos_query = casos_query.filter_by(tenant_id=tenant_id)

        casos = (
            casos_query.order_by(Caso.data_ultima_verificacao_djen.asc().nulls_first())
            .limit(max_casos)
            .all()
        )

        logger.info(f"JOB DJEN: {len(casos)} caso(s) para verificar por processo.")

        for caso in casos:
            logger.info(f"JOB DJEN: buscando processo {caso.numero_processo} (caso {caso.id})")
            try:
                sigla_tribunal = _inferir_sigla_tribunal_por_numero_processo(caso.numero_processo)
                if buscar_todos_tribunais:
                    data, items = _consultar_processo_em_todos_tribunais(
                        numero_processo=caso.numero_processo,
                        sigla_tribunal=sigla_tribunal,
                        data_inicio=data_inicio,
                        data_fim=data_fim,
                        logger=logger,
                        siglas_tribunais=siglas_tribunais,
                    )
                else:
                    data, items = _consultar_processo_com_fallback(
                        numero_processo=caso.numero_processo,
                        sigla_tribunal=sigla_tribunal,
                        data_inicio=data_inicio,
                        data_fim=data_fim,
                        logger=logger,
                    )
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

        # Epic #2 (#176): classifica publicacoes pendentes (importante IS NULL)
        # via Gemini + short-circuit por tipo/keyword. Roda DEPOIS do save pra
        # nao atrasar o sync; se falhar parcial, pubs ficam com importante=NULL
        # pra retry no proximo sync (idempotente).
        total_classificadas = 0
        try:
            from djen_classifier import classificar_publicacao  # noqa: PLC0415
            from gemini_service import get_gemini_client, is_enabled  # noqa: PLC0415

            # Limite por execucao pra evitar runaway de custo. Configuravel.
            classificar_max = int(app.config.get("DJEN_CLASSIFICAR_MAX_POR_RUN", 100))
            modelo = app.config.get("GEMINI_TRIAGEM_MODEL", "gemini-2.5-flash")
            gemini_client = get_gemini_client() if is_enabled() else None

            q_pendentes = PublicacaoDJEN.query.filter(PublicacaoDJEN.importante.is_(None))
            if tenant_id is not None:
                q_pendentes = q_pendentes.filter_by(tenant_id=tenant_id)
            pendentes = q_pendentes.limit(classificar_max).all()

            for pub in pendentes:
                resultado = classificar_publicacao(pub, gemini_client, modelo)
                if resultado["importante"] is None:
                    continue  # falhou — deixa NULL pra retry
                pub.importante = resultado["importante"]
                pub.classificado_em = resultado["classificado_em"]
                pub.classificacao_motivo = resultado["motivo"]
                total_classificadas += 1
            if total_classificadas:
                db.session.commit()
                logger.info(
                    f"JOB DJEN: classificou {total_classificadas} publicacao(oes) "
                    f"pendente(s) via IA + short-circuit."
                )
        except Exception as e:
            logger.warning(f"JOB DJEN: classificacao IA falhou ({e}). Continuando.")

        # Feature Kanban<>DJEN: para toda publicacao classificada como
        # importante (importante=True) com caso vinculado (caso_id NOT NULL)
        # e que ainda nao virou tarefa, cria TarefaPrazo automaticamente.
        # Idempotente: rodar varias vezes nao duplica.
        total_tarefas_criadas = 0
        try:
            total_tarefas_criadas = executar_auto_criacao_tarefas(app, tenant_id=tenant_id)
        except Exception as e:
            logger.warning(
                f"JOB DJEN: auto-criacao de tarefas falhou ({e}). Continuando.",
                exc_info=True,
            )

        return {
            "ok": True,
            "lookback_days": janela_dias,
            "oabs_processadas": total_oabs_processadas,
            "casos_processados": total_casos_processados,
            "itens_encontrados": total_itens_encontrados,
            "publicacoes_salvas": total_novas,
            "publicacoes_classificadas": total_classificadas,
            "tarefas_auto_criadas": total_tarefas_criadas,
            "erros": erros,
        }


def _extrair_items(data):
    """Normaliza a resposta da ComunicaAPI para uma lista de itens."""
    if not data:
        return []
    # A API já retornou em diferentes formatos entre versões/documentações:
    # - {"content": [...]} (paginado)
    # - {"comunicacoes": [...]} (legado)
    # - {"items": [...], "count": N} (atual)
    if isinstance(data, dict):
        if "content" in data:
            return data["content"] or []
        if "comunicacoes" in data:
            return data["comunicacoes"] or []
        if "items" in data:
            return data["items"] or []
    if isinstance(data, list):
        return data
    return []
