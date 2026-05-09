/**
 * EscolherModeloModal — substitui o GerarDocumentoModal antigo (jsPDF).
 *
 * Lista os modelos editáveis (Procuração PF/PJ, Contrato PF/PJ, custom)
 * filtrados pelo tipo de pessoa do cliente. Ao escolher, abre o
 * PreviewModeloModal com o cliente pré-selecionado.
 *
 * Decisão Epic #9 (PR 3 fase 2): este componente é o ponto de entrada
 * unificado pra "Gerar Documento" do cliente, substituindo:
 * - GerarDocumentoModal.jsx (modal antigo com seleção de templates jsPDF)
 * - utils/gerarDocumentoLegal.js (templates hardcoded)
 *
 * Vantagem: agora os templates são editáveis pelo user em /modelos, vivem
 * no banco e não precisam de redeploy pra ajustar redação.
 */

import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { listModelos } from '../api/modelos.js'
import PreviewModeloModal from './PreviewModeloModal.jsx'

export default function EscolherModeloModal({ cliente, onClose }) {
  const [modelos, setModelos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modeloSelecionado, setModeloSelecionado] = useState(null)

  useEffect(() => {
    let ativo = true
    listModelos()
      .then((data) => {
        if (!ativo) return
        setModelos(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (ativo) toast.error('Falha ao carregar modelos.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  // Filtra modelos por tipo de pessoa do cliente. Modelos "outro" e "peticao"
  // ficam sempre visíveis. Procuração/Contrato seguem o tipo do cliente.
  const tipoPessoa = (cliente?.tipo_pessoa || 'PF').toUpperCase()
  const modelosCompativeis = modelos.filter((m) => {
    if (m.tipo === 'procuracao_pf' || m.tipo === 'contrato_pf') return tipoPessoa === 'PF'
    if (m.tipo === 'procuracao_pj' || m.tipo === 'contrato_pj') return tipoPessoa === 'PJ'
    return true
  })

  // Quando preview está aberto, esconde lista (evita 2 modais simultâneos)
  if (modeloSelecionado) {
    return (
      <PreviewModeloModal
        modelo={modeloSelecionado}
        clientePreSelecionadoId={cliente?.id}
        onClose={() => {
          setModeloSelecionado(null)
          onClose?.()
        }}
      />
    )
  }

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1050 }}
        onClick={onClose}
        data-testid="escolher-modelo-backdrop"
      />
      <div
        className="modal fade show d-block"
        style={{ zIndex: 1055 }}
        role="dialog"
        aria-modal="true"
        data-testid="escolher-modelo-modal"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-file-earmark-plus me-2" />
                Gerar documento — {cliente?.nome_razao_social}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>

            <div className="modal-body">
              <p className="small text-muted">
                Escolha um modelo para preencher com os dados de{' '}
                <strong>{cliente?.nome_razao_social}</strong> ({tipoPessoa}). Você pode editar o
                conteúdo antes de imprimir/salvar como PDF.
              </p>

              {carregando ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary spinner-border-sm" />
                </div>
              ) : modelosCompativeis.length === 0 ? (
                <div className="alert alert-warning small mb-0">
                  Nenhum modelo compatível com cliente <strong>{tipoPessoa}</strong>. Crie um em{' '}
                  <a href="/modelos">Modelos</a>.
                </div>
              ) : (
                <div className="list-group" data-testid="lista-modelos-cliente">
                  {modelosCompativeis.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="list-group-item list-group-item-action"
                      onClick={() => setModeloSelecionado(m)}
                      data-testid={`escolher-modelo-${m.id}`}
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong>{m.titulo}</strong>
                          {m.descricao && <div className="text-muted small">{m.descricao}</div>}
                        </div>
                        <div className="d-flex flex-column align-items-end gap-1">
                          <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>
                            {m.tipo}
                          </span>
                          {m.padrao && (
                            <span
                              className="badge bg-info text-dark"
                              style={{ fontSize: '0.65rem' }}
                            >
                              Padrão
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
