"""Testes para a politica de forca de senha e expiracao de convite."""

from utils.password_policy import validar_forca_senha


class TestValidarForcaSenha:
    """Testes unitarios para validar_forca_senha."""

    def test_senha_curta_retorna_400(self):
        ok, msg = validar_forca_senha("Ab1")
        assert not ok
        assert "10 caracteres" in msg

    def test_senha_sem_maiuscula_retorna_400(self):
        ok, msg = validar_forca_senha("senhafraca1234")
        assert not ok
        assert msg is not None

    def test_senha_sem_minuscula_retorna_400(self):
        ok, msg = validar_forca_senha("SENHAFORTE1234")
        assert not ok
        assert msg is not None

    def test_senha_sem_numero_retorna_400(self):
        ok, msg = validar_forca_senha("SenhaForteABC")
        assert not ok
        assert msg is not None

    def test_senha_forte_aceita(self):
        ok, msg = validar_forca_senha("Senha1234!")
        assert ok
        assert msg is None

    def test_senha_exatamente_10_chars_aceita(self):
        ok, msg = validar_forca_senha("Abcdefgh1!")
        assert ok

    def test_senha_9_chars_rejeitada(self):
        ok, msg = validar_forca_senha("Abcdefg1!")
        assert not ok


class TestPasswordPolicyIntegracao:
    """Testes de integracao: POST /register com senhas fracas deve retornar 400."""

    def test_senha_curta_retorna_400(self, client, db):
        resp = client.post(
            "/api/v1/auth/register",
            json={
                "username": "userfraco",
                "email": "fraco@test.com",
                "password": "Ab1",
                "role": "admin",
                "aceite_termos": True,
                "aceite_lgpd": True,
                "versao_termos": "v1.0",
                "versao_lgpd": "v1.0",
            },
        )
        assert resp.status_code == 400
        assert "10 caracteres" in resp.get_json()["message"]

    def test_senha_sem_maiuscula_retorna_400(self, client, db):
        resp = client.post(
            "/api/v1/auth/register",
            json={
                "username": "usersemmai",
                "email": "semmai@test.com",
                "password": "senhafraca1234",
                "role": "admin",
                "aceite_termos": True,
                "aceite_lgpd": True,
                "versao_termos": "v1.0",
                "versao_lgpd": "v1.0",
            },
        )
        assert resp.status_code == 400

    def test_senha_sem_numero_retorna_400(self, client, db):
        resp = client.post(
            "/api/v1/auth/register",
            json={
                "username": "usersemnum",
                "email": "semnum@test.com",
                "password": "SenhaForteSemNumero",
                "role": "admin",
                "aceite_termos": True,
                "aceite_lgpd": True,
                "versao_termos": "v1.0",
                "versao_lgpd": "v1.0",
            },
        )
        assert resp.status_code == 400

    def test_senha_forte_aceita(self, client, db):
        resp = client.post(
            "/api/v1/auth/register",
            json={
                "username": "userpolitica",
                "email": "politica@test.com",
                "password": "Senha1234!",
                "role": "admin",
                "aceite_termos": True,
                "aceite_lgpd": True,
                "versao_termos": "v1.0",
                "versao_lgpd": "v1.0",
            },
        )
        assert resp.status_code == 201

    def test_register_invite_senha_fraca_retorna_400(self, client, db):
        """Senha fraca no register-invite tambem deve retornar 400."""
        resp = client.post(
            "/api/v1/auth/register-invite",
            json={
                "invite_token": "token_invalido",
                "username": "convidado",
                "password": "fraca",
                "aceite_termos": True,
                "aceite_lgpd": True,
                "versao_termos": "v1.0",
                "versao_lgpd": "v1.0",
            },
        )
        # Senha fraca retorna 400 antes de decodificar o token
        assert resp.status_code == 400
        assert "10 caracteres" in resp.get_json()["message"]
