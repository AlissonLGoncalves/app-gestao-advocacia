import os
from datetime import timedelta

from flask import current_app, request
from flask_jwt_extended import create_access_token, decode_token, get_jwt_identity, jwt_required
from flask_restx import Resource
from jwt.exceptions import DecodeError, ExpiredSignatureError

from extensions import db
from mail_service import enviar_alerta_email
from models import ConsentimentoUsuario, LoginAudit, Tenant, User

TIPOS_CONSENTIMENTO_OBRIGATORIOS = ("termos_uso", "lgpd")


def _ip_request_atual(req):
    return req.headers.get("X-Forwarded-For", req.remote_addr or "").split(",")[0].strip()


def _user_agent_request_atual(req):
    return (req.headers.get("User-Agent") or "")[:500]


def _registrar_login_audit(*, user_id, email_tentativa, sucesso, motivo_falha=None):
    db.session.add(
        LoginAudit(
            user_id=user_id,
            email_tentativa=(email_tentativa or "")[:120],
            sucesso=sucesso,
            ip=_ip_request_atual(request),
            user_agent=_user_agent_request_atual(request),
            motivo_falha=motivo_falha,
        )
    )
    db.session.commit()


def _registrar_consentimentos(user, data):
    """Valida aceites e persiste ConsentimentoUsuario. Retorna (ok, error_response_tuple)."""
    if not data.get("aceite_termos"):
        return False, ({"message": "É obrigatório aceitar os Termos de Uso."}, 400)
    if not data.get("aceite_lgpd"):
        return False, ({"message": "É obrigatório aceitar a Política de Privacidade (LGPD)."}, 400)
    versao_termos = data.get("versao_termos")
    versao_lgpd = data.get("versao_lgpd")
    if not versao_termos or not versao_lgpd:
        return False, ({"message": "Versão dos Termos/LGPD é obrigatória."}, 400)

    from flask import request as _req

    ip = _ip_request_atual(_req)
    ua = _user_agent_request_atual(_req)

    db.session.add(
        ConsentimentoUsuario(
            user_id=user.id,
            tipo="termos_uso",
            versao=versao_termos,
            ip=ip,
            user_agent=ua,
            hash_documento=data.get("hash_termos_uso"),
        )
    )
    db.session.add(
        ConsentimentoUsuario(
            user_id=user.id,
            tipo="lgpd",
            versao=versao_lgpd,
            ip=ip,
            user_agent=ua,
            hash_documento=data.get("hash_lgpd"),
        )
    )
    return True, None


def register_auth_routes(
    app,
    auth_ns,
    user_model_dto,
    user_invite_dto,
    user_register_invite_dto,
    login_model_dto,
    token_model_dto,
    user_output_model_dto,
):
    @auth_ns.route("/register")
    class UserRegister(Resource):
        @auth_ns.expect(user_model_dto)
        @auth_ns.response(201, "Usuário registrado com sucesso.")
        @auth_ns.response(400, "Dados de entrada inválidos.")
        @auth_ns.response(409, "Nome de usuário ou email já existem.")
        def post(self):
            data = request.get_json()
            username = data.get("username")
            email = data.get("email")
            password = data.get("password")
            role = data.get("role", "admin")
            documento = data.get("documento_identificacao")

            if role not in ["admin", "advogado", "assistente"]:
                return {"message": "Role deve ser admin, advogado ou assistente."}, 400

            if not username or not email or not password:
                return {
                    "message": "Todos os campos (username, email, password) são obrigatórios."
                }, 400
            if len(password) < 6:
                return {"message": "A senha deve ter no mínimo 6 caracteres."}, 400

            if User.query.filter_by(username=username).first():
                return {"message": "Nome de usuário já cadastrado."}, 409
            if User.query.filter_by(email=email).first():
                return {"message": "Email já cadastrado."}, 409

            # Se for 'admin', significa que é uma criação de NOVO Escritório (Tenant)
            novo_tenant = None
            if role == "admin":
                novo_tenant = Tenant(nome_escritorio=username, documento=documento)
                db.session.add(novo_tenant)
                db.session.flush()  # Força injeção do ID pro Tenant para atrelar abaixo

            # Cria o Super-User
            new_user = User(
                username=username,
                email=email,
                role=role,
                tenant_id=novo_tenant.id if novo_tenant else None,
            )
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.flush()

            ok, err = _registrar_consentimentos(new_user, data)
            if not ok:
                db.session.rollback()
                return err

            db.session.commit()

            app.logger.info(
                f"Novo Tenant/Escritório registrado: {username} (Logado pelo Master admin ID: {new_user.id})"
            )
            return {
                "message": "Ambiente de Escritório criado com sucesso! Faça login para gerenciar sua assinatura."
            }, 201

    @auth_ns.route("/invite")
    class UserInvite(Resource):
        @auth_ns.expect(user_invite_dto)
        @jwt_required()
        def post(self):
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role != "admin":
                return {"message": "Apenas o Admin do escritório pode convidar novos membros."}, 403

            data = request.get_json()
            email_convidado = data.get("email")
            papel = data.get("role", "advogado")
            if not email_convidado:
                return {"message": "Email do convidado é obrigatório."}, 400

            # Gera um token JWT especial pra invite atrelado ao Tenant do Admin
            invite_token = create_access_token(
                identity="invite",
                additional_claims={
                    "is_invite": True,
                    "invite_email": email_convidado,
                    "invite_role": papel,
                    "invite_tenant_id": user.tenant_id,
                    "escritorio_nome": user.tenant.nome_escritorio if user.tenant else "Escritório",
                },
                expires_delta=timedelta(days=7),  # 7 dias pra expirar
            )

            base_url = request.host_url
            if "localhost" in base_url or "127.0.0.1" in base_url:
                base_url = "http://localhost:5173/"
            else:
                base_url = os.environ.get(
                    "FRONTEND_URL", "https://app-gestao-advocacia.vercel.app/"
                )

            link = f"{base_url.rstrip('/')}/register?invite_token={invite_token}"

            corpo_email = f"""
            <h3>Você foi convidado para o Patronus!</h3>
            <p>O administrador do escritório <strong>{user.tenant.nome_escritorio if user.tenant else 'Jurídico'}</strong> convidou você para se juntar à equipe como <strong>{papel}</strong>.</p>
            <br>
            <p><a href='{link}' style='padding: 10px 20px; background-color: #0f172a; color: white; text-decoration: none; border-radius: 5px;'>Aceitar Convite e Cadastrar</a></p>
            <br>
            <p>Se o botão não funcionar, copie e cole o link: {link}</p>
            """

            enviar_alerta_email(
                current_app,
                email_convidado,
                f"Convite para o portal Patronus - {user.tenant.nome_escritorio if user.tenant else 'Escritório'}",
                corpo_email,
            )

            return {"message": "Convite disparado com sucesso!", "link_simulado": link}, 200

    @auth_ns.route("/register-invite")
    class RegisterInvite(Resource):
        @auth_ns.expect(user_register_invite_dto)
        def post(self):
            data = request.get_json()
            token = data.get("invite_token")
            username = data.get("username")
            password = data.get("password")

            if not token or not username or not password:
                return {"message": "Dados incompletos."}, 400

            try:
                decoded = decode_token(token)
                if not decoded.get("is_invite"):
                    return {"message": "Token inválido para convite."}, 400

                invite_email = decoded.get("invite_email")
                invite_role = decoded.get("invite_role")
                invite_tenant_id = decoded.get("invite_tenant_id")

                if (
                    User.query.filter_by(email=invite_email).first()
                    or User.query.filter_by(username=username).first()
                ):
                    return {"message": "Usuário ou email já está em uso no sistema."}, 409

                new_user = User(
                    username=username,
                    email=invite_email,
                    role=invite_role,
                    tenant_id=invite_tenant_id,
                )
                new_user.set_password(password)
                db.session.add(new_user)
                db.session.flush()

                ok, err = _registrar_consentimentos(new_user, data)
                if not ok:
                    db.session.rollback()
                    return err

                db.session.commit()

                app.logger.info(
                    f"Novo usuário entrou via CONVITE: {username} (Logado no Tenant ID: {invite_tenant_id})"
                )
                return {"message": "Registro corporativo finalizado com sucesso! Faça login."}, 201
            except ExpiredSignatureError:
                return {"message": "Token de convite expirado."}, 400
            except DecodeError:
                return {"message": "Token de convite inválido ou corrompido."}, 400
            except Exception as e:
                app.logger.error(f"Falha na validação do link mágico: {str(e)}")
                return {"message": "Falha na validação do link de convite."}, 400

    @auth_ns.route("/login")
    class UserLogin(Resource):
        @auth_ns.expect(login_model_dto)
        @auth_ns.marshal_with(token_model_dto)
        @auth_ns.response(401, "Credenciais inválidas.")
        def post(self):
            data = request.get_json()
            username_or_email = data.get("username_or_email")
            password = data.get("password")

            user = User.query.filter(
                (User.username == username_or_email) | (User.email == username_or_email)
            ).first()

            if user and user.check_password(password):
                expires = timedelta(days=app.config.get("JWT_ACCESS_TOKEN_EXPIRES_DAYS", 1))
                access_token = create_access_token(
                    identity=str(user.id),
                    additional_claims={"role": user.role},
                    expires_delta=expires,
                )
                _registrar_login_audit(
                    user_id=user.id,
                    email_tentativa=username_or_email,
                    sucesso=True,
                    motivo_falha=None,
                )
                app.logger.info(
                    "login_success",
                    extra={
                        "event": "login_success",
                        "user_id": user.id,
                        "tenant_id": user.tenant_id,
                    },
                )
                return {"access_token": access_token, "user": user.to_dict()}, 200

            motivo = "user_not_found" if not user else "invalid_credentials"
            _registrar_login_audit(
                user_id=user.id if user else None,
                email_tentativa=username_or_email,
                sucesso=False,
                motivo_falha=motivo,
            )
            app.logger.warning(
                "login_failed",
                extra={
                    "event": "login_failed",
                    "email": username_or_email,
                    "reason": motivo,
                },
            )
            return {"message": "Nome de usuário/email ou senha inválidos."}, 401

    @auth_ns.route("/me")
    class UserMe(Resource):
        @jwt_required()
        @auth_ns.marshal_with(user_output_model_dto)
        @auth_ns.doc(
            security="jsonWebToken",
            description="Retorna os dados do usuário atualmente autenticado.",
        )
        @auth_ns.response(404, "Usuário não encontrado.")
        def get(self):
            current_user_id = get_jwt_identity()
            user = db.session.get(User, current_user_id)
            if not user:
                app.logger.warning(
                    f"Tentativa de acesso /me com user ID {current_user_id} não encontrado no banco."
                )
                return {"message": "Usuário associado ao token não encontrado."}, 404
            return user, 200

    @auth_ns.route("/me/consentimentos")
    class MeConsentimentos(Resource):
        @jwt_required()
        @auth_ns.doc(
            security="jsonWebToken", description="Lista os consentimentos do usuário autenticado."
        )
        def get(self):
            user_id = get_jwt_identity()
            itens = (
                ConsentimentoUsuario.query.filter_by(user_id=user_id)
                .order_by(ConsentimentoUsuario.aceito_em.desc())
                .all()
            )
            return [
                {
                    "tipo": c.tipo,
                    "versao": c.versao,
                    "aceito_em": c.aceito_em.isoformat() if c.aceito_em else None,
                    "ip": c.ip,
                    "user_agent": c.user_agent,
                    "hash_documento": c.hash_documento,
                }
                for c in itens
            ], 200

    @auth_ns.route("/me/historico-login")
    class MeHistoricoLogin(Resource):
        @jwt_required()
        @auth_ns.doc(
            security="jsonWebToken",
            description="Lista os últimos acessos de login do usuário autenticado.",
        )
        def get(self):
            user_id = get_jwt_identity()
            limit_arg = request.args.get("limit", default=50, type=int)
            limit = max(1, min(limit_arg or 50, 200))

            registros = (
                LoginAudit.query.filter_by(user_id=user_id)
                .order_by(LoginAudit.criado_em.desc())
                .limit(limit)
                .all()
            )

            return [r.to_dict() for r in registros], 200
