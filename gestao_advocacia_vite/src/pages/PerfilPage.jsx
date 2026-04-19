import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { API_URL } from '../config'

function PerfilPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nome_completo: '',
    numero_oab: '',
    sigla_oab_tribunal: '',
    cpf: '',
  })

  const cpfPreenchido = Boolean(form.cpf)

  useEffect(() => {
    const carregarPerfil = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error('Falha ao carregar perfil.')
        }

        const data = await response.json()
        setForm({
          nome_completo: data.nome_completo || '',
          numero_oab: data.numero_oab || '',
          sigla_oab_tribunal: data.sigla_oab_tribunal || '',
          cpf: data.cpf || '',
        })
      } catch (error) {
        console.error(error)
        toast.error('Não foi possível carregar seus dados de perfil.')
      } finally {
        setLoading(false)
      }
    }

    carregarPerfil()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
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

  return (
    <div className="container-fluid p-4" style={{ maxWidth: '960px' }}>
      <div className="card border-0 shadow-sm rounded-4">
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
    </div>
  )
}

export default PerfilPage
