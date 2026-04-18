import re
import unicodedata

CNJ_REGEX = re.compile(r"(?<!\d)\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}(?!\d)")
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


def _extract_labeled_entities(text, labels):
    found = []
    for label in labels:
        # (?<!\w) — não casa dentro de palavras (ex.: "coautor" não dispara "autor")
        regex = re.compile(
            rf"(?<!\w){label}\s*[:\-]\s*([^;\n\r]+)",
            re.IGNORECASE,
        )
        for match in regex.finditer(text):
            candidate = match.group(1).strip()
            # Remove padrão de próximo campo colado no final (ex.: "DIRCE... Reu(s):")
            candidate = re.sub(r"\s+\w+(?:\([^)]*\))?\s*[:\-]\s*$", "", candidate).strip()
            # Remove itens numerados no corpo do texto (ex.: " 1. Nao obstante...")
            candidate = re.sub(r"\s+\d+\.\s+\S.*$", "", candidate, flags=re.DOTALL).strip()
            candidate = re.sub(r"\s+", " ", candidate)
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
