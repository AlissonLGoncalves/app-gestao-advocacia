# Arquivo: tests/test_casos_api.py
# Testes para as rotas da API de Casos.

import json
from datetime import date, datetime
from io import BytesIO
from unittest.mock import patch

from app import Caso
from models import MovimentacaoCNJ, PublicacaoDJEN

CASO_BASE = {
    "titulo": "Caso Teste Inicial",
    "status": "Ativo",
    "tipo_acao": "CÃ­vel",
    "valor_causa": "10000.00",
    "data_distribuicao": date.today().isoformat(),
}


def criar_cliente_teste(auth_client):
    payload = {
        "nome_razao_social": "Cliente Para Casos Teste",
        "cpf_cnpj": "111.222.333-44",
        "tipo_pessoa": "PF",
        "email": "cliente.casos@teste.com",
    }
    response = auth_client.post("/api/v1/clientes", json=payload)
    assert response.status_code == 201, response.data
    return json.loads(response.data)["id"]


def test_get_casos_lista_vazia(auth_client, db):
    response = auth_client.get("/api/v1/casos")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_get_casos_filtra_por_busca_e_cliente(auth_client, db):
    cliente_a = criar_cliente_teste(auth_client)
    cliente_b_payload = {
        "nome_razao_social": "Outro Cliente Para Casos",
        "cpf_cnpj": "555.666.777-88",
        "tipo_pessoa": "PF",
        "email": "outro.cliente@teste.com",
    }
    cliente_b_resp = auth_client.post("/api/v1/clientes", json=cliente_b_payload)
    assert cliente_b_resp.status_code == 201, cliente_b_resp.data
    cliente_b = json.loads(cliente_b_resp.data)["id"]

    caso_a = {
        **CASO_BASE,
        "cliente_id": cliente_a,
        "titulo": "Execução Banco Alfa",
        "numero_processo": "0001111-22.2026.8.16.0001",
        "parte_contraria": "Banco Alfa SA",
    }
    caso_b = {
        **CASO_BASE,
        "cliente_id": cliente_b,
        "titulo": "Cobrança Empresa Beta",
        "numero_processo": "0002222-33.2026.8.16.0001",
        "parte_contraria": "Empresa Beta Ltda",
    }
    assert auth_client.post("/api/v1/casos", json=caso_a).status_code == 201
    assert auth_client.post("/api/v1/casos", json=caso_b).status_code == 201

    response_busca = auth_client.get("/api/v1/casos?search=Banco%20Alfa")
    assert response_busca.status_code == 200
    data_busca = json.loads(response_busca.data)
    assert len(data_busca) == 1
    assert data_busca[0]["titulo"] == "Execução Banco Alfa"

    response_cliente = auth_client.get(f"/api/v1/casos?cliente_id={cliente_b}")
    assert response_cliente.status_code == 200
    data_cliente = json.loads(response_cliente.data)
    assert len(data_cliente) == 1
    assert data_cliente[0]["cliente_id"] == cliente_b


def test_create_caso_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    payload = {**CASO_BASE, "cliente_id": cliente_id}

    response = auth_client.post("/api/v1/casos", json=payload)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data["cliente_id"] == cliente_id
    assert data["titulo"] == payload["titulo"]

    caso_db = db.session.get(Caso, data["id"])
    assert caso_db is not None


def test_create_caso_cliente_inexistente(auth_client, db):
    payload = {**CASO_BASE, "cliente_id": 99999}
    response = auth_client.post("/api/v1/casos", json=payload)
    assert response.status_code == 404


def test_create_caso_dados_incompletos(auth_client, db):
    response = auth_client.post("/api/v1/casos", json={"titulo": "Caso Incompleto"})
    assert response.status_code == 400


def test_get_caso_especifico_existente(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    payload = {**CASO_BASE, "cliente_id": cliente_id, "titulo": "Caso EspecÃ­fico"}
    res_post = auth_client.post("/api/v1/casos", json=payload)
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]

    response = auth_client.get(f"/api/v1/casos/{caso_id}")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["id"] == caso_id


def test_get_caso_especifico_nao_existente(auth_client, db):
    response = auth_client.get("/api/v1/casos/99999")
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "message" in data


def test_update_caso_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    res_post = auth_client.post("/api/v1/casos", json={**CASO_BASE, "cliente_id": cliente_id})
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]

    payload = {
        "titulo": "Caso Atualizado",
        "status": "Encerrado",
        "tipo_acao": "CÃ­vel",
        "notas_caso": "Atualizado via pytest",
    }
    response = auth_client.put(f"/api/v1/casos/{caso_id}", json=payload)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["titulo"] == payload["titulo"]


def test_delete_caso_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    res_post = auth_client.post("/api/v1/casos", json={**CASO_BASE, "cliente_id": cliente_id})
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]

    response_delete = auth_client.delete(f"/api/v1/casos/{caso_id}")
    assert response_delete.status_code == 204

    response_get = auth_client.get(f"/api/v1/casos/{caso_id}")
    assert response_get.status_code == 404


def test_leitura_peticao_sucesso(auth_client, db):
    with patch(
        "routes.casos.extract_case_data_from_file",
        return_value={
            "numero_processo": "0001234-12.2026.8.16.0001",
            "valor_causa": 1500.50,
            "titulo": "Ação de Cobrança",
            "resumo_fatos": "Resumo de teste.",
            "parte_contraria": "Empresa Ré Ltda",
            "vara_juizo": "2ª Vara Cível",
            "comarca": "Curitiba",
            "instancia": "1ª Instância",
            "tipo_acao": "Ação de Cobrança",
            "fase_processual": "Conhecimento",
            "data_distribuicao": "2022033018",
            "fonte": "AI Gemini",
        },
    ):
        response = auth_client.post(
            "/api/v1/casos/leitura-peticao",
            data={"documento": (BytesIO(b"%PDF-1.4"), "peticao.pdf")},
            content_type="multipart/form-data",
        )

    assert response.status_code == 200, response.data
    payload = json.loads(response.data)
    assert payload["dados"]["numero_processo"] == "0001234-12.2026.8.16.0001"
    assert payload["dados"]["valor_causa"] == 1500.50
    assert payload["dados"]["parte_contraria"] == "Empresa Ré Ltda"
    assert payload["dados"]["vara_juizo"] == "2ª Vara Cível"
    assert payload["dados"]["comarca"] == "Curitiba"
    assert payload["dados"]["data_distribuicao"] == "2022-03-30"


def test_atualizar_cnj_sem_novas_faz_backfill_quando_timeline_vazia(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    res_post = auth_client.post(
        "/api/v1/casos",
        json={
            **CASO_BASE,
            "cliente_id": cliente_id,
            "numero_processo": "0000704-42.2022.8.16.0124",
        },
    )
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]

    dados_cnj_mock = {
        "hits": {
            "hits": [
                {
                    "_source": {
                        "movimentos": [
                            {"nome": "Arquivado Definitivamente", "dataHora": "2024x-invalid"},
                            {"nome": "Baixa definitiva", "dataHora": "2023x-invalid"},
                        ]
                    }
                }
            ]
        }
    }

    with patch("routes.casos.consultar_processo_cnj", return_value=(dados_cnj_mock, 200)):
        response = auth_client.post(f"/api/v1/casos/{caso_id}/atualizar-cnj")

    assert response.status_code == 200, response.data
    payload = json.loads(response.data)
    assert payload["novas_movimentacoes_registradas"] == 0
    assert payload["movimentacoes_backfill_registradas"] == 2
    assert "histórico completo foi sincronizado" in payload["message"]

    movs = MovimentacaoCNJ.query.filter_by(caso_id=caso_id).all()
    assert len(movs) == 2

    caso_db = db.session.get(Caso, caso_id)
    assert caso_db.status == "Arquivado Definitivamente"
    assert caso_db.data_ultima_verificacao_cnj is not None


def test_atualizar_cnj_sem_novas_atualiza_status_para_ultimo_movimento(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    res_post = auth_client.post(
        "/api/v1/casos",
        json={
            **CASO_BASE,
            "cliente_id": cliente_id,
            "numero_processo": "0000704-42.2022.8.16.0124",
        },
    )
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]
    caso_db = db.session.get(Caso, caso_id)

    data_mais_recente = datetime.fromisoformat("2024-01-25T17:07:00")
    data_antiga = datetime.fromisoformat("2023-11-27T21:16:50")
    db.session.add_all(
        [
            MovimentacaoCNJ(
                tenant_id=caso_db.tenant_id,
                caso_id=caso_id,
                data_movimentacao=data_mais_recente,
                descricao="Definitivo",
                dados_integra_cnj={"nome": "Definitivo"},
            ),
            MovimentacaoCNJ(
                tenant_id=caso_db.tenant_id,
                caso_id=caso_id,
                data_movimentacao=data_antiga,
                descricao="Documento",
                dados_integra_cnj={"nome": "Documento"},
            ),
        ]
    )
    db.session.commit()

    dados_cnj_mock = {
        "hits": {
            "hits": [
                {
                    "_source": {
                        "movimentos": [
                            {"nome": "Definitivo", "dataHora": "2024-01-25T17:07:00.000Z"},
                            {"nome": "Documento", "dataHora": "2023-11-27T21:16:50.000Z"},
                        ]
                    }
                }
            ]
        }
    }

    with patch("routes.casos.consultar_processo_cnj", return_value=(dados_cnj_mock, 200)):
        response = auth_client.post(f"/api/v1/casos/{caso_id}/atualizar-cnj")

    assert response.status_code == 200, response.data
    payload = json.loads(response.data)
    assert payload["novas_movimentacoes_registradas"] == 0
    assert payload["movimentacoes_backfill_registradas"] == 0

    movs = MovimentacaoCNJ.query.filter_by(caso_id=caso_id).all()
    assert len(movs) == 2

    caso_atualizado = db.session.get(Caso, caso_id)
    assert caso_atualizado.status == "Definitivo"
    assert caso_atualizado.data_atualizacao == data_mais_recente


def test_gerar_resumo_caso_com_publicacoes_djen_persiste_descricao(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    res_post = auth_client.post(
        "/api/v1/casos",
        json={
            **CASO_BASE,
            "cliente_id": cliente_id,
            "numero_processo": "0000704-42.2022.8.16.0124",
            "descricao": "",
        },
    )
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]
    caso_db = db.session.get(Caso, caso_id)

    db.session.add(
        PublicacaoDJEN(
            tenant_id=caso_db.tenant_id,
            user_id=caso_db.user_id,
            caso_id=caso_id,
            data_disponibilizacao=date(2026, 5, 1),
            tipo_comunicacao="Intimação",
            texto="Intima-se a parte autora para manifestação em 15 dias sobre o laudo pericial.",
            sigla_tribunal="TJPR",
            nome_orgao="2ª Vara Cível de Curitiba",
        )
    )
    db.session.commit()

    resumo_gerado = (
        "Ação cível com intimação recente para manifestação da parte autora sobre laudo pericial, "
        "no prazo de 15 dias, perante a 2ª Vara Cível de Curitiba. Próximo passo: preparar petição de resposta."
    )

    class FakeResponse:
        text = resumo_gerado

    class FakeModels:
        def __init__(self):
            self.calls = []

        def generate_content(self, model, contents):
            self.calls.append({"model": model, "contents": contents})
            return FakeResponse()

    class FakeClient:
        def __init__(self):
            self.models = FakeModels()

    fake_client = FakeClient()

    with patch("routes.casos.gemini_is_enabled", return_value=True):
        with patch("routes.casos.get_gemini_client", return_value=fake_client):
            response = auth_client.post(f"/api/v1/casos/{caso_id}/gerar-resumo")

    assert response.status_code == 200, response.data
    payload = json.loads(response.data)
    assert payload["resumo"] == resumo_gerado
    assert "Resumo gerado e salvo" in payload["message"]
    assert fake_client.models.calls[0]["model"] == "gemini-2.5-flash"
    assert "REGRAS OBRIGATÓRIAS" in fake_client.models.calls[0]["contents"]
    assert "Publicações DJEN" in fake_client.models.calls[0]["contents"]
    assert "laudo pericial" in fake_client.models.calls[0]["contents"]

    caso_atualizado = db.session.get(Caso, caso_id)
    assert caso_atualizado.descricao == resumo_gerado
