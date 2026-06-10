// src/components/TratarPrazoModal.jsx
// Janela de "tratamento" de prazo (Onda 1).
//
// Diferente do ItemAgendaForm (que edita dados crus do prazo), este
// modal foca em REGISTRAR O QUE FOI FEITO com o prazo:
//   - "Cumpri / peticionei"      → marca Concluido + grava como_tratado
//   - "Cancelar (não era meu)"   → marca Cancelado + grava motivo
//   - "Reabrir"                  → volta pra Pendente (se ja tratado)
//   - "Editar dados"             → abre o ItemAgendaForm (caller decide)
//
// Feedback de produção do Emerson: "precisa ser uma janela para fazer o
// tratamento mesmo do prazo vencido, já ver se foi resolvido ou não".
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  BriefcaseIcon,
  CalendarIcon,
  NewspaperIcon,
  ClockIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline'
import { tratarItemAgenda, getHistoricoItemAgenda } from '../api/itensAgenda.js'
import { listModelos } from '../api/modelos.js'
import { getProvidencia, ordenarModelosPorProvidencia } from '../utils/providencia.js'
import PreviewModeloModal from './PreviewModeloModal.jsx'
import { API_URL } from '../config.js'

// Calcula dias relativos: positivo=vencido ha N dias, negativo=falta N dias
function diasRelativos(dataVencimento) {
  if (!dataVencimento) return null
  const data = new Date(String(dataVencimento).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(data.getTime())) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const ms = hoje - data
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function formatDataBR(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
    return d.toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

// Onda 2 — formata data/hora completa pra timeline
function formatDataHora(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// Onda 2 — traduz acao raw do AuditLog pra label legível ao usuário
const ACAO_LABEL = {
  item_agenda_concluir: '✓ Concluiu (atalho 1-click)',
  item_agenda_validar_prazo: '✓ Validou prazo (IA confirmado)',
  item_agenda_tratar_cumpri: '📝 Tratou — Cumpri / peticionei',
  item_agenda_tratar_cancelar: '🚫 Tratou — Cancelou prazo',
  item_agenda_tratar_reabrir: '🔄 Tratou — Reabriu prazo',
}
function formatAcao(acaoRaw) {
  return ACAO_LABEL[acaoRaw] || acaoRaw
}

const STATUS_LABEL = {
  Pendente: { texto: 'Pendente', cor: 'bg-secondary' },
  'Em Andamento': { texto: 'Em Andamento', cor: 'bg-info text-dark' },
  Concluido: { texto: 'Concluído', cor: 'bg-success' },
  Cancelado: { texto: 'Cancelado', cor: 'bg-dark' },
  // Fallback pros valores legados que possam ter ficado em cache
  'A Fazer': { texto: 'Pendente', cor: 'bg-secondary' },
  Fazendo: { texto: 'Em Andamento', cor: 'bg-info text-dark' },
  Concluído: { texto: 'Concluído', cor: 'bg-success' },
}

function TratarPrazoModal({ item, onTratado, onClose, onEditarDados }) {
  const [acaoSelecionada, setAcaoSelecionada] = useState(null) // 'cumpri' | 'cancelar' | 'reabrir' | null
  const [comoTratado, setComoTratado] = useState('')
  const [peticaoId, setPeticaoId] = useState('') // doc cumpridora
  const [docsDoCaso, setDocsDoCaso] = useState([])
  const [salvando, setSalvando] = useState(false)
  // Onda 2 — historico + sua expansao
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historico, setHistorico] = useState(null) // null=nao carregou, []=carregou-vazio, [...]=ok
  const [carregandoHist, setCarregandoHist] = useState(false)
  // Issue #304 — responder com peça: modelos + preview
  const [modelos, setModelos] = useState([])
  const [modeloSelId, setModeloSelId] = useState('')
  const [modeloPreview, setModeloPreview] = useState(null)

  // Pre-popula como_tratado com valor existente quando reabre o modal
  useEffect(() => {
    setComoTratado(item?.como_tratado || '')
    setPeticaoId(item?.peticao_cumpridora_id ? String(item.peticao_cumpridora_id) : '')
    setAcaoSelecionada(null)
    setHistoricoAberto(false)
    setHistorico(null)
  }, [item?.id])

  // Onda 2 — carrega documentos do caso pra select de peticao cumpridora.
  // So consultamos quando o item tem caso_id (sem caso, nao tem doc).
  useEffect(() => {
    if (!item?.caso_id) {
      setDocsDoCaso([])
      return
    }
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/documentos?caso_id=${item.caso_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDocsDoCaso(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.warn('TratarPrazoModal: erro ao buscar docs do caso', err)
      })
  }, [item?.caso_id])

  // Issue #304 — carrega modelos pro "Responder com peça" (só quando o
  // item tem caso vinculado: sem caso não há cliente pra preencher).
  // Ordena sugerindo primeiro os modelos que casam com a providência.
  useEffect(() => {
    if (!item?.caso_id) {
      setModelos([])
      return
    }
    listModelos()
      .then((data) => {
        const lista = Array.isArray(data) ? data : data?.items || []
        const ordenados = ordenarModelosPorProvidencia(lista, item?.tipo_providencia)
        setModelos(ordenados)
        setModeloSelId(ordenados.length ? String(ordenados[0].id) : '')
      })
      .catch((err) => {
        console.warn('TratarPrazoModal: erro ao listar modelos', err)
      })
  }, [item?.caso_id, item?.tipo_providencia])

  // Lazy-load do historico quando usuario expande
  const handleToggleHistorico = async () => {
    const novoEstado = !historicoAberto
    setHistoricoAberto(novoEstado)
    if (novoEstado && historico === null && !carregandoHist) {
      setCarregandoHist(true)
      try {
        const data = await getHistoricoItemAgenda(item.id)
        setHistorico(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('TratarPrazoModal: erro ao buscar historico', err)
        toast.error('Falha ao carregar histórico.')
        setHistorico([])
      } finally {
        setCarregandoHist(false)
      }
    }
  }

  if (!item) return null

  const dias = diasRelativos(item.data_vencimento || item.data_inicio)
  const vencido = dias !== null && dias > 0 && item.status === 'Pendente'
  const jaTratado = Boolean(item.tratado_em)
  // Issue #304 — providência detectada pelo calculador de prazo
  const providencia = getProvidencia(item.tipo_providencia)
  const statusLabel = STATUS_LABEL[item.status] || {
    texto: item.status,
    cor: 'bg-secondary',
  }

  const handleConfirmar = async () => {
    if (!acaoSelecionada) {
      toast.warning('Selecione uma ação acima.')
      return
    }
    if (acaoSelecionada !== 'reabrir' && !comoTratado.trim()) {
      toast.warning('Descreva como o prazo foi tratado.')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        acao: acaoSelecionada,
        como_tratado: comoTratado.trim() || null,
      }
      // Onda 2 — anexa petição cumpridora só se acao=cumpri e foi selecionada
      if (acaoSelecionada === 'cumpri' && peticaoId) {
        payload.peticao_cumpridora_id = parseInt(peticaoId, 10)
      }
      await tratarItemAgenda(item.id, payload)
      const msg =
        acaoSelecionada === 'cumpri'
          ? 'Prazo marcado como cumprido.'
          : acaoSelecionada === 'cancelar'
            ? 'Prazo cancelado.'
            : 'Prazo reaberto.'
      toast.success(msg)
      onTratado?.()
    } catch (err) {
      console.error('TratarPrazoModal: erro', err)
      toast.error(err?.message || 'Falha ao tratar prazo.')
    } finally {
      setSalvando(false)
    }
  }

  // Visual do header conforme estado: vermelho se vencido pendente,
  // verde se cumprido, cinza se outro.
  const headerClass = vencido
    ? 'bg-danger bg-opacity-10 border-bottom border-danger'
    : item.status === 'Concluido'
      ? 'bg-success bg-opacity-10 border-bottom border-success'
      : ''

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      role="dialog"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onClose?.()
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div className="modal-content">
          {/* Header — destaque visual conforme urgência */}
          <div className={`modal-header ${headerClass}`}>
            <div>
              <h5 className="modal-title mb-1">
                <CheckCircleIcon
                  style={{ width: 18, height: 18 }}
                  className="me-2 align-text-bottom d-inline"
                />
                Tratar prazo
              </h5>
              <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                <span className={`badge ${statusLabel.cor}`}>{statusLabel.texto}</span>
                {providencia && (
                  <span
                    className={`badge bg-${providencia.cor} ${providencia.cor === 'warning' ? 'text-dark' : ''}`}
                    title={providencia.descricao}
                    data-testid="badge-providencia"
                  >
                    ⚖ {providencia.label}
                  </span>
                )}
                {vencido && (
                  <span className="badge bg-danger d-inline-flex align-items-center gap-1">
                    <ExclamationTriangleIcon style={{ width: 12, height: 12 }} />
                    Vencido há {dias} dia{dias === 1 ? '' : 's'}
                  </span>
                )}
                {!vencido && dias !== null && dias < 0 && item.status === 'Pendente' && (
                  <span className="badge bg-warning text-dark">
                    Vence em {Math.abs(dias)} dia{Math.abs(dias) === 1 ? '' : 's'}
                  </span>
                )}
                {jaTratado && !vencido && (
                  <span className="badge bg-secondary">
                    Tratado em {formatDataBR(item.tratado_em)}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Fechar"
              disabled={salvando}
              onClick={onClose}
            />
          </div>

          <div className="modal-body">
            {/* Dados do prazo — read-only */}
            <div className="mb-3 p-3 bg-light rounded">
              <div className="fw-semibold text-dark mb-2">{item.titulo}</div>
              <div className="row g-2 small text-muted">
                <div className="col-md-6">
                  <CalendarIcon
                    style={{ width: 13, height: 13 }}
                    className="me-1 align-text-bottom d-inline"
                  />
                  Vencimento:{' '}
                  <strong>{formatDataBR(item.data_vencimento || item.data_inicio)}</strong>
                </div>
                {item.categoria && (
                  <div className="col-md-6">
                    <BriefcaseIcon
                      style={{ width: 13, height: 13 }}
                      className="me-1 align-text-bottom d-inline"
                    />
                    Categoria: <strong>{item.categoria}</strong>
                  </div>
                )}
                {item.publicacao_djen_id && (
                  <div className="col-12">
                    <NewspaperIcon
                      style={{ width: 13, height: 13 }}
                      className="me-1 align-text-bottom d-inline"
                    />
                    Origem: <strong>DJEN</strong> — Publicação #{item.publicacao_djen_id}{' '}
                    <a
                      href={`/djen?pub=${item.publicacao_djen_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ms-1"
                    >
                      ver publicação
                    </a>
                  </div>
                )}
                {item.prazo_calculado_por_ia && !item.prazo_validado && (
                  <div className="col-12 text-warning">
                    ⚠️ Prazo calculado pela IA — confirme se está correto antes de tratar.
                  </div>
                )}
              </div>
            </div>

            {/* Issue #304 — Responder com peça: a intimação vira ação.
                Só aparece com caso vinculado (precisa do cliente pro
                preenchimento) e quando há modelos cadastrados. */}
            {item.caso_id && modelos.length > 0 && (
              <div className="mb-3 p-3 border rounded bg-primary bg-opacity-10">
                <label className="form-label small fw-semibold mb-2">
                  <DocumentArrowUpIcon
                    style={{ width: 14, height: 14 }}
                    className="me-1 align-text-bottom d-inline"
                  />
                  Responder com peça
                  {providencia && (
                    <span className="text-muted fw-normal"> — sugerido: {providencia.label}</span>
                  )}
                </label>
                <div className="d-flex gap-2">
                  <select
                    className="form-select form-select-sm"
                    value={modeloSelId}
                    onChange={(e) => setModeloSelId(e.target.value)}
                    disabled={salvando}
                    aria-label="Modelo de peça"
                  >
                    {modelos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titulo}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary flex-shrink-0"
                    data-testid="btn-gerar-peca"
                    disabled={salvando || !modeloSelId}
                    onClick={() => {
                      const m = modelos.find((x) => String(x.id) === String(modeloSelId))
                      if (m) setModeloPreview(m)
                    }}
                  >
                    Gerar peça
                  </button>
                </div>
                <small className="text-muted">
                  Abre o modelo já preenchido com o cliente e o caso deste prazo.
                </small>
              </div>
            )}

            {/* Anotação existente (se ja foi tratado antes) */}
            {jaTratado && item.como_tratado && (
              <div className="mb-3">
                <label className="form-label small text-muted">Tratamento anterior</label>
                <div className="alert alert-secondary mb-0 small">{item.como_tratado}</div>
              </div>
            )}

            {/* Botões de ação — pivot do modal */}
            <div className="mb-3">
              <label className="form-label small text-muted fw-semibold">
                O que você quer fazer com este prazo?
              </label>
              <div className="d-grid gap-2">
                <button
                  type="button"
                  className={`btn text-start ${
                    acaoSelecionada === 'cumpri' ? 'btn-success' : 'btn-outline-success'
                  }`}
                  onClick={() => setAcaoSelecionada('cumpri')}
                  disabled={salvando}
                >
                  <CheckCircleIcon
                    style={{ width: 18, height: 18 }}
                    className="me-2 align-text-bottom d-inline"
                  />
                  <strong>Já cumpri</strong> — peticionei, juntei, fiz a defesa, etc.
                </button>
                <button
                  type="button"
                  className={`btn text-start ${
                    acaoSelecionada === 'cancelar' ? 'btn-dark' : 'btn-outline-dark'
                  }`}
                  onClick={() => setAcaoSelecionada('cancelar')}
                  disabled={salvando}
                >
                  <XCircleIcon
                    style={{ width: 18, height: 18 }}
                    className="me-2 align-text-bottom d-inline"
                  />
                  <strong>Cancelar prazo</strong> — não era meu, prazo equivocado, etc.
                </button>
                {jaTratado && (
                  <button
                    type="button"
                    className={`btn text-start ${
                      acaoSelecionada === 'reabrir' ? 'btn-warning' : 'btn-outline-warning'
                    }`}
                    onClick={() => setAcaoSelecionada('reabrir')}
                    disabled={salvando}
                  >
                    <ArrowPathIcon
                      style={{ width: 18, height: 18 }}
                      className="me-2 align-text-bottom d-inline"
                    />
                    <strong>Reabrir</strong> — voltar pra pendente (apaga "tratado em").
                  </button>
                )}
              </div>
            </div>

            {/* Campo "como foi tratado" — obrigatório para cumpri/cancelar */}
            {acaoSelecionada && acaoSelecionada !== 'reabrir' && (
              <div className="mb-2">
                <label className="form-label small text-muted">
                  Como foi tratado <span className="text-danger">*</span>
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder={
                    acaoSelecionada === 'cumpri'
                      ? 'Ex: Peticionei contestação às 14h, protocolo 12345.'
                      : 'Ex: Não era prazo meu — citação no processo do cliente errado.'
                  }
                  value={comoTratado}
                  onChange={(e) => setComoTratado(e.target.value)}
                  disabled={salvando}
                  maxLength={2000}
                  autoFocus
                />
                <small className="text-muted">Texto livre. Fica no histórico do prazo.</small>
              </div>
            )}

            {/* Onda 2 — Vincular petição cumpridora (só quando acao=cumpri
                e existem docs no caso) */}
            {acaoSelecionada === 'cumpri' && item.caso_id && docsDoCaso.length > 0 && (
              <div className="mb-3">
                <label className="form-label small text-muted">
                  <DocumentArrowUpIcon
                    style={{ width: 14, height: 14 }}
                    className="me-1 align-text-bottom d-inline"
                  />
                  Petição que cumpriu este prazo (opcional)
                </label>
                <select
                  className="form-select"
                  value={peticaoId}
                  onChange={(e) => setPeticaoId(e.target.value)}
                  disabled={salvando}
                >
                  <option value="">— Nenhum / informo depois —</option>
                  {docsDoCaso.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.nome_arquivo}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  Vincula um documento do caso já carregado em Documentos.
                </small>
              </div>
            )}

            {/* Onda 2 — Histórico colapsável (timeline) */}
            <div className="mt-3 border-top pt-3">
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none d-flex align-items-center gap-2"
                onClick={handleToggleHistorico}
                disabled={salvando}
              >
                <ClockIcon style={{ width: 14, height: 14 }} />
                <span className="fw-semibold">
                  {historicoAberto ? 'Ocultar' : 'Ver'} histórico de ações
                </span>
              </button>
              {historicoAberto && (
                <div className="mt-2">
                  {carregandoHist && (
                    <div className="text-muted small">
                      <div className="spinner-border spinner-border-sm me-2" role="status" />
                      Carregando histórico...
                    </div>
                  )}
                  {!carregandoHist && historico && historico.length === 0 && (
                    <div className="text-muted small fst-italic">
                      Nenhuma ação registrada ainda neste prazo.
                    </div>
                  )}
                  {!carregandoHist && historico && historico.length > 0 && (
                    <ul className="list-unstyled mb-0">
                      {historico.map((h) => (
                        <li key={h.id} className="py-1 border-bottom border-light small">
                          <div className="d-flex justify-content-between gap-2">
                            <span className="fw-semibold text-dark">{formatAcao(h.acao)}</span>
                            <span className="text-muted">{formatDataHora(h.data_hora)}</span>
                          </div>
                          {h.detalhes && <div className="text-muted">{h.detalhes}</div>}
                          {h.username && (
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              por {h.username}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer justify-content-between">
            <button
              type="button"
              className="btn btn-link text-secondary"
              onClick={() => {
                onClose?.()
                onEditarDados?.(item)
              }}
              disabled={salvando}
              title="Abrir formulário pra corrigir título/data/categoria"
            >
              <PencilSquareIcon
                style={{ width: 14, height: 14 }}
                className="me-1 align-text-bottom d-inline"
              />
              Editar dados do prazo
            </button>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={salvando}
              >
                Fechar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmar}
                disabled={salvando || !acaoSelecionada}
              >
                {salvando ? 'Salvando...' : 'Confirmar tratamento'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Issue #304 — preview da peça gerada (cliente+caso pré-selecionados
          a partir do caso do prazo) */}
      {modeloPreview && (
        <PreviewModeloModal
          modelo={modeloPreview}
          casoPreSelecionadoId={item.caso_id}
          onClose={() => setModeloPreview(null)}
        />
      )}
    </div>
  )
}

export default TratarPrazoModal
