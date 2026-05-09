"""Contrato base dos adapters de tribunal (Epic #12 / #186)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class BuscaProcessoResultado:
    """Resultado padronizado de uma busca de processo, qualquer que seja o adapter.

    O endpoint converte isso direto em JSON pra UI, e a UI decide se cria
    Caso, vincula a cliente existente, etc.
    """

    sucesso: bool
    cnj_normalizado: str | None = None
    titulo_sugerido: str | None = None
    classe_acao: str | None = None
    vara_juizo: str | None = None
    instancia: str | None = None
    data_distribuicao: str | None = None
    valor_causa: str | None = None
    polo_ativo: list[dict[str, Any]] = field(default_factory=list)
    polo_passivo: list[dict[str, Any]] = field(default_factory=list)
    movimentacoes: list[dict[str, Any]] = field(default_factory=list)
    raw: dict[str, Any] | None = None
    fonte: str | None = None  # nome do adapter que serviu
    erro: str | None = None
    erro_codigo: str | None = None  # ex 'tribunal_indisponivel', 'nao_encontrado'

    def to_dict(self) -> dict[str, Any]:
        return {
            "sucesso": self.sucesso,
            "cnj_normalizado": self.cnj_normalizado,
            "titulo_sugerido": self.titulo_sugerido,
            "classe_acao": self.classe_acao,
            "vara_juizo": self.vara_juizo,
            "instancia": self.instancia,
            "data_distribuicao": self.data_distribuicao,
            "valor_causa": self.valor_causa,
            "polo_ativo": self.polo_ativo,
            "polo_passivo": self.polo_passivo,
            "movimentacoes": self.movimentacoes,
            "fonte": self.fonte,
            "erro": self.erro,
            "erro_codigo": self.erro_codigo,
        }


class BaseTribunalAdapter:
    """Interface que todos os adapters devem implementar.

    Subclasses devem definir `nome` e implementar `buscar(cnj)`.
    """

    nome: str = "base"

    def buscar(self, cnj: str) -> BuscaProcessoResultado:
        raise NotImplementedError("Subclasse deve implementar buscar(cnj)")
