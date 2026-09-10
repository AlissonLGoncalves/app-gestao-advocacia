// Arquivo: gestao_advocacia_vite/src/pages/auth/LoginPage.jsx
// TELA 4 do redesign Stitch (docs/design/stitch-2026-09/prompt.md): layout
// dividido — painel navy com a marca e a promessa do produto a esquerda,
// formulario minimo a direita. A logica de login nao mudou.
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { toast } from 'react-toastify'
import PasswordInput from '../../components/ui/PasswordInput.jsx'
import AuthHero from './AuthHero.jsx'
import { APP_VERSION } from '../../version.js'
import { login as loginRequest } from '../../api/auth'
import './LoginPage.css'

function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    toast.dismiss()

    if (!usernameOrEmail || !password) {
      toast.error('Por favor, preencha o nome de usuário/email e a senha.')
      setLoading(false)
      return
    }

    try {
      const data = await loginRequest({ username_or_email: usernameOrEmail, password })
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      const nome = data.user?.nome_completo || data.user?.username || 'advogado'
      toast.success(`Bem-vindo, ${nome}! ✓`)
      if (data.user?.role === 'cliente') {
        navigate('/portal')
      } else {
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Erro ao tentar fazer login:', error)
      toast.error(error.message || 'Falha no login. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <AuthHero />

      <main className="login-panel">
        <div className="login-form">
          <h1 className="login-title">Entrar</h1>
          <p className="login-subtitle">Sua fila de hoje já está pronta.</p>

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="usernameOrEmail" className="form-label">
                E-mail ou usuário
              </label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="usernameOrEmail"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="voce@escritorio.adv.br"
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="form-label">
                Senha
              </label>
              <PasswordInput
                id="password"
                className="form-control form-control-lg"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Aguarde…
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <div className="login-links">
            <Link to="/forgot-password">Esqueci a senha</Link>
            <Link to="/solicitar-acesso">Solicitar acesso</Link>
          </div>

          <p className="login-footer">Patronus v{APP_VERSION} · Sistema Jurídico</p>
        </div>
      </main>
    </div>
  )
}

export default LoginPage
