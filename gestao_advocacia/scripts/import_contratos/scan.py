"""Varre uma pasta com sub-pastas de clientes e gera CSV de contratos candidatos.

Uso:
    python -m scripts.import_contratos.scan --root "C:/.../ALISSON" --out out/contratos_scan.csv

Heuristicas:
- Aceita .pdf e .docx
- Nome bate em regex /contrato.*honorari|honorari.*contrato|contrato.*advoca/ (case-insensitive)
- Tambem aceita 'contrato' isolado se a pasta nao tiver nada melhor
- Quando ha varias versoes do mesmo contrato (v2, v3, _assinado), prioriza:
    1) sufixo "_assinado"
    2) maior numero de versao "vN"
    3) data de modificacao mais recente
- Output CSV: pasta_cliente,arquivo,prioridade,tipo_provavel,tamanho_kb,modificado
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

EXTS = {".pdf"}  # DOCX nao suportado pelo upload do Gemini; rode novamente com .docx exportado para PDF

# Termos fortes (provavel contrato de honorarios)
RE_FORTE = re.compile(
    r"(contrato.*honor|honor.*contrato|contrato.*advoca|presta.*servi.*advoca)",
    re.IGNORECASE,
)
# Termos fracos (so 'contrato' — usar quando nao houver forte)
RE_FRACO = re.compile(r"\bcontrato\b", re.IGNORECASE)
# Anti-padroes: contratos NAO de honorarios
RE_BLOQUEIO = re.compile(
    r"(contrato[\s_-]*social|contrato[\s_-]*de[\s_-]*trabalho|"
    r"contrato[\s_-]*seguro|contrato[\s_-]*de[\s_-]*emprestimo|"
    r"contrato[\s_-]*de[\s_-]*compra|contrato[\s_-]*de[\s_-]*locacao|"
    r"contrato[\s_-]*patrocinio|contrato[\s_-]*bancari|"
    r"contrato[\s_-]*de[\s_-]*financia|tartuce|escola)",
    re.IGNORECASE,
)


def _classificar(nome: str) -> tuple[int, str]:
    """Retorna (prioridade 0-3, tipo_provavel). 3 = certeza, 0 = ignorar."""
    n = nome.lower()
    if RE_BLOQUEIO.search(n):
        return (0, "outro")
    if RE_FORTE.search(n):
        return (3, "honorarios")
    if RE_FRACO.search(n):
        return (1, "indefinido")
    return (0, "ignorar")


def _versao(nome: str) -> tuple[int, int]:
    """Retorna (assinado_score, versao_num) para ranquear duplicatas."""
    n = nome.lower()
    assinado = 1 if "assinado" in n else 0
    m = re.search(r"v(\d+)", n)
    versao = int(m.group(1)) if m else 0
    return (assinado, versao)


def scan(root: Path) -> list[dict]:
    rows: list[dict] = []
    for cliente_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        candidatos: list[dict] = []
        try:
            todos = list(cliente_dir.rglob("*"))
        except OSError:
            todos = []
        for arquivo in todos:
            try:
                if not arquivo.is_file():
                    continue
            except OSError:
                continue
            if arquivo.suffix.lower() not in EXTS:
                continue
            if arquivo.name.startswith(".~lock"):
                continue
            prio, tipo = _classificar(arquivo.name)
            if prio == 0:
                continue
            try:
                stat = arquivo.stat()
            except OSError:
                continue
            candidatos.append(
                {
                    "pasta_cliente": cliente_dir.name,
                    "arquivo": str(arquivo),
                    "prioridade": prio,
                    "tipo_provavel": tipo,
                    "tamanho_kb": round(stat.st_size / 1024, 1),
                    "modificado": stat.st_mtime,
                    "_versao": _versao(arquivo.name),
                }
            )

        # Dentre todos os candidatos da pasta, escolher 1 ou mais "principais":
        # - todos com prioridade 3 (forte) sao mantidos
        # - se ha duplicatas de mesmo nome-base, prefere assinado/v-mais-alto/recente
        candidatos.sort(
            key=lambda c: (c["prioridade"], c["_versao"], c["modificado"]),
            reverse=True,
        )
        rows.extend(candidatos)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="Pasta raiz com sub-pastas de clientes")
    ap.add_argument("--out", default="out/contratos_scan.csv", help="CSV de saida")
    args = ap.parse_args()

    root = Path(args.root)
    if not root.is_dir():
        raise SystemExit(f"Pasta nao encontrada: {root}")

    rows = scan(root)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as fp:
        w = csv.DictWriter(
            fp,
            fieldnames=[
                "pasta_cliente",
                "arquivo",
                "prioridade",
                "tipo_provavel",
                "tamanho_kb",
                "modificado",
            ],
        )
        w.writeheader()
        for r in rows:
            r.pop("_versao", None)
            w.writerow(r)

    fortes = sum(1 for r in rows if r["prioridade"] == 3)
    pastas = len({r["pasta_cliente"] for r in rows})
    print(f"OK. {len(rows)} arquivos em {pastas} pastas. Fortes (honorarios): {fortes}")
    print(f"CSV: {out_path.resolve()}")


if __name__ == "__main__":
    main()
