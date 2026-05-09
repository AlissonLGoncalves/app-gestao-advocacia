import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import {
  DocumentTextIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { API_URL } from '../config.js'

/**
 * Card lateral que lista procuracoes e contratos vinculados ao caso (e ao cliente do caso).
 * Cada documento tem botao de Visualizar (modal com iframe) e Baixar (fetch + Blob).
 *
 * Inspirado no card "Documentos" do detalhe do processo no Astrea.
 */
function DocumentosVinculadosCard({ casoId }) {
  const [data, setData] = useState({ procuracoes: [], contratos: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewerUrl, setViewerUrl] = useState(null)
  const [viewerTitulo, setViewerTitulo] = useState('')

  const carregar = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setError('Autenticacao necessaria.')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`${API_URL}/casos/${casoId}/documentos`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Falha ao carregar documentos (${res.status})`)
      }
      const json = await res.json()
      setData({
        procuracoes: json.procuracoes || [],
        contratos: json.contratos || [],
      })
    } catch (err) {
      console.error('DocumentosVinculadosCard: erro', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [casoId])

  useEffect(() => {
    if (casoId) carregar()
  }, [casoId, carregar])

  const buscarBlobAutenticado = async (url) => {
    const token = localStorage.getItem('token')
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.message || `Erro ${res.status}`)
    }
    return await res.blob()
  }

  const visualizar = async (tipo, id, titulo) => {
    try {
      const url = `${API_URL}/${tipo}/${id}/arquivo`
      const blob = await buscarBlobAutenticado(url)
      const objectUrl = URL.createObjectURL(blob)
      setViewerUrl(objectUrl)
      setViewerTitulo(titulo)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const baixar = async (tipo, id, nomeArquivo) => {
    try {
      const url = `${API_URL}/${tipo}/${id}/arquivo?download=1`
      const blob = await buscarBlobAutenticado(url)
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = nomeArquivo || `${tipo}-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const fecharViewer = () => {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl)
    setViewerUrl(null)
    setViewerTitulo('')
  }

  const formatarData = (iso) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleDateString('pt-BR')
    } catch {
      return iso
    }
  }

  const renderItem = (item, tipo, descricao) => {
    const temPdf = item.tem_pdf
    const id = item.id
    const tituloVisualizacao =
      tipo === 'procuracoes'
        ? `Procuracao #${id}`
        : `Contrato #${id} - ${item.tipo_honorario || ''}`
    const nomeDownload =
      tipo === 'procuracoes'
        ? item.dados_extraidos?.arquivo_original_nome || `procuracao-${id}.pdf`
        : item.arquivo_nome || `contrato-${id}.pdf`

    return (
      <li key={`${tipo}-${id}`} className="list-group-item px-3 py-2">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="text-truncate small fw-semibold">{descricao}</div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              {tipo === 'contratos' && item.data_assinatura && (
                <span>Assinado em {formatarData(item.data_assinatura)} • </span>
              )}
              {tipo === 'procuracoes' && item.criado_em && (
                <span>Analisado em {formatarData(item.criado_em)} • </span>
              )}
              {temPdf ? (
                <span className="text-success">PDF disponivel</span>
              ) : (
                <span className="text-warning">
                  <ExclamationTriangleIcon
                    style={{ width: 12, height: 12, display: 'inline', verticalAlign: '-1px' }}
                  />{' '}
                  PDF nao anexado
                </span>
              )}
            </div>
          </div>
          <div className="d-flex gap-1 flex-shrink-0">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary p-1 lh-1"
              title={temPdf ? 'Visualizar PDF' : 'PDF nao disponivel'}
              disabled={!temPdf}
              onClick={() => visualizar(tipo, id, tituloVisualizacao)}
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <EyeIcon style={{ width: 14, height: 14 }} />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary p-1 lh-1"
              title={temPdf ? 'Baixar PDF' : 'PDF nao disponivel'}
              disabled={!temPdf}
              onClick={() => baixar(tipo, id, nomeDownload)}
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowDownTrayIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </li>
    )
  }

  if (loading) {
    return (
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-light py-2 px-3">
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <DocumentTextIcon style={{ width: 16, height: 16 }} />
            Documentos
          </h6>
        </div>
        <div className="card-body p-3 text-center text-muted small">Carregando documentos...</div>
      </div>
    )
  }

  const totalDocs = data.procuracoes.length + data.contratos.length

  return (
    <>
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-light py-2 px-3 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <DocumentTextIcon style={{ width: 16, height: 16 }} />
            Documentos
            {totalDocs > 0 && (
              <span className="badge bg-secondary-subtle text-secondary-emphasis fs-xs">
                {totalDocs}
              </span>
            )}
          </h6>
        </div>
        <div className="card-body p-0">
          {error && (
            <div className="alert alert-danger m-2 small mb-0" role="alert">
              {error}
            </div>
          )}
          {!error && totalDocs === 0 && (
            <div className="text-center text-muted small p-3">
              Nenhuma procuracao ou contrato vinculado a este caso ou cliente.
            </div>
          )}
          {data.procuracoes.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 small text-muted fw-semibold">
                Procuracoes ({data.procuracoes.length})
              </div>
              <ul className="list-group list-group-flush">
                {data.procuracoes.map((p) => {
                  const proc = p.dados_extraidos?.processo || {}
                  const desc =
                    proc.numero_cnj || `Procuracao analisada em ${formatarData(p.criado_em)}`
                  return renderItem(p, 'procuracoes', desc)
                })}
              </ul>
            </>
          )}
          {data.contratos.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 small text-muted fw-semibold">
                Contratos ({data.contratos.length})
              </div>
              <ul className="list-group list-group-flush">
                {data.contratos.map((c) => {
                  const desc = `${c.tipo_honorario}${
                    c.valor_total
                      ? ` - R$ ${parseFloat(c.valor_total).toLocaleString('pt-BR')}`
                      : ''
                  }${c.percentual_exito ? ` (${c.percentual_exito}%)` : ''}`
                  return renderItem(c, 'contratos', desc)
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      {viewerUrl && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title">{viewerTitulo}</h6>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Fechar"
                  onClick={fecharViewer}
                />
              </div>
              <div className="modal-body p-0" style={{ height: '80vh' }}>
                <iframe
                  src={viewerUrl}
                  title={viewerTitulo}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default DocumentosVinculadosCard
