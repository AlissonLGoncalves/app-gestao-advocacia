import re
import unicodedata

# enriquecimento-cnj: consolidacao — regex unico no utilitario compartilhado
from utils.cnj import CNJ_REGEX_TEXTO as CNJ_REGEX  # noqa: F401  (reexport para callers)

OAB_REGEX = re.compile(r"\b(?:OAB\/?[A-Z]{2}\s*)?\d{4,10}\b", re.IGNORECASE)
CPF_CNPJ_REGEX = re.compile(
    r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b|\b\d{11}\b|\b\d{14}\b"
)

# Mapa estado → sigla do tribunal (chaves normalizadas: sem acento, minúsculo)
_TRIBUNAL_MAP = {
    "parana": "TJPR",
    "sao paulo": "TJSP",
    "minas gerais": "TJMG",
    "rio de janeiro": "TJRJ",
    "bahia": "TJBA",
    "rio grande do sul": "TJRS",
    "santa catarina": "TJSC",
    "goias": "TJGO",
    "espirito santo": "TJES",
    "para": "TJPA",
    "pernambuco": "TJPE",
    "ceara": "TJCE",
    "amazonas": "TJAM",
    "maranhao": "TJMA",
    "mato grosso do sul": "TJMS",
    "mato grosso": "TJMT",
    "rondonia": "TJRO",
    "roraima": "TJRR",
    "tocantins": "TJTO",
    "amapa": "TJAP",
    "acre": "TJAC",
    "alagoas": "TJAL",
    "sergipe": "TJSE",
    "piaui": "TJPI",
    "paraiba": "TJPB",
    "rio grande do norte": "TJRN",
    "distrito federal": "TJDFT",
}


def normalizar_nome(s: str) -> str:
    """Normaliza nome para comparação: lowercase, sem acentos, whitespace colapsado."""
    s = (s or "").strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"\s+", " ", s)
    return s.lower().strip()


def _normalize_text(value):
    if not value:
        return ""
    value = str(value)
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"\s+", " ", value)
    return value.strip().lower()


def _dedupe_preserving_order(values):
    seen = set()
    out = []
    for value in values:
        v = (value or "").strip()
        if not v:
            continue
        key = _normalize_text(v)
        if key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out


def _inferir_tribunal(text):
    """Infere sigla do tribunal a partir do texto da publicação."""
    text_norm = normalizar_nome(text[:800])
    for keyword, sigla in _TRIBUNAL_MAP.items():
        if keyword in text_norm:
            return sigla
    return None


# Palavras que indicam INICIO DE OUTRA SECAO — captura para até elas (lookahead).
# Resolve bug: "AUTOR: VALDIR ESTORBEMADVOGADO(A): ALISSON" colava nome+advogado
# num campo só. Agora paramos antes da próxima label.
_STOP_LABELS_RE = (
    r"advogad[oa]?(?:\(a\))?|procurador(?:\(a\))?|representante|"
    r"reu(?:\(s\))?\s*[:\-]|requerid[oa]s?\s*[:\-]|executad[oa]s?\s*[:\-]|"
    r"impetrad[oa]s?\s*[:\-]|polo\s*passivo\s*[:\-]|polo\s*ativo\s*[:\-]|"
    r"requerente\s*[:\-]|exequente\s*[:\-]|impetrante\s*[:\-]|autor\(s\)\s*[:\-]|"
    r"despach[oa]|decis[ãa]o|sentenc[ae]|intima[cç][ãa]o|"
    r"valor\s+da\s+causa|classe\s+processual|assunto\s+principal|comarca\s+de"
)


def _extract_labeled_entities(text, labels):
    found = []
    for label in labels:
        # (?<!\w) — não casa dentro de palavras (ex.: "coautor" não dispara "autor")
        # Lookahead pelo proximo "stop label" para nao colar campos vizinhos.
        regex = re.compile(
            rf"(?<!\w){label}\s*[:\-]\s*(.+?)(?=\s*(?:{_STOP_LABELS_RE})|[;\n\r]|$)",
            re.IGNORECASE,
        )
        for match in regex.finditer(text):
            candidate = match.group(1).strip()
            # Remove padrão de próximo campo colado no final (defesa em profundidade)
            candidate = re.sub(r"\s+\w+(?:\([^)]*\))?\s*[:\-]\s*$", "", candidate).strip()
            # Remove itens numerados no corpo do texto (ex.: " 1. Nao obstante...")
            candidate = re.sub(r"\s+\d+\.\s+\S.*$", "", candidate, flags=re.DOTALL).strip()
            candidate = re.sub(r"\s+", " ", candidate)
            # Trunca em 150 chars (nome de parte raramente passa disso)
            if len(candidate) > 150:
                candidate = candidate[:150].rstrip()
            if len(candidate) >= 3:
                found.append(candidate)
    return _dedupe_preserving_order(found)


def _extract_labeled_value(text, labels):
    for label in labels:
        regex = re.compile(
            rf"(?<!\w){label}\s*[:\-]\s*([^\n\r]+)",
            re.IGNORECASE,
        )
        match = regex.search(text)
        if not match:
            continue
        value = (match.group(1) or "").strip()
        value = re.sub(r"\s+\w+(?:\([^)]*\))?\s*[:\-]\s*$", "", value).strip()
        value = re.sub(r"\s+", " ", value)
        if value:
            return value
    return None


def _extract_valor_causa(text):
    match = re.search(r"valor\s+da\s+causa\s*[:\-]?\s*(R\$\s*[\d\.,]+)", text, re.IGNORECASE)
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group(1)).strip()


def _extract_comarca(text):
    match = re.search(r"comarca\s+de\s+([^\n\r\-]+)", text, re.IGNORECASE)
    if not match:
        return None
    comarca = (match.group(1) or "").strip()
    comarca = re.sub(r"\s+", " ", comarca)
    return comarca or None


def _extract_nome_juiz(text):
    padroes = [
        r"juiz(?:a)?\s+de\s+direito\s*[:\-]?\s*([^\n\r]+)",
        r"magistrad[oa]\s*[:\-]?\s*([^\n\r]+)",
        r"nome\s+juiz\s*[:\-]?\s*([^\n\r]+)",
    ]
    for padrao in padroes:
        match = re.search(padrao, text, re.IGNORECASE)
        if not match:
            continue
        nome = (match.group(1) or "").strip()
        nome = re.sub(r"\s+\w+(?:\([^)]*\))?\s*[:\-]\s*$", "", nome).strip()
        nome = re.sub(r"\s+", " ", nome)
        if nome:
            return nome
    return None


def analisar_publicacao(publicacao):
    texto = (getattr(publicacao, "texto", None) or "").strip()
    raw = getattr(publicacao, "raw_json", None) or {}

    raw_text_chunks = []
    if isinstance(raw, dict):
        for key in ("texto", "conteudo", "comunicacao", "resumo"):
            value = raw.get(key)
            if value:
                raw_text_chunks.append(str(value))

    texto_total = " ".join([texto] + raw_text_chunks).strip()
    # Normaliza múltiplos espaços/tabs consecutivos como separadores de campo (→ \n)
    texto_total = re.sub(r"[ \t]{2,}", "\n", texto_total)

    numero_processo = getattr(publicacao, "numero_processo", None)
    if not numero_processo:
        match = CNJ_REGEX.search(texto_total)
        numero_processo = match.group(0) if match else None

    autores = _extract_labeled_entities(
        texto_total,
        [
            r"autor\(s\)",
            r"autor(?:a)?",
            r"requerente",
            r"exequente",
            r"polo\s*ativo",
            r"impetrante",
        ],
    )
    reus = _extract_labeled_entities(
        texto_total,
        [
            r"reu\(s\)",
            r"reu",
            r"requerido",
            r"executado",
            r"polo\s*passivo",
            r"impetrado",
        ],
    )
    representantes = _extract_labeled_entities(
        texto_total, [r"advogado(?:\(a\))?", r"procurador(?:\(a\))?", r"representante(?:\s*legal)?"]
    )

    classe_processual = _extract_labeled_value(texto_total, [r"classe\s+processual"])
    assunto_principal = _extract_labeled_value(texto_total, [r"assunto\s+principal"])
    valor_causa = _extract_valor_causa(texto_total)
    comarca = _extract_comarca(texto_total)
    nome_juiz = getattr(publicacao, "nome_juiz", None) or _extract_nome_juiz(texto_total)

    # fallback mínimo usando nomeParte da API quando disponível
    nome_parte = ""
    if isinstance(raw, dict):
        nome_parte = (raw.get("nomeParte") or "").strip()
    if nome_parte and not autores and not reus:
        autores = [nome_parte]

    oabs = OAB_REGEX.findall(texto_total)
    oabs = _dedupe_preserving_order(oabs)

    doc_ids = _dedupe_preserving_order(CPF_CNPJ_REGEX.findall(texto_total))
    tribunal = getattr(publicacao, "sigla_tribunal", None) or (
        raw.get("siglaTribunal") if isinstance(raw, dict) else None
    )
    # Fallback: inferir tribunal a partir do texto quando não disponível nos metadados
    if not tribunal:
        tribunal = _inferir_tribunal(texto_total)

    confidence = 0.0
    if numero_processo:
        confidence += 0.35
    if autores or reus:
        confidence += 0.25
    if representantes:
        confidence += 0.15
    if oabs:
        confidence += 0.1
    if tribunal:
        confidence += 0.05
    if doc_ids:
        confidence += 0.1
    confidence = round(min(confidence, 1.0), 2)

    return {
        "numero_processo": numero_processo,
        "tribunal": tribunal,
        "classe_processual": classe_processual,
        "assunto_principal": assunto_principal,
        "valor_causa": valor_causa,
        "comarca": comarca,
        "nome_juiz": nome_juiz,
        "partes_autoras": autores,
        "partes_reus": reus,
        "representantes": representantes,
        "oabs_encontradas": oabs,
        "documentos_extraidos": doc_ids,
        "confianca": confidence,
        "revisao_manual_recomendada": confidence < 0.6,
    }


def tentar_auto_vincular_a_caso(db, Cliente, Caso, tenant_id, analise):
    """Tenta encontrar um Caso ativo do tenant para vincular automaticamente.

    Estrategia (ordem de precedencia):
    1. CPF/CNPJ no texto da publicacao bate com Cliente.cpf_cnpj do tenant →
       vincula ao caso ATIVO mais recente desse cliente.
    2. Nome de parte (autor/reu) bate exatamente com Cliente.nome_razao_social
       (normalizado) → vincula ao caso ATIVO mais recente.

    Retorna o caso_id encontrado, ou None se nao houver match seguro.
    """
    documentos = [re.sub(r"\D", "", d) for d in (analise.get("documentos_extraidos") or []) if d]
    nomes = _dedupe_preserving_order(
        (analise.get("partes_autoras") or []) + (analise.get("partes_reus") or [])
    )

    status_inativos = ("Concluido", "Concluído", "Arquivado", "Encerrado")

    def _caso_ativo_do_cliente(cliente_id):
        return (
            Caso.query.filter(
                Caso.tenant_id == tenant_id,
                Caso.cliente_id == cliente_id,
                ~Caso.status.in_(status_inativos),
            )
            .order_by(Caso.id.desc())
            .first()
        )

    # 1) CPF/CNPJ exato
    if documentos:
        clientes_doc = (
            Cliente.query.filter(
                Cliente.tenant_id == tenant_id,
                Cliente.cpf_cnpj.isnot(None),
                Cliente.cpf_cnpj != "",
            )
            .limit(500)
            .all()
        )
        for cliente in clientes_doc:
            cpf = re.sub(r"\D", "", cliente.cpf_cnpj or "")
            if cpf and cpf in documentos:
                caso = _caso_ativo_do_cliente(cliente.id)
                if caso:
                    return caso.id

    # 2) Nome exato (normalizado)
    nomes_norm = {normalizar_nome(n) for n in nomes if n and len(n) >= 4}
    if nomes_norm:
        candidatos = Cliente.query.filter(Cliente.tenant_id == tenant_id).limit(500).all()
        for cliente in candidatos:
            if normalizar_nome(cliente.nome_razao_social or "") in nomes_norm:
                caso = _caso_ativo_do_cliente(cliente.id)
                if caso:
                    return caso.id

    return None


def analisar_com_ia(publicacao):
    """Fallback Gemini quando o regex nao tem confianca alta.

    Recebe a mesma `publicacao` (Modelo PublicacaoDJEN) que `analisar_publicacao`
    e retorna um dict com a MESMA estrutura. Custo: ~$0.001/publicacao.

    Usado pelo endpoint de triagem quando confianca regex < 0.5. Ingestao em
    massa NAO chama esta funcao (lenta) — mantem o regex como hot-path.
    """
    try:
        from gemini_service import get_gemini_client, is_enabled  # noqa: PLC0415
    except Exception:
        return None

    if not is_enabled():
        return None

    client = get_gemini_client()
    if client is None:
        return None

    texto = (getattr(publicacao, "texto", None) or "").strip()
    if not texto or len(texto) < 50:
        return None

    # Trunca textos enormes (alguns autos completos passam de 50k chars)
    texto_input = texto[:8000]

    prompt = f"""Voce e um analista juridico brasileiro. Extraia entidades estruturadas de uma
publicacao do DJEN (Diario de Justica Eletronico Nacional) e retorne APENAS JSON valido,
sem markdown, sem texto fora do JSON.

ESTRUTURA OBRIGATORIA:
{{
  "numero_processo": "string CNJ no formato NNNNNNN-DD.AAAA.J.TR.OOOO ou null",
  "tribunal": "sigla do tribunal: TJPR, TJSP, TRF4, TRT9, etc. ou null",
  "classe_processual": "string ou null",
  "assunto_principal": "string ou null",
  "valor_causa": "string com R$ e numero, ou null",
  "comarca": "nome da comarca ou null",
  "nome_juiz": "nome completo do magistrado ou null",
  "partes_autoras": ["lista de nomes dos autores/requerentes/exequentes/polo ativo"],
  "partes_reus": ["lista de nomes dos reus/requeridos/executados/polo passivo"],
  "representantes": ["lista de nomes dos advogados/procuradores"],
  "oabs_encontradas": ["lista de OABs no formato 'OAB/UF NNNNN'"],
  "documentos_extraidos": ["lista de CPFs/CNPJs com mascara"]
}}

REGRAS CRITICAS:
1. NUNCA misture nome de parte com nome de advogado. Se ler "AUTOR: JOAO ADVOGADO(A): MARIA",
   parte_autora = ["JOAO"] e representantes = ["MARIA"], NUNCA ["JOAO ADVOGADO(A): MARIA"].
2. Se a publicacao mencionar varios autores ou varios reus, liste TODOS separadamente.
3. Para CPF use formato NNN.NNN.NNN-NN. Para CNPJ NN.NNN.NNN/NNNN-NN.
4. Liste apenas o que estiver EXPLICITO no texto. Nao invente.
5. Quando um campo nao constar, use null ou lista vazia.

PUBLICACAO:
{texto_input}
"""

    try:
        from flask import current_app  # noqa: PLC0415

        model = current_app.config.get("GEMINI_TRIAGEM_MODEL", "gemini-2.5-flash")
        response = client.models.generate_content(model=model, contents=prompt)
    except Exception as exc:
        try:
            from flask import current_app  # noqa: PLC0415

            current_app.logger.warning("djen_triagem_ia_falhou: %s", exc)
        except Exception:
            pass
        return None

    raw = (getattr(response, "text", None) or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    if raw.endswith("```"):
        raw = raw[:-3].strip()

    try:
        import json  # noqa: PLC0415

        parsed = json.loads(raw)
    except Exception:
        return None

    if not isinstance(parsed, dict):
        return None

    # Sanitiza retorno e calcula confianca apos extracao da IA
    autores = [str(x).strip() for x in (parsed.get("partes_autoras") or []) if x]
    reus = [str(x).strip() for x in (parsed.get("partes_reus") or []) if x]
    representantes = [str(x).strip() for x in (parsed.get("representantes") or []) if x]
    oabs = [str(x).strip() for x in (parsed.get("oabs_encontradas") or []) if x]
    docs = [str(x).strip() for x in (parsed.get("documentos_extraidos") or []) if x]
    numero_processo = (parsed.get("numero_processo") or "").strip() or None
    tribunal = (parsed.get("tribunal") or "").strip() or None

    # Mesmo scoring do regex pra manter compatibilidade com revisao_manual_recomendada
    confidence = 0.0
    if numero_processo:
        confidence += 0.35
    if autores or reus:
        confidence += 0.25
    if representantes:
        confidence += 0.15
    if oabs:
        confidence += 0.10
    if tribunal:
        confidence += 0.05
    if docs:
        confidence += 0.10
    # Bonus pra IA: estrutura limpa garante +0.10 (separou autor de advogado)
    confidence = round(min(confidence + 0.10, 1.0), 2)

    return {
        "numero_processo": numero_processo,
        "tribunal": tribunal,
        "classe_processual": (parsed.get("classe_processual") or "").strip() or None,
        "assunto_principal": (parsed.get("assunto_principal") or "").strip() or None,
        "valor_causa": (parsed.get("valor_causa") or "").strip() or None,
        "comarca": (parsed.get("comarca") or "").strip() or None,
        "nome_juiz": (parsed.get("nome_juiz") or "").strip() or None,
        "partes_autoras": autores,
        "partes_reus": reus,
        "representantes": representantes,
        "oabs_encontradas": oabs,
        "documentos_extraidos": docs,
        "confianca": confidence,
        "revisao_manual_recomendada": confidence < 0.6,
        "fonte_analise": "ia_gemini",
    }


def analisar_publicacao_com_fallback_ia(publicacao, limiar=0.5):
    """Combina regex + Gemini: roda regex primeiro (rapido, gratis), e quando
    a confianca fica abaixo de `limiar` aciona o Gemini como segundo passo.

    Retorna sempre um dict com a mesma estrutura de `analisar_publicacao`,
    com chave extra `fonte_analise` ('regex' ou 'ia_gemini').
    """
    analise = analisar_publicacao(publicacao)
    analise["fonte_analise"] = "regex"

    if (analise.get("confianca") or 0.0) >= limiar:
        return analise

    analise_ia = analisar_com_ia(publicacao)
    if not analise_ia:
        return analise

    # Se a IA tem confianca maior, usa ela
    if (analise_ia.get("confianca") or 0.0) > (analise.get("confianca") or 0.0):
        return analise_ia

    return analise


def montar_grupos_pendentes(db, Cliente, Caso, PublicacaoDJEN, tenant_id):
    """Agrupa publicacoes pendentes (caso_id IS NULL, triagem_ignorada=False)
    em buckets que fazem sentido para o usuario tratar de uma vez.

    Tipos de grupo:
    - mesmo_processo: 2+ pubs com mesmo numero CNJ
    - cliente_existente: pubs cuja parte bate com Cliente cadastrado
    - mesmo_nome_novo: 2+ pubs com mesma parte (cliente ainda nao cadastrado)
    - isolada: 1 pub sem grupo

    Retorna lista ordenada (grupos maiores primeiro, isoladas no fim).
    """
    from collections import defaultdict

    pubs = (
        PublicacaoDJEN.query.filter(
            PublicacaoDJEN.tenant_id == tenant_id,
            PublicacaoDJEN.caso_id.is_(None),
            PublicacaoDJEN.triagem_ignorada.is_(False),
        )
        .order_by(PublicacaoDJEN.data_disponibilizacao.desc())
        .all()
    )

    # Carrega clientes do tenant para matching
    clientes = Cliente.query.filter_by(tenant_id=tenant_id).all()
    cliente_por_nome = {}
    for c in clientes:
        if c.nome_razao_social:
            cliente_por_nome[normalizar_nome(c.nome_razao_social)] = c
    cliente_por_doc = {}
    for c in clientes:
        if c.cpf_cnpj:
            doc = re.sub(r"\D", "", c.cpf_cnpj)
            if doc:
                cliente_por_doc[doc] = c

    # Pre-processa cada pub
    pub_infos = []
    for pub in pubs:
        analise = analisar_publicacao(pub)
        nomes = (analise.get("partes_autoras") or []) + (analise.get("partes_reus") or [])
        docs = [re.sub(r"\D", "", d) for d in (analise.get("documentos_extraidos") or []) if d]

        # Tenta achar cliente existente por doc ou nome
        cliente_match = None
        for d in docs:
            if d and d in cliente_por_doc:
                cliente_match = cliente_por_doc[d]
                break
        if not cliente_match:
            for nome in nomes:
                ck = normalizar_nome(nome)
                if ck and ck in cliente_por_nome:
                    cliente_match = cliente_por_nome[ck]
                    break

        pub_infos.append(
            {
                "pub": pub,
                "numero_processo": pub.numero_processo or analise.get("numero_processo"),
                "nomes": nomes,
                "cliente_match": cliente_match,
            }
        )

    grupos = []
    pubs_alocadas = set()

    # 1) Mesmo CNJ (2+ pubs)
    por_cnj = defaultdict(list)
    for info in pub_infos:
        if info["numero_processo"]:
            por_cnj[info["numero_processo"]].append(info)
    for cnj, lista in por_cnj.items():
        if len(lista) >= 2:
            cliente_unico = None
            ids_clientes = {(i["cliente_match"].id if i["cliente_match"] else None) for i in lista}
            if len(ids_clientes) == 1 and None not in ids_clientes:
                cliente_unico = lista[0]["cliente_match"]

            grupos.append(
                {
                    "id": f"cnj:{cnj}",
                    "tipo": "mesmo_processo",
                    "titulo": f"Processo {cnj}",
                    "descricao": f"{len(lista)} publicações do mesmo processo",
                    "pub_ids": [i["pub"].id for i in lista],
                    "cliente_existente_id": cliente_unico.id if cliente_unico else None,
                    "cliente_existente_nome": (
                        cliente_unico.nome_razao_social if cliente_unico else None
                    ),
                    "count": len(lista),
                    "amostra_titulo": (
                        lista[0]["pub"].numero_processo_mascara
                        or lista[0]["pub"].numero_processo
                        or ""
                    ),
                }
            )
            for i in lista:
                pubs_alocadas.add(i["pub"].id)

    # 2) Cliente cadastrado (sem CNJ duplicado ja agrupado)
    por_cliente = defaultdict(list)
    for info in pub_infos:
        if info["pub"].id in pubs_alocadas:
            continue
        if info["cliente_match"]:
            por_cliente[info["cliente_match"].id].append(info)
    for cliente_id, lista in por_cliente.items():
        cliente = lista[0]["cliente_match"]
        grupos.append(
            {
                "id": f"cliente:{cliente_id}",
                "tipo": "cliente_existente",
                "titulo": cliente.nome_razao_social,
                "descricao": (
                    f"{len(lista)} publicação(ões) de cliente já cadastrado — "
                    "vincular tudo direto"
                ),
                "pub_ids": [i["pub"].id for i in lista],
                "cliente_existente_id": cliente_id,
                "cliente_existente_nome": cliente.nome_razao_social,
                "count": len(lista),
                "amostra_titulo": cliente.nome_razao_social,
            }
        )
        for i in lista:
            pubs_alocadas.add(i["pub"].id)

    # 3) Mesmo nome novo (cluster por primeiro nome)
    por_nome_novo = defaultdict(list)
    for info in pub_infos:
        if info["pub"].id in pubs_alocadas:
            continue
        if info["nomes"]:
            chave = normalizar_nome(info["nomes"][0])
            if chave:
                por_nome_novo[chave].append(info)
    for nome_norm, lista in por_nome_novo.items():
        if len(lista) >= 2:
            grupos.append(
                {
                    "id": f"nome:{nome_norm}",
                    "tipo": "mesmo_nome_novo",
                    "titulo": lista[0]["nomes"][0],
                    "descricao": (
                        f"{len(lista)} publicação(ões) com mesmo nome — "
                        "cadastrar uma vez e vincular todas"
                    ),
                    "pub_ids": [i["pub"].id for i in lista],
                    "cliente_existente_id": None,
                    "cliente_existente_nome": None,
                    "count": len(lista),
                    "amostra_titulo": lista[0]["nomes"][0],
                }
            )
            for i in lista:
                pubs_alocadas.add(i["pub"].id)

    # 4) Isoladas
    isoladas = []
    for info in pub_infos:
        if info["pub"].id in pubs_alocadas:
            continue
        nome_principal = info["nomes"][0] if info["nomes"] else ""
        isoladas.append(
            {
                "id": f"pub:{info['pub'].id}",
                "tipo": "isolada",
                "titulo": nome_principal or f"Publicação {info['pub'].id}",
                "descricao": (
                    info["pub"].numero_processo_mascara or info["pub"].numero_processo or "Sem CNJ"
                ),
                "pub_ids": [info["pub"].id],
                "cliente_existente_id": (
                    info["cliente_match"].id if info["cliente_match"] else None
                ),
                "cliente_existente_nome": (
                    info["cliente_match"].nome_razao_social if info["cliente_match"] else None
                ),
                "count": 1,
                "amostra_titulo": nome_principal or info["pub"].numero_processo_mascara or "",
            }
        )

    # Ordena: grupos maiores primeiro, isoladas no fim
    grupos.sort(key=lambda g: (-g["count"], g["tipo"]))
    grupos.extend(isoladas)

    return grupos


def sugerir_vinculos(db, Cliente, Caso, tenant_id, analise):
    numero_processo = (analise.get("numero_processo") or "").strip()
    nomes = _dedupe_preserving_order(
        (analise.get("partes_autoras") or []) + (analise.get("partes_reus") or [])
    )
    documentos = [re.sub(r"\D", "", d) for d in (analise.get("documentos_extraidos") or []) if d]

    sugestoes_casos = []
    sugestoes_clientes = []

    if numero_processo:
        exato = Caso.query.filter_by(tenant_id=tenant_id, numero_processo=numero_processo).all()
        for caso in exato:
            sugestoes_casos.append(
                {
                    "id": caso.id,
                    "titulo": caso.titulo,
                    "numero_processo": caso.numero_processo,
                    "score": 0.99,
                    "motivo": "Numero de processo exato",
                }
            )

    if not sugestoes_casos and numero_processo:
        somente_digitos = re.sub(r"\D", "", numero_processo)
        if somente_digitos:
            approx = (
                Caso.query.filter(
                    Caso.tenant_id == tenant_id,
                    Caso.numero_processo.isnot(None),
                    Caso.numero_processo != "",
                )
                .limit(100)
                .all()
            )
            for caso in approx:
                num_caso = re.sub(r"\D", "", caso.numero_processo or "")
                if num_caso and (somente_digitos in num_caso or num_caso in somente_digitos):
                    sugestoes_casos.append(
                        {
                            "id": caso.id,
                            "titulo": caso.titulo,
                            "numero_processo": caso.numero_processo,
                            "score": 0.78,
                            "motivo": "Numero de processo aproximado",
                        }
                    )

    for nome in nomes[:5]:
        if len(nome) < 4:
            continue
        candidatos = (
            Cliente.query.filter(
                Cliente.tenant_id == tenant_id,
                Cliente.nome_razao_social.ilike(f"%{nome}%"),
            )
            .limit(5)
            .all()
        )
        for cliente in candidatos:
            score = 0.7
            if normalizar_nome(cliente.nome_razao_social) == normalizar_nome(nome):
                score = 0.92
            sugestoes_clientes.append(
                {
                    "id": cliente.id,
                    "nome_razao_social": cliente.nome_razao_social,
                    "cpf_cnpj": cliente.cpf_cnpj,
                    "score": score,
                    "motivo": f"Nome semelhante a '{nome}'",
                }
            )

    if documentos:
        clientes_doc = (
            Cliente.query.filter(
                Cliente.tenant_id == tenant_id,
                Cliente.cpf_cnpj.isnot(None),
                Cliente.cpf_cnpj != "",
            )
            .limit(300)
            .all()
        )
        for cliente in clientes_doc:
            cpf_cnpj = re.sub(r"\D", "", cliente.cpf_cnpj or "")
            if cpf_cnpj and cpf_cnpj in documentos:
                sugestoes_clientes.append(
                    {
                        "id": cliente.id,
                        "nome_razao_social": cliente.nome_razao_social,
                        "cpf_cnpj": cliente.cpf_cnpj,
                        "score": 0.98,
                        "motivo": "CPF/CNPJ exato encontrado no texto da publicação",
                    }
                )

    # remove duplicados mantendo maior score
    casos_by_id = {}
    for item in sugestoes_casos:
        prev = casos_by_id.get(item["id"])
        if (not prev) or (item["score"] > prev["score"]):
            casos_by_id[item["id"]] = item

    clientes_by_id = {}
    for item in sugestoes_clientes:
        prev = clientes_by_id.get(item["id"])
        if (not prev) or (item["score"] > prev["score"]):
            clientes_by_id[item["id"]] = item

    casos_out = sorted(casos_by_id.values(), key=lambda x: x["score"], reverse=True)[:5]
    clientes_out = sorted(clientes_by_id.values(), key=lambda x: x["score"], reverse=True)[:5]

    return {
        "casos": casos_out,
        "clientes": clientes_out,
    }
