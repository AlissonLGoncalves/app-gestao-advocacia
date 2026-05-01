// Pagina publica de solicitacao de acesso a beta privada (issue #112 v2).
// Substitui o mailto: das CTAs da landing page.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from '../config'

export default function SolicitarAcessoPage() {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    oab: '',
    sigla_oab: '',
    telefone: '',
    escritorio: '',
    mensagem: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null) // { ok: true } | { ok: false, message }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setResultado(null)
    try {
      const res = await fetch(`${API_URL}/auth/access-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setResultado({ ok: true, message: data.message || 'Solicitacao recebida.' })
        setForm({
          nome: '',
          email: '',
          oab: '',
          sigla_oab: '',
          telefone: '',
          escritorio: '',
          mensagem: '',
        })
      } else {
        setResultado({ ok: false, message: data.message || 'Erro ao enviar solicitacao.' })
      }
    } catch (err) {
      setResultado({ ok: false, message: 'Erro de conexao. Tente novamente em alguns minutos.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center py-5 bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="text-center mb-4">
              <Link to="/" className="text-decoration-none text-primary fw-bold fs-4">
                Patronus
              </Link>
              <p className="text-muted mt-2 mb-0">Sistema Jurídico</p>
            </div>

            <div className="card shadow-sm">
              <div className="card-body p-4">
                <h2 className="h4 mb-2">Solicitar acesso à beta privada</h2>
                <p className="text-muted small mb-4">
                  Estamos selecionando os primeiros escritórios participantes. Preencha o
                  formulário abaixo e respondemos em até <strong>48h</strong> com um convite
                  individual.
                </p>

                {resultado?.ok ? (
                  <div className="alert alert-success">
                    <strong>Recebido!</strong>
                    <div className="mt-1">{resultado.message}</div>
                    <Link to="/" className="btn btn-link p-0 mt-2">
                      Voltar para a página inicial
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate>
                    {resultado?.ok === false && (
                      <div className="alert alert-danger small">{resultado.message}</div>
                    )}

                    <div className="mb-3">
                      <label className="form-label small fw-bold">
                        Nome completo <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        name="nome"
                        className="form-control"
                        required
                        minLength={3}
                        maxLength={200}
                        value={form.nome}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        className="form-control"
                        required
                        maxLength={120}
                        value={form.email}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="row">
                      <div className="col-8 mb-3">
                        <label className="form-label small fw-bold">OAB (opcional)</label>
                        <input
                          type="text"
                          name="oab"
                          className="form-control"
                          maxLength={30}
                          placeholder="Número"
                          value={form.oab}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="col-4 mb-3">
                        <label className="form-label small fw-bold">UF</label>
                        <input
                          type="text"
                          name="sigla_oab"
                          className="form-control"
                          maxLength={10}
                          placeholder="SP"
                          value={form.sigla_oab}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">Telefone (opcional)</label>
                      <input
                        type="tel"
                        name="telefone"
                        className="form-control"
                        maxLength={30}
                        placeholder="(11) 98765-4321"
                        value={form.telefone}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">Escritório (opcional)</label>
                      <input
                        type="text"
                        name="escritorio"
                        className="form-control"
                        maxLength={200}
                        value={form.escritorio}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="mb-4">
                      <label className="form-label small fw-bold">
                        Mensagem (opcional)
                        <span className="text-muted fw-normal ms-2">
                          — quantos casos ativos, quais tribunais, etc.
                        </span>
                      </label>
                      <textarea
                        name="mensagem"
                        className="form-control"
                        rows={3}
                        maxLength={2000}
                        value={form.mensagem}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="d-grid">
                      <button
                        type="submit"
                        className="btn btn-primary btn-lg rounded-pill"
                        disabled={enviando}
                      >
                        {enviando ? 'Enviando...' : 'Enviar solicitação'}
                      </button>
                    </div>

                    <p className="text-center text-muted small mt-3 mb-0">
                      Análise individual · resposta em até 48h · convite por email
                    </p>
                  </form>
                )}
              </div>
            </div>

            <p className="text-center mt-3">
              <Link to="/" className="text-decoration-none text-secondary small">
                ← Voltar para a página inicial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
