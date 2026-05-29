import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { API_URL } from '../config'

function maskIp(ip) {
  if (!ip) return '-'
  const parts = String(ip).trim().split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`
  }
  return `${String(ip).slice(0, 8)}*`
}

function formatDate(value) {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('pt-BR')
}

function PerfilPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nome_completo: '',
    numero_oab: '',
    sigla_oab_tribunal: '',
    cpf: '',
    notif_email_vencimentos: true,
  })
  const [historico, setHistorico] = useState([])

  const cpfPreenchido = Boolean(form.cpf)

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const headers = { Authorization: `Bearer ${token}` }

        const [resPerfil, resHist] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { headers }),
          fetch(`${API_URL}/auth/me/historico-login?limit=10`, { headers }),
        ])

        if (resPerfil.ok) {
          const data = await resPerfil.json()
          setForm({
            nome_completo: data.nome_completo || '',
            numero_oab: data.numero_oab || '',
            sigla_oab_tribunal: data.sigla_oab_tribunal || '',
            cpf: data.cpf || '',
            notif_email_vencimentos: data.notif_email_vencimentos !== false,
          })
        } else {
          toast.error('Não foi possível carregar seus dados de perfil.')
        }

        if (resHist.ok) {
          const data = await resHist.json()
          setHistorico(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error(error)
        toast.error('Erro de comunicação ao carregar perfil.')
      } finally {
        setLoading(false)
      }
    }

    carregar()
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const token = localStorage.getItem('token')
      const payload = {
        nome_completo: form.nome_completo || null,
        numero_oab: form.numero_oab || null,
        sigla_oab_tribunal: form.sigla_oab_tribunal || null,
        notif_email_vencimentos: form.notif_email_vencimentos,
      }

      if (!cpfPreenchido && form.cpf) {
        payload.cpf = form.cpf
      }

      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.message || 'Falha ao salvar perfil.')
        return
      }

      const userRaw = localStorage.getItem('user')
      const userData = userRaw ? JSON.parse(userRaw) : {}
      localStorage.setItem('user', JSON.stringify({ ...userData, ...data }))

      setForm((prev) => ({ ...prev, cpf: data.cpf || prev.cpf }))
      toast.success('Perfil atualizado com sucesso!')
    } catch (error) {
      console.error(error)
      toast.error('Erro de comunicação ao salvar perfil.')
    } finally {
      setSaving(false)
    }
  }

  const rows = useMemo(() => {
    return historico.map((item) => ({
      id: item.id,
      data: formatDate(item.criado_em),
      ipMask: maskIp(item.ip),
      sucesso: Boolean(item.sucesso),
      motivo: item.motivo_falha || '-',
    }))
  }, [historico])

  return (
    <div className="container-fluid p-4" style={{ maxWidth: '980px' }}>
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-header bg-white border-bottom p-4">
          <h5 className="mb-1 fw-bold">Meu Perfil Profissional</h5>
          <p className="text-muted small mb-0">
            Atualize seus dados de advogado vinculados ao usuário autenticado.
          </p>
        </div>
        <div className="card-body p-4">
          {loading ? (
            <div className="text-center py-5 text-muted">Carregando perfil...</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-semibold">Nome Completo</label>
                  <input
                    type="text"
                    name="nome_completo"
                    className="form-control"
                    value={form.nome_completo}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="col-md-7">
                  <label className="form-label fw-semibold">Número OAB</label>
                  <input
                    type="text"
                    name="numero_oab"
                    className="form-control"
                    value={form.numero_oab}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="col-md-5">
                  <label className="form-label fw-semibold">UF OAB</label>
                  <input
                    type="text"
                    name="sigla_oab_tribunal"
                    className="form-control"
                    maxLength={2}
                    value={form.sigla_oab_tribunal}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">CPF</label>
                  <input
                    type="text"
                    name="cpf"
                    className="form-control"
                    value={form.cpf}
                    onChange={handleChange}
                    disabled={saving || cpfPreenchido}
                    readOnly={cpfPreenchido}
                  />
                  {cpfPreenchido && (
                    <small className="text-muted">CPF já cadastrado e bloqueado para edição.</small>
                  )}
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold mb-2">Notificações</label>
                  <div className="form-check form-switch">
                    <input
                      type="checkbox"
                      role="switch"
                      className="form-check-input"
                      id="notif_email_vencimentos"
                      name="notif_email_vencimentos"
                      checked={form.notif_email_vencimentos}
                      onChange={handleChange}
                      disabled={saving}
                    />
                    <label className="form-check-label" htmlFor="notif_email_vencimentos">
                      Receber e-mail sobre recebimentos e despesas a vencer
                    </label>
                  </div>
                  <small className="text-muted">
                    As notificações no sino (🔔) continuam ativas independente desta opção.
                  </small>
                </div>
              </div>

              <div className="d-flex justify-content-end mt-4 pt-3 border-top">
                <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-header bg-white border-bottom p-4">
          <h5 className="mb-1 fw-bold">Histórico de acesso</h5>
          <p className="text-muted small mb-0">
            Últimos 10 eventos de login da sua conta (IP mascarado para privacidade).
          </p>
        </div>

        <div className="card-body p-4">
          {loading ? (
            <div className="text-center py-5 text-muted">Carregando histórico...</div>
          ) : rows.length === 0 ? (
            <div className="alert alert-light border text-muted mb-0" role="alert">
              Nenhum login registrado ainda.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>IP aproximado</th>
                    <th>Status</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.data}</td>
                      <td>{row.ipMask}</td>
                      <td>
                        <span className={`badge ${row.sucesso ? 'bg-success' : 'bg-danger'}`}>
                          {row.sucesso ? 'Sucesso' : 'Falha'}
                        </span>
                      </td>
                      <td>{row.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PerfilPage
