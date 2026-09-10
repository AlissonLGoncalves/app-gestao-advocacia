"""Reprocessa publicacoes DJEN ja capturadas a partir do raw_json.

Contexto (10/09/2026): ate esta data o mapeamento dos campos da ComunicaAPI
estava errado — o codigo procurava "numeroProcesso"/"numeroprocesso" e uma
lista "partes", enquanto a API devolve "numero_processo",
"numeroprocessocommascara" e "destinatarios" (com polo "A"/"P"). Resultado:
toda publicacao entrava sem numero de processo e sem partes, o que impedia o
auto-vinculo ao caso e deixava a caixa de intimacoes inutilizavel.

O payload original fica salvo em PublicacaoDJEN.raw_json, entao da' para
consertar o historico sem consultar a API de novo.

Uso (Cloud Run Job ou local):

    python -m scripts.maintenance.backfill_djen_campos            # aplica
    python -m scripts.maintenance.backfill_djen_campos --dry-run  # so' relata

Roda como app_admin (cross-tenant) — a correcao vale para todos os
escritorios.
"""

import argparse
import logging
import os
import sys

os.environ["USE_DATABASE_URL_ADMIN"] = "true"
os.environ.setdefault("DJEN_JOB_ENABLED", "False")
os.environ.setdefault("CNJ_JOB_ENABLED", "False")

logger = logging.getLogger("backfill_djen")


def _reprocessar(pub, extrair_polos):
    """Aplica o mapeamento correto numa publicacao. Retorna lista de campos mudados."""
    item = pub.raw_json
    if not isinstance(item, dict):
        return []

    from djen_tasks import _item_get  # noqa: PLC0415

    mudou = []

    if not pub.numero_processo:
        numero = _item_get(item, "numero_processo", "numeroProcesso", "numeroprocesso")
        if numero:
            pub.numero_processo = str(numero)[:100]
            mudou.append("numero_processo")

    if not pub.numero_processo_mascara:
        masc = _item_get(
            item,
            "numeroprocessocommascara",
            "numeroProcessoComMascara",
            "numeroProcessoMascara",
        )
        if masc:
            pub.numero_processo_mascara = str(masc)[:50]
            mudou.append("numero_processo_mascara")

    if not pub.polo_ativo and not pub.polo_passivo:
        ativo, passivo = extrair_polos(item)
        if ativo or passivo:
            pub.polo_ativo = ativo
            pub.polo_passivo = passivo
            mudou.append("polos")

    return mudou


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="nao grava, so' relata")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s backfill_djen %(message)s",
    )

    from app import create_app, db  # noqa: PLC0415
    from djen_tasks import _extrair_polos_do_item  # noqa: PLC0415
    from models import PublicacaoDJEN  # noqa: PLC0415

    app = create_app()
    with app.app_context():
        pubs = (
            PublicacaoDJEN.query.filter(PublicacaoDJEN.raw_json.isnot(None))
            .order_by(PublicacaoDJEN.id)
            .all()
        )
        logger.info("publicacoes com raw_json: %s", len(pubs))

        contagem = {"numero_processo": 0, "numero_processo_mascara": 0, "polos": 0}
        tocadas = 0
        for pub in pubs:
            mudou = _reprocessar(pub, _extrair_polos_do_item)
            if mudou:
                tocadas += 1
                for campo in mudou:
                    contagem[campo] += 1

        if args.dry_run:
            db.session.rollback()
            logger.info("DRY-RUN: nada gravado")
        else:
            db.session.commit()

        logger.info(
            "publicacoes corrigidas: %s (numero=%s mascara=%s polos=%s)",
            tocadas,
            contagem["numero_processo"],
            contagem["numero_processo_mascara"],
            contagem["polos"],
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
