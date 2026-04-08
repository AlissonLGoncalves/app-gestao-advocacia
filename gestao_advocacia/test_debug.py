import requests
import warnings
warnings.filterwarnings("ignore")

print("Logging in...")
resp = requests.post('http://127.0.0.1:5000/api/auth/login', json={"username": "admin", "password": "password"})
token = resp.json().get("access_token")
if not token:
    print("Test Failed! Bad Login")
    exit(1)

print("Opening test dummy image...")
with open("test.png", "wb") as f:
    f.write(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

print("Sending POST request to OCR API...")
headers = {'Authorization': f'Bearer {token}'}
files = [('documentos', ('test.png', open('test.png', 'rb'), 'image/png'))]

resp = requests.post('http://127.0.0.1:5000/api/clientes/extrair-dados-doc', files=files, headers=headers)
print("STATUS CODE:", resp.status_code)
print("JSON RESP:", resp.json())
