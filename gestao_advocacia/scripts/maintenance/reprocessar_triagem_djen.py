"""
Script de manutenção: reprocessar triagem DJEN.

Itera sobre PublicacaoDJEN de um tenant e reaplica `analisar_publicacao`,
atualizando os campos derivados (numero_processo, polo_ativo, polo_passivo,
sigla_tribunal) e recalculando a confiança sem marcar como lida nem criar
clientes/casos.

Reforços (enriquecimento-cnj):
  - Valida o DV do `numero_processo` extraído do texto antes de aceitar.
    Matches com formato CNJ válido mas DV incorreto são rejeitados como
    falso-positivo (contador `rejeitados_dv_invalido`).
  - Flag opcional `--auto-vincular-caso` tenta vincular a publicação a um
    Caso existente (mesmo tenant) com o mesmo `numero_processo`.

Uso:
    # dry-run (padrão) — apenas exibe estatísticas
    python -m scripts.maintenance.reprocessar_triagem_djen --tenant-id 1

    # aplica as atualizações
    python -m scripts.maintenance.reprocessar_triagem_djen --tenant-id 1 --apply

    # aplica + tenta auto-vincular a Caso quando o número bate
    python -m scripts.maintenance.reprocessar_triagem_djen \\
        --tenant-id 1 --apply --auto-vincular-caso
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


def _reprocessar(app, tenant_id: int, apply: bool, auto_vincular_caso: bool) -> None:
    from app import PublicacaoDJEN, db  # noqa: PLC0415
    from djen_triagem import analisar_publicacao  # noqa: PLC0415
    from models import Caso  # noqa: PLC0415
    from utils.cnj import validar_dv_cnj  # noqa: PLC0415  # enriquecimento-cnj: backfill

    with app.app_context():
        query = PublicacaoDJEN.query.filter_by(tenant_id=tenant_id)
        total = query.count()
        if total == 0:
            print(f"Nenhuma publicação encontrada para tenant_id={tenant_id}.")
            return

        print(f"Tenant {tenant_id}: {total} publicação(ões) encontrada(s).")
        print(f"Modo: {'APPLY' if apply else 'DRY-RUN'}")
        if auto_vincular_caso:
            print("Auto-vinculação a Caso: HABILITADA")
        print()

        com_cnj = 0
        soma_confianca_antes = 0.0
        soma_confianca_depois = 0.0
        atualizadas = 0
        rejeitados_dv_invalido = 0  # enriquecimento-cnj: contador
        vinculados_a_caso = 0  # enriquecimento-cnj: contador
        erros = 0

        for pub in query.yield_per(100):
            try:
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

                # enriquecimento-cnj: backfill — valida DV antes de aceitar.
                # Se o numero extraido do texto tiver DV invalido, descarta.
                novo_num_extraido = analise["numero_processo"]
                if novo_num_extraido and not validar_dv_cnj(novo_num_extraido):
                    rejeitados_dv_invalido += 1
                    novo_num_extraido = None

                # Determina se há mudança relevante
                novo_num = novo_num_extraido or pub.numero_processo
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
                        if novo_num and novo_num != pub.numero_processo:
                            pub.numero_processo = novo_num
                        if novo_tribunal and novo_tribunal != pub.sigla_tribunal:
                            pub.sigla_tribunal = novo_tribunal
                        if polo_ativo_novo and polo_ativo_novo != pub.polo_ativo:
                            pub.polo_ativo = polo_ativo_novo
                        if polo_passivo_novo and polo_passivo_novo != pub.polo_passivo:
                            pub.polo_passivo = polo_passivo_novo

                # enriquecimento-cnj: backfill — auto-vinculacao a Caso (mesmo tenant).
                if auto_vincular_caso and apply and pub.caso_id is None and pub.numero_processo:
                    caso = Caso.query.filter_by(
                        tenant_id=tenant_id,
                        numero_processo=pub.numero_processo,
                    ).first()
                    if caso:
                        pub.caso_id = caso.id
                        vinculados_a_caso += 1
                        # NÃO mexer em status_origem se já tiver valor — só setar se for None
                        if pub.status_origem is None:
                            pub.status_origem = "criado_automaticamente"
            except Exception as e:  # pragma: no cover (defesa em profundidade)
                erros += 1
                print(f"  [ERRO] pub_id={pub.id}: {e}")
                continue

        if apply:
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"\n[ERRO] Falha ao commitar: {e}")
                sys.exit(1)
            print(f"  {atualizadas} publicação(ões) atualizada(s) no banco.\n")

        # Resumo
        print("=" * 60)
        print(f"  Total publicações          : {total}")
        print(f"  Com CNJ extraído (depois)  : {com_cnj}")
        print(f"  Rejeitados por DV inválido : {rejeitados_dv_invalido}")
        print(f"  Confiança média antes      : {soma_confianca_antes / total:.2f}")
        print(f"  Confiança média depois     : {soma_confianca_depois / total:.2f}")
        if auto_vincular_caso:
            print(f"  Vinculados a Caso          : {vinculados_a_caso}")
        if erros:
            print(f"  Erros (continuou)          : {erros}")
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
    # enriquecimento-cnj: backfill — flag opcional de auto-vinculacao
    parser.add_argument(
        "--auto-vincular-caso",
        dest="auto_vincular_caso",
        action="store_true",
        default=False,
        help="Quando combinado com --apply, vincula a publicação a um Caso do mesmo tenant que tenha o mesmo numero_processo.",
    )
    args = parser.parse_args()

    app = _build_app()
    _reprocessar(
        app,
        tenant_id=args.tenant_id,
        apply=args.apply,
        auto_vincular_caso=args.auto_vincular_caso,
    )


if __name__ == "__main__":
    main()
