"""Adapter DataJud — usa a API publica do CNJ (Epic #12 / #186).

Reutiliza `cnj_service.consultar_processo_cnj` (ja testado em producao desde
o lancamento do Patronus). Apenas converte a resposta para o formato
padronizado `BuscaProcessoResultado`.
"""

from __future__ import annotations

from typing import Any

from .base import BaseTribunalAdapter, BuscaProcessoResultado


def _normalizar_data(valor: str | None) -> str | None:
    if not valor:
        return None
    texto = str(valor).strip()
    if len(texto) >= 10:
        return texto[:10]
    return None


def _instancia_legivel(grau: str) -> str:
    if grau == "G1":
        return "1ª Instância"
    if grau == "G2":
        return "2ª Instância"
    return grau or ""


def _extrair_partes(polos_raw: list[Any]) -> tuple[list[dict], list[dict]]:
    polo_ativo: list[dict] = []
    polo_passivo: list[dict] = []
    if not isinstance(polos_raw, list):
        return polo_ativo, polo_passivo
    for polo in polos_raw:
        if not isinstance(polo, dict):
            continue
        codigo = str(polo.get("polo", "") or polo.get("tipo", "") or "").upper()
        partes = polo.get("partes") or []
        if not isinstance(partes, list):
            continue
        partes_normalizadas = [
            {
                "nome": p.get("nome"),
                "tipo": p.get("tipo"),
                "advogados": p.get("advogados") or [],
            }
            for p in partes
            if isinstance(p, dict)
        ]
        if codigo in ("AT", "ATIVO", "AUTOR", "REQUERENTE"):
            polo_ativo.extend(partes_normalizadas)
        elif codigo in ("PA", "PASSIVO", "REU", "RÉU", "REQUERIDO"):
            polo_passivo.extend(partes_normalizadas)
    return polo_ativo, polo_passivo


def _movimentacoes_resumo(movimentos_raw: list[Any], limite: int = 20) -> list[dict]:
    if not isinstance(movimentos_raw, list):
        return []
    ordenados = sorted(
        (m for m in movimentos_raw if isinstance(m, dict)),
        key=lambda m: m.get("dataHora", ""),
        reverse=True,
    )
    return [
        {
            "data_hora": m.get("dataHora"),
            "descricao": m.get("nome") or (m.get("movimentoNacional") or {}).get("descricao"),
        }
        for m in ordenados[:limite]
    ]


class DataJudAdapter(BaseTribunalAdapter):
    nome = "datajud"

    def buscar(self, cnj: str) -> BuscaProcessoResultado:
        # Import tardio: cnj_service depende de current_app/Flask config
        from cnj_service import consultar_processo_cnj  # noqa: PLC0415

        try:
            dados, status = consultar_processo_cnj(cnj)
        except Exception as exc:
            return BuscaProcessoResultado(
                sucesso=False,
                fonte=self.nome,
                erro=str(exc),
                erro_codigo="adapter_exception",
            )

        if status >= 400:
            mensagem = "Falha na comunicacao com o tribunal."
            if isinstance(dados, dict):
                mensagem = dados.get("erro") or dados.get("message") or mensagem
            codigo = "tribunal_indisponivel" if status >= 500 else "tribunal_erro_cliente"
            if status == 404:
                codigo = "nao_encontrado"
            return BuscaProcessoResultado(
                sucesso=False,
                fonte=self.nome,
                erro=mensagem,
                erro_codigo=codigo,
            )

        hits = (dados or {}).get("hits", {}).get("hits", [])
        if not hits:
            return BuscaProcessoResultado(
                sucesso=False,
                fonte=self.nome,
                erro="Nenhum processo encontrado no DataJud com este numero.",
                erro_codigo="nao_encontrado",
            )

        processo = hits[0].get("_source", {})
        polo_ativo, polo_passivo = _extrair_partes(processo.get("polos", []))
        autor_principal = polo_ativo[0]["nome"] if polo_ativo else None
        reu_principal = polo_passivo[0]["nome"] if polo_passivo else None
        titulo = (
            f"{autor_principal} x {reu_principal}"
            if autor_principal and reu_principal
            else autor_principal or reu_principal or processo.get("classe", {}).get("nome")
        )

        return BuscaProcessoResultado(
            sucesso=True,
            cnj_normalizado=cnj,
            titulo_sugerido=titulo,
            classe_acao=(processo.get("classe") or {}).get("nome"),
            vara_juizo=(processo.get("orgaoJulgador") or {}).get("nomeOrgao"),
            instancia=_instancia_legivel(processo.get("grau", "")),
            data_distribuicao=_normalizar_data(processo.get("dataAjuizamento")),
            valor_causa=(
                str(processo.get("valorAcao")) if processo.get("valorAcao") is not None else None
            ),
            polo_ativo=polo_ativo,
            polo_passivo=polo_passivo,
            movimentacoes=_movimentacoes_resumo(processo.get("movimentos", [])),
            raw=processo,
            fonte=self.nome,
        )
