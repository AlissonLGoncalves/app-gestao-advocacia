# Testes dos filtros avancados em GET /casos e GET /clientes.

import json

_n = {"v": 0}


def _criar_cliente(auth_client, **overrides):
    _n["v"] += 1
    suf = f"{_n['v']:04d}"
    payload = {
        "nome_razao_social": f"Cliente {suf}",
        "cpf_cnpj": f"00011122{suf}",
        "tipo_pessoa": "PF",
    }
    payload.update(overrides)
    res = auth_client.post("/api/v1/clientes", json=payload)
    assert res.status_code == 201, res.data
    return json.loads(res.data)


def _criar_caso(auth_client, cliente_id, **overrides):
    _n["v"] += 1
    payload = {"titulo": f"Caso {_n['v']}", "cliente_id": cliente_id}
    payload.update(overrides)
    res = auth_client.post("/api/v1/casos", json=payload)
    assert res.status_code == 201, res.data
    return json.loads(res.data)


def _ids(items):
    return {i["id"] for i in items}


# ── Casos ───────────────────────────────────────────────────────────────────


def test_casos_filtro_area_direito(auth_client, db):
    cli = _criar_cliente(auth_client)
    a = _criar_caso(auth_client, cli["id"], area_direito="Trabalhista")
    b = _criar_caso(auth_client, cli["id"], area_direito="Civel")

    items = json.loads(auth_client.get("/api/v1/casos?area_direito=Trabalhista").data)
    assert _ids(items) == {a["id"]}
    assert b["id"] not in _ids(items)


def test_casos_filtro_fase_processual(auth_client, db):
    cli = _criar_cliente(auth_client)
    a = _criar_caso(auth_client, cli["id"], fase_processual="Conhecimento")
    _criar_caso(auth_client, cli["id"], fase_processual="Recursal")

    items = json.loads(auth_client.get("/api/v1/casos?fase_processual=Conhecimento").data)
    assert _ids(items) == {a["id"]}


def test_casos_filtro_vara_ilike_partial(auth_client, db):
    cli = _criar_cliente(auth_client)
    a = _criar_caso(auth_client, cli["id"], vara_juizo="2ª Vara Cível Curitiba")
    _criar_caso(auth_client, cli["id"], vara_juizo="Tribunal Regional Federal 4ª")

    items = json.loads(auth_client.get("/api/v1/casos?vara_juizo=Curitiba").data)
    assert _ids(items) == {a["id"]}


def test_casos_filtro_valor_causa_range(auth_client, db):
    cli = _criar_cliente(auth_client)
    a = _criar_caso(auth_client, cli["id"], valor_causa=5000)
    b = _criar_caso(auth_client, cli["id"], valor_causa=15000)
    c = _criar_caso(auth_client, cli["id"], valor_causa=50000)

    items = json.loads(
        auth_client.get("/api/v1/casos?valor_causa_min=10000&valor_causa_max=20000").data
    )
    assert _ids(items) == {b["id"]}
    assert a["id"] not in _ids(items)
    assert c["id"] not in _ids(items)


def test_casos_filtro_data_distribuicao(auth_client, db):
    cli = _criar_cliente(auth_client)
    a = _criar_caso(auth_client, cli["id"], data_distribuicao="2026-01-15")
    b = _criar_caso(auth_client, cli["id"], data_distribuicao="2026-04-15")

    items_jan = json.loads(
        auth_client.get(
            "/api/v1/casos?data_distribuicao_inicio=2026-01-01&data_distribuicao_fim=2026-01-31"
        ).data
    )
    assert _ids(items_jan) == {a["id"]}

    items_abr = json.loads(
        auth_client.get("/api/v1/casos?data_distribuicao_inicio=2026-04-01").data
    )
    assert b["id"] in _ids(items_abr)


def test_casos_filtro_valor_invalido_400(auth_client, db):
    res = auth_client.get("/api/v1/casos?valor_causa_min=abc")
    assert res.status_code == 400


def test_casos_combinacao_de_filtros(auth_client, db):
    cli = _criar_cliente(auth_client)
    alvo = _criar_caso(
        auth_client,
        cli["id"],
        area_direito="Trabalhista",
        fase_processual="Conhecimento",
        valor_causa=12000,
    )
    _criar_caso(auth_client, cli["id"], area_direito="Trabalhista", valor_causa=500)
    _criar_caso(auth_client, cli["id"], area_direito="Civel", fase_processual="Conhecimento")

    items = json.loads(
        auth_client.get(
            "/api/v1/casos?area_direito=Trabalhista&fase_processual=Conhecimento"
            "&valor_causa_min=1000&valor_causa_max=20000"
        ).data
    )
    assert _ids(items) == {alvo["id"]}


# ── Clientes ────────────────────────────────────────────────────────────────


def test_clientes_filtro_cidade_ilike(auth_client, db):
    a = _criar_cliente(auth_client, cidade="Curitiba")
    _criar_cliente(auth_client, cidade="Sao Paulo")

    items = json.loads(auth_client.get("/api/v1/clientes?cidade=Curi").data)
    assert _ids(items) == {a["id"]}


def test_clientes_filtro_estado_uppercase(auth_client, db):
    a = _criar_cliente(auth_client, estado="PR")
    _criar_cliente(auth_client, estado="SP")

    # Aceita lowercase no input e converte.
    items = json.loads(auth_client.get("/api/v1/clientes?estado=pr").data)
    assert _ids(items) == {a["id"]}


def test_clientes_filtro_profissao_ilike(auth_client, db):
    a = _criar_cliente(auth_client, profissao="Engenheira Civil")
    _criar_cliente(auth_client, profissao="Medico")

    items = json.loads(auth_client.get("/api/v1/clientes?profissao=engenheir").data)
    assert _ids(items) == {a["id"]}


def test_filtros_isolamento_cross_tenant(client, auth_client, db):
    """Casos com mesmo area_direito em outro tenant nao devem aparecer."""
    cli = _criar_cliente(auth_client)
    meu = _criar_caso(auth_client, cli["id"], area_direito="Tributario")

    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "outro_filtros",
            "email": "outro_filtros@teste.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "outro_filtros", "password": "Senha1234!"},
    )
    token = json.loads(login.data)["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    cli_outro = client.post(
        "/api/v1/clientes",
        json={"nome_razao_social": "Outro", "cpf_cnpj": "99999111000", "tipo_pessoa": "PF"},
        headers=headers,
    )
    assert cli_outro.status_code == 201
    client.post(
        "/api/v1/casos",
        json={
            "titulo": "Caso outro tenant",
            "cliente_id": json.loads(cli_outro.data)["id"],
            "area_direito": "Tributario",
        },
        headers=headers,
    )

    items = json.loads(auth_client.get("/api/v1/casos?area_direito=Tributario").data)
    assert _ids(items) == {meu["id"]}
