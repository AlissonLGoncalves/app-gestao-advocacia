import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta
from pathlib import Path

from flask import current_app, request
from flask_jwt_extended import create_access_token, decode_token, get_jwt_identity, jwt_required
from flask_restx import Resource
from jwt.exceptions import DecodeError, ExpiredSignatureError

from extensions import db, limiter
from helpers.admin_session import admin_session
from mail_service import enviar_alerta_email, enviar_email
from models import ConsentimentoUsuario, LoginAudit, PasswordResetToken, Tenant, User
from utils.log_sanitizer import mask_email, mask_user_id
from utils.password_policy import validar_forca_senha

PASSWORD_RESET_TTL_MINUTES = 60
PASSWORD_RESET_TOKEN_BYTES = 32


def _hash_reset_token(token_plaintext: str) -> str:
    return hashlib.sha256(token_plaintext.encode("utf-8")).hexdigest()


def _frontend_base_url():
    """Resolve a URL base do frontend para montar o link de reset.

    Em dev (request vindo de localhost) usa o Vite (5173). Em prod usa
    FRONTEND_URL ou o fallback Vercel.
    """
    host = (request.host_url or "") if request else ""
    if "localhost" in host or "127.0.0.1" in host:
        return "http://localhost:5173/"
    return os.environ.get("FRONTEND_URL", "https://app-gestao-advocacia.vercel.app/")


def _montar_email_reset(nome_destinatario: str, link_reset: str, ttl_min: int):
    assunto = "Patronus — Redefinição de senha"
    nome = (nome_destinatario or "").strip() or "Olá"

    texto = (
        f"{nome},\n\n"
        f"Recebemos um pedido para redefinir a senha da sua conta no Patronus.\n\n"
        f"Para criar uma nova senha, acesse o link abaixo (válido por {ttl_min} minutos):\n"
        f"{link_reset}\n\n"
        f"Se você não solicitou essa alteração, pode ignorar este email com segurança — "
        f"sua senha atual continua valendo.\n\n"
        f"Por motivos de segurança, este link só pode ser usado uma vez.\n\n"
        f"— Equipe Patronus"
    )

    html = f"""<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,0.08);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid #e5e7eb;">
                <h1 style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">Patronus</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Redefinição de senha</h2>
                <p style="margin:0 0 16px;line-height:1.55;color:#374151;">
                  {nome}, recebemos um pedido para redefinir a senha da sua conta.
                </p>
                <p style="margin:0 0 24px;line-height:1.55;color:#374151;">
                  Para criar uma nova senha, clique no botão abaixo. Este link é válido por
                  <strong>{ttl_min} minutos</strong> e só pode ser usado uma vez.
                </p>
                <p style="margin:0 0 28px;text-align:center;">
                  <a href="{link_reset}"
                     style="display:inline-block;padding:12px 28px;background-color:#1e40af;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                    Redefinir minha senha
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
                  Se o botão não funcionar, copie e cole este endereço no seu navegador:
                </p>
                <p style="margin:0 0 24px;font-size:13px;color:#1e40af;word-break:break-all;">
                  {link_reset}
                </p>
                <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0;" />
                <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.55;">
                  Se você não solicitou essa alteração, ignore este email — sua senha atual
                  continua valendo. Nenhuma ação é necessária.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                  Este é um email automático. Não responda esta mensagem.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    return assunto, texto, html


TIPOS_CONSENTIMENTO_OBRIGATORIOS = ("termos_uso", "lgpd")
LEGAL_DIR = Path(__file__).resolve().parents[1] / "legal"
LEGAL_FILES = {
    "termos": LEGAL_DIR / "termos-v1.0.md",
    "lgpd": LEGAL_DIR / "lgpd-v1.0.md",
}


def _extrair_versao_front_matter(conteudo):
    lines = conteudo.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.lower().startswith("versao:"):
            return line.split(":", 1)[1].strip()
    return None


def _carregar_documento_legal(tipo):
    path = LEGAL_FILES[tipo]
    conteudo = path.read_text(encoding="utf-8")
    hash_sha256 = hashlib.sha256(conteudo.encode("utf-8")).hexdigest()
    versao = _extrair_versao_front_matter(conteudo) or "v1.0"
    return {"versao": versao, "hash": hash_sha256, "conteudo": conteudo}


def _ip_request_atual(req):
    return req.headers.get("X-Forwarded-For", req.remote_addr or "").split(",")[0].strip()


def _user_agent_request_atual(req):
    return (req.headers.get("User-Agent") or "")[:500]


def _registrar_login_audit(*, user_id, email_tentativa, sucesso, motivo_falha=None, tenant_id=None):
    """Persiste registro em login_audit via admin_session (Batch 4).

    Usa admin_session porque /auth/login e endpoints de reset rodam pre-
    autenticacao (sem tenant_id resolvido na sessao). app_admin tem
    BYPASSRLS, entao escreve mesmo com a policy restritiva ativa.

    tenant_id pode ser None para tentativas falhas em email inexistente —
    o registro fica invisivel para app_user (policy 'tenant_id =
    current_setting' exclui NULL), so admin_session ve.
    """
    ip = _ip_request_atual(request)
    ua = _user_agent_request_atual(request)
    with admin_session() as s:
        s.add(
            LoginAudit(
                tenant_id=tenant_id,
                user_id=user_id,
                email_tentativa=(email_tentativa or "")[:120],
                sucesso=sucesso,
                ip=ip,
                user_agent=ua,
                motivo_falha=motivo_falha,
            )
        )


def _somente_digitos(valor):
    return re.sub(r"\D", "", str(valor or ""))


def _formatar_cpf(cpf):
    digits = _somente_digitos(cpf)
    if len(digits) != 11:
        return None
    return f"{digits[0:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:11]}"


def _validar_cpf(cpf):
    digits = _somente_digitos(cpf)
    if len(digits) != 11 or digits == digits[0] * 11:
        return False

    soma_1 = sum(int(digits[i]) * (10 - i) for i in range(9))
    dig_1 = (soma_1 * 10) % 11
    dig_1 = 0 if dig_1 == 10 else dig_1

    soma_2 = sum(int(digits[i]) * (11 - i) for i in range(10))
    dig_2 = (soma_2 * 10) % 11
    dig_2 = 0 if dig_2 == 10 else dig_2

    return digits[-2:] == f"{dig_1}{dig_2}"


def _normalizar_tipo_pessoa(tipo_pessoa):
    if not tipo_pessoa:
        return None
    tipo = str(tipo_pessoa).strip().upper()
    if tipo not in {"PF", "PJ"}:
        return "INVALIDO"
    return tipo


def _normalizar_sigla_oab(sigla):
    if not sigla:
        return None
    val = re.sub(r"[^A-Za-z]", "", str(sigla)).upper()
    return val if len(val) == 2 else None


def _normalizar_dados_oab(numero_oab_raw, sigla_raw):
    if not numero_oab_raw:
        return None, _normalizar_sigla_oab(sigla_raw), None

    sigla = _normalizar_sigla_oab(sigla_raw)
    bruto = re.sub(r"[^0-9A-Za-z]", "", str(numero_oab_raw)).upper()
    match = re.fullmatch(r"([A-Z]{2})?([0-9]{4,12})([A-Z])?", bruto)
    if not match:
        return None, sigla, "Registro OAB inválido. Informe apenas números (4 a 12) e UF."

    uf_no_numero, numero, sufixo = match.groups()
    uf_final = sigla or uf_no_numero
    if uf_no_numero and sigla and uf_no_numero != sigla:
        return None, None, "UF da OAB inconsistente entre os campos informados."
    if not uf_final:
        return None, None, "UF da OAB é obrigatória quando o registro OAB for informado."

    numero_final = f"{numero}{sufixo or ''}"
    return numero_final, uf_final, None


def _validar_consentimentos(data):
    """Valida payload de aceite de termos/LGPD. Retorna (ok, error_response_or_None,
    versao_termos_or_None, versao_lgpd_or_None).

    Separado de _registrar_consentimentos para permitir validacao ANTES de
    abrir transacao (admin_session) — evita commit parcial ao abortar."""
    if not data.get("aceite_termos"):
        return False, ({"message": "É obrigatório aceitar os Termos de Uso."}, 400), None, None
    if not data.get("aceite_lgpd"):
        return (
            False,
            ({"message": "É obrigatório aceitar a Política de Privacidade (LGPD)."}, 400),
            None,
            None,
        )
    versao_termos = data.get("versao_termos")
    versao_lgpd = data.get("versao_lgpd")
    if not versao_termos or not versao_lgpd:
        return (
            False,
            ({"message": "Versão dos Termos/LGPD é obrigatória."}, 400),
            None,
            None,
        )
    return True, None, versao_termos, versao_lgpd


def _registrar_consentimentos(user, data):
    """Valida aceites e persiste ConsentimentoUsuario via db.session.

    Mantida para compatibilidade — endpoints novos do Batch 4 usam
    _validar_consentimentos + admin_session inline.

    Retorna (ok, error_response_tuple)."""
    ok, err, versao_termos, versao_lgpd = _validar_consentimentos(data)
    if not ok:
        return False, err

    from flask import request as _req

    ip = _ip_request_atual(_req)
    ua = _user_agent_request_atual(_req)

    db.session.add(
        ConsentimentoUsuario(
            tenant_id=user.tenant_id,
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
            tenant_id=user.tenant_id,
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
        @limiter.limit("3 per hour")
        @auth_ns.expect(user_model_dto)
        @auth_ns.response(201, "Usuário registrado com sucesso.")
        @auth_ns.response(400, "Dados de entrada inválidos.")
        @auth_ns.response(403, "Cadastro restrito: REGISTRATION_MODE=closed.")
        @auth_ns.response(409, "Nome de usuário ou email já existem.")
        def post(self):
            # Gate pre-comercial (issue #112): em modo "closed" (padrao), self-signup
            # via /register e bloqueado. Apenas /register-invite com token valido funciona.
            # Habilitar "open" so quando houver gate de pagamento integrado.
            if current_app.config.get("REGISTRATION_MODE", "closed") != "open":
                return {
                    "message": (
                        "Cadastro restrito a convites. Solicite acesso entrando em contato "
                        "via landing page ou pelo email do administrador."
                    ),
                    "code": "registration_closed",
                }, 403

            data = request.get_json() or {}
            username = data.get("username")
            email = data.get("email")
            password = data.get("password")
            role = data.get("role", "admin")
            documento = data.get("documento_identificacao")
            nome_completo = (data.get("nome_completo") or "").strip() or None
            tipo_pessoa = _normalizar_tipo_pessoa(data.get("tipo_pessoa"))
            if tipo_pessoa == "INVALIDO":
                return {"message": "tipo_pessoa deve ser PF ou PJ."}, 400

            oab_numero, oab_sigla, oab_err = _normalizar_dados_oab(
                data.get("oab"), data.get("sigla_oab_tribunal")
            )
            if oab_err:
                return {"message": oab_err}, 400

            cpf_informado = data.get("cpf")
            if tipo_pessoa == "PF" and not cpf_informado:
                cpf_informado = documento
            cpf_formatado = None
            if cpf_informado:
                if not _validar_cpf(cpf_informado):
                    return {"message": "CPF inválido."}, 400
                cpf_formatado = _formatar_cpf(cpf_informado)

            if role not in ["admin", "advogado", "assistente"]:
                return {"message": "Role deve ser admin, advogado ou assistente."}, 400

            if not username or not email or not password:
                return {
                    "message": "Todos os campos (username, email, password) são obrigatórios."
                }, 400
            ok, motivo = validar_forca_senha(password)
            if not ok:
                return {"message": motivo}, 400

            # Validar consentimentos ANTES de abrir transacao (early
            # return em with admin_session() commitaria writes parciais).
            ok_c, err_c, versao_termos, versao_lgpd = _validar_consentimentos(data)
            if not ok_c:
                return err_c

            # Batch 4: User com RLS restritivo. Cadastro de novo tenant
            # acontece pre-auth (sem current_tenant_id), entao toda a
            # transacao roda via admin_session (BYPASSRLS).
            with admin_session() as s:
                if s.query(User).filter_by(username=username).first():
                    return {"message": "Nome de usuário já cadastrado."}, 409
                if s.query(User).filter_by(email=email).first():
                    return {"message": "Email já cadastrado."}, 409

                # Se for 'admin', significa que é uma criação de NOVO Escritório (Tenant)
                novo_tenant = None
                if role == "admin":
                    nome_escritorio = (data.get("razao_social") or "").strip() or username
                    documento_tenant = documento if tipo_pessoa == "PJ" else None
                    novo_tenant = Tenant(
                        nome_escritorio=nome_escritorio, documento=documento_tenant
                    )
                    s.add(novo_tenant)
                    s.flush()

                # Cria o Super-User
                new_user = User(
                    username=username,
                    email=email,
                    role=role,
                    tenant_id=novo_tenant.id if novo_tenant else None,
                    nome_completo=nome_completo,
                    cpf=cpf_formatado if tipo_pessoa == "PF" else None,
                    tipo_pessoa=tipo_pessoa,
                    numero_oab=oab_numero,
                    sigla_oab_tribunal=oab_sigla,
                )
                new_user.set_password(password)
                s.add(new_user)
                s.flush()

                # Consentimentos (versao ja validada antes da transacao)
                ip = _ip_request_atual(request)
                ua = _user_agent_request_atual(request)
                s.add(
                    ConsentimentoUsuario(
                        tenant_id=new_user.tenant_id,
                        user_id=new_user.id,
                        tipo="termos_uso",
                        versao=versao_termos,
                        ip=ip,
                        user_agent=ua,
                        hash_documento=data.get("hash_termos_uso"),
                    )
                )
                s.add(
                    ConsentimentoUsuario(
                        tenant_id=new_user.tenant_id,
                        user_id=new_user.id,
                        tipo="lgpd",
                        versao=versao_lgpd,
                        ip=ip,
                        user_agent=ua,
                        hash_documento=data.get("hash_lgpd"),
                    )
                )
                # commit ao sair do with

            app.logger.info(
                f"Novo Tenant/Escritório registrado: {username} (Logado pelo Master admin ID: {new_user.id})"
            )
            return {
                "message": "Ambiente de Escritório criado com sucesso! Faça login para gerenciar sua assinatura."
            }, 201

    @auth_ns.route("/termos-vigentes")
    class TermosVigentes(Resource):
        @auth_ns.doc(description="Retorna os documentos legais vigentes com versão e hash.")
        def post(self):
            return {
                "termos": _carregar_documento_legal("termos"),
                "lgpd": _carregar_documento_legal("lgpd"),
            }, 200

    @auth_ns.route("/invite-cliente")
    class ClientePortalInvite(Resource):
        @limiter.limit("20 per hour")
        @jwt_required()
        @auth_ns.doc(
            security="jsonWebToken",
            description="Convida um cliente para acessar o Portal do Cliente. Apenas admins.",
        )
        def post(self):
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role != "admin":
                return {"message": "Apenas o Admin do escritório pode convidar clientes."}, 403

            data = request.get_json() or {}
            email_cliente = data.get("email")
            cliente_id = data.get("cliente_id")

            if not email_cliente or not cliente_id:
                return {"message": "email e cliente_id são obrigatórios."}, 400

            from models import Cliente

            cliente = db.session.get(Cliente, cliente_id)
            if not cliente or cliente.user_id != user.id:
                return {"message": "Cliente não encontrado ou sem permissão."}, 404

            invite_token = create_access_token(
                identity="invite",
                additional_claims={
                    "is_invite": True,
                    "invite_email": email_cliente,
                    "invite_role": "cliente",
                    "invite_tenant_id": user.tenant_id,
                    "invite_portal_cliente_id": cliente_id,
                    "nome_cliente": cliente.nome_razao_social,
                    "escritorio_nome": user.tenant.nome_escritorio if user.tenant else "Escritório",
                },
                expires_delta=timedelta(days=7),
            )

            base_url = os.environ.get("FRONTEND_URL", "https://app-gestao-advocacia.vercel.app/")
            if "localhost" in (request.host_url or ""):
                base_url = "http://localhost:5173/"

            link = f"{base_url.rstrip('/')}/portal/registro?invite_token={invite_token}"

            corpo_email = f"""
            <h3>Seu acesso ao Portal do Cliente foi criado!</h3>
            <p>O escritório <strong>{user.tenant.nome_escritorio if user.tenant else 'Jurídico'}</strong>
            disponibilizou um portal exclusivo para você acompanhar seu processo.</p>
            <br>
            <p><a href='{link}' style='padding: 10px 20px; background-color: #1e40af; color: white;
            text-decoration: none; border-radius: 6px;'>Ativar Meu Acesso ao Portal</a></p>
            <br>
            <p style='color:#666; font-size:13px'>Se o botão não funcionar, acesse: {link}</p>
            <p style='color:#999; font-size:12px'>Este link expira em 7 dias.</p>
            """

            enviar_alerta_email(
                current_app,
                email_cliente,
                f"Acesso ao Portal do Cliente — {user.tenant.nome_escritorio if user.tenant else 'Escritório'}",
                corpo_email,
            )

            return {"message": "Convite enviado para o cliente!", "link_simulado": link}, 200

    @auth_ns.route("/invite")
    class UserInvite(Resource):
        @limiter.limit("10 per hour")
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
                expires_delta=timedelta(hours=app.config.get("INVITE_TOKEN_HOURS", 48)),
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
        @limiter.limit("10 per hour")
        @auth_ns.expect(user_register_invite_dto)
        def post(self):
            data = request.get_json()
            token = data.get("invite_token")
            username = data.get("username")
            password = data.get("password")

            if not token or not username or not password:
                return {"message": "Dados incompletos."}, 400

            ok, motivo = validar_forca_senha(password)
            if not ok:
                return {"message": motivo}, 400

            try:
                decoded = decode_token(token)
                if not decoded.get("is_invite"):
                    return {"message": "Token inválido para convite."}, 400

                invite_email = decoded.get("invite_email")
                invite_role = decoded.get("invite_role")
                invite_tenant_id = decoded.get("invite_tenant_id")
                invite_portal_cliente_id = decoded.get("invite_portal_cliente_id")

                # Validar consentimentos ANTES de abrir transacao
                ok_c, err_c, versao_termos, versao_lgpd = _validar_consentimentos(data)
                if not ok_c:
                    return err_c

                # Batch 4: User com RLS restritivo. Lookup pre-auth e
                # criacao do user via admin_session (BYPASSRLS).
                with admin_session() as s:
                    if (
                        s.query(User).filter_by(email=invite_email).first()
                        or s.query(User).filter_by(username=username).first()
                    ):
                        return {"message": "Usuário ou email já está em uso no sistema."}, 409

                    new_user = User(
                        username=username,
                        email=invite_email,
                        role=invite_role,
                        tenant_id=invite_tenant_id,
                        portal_cliente_id=invite_portal_cliente_id,
                    )
                    new_user.set_password(password)
                    s.add(new_user)
                    s.flush()

                    ip = _ip_request_atual(request)
                    ua = _user_agent_request_atual(request)
                    s.add(
                        ConsentimentoUsuario(
                            tenant_id=new_user.tenant_id,
                            user_id=new_user.id,
                            tipo="termos_uso",
                            versao=versao_termos,
                            ip=ip,
                            user_agent=ua,
                            hash_documento=data.get("hash_termos_uso"),
                        )
                    )
                    s.add(
                        ConsentimentoUsuario(
                            tenant_id=new_user.tenant_id,
                            user_id=new_user.id,
                            tipo="lgpd",
                            versao=versao_lgpd,
                            ip=ip,
                            user_agent=ua,
                            hash_documento=data.get("hash_lgpd"),
                        )
                    )
                    # commit ao sair do with

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
        @limiter.limit("5 per minute; 20 per hour")
        @auth_ns.expect(login_model_dto)
        @auth_ns.response(200, "Login bem-sucedido.", token_model_dto)
        @auth_ns.response(401, "Credenciais inválidas.")
        def post(self):
            data = request.get_json()
            username_or_email = data.get("username_or_email")
            password = data.get("password")

            # Batch 4: User table tem RLS restritivo. Pre-autenticacao nao
            # ha tenant_id na sessao, entao usamos admin_session (BYPASSRLS)
            # so para o lookup. Apos identificar o user, capturamos os
            # campos necessarios e seguimos com a logica fora do contexto admin.
            with admin_session() as s:
                user_obj = (
                    s.query(User)
                    .filter(
                        (User.username == username_or_email) | (User.email == username_or_email)
                    )
                    .first()
                )
                if user_obj is None:
                    user_data = None
                    senha_ok = False
                else:
                    senha_ok = user_obj.check_password(password)
                    user_data = {
                        "id": user_obj.id,
                        "tenant_id": user_obj.tenant_id,
                        "role": user_obj.role,
                        "dict": user_obj.to_dict(),
                    }
                # Tenant lookup (para bloqueio de suspenso/cancelado) tambem
                # via admin: nao temos tenant_id na sessao ainda.
                tenant_status = None
                if user_data and user_data["role"] != "superadmin" and user_data["tenant_id"]:
                    t = s.get(Tenant, user_data["tenant_id"])
                    tenant_status = t.status if t else None

            if user_data and senha_ok:
                if (
                    user_data["role"] != "superadmin"
                    and user_data["tenant_id"]
                    and tenant_status in ("suspenso", "cancelado")
                ):
                    _registrar_login_audit(
                        user_id=user_data["id"],
                        email_tentativa=username_or_email,
                        sucesso=False,
                        motivo_falha="tenant_suspenso",
                        tenant_id=user_data["tenant_id"],
                    )
                    app.logger.warning(
                        "login_blocked_tenant_suspended",
                        extra={
                            "event": "login_blocked_tenant_suspended",
                            "user_id_hash": mask_user_id(user_data["id"]),
                            "tenant_id": user_data["tenant_id"],
                            "tenant_status": tenant_status,
                        },
                    )
                    return {"message": "Conta suspensa. Contate o suporte."}, 403

                expires = timedelta(days=app.config.get("JWT_ACCESS_TOKEN_EXPIRES_DAYS", 1))
                access_token = create_access_token(
                    identity=str(user_data["id"]),
                    additional_claims={"role": user_data["role"]},
                    expires_delta=expires,
                )
                _registrar_login_audit(
                    user_id=user_data["id"],
                    email_tentativa=username_or_email,
                    sucesso=True,
                    motivo_falha=None,
                    tenant_id=user_data["tenant_id"],
                )
                app.logger.info(
                    "login_success",
                    extra={
                        "event": "login_success",
                        "user_id_hash": mask_user_id(user_data["id"]),
                        "tenant_id": user_data["tenant_id"],
                    },
                )
                return {"access_token": access_token, "user": user_data["dict"]}, 200

            motivo = "user_not_found" if not user_data else "invalid_credentials"
            _registrar_login_audit(
                user_id=user_data["id"] if user_data else None,
                email_tentativa=username_or_email,
                sucesso=False,
                motivo_falha=motivo,
                tenant_id=user_data["tenant_id"] if user_data else None,
            )
            app.logger.warning(
                "login_failed",
                extra={
                    "event": "login_failed",
                    "email": mask_email(username_or_email),
                    "reason": motivo,
                },
            )
            return {"message": "Nome de usuário/email ou senha inválidos."}, 401

    @auth_ns.route("/forgot-password")
    class ForgotPassword(Resource):
        @limiter.limit("5 per hour; 20 per day")
        @auth_ns.doc(
            description=(
                "Solicita link de redefinicao de senha. Resposta sempre 200 generica para "
                "nao vazar quais emails existem na base."
            )
        )
        def post(self):
            data = request.get_json(silent=True) or {}
            email = (data.get("email") or "").strip().lower()

            generic_response = (
                {
                    "message": (
                        "Se este email estiver cadastrado, você receberá em instantes "
                        "as instruções para redefinir sua senha."
                    )
                },
                200,
            )

            if not email or "@" not in email:
                return generic_response

            # Batch 4: User table com RLS restritivo. Lookup pre-auth via
            # admin_session. PasswordResetToken e categoria C (sem RLS),
            # mas a tabela esta na mesma conexao admin para minimizar idas
            # ao DB e simplificar a transacao.
            try:
                with admin_session() as s:
                    user_obj = s.query(User).filter(db.func.lower(User.email) == email).first()
                    if user_obj is None:
                        app.logger.info(
                            "password_reset_requested_unknown_email",
                            extra={
                                "event": "password_reset_unknown_email",
                                "email": mask_email(email),
                            },
                        )
                        return generic_response

                    user_id = user_obj.id
                    user_email = user_obj.email
                    user_nome = user_obj.nome_completo or user_obj.username

                    # Invalida tokens anteriores ainda nao usados desse usuario
                    s.query(PasswordResetToken).filter_by(user_id=user_id, used_at=None).update(
                        {PasswordResetToken.used_at: datetime.utcnow()},
                        synchronize_session=False,
                    )

                    token_plaintext = secrets.token_urlsafe(PASSWORD_RESET_TOKEN_BYTES)
                    novo = PasswordResetToken(
                        user_id=user_id,
                        token_hash=_hash_reset_token(token_plaintext),
                        expires_at=datetime.utcnow()
                        + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES),
                        requested_ip=_ip_request_atual(request),
                        requested_user_agent=_user_agent_request_atual(request),
                    )
                    s.add(novo)
                    # commit acontece automaticamente ao sair do with

                base = _frontend_base_url().rstrip("/")
                link = f"{base}/reset-password?token={token_plaintext}"

                assunto, texto, html = _montar_email_reset(
                    user_nome,
                    link,
                    PASSWORD_RESET_TTL_MINUTES,
                )
                enviar_email(current_app, user_email, assunto, html, corpo_texto=texto)

                app.logger.info(
                    "password_reset_requested",
                    extra={
                        "event": "password_reset_requested",
                        "user_id_hash": mask_user_id(user_id),
                    },
                )
            except Exception as exc:
                app.logger.error(f"Falha ao gerar token de reset de senha: {exc}")

            return generic_response

    @auth_ns.route("/reset-password")
    class ResetPassword(Resource):
        @limiter.limit("10 per hour")
        @auth_ns.doc(description="Confirma redefinicao de senha com token recebido por email.")
        def post(self):
            data = request.get_json(silent=True) or {}
            token_plaintext = (data.get("token") or "").strip()
            nova_senha = data.get("password") or ""

            if not token_plaintext or not nova_senha:
                return {"message": "Token e nova senha são obrigatórios."}, 400

            ok, motivo = validar_forca_senha(nova_senha)
            if not ok:
                return {"message": motivo}, 400

            token_hash = _hash_reset_token(token_plaintext)

            # Batch 4: validacao + update via admin_session (User com RLS
            # restritivo, nao ha tenant_id pre-auth). LoginAudit do sucesso
            # passa por _registrar_login_audit (que usa admin_session).
            try:
                with admin_session() as s:
                    registro = s.query(PasswordResetToken).filter_by(token_hash=token_hash).first()
                    # Comparacao em tempo constante como defesa em profundidade,
                    # alem do filtro indexado acima.
                    if (
                        not registro
                        or not hmac.compare_digest(registro.token_hash, token_hash)
                        or registro.used_at is not None
                        or registro.expires_at < datetime.utcnow()
                    ):
                        app.logger.warning(
                            "password_reset_invalid_token",
                            extra={"event": "password_reset_invalid_token"},
                        )
                        return {
                            "message": "Link inválido ou expirado. Solicite uma nova redefinição."
                        }, 400

                    user_obj = s.get(User, registro.user_id)
                    if not user_obj:
                        return {
                            "message": "Link inválido ou expirado. Solicite uma nova redefinição."
                        }, 400

                    user_id = user_obj.id
                    user_tenant_id = user_obj.tenant_id
                    user_email = user_obj.email

                    user_obj.set_password(nova_senha)
                    registro.used_at = datetime.utcnow()
                    # Invalida quaisquer outros tokens pendentes desse usuario
                    s.query(PasswordResetToken).filter(
                        PasswordResetToken.user_id == user_id,
                        PasswordResetToken.id != registro.id,
                        PasswordResetToken.used_at.is_(None),
                    ).update(
                        {PasswordResetToken.used_at: datetime.utcnow()},
                        synchronize_session=False,
                    )
                    # commit ao sair do with

                # LoginAudit fora da admin_session — _registrar_login_audit
                # abre sua propria admin_session.
                _registrar_login_audit(
                    user_id=user_id,
                    email_tentativa=(user_email or "")[:120],
                    sucesso=True,
                    motivo_falha="password_reset",
                    tenant_id=user_tenant_id,
                )

                app.logger.info(
                    "password_reset_success",
                    extra={
                        "event": "password_reset_success",
                        "user_id_hash": mask_user_id(user_id),
                    },
                )
                return {"message": "Senha redefinida com sucesso. Você já pode fazer login."}, 200
            except Exception as exc:
                app.logger.error(f"Falha ao confirmar reset de senha: {exc}")
                return {"message": "Falha ao redefinir senha. Tente novamente."}, 500

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

        @jwt_required()
        @auth_ns.doc(
            security="jsonWebToken",
            description="Atualiza dados permitidos do usuário autenticado.",
        )
        @auth_ns.response(400, "Dados inválidos.")
        @auth_ns.response(404, "Usuário não encontrado.")
        def put(self):
            current_user_id = get_jwt_identity()
            user = db.session.get(User, current_user_id)
            if not user:
                return {"message": "Usuário associado ao token não encontrado."}, 404

            data = request.get_json() or {}

            nome_completo = data.get("nome_completo")
            if nome_completo is not None:
                user.nome_completo = str(nome_completo).strip() or None

            oab_numero, oab_sigla, oab_err = _normalizar_dados_oab(
                data.get("numero_oab"), data.get("sigla_oab_tribunal")
            )
            if oab_err:
                return {"message": oab_err}, 400

            if data.get("numero_oab") is not None:
                user.numero_oab = oab_numero
            if data.get("sigla_oab_tribunal") is not None:
                user.sigla_oab_tribunal = oab_sigla

            if data.get("tipo_pessoa") is not None:
                tipo = _normalizar_tipo_pessoa(data.get("tipo_pessoa"))
                if tipo == "INVALIDO":
                    return {"message": "tipo_pessoa deve ser PF ou PJ."}, 400
                user.tipo_pessoa = tipo

            cpf = data.get("cpf")
            if cpf is not None:
                if user.cpf:
                    return {"message": "CPF já cadastrado e não pode ser alterado."}, 400
                if not _validar_cpf(cpf):
                    return {"message": "CPF inválido."}, 400
                user.cpf = _formatar_cpf(cpf)

            db.session.commit()
            return user.to_dict(), 200

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
