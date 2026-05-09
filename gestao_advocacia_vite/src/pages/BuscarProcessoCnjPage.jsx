// Epic #12 (#186): busca on-demand de processo via CNJ.
// Inspirado no Astrea ('Busca de processo automatica > Pelo numero CNJ').

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline'
import { buscarProcessoOnDemand } from '../api/casos.js'

const ERRO_LEGIVEL = {
  cnj_invalido: 'Número CNJ inválido. Verifique e tente novamente.',
  tribunal_nao_suportado: 'Este tribunal ainda não é suportado pela busca automática.',
  sem_adapter: 'Sem adapter configurado para este tribunal.',
  tribunal_indisponivel: 'O tribunal está fora do ar. Tente novamente em instantes.',
  tribunal_erro_cliente: 'Tribunal recusou a consulta. Verifique o número.',
  nao_encontrado: 'Processo não encontrado nos registros públicos.',
  adapter_exception: 'Erro inesperado ao consultar o tribunal.',
  missing_cnj: 'Informe o número CNJ.',
}

function BuscarProcessoCnjPage() {
  const navigate = useNavigate()
  const [cnj, setCnj] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cnj.trim()) {
      toast.warn('Informe o número CNJ.')
      return
    }
    setBuscando(true)
    setResposta(null)
    try {
      const data = await buscarProcessoOnDemand(cnj.trim())
      setResposta(data)
      if (data.resultado?.sucesso) {
        toast.success('Processo encontrado.')
      } else if (data.code) {
        toast.warn(ERRO_LEGIVEL[data.code] || data.message || 'Falha na busca.')
      } else if (data.resultado?.erro_codigo) {
        toast.warn(ERRO_LEGIVEL[data.resultado.erro_codigo] || data.resultado.erro)
      }
    } catch (err) {
      // Erro HTTP — pega body se for JSON estruturado
      const body = err.body || {}
      const msg = ERRO_LEGIVEL[body.code] || err.message || 'Erro inesperado.'
      toast.error(msg)
      setResposta({ erro_request: msg, body })
    } finally {
      setBuscando(false)
    }
  }

  const renderTribunal = () => {
    if (!resposta?.tribunal) return null
    const t = resposta.tribunal
    return (
      <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2">
        <BuildingLibraryIcon style={{ width: 16, height: 16 }} />
        <span>
          Tribunal detectado: <strong>{t.tribunal_nome || t.tribunal_codigo}</strong>
          {t.segmento_nome && <span className="text-muted ms-1">({t.segmento_nome})</span>}
        </span>
      </div>
    )
  }

  const renderResultado = () => {
    if (!resposta?.resultado) return null
    const r = resposta.resultado
    if (!r.sucesso) {
      return (
        <div className="alert alert-warning d-flex gap-2 align-items-start">
          <ExclamationTriangleIcon style={{ width: 20, height: 20, flexShrink: 0 }} />
          <div>
            <div className="fw-semibold">{ERRO_LEGIVEL[r.erro_codigo] || 'Falha na busca.'}</div>
            {r.erro && <div className="small text-muted">{r.erro}</div>}
          </div>
        </div>
      )
    }
    return (
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-success-subtle py-2 px-3 d-flex align-items-center gap-2">
          <CheckCircleIcon style={{ width: 16, height: 16 }} className="text-success" />
          <h6 className="mb-0">Processo encontrado</h6>
          {r.fonte && <span className="badge bg-light text-muted ms-auto">via {r.fonte}</span>}
        </div>
        <div className="card-body">
          {r.titulo_sugerido && <h5 className="mb-3">{r.titulo_sugerido}</h5>}
          <dl className="row mb-0 small">
            <dt className="col-sm-3">Número CNJ</dt>
            <dd className="col-sm-9">
              <code>{r.cnj_normalizado}</code>
            </dd>
            {r.classe_acao && (
              <>
                <dt className="col-sm-3">Classe / Ação</dt>
                <dd className="col-sm-9">{r.classe_acao}</dd>
              </>
            )}
            {r.vara_juizo && (
              <>
                <dt className="col-sm-3">Vara / Juízo</dt>
                <dd className="col-sm-9">{r.vara_juizo}</dd>
              </>
            )}
            {r.instancia && (
              <>
                <dt className="col-sm-3">Instância</dt>
                <dd className="col-sm-9">{r.instancia}</dd>
              </>
            )}
            {r.data_distribuicao && (
              <>
                <dt className="col-sm-3">Distribuição</dt>
                <dd className="col-sm-9">{r.data_distribuicao}</dd>
              </>
            )}
            {r.valor_causa && (
              <>
                <dt className="col-sm-3">Valor da causa</dt>
                <dd className="col-sm-9">R$ {r.valor_causa}</dd>
              </>
            )}
          </dl>

          {(r.polo_ativo?.length > 0 || r.polo_passivo?.length > 0) && (
            <div className="row mt-3">
              <div className="col-md-6">
                <h6 className="small text-muted">Polo Ativo</h6>
                <ul className="list-unstyled small">
                  {(r.polo_ativo || []).map((p, idx) => (
                    <li key={idx}>{p.nome}</li>
                  ))}
                </ul>
              </div>
              <div className="col-md-6">
                <h6 className="small text-muted">Polo Passivo</h6>
                <ul className="list-unstyled small">
                  {(r.polo_passivo || []).map((p, idx) => (
                    <li key={idx}>{p.nome}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {r.movimentacoes?.length > 0 && (
            <details className="mt-3">
              <summary className="small text-muted">
                Últimas {r.movimentacoes.length} movimentações
              </summary>
              <ul className="list-unstyled small mt-2 ps-3">
                {r.movimentacoes.map((m, idx) => (
                  <li key={idx} className="mb-1">
                    <span className="text-muted">
                      {m.data_hora ? m.data_hora.slice(0, 10) : ''}
                    </span>{' '}
                    {m.descricao}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    )
  }

  const renderJaCadastrado = () => {
    if (!resposta?.ja_cadastrado) return null
    const j = resposta.ja_cadastrado
    return (
      <div className="alert alert-warning d-flex justify-content-between align-items-center">
        <span>
          Este processo já está cadastrado: <strong>{j.titulo}</strong>
        </span>
        <button
          className="btn btn-sm btn-outline-warning"
          onClick={() => navigate(`/casos/detalhe/${j.caso_id}`)}
        >
          Abrir caso
        </button>
      </div>
    )
  }

  return (
    <div className="container-fluid p-3 p-md-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-1 d-flex align-items-center gap-2">
            <MagnifyingGlassIcon style={{ width: 22, height: 22 }} />
            Buscar processo no tribunal
          </h4>
          <p className="text-muted small mb-0">
            Cole o número CNJ. O sistema detecta o tribunal e busca os dados públicos.
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
          <label htmlFor="cnj-input" className="form-label fw-semibold">
            Número CNJ
          </label>
          <div className="input-group">
            <input
              id="cnj-input"
              type="text"
              className="form-control font-monospace"
              placeholder="0000000-00.0000.0.00.0000 ou 20 dígitos"
              value={cnj}
              onChange={(e) => setCnj(e.target.value)}
              disabled={buscando}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary d-inline-flex align-items-center gap-1"
              disabled={buscando || !cnj.trim()}
            >
              {buscando ? (
                <>
                  <ArrowPathIcon
                    style={{ width: 14, height: 14 }}
                    className="spinner-icon-rotate"
                  />
                  Buscando…
                </>
              ) : (
                <>Buscar</>
              )}
            </button>
          </div>
          <small className="text-muted mt-2 d-block">
            Suporta tribunais estaduais (TJs), TRFs e TRTs via DataJud/CNJ.
          </small>
        </div>
      </form>

      {renderTribunal()}
      {renderJaCadastrado()}
      {renderResultado()}
    </div>
  )
}

export default BuscarProcessoCnjPage
