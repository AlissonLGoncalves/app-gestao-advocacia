import io
import json
from unittest.mock import patch

from app import ProcuracaoAnalise, User, db


def _register_and_login(client, suffix):
    username = f"proc_{suffix}"
    email = f"proc_{suffix}@example.com"
    password = "Senha1234!"

    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg.status_code == 201, reg.data

    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": password},
    )
    assert login.status_code == 200, login.data
    data = json.loads(login.data)
    with client.application.app_context():
        user = db.session.get(User, data["user"]["id"])
        data["user"]["tenant_id"] = user.tenant_id
    return data["access_token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _fake_dados():
    return {
        "outorgante": {
            "nome_completo": "Maria da Silva",
            "cpf_cnpj": "529.982.247-25",
            "tipo_pessoa": "PF",
            "nacionalidade": "Brasileira",
            "estado_civil": "Solteira",
            "profissao": "Analista",
            "rg": "1234567",
            "endereco": {
                "logradouro": "Rua A",
                "numero": "100",
                "complemento": "",
                "bairro": "Centro",
                "cidade": "Curitiba",
                "uf": "PR",
                "cep": "80000-000",
            },
            "telefone": "41999998888",
            "email": "maria@example.com",
        },
        "outorgado": {"nome": "advogado_teste", "oab": "12345", "uf_oab": "PR"},
        "processo": {
            "numero_cnj": "0001234-12.2026.8.16.0001",
            "tribunal": "TJPR",
            "vara": "1a Vara Civel",
        },
        "objeto_procuracao": "Representação judicial ampla.",
    }


def test_upload_sem_autenticacao_retorna_401(client, app, tmp_path):
    app.config["PROCURACOES_UPLOAD_ROOT"] = str(tmp_path)
    response = client.post(
        "/api/v1/procuracoes/analisar",
        data={"arquivo": (io.BytesIO(b"%PDF-1.4"), "proc.pdf", "application/pdf")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 401


def test_upload_pdf_valido_cria_analise(auth_client, app, tmp_path):
    app.config["PROCURACOES_UPLOAD_ROOT"] = str(tmp_path)
    with patch("routes.procuracoes.extrair_dados_procuracao", return_value=_fake_dados()):
        response = auth_client.post(
            "/api/v1/procuracoes/analisar",
            data={"arquivo": (io.BytesIO(b"%PDF-1.4"), "proc.pdf", "application/pdf")},
            content_type="multipart/form-data",
        )

    assert response.status_code == 201, response.data
    payload = json.loads(response.data)
    assert payload["status"] == "done"
    assert payload["dados_extraidos"]["outorgante"]["nome_completo"] == "Maria da Silva"


def test_upload_mime_invalido_retorna_400(auth_client, app, tmp_path):
    app.config["PROCURACOES_UPLOAD_ROOT"] = str(tmp_path)
    response = auth_client.post(
        "/api/v1/procuracoes/analisar",
        data={"arquivo": (io.BytesIO(b"abc"), "proc.txt", "text/plain")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_upload_acima_10mb_retorna_413(auth_client, app, tmp_path):
    app.config["PROCURACOES_UPLOAD_ROOT"] = str(tmp_path)
    big_payload = b"x" * (10 * 1024 * 1024 + 1)
    response = auth_client.post(
        "/api/v1/procuracoes/analisar",
        data={"arquivo": (io.BytesIO(big_payload), "proc.pdf", "application/pdf")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 413


def test_get_procuracao_outro_tenant_retorna_403(client, app, tmp_path):
    app.config["PROCURACOES_UPLOAD_ROOT"] = str(tmp_path)
    token_a, user_a = _register_and_login(client, "a")
    token_b, user_b = _register_and_login(client, "b")

    with app.app_context():
        analise = ProcuracaoAnalise(
            tenant_id=user_a["tenant_id"],
            user_id=user_a["id"],
            arquivo_path=str(tmp_path / "a.pdf"),
            arquivo_hash="a" * 64,
            status="done",
            dados_extraidos=_fake_dados(),
        )
        db.session.add(analise)
        db.session.commit()
        analise_id = analise.id

    response = client.get(f"/api/v1/procuracoes/{analise_id}", headers=_headers(token_b))
    assert response.status_code == 403
    assert user_b["tenant_id"] != user_a["tenant_id"]


def test_gemini_falha_marca_status_failed(auth_client, app, tmp_path):
    app.config["PROCURACOES_UPLOAD_ROOT"] = str(tmp_path)
    with patch(
        "routes.procuracoes.extrair_dados_procuracao", side_effect=RuntimeError("Gemini off")
    ):
        response = auth_client.post(
            "/api/v1/procuracoes/analisar",
            data={"arquivo": (io.BytesIO(b"%PDF-1.4"), "proc.pdf", "application/pdf")},
            content_type="multipart/form-data",
        )

    assert response.status_code == 500
    payload = json.loads(response.data)
    assert payload["status"] == "failed"

    with app.app_context():
        analise = db.session.get(ProcuracaoAnalise, payload["id"])
        assert analise is not None
        assert analise.status == "failed"
        assert "Gemini off" in analise.erro


def test_extrair_dados_procuracao_com_client_fake(app):
    from procuracao_service import extrair_dados_procuracao

    class FakeUpload:
        pass

    class FakeFiles:
        def upload(self, file):
            return FakeUpload()

    class FakeResponse:
        text = json.dumps(_fake_dados())

    class FakeModels:
        def generate_content(self, model, contents):
            assert model == "gemini-2.0-flash-exp"
            assert len(contents) == 2
            return FakeResponse()

    class FakeClient:
        files = FakeFiles()
        models = FakeModels()

    with app.app_context():
        app.config["GEMINI_API_KEY"] = "fake-key"
        with patch("procuracao_service.get_gemini_client", return_value=FakeClient()):
            with patch("procuracao_service.get_jwt_identity", return_value=None):
                result = extrair_dados_procuracao(__file__, "application/pdf")

    assert result["outorgante"]["nome_completo"] == "Maria da Silva"
