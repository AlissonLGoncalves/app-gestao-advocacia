import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { api } from '../../api/client.js'

function PortalRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite_token')

  const [nomeCliente, setNomeCliente] = useState('')
  const [escritorio, setEscritorio] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenValido, setTokenValido] = useState(null)

  useEffect(() => {
    if (!inviteToken) {
      setTokenValido(false)
      return
    }
    api.post('/auth/termos-vigentes', {}, { auth: false }).catch(() => {})
    try {
      const payload = JSON.parse(atob(inviteToken.split('.')[1]))
      if (payload.invite_role !== 'cliente') {
        setTokenValido(false)
        return
      }
      setNomeCliente(payload.nome_cliente || '')
      setEscritorio(payload.escritorio_nome || '')
      setTokenValido(true)
    } catch {
      setTokenValido(false)
    }
  }, [inviteToken])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('Preencha usuário e senha.')
      return
    }
    if (password.length < 8) {
      toast.error('A senha deve ter ao menos 8 caracteres.')
      return
    }
    setLoading(true)
    try {
      await api.post(
        '/auth/register-invite',
        {
          invite_token: inviteToken,
          username: username.trim(),
          password,
          aceite_termos: true,
          aceite_lgpd: true,
          versao_termos: 'v1.0',
          versao_lgpd: 'v1.0',
        },
        { auth: false }
      )
      toast.success('Acesso criado! Faça login para acessar seu portal.')
      navigate('/login')
    } catch (err) {
      toast.error(err.message || 'Erro ao criar acesso.')
    } finally {
      setLoading(false)
    }
  }

  if (tokenValido === null) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" />
      </div>
    )
  }

  if (!tokenValido) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="card border-0 shadow-sm p-5 text-center" style={{ maxWidth: 400 }}>
          <i className="bi bi-x-circle-fill text-danger display-4 mb-3" />
          <h5 className="fw-bold">Link inválido ou expirado</h5>
          <p className="text-muted small">Solicite um novo convite ao seu advogado.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}
    >
      <div
        className="card border-0 shadow-lg"
        style={{ width: '100%', maxWidth: 420, borderRadius: 16 }}
      >
        {/* Header */}
        <div
          className="p-4 text-white text-center"
          style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a5f 100%)',
            borderRadius: '16px 16px 0 0',
          }}
        >
          <div
            className="bg-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
            style={{ width: 56, height: 56 }}
          >
            <i className="bi bi-person-badge-fill text-primary fs-4" />
          </div>
          <h5 className="fw-bold mb-0">Portal do Cliente</h5>
          {escritorio && <p className="small text-white-50 mb-0 mt-1">{escritorio}</p>}
        </div>

        {/* Body */}
        <div className="p-4">
          {nomeCliente && (
            <div className="alert alert-info border-0 py-2 px-3 small mb-4">
              <i className="bi bi-person-check me-1" />
              Olá, <strong>{nomeCliente}</strong>! Crie seu acesso para acompanhar seu processo.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-muted">Nome de usuário</label>
              <input
                type="text"
                className="form-control"
                placeholder="Escolha um nome de usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold text-muted">Senha</label>
              <input
                type="password"
                className="form-control"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="btn btn-primary w-100 fw-bold py-2" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Criando acesso...
                </>
              ) : (
                <>
                  <i className="bi bi-shield-check me-2" />
                  Ativar Meu Acesso
                </>
              )}
            </button>
          </form>

          <p className="text-center text-muted small mt-3 mb-0">
            Já tem acesso?{' '}
            <a href="/login" className="text-primary fw-semibold">
              Fazer login
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default PortalRegisterPage
