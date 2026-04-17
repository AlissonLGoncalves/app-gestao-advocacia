import re
import unicodedata


CNJ_REGEX = re.compile(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b")
OAB_REGEX = re.compile(r"\b(?:OAB\/?[A-Z]{2}\s*)?\d{4,10}\b", re.IGNORECASE)


def _normalize_text(value):
    if not value:
        return ""
    value = str(value)
    value = unicodedata.normalize('NFKD', value)
    value = ''.join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"\s+", " ", value)
    return value.strip().lower()


def _dedupe_preserving_order(values):
    seen = set()
    out = []
    for value in values:
        v = (value or '').strip()
        if not v:
            continue
        key = _normalize_text(v)
        if key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out


def _extract_labeled_entities(text, labels):
    found = []
    for label in labels:
        regex = re.compile(rf"(?:^|[;\n\r])\s*{label}\s*[:\-]\s*([^;\n\r]+)", re.IGNORECASE)
        for match in regex.finditer(text):
            candidate = match.group(1).strip()
            candidate = re.sub(r"\s+", " ", candidate)
            if len(candidate) >= 3:
                found.append(candidate)
    return _dedupe_preserving_order(found)


def analisar_publicacao(publicacao):
    texto = (getattr(publicacao, 'texto', None) or '').strip()
    raw = getattr(publicacao, 'raw_json', None) or {}

    raw_text_chunks = []
    if isinstance(raw, dict):
        for key in ('texto', 'conteudo', 'comunicacao', 'resumo'):
            value = raw.get(key)
            if value:
                raw_text_chunks.append(str(value))

    texto_total = ' '.join([texto] + raw_text_chunks).strip()

    numero_processo = getattr(publicacao, 'numero_processo', None)
    if not numero_processo:
        match = CNJ_REGEX.search(texto_total)
        numero_processo = match.group(0) if match else None

    autores = _extract_labeled_entities(texto_total, [
        r"autor(?:a)?", r"requerente", r"exequente", r"polo\s*ativo", r"impetrante"
    ])
    reus = _extract_labeled_entities(texto_total, [
        r"reu", r"requerido", r"executado", r"polo\s*passivo", r"impetrado"
    ])
    representantes = _extract_labeled_entities(texto_total, [
        r"advogado(?:\(a\))?", r"procurador(?:\(a\))?", r"representante(?:\s*legal)?"
    ])

    # fallback mínimo usando nomeParte da API quando disponível
    nome_parte = ''
    if isinstance(raw, dict):
        nome_parte = (raw.get('nomeParte') or '').strip()
    if nome_parte and not autores and not reus:
        autores = [nome_parte]

    oabs = OAB_REGEX.findall(texto_total)
    oabs = _dedupe_preserving_order(oabs)

    confidence = 0.0
    if numero_processo:
        confidence += 0.4
    if autores or reus:
        confidence += 0.3
    if representantes:
        confidence += 0.2
    if oabs:
        confidence += 0.1
    confidence = round(min(confidence, 1.0), 2)

    return {
        'numero_processo': numero_processo,
        'partes_autoras': autores,
        'partes_reus': reus,
        'representantes': representantes,
        'oabs_encontradas': oabs,
        'confianca': confidence,
    }


def sugerir_vinculos(db, Cliente, Caso, tenant_id, analise):
    numero_processo = (analise.get('numero_processo') or '').strip()
    nomes = _dedupe_preserving_order(
        (analise.get('partes_autoras') or []) + (analise.get('partes_reus') or [])
    )

    sugestoes_casos = []
    sugestoes_clientes = []

    if numero_processo:
        exato = Caso.query.filter_by(tenant_id=tenant_id, numero_processo=numero_processo).all()
        for caso in exato:
            sugestoes_casos.append({
                'id': caso.id,
                'titulo': caso.titulo,
                'numero_processo': caso.numero_processo,
                'score': 0.99,
                'motivo': 'Numero de processo exato',
            })

    if not sugestoes_casos and numero_processo:
        somente_digitos = re.sub(r"\D", "", numero_processo)
        if somente_digitos:
            approx = Caso.query.filter(
                Caso.tenant_id == tenant_id,
                Caso.numero_processo.isnot(None),
                Caso.numero_processo != '',
            ).limit(100).all()
            for caso in approx:
                num_caso = re.sub(r"\D", "", caso.numero_processo or '')
                if num_caso and (somente_digitos in num_caso or num_caso in somente_digitos):
                    sugestoes_casos.append({
                        'id': caso.id,
                        'titulo': caso.titulo,
                        'numero_processo': caso.numero_processo,
                        'score': 0.78,
                        'motivo': 'Numero de processo aproximado',
                    })

    for nome in nomes[:5]:
        if len(nome) < 4:
            continue
        candidatos = Cliente.query.filter(
            Cliente.tenant_id == tenant_id,
            Cliente.nome_razao_social.ilike(f"%{nome}%"),
        ).limit(5).all()
        for cliente in candidatos:
            score = 0.7
            if _normalize_text(cliente.nome_razao_social) == _normalize_text(nome):
                score = 0.92
            sugestoes_clientes.append({
                'id': cliente.id,
                'nome_razao_social': cliente.nome_razao_social,
                'cpf_cnpj': cliente.cpf_cnpj,
                'score': score,
                'motivo': f"Nome semelhante a '{nome}'",
            })

    # remove duplicados mantendo maior score
    casos_by_id = {}
    for item in sugestoes_casos:
        prev = casos_by_id.get(item['id'])
        if (not prev) or (item['score'] > prev['score']):
            casos_by_id[item['id']] = item

    clientes_by_id = {}
    for item in sugestoes_clientes:
        prev = clientes_by_id.get(item['id'])
        if (not prev) or (item['score'] > prev['score']):
            clientes_by_id[item['id']] = item

    casos_out = sorted(casos_by_id.values(), key=lambda x: x['score'], reverse=True)[:5]
    clientes_out = sorted(clientes_by_id.values(), key=lambda x: x['score'], reverse=True)[:5]

    return {
        'casos': casos_out,
        'clientes': clientes_out,
    }
