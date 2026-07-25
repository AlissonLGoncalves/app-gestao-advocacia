// Fase 3 (caso como hub) — recebimentos do caso na aba Financeiro.
//
// Padrão Astrea: o lançamento nasce e é VISTO no contexto jurídico; a
// baixa/cobrança continua no módulo Recebimentos. Aqui o advogado vê as
// parcelas do caso (pagas/pendentes/vencidas) sem sair do processo.
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'react-toastify'
import { API_URL } from '../config.js'

function fmtBRL(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso) {
  if (!iso) return '—'
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

function statusDe(r) {
  if (r.recebido) return { label: 'Pago', cls: 'bg-success' }
  const venc = r.data_recebimento ? String(r.data_recebimento).slice(0, 10) : null
  const hoje = new Date().toISOString().slice(0, 10)
  if (venc && venc < hoje) return { label: 'Vencido', cls: 'bg-danger' }
  return { label: 'Aberto', cls: 'bg-warning text-dark' }
}

function RecebimentosCasoCard({ casoId }) {
  const [recebimentos, setRecebimentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/recebimentos/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const lista = Array.isArray(data) ? data : data?.items || []
        setRecebimentos(lista.filter((r) => r.caso_id === parseInt(casoId, 10)))
      })
      .catch(() => toast.error('Erro ao carregar recebimentos do caso.'))
      .finally(() => setLoading(false))
  }, [casoId])

  const totais = useMemo(() => {
    let recebido = 0
    let pendente = 0
    for (const r of recebimentos) {
      const v = Number(r.valor) || 0
      if (r.recebido) recebido += v
      else pendente += v
    }
    return { recebido, pendente }
  }, [recebimentos])

  return (
    <div className="card shadow-lg mb-4 border-0 rounded-lg" data-testid="recebimentos-caso-card">
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
        <h5 className="card-title mb-0 text-primary fw-bold">Recebimentos do caso</h5>
        <Link to="/recebimentos" className="btn btn-sm btn-outline-secondary">
          Gerenciar em Recebimentos
        </Link>
      </div>
      <div className="card-body">
        {loading ? (
          <p className="text-muted mb-0">Carregando...</p>
        ) : recebimentos.length === 0 ? (
          <p className="text-muted fst-italic mb-0">
            Nenhuma parcela deste caso ainda — crie um contrato acima e use &ldquo;Gerar
            parcelas&rdquo;.
          </p>
        ) : (
          <>
            <div className="d-flex gap-3 mb-3 small">
              <span className="badge bg-success-subtle text-success-emphasis px-3 py-2">
                Recebido: <strong>{fmtBRL(totais.recebido)}</strong>
              </span>
              <span className="badge bg-warning-subtle text-warning-emphasis px-3 py-2">
                Pendente: <strong>{fmtBRL(totais.pendente)}</strong>
              </span>
            </div>
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Descrição</th>
                    <th>Vencimento</th>
                    <th className="text-end">Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recebimentos.map((r) => {
                    const st = statusDe(r)
                    return (
                      <tr key={r.id}>
                        <td>{r.descricao}</td>
                        <td>{fmtData(r.data_recebimento)}</td>
                        <td className="text-end">{fmtBRL(r.valor)}</td>
                        <td>
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default RecebimentosCasoCard
