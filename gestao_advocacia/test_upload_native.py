import json
from app import app, db, User

with app.app_context():
    # Bypass auth and directly hit the route using test client
    user = User.query.first()
    from flask_jwt_extended import create_access_token
    token = create_access_token(identity=user.id, additional_claims={"role": user.role})

    client = app.test_client()
    
    # Create two dummy pdfs
    data = {
        'documentos': [
            (io.BytesIO(b"%PDF-1.4\nTest"), 'file1.pdf'),
            (io.BytesIO(b"%PDF-1.4\nTest"), 'file2.pdf')
        ]
    }
    
    headers = {'Authorization': f'Bearer {token}'}
    resp = client.post('/api/clientes/extrair-dados-doc', data=data, headers=headers, content_type='multipart/form-data')
    print("STATUS", resp.status_code)
    print("JSON", resp.json)
