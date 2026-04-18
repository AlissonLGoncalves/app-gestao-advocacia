# Arquivo: tests/test_djen_api.py
# Testes para o mÃ³dulo DJEN â€” DiÃ¡rio de JustiÃ§a EletrÃ´nico Nacional.
# Cobre: OABs monitoradas, publicaÃ§Ãµes, PATCH de publicaÃ§Ã£o, nÃ£o-lidas e sync manual.

import json
from datetime import date
from unittest.mock import patch

from app import Caso, Cliente, PublicacaoDJEN

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _criar_caso(auth_client, db):
    """Cria um cliente e um caso de teste, retorna o caso_id."""
    # Primeiro cria um cliente
    resp = auth_client.post(
        "/api/v1/clientes",
        json={
            "nome_razao_social": "Cliente DJEN Teste",
            "cpf_cnpj": "999.888.777-66",
            "tipo_pessoa": "PF",
            "email": "djen@teste.com",
        },
    )
    assert resp.status_code == 201
    cliente_id = json.loads(resp.data)["id"]

    resp = auth_client.post(
        "/api/v1/casos",
        json={
            "titulo": "Caso DJEN",
            "status": "Ativo",
            "tipo_acao": "CÃ­vel",
            "cliente_id": cliente_id,
            "numero_processo": "0001234-12.2024.8.16.0001",
        },
    )
    assert resp.status_code == 201
    return json.loads(resp.data)["id"]


def _criar_publicacao(db, tenant_id, user_id, caso_id=None, lida=False, djen_id=1):
    """Insere diretamente uma publicaÃ§Ã£o no banco de teste."""
    pub = PublicacaoDJEN(
        tenant_id=tenant_id,
        user_id=user_id,
        djen_id=djen_id,
        hash_comunicacao=f"hash-{djen_id}",
        numero_processo="0001234-12.2024.8.16.0001",
        sigla_tribunal="TJPR",
        nome_orgao="1Âª Vara CÃ­vel",
        tipo_comunicacao="IntimaÃ§Ã£o",
        data_disponibilizacao=date.today(),
        texto="Texto de intimaÃ§Ã£o de teste.",
        lida=lida,
        origem_busca="oab",
        caso_id=caso_id,
    )
    db.session.add(pub)
    db.session.commit()
    return pub


# ---------------------------------------------------------------------------
# OABs monitoradas
# ---------------------------------------------------------------------------


class TestDjenOABs:
    def test_lista_oabs_vazia(self, auth_client, db):
        """GET /api/v1/djen/oabs retorna lista vazia quando nÃ£o hÃ¡ OABs cadastradas."""
        resp = auth_client.get("/api/v1/djen/oabs")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert isinstance(data, list)
        assert len(data) == 0

    def test_cadastrar_oab_sucesso(self, auth_client, db):
        """POST /api/v1/djen/oabs cadastra uma OAB com sucesso."""
        resp = auth_client.post(
            "/api/v1/djen/oabs",
            json={
                "numero_oab": "123456",
                "uf_oab": "PR",
                "nome_advogado": "Dr. Teste",
            },
        )
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert data["numero_oab"] == "123456"
        assert data["uf_oab"] == "PR"
        assert data["nome_advogado"] == "Dr. Teste"
        assert "id" in data

    def test_cadastrar_oab_campos_obrigatorios(self, auth_client, db):
        """POST /api/v1/djen/oabs retorna 400 quando campos obrigatÃ³rios faltam."""
        resp = auth_client.post(
            "/api/v1/djen/oabs",
            json={
                "numero_oab": "123456",
                # uf_oab ausente
            },
        )
        assert resp.status_code == 400

    def test_cadastrar_oab_duplicada_retorna_409(self, auth_client, db):
        """POST /api/v1/djen/oabs retorna 409 se a OAB jÃ¡ estÃ¡ cadastrada."""
        payload = {"numero_oab": "654321", "uf_oab": "SP"}
        auth_client.post("/api/v1/djen/oabs", json=payload)
        resp = auth_client.post("/api/v1/djen/oabs", json=payload)
        assert resp.status_code == 409

    def test_listar_oabs_apos_cadastro(self, auth_client, db):
        """GET /api/v1/djen/oabs lista a OAB cadastrada."""
        auth_client.post("/api/v1/djen/oabs", json={"numero_oab": "111222", "uf_oab": "MG"})
        resp = auth_client.get("/api/v1/djen/oabs")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert any(o["numero_oab"] == "111222" for o in data)

    def test_deletar_oab_sucesso(self, auth_client, db):
        """DELETE /api/v1/djen/oabs/<id> remove a OAB com sucesso."""
        resp = auth_client.post("/api/v1/djen/oabs", json={"numero_oab": "999000", "uf_oab": "RJ"})
        oab_id = json.loads(resp.data)["id"]

        del_resp = auth_client.delete(f"/api/v1/djen/oabs/{oab_id}")
        assert del_resp.status_code == 204

        # Confirma remoÃ§Ã£o
        list_resp = auth_client.get("/api/v1/djen/oabs")
        data = json.loads(list_resp.data)
        assert not any(o["id"] == oab_id for o in data)

    def test_deletar_oab_nao_existente(self, auth_client, db):
        """DELETE /api/v1/djen/oabs/<id> retorna 404 para OAB inexistente."""
        resp = auth_client.delete("/api/v1/djen/oabs/99999")
        assert resp.status_code == 404

    def test_oab_sem_autenticacao_retorna_401(self, client, db):
        """GET /api/v1/djen/oabs sem token retorna 401."""
        resp = client.get("/api/v1/djen/oabs")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PublicaÃ§Ãµes DJEN
# ---------------------------------------------------------------------------


class TestDjenPublicacoes:
    def test_lista_publicacoes_vazia(self, auth_client, db):
        """GET /api/v1/djen/publicacoes retorna lista vazia quando nÃ£o hÃ¡ publicaÃ§Ãµes."""
        resp = auth_client.get("/api/v1/djen/publicacoes")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert "items" in data
        assert data["total"] == 0
        assert len(data["items"]) == 0

    def test_lista_publicacoes_com_registro(self, auth_client, db, app):
        """GET /api/v1/djen/publicacoes retorna a publicaÃ§Ã£o inserida."""
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            _criar_publicacao(db, user.tenant_id, user.id, djen_id=100)

        resp = auth_client.get("/api/v1/djen/publicacoes")
        data = json.loads(resp.data)
        assert data["total"] == 1
        assert data["items"][0]["sigla_tribunal"] == "TJPR"

    def test_filtro_por_lida_false(self, auth_client, db, app):
        """GET /api/v1/djen/publicacoes?lida=false filtra corretamente."""
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            _criar_publicacao(db, user.tenant_id, user.id, lida=False, djen_id=200)
            _criar_publicacao(db, user.tenant_id, user.id, lida=True, djen_id=201)

        resp = auth_client.get("/api/v1/djen/publicacoes?lida=false")
        data = json.loads(resp.data)
        assert data["total"] == 1
        assert data["items"][0]["lida"] is False

    def test_filtro_por_tribunal(self, auth_client, db, app):
        """GET /api/v1/djen/publicacoes?sigla_tribunal=TJPR filtra por tribunal."""
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            _criar_publicacao(db, user.tenant_id, user.id, djen_id=300)

        resp = auth_client.get("/api/v1/djen/publicacoes?sigla_tribunal=TJPR")
        data = json.loads(resp.data)
        assert data["total"] == 1

        resp_outro = auth_client.get("/api/v1/djen/publicacoes?sigla_tribunal=TJSP")
        data_outro = json.loads(resp_outro.data)
        assert data_outro["total"] == 0

    def test_paginacao(self, auth_client, db, app):
        """GET /api/v1/djen/publicacoes com limit e offset pagina corretamente."""
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            for i in range(5):
                _criar_publicacao(db, user.tenant_id, user.id, djen_id=400 + i)

        resp = auth_client.get("/api/v1/djen/publicacoes?limit=2&offset=0")
        data = json.loads(resp.data)
        assert data["total"] == 5
        assert len(data["items"]) == 2

        resp2 = auth_client.get("/api/v1/djen/publicacoes?limit=2&offset=4")
        data2 = json.loads(resp2.data)
        assert len(data2["items"]) == 1

    def test_detalhe_publicacao_existente(self, auth_client, db, app):
        """GET /api/v1/djen/publicacoes/<id> retorna a publicaÃ§Ã£o solicitada."""
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            pub = _criar_publicacao(db, user.tenant_id, user.id, djen_id=500)
            pub_id = pub.id

        resp = auth_client.get(f"/api/v1/djen/publicacoes/{pub_id}")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["id"] == pub_id
        assert data["sigla_tribunal"] == "TJPR"

    def test_detalhe_publicacao_inexistente(self, auth_client, db):
        """GET /api/v1/djen/publicacoes/<id> retorna 404 para publicaÃ§Ã£o inexistente."""
        resp = auth_client.get("/api/v1/djen/publicacoes/99999")
        assert resp.status_code == 404

    def test_publicacoes_sem_autenticacao(self, client, db):
        """GET /api/v1/djen/publicacoes sem token retorna 401."""
        resp = client.get("/api/v1/djen/publicacoes")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH publicaÃ§Ã£o (marcar lida, vincular caso, notas)
# ---------------------------------------------------------------------------


class TestDjenPatchPublicacao:
    def test_marcar_publicacao_como_lida(self, auth_client, db, app):
        """PATCH /api/v1/djen/publicacoes/<id> marca a publicaÃ§Ã£o como lida."""
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            pub = _criar_publicacao(db, user.tenant_id, user.id, lida=False, djen_id=600)
            pub_id = pub.id

        resp = auth_client.patch(f"/api/v1/djen/publicacoes/{pub_id}", json={"lida": True})
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["lida"] is True

    def test_adicionar_notas(self, auth_client, db, app):
        """PATCH /api/v1/djen/publicacoes/<id> atualiza notas da publicaÃ§Ã£o."""
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            pub = _criar_publicacao(db, user.tenant_id, user.id, djen_id=601)
            pub_id = pub.id

        resp = auth_client.patch(
            f"/api/v1/djen/publicacoes/{pub_id}", json={"notas": "Verificar com o cliente."}
        )
        assert resp.status_code == 200
        assert json.loads(resp.data)["notas"] == "Verificar com o cliente."

    def test_vincular_caso(self, auth_client, db, app):
        """PATCH /api/v1/djen/publicacoes/<id> vincula a publicaÃ§Ã£o a um caso."""
        caso_id = _criar_caso(auth_client, db)

        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            pub = _criar_publicacao(db, user.tenant_id, user.id, djen_id=602)
            pub_id = pub.id

        resp = auth_client.patch(f"/api/v1/djen/publicacoes/{pub_id}", json={"caso_id": caso_id})
        assert resp.status_code == 200
        assert json.loads(resp.data)["caso_id"] == caso_id

    def test_patch_publicacao_inexistente(self, auth_client, db):
        """PATCH /api/v1/djen/publicacoes/<id> retorna 404 para publicaÃ§Ã£o inexistente."""
        resp = auth_client.patch("/api/v1/djen/publicacoes/99999", json={"lida": True})
        assert resp.status_code == 404

    def test_patch_sem_autenticacao(self, client, db):
        """PATCH /api/v1/djen/publicacoes/<id> sem token retorna 401."""
        resp = client.patch("/api/v1/djen/publicacoes/1", json={"lida": True})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Contagem de nÃ£o-lidas (badge)
# ---------------------------------------------------------------------------


class TestDjenNaoLidas:
    def test_nao_lidas_zero_sem_publicacoes(self, auth_client, db):
        """GET /api/v1/djen/nao-lidas retorna 0 quando nÃ£o hÃ¡ publicaÃ§Ãµes."""
        resp = auth_client.get("/api/v1/djen/nao-lidas")
        assert resp.status_code == 200
        assert json.loads(resp.data)["count"] == 0

    def test_nao_lidas_conta_corretamente(self, auth_client, db, app):
        """GET /api/v1/djen/nao-lidas retorna a contagem correta de nÃ£o-lidas."""
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            _criar_publicacao(db, user.tenant_id, user.id, lida=False, djen_id=700)
            _criar_publicacao(db, user.tenant_id, user.id, lida=False, djen_id=701)
            _criar_publicacao(db, user.tenant_id, user.id, lida=True, djen_id=702)

        resp = auth_client.get("/api/v1/djen/nao-lidas")
        assert json.loads(resp.data)["count"] == 2

    def test_nao_lidas_sem_autenticacao(self, client, db):
        """GET /api/v1/djen/nao-lidas sem token retorna 401."""
        resp = client.get("/api/v1/djen/nao-lidas")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# SincronizaÃ§Ã£o manual
# ---------------------------------------------------------------------------


class TestDjenSync:
    def test_sync_manual_sucesso(self, auth_client, db):
        """POST /api/v1/djen/sync inicia a sincronizaÃ§Ã£o manual (mockando o job)."""
        with patch("djen_tasks.job_monitorar_djen") as mock_job:
            mock_job.return_value = {
                "ok": True,
                "lookback_days": 30,
                "oabs_processadas": 1,
                "casos_processados": 0,
                "itens_encontrados": 2,
                "publicacoes_salvas": 1,
                "erros": 0,
            }
            resp = auth_client.post("/api/v1/djen/sync", json={"dias": 1})
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert "message" in data
        assert "Sincroniza" in data["message"]
        assert "resumo" in data

    def test_sync_sem_autenticacao(self, client, db):
        """POST /api/v1/djen/sync sem token retorna 401."""
        resp = client.post("/api/v1/djen/sync", json={"dias": 1})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Compatibilidade da integraÃ§Ã£o DJEN (payload CNJ)
# ---------------------------------------------------------------------------


class TestDjenPayloadCompat:
    def test_extrair_items_suporta_formato_atual_items(self):
        """_extrair_items deve aceitar payload com chave 'items' da ComunicaAPI atual."""
        from djen_tasks import _extrair_items

        payload = {
            "status": "success",
            "message": "Sucesso",
            "count": 1,
            "items": [{"id": 123, "hash": "abc"}],
        }

        items = _extrair_items(payload)
        assert isinstance(items, list)
        assert len(items) == 1
        assert items[0]["id"] == 123

    def test_normalizar_sigla_tribunal_converte_uf_para_tj(self):
        """_normalizar_sigla_tribunal converte UF (PR) para sigla esperada (TJPR)."""
        from djen_tasks import _normalizar_sigla_tribunal

        assert _normalizar_sigla_tribunal("pr") == "TJPR"
        assert _normalizar_sigla_tribunal("TJSP") == "TJSP"
        assert _normalizar_sigla_tribunal("") is None
        assert _normalizar_sigla_tribunal(None) is None

    def test_normalizar_numero_oab_remove_mascara(self):
        """_normalizar_numero_oab deve manter somente dÃ­gitos quando possÃ­vel."""
        from djen_tasks import _normalizar_numero_oab

        assert _normalizar_numero_oab("94.297/PR") == "94297"
        assert _normalizar_numero_oab(" 94297 ") == "94297"
        assert _normalizar_numero_oab("") == ""
        assert _normalizar_numero_oab(None) == ""

    def test_consultar_oab_com_fallback_tenta_paginas_e_sem_tribunal(self):
        """Quando nÃ£o encontra com tribunal/pÃ¡gina inicial, tenta fallback atÃ© achar."""
        from djen_tasks import _consultar_oab_com_fallback

        class DummyLogger:
            def info(self, *args, **kwargs):
                return None

        side_effect = [
            {"items": []},  # com sigla, pagina 1
            {"items": []},  # com sigla, pagina 0
            {"items": [{"id": 7}]},  # sem sigla, pagina 1
        ]
        with patch("djen_tasks.consultar_comunicacoes", side_effect=side_effect) as mocked:
            payload, items = _consultar_oab_com_fallback(
                numero_oab="94297",
                sigla_tribunal="TJPR",
                data_inicio="2026-04-01",
                data_fim="2026-04-17",
                logger=DummyLogger(),
            )

            assert len(items) == 1
            assert payload.get("items")[0]["id"] == 7
            assert mocked.call_count == 3


# ---------------------------------------------------------------------------
# Triagem inteligente (parser + matching)
# ---------------------------------------------------------------------------


class TestDjenTriagem:
    def test_triagem_retorna_analise_e_sugestoes(self, auth_client, db, app):
        """GET /api/v1/djen/triagem retorna anÃ¡lise de partes/representantes e sugestÃµes."""
        caso_id = None
        pub_id = None
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()

            cliente = Cliente(
                tenant_id=user.tenant_id,
                user_id=user.id,
                nome_razao_social="Joao da Silva",
                cpf_cnpj="111.222.333-44",
                tipo_pessoa="PF",
                email="joao@teste.com",
            )
            db.session.add(cliente)
            db.session.flush()

            caso = Caso(
                tenant_id=user.tenant_id,
                user_id=user.id,
                cliente_id=cliente.id,
                titulo="Acao de Cobranca",
                numero_processo="0001234-12.2024.8.16.0001",
                status="Ativo",
            )
            db.session.add(caso)
            db.session.flush()
            caso_id = caso.id

            pub = PublicacaoDJEN(
                tenant_id=user.tenant_id,
                user_id=user.id,
                djen_id=8801,
                hash_comunicacao="hash-triagem-8801",
                numero_processo="0001234-12.2024.8.16.0001",
                sigla_tribunal="TJPR",
                tipo_comunicacao="Intimacao",
                data_disponibilizacao=date.today(),
                texto=(
                    "AUTOR: Joao da Silva; REU: Empresa XPTO LTDA; "
                    "ADVOGADO: Maria Rocha OAB/PR 12345"
                ),
                origem_busca="oab",
            )
            db.session.add(pub)
            db.session.commit()
            pub_id = pub.id

        resp = auth_client.get("/api/v1/djen/triagem")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["total"] >= 1
        item = next((i for i in data["items"] if i["publicacao"]["id"] == pub_id), None)
        assert item is not None

        assert "analise" in item
        assert item["analise"]["numero_processo"] == "0001234-12.2024.8.16.0001"
        assert any("Joao da Silva" in p for p in item["analise"]["partes_autoras"])
        assert len(item["analise"]["representantes"]) >= 1

        assert "sugestoes" in item
        assert any(c["id"] == caso_id for c in item["sugestoes"]["casos"])

    def test_triagem_sem_autenticacao(self, client, db):
        """GET /api/v1/djen/triagem sem token retorna 401."""
        resp = client.get("/api/v1/djen/triagem")
        assert resp.status_code == 401

    def test_triagem_criar_cliente_caso(self, auth_client, db, app):
        """POST /api/v1/djen/triagem/<id>/criar-cliente-caso cria e vincula entidades."""
        pub_id = None
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()

            pub = PublicacaoDJEN(
                tenant_id=user.tenant_id,
                user_id=user.id,
                djen_id=9901,
                hash_comunicacao="hash-triagem-9901",
                numero_processo="0007777-12.2025.8.16.0001",
                sigla_tribunal="TJPR",
                tipo_comunicacao="Intimacao",
                data_disponibilizacao=date.today(),
                texto="AUTOR: Carla Souza; REU: Empresa Alfa LTDA; ADVOGADO: Dr. Pedro Lopes",
                origem_busca="oab",
                lida=False,
            )
            db.session.add(pub)
            db.session.commit()
            pub_id = pub.id

        resp = auth_client.post(f"/api/v1/djen/triagem/{pub_id}/criar-cliente-caso")
        assert resp.status_code == 201
        payload = json.loads(resp.data)

        assert payload["cliente"]["id"] is not None
        assert payload["caso"]["id"] is not None
        assert payload["publicacao"]["caso_id"] == payload["caso"]["id"]
        assert payload["publicacao"]["lida"] is True

        with app.app_context():
            pub_db = PublicacaoDJEN.query.get(pub_id)
            assert pub_db is not None
            assert pub_db.caso_id == payload["caso"]["id"]

    def test_triagem_criar_cliente_caso_sem_autenticacao(self, client, db):
        """POST /api/v1/djen/triagem/<id>/criar-cliente-caso sem token retorna 401."""
        resp = client.post("/api/v1/djen/triagem/1/criar-cliente-caso")
        assert resp.status_code == 401

    def test_triagem_processar_lote(self, auth_client, db, app):
        """POST /api/v1/djen/triagem/processar-lote processa mÃºltiplas publicaÃ§Ãµes."""
        pub_ids = []
        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()

            for idx in range(2):
                pub = PublicacaoDJEN(
                    tenant_id=user.tenant_id,
                    user_id=user.id,
                    djen_id=9950 + idx,
                    hash_comunicacao=f"hash-triagem-lote-{idx}",
                    numero_processo=f"00088{idx}7-12.2025.8.16.0001",
                    sigla_tribunal="TJPR",
                    tipo_comunicacao="Intimacao",
                    data_disponibilizacao=date.today(),
                    texto=f"AUTOR: Pessoa {idx}; REU: Empresa {idx}; ADVOGADO: Dr. Triagem {idx}",
                    origem_busca="oab",
                    lida=False,
                )
                db.session.add(pub)
                db.session.flush()
                pub_ids.append(pub.id)
            db.session.commit()

        resp = auth_client.post("/api/v1/djen/triagem/processar-lote", json={"pub_ids": pub_ids})
        assert resp.status_code == 200
        payload = json.loads(resp.data)
        assert payload["total_recebidas"] == 2
        assert payload["processadas"] == 2
        assert payload["erros"] == 0

        with app.app_context():
            pubs = PublicacaoDJEN.query.filter(PublicacaoDJEN.id.in_(pub_ids)).all()
            assert all(p.caso_id is not None for p in pubs)
            assert all(p.lida is True for p in pubs)

    def test_triagem_processar_lote_sem_autenticacao(self, client, db):
        """POST /api/v1/djen/triagem/processar-lote sem token retorna 401."""
        resp = client.post("/api/v1/djen/triagem/processar-lote", json={"pub_ids": [1, 2]})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Isolamento de tenant
# ---------------------------------------------------------------------------


class TestDjenTenantIsolation:
    def test_tenant_nao_ve_oab_de_outro(self, client, db, app):
        """Dois tenants distintos nÃ£o enxergam OABs um do outro."""
        # Registra e loga usuÃ¡rio A
        client.post(
            "/api/v1/auth/register",
            json={
                "username": "user_a",
                "email": "a@test.com",
                "password": "Senha1234!",
                "role": "admin",
            },
        )
        token_a = json.loads(
            client.post(
                "/api/v1/auth/login", json={"username_or_email": "user_a", "password": "Senha1234!"}
            ).data
        )["access_token"]

        # Registra e loga usuÃ¡rio B (tenant separado)
        client.post(
            "/api/v1/auth/register",
            json={
                "username": "user_b",
                "email": "b@test.com",
                "password": "Senha1234!",
                "role": "admin",
            },
        )
        token_b = json.loads(
            client.post(
                "/api/v1/auth/login", json={"username_or_email": "user_b", "password": "Senha1234!"}
            ).data
        )["access_token"]

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # UsuÃ¡rio A cadastra uma OAB
        client.post(
            "/api/v1/djen/oabs", json={"numero_oab": "888111", "uf_oab": "SC"}, headers=headers_a
        )

        # UsuÃ¡rio B nÃ£o deve ver a OAB do usuÃ¡rio A
        resp_b = client.get("/api/v1/djen/oabs", headers=headers_b)
        oabs_b = json.loads(resp_b.data)
        assert not any(o["numero_oab"] == "888111" for o in oabs_b)

    def test_tenant_nao_ve_publicacao_de_outro(self, client, db, app):
        """Dois tenants distintos nÃ£o enxergam publicaÃ§Ãµes um do outro."""
        # Registra e loga usuÃ¡rio C
        client.post(
            "/api/v1/auth/register",
            json={
                "username": "user_c",
                "email": "c@test.com",
                "password": "Senha1234!",
                "role": "admin",
            },
        )
        client.post(
            "/api/v1/auth/login", json={"username_or_email": "user_c", "password": "Senha1234!"}
        )

        # Registra e loga usuÃ¡rio D
        client.post(
            "/api/v1/auth/register",
            json={
                "username": "user_d",
                "email": "d@test.com",
                "password": "Senha1234!",
                "role": "admin",
            },
        )
        token_d = json.loads(
            client.post(
                "/api/v1/auth/login", json={"username_or_email": "user_d", "password": "Senha1234!"}
            ).data
        )["access_token"]

        headers_d = {"Authorization": f"Bearer {token_d}"}

        # Insere publicaÃ§Ã£o pertencente ao tenant de C
        with app.app_context():
            from app import User

            user_c = User.query.filter_by(username="user_c").first()
            _criar_publicacao(db, user_c.tenant_id, user_c.id, djen_id=800)

        # UsuÃ¡rio D nÃ£o deve ver a publicaÃ§Ã£o de C
        resp_d = client.get("/api/v1/djen/publicacoes", headers=headers_d)
        data_d = json.loads(resp_d.data)
        assert data_d["total"] == 0


# ---------------------------------------------------------------------------
# AÃ§Ãµes extras de triagem (mesclar, ignorar, qualidade)
# ---------------------------------------------------------------------------


class TestDjenTriagemAcoesExtras:
    def _criar_pub_e_caso(self, auth_client, db, app, djen_id=9100):
        from app import User

        caso_id = _criar_caso(auth_client, db)
        with app.app_context():
            user = User.query.filter_by(username="testuser").first()
            pub = PublicacaoDJEN(
                tenant_id=user.tenant_id,
                user_id=user.id,
                djen_id=djen_id,
                hash_comunicacao=f"hash-extra-{djen_id}",
                numero_processo=f"0009{djen_id}-12.2025.8.16.0001",
                sigla_tribunal="TJPR",
                tipo_comunicacao="Intimacao",
                data_disponibilizacao=date.today(),
                texto=f"AUTOR: Parte Extra {djen_id}; REU: Empresa X",
                origem_busca="oab",
            )
            db.session.add(pub)
            db.session.commit()
            pub_id = pub.id
        return pub_id, caso_id

    def test_mesclar_publicacao_com_caso(self, auth_client, db, app):
        """POST /api/v1/djen/triagem/<id>/mesclar vincula a publicaÃ§Ã£o ao caso informado."""
        pub_id, caso_id = self._criar_pub_e_caso(auth_client, db, app, djen_id=9100)

        resp = auth_client.post(f"/api/v1/djen/triagem/{pub_id}/mesclar", json={"caso_id": caso_id})
        assert resp.status_code == 200
        payload = json.loads(resp.data)
        assert payload["publicacao"]["caso_id"] == caso_id
        assert payload["publicacao"]["status_origem"] == "revisado_manual"

        with app.app_context():
            from app import DjenVinculoDecisao

            dec = DjenVinculoDecisao.query.filter_by(publicacao_id=pub_id, acao="mesclar").first()
            assert dec is not None
            assert dec.caso_id == caso_id

    def test_mesclar_sem_caso_id_retorna_400(self, auth_client, db, app):
        """POST /api/v1/djen/triagem/<id>/mesclar sem caso_id retorna 400."""
        pub_id, _ = self._criar_pub_e_caso(auth_client, db, app, djen_id=9101)
        resp = auth_client.post(f"/api/v1/djen/triagem/{pub_id}/mesclar", json={})
        assert resp.status_code == 400

    def test_ignorar_publicacao(self, auth_client, db, app):
        """POST /api/v1/djen/triagem/<id>/ignorar marca a publicaÃ§Ã£o como ignorada."""
        pub_id, _ = self._criar_pub_e_caso(auth_client, db, app, djen_id=9102)

        resp = auth_client.post(
            f"/api/v1/djen/triagem/{pub_id}/ignorar", json={"motivo": "Processo encerrado"}
        )
        assert resp.status_code == 200
        payload = json.loads(resp.data)
        assert payload["publicacao"]["triagem_ignorada"] is True
        assert payload["publicacao"]["status_origem"] == "ignorado"

        with app.app_context():
            from app import DjenVinculoDecisao

            dec = DjenVinculoDecisao.query.filter_by(publicacao_id=pub_id, acao="ignorar").first()
            assert dec is not None
            assert dec.motivo == "Processo encerrado"

    def test_ignorar_remove_da_triagem(self, auth_client, db, app):
        """PublicaÃ§Ã£o ignorada nÃ£o aparece mais na fila de triagem."""
        pub_id, _ = self._criar_pub_e_caso(auth_client, db, app, djen_id=9103)

        auth_client.post(f"/api/v1/djen/triagem/{pub_id}/ignorar", json={})

        resp = auth_client.get("/api/v1/djen/triagem")
        data = json.loads(resp.data)
        ids_triagem = [i["publicacao"]["id"] for i in data["items"]]
        assert pub_id not in ids_triagem

    def test_qualidade_retorna_metricas(self, auth_client, db, app):
        """GET /api/v1/djen/qualidade retorna mÃ©tricas de qualidade do rollout."""
        resp = auth_client.get("/api/v1/djen/qualidade")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert "total_publicacoes" in data
        assert "taxa_vinculo_percent" in data
        assert "decisoes_por_acao" in data

    def test_mesclar_sem_autenticacao(self, client, db):
        resp = client.post("/api/v1/djen/triagem/1/mesclar", json={"caso_id": 1})
        assert resp.status_code == 401

    def test_ignorar_sem_autenticacao(self, client, db):
        resp = client.post("/api/v1/djen/triagem/1/ignorar", json={})
        assert resp.status_code == 401

    def test_qualidade_sem_autenticacao(self, client, db):
        resp = client.get("/api/v1/djen/qualidade")
        assert resp.status_code == 401
