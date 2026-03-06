// Arquivo: gestao_advocacia_vite/src/pages/auth/RegisterPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';
import { toast } from 'react-toastify';
import { LockClosedIcon, UserIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    toast.dismiss(); 

    if (!username || !email || !password) {
        toast.error("Por favor, preencha todos os campos.");
        setLoading(false);
        return;
    }

    if (password.length < 6) {
        toast.error("A senha deve ter no mínimo 6 caracteres.");
        setLoading(false);
        return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Conta criada com sucesso! Você já pode fazer login.");
        navigate('/login'); 
      } else {
        toast.error(data.message || "Falha no registro. Verifique os dados.");
      }
    } catch (error) {
      console.error("Erro ao tentar registrar:", error);
      toast.error("Erro de rede ou servidor indisponível. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid d-flex align-items-center justify-content-center vh-100" style={{ backgroundColor: '#f0f2f5' }}>
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <h3 className="card-title text-primary fw-bold">ALG Jurídico</h3>
            <p className="text-muted">Crie sua conta para começar.</p>
          </div>
          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">
                <UserIcon className="d-inline-block me-1" style={{ width: '16px', verticalAlign: 'text-bottom' }} />
                Nome de Usuário
              </label>
              <input
                type="text"
                className="form-control"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Exemplo: joaosilva"
                required
                disabled={loading}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                <EnvelopeIcon className="d-inline-block me-1" style={{ width: '16px', verticalAlign: 'text-bottom' }} />
                Email
              </label>
              <input
                type="email"
                className="form-control"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
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
                placeholder="Mínimo de 6 caracteres"
                required
                disabled={loading}
                minLength="6"
              />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Aguarde...
                </>
              ) : (
                'Criar Conta'
              )}
            </button>
          </form>
          <div className="text-center mt-4">
            <p className="text-muted">
              Já tem uma conta? <Link to="/login">Faça login aqui</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
