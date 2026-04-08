import requests

# Login to get token first
resp = requests.post('http://127.0.0.1:5000/api/auth/login', json={"username": "admin", "password": "password"})
token = resp.json().get("access_token")

# Create a dummy blank pdf
with open("test.pdf", "wb") as f:
    f.write(b"%PDF-1.4\n")

# Try to upload
files = [('documentos', open('test.pdf', 'rb'))]
headers = {'Authorization': f'Bearer {token}'}
resp = requests.post('http://127.0.0.1:5000/api/clientes/extrair-dados-doc', files=files, headers=headers)
print(resp.status_code)
print(resp.json())
