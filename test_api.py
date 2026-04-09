import requests

url = "https://api-publica.datajud.cnj.jus.br/api_publica_tjpr/_search"
headers = {
    "Authorization": "APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==",
    "Content-Type": "application/json"
}
payload = {
    "query": {
        "match": {
            "numeroProcesso": "00036596920258160050"
        }
    }
}
try:
    r = requests.post(url, headers=headers, json=payload)
    print("STATUS CODE:", r.status_code)
    try:
        print(r.json())
    except Exception as e:
        print("Error parsing JSON:", e)
        print(r.text[:500])
except Exception as e:
    print("Network Error:", e)
