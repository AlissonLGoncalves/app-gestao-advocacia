"""Testes de expiracao do token de convite."""

from datetime import timedelta

from flask_jwt_extended import create_access_token
from freezegun import freeze_time


class TestInviteExpiration:
    """Testa que tokens de convite com mais de 48h sao rejeitados."""

    def test_invite_apos_48h_retorna_400(self, client, db, app):
        """Token gerado ha 49h deve ser rejeitado com 400."""
        with app.app_context():
            with freeze_time("2026-04-01 10:00:00"):
                expired_token = create_access_token(
                    identity="invite",
                    additional_claims={
                        "is_invite": True,
                        "invite_email": "convidado@test.com",
                        "invite_role": "advogado",
                        "invite_tenant_id": 1,
                    },
                    expires_delta=timedelta(hours=48),
                )

            # Avanca 49 horas apos a criacao do token
            with freeze_time("2026-04-03 11:00:00"):
                resp = client.post(
                    "/api/v1/auth/register-invite",
                    json={
                        "invite_token": expired_token,
                        "username": "convidado_expirado",
                        "password": "Senha1234!",
                        "aceite_termos": True,
                        "aceite_lgpd": True,
                        "versao_termos": "v1.0",
                        "versao_lgpd": "v1.0",
                    },
                )
        assert resp.status_code == 400
        assert "expirado" in resp.get_json()["message"].lower()

    def test_invite_dentro_48h_aceita(self, client, db, app):
        """Token gerado ha 24h ainda deve ser aceito."""
        with app.app_context():
            with freeze_time("2026-04-01 10:00:00"):
                valid_token = create_access_token(
                    identity="invite",
                    additional_claims={
                        "is_invite": True,
                        "invite_email": "convidado_valido@test.com",
                        "invite_role": "advogado",
                        "invite_tenant_id": 999,
                    },
                    expires_delta=timedelta(hours=48),
                )

            # Apenas 24h depois - ainda dentro da janela
            with freeze_time("2026-04-02 10:00:00"):
                resp = client.post(
                    "/api/v1/auth/register-invite",
                    json={
                        "invite_token": valid_token,
                        "username": "convidado_valido",
                        "password": "Senha1234!",
                        "aceite_termos": True,
                        "aceite_lgpd": True,
                        "versao_termos": "v1.0",
                        "versao_lgpd": "v1.0",
                    },
                )
        # tenant_id=999 nao existe, mas o token eh valido - vai criar o user
        # (ou 409 se email ja existir, mas nunca 400 por expirado)
        assert resp.status_code in (201, 409)
        if resp.status_code == 400:
            assert "expirado" not in resp.get_json()["message"].lower()
