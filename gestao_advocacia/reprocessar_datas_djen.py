import argparse

from app import create_app, db, PublicacaoDJEN
from djen_tasks import _item_get, _parse_data_disponibilizacao


def extrair_data_publicacao(pub):
    raw = pub.raw_json or {}
    if not isinstance(raw, dict):
        return None

    valor = _item_get(raw, "dataDisponibilizacao", "datadisponibilizacao", "data")
    return _parse_data_disponibilizacao(valor)


def main():
    parser = argparse.ArgumentParser(
        description="Reprocessa publicações DJEN antigas para preencher data_disponibilizacao ausente."
    )
    parser.add_argument("--tenant-id", type=int, default=None, help="Filtra por tenant específico")
    parser.add_argument("--limit", type=int, default=0, help="Limita quantidade de registros processados (0 = sem limite)")
    parser.add_argument("--dry-run", action="store_true", help="Somente simula, sem gravar no banco")
    args = parser.parse_args()

    app = create_app()

    with app.app_context():
        query = PublicacaoDJEN.query.filter(PublicacaoDJEN.data_disponibilizacao.is_(None))

        if args.tenant_id is not None:
            query = query.filter_by(tenant_id=args.tenant_id)

        query = query.order_by(PublicacaoDJEN.id.asc())
        if args.limit and args.limit > 0:
            query = query.limit(args.limit)

        pubs = query.all()

        total_sem_data = len(pubs)
        total_com_data_extraida = 0
        total_sem_data_no_payload = 0

        for pub in pubs:
            data_extraida = extrair_data_publicacao(pub)
            if data_extraida:
                total_com_data_extraida += 1
                if not args.dry_run:
                    pub.data_disponibilizacao = data_extraida
            else:
                total_sem_data_no_payload += 1

        if args.dry_run:
            db.session.rollback()
        else:
            db.session.commit()

        modo = "SIMULACAO" if args.dry_run else "APLICADO"
        print(f"[DJEN REPROCESS] Modo: {modo}")
        print(f"[DJEN REPROCESS] Registros sem data analisados: {total_sem_data}")
        print(f"[DJEN REPROCESS] Registros com data recuperada: {total_com_data_extraida}")
        print(f"[DJEN REPROCESS] Registros ainda sem data no payload: {total_sem_data_no_payload}")


if __name__ == "__main__":
    main()
