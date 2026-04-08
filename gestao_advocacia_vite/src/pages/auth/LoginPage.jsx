// Arquivo: gestao_advocacia_vite/src/pages/auth/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // CORRIGIDO AQUI
import { API_URL } from '../../config';
import { toast } from 'react-toastify';
import { LockClosedIcon, UserIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom'; // Adicionado para o link de registro, se desejar

function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    toast.dismiss(); 

    if (!usernameOrEmail || !password) {
        toast.error("Por favor, preencha o nome de usuário/email e a senha.");
        setLoading(false);
        return;
    }

    try {
      // A rota de login no backend é /api/auth/login, não precisa de barra final.
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: usernameOrEmail, password: password })
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success("Login bem-sucedido! Redirecionando...");
        navigate('/dashboard'); 
      } else {
        toast.error(data.message || "Falha no login. Verifique suas credenciais.");
      }
    } catch (error) {
      console.error("Erro ao tentar fazer login:", error);
      toast.error("Erro de rede ou servidor indisponível. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo.png" alt="Patronus Logo" className="mb-3" style={{ width: '75px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
          <h1 className="fw-bolder" style={{color: '#1d4ed8'}}>Patronus</h1>
          <p>Bem-vindo! Faça login para continuar.</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label htmlFor="usernameOrEmail" className="form-label">
              <UserIcon className="d-inline-block me-1" style={{ width: '16px', verticalAlign: 'text-bottom' }} />
              Usuário ou Email
            </label>
            <input
              type="text"
              className="form-control"
              id="usernameOrEmail"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="Digite seu usuário ou email"
              required
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="form-label">
              <LockClosedIcon className="d-inline-block me-1" style={{ width: '16px', verticalAlign: 'text-bottom' }} />
              Senha
            </label>
            <input
              type="password"
              className="form-control"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Aguarde...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
        <div className="text-center mt-4">
          <p className="text-muted small mb-0">
            Não tem uma conta? <Link to="/register" className="fw-semibold">Registre-se aqui</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;