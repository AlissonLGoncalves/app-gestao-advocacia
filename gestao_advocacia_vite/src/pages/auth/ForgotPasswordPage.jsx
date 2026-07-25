import React, { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'react-toastify'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { APP_VERSION } from '../../version.js'
import { forgotPassword } from '../../api/auth'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    toast.dismiss()

    try {
      await forgotPassword({ email: email.trim() })
      setEnviado(true)
    } catch (error) {
      toast.error(error.message || 'Não foi possível processar a solicitação. Tente novamente.')
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
          <h1 className="fw-bolder">Recuperar senha</h1>
          <p>Informe seu email cadastrado para receber as instruções.</p>
        </div>

        {enviado ? (
          <div className="text-center">
            <div className="alert alert-success" role="alert">
              <strong>Pronto!</strong> Se este email estiver cadastrado, você receberá em instantes
              uma mensagem com o link para redefinir sua senha.
            </div>
            <p className="text-muted small">
              Não recebeu? Verifique a caixa de spam ou aguarde alguns minutos antes de solicitar
              novamente.
            </p>
            <Link to="/login" className="btn btn-outline-primary mt-2">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="form-label">
                <EnvelopeIcon
                  className="d-inline-block me-1"
                  style={{ width: '16px', verticalAlign: 'text-bottom' }}
                />
                Email
              </label>
              <input
                type="email"
                className="form-control"
                id="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Enviando...
                </>
              ) : (
                'Enviar link de recuperação'
              )}
            </button>
          </form>
        )}

        <div className="text-center mt-4">
          {!enviado && (
            <p className="text-muted small mb-0">
              Lembrou a senha?{' '}
              <Link to="/login" className="fw-semibold">
                Voltar para o login
              </Link>
            </p>
          )}
          <p className="auth-version mt-2 mb-0">Versao v{APP_VERSION}</p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
