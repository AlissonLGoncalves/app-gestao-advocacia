import os
import secrets
from app import create_app, db, User
from werkzeug.security import generate_password_hash

app = create_app()
with app.app_context():
    # Cria a conta admin
    if not User.query.filter_by(username='admin').first():
        # Use ADMIN_SEED_PASSWORD env var or generate a strong random password.
        # NEVER use a hardcoded weak default like 'admin'.
        seed_password = os.environ.get('ADMIN_SEED_PASSWORD') or secrets.token_urlsafe(16)
        admin = User(username='admin', email='contato@patronus.com', role='admin')
        admin.password_hash = generate_password_hash(seed_password)
        db.session.add(admin)
        db.session.commit()
        if not os.environ.get('ADMIN_SEED_PASSWORD'):
            print(f"Usuário 'admin' criado com senha gerada automaticamente: {seed_password}")
            print("IMPORTANTE: Anote esta senha! Ela não será exibida novamente.")
        else:
            print("Usuário 'admin' criado com a senha definida em ADMIN_SEED_PASSWORD.")
    else:
        print("Usuário admin já existia.")
