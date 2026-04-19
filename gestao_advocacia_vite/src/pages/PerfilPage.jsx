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
  const [historico, setHistorico] = useState([])

  useEffect(() => {
    const carregarHistorico = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${API_URL}/auth/me/historico-login?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error('Falha ao carregar histórico de login.')
        }

        const data = await response.json()
        setHistorico(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error(error)
        toast.error('Não foi possível carregar seu histórico de acesso.')
      } finally {
        setLoading(false)
      }
    }

    carregarHistorico()
  }, [])

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
