import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { APP_VERSION } from '../../version.js'
import { resetPassword } from '../../api/auth'

function validarSenhaCliente(senha) {
  if (!senha || senha.length < 10) return 'A senha deve ter no mínimo 10 caracteres.'
  if (!/[A-Z]/.test(senha)) return 'Inclua ao menos uma letra maiúscula.'
  if (!/[a-z]/.test(senha)) return 'Inclua ao menos uma letra minúscula.'
  if (!/\d/.test(senha)) return 'Inclua ao menos um número.'
  return null
}

function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => params.get('token') || '', [params])

  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erroSenha, setErroSenha] = useState(null)

  const tokenAusente = !token

  const handleSubmit = async (e) => {
    e.preventDefault()
    toast.dismiss()
    setErroSenha(null)

    const erroLocal = validarSenhaCliente(senha)
    if (erroLocal) {
      setErroSenha(erroLocal)
      return
    }
    if (senha !== confirmacao) {
      setErroSenha('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      await resetPassword({ token, password: senha })
      toast.success('Senha redefinida com sucesso! Faça login com a nova senha.')
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(error.message || 'Não foi possível redefinir a senha. Solicite um novo link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo-wrap">
            <img src="/logo.png" alt="Patronus Logo" className="auth-logo" />
          </div>
          <h1 className="fw-bolder">Definir nova senha</h1>
          <p>Crie uma nova senha forte para sua conta.</p>
        </div>

        {tokenAusente ? (
          <div className="text-center">
            <div className="alert alert-danger" role="alert">
              Link inválido ou incompleto. Solicite uma nova redefinição.
            </div>
            <Link to="/forgot-password" className="btn btn-outline-primary mt-2">
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="senha" className="form-label">
                <LockClosedIcon
                  className="d-inline-block me-1"
                  style={{ width: '16px', verticalAlign: 'text-bottom' }}
                />
                Nova senha
              </label>
              <input
                type="password"
                className="form-control"
                id="senha"
                value={senha}
                onChange={(ev) => setSenha(ev.target.value)}
                placeholder="Mínimo 10 caracteres, com maiúscula, minúscula e número"
                required
                autoFocus
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="confirmacao" className="form-label">
                <LockClosedIcon
                  className="d-inline-block me-1"
                  style={{ width: '16px', verticalAlign: 'text-bottom' }}
                />
                Confirme a nova senha
              </label>
              <input
                type="password"
                className="form-control"
                id="confirmacao"
                value={confirmacao}
                onChange={(ev) => setConfirmacao(ev.target.value)}
                placeholder="Repita a nova senha"
                required
                disabled={loading}
                autoComplete="new-password"
              />
              {erroSenha && <div className="form-text text-danger mt-2">{erroSenha}</div>}
            </div>
            <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Salvando...
                </>
              ) : (
                'Redefinir senha'
              )}
            </button>
          </form>
        )}

        <div className="text-center mt-4">
          <p className="text-muted small mb-0">
            <Link to="/login" className="fw-semibold">
              Voltar para o login
            </Link>
          </p>
          <p className="auth-version mt-2 mb-0">Versao v{APP_VERSION}</p>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
