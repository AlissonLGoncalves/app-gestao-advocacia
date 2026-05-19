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
} from '@heroicons/react/24/outline'
import { tratarItemAgenda } from '../api/itensAgenda.js'

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
  const [salvando, setSalvando] = useState(false)

  // Pre-popula como_tratado com valor existente quando reabre o modal
  useEffect(() => {
    setComoTratado(item?.como_tratado || '')
    setAcaoSelecionada(null)
  }, [item?.id])

  if (!item) return null

  const dias = diasRelativos(item.data_vencimento || item.data_inicio)
  const vencido = dias !== null && dias > 0 && item.status === 'Pendente'
  const jaTratado = Boolean(item.tratado_em)
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
      await tratarItemAgenda(item.id, {
        acao: acaoSelecionada,
        como_tratado: comoTratado.trim() || null,
      })
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
              <div className="d-flex align-items-center gap-2 mt-1">
                <span className={`badge ${statusLabel.cor}`}>{statusLabel.texto}</span>
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
    </div>
  )
}

export default TratarPrazoModal
