// src/components/CancelarNFSeModal.jsx
// Modal de confirmacao pra cancelar uma NFS-e autorizada. Bloqueia
// envio ate motivo ter >=15 chars (mesma validacao do backend).
//
// codMotivo: enum do XSD oficial TSCodJustCanc
//   1 = Erro na emissao
//   2 = Servico nao prestado
//   9 = Outros
import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { cancelarEmissaoNFSe } from '../api/nfse.js'

const MOTIVOS = [
  { codigo: 1, label: 'Erro na emissão' },
  { codigo: 2, label: 'Serviço não prestado' },
  { codigo: 9, label: 'Outros' },
]

function CancelarNFSeModal({ emissao, onClose, onSucesso }) {
  const [motivo, setMotivo] = useState('')
  const [codMotivo, setCodMotivo] = useState(9)
  const [enviando, setEnviando] = useState(false)

  // Reset state quando troca de emissao
  useEffect(() => {
    setMotivo('')
    setCodMotivo(9)
  }, [emissao?.id])

  if (!emissao) return null

  const podeEnviar = motivo.trim().length >= 15 && !enviando
  const eMock = emissao.gateway_tipo === 'mock'

  const handleConfirmar = async () => {
    setEnviando(true)
    try {
      const atualizada = await cancelarEmissaoNFSe(emissao.id, {
        motivo: motivo.trim(),
        codMotivo,
      })
      toast.success(
        eMock ? 'NFS-e cancelada localmente (modo mock).' : 'NFS-e cancelada com sucesso no Portal.'
      )
      onSucesso?.(atualizada)
      onClose()
    } catch (err) {
      console.error('CancelarNFSeModal: erro ao cancelar', err)
      const msg = err?.response?.mensagem_erro || err?.message || 'Erro ao cancelar NFS-e.'
      toast.error(msg)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      role="dialog"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) onClose()
      }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Cancelar NFS-e</h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Fechar"
              disabled={enviando}
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <div className="alert alert-danger d-flex align-items-start py-2 small mb-3">
              <ExclamationTriangleIcon
                style={{ width: 18, height: 18 }}
                className="me-2 flex-shrink-0 mt-1"
              />
              <div>
                <strong>Ação irreversível.</strong>{' '}
                {eMock
                  ? 'Em modo Mock, a NFS-e será marcada como cancelada apenas neste sistema (não há nota real para cancelar).'
                  : 'O cancelamento será registrado no Portal Nacional NFS-e como evento e101101. Tem prazo legal (geralmente 24h) — após isso é preciso usar análise fiscal.'}
              </div>
            </div>

            <dl className="row g-2 small mb-3">
              <dt className="col-sm-4 text-muted">Número / Série</dt>
              <dd className="col-sm-8">
                {emissao.numero_nfse || '—'} / {emissao.serie || '—'}
              </dd>
              <dt className="col-sm-4 text-muted">Chave de acesso</dt>
              <dd className="col-sm-8 font-monospace small">{emissao.gateway_id || '—'}</dd>
            </dl>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Código do motivo *</label>
              <select
                className="form-select form-select-sm"
                value={codMotivo}
                onChange={(e) => setCodMotivo(parseInt(e.target.value, 10))}
                disabled={enviando}
              >
                {MOTIVOS.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.codigo} — {m.label}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                Códigos oficiais do Portal Nacional (TSCodJustCanc).
              </small>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">
                Descrição do motivo *{' '}
                <span className="text-muted fw-normal">({motivo.length}/15 mínimo)</span>
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo do cancelamento (mínimo 15 caracteres)"
                disabled={enviando}
              />
              {motivo.length > 0 && motivo.trim().length < 15 && (
                <small className="text-danger">
                  Mínimo de 15 caracteres ({motivo.trim().length} agora).
                </small>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={enviando}
            >
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmar}
              disabled={!podeEnviar}
            >
              {enviando ? 'Cancelando...' : 'Confirmar cancelamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CancelarNFSeModal
