# Rate Limiting

## Visão Geral

Rate limiting está implementado em rotas públicas de autenticação para mitigar:
- **Brute-force attacks**: Múltiplas tentativas de login com senhas diferentes
- **Enumeração de usuários**: Múltiplas tentativas de registro/convite para descobrir emails válidos

Usa Flask-Limiter com storage em memória (`memory://`).

## Limites Configurados

| Endpoint | Limite | Razão |
|----------|--------|-------|
| `POST /api/v1/auth/login` | 5 por minuto; 20 por hora | Proteção contra brute-force |
| `POST /api/v1/auth/register` | 3 por hora | Proteção contra enumeração |
| `POST /api/v1/auth/register-invite` | 10 por hora | Limite generoso (admin-controlled) |

### Endpoints NÃO rate-limited
- `GET /api/v1/auth/me` (requer `@jwt_required`, já protegido)
- `POST /api/v1/auth/invite` (requer `@jwt_required`, usuários autenticados)

## Comportamento

Quando limite é atingido:
```json
HTTP/1.1 429 Too Many Requests
{
  "message": "Muitas tentativas. Aguarde e tente novamente.",
  "retry_after": "<tempo em segundos>"
}
```

O header `Retry-After` também é incluído (Flask-Limiter padrão).

## Storage

### Produção (MVP)
```python
storage_uri="memory://"
```
**Comportamento**: Contadores são zeroed quando o app reinicia (ou ao usar auto_stop_machines no Fly.io).

**Impacto em escala horizontal**: Se 2+ máquinas estiverem rodando, cada uma tem seu próprio contador isolado.
- Limite efetivo = limite_configurado × número_de_máquinas
- Ex: 5/min em 2 máquinas = 10/min total

**Isso é aceitável porque**:
- Brute-force casual ainda é mitigado em uma máquina
- Ataques distribuídos coordenados são raros
- Crescimento para 2+ máquinas é futuro; hoje min_machines_running=1

### Migração Futura (S2.1)

Quando escalar para 2+ máquinas ou precisar de persistência:

#### Opção A: Redis
```python
# Em extensions.py
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    storage_uri="redis://localhost:6379"
)
```
- Contadores persistem entre restarts
- Compartilhados entre máquinas
- Requer Redis instalado/disponível

#### Opção B: PostgreSQL JobStore
```python
from flask_limiter.backends.sqlalchemy import SQLAlchemyStorage
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    storage=SQLAlchemyStorage(db.engine)
)
```
- Usa banco de dados existente
- Sem dependência extra
- Mais lento que Redis (SQL round-trip)

## Configuração

### Variáveis de Ambiente (futuro)

```bash
# Desabilitar rate limiting (manutenção/debug)
RATELIMIT_ENABLED=false

# Ajustar limites (se implementado)
RATELIMIT_LOGIN_RATE="5 per minute; 20 per hour"
RATELIMIT_REGISTER_RATE="3 per hour"
RATELIMIT_REGISTER_INVITE_RATE="10 per hour"
```

Atualmente, limites são hardcoded em `routes/auth.py`.

### Como Ajustar

1. **Editar limits em `routes/auth.py`**:
   ```python
   @limiter.limit("10 per minute; 30 per hour")  # novo limite
   def post(self):
       ...
   ```

2. **Deploy**:
   ```bash
   git push
   # CI/CD deploya automaticamente
   ```

3. **Verificar em produção**:
   ```bash
   # Logs do app (veja tentativas de login rejeitadas)
   fly logs --app app-gestao-advocacia
   ```

## Testes

Para testes, rate limiting é **desabilitado por padrão** (config_test.py: `RATELIMIT_ENABLED = False`).

Para testes específicos de rate limiting, use o fixture `rate_limited_client`:

```python
def test_login_rate_limit(rate_limited_client):
    """Testa que 6ª tentativa retorna 429."""
    for i in range(5):
        resp = rate_limited_client.post("/api/v1/auth/login", json={"...": "..."})
        assert resp.status_code in [400, 401]
    
    resp = rate_limited_client.post("/api/v1/auth/login", json={"...": "..."})
    assert resp.status_code == 429
```

Rodando os testes:
```bash
# Todos os testes (rate limiting desabilitado por padrão)
pytest tests/ -v

# Apenas rate limiting
pytest tests/test_rate_limit.py -v
```

## Monitoramento

### Indicadores (futuro)

Em `app.py`, considere adicionar métricas:

```python
from prometheus_client import Counter

rate_limit_exceeded = Counter(
    'rate_limit_exceeded_total',
    'Número de requisições rejeitadas por rate limit',
    ['endpoint']
)

@app.errorhandler(429)
def ratelimit_handler(e):
    rate_limit_exceeded.labels(endpoint=request.path).inc()
    return {...}, 429
```

Isso permitira alertas: "Se rate_limit_exceeded > 100/min, investigar ataque".

### Verificação Manual

```bash
# SSH na máquina Fly
fly ssh console -a app-gestao-advocacia

# Logar N vezes rapidamente
for i in {1..10}; do
  curl -X POST https://app-gestao-advocacia.fly.dev/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username_or_email": "admin@test.com", "password": "wrong"}'
  echo "Tentativa $i"
done

# A 6ª tentativa deve retornar 429
```

## Referências

- [Flask-Limiter Docs](https://flask-limiter.readthedocs.io/)
- [OWASP: Brute Force Attack](https://owasp.org/www-community/attacks/Brute_force_attack)
- [CWE-307: Improper Restriction of Rendered UI Layers or Frames](https://cwe.mitre.org/data/definitions/307.html)
