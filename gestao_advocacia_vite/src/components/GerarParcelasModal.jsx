// Fase 1 (auditoria UX) — divide o valor total do contrato em N parcelas
// mensais e as injeta nos Recebimentos (endpoint /contratos/:id/gerar-parcelas
// já existia no backend; a UI global não o expunha). Padrão Astrea: lança
// no contexto jurídico, cobra no módulo financeiro.
import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { gerarParcelasContrato } from '../api/contratos.js'

function fmtBRL(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function GerarParcelasModal({ contrato, onGerado, onCancel }) {
  const [qtd, setQtd] = useState(1)
  const [primeiroVencimento, setPrimeiroVencimento] = useState('')
  const [gerando, setGerando] = useState(false)

  const valorParcela = contrato?.valor_total ? Number(contrato.valor_total) / (qtd || 1) : null

  const handleGerar = async () => {
    if (!primeiroVencimento || qtd < 1) {
      toast.warning('Informe a quantidade de parcelas e a data do 1º vencimento.')
      return
    }
    setGerando(true)
    try {
      await gerarParcelasContrato(contrato.id, {
        quantidade_parcelas: parseInt(qtd, 10),
        primeiro_vencimento: primeiroVencimento,
      })
      toast.success(`${qtd} parcela(s) criadas nos Recebimentos.`)
      onGerado?.()
    } catch (err) {
      toast.error(err?.message || 'Falha ao gerar as parcelas.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1070 }}
      data-testid="gerar-parcelas-modal"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Gerar parcelas — contrato #{contrato?.id}</h5>
            <button type="button" className="btn-close" aria-label="Fechar" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <p className="small text-muted">
              Divide <strong>{fmtBRL(contrato?.valor_total)}</strong> em parcelas mensais e cria os
              títulos em <strong>Recebimentos</strong>, já vinculados ao caso e ao cliente.
            </p>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Nº de parcelas</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  className="form-control"
                  value={qtd}
                  onChange={(e) => setQtd(e.target.value)}
                  disabled={gerando}
                  data-testid="input-qtd-parcelas"
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">1º vencimento</label>
                <input
                  type="date"
                  className="form-control"
                  value={primeiroVencimento}
                  onChange={(e) => setPrimeiroVencimento(e.target.value)}
                  disabled={gerando}
                  data-testid="input-primeiro-vencimento"
                />
              </div>
            </div>
            {valorParcela != null && qtd >= 1 && (
              <div className="alert alert-light border mt-3 mb-0 small">
                {qtd}× de <strong>{fmtBRL(valorParcela)}</strong>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={onCancel} disabled={gerando}>
              Agora não
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleGerar}
              disabled={gerando}
              data-testid="btn-confirmar-parcelas"
            >
              {gerando ? 'Gerando...' : 'Criar parcelas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GerarParcelasModal
