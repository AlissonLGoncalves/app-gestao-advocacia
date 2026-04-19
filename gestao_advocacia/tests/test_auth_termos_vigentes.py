import hashlib
from pathlib import Path

BASE = "/api/v1/auth/termos-vigentes"
LEGAL_DIR = Path(__file__).resolve().parents[1] / "legal"


def _sha256_text(path):
    conteudo = path.read_text(encoding="utf-8")
    return hashlib.sha256(conteudo.encode("utf-8")).hexdigest()


def test_termos_vigentes_retorna_estrutura_esperada(client):
    response = client.post(BASE)
    assert response.status_code == 200

    data = response.get_json()
    assert "termos" in data
    assert "lgpd" in data

    assert data["termos"]["versao"] == "v1.0"
    assert data["lgpd"]["versao"] == "v1.0"
    assert data["termos"]["conteudo"]
    assert data["lgpd"]["conteudo"]


def test_termos_vigentes_hash_estavel(client):
    first = client.post(BASE)
    second = client.post(BASE)

    assert first.status_code == 200
    assert second.status_code == 200

    first_data = first.get_json()
    second_data = second.get_json()

    assert first_data["termos"]["hash"] == second_data["termos"]["hash"]
    assert first_data["lgpd"]["hash"] == second_data["lgpd"]["hash"]

    expected_termos_hash = _sha256_text(LEGAL_DIR / "termos-v1.0.md")
    expected_lgpd_hash = _sha256_text(LEGAL_DIR / "lgpd-v1.0.md")

    assert first_data["termos"]["hash"] == expected_termos_hash
    assert first_data["lgpd"]["hash"] == expected_lgpd_hash
