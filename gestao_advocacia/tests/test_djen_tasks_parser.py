from datetime import date

from djen_tasks import _item_get, _parse_data_disponibilizacao


def test_parse_data_disponibilizacao_iso_date():
    assert _parse_data_disponibilizacao("2026-04-17") == date(2026, 4, 17)


def test_parse_data_disponibilizacao_iso_datetime_ms():
    assert _parse_data_disponibilizacao("2026-04-17T03:00:00.000Z") == date(2026, 4, 17)


def test_parse_data_disponibilizacao_br_format():
    assert _parse_data_disponibilizacao("17/04/2026") == date(2026, 4, 17)


def test_item_get_case_insensitive_variants():
    payload = {
        "datadisponibilizacao": "17/04/2026",
        "numeroprocesso": "0005046-78.2024.8.16.0075",
    }
    assert _item_get(payload, "dataDisponibilizacao") == "17/04/2026"
    assert _item_get(payload, "numeroProcesso") == "0005046-78.2024.8.16.0075"
