import json
from datetime import date

from app import Caso, Cliente, PublicacaoDJEN


def _criar_publicacao(app, db, username="testuser", djen_id=12001, numero_processo=None):
    with app.app_context():
        from app import User

        user = User.query.filter_by(username=username).first()
        pub = PublicacaoDJEN(
            tenant_id=user.tenant_id,
            user_id=user.id,
            djen_id=djen_id,
            hash_comunicacao=f"hash-f2-{djen_id}",
            numero_processo=numero_processo,
            sigla_tribunal="TJPR",
            nome_orgao="2a Vara Civel de Cornelio Procopio",
            tipo_comunicacao="Intimacao",
            data_disponibilizacao=date.today(),
            texto=(
                "PODER JUDICIARIO DO ESTADO DO PARANA COMARCA DE CORNELIO PROCOPIO\n"
                "Processo: 0000472-75.2025.8.16.0075\n"
                "Classe Processual: Procedimento Comum Civel\n"
                "Assunto Principal: Praticas Abusivas\n"
                "Valor da Causa: R$150.000,00\n"
                "Autor(s): DIRCE DE OLIVEIRA PEDOTTI\n"
                "Reu(s): Banco do Brasil S/A"
            ),
            origem_busca="oab",
            lida=False,
        )
        db.session.add(pub)
        db.session.commit()
        return pub.id


def _payload_criar(numero_processo="0000472-75.2025.8.16.0075", cliente_id=None):
    return {
        "cliente_id": cliente_id,
        "cliente_payload": (
            None
            if cliente_id
            else {
                "nome_razao_social": "DIRCE DE OLIVEIRA PEDOTTI",
                "tipo_pessoa": "PF",
                "cpf_cnpj": None,
                "email": "dirce@example.com",
            }
        ),
        "papel_cliente": "autor",
        "caso_payload": {
            "titulo": f"Processo {numero_processo}",
            "numero_processo": numero_processo,
            "tipo_acao": "Procedimento Comum Civel",
            "vara_juizo": "2a Vara Civel de Cornelio Procopio",
            "comarca": "Cornelio Procopio",
            "valor_causa": 150000.0,
            "parte_contraria": "Banco do Brasil S/A",
            "notas_caso": "Criado via triagem DJEN",
        },
    }


class TestDjenRoutesTriagem:
    def test_criar_cliente_novo_e_caso(self, auth_client, app, db):
        pub_id = _criar_publicacao(app, db, djen_id=12001, numero_processo=None)

        resp = auth_client.post(
            f"/api/v1/djen/triagem/{pub_id}/criar-cliente-caso",
            json=_payload_criar(numero_processo="0001111-22.2025.8.16.0001"),
        )
        assert resp.status_code == 201
        payload = json.loads(resp.data)

        assert payload["cliente_criado"] is True
        assert payload["caso_criado"] is True
        assert payload["publicacao"]["lida"] is True
        assert payload["publicacao"]["caso_id"] == payload["caso"]["id"]

    def test_criar_com_cliente_existente(self, auth_client, app, db):
        pub_id = _criar_publicacao(app, db, djen_id=12002, numero_processo=None)
        cliente_id = None

        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            cliente = Cliente(
                tenant_id=user.tenant_id,
                user_id=user.id,
                nome_razao_social="Cliente Existente",
                tipo_pessoa="PF",
                cpf_cnpj="12345678901",
            )
            db.session.add(cliente)
            db.session.commit()
            cliente_id = cliente.id

        resp = auth_client.post(
            f"/api/v1/djen/triagem/{pub_id}/criar-cliente-caso",
            json=_payload_criar(numero_processo="0002222-33.2025.8.16.0001", cliente_id=cliente_id),
        )
        assert resp.status_code == 201
        payload = json.loads(resp.data)
        assert payload["cliente"]["id"] == cliente_id
        assert payload["cliente_criado"] is False

    def test_numero_processo_duplicado_retorna_409(self, auth_client, app, db):
        numero = "0003333-44.2025.8.16.0001"
        pub_id = _criar_publicacao(app, db, djen_id=12003, numero_processo=None)

        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            cliente = Cliente(
                tenant_id=user.tenant_id,
                user_id=user.id,
                nome_razao_social="Cliente Dup",
                tipo_pessoa="PF",
                cpf_cnpj="00999888777",
            )
            db.session.add(cliente)
            db.session.flush()
            caso = Caso(
                tenant_id=user.tenant_id,
                user_id=user.id,
                cliente_id=cliente.id,
                titulo="Caso já existente",
                numero_processo=numero,
                status="Ativo",
            )
            db.session.add(caso)
            db.session.commit()

        resp = auth_client.post(
            f"/api/v1/djen/triagem/{pub_id}/criar-cliente-caso",
            json=_payload_criar(numero_processo=numero),
        )
        assert resp.status_code == 409
        payload = json.loads(resp.data)
        assert payload["caso_existente"]["numero_processo"] == numero

    def test_vincular_caso_existente(self, auth_client, app, db):
        pub_id = _criar_publicacao(
            app, db, djen_id=12004, numero_processo="0004444-55.2025.8.16.0001"
        )
        caso_id = None

        with app.app_context():
            from app import User

            user = User.query.filter_by(username="testuser").first()
            cliente = Cliente(
                tenant_id=user.tenant_id,
                user_id=user.id,
                nome_razao_social="Cliente Vinculo",
                tipo_pessoa="PF",
                cpf_cnpj="88777666555",
            )
            db.session.add(cliente)
            db.session.flush()
            caso = Caso(
                tenant_id=user.tenant_id,
                user_id=user.id,
                cliente_id=cliente.id,
                titulo="Caso para vincular",
                numero_processo="0004444-55.2025.8.16.0001",
                status="Ativo",
            )
            db.session.add(caso)
            db.session.commit()
            caso_id = caso.id

        resp = auth_client.post(
            f"/api/v1/djen/triagem/{pub_id}/vincular-caso",
            json={"caso_id": caso_id},
        )
        assert resp.status_code == 200
        payload = json.loads(resp.data)
        assert payload["publicacao"]["caso_id"] == caso_id
        assert payload["publicacao"]["lida"] is True

    def test_tenant_isolation_vincular_caso_outro_tenant(self, client, app, db):
        # Tenant A
        client.post(
            "/api/v1/auth/register",
            json={
                "username": "triagem_a",
                "email": "triagem_a@test.com",
                "password": "Senha1234!",
                "role": "admin",
            },
        )
        token_a = json.loads(
            client.post(
                "/api/v1/auth/login",
                json={"username_or_email": "triagem_a", "password": "Senha1234!"},
            ).data
        )["access_token"]

        # Tenant B
        client.post(
            "/api/v1/auth/register",
            json={
                "username": "triagem_b",
                "email": "triagem_b@test.com",
                "password": "Senha1234!",
                "role": "admin",
            },
        )
        token_b = json.loads(
            client.post(
                "/api/v1/auth/login",
                json={"username_or_email": "triagem_b", "password": "Senha1234!"},
            ).data
        )["access_token"]

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        pub_id_b = None
        caso_id_a = None
        with app.app_context():
            from app import User

            user_a = User.query.filter_by(username="triagem_a").first()
            user_b = User.query.filter_by(username="triagem_b").first()

            cliente_a = Cliente(
                tenant_id=user_a.tenant_id,
                user_id=user_a.id,
                nome_razao_social="Cliente A",
                tipo_pessoa="PF",
                cpf_cnpj="12312312312",
            )
            db.session.add(cliente_a)
            db.session.flush()

            caso_a = Caso(
                tenant_id=user_a.tenant_id,
                user_id=user_a.id,
                cliente_id=cliente_a.id,
                titulo="Caso A",
                numero_processo="0009999-88.2025.8.16.0001",
                status="Ativo",
            )
            db.session.add(caso_a)
            db.session.flush()
            caso_id_a = caso_a.id

            pub_b = PublicacaoDJEN(
                tenant_id=user_b.tenant_id,
                user_id=user_b.id,
                djen_id=12999,
                hash_comunicacao="hash-f2-isolation",
                numero_processo="0008888-77.2025.8.16.0001",
                sigla_tribunal="TJPR",
                tipo_comunicacao="Intimacao",
                data_disponibilizacao=date.today(),
                texto="Autor(s): Pessoa B Reu(s): Empresa B",
                origem_busca="oab",
                lida=False,
            )
            db.session.add(pub_b)
            db.session.commit()
            pub_id_b = pub_b.id

        # B tenta vincular publicação de B em caso de A -> bloqueado
        resp = client.post(
            f"/api/v1/djen/triagem/{pub_id_b}/vincular-caso",
            json={"caso_id": caso_id_a},
            headers=headers_b,
        )
        assert resp.status_code in (403, 404)

        # Sanidade: A não pode mexer na publicação de B
        resp_cross = client.post(
            f"/api/v1/djen/triagem/{pub_id_b}/vincular-caso",
            json={"caso_id": caso_id_a},
            headers=headers_a,
        )
        assert resp_cross.status_code in (403, 404)
