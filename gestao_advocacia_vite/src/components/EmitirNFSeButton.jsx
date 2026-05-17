// src/components/EmitirNFSeButton.jsx
// Botao + modal de confirmacao + status pos-emissao. Usado na tabela do
// historico de Pagamentos Recebidos (etapa 5.5 da feature).
import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { DocumentTextIcon } from '@heroicons/react/24/outline'
import { emitirNFSe, listEmissoesNFSe } from '../api/nfse.js'

const formatBRL = (v) => {
  const num = typeof v === 'number' ? v : parseFloat(v)
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const STATUS_BADGE = {
  Autorizada: { cor: 'bg-success', label: 'Autorizada' },
  EmProcessamento: { cor: 'bg-info text-dark', label: 'Em Processamento' },
  Pendente: { cor: 'bg-secondary', label: 'Pendente' },
  Rejeitada: { cor: 'bg-danger', label: 'Rejeitada' },
  Cancelada: { cor: 'bg-dark', label: 'Cancelada' },
}

function EmitirNFSeButton({ recebimento }) {
  const [aberto, setAberto] = useState(false)
  const [emitindo, setEmitindo] = useState(false)
  const [ultimaEmissao, setUltimaEmissao] = useState(null)
  const [historicoCarregado, setHistoricoCarregado] = useState(false)

  // Carrega ultima emissao desse recebimento ao montar pra mostrar badge.
  useEffect(() => {
    let cancelado = false
    listEmissoesNFSe({ recebimento_id: recebimento.id })
      .then((emissoes) => {
        if (cancelado) return
        if (Array.isArray(emissoes) && emissoes.length > 0) {
          setUltimaEmissao(emissoes[0])
        }
        setHistoricoCarregado(true)
      })
      .catch((err) => {
        console.warn('EmitirNFSeButton: erro ao buscar emissoes', err)
        setHistoricoCarregado(true)
      })
    return () => {
      cancelado = true
    }
  }, [recebimento.id])

  const handleConfirmarEmitir = async () => {
    setEmitindo(true)
    try {
      const emissao = await emitirNFSe(recebimento.id)
      setUltimaEmissao(emissao)
      if (emissao.status === 'Autorizada') {
        toast.success(`NFS-e ${emissao.numero_nfse} autorizada.`)
      } else if (emissao.status === 'EmProcessamento') {
        toast.info('Emissão iniciada — aguarde a confirmação.')
      } else {
        toast.error(emissao.mensagem_erro || `Status: ${emissao.status}`)
      }
      setAberto(false)
    } catch (err) {
      console.error('EmitirNFSeButton: erro ao emitir', err)
      toast.error(err?.message || 'Erro ao emitir NFS-e.')
    } finally {
      setEmitindo(false)
    }
  }

  const renderBadge = () => {
    if (!historicoCarregado) return null
    if (!ultimaEmissao) return null
    const cfg = STATUS_BADGE[ultimaEmissao.status] || { cor: 'bg-secondary', label: ultimaEmissao.status }
    return (
      <span className={`badge ${cfg.cor} ms-2`} title={ultimaEmissao.mensagem_erro || ''}>
        NFS-e: {cfg.label}
      </span>
    )
  }

  const podeEmitir =
    !ultimaEmissao ||
    ultimaEmissao.status === 'Rejeitada' ||
    ultimaEmissao.status === 'Cancelada'

  return (
    <>
      <div className="d-flex align-items-center gap-1">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => setAberto(true)}
          disabled={!podeEmitir}
          title={podeEmitir ? 'Emitir NFS-e para este pagamento' : 'NFS-e já emitida'}
        >
          <DocumentTextIcon style={{ width: 14, height: 14 }} className="me-1" />
          {ultimaEmissao && !podeEmitir ? 'Emitida' : 'Emitir NFS-e'}
        </button>
        {ultimaEmissao?.pdf_url && (
          <a
            href={ultimaEmissao.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-secondary btn-sm"
            title="Baixar DANFSe"
          >
            PDF
          </a>
        )}
        {renderBadge()}
      </div>

      {aberto && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !emitindo) setAberto(false)
          }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirmar emissão de NFS-e</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Fechar"
                  disabled={emitindo}
                  onClick={() => setAberto(false)}
                />
              </div>
              <div className="modal-body">
                <p className="mb-2 text-muted small">
                  Confira os dados que serão enviados para a nota fiscal:
                </p>
                <ul className="list-group list-group-flush mb-3">
                  <li className="list-group-item d-flex justify-content-between">
                    <span className="text-muted">Descrição</span>
                    <span className="fw-medium text-end">{recebimento.descricao}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span className="text-muted">Valor</span>
                    <span className="fw-bold">{formatBRL(recebimento.valor)}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span className="text-muted">Data do pagamento</span>
                    <span>{recebimento.data_pagamento || '—'}</span>
                  </li>
                </ul>
                <div className="alert alert-warning small mb-0">
                  ⚠️ Modo Mock: nenhuma nota real será enviada para a Receita ou prefeitura. Isto
                  é um teste do fluxo de emissão.
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAberto(false)}
                  disabled={emitindo}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmarEmitir}
                  disabled={emitindo}
                >
                  {emitindo ? 'Emitindo...' : 'Confirmar Emissão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default EmitirNFSeButton
