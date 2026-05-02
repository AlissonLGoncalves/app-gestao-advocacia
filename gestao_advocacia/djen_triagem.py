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


def construir_indices_auto_vinculo(Cliente, Caso, tenant_id):
    """Pre-carrega clientes + casos ativos do tenant em estruturas otimizadas
    para chamadas em massa de auto-vinculo. Use esta funcao UMA VEZ antes de
    iterar muitas publicacoes — evita N+1 queries.

    Retorna dict com:
    - cpf_to_caso_id: {cpf_digitos: caso_id}
    - nome_norm_to_caso_id: {nome_normalizado: caso_id}
    """
    status_inativos = ("Concluido", "Concluído", "Arquivado", "Encerrado")

    # 1 query: todos os casos ativos do tenant (com cliente eager)
    casos_ativos = (
        Caso.query.filter(
            Caso.tenant_id == tenant_id,
            ~Caso.status.in_(status_inativos),
        )
        .order_by(Caso.id.desc())
        .all()
    )

    # Mapa cliente_id -> caso_id (mais recente)
    cliente_to_caso = {}
    for caso in casos_ativos:
        if caso.cliente_id and caso.cliente_id not in cliente_to_caso:
            cliente_to_caso[caso.cliente_id] = caso.id

    # 1 query: todos os clientes do tenant
    clientes = Cliente.query.filter(Cliente.tenant_id == tenant_id).all()

    cpf_to_caso_id = {}
    nome_norm_to_caso_id = {}
    for cliente in clientes:
        caso_id = cliente_to_caso.get(cliente.id)
        if not caso_id:
            continue  # cliente sem caso ativo nao serve pra auto-vinculo
        if cliente.cpf_cnpj:
            cpf_dig = re.sub(r"\D", "", cliente.cpf_cnpj)
            if cpf_dig:
                cpf_to_caso_id[cpf_dig] = caso_id
        if cliente.nome_razao_social:
            nome_norm = normalizar_nome(cliente.nome_razao_social)
            if nome_norm:
                nome_norm_to_caso_id[nome_norm] = caso_id

    return {
        "cpf_to_caso_id": cpf_to_caso_id,
        "nome_norm_to_caso_id": nome_norm_to_caso_id,
    }


def tentar_auto_vincular_via_indices(analise, indices):
    """Versao otimizada de tentar_auto_vincular_a_caso que recebe indices
    pre-calculados (via construir_indices_auto_vinculo). Sem queries.

    Retorna caso_id ou None.
    """
    cpf_to_caso = indices.get("cpf_to_caso_id") or {}
    nome_to_caso = indices.get("nome_norm_to_caso_id") or {}

    # 1) CPF/CNPJ exato
    documentos = [re.sub(r"\D", "", d) for d in (analise.get("documentos_extraidos") or []) if d]
    for doc in documentos:
        if doc and doc in cpf_to_caso:
            return cpf_to_caso[doc]

    # 2) Nome exato (normalizado)
    nomes = (analise.get("partes_autoras") or []) + (analise.get("partes_reus") or [])
    for nome in nomes:
        if not nome or len(nome) < 4:
            continue
        nome_norm = normalizar_nome(nome)
        if nome_norm and nome_norm in nome_to_caso:
            return nome_to_caso[nome_norm]

    return None


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

    # Trunca textos muito grandes mas mantém contexto generoso (32k chars cobre
    # a maior parte das intimações e até autos médios). Modelos atuais aceitam
    # bem mais — limitamos só pra economizar tokens.
    texto_input = texto[:32000]

    raw_json = getattr(publicacao, "raw_json", None) or {}
    contexto_extra = ""
    if isinstance(raw_json, dict):
        partes_api = raw_json.get("partes") or raw_json.get("polo") or []
        if partes_api:
            try:
                import json as _json  # noqa: PLC0415

                contexto_extra = (
                    "\n\nCONTEXTO ADICIONAL (partes vindas da API DJEN, formato bruto):\n"
                    + _json.dumps(partes_api, ensure_ascii=False)[:2000]
                )
            except Exception:
                contexto_extra = ""

    prompt = f"""Voce e um analista juridico brasileiro especialista em extrair entidades
estruturadas de publicacoes do DJEN (Diario de Justica Eletronico Nacional).
Sua resposta DEVE ser APENAS JSON valido, sem markdown, sem texto fora do JSON.

ESTRUTURA OBRIGATORIA (todos os campos sao obrigatorios — use null/lista vazia se nao tiver):
{{
  "numero_processo": "string no formato CNJ NNNNNNN-DD.AAAA.J.TR.OOOO, ou null",
  "tribunal": "sigla do tribunal: TJPR, TJSP, TRF4, TRT9, STJ, etc., ou null",
  "classe_processual": "ex: 'Procedimento Comum Civel', 'Acao Trabalhista - Rito Sumarissimo', 'Cumprimento de Sentenca', ou null",
  "assunto_principal": "ex: 'Indenizacao por Danos Morais', 'Verbas Rescisorias', ou null",
  "valor_causa": "string com R$ e numero formatado (ex: 'R$ 15.000,00'), ou null",
  "comarca": "nome da comarca/secao judiciaria, ex: 'Curitiba', 'Cornelio Procopio', ou null",
  "nome_juiz": "nome completo do magistrado, ou null",

  "partes_autoras": [
    {{
      "nome": "nome COMPLETO da parte autora",
      "tipo_pessoa": "PF" ou "PJ",
      "cpf_cnpj": "CPF NNN.NNN.NNN-NN ou CNPJ NN.NNN.NNN/NNNN-NN, ou null",
      "advogados": ["nome do(s) advogado(s) DESTA parte, separados — NUNCA junte com o nome da parte"],
      "oabs": ["OAB no formato 'OAB/UF NNNNNN' do(s) advogado(s) DESTA parte"]
    }}
  ],
  "partes_reus": [
    {{ "nome": "...", "tipo_pessoa": "PF|PJ", "cpf_cnpj": "...|null", "advogados": [...], "oabs": [...] }}
  ]
}}

REGRAS CRITICAS DE EXTRACAO:
1. NUNCA cole nome de parte com nome de advogado. Se ler "AUTOR: LETICIA CARLA DA SILVA
   ADVOGADO(A): JOSE": parte_autora.nome = "LETICIA CARLA DA SILVA" e
   parte_autora.advogados = ["JOSE"]. NUNCA "LETICIA CARLA DA SILVA ADVOGADO(A): JOSE".

2. NUNCA cole multiplos reus/autores num unico campo. Exemplo do que NAO FAZER:
   ENTRADA: "Autor: MINISTERIO PUBLICO Reu(s): Anselmo Luiz Stroparo Drenaplan
   Terraplenagem Ltda. ME Siliomar Silas Cavaline Vistos."
   ERRADO: partes_autoras = [{{"nome": "MINISTERIO PUBLICO Reu(s): Anselmo Luiz
   Stroparo Drenaplan Terraplenagem Ltda. ME Siliomar Silas Cavaline Vistos."}}]
   CERTO:
     partes_autoras = [{{"nome": "MINISTERIO PUBLICO DO ESTADO DO PARANA",
                         "tipo_pessoa": "PJ", ...}}]
     partes_reus = [
       {{"nome": "Anselmo Luiz Stroparo", "tipo_pessoa": "PF", ...}},
       {{"nome": "Drenaplan Terraplenagem Ltda. ME", "tipo_pessoa": "PJ", ...}},
       {{"nome": "Siliomar Silas Cavaline", "tipo_pessoa": "PF", ...}}
     ]
   "Vistos." NAO eh parte — eh inicio da decisao. IGNORE termos como "Vistos",
   "Vistos etc", "Decido", "Sentenca" — eles marcam o fim da lista de partes.

3. CPF/CNPJ: associe a CADA PARTE o documento que aparece imediatamente proximo a ela
   no texto. Use formato NNN.NNN.NNN-NN para CPF e NN.NNN.NNN/NNNN-NN para CNPJ.

4. tipo_pessoa: PJ se nome contem LTDA/SA/S.A./ME/EIRELI/EPP/Banco/Cooperativa/
   MUNICIPIO/ESTADO/UNIAO/MINISTERIO PUBLICO, ou se documento for CNPJ. PF caso contrario.

5. valor_causa: procure literais como "Valor da causa", "Valor atribuido", "Valor:".
   Inclua o R\\$ e numero exatamente como aparece.

6. classe_processual: priorize o nome da classe (ex.: "Procedimento Comum Civel"),
   nao o numero da classe. MAXIMO 80 caracteres.

6a. LIMITES DE TAMANHO (respeite SEMPRE):
    - classe_processual: max 80 chars (ex.: 'Procedimento Comum Civel')
    - assunto_principal: max 200 chars
    - comarca: max 80 chars (so o nome da comarca, sem mencionar vara)
    - valor_causa: max 50 chars (ex.: 'R$ 39.069,87')
    - nome de cada parte: max 120 chars
    Se um campo seria mais longo, RESUMA. Nao copie texto da decisao
    nem pareceres. Se nao souber resumir, retorne null.

7. SEMPRE responda em JSON valido — sem virgula sobrando, sem comentarios,
   sem markdown, sem ```json ```.

8. Liste APENAS o que estiver EXPLICITO no texto. Nao invente.

PUBLICACAO:
{texto_input}{contexto_extra}
"""

    try:
        from flask import current_app  # noqa: PLC0415

        # Default flash (rapido/barato). Configurando GEMINI_TRIAGEM_MODEL pra
        # 'gemini-2.5-pro' melhora muito a precisao em pubs longas/bagunçadas.
        model = current_app.config.get("GEMINI_TRIAGEM_MODEL", "gemini-2.5-flash")
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
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

    def _norm_str(v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    def _norm_parte(p):
        """Aceita objeto estruturado (novo formato) ou string solta (formato antigo)."""
        if isinstance(p, dict):
            return {
                "nome": _norm_str(p.get("nome")) or "",
                "tipo_pessoa": (
                    (p.get("tipo_pessoa") or "PF").strip().upper() if p.get("tipo_pessoa") else "PF"
                ),
                "cpf_cnpj": _norm_str(p.get("cpf_cnpj")),
                "advogados": [
                    str(a).strip() for a in (p.get("advogados") or []) if str(a or "").strip()
                ],
                "oabs": [str(o).strip() for o in (p.get("oabs") or []) if str(o or "").strip()],
            }
        # fallback: string -> objeto minimo
        nome = _norm_str(p)
        if not nome:
            return None
        return {
            "nome": nome,
            "tipo_pessoa": "PF",
            "cpf_cnpj": None,
            "advogados": [],
            "oabs": [],
        }

    autores_objs = [n for n in (_norm_parte(p) for p in (parsed.get("partes_autoras") or [])) if n]
    reus_objs = [n for n in (_norm_parte(p) for p in (parsed.get("partes_reus") or [])) if n]

    # Remove partes sem nome real
    autores_objs = [a for a in autores_objs if a.get("nome")]
    reus_objs = [r for r in reus_objs if r.get("nome")]

    # Sanitiza: detecta partes "iaglomeradas" (varios nomes colados num so) e separa.
    # Resolve casos onde a IA falhou em separar, ex: autor com "Reu(s): X Y Z Vistos."
    autores_san_a, reus_san_a = _sanitizar_partes_estruturadas(autores_objs, "autor")
    autores_san_b, reus_san_b = _sanitizar_partes_estruturadas(reus_objs, "reu")
    autores_objs = autores_san_a + autores_san_b
    reus_objs = reus_san_a + reus_san_b

    # Dedup por nome normalizado (caso a sanitizacao tenha gerado duplicatas)
    def _dedup_by_nome(lst):
        seen = set()
        out = []
        for p in lst:
            k = normalizar_nome(p.get("nome") or "")
            if k and k not in seen:
                seen.add(k)
                out.append(p)
        return out

    autores_objs = _dedup_by_nome(autores_objs)
    reus_objs = _dedup_by_nome(reus_objs)

    # Listas planas pra retrocompat com codigo antigo (regex/auto-vinculo)
    autores_nomes = [a["nome"] for a in autores_objs]
    reus_nomes = [r["nome"] for r in reus_objs]
    representantes = []
    oabs = []
    docs = []
    for p in autores_objs + reus_objs:
        representantes.extend(p.get("advogados") or [])
        oabs.extend(p.get("oabs") or [])
        if p.get("cpf_cnpj"):
            docs.append(p["cpf_cnpj"])
    representantes = list(dict.fromkeys(representantes))
    oabs = list(dict.fromkeys(oabs))
    docs = list(dict.fromkeys(docs))

    # Aceita tambem o formato antigo se o modelo retornar
    for r in parsed.get("representantes") or []:
        s = _norm_str(r)
        if s and s not in representantes:
            representantes.append(s)
    for o in parsed.get("oabs_encontradas") or []:
        s = _norm_str(o)
        if s and s not in oabs:
            oabs.append(s)
    for d in parsed.get("documentos_extraidos") or []:
        s = _norm_str(d)
        if s and s not in docs:
            docs.append(s)

    numero_processo = _norm_str(parsed.get("numero_processo"))
    tribunal = _norm_str(parsed.get("tribunal"))

    # Scoring
    confidence = 0.0
    if numero_processo:
        confidence += 0.35
    if autores_nomes or reus_nomes:
        confidence += 0.25
    if representantes:
        confidence += 0.15
    if oabs:
        confidence += 0.10
    if tribunal:
        confidence += 0.05
    if docs:
        confidence += 0.10
    confidence = round(min(confidence + 0.10, 1.0), 2)

    return {
        "numero_processo": numero_processo,
        "tribunal": tribunal,
        "classe_processual": _norm_str(parsed.get("classe_processual")),
        "assunto_principal": _norm_str(parsed.get("assunto_principal")),
        "valor_causa": _norm_str(parsed.get("valor_causa")),
        "comarca": _norm_str(parsed.get("comarca")),
        "nome_juiz": _norm_str(parsed.get("nome_juiz")),
        # Listas planas pra retrocompatibilidade
        "partes_autoras": autores_nomes,
        "partes_reus": reus_nomes,
        "representantes": representantes,
        "oabs_encontradas": oabs,
        "documentos_extraidos": docs,
        # Novo: objetos estruturados pra wizard usar (CPF associado, advogado da parte)
        "partes_autoras_estruturadas": autores_objs,
        "partes_reus_estruturadas": reus_objs,
        "confianca": confidence,
        "revisao_manual_recomendada": confidence < 0.6,
        "fonte_analise": "ia_gemini",
    }


# Padroes que indicam fim da lista de partes (entrada da decisao/sentenca).
_FIM_PARTES_RE = re.compile(
    r"\b(?:Vistos|Vistos\s*etc|Decido|Sentenca|"
    r"Trata-se|Cuida-se|RELATORIO|VOTO|EMENTA|DECISAO|DESPACHO)\b",
    re.IGNORECASE,
)

# Marcadores de PJ embutidos no nome
_MARCADORES_PJ = (
    "LTDA",
    "S/A",
    "S.A",
    "EIRELI",
    "EPP",
    " ME",
    " ME.",
    "BANCO ",
    "COOPERATIVA",
    "MUNICIPIO",
    "ESTADO DO",
    "UNIAO",
    "MINISTERIO PUBLICO",
    "PREFEITURA",
    "FAZENDA",
)

# Labels de papel que podem aparecer dentro de uma "parte" iaglomerada.
_LABELS_REU_RE = re.compile(
    r"\b(?:reu(?:\(s\)|s)?|requerid[oa]s?|executad[oa]s?|polo\s*passivo|impetrad[oa]s?)\s*[:\-]\s*",
    re.IGNORECASE,
)
_LABELS_AUTOR_RE = re.compile(
    r"\b(?:autor(?:\(s\)|es|a)?|requerente|exequente|polo\s*ativo|impetrante)\s*[:\-]\s*",
    re.IGNORECASE,
)


def _split_camelcase_concat(s):
    """Insere espaço entre 'Drenaplan' e 'Terraplenagem' quando colados como
    'DrenaplanTerraplenagem' (frequente em OCR ruim)."""
    return re.sub(r"([a-z])([A-Z])", r"\1 \2", s)


def _eh_pj(nome):
    up = nome.upper()
    return any(m in up for m in _MARCADORES_PJ)


def _segmentar_lista_de_nomes(texto):
    """Tenta separar uma string com varios nomes colados em entries individuais.

    Estrategia: cada nome 'cabe' em ~2-7 tokens. Procura por sequencias de tokens
    em capslock/title-case separados por marcadores comuns (LTDA, ME, etc.).
    Retorna lista de strings.
    """
    # Remove tudo a partir de "Vistos" / "Decido" / etc.
    m = _FIM_PARTES_RE.search(texto)
    if m:
        texto = texto[: m.start()].strip()

    if not texto:
        return []

    # Normaliza espaços e splits comuns
    texto = re.sub(r"[ \t]+", " ", texto).strip(" ;:,.-")
    texto = _split_camelcase_concat(texto)

    # Heuristica: parte seguinte comeca depois de:
    # - sufixo PJ (LTDA, ME, EIRELI, S/A, S.A) seguido de espaço e nome em CapsLock
    # - ponto seguido de nome em CapsLock
    # - virgula/ponto-e-virgula
    # Vamos usar split por conectivos + heuristica.

    # Insere separadores explicitos antes de palavras em CAIXA-ALTA seguintes a sufixos PJ
    sufixos = ["LTDA", "ME", "EIRELI", "EPP", "S/A", "S.A"]
    for suf in sufixos:
        # Ex: "Drenaplan Terraplenagem Ltda. ME Siliomar" -> insere "|" antes de "Siliomar"
        texto = re.sub(
            rf"({re.escape(suf)})(\.?)(\s+)([A-Z][a-záéíóúâêôãõç]+)",
            r"\1\2|\3\4",
            texto,
        )

    # Insere separador ANTES de uma sequencia que termina em sufixo PJ (empresa).
    # Heuristica: localiza "Palavra1 [Palavra2] [Palavra3] LTDA/ME/etc" e insere "|"
    # antes de Palavra1 — desde que tenha texto antes (>=2 palavras).
    # Resolve: "Anselmo Luiz Stroparo Drenaplan Terraplenagem Ltda" -> separa em
    # "Anselmo Luiz Stroparo | Drenaplan Terraplenagem Ltda".
    sufixos_alt = "|".join(re.escape(s) for s in sufixos)
    # Captura: ... <espaco> (Palavra1 (Palavra2)? (Palavra3)?) <sufixo>
    # Onde Palavra eh CapsLock ou TitleCase.
    pj_inicio_re = re.compile(
        rf"(\w+\s+\w+\s+)((?:[A-Z][a-záéíóúâêôãõç]+\s+){{1,3}})(?={sufixos_alt}\b)",
        re.IGNORECASE,
    )
    texto = pj_inicio_re.sub(r"\1|\2", texto)

    # Quebra tambem em ; ou , quando seguidos de nome
    texto = re.sub(r"\s*[;,]\s+", "|", texto)

    pedacos = [p.strip(" .,;:-") for p in texto.split("|") if p.strip(" .,;:-")]

    # Filtra: cada pedaco precisa parecer nome (>=2 tokens OU ter marcador PJ OU >=4 chars)
    out = []
    for p in pedacos:
        if len(p) < 4:
            continue
        if _FIM_PARTES_RE.search(p):
            p = _FIM_PARTES_RE.split(p, maxsplit=1)[0].strip(" .,;:-")
            if not p:
                continue
        # Truncar tamanhos absurdos (>120 chars)
        if len(p) > 120:
            p = p[:120].strip()
        out.append(p)
    return _dedupe_preserving_order(out)


def _sanitizar_partes_estruturadas(partes_objs, papel_default):
    """Recebe lista de objetos de parte (autores ou reus) que pode ter vindo
    da IA com nomes 'iaglomerados' (varios nomes colados num so), e retorna
    lista limpa com cada parte separada.

    Tambem detecta se um suposto 'autor' contem 'Reu(s):' embutido e move
    aquele segmento para o papel correto.
    """
    autores = []
    reus = []

    for parte in partes_objs:
        nome = (parte.get("nome") or "").strip()
        if not nome:
            continue

        # Se o nome contem label de Reu/Requerido/etc, splita em duas partes
        m_reu = _LABELS_REU_RE.search(nome)
        m_aut = _LABELS_AUTOR_RE.search(nome)

        antes_reu = nome
        depois_reu = ""
        if m_reu:
            antes_reu = nome[: m_reu.start()].strip(" .,;:-")
            depois_reu = nome[m_reu.end() :].strip(" .,;:-")
        elif m_aut and papel_default == "reu":
            # Caso raro: na lista de reus aparece um "Autor:" embutido
            antes_reu = nome[: m_aut.start()].strip(" .,;:-")
            depois_reu = nome[m_aut.end() :].strip(" .,;:-")

        # Antes do label: pertence ao papel original (papel_default)
        for n in _segmentar_lista_de_nomes(antes_reu):
            obj = {
                "nome": n,
                "tipo_pessoa": "PJ" if _eh_pj(n) else (parte.get("tipo_pessoa") or "PF"),
                "cpf_cnpj": parte.get("cpf_cnpj") if n == antes_reu else None,
                "advogados": parte.get("advogados") if n == antes_reu else [],
                "oabs": parte.get("oabs") if n == antes_reu else [],
            }
            if papel_default == "autor":
                autores.append(obj)
            else:
                reus.append(obj)

        # Depois do label: papel oposto (se o label era REU, vai pra reus; se AUTOR, autores)
        for n in _segmentar_lista_de_nomes(depois_reu):
            obj = {
                "nome": n,
                "tipo_pessoa": "PJ" if _eh_pj(n) else "PF",
                "cpf_cnpj": None,
                "advogados": [],
                "oabs": [],
            }
            if m_reu:
                reus.append(obj)
            elif m_aut:
                autores.append(obj)

    return autores, reus


def _aplicar_sanitizador_em_analise(analise):
    """Garante que partes_*_estruturadas existam e estejam sanitizadas (sem
    nomes 'iaglomerados'). Funciona tanto em retorno de IA quanto regex.
    """
    if not isinstance(analise, dict):
        return analise

    autores_estr = analise.get("partes_autoras_estruturadas")
    reus_estr = analise.get("partes_reus_estruturadas")

    # Se nao tem estruturadas (caso regex), constroi a partir das listas planas.
    def _str_para_obj(nomes, papel_default):
        out = []
        for nome in nomes or []:
            if not nome:
                continue
            tipo = "PJ" if _eh_pj(nome) else "PF"
            out.append(
                {
                    "nome": nome,
                    "tipo_pessoa": tipo,
                    "cpf_cnpj": None,
                    "advogados": [],
                    "oabs": [],
                }
            )
        return out

    if not autores_estr:
        autores_estr = _str_para_obj(analise.get("partes_autoras"), "autor")
    if not reus_estr:
        reus_estr = _str_para_obj(analise.get("partes_reus"), "reu")

    # Aplica sanitizador (separa nomes iaglomerados, remove "Vistos./Decido.").
    autores_a, reus_a = _sanitizar_partes_estruturadas(autores_estr, "autor")
    autores_b, reus_b = _sanitizar_partes_estruturadas(reus_estr, "reu")
    autores_final = autores_a + autores_b
    reus_final = reus_a + reus_b

    # Dedup
    seen_a, autores_dedup = set(), []
    for p in autores_final:
        k = normalizar_nome(p.get("nome") or "")
        if k and k not in seen_a:
            seen_a.add(k)
            autores_dedup.append(p)
    seen_r, reus_dedup = set(), []
    for p in reus_final:
        k = normalizar_nome(p.get("nome") or "")
        if k and k not in seen_r:
            seen_r.add(k)
            reus_dedup.append(p)

    analise["partes_autoras_estruturadas"] = autores_dedup
    analise["partes_reus_estruturadas"] = reus_dedup
    # Atualiza listas planas pra ficarem alinhadas com as estruturadas
    analise["partes_autoras"] = [p["nome"] for p in autores_dedup]
    analise["partes_reus"] = [p["nome"] for p in reus_dedup]
    return analise


def analisar_publicacao_com_fallback_ia(publicacao, limiar=0.5):
    """Combina regex + Gemini: roda regex primeiro (rapido, gratis), e quando
    a confianca fica abaixo de `limiar` aciona o Gemini como segundo passo.

    Retorna sempre um dict com a mesma estrutura de `analisar_publicacao`,
    com chave extra `fonte_analise` ('regex' ou 'ia_gemini').

    Sanitizador eh aplicado SEMPRE no resultado final, garantindo que partes
    iaglomeradas sejam separadas independente da fonte (IA ou regex).
    """
    analise = analisar_publicacao(publicacao)
    analise["fonte_analise"] = "regex"

    if (analise.get("confianca") or 0.0) < limiar:
        analise_ia = analisar_com_ia(publicacao)
        if analise_ia and (analise_ia.get("confianca") or 0.0) > (analise.get("confianca") or 0.0):
            analise = analise_ia

    return _aplicar_sanitizador_em_analise(analise)


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
