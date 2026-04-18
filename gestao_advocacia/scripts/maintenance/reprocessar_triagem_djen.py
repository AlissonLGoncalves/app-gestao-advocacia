"""
Script de manutenção: reprocessar triagem DJEN.

Itera sobre PublicacaoDJEN de um tenant e reaplica `analisar_publicacao`,
atualizando os campos derivados (numero_processo, polo_ativo, polo_passivo,
sigla_tribunal) e recalculando a confiança sem marcar como lida nem criar
clientes/casos.

Uso:
    # dry-run (padrão) — apenas exibe estatísticas
    python -m gestao_advocacia.scripts.maintenance.reprocessar_triagem_djen \\
        --tenant-id 1

    # aplica as atualizações
    python -m gestao_advocacia.scripts.maintenance.reprocessar_triagem_djen \\
        --tenant-id 1 --apply
"""

from __future__ import annotations

import argparse
import os
import sys

# Garante que o diretório gestao_advocacia está no path
_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, os.path.abspath(_BASE_DIR))


def _build_app():
    from app import create_app  # noqa: PLC0415

    return create_app()


def _reprocessar(app, tenant_id: int, apply: bool) -> None:
    from app import PublicacaoDJEN, db  # noqa: PLC0415
    from djen_triagem import analisar_publicacao  # noqa: PLC0415

    with app.app_context():
        query = PublicacaoDJEN.query.filter_by(tenant_id=tenant_id)
        total = query.count()
        if total == 0:
            print(f"Nenhuma publicação encontrada para tenant_id={tenant_id}.")
            return

        print(f"Tenant {tenant_id}: {total} publicação(ões) encontrada(s).")
        print(f"Modo: {'APPLY' if apply else 'DRY-RUN'}\n")

        com_cnj = 0
        soma_confianca_antes = 0.0
        soma_confianca_depois = 0.0
        atualizadas = 0

        for pub in query.yield_per(100):
            # Confiança "antes" — estimativa a partir dos campos já presentes
            conf_antes = 0.0
            if pub.numero_processo:
                conf_antes += 0.35
            if pub.polo_ativo or pub.polo_passivo:
                conf_antes += 0.25
            if pub.sigla_tribunal:
                conf_antes += 0.05
            soma_confianca_antes += conf_antes

            analise = analisar_publicacao(pub)

            soma_confianca_depois += analise["confianca"]
            if analise["numero_processo"]:
                com_cnj += 1

            # Determina se há mudança relevante
            novo_num = analise["numero_processo"] or pub.numero_processo
            novo_tribunal = analise["tribunal"] or pub.sigla_tribunal
            polo_ativo_novo = " | ".join(analise["partes_autoras"]) or pub.polo_ativo
            polo_passivo_novo = " | ".join(analise["partes_reus"]) or pub.polo_passivo

            mudou = (
                novo_num != pub.numero_processo
                or novo_tribunal != pub.sigla_tribunal
                or polo_ativo_novo != pub.polo_ativo
                or polo_passivo_novo != pub.polo_passivo
            )

            if mudou:
                atualizadas += 1
                if apply:
                    if novo_num:
                        pub.numero_processo = novo_num
                    if novo_tribunal:
                        pub.sigla_tribunal = novo_tribunal
                    if polo_ativo_novo:
                        pub.polo_ativo = polo_ativo_novo
                    if polo_passivo_novo:
                        pub.polo_passivo = polo_passivo_novo

        if apply:
            db.session.commit()
            print(f"  {atualizadas} publicação(ões) atualizada(s) no banco.\n")

        # Resumo
        print("=" * 60)
        print(f"  Total publicações          : {total}")
        print(f"  Com CNJ extraído (depois)  : {com_cnj}")
        print(f"  Confiança média antes      : {soma_confianca_antes / total:.2f}")
        print(f"  Confiança média depois     : {soma_confianca_depois / total:.2f}")
        if not apply:
            print(f"  Registros que seriam atualizados: {atualizadas}")
            print("\n  (rode com --apply para persistir as alterações)")
        print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description="Reprocessa triagem DJEN para um tenant.")
    parser.add_argument(
        "--tenant-id",
        type=int,
        required=True,
        help="ID do tenant a ser reprocessado.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        dest="apply",
        action="store_false",
        default=False,
        help="Apenas exibe estatísticas sem salvar (padrão).",
    )
    mode.add_argument(
        "--apply",
        dest="apply",
        action="store_true",
        help="Aplica as atualizações no banco de dados.",
    )
    args = parser.parse_args()

    app = _build_app()
    _reprocessar(app, tenant_id=args.tenant_id, apply=args.apply)


if __name__ == "__main__":
    main()
