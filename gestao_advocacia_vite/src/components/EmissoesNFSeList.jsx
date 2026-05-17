// src/components/EmissoesNFSeList.jsx
// Lista de todas as NFS-e emitidas pelo tenant. Usa o endpoint
// GET /api/v1/nfse/emissoes (ja existente) e mostra filtros por status
// + acoes por linha (baixar PDF, copiar chave, cancelar).
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  DocumentArrowDownIcon,
  ClipboardDocumentIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { listEmissoesNFSe } from '../api/nfse.js'
import CancelarNFSeModal from './CancelarNFSeModal.jsx'

const STATUS_BADGE = {
  Autorizada: { cor: 'bg-success', label: 'Autorizada' },
  EmProcessamento: { cor: 'bg-info text-dark', label: 'Em Processamento' },
  Pendente: { cor: 'bg-secondary', label: 'Pendente' },
  Rejeitada: { cor: 'bg-danger', label: 'Rejeitada' },
  Cancelada: { cor: 'bg-dark', label: 'Cancelada' },
}

const STATUS_ORDEM = ['Todos', 'Autorizada', 'EmProcessamento', 'Pendente', 'Rejeitada', 'Cancelada']

const formatDataHoraBR = (iso) => {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  } catch {
    return iso
  }
}

const truncarChave = (chave) => {
  if (!chave) return '-'
  const s = String(chave)
  if (s.length <= 16) return s
  return `${s.slice(0, 6)}...${s.slice(-6)}`
}

function EmissoesNFSeList() {
  const navigate = useNavigate()
  const [emissoes, setEmissoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  // PR 4: modal de cancelamento. emissaoParaCancelar=null => modal fechado.
  const [emissaoParaCancelar, setEmissaoParaCancelar] = useState(null)

  const recarregar = async () => {
    setLoading(true)
    setErro('')
    try {
      const data = await listEmissoesNFSe()
      setEmissoes(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('EmissoesNFSeList: erro ao carregar', e)
      setErro(e?.message || 'Falha ao carregar emissões.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    recarregar()
  }, [])

  const filtradas = useMemo(() => {
    if (filtroStatus === 'Todos') return emissoes
    return emissoes.filter((e) => e.status === filtroStatus)
  }, [emissoes, filtroStatus])

  const handleCopiarChave = (chave) => {
    if (!chave) return
    navigator.clipboard
      ?.writeText(String(chave))
      .then(() => toast.success('Chave copiada.'))
      .catch(() => toast.error('Não foi possível copiar.'))
  }

  if (loading && emissoes.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
        <span className="ms-3 text-muted">Carregando emissões...</span>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="alert alert-danger" role="alert">
        {erro}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary ms-3"
          onClick={recarregar}
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="btn-group" role="group" aria-label="Filtro por status">
          {STATUS_ORDEM.map((s) => {
            const ativo = filtroStatus === s
            return (
              <button
                key={s}
                type="button"
                className={`btn btn-sm ${ativo ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setFiltroStatus(s)}
              >
                {s === 'EmProcessamento' ? 'Em Processamento' : s}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={recarregar}
          disabled={loading}
        >
          <ArrowPathIcon style={{ width: 14, height: 14 }} className="me-1" />
          Atualizar
        </button>
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center text-muted py-5">
          {filtroStatus === 'Todos'
            ? 'Nenhuma NFS-e emitida ainda. Vá ao Histórico de Pagamentos Recebidos e clique em "Emitir NFS-e" em algum recebimento pago.'
            : `Nenhuma emissão com status "${filtroStatus}".`}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead className="table-light">
              <tr>
                <th>Data</th>
                <th>Recebimento</th>
                <th>Número / Série</th>
                <th>Chave de acesso</th>
                <th>Status</th>
                <th>Tentativas</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e) => {
                const cfg = STATUS_BADGE[e.status] || { cor: 'bg-secondary', label: e.status }
                return (
                  <tr key={e.id}>
                    <td className="text-nowrap small">{formatDataHoraBR(e.created_at)}</td>
                    <td>
                      {e.recebimento_id ? (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0"
                          onClick={() =>
                            navigate(`/recebimentos/editar/${e.recebimento_id}`)
                          }
                          title="Abrir recebimento"
                        >
                          #{e.recebimento_id}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {e.numero_nfse ? (
                        <>
                          <strong>{e.numero_nfse}</strong>
                          {e.serie && (
                            <span className="text-muted small ms-1">/ {e.serie}</span>
                          )}
                          {e.codigo_verificacao && (
                            <div className="small text-muted">
                              cod: {e.codigo_verificacao}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {e.gateway_id ? (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 font-monospace text-decoration-none"
                          onClick={() => handleCopiarChave(e.gateway_id)}
                          title={e.gateway_id}
                        >
                          {truncarChave(e.gateway_id)}{' '}
                          <ClipboardDocumentIcon style={{ width: 12, height: 12 }} />
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${cfg.cor}`} title={e.mensagem_erro || ''}>
                        {cfg.label}
                      </span>
                      {e.mensagem_erro && e.status !== 'Autorizada' && (
                        <div
                          className="small text-muted mt-1"
                          style={{ maxWidth: 280 }}
                          title={e.mensagem_erro}
                        >
                          {e.mensagem_erro.length > 80
                            ? `${e.mensagem_erro.slice(0, 80)}...`
                            : e.mensagem_erro}
                        </div>
                      )}
                    </td>
                    <td className="text-center">{e.tentativas ?? 1}</td>
                    <td>
                      <div className="d-flex gap-1">
                        {e.pdf_url && (
                          <a
                            href={e.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-primary btn-sm"
                            title="Baixar DANFSe (PDF)"
                          >
                            <DocumentArrowDownIcon
                              style={{ width: 14, height: 14 }}
                            />
                          </a>
                        )}
                        {e.status === 'Autorizada' && (
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            title="Cancelar NFS-e"
                            onClick={() => setEmissaoParaCancelar(e)}
                          >
                            <XCircleIcon style={{ width: 14, height: 14 }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="text-muted small mt-2">
            Mostrando {filtradas.length} de {emissoes.length} emiss
            {emissoes.length === 1 ? 'ão' : 'ões'}.
          </div>
        </div>
      )}

      <CancelarNFSeModal
        emissao={emissaoParaCancelar}
        onClose={() => setEmissaoParaCancelar(null)}
        onSucesso={(atualizada) => {
          // Atualiza a linha no state local em vez de refetchar tudo
          setEmissoes((lista) =>
            lista.map((e) => (e.id === atualizada.id ? atualizada : e))
          )
        }}
      />
    </>
  )
}

export default EmissoesNFSeList
