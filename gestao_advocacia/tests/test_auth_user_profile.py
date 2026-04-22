import json

from models import User

BASE = "/api/v1/auth"


def _payload_base(**overrides):
    payload = {
        "username": "advogado_pf",
        "email": "advogado.pf@teste.com",
        "password": "Senha1234!",
        "role": "admin",
        "tipo_pessoa": "PF",
        "nome_completo": "Advogado PF",
        "cpf": "529.982.247-25",
        "oab": "123456",
        "sigla_oab_tribunal": "PR",
        "aceite_termos": True,
        "aceite_lgpd": True,
        "versao_termos": "v1.0",
        "versao_lgpd": "v1.0",
    }
    payload.update(overrides)
    return payload


def test_register_pf_com_oab_invalida_retorna_400(client, db):
    resp = client.post(
        f"{BASE}/register",
        json=_payload_base(oab="12", sigla_oab_tribunal="PR", email="oab-invalida@teste.com"),
    )

    assert resp.status_code == 400
    data = json.loads(resp.data)
    assert "OAB" in data["message"]


def test_register_pf_persiste_nome_cpf_oab(client, db):
    resp = client.post(f"{BASE}/register", json=_payload_base())
    assert resp.status_code == 201

    user = User.query.filter_by(email="advogado.pf@teste.com").first()
    assert user is not None
    assert user.nome_completo == "Advogado PF"
    assert user.cpf == "529.982.247-25"
    assert user.numero_oab == "123456"
    assert user.sigla_oab_tribunal == "PR"
    assert user.tipo_pessoa == "PF"


def test_put_auth_me_atualiza_campos_permitidos(auth_client, db):
    resp = auth_client.put(
        f"{BASE}/me",
        json={
            "nome_completo": "Nome Atualizado",
            "numero_oab": "998877",
            "sigla_oab_tribunal": "SP",
            "cpf": "52998224725",
            "tipo_pessoa": "PF",
        },
    )

    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["nome_completo"] == "Nome Atualizado"
    assert data["numero_oab"] == "998877"
    assert data["sigla_oab_tribunal"] == "SP"
    assert data["cpf"] == "529.982.247-25"
    assert data["tipo_pessoa"] == "PF"

    user = User.query.filter_by(email="testuser@teste.com").first()
    assert user is not None
    assert user.nome_completo == "Nome Atualizado"
    assert user.numero_oab == "998877"
    assert user.sigla_oab_tribunal == "SP"
    assert user.cpf == "529.982.247-25"
