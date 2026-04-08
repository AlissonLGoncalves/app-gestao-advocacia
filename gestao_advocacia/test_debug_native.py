import io
import warnings
warnings.filterwarnings("ignore")

from gestao_advocacia.app import create_app, db, User

app = create_app()

with app.app_context():
    user = User.query.first()
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})

    client = app.test_client()
    
    # Try JPG upload
    data = {
        'documentos': [
            (io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01"), 'image.jpg')
        ]
    }
    
    headers = {'Authorization': f'Bearer {token}'}
    try:
        resp = client.post('/api/clientes/extrair-dados-doc', data=data, headers=headers, content_type='multipart/form-data')
        print("STATUS:", resp.status_code)
        print("JSON:", resp.json)
    except Exception as e:
        import traceback
        traceback.print_exc()
