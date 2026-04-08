from app import create_app, db, User
from werkzeug.security import generate_password_hash

app = create_app()
with app.app_context():
    # Cria a conta admin
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', email='contato@patronus.com', role='admin')
        admin.password_hash = generate_password_hash('admin') # Default passward para o usuario logar
        db.session.add(admin)
        db.session.commit()
        print("Usuário 'admin' e senha 'admin' criados remotamente!")
    else:
        print("Usuário admin já existia.")
