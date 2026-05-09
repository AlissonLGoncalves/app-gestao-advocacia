// Epic #5 (#179): triagem em lote de CNJs.
// Inspirado no Astrea ("Busca de processo automatica > Pelo numero CNJ"),
// permite colar varios numeros e ver o status de cada um.

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { importarCnjsEmLote } from '../api/casos.js'

const MAX_CNJS = 40

const STATUS_META = {
  valido: {
    label: 'Pronto para adicionar',
    cor: 'success',
    Icon: CheckCircleIcon,
  },
  duplicado: {
    label: 'Duplicado',
    cor: 'warning',
    Icon: DocumentDuplicateIcon,
  },
  invalido: {
    label: 'Inválido',
    cor: 'danger',
    Icon: ExclamationCircleIcon,
  },
}

const MOTIVO_LEGIVEL = {
  pronto_para_adicionar: 'Pronto para buscar dados no tribunal.',
  ja_existe_no_tenant: 'Já existe caso com este número neste escritório.',
  duplicado_no_lote: 'Repetido na mesma lista.',
  tipo_invalido: 'Não é texto.',
  tamanho_invalido: 'Deve ter 20 dígitos (após remover pontuação).',
  formato_invalido: 'Formato CNJ inválido.',
  dv_invalido: 'Dígito verificador inválido.',
}

function ImportarCnjsPage() {
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const cnjsExtraidos = texto
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const excedeu = cnjsExtraidos.length > MAX_CNJS

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (cnjsExtraidos.length === 0) {
      toast.warn('Cole pelo menos um número CNJ.')
      return
    }
    if (excedeu) {
      toast.warn(`Máximo de ${MAX_CNJS} CNJs por requisição. Você enviou ${cnjsExtraidos.length}.`)
      return
    }

    setEnviando(true)
    try {
      const data = await importarCnjsEmLote(cnjsExtraidos)
      setResultado(data)
      const { stats } = data
      toast.success(
        `Triagem concluída: ${stats.valido} válido(s), ${stats.duplicado} duplicado(s), ${stats.invalido} inválido(s).`
      )
    } catch (err) {
      toast.error(err.message || 'Falha ao processar lista.')
    } finally {
      setEnviando(false)
    }
  }

  const handleLimpar = () => {
    setTexto('')
    setResultado(null)
  }

  const renderResultado = () => {
    if (!resultado) return null

    return (
      <div className="card shadow-sm">
        <div className="card-header bg-light py-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h6 className="mb-1">Resultado da triagem</h6>
              <small className="text-muted">{resultado.total} processo(s) analisado(s)</small>
            </div>
            <div className="d-flex gap-3">
              <span className="badge bg-success-subtle text-success-emphasis">
                {resultado.stats.valido} válidos
              </span>
              <span className="badge bg-warning-subtle text-warning-emphasis">
                {resultado.stats.duplicado} duplicados
              </span>
              <span className="badge bg-danger-subtle text-danger-emphasis">
                {resultado.stats.invalido} inválidos
              </span>
            </div>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>CNJ</th>
                <th>Status</th>
                <th>Detalhe</th>
                <th className="text-center" style={{ width: 120 }}>
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {resultado.resultados.map((r, idx) => {
                const meta = STATUS_META[r.status] || STATUS_META.invalido
                const Icon = meta.Icon
                const detalhe = MOTIVO_LEGIVEL[r.motivo] || r.motivo
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <code style={{ fontSize: '0.85rem' }}>
                        {r.cnj_normalizado || r.cnj_input}
                      </code>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`badge bg-${meta.cor}-subtle text-${meta.cor}-emphasis d-inline-flex align-items-center gap-1`}
                      >
                        <Icon style={{ width: 12, height: 12 }} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 small text-muted">
                      {detalhe}
                      {r.caso_titulo && (
                        <>
                          <br />
                          <em className="text-muted">→ {r.caso_titulo}</em>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.status === 'duplicado' && r.caso_id ? (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigate(`/casos/detalhe/${r.caso_id}`)}
                        >
                          Ver caso
                        </button>
                      ) : r.status === 'valido' ? (
                        <span
                          className="text-muted small"
                          title="Busca automática no tribunal será implementada no Epic #12"
                        >
                          —
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="container-fluid p-3 p-md-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-1 d-flex align-items-center gap-2">
            <ArrowUpTrayIcon style={{ width: 22, height: 22 }} />
            Importar CNJs em lote
          </h4>
          <p className="text-muted small mb-0">
            Cole até {MAX_CNJS} números CNJ separados por vírgula, ponto-e-vírgula ou linha.
            Validamos e checamos duplicidade contra os processos já cadastrados.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => navigate('/casos')}
        >
          ← Voltar para Casos
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card shadow-sm mb-4">
        <div className="card-body">
          <label htmlFor="cnjs-input" className="form-label fw-semibold">
            Números CNJ
          </label>
          <textarea
            id="cnjs-input"
            className={`form-control font-monospace ${excedeu ? 'is-invalid' : ''}`}
            rows={10}
            placeholder={
              '0000472-75.2025.8.16.0075\n00012345620248160075\n0000001-84.2020.8.26.0001'
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={enviando}
            style={{ fontSize: '0.9rem' }}
          />
          <div className="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
            <small className={excedeu ? 'text-danger fw-semibold' : 'text-muted'}>
              {cnjsExtraidos.length} de {MAX_CNJS} CNJ(s) detectado(s)
              {excedeu && ` — limite excedido em ${cnjsExtraidos.length - MAX_CNJS}`}
            </small>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleLimpar}
                disabled={enviando || (!texto && !resultado)}
              >
                Limpar
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                disabled={enviando || cnjsExtraidos.length === 0 || excedeu}
              >
                {enviando ? (
                  <>
                    <ArrowPathIcon
                      style={{ width: 14, height: 14 }}
                      className="spinner-icon-rotate"
                    />
                    Processando…
                  </>
                ) : (
                  <>Triagem</>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {renderResultado()}
    </div>
  )
}

export default ImportarCnjsPage
