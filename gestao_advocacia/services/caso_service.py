"""Regras de negócio do Caso, fora das rotas (#300, parte 4).

Extraído de routes/casos.py (1.946 linhas): estes helpers eram closures
dentro de register_casos_routes e são usados pelo CRUD e pelos fluxos de
busca/importação CNJ.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from sqlalchemy import func

from helpers import query_for_tenant
from models import PublicacaoDJEN

logger = logging.getLogger(__name__)


def normalizar_data_yyyy_mm_dd(valor):
    """Aceita date/datetime/str em formatos comuns e devolve 'YYYY-MM-DD' ou ''."""
    if not valor:
        return ""
    texto = str(valor).strip()
    if len(texto) >= 10 and texto[4:5] == "-" and texto[7:8] == "-":
        return texto[:10]
    digitos = "".join(ch for ch in texto if ch.isdigit())
    if len(digitos) >= 8:
        return f"{digitos[0:4]}-{digitos[4:6]}-{digitos[6:8]}"
    return ""


def vincular_pendentes_djen_ao_caso(caso):
    """Vincula a `caso` as publicações DJEN PENDENTES (sem caso, não
    ignoradas) cujo número de processo bate com o do caso — na hora.

    Fecha o ciclo do auto-vínculo (#284): antes, ao cadastrar um caso, as
    intimações daquele processo já capturadas ficavam na fila de triagem
    até o cron rodar. Match NORMALIZADO (remove ./-), só pra CNJ completo
    (>= 20 dígitos). Retorna a quantidade vinculada.
    """
    if not caso.numero_processo:
        return 0
    cnj_dig = re.sub(r"\D", "", caso.numero_processo)
    if len(cnj_dig) < 20:
        return 0
    try:
        pendentes = (
            query_for_tenant(PublicacaoDJEN)
            .filter(
                PublicacaoDJEN.caso_id.is_(None),
                PublicacaoDJEN.triagem_ignorada.is_(False),
                PublicacaoDJEN.numero_processo.isnot(None),
                func.replace(func.replace(PublicacaoDJEN.numero_processo, ".", ""), "-", "")
                == cnj_dig,
            )
            .all()
        )
        for pub in pendentes:
            pub.caso_id = caso.id
            if hasattr(pub, "status_origem"):
                pub.status_origem = "criado_automaticamente"
        return len(pendentes)
    except Exception as exc:
        logger.warning("Falha ao vincular pendentes DJEN ao caso %s: %s", caso.id, exc)
        return 0


def preencher_caso_from_data(caso, data):
    """Preenche os campos editáveis do caso a partir do payload da API."""
    caso.titulo = data.get("titulo", caso.titulo)
    caso.status = data.get("status", caso.status)
    caso.tipo_acao = data.get("tipo_acao", caso.tipo_acao)
    caso.area_direito = data.get("area_direito", caso.area_direito)
    caso.fase_processual = data.get("fase_processual", caso.fase_processual)
    caso.vara_juizo = data.get("vara_juizo", caso.vara_juizo)
    caso.comarca = data.get("comarca", caso.comarca)
    caso.instancia = data.get("instancia", caso.instancia)
    caso.parte_contraria = data.get("parte_contraria", caso.parte_contraria)
    caso.adv_parte_contraria = data.get("adv_parte_contraria", caso.adv_parte_contraria)
    vc = data.get("valor_causa")
    if vc is not None:
        try:
            caso.valor_causa = float(vc) if vc != "" else None
        except (ValueError, TypeError):
            pass
    dd = data.get("data_distribuicao")
    if dd:
        try:
            caso.data_distribuicao = datetime.strptime(dd, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass
    elif dd == "" or dd is None:
        caso.data_distribuicao = None
    caso.notas_caso = data.get("notas_caso", caso.notas_caso)
    # Prioridade: aceita Urgente/Alta/Normal/Baixa. Valor desconhecido = mantém.
    if "prioridade" in data:
        pr = data.get("prioridade")
        if pr in ("Urgente", "Alta", "Normal", "Baixa"):
            caso.prioridade = pr
    return caso
