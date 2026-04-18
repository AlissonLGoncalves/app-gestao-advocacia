import requests
from pathlib import Path

# Login to get token first
resp = requests.post('http://127.0.0.1:5000/api/auth/login', json={"username": "admin", "password": "password"})
token = resp.json().get("access_token")

# Try to upload
fixture_pdf = Path(__file__).resolve().parent / 'tests' / 'fixtures' / 'test.pdf'
files = [('documentos', open(fixture_pdf, 'rb'))]
headers = {'Authorization': f'Bearer {token}'}
resp = requests.post('http://127.0.0.1:5000/api/clientes/extrair-dados-doc', files=files, headers=headers)
print(resp.status_code)
print(resp.json())
