"""Vincula contratos importados aos casos do mesmo cliente.

Para cada ContratoHonorario com caso_id=NULL, busca casos do cliente_id no
mesmo tenant. Regras:
  - 1 caso encontrado: vincula automaticamente
  - 2+ casos: tenta matchear por palavra-chave do "objeto" do contrato com
    titulo/numero do caso. Se nao bater nenhum, lista pra revisao manual.
  - 0 casos: lista para usuario criar caso depois.

Uso:
    # Dry-run
    python -m scripts.import_contratos.vincular_casos --user-id 1

    # Aplicar
    python -m scripts.import_contratos.vincular_casos --user-id 1 --apply

    # Vincular forcadamente um contrato a um caso especifico
    python -m scripts.import_contratos.vincular_casos --contrato-id 5 --caso-id 12 --apply
"""

from __future__ import annotations

import argparse
import os
import re
import sys

_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, os.path.abspath(_BASE_DIR))


def _build_app():
    from app import create_app  # noqa: PLC0415

    return create_app()


_STOP = {
    "de",
    "do",
    "da",
    "dos",
    "das",
    "e",
    "a",
    "o",
    "os",
    "as",
    "um",
    "uma",
    "para",
    "por",
    "no",
    "na",
    "nos",
    "nas",
    "em",
    "com",
    "sem",
    "ao",
    "aos",
    "sobre",
    "que",
    "se",
    "ou",
    "como",
}


def _tokens(s: str) -> set[str]:
    if not s:
        return set()
    s = re.sub(r"[^\w\s]", " ", s.lower())
    return {w for w in s.split() if len(w) >= 4 and w not in _STOP}


def _score_match(contrato_objeto: str, caso) -> int:
    """Conta palavras em comum entre objeto do contrato e titulo/area do caso."""
    a = _tokens(contrato_objeto or "")
    b = _tokens(getattr(caso, "titulo", "") or "")
    b |= _tokens(getattr(caso, "area_atuacao", "") or "")
    b |= _tokens(getattr(caso, "tipo_acao", "") or "")
    b |= _tokens(getattr(caso, "descricao_curta", "") or "")
    return len(a & b)


def _vincular_um(db, ContratoHonorario, contrato_id: int, caso_id: int):
    contrato = db.session.get(ContratoHonorario, contrato_id)
    if not contrato:
        raise SystemExit(f"Contrato {contrato_id} nao encontrado")
    contrato.caso_id = caso_id
    db.session.commit()
    print(f"OK: contrato {contrato_id} vinculado ao caso {caso_id}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-id", type=int, help="ID do usuario (filtra por tenant)")
    ap.add_argument("--apply", action="store_true", help="Aplica vinculo (senao e dry-run)")
    ap.add_argument("--contrato-id", type=int, help="Vincula apenas este contrato")
    ap.add_argument("--caso-id", type=int, help="Vincula a este caso (usar com --contrato-id)")
    args = ap.parse_args()

    app = _build_app()
    with app.app_context():
        from extensions import db  # noqa: PLC0415
        from models import Caso, Cliente, ContratoHonorario, User  # noqa: PLC0415

        if args.contrato_id and args.caso_id:
            if not args.apply:
                print(f"DRY-RUN: vincularia contrato {args.contrato_id} -> caso {args.caso_id}")
                return
            _vincular_um(db, ContratoHonorario, args.contrato_id, args.caso_id)
            return

        if not args.user_id:
            raise SystemExit("--user-id obrigatorio (ou use --contrato-id + --caso-id)")

        user = User.query.get(args.user_id)
        if not user:
            raise SystemExit(f"User {args.user_id} nao encontrado")
        tenant_id = user.tenant_id

        contratos_sem = ContratoHonorario.query.filter(
            ContratoHonorario.caso_id.is_(None),
            ContratoHonorario.tenant_id == tenant_id,
        ).all()
        print(
            f"Contratos sem caso: {len(contratos_sem)} (modo {'APPLY' if args.apply else 'DRY-RUN'})"
        )
        print()

        stats = {"auto": 0, "match_score": 0, "ambiguo": 0, "sem_caso": 0}

        for c in contratos_sem:
            cliente = db.session.get(Cliente, c.cliente_id)
            cliente_nome = cliente.nome_razao_social if cliente else f"#{c.cliente_id}"
            casos = (
                Caso.query.filter_by(cliente_id=c.cliente_id, tenant_id=tenant_id).all()
                if tenant_id is not None
                else Caso.query.filter_by(cliente_id=c.cliente_id).all()
            )

            if not casos:
                print(
                    f"[contrato {c.id}] {cliente_nome}: 0 casos do cliente -- crie um caso depois"
                )
                stats["sem_caso"] += 1
                continue

            if len(casos) == 1:
                caso = casos[0]
                print(f"[contrato {c.id}] {cliente_nome}: 1 caso (id={caso.id}) -- AUTO-VINCULA")
                if args.apply:
                    c.caso_id = caso.id
                    db.session.commit()
                stats["auto"] += 1
                continue

            # 2+ casos: pontuar por overlap de tokens
            scored = sorted(
                ((_score_match(c.objeto, k), k) for k in casos),
                key=lambda x: x[0],
                reverse=True,
            )
            top_score, top_caso = scored[0]
            if top_score >= 2 and (len(scored) == 1 or top_score > scored[1][0]):
                print(
                    f"[contrato {c.id}] {cliente_nome}: {len(casos)} casos, "
                    f"melhor match caso {top_caso.id} score={top_score} -- VINCULA"
                )
                if args.apply:
                    c.caso_id = top_caso.id
                    db.session.commit()
                stats["match_score"] += 1
            else:
                print(
                    f"[contrato {c.id}] {cliente_nome}: {len(casos)} casos AMBIGUOS, "
                    f"objeto='{(c.objeto or '')[:60]}'"
                )
                for s, k in scored[:3]:
                    titulo = getattr(k, "titulo", "") or getattr(k, "tipo_acao", "") or ""
                    print(f"   - caso {k.id} (score {s}): {titulo[:60]}")
                stats["ambiguo"] += 1

        print()
        print(f"FIM. {stats}")
        if stats["ambiguo"]:
            print()
            print("Para vincular ambiguos manualmente:")
            print(
                "  python -m scripts.import_contratos.vincular_casos --contrato-id N --caso-id M --apply"
            )


if __name__ == "__main__":
    main()
