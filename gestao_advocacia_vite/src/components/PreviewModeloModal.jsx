/**
 * PreviewModeloModal — pré-visualiza e imprime um modelo de documento.
 *
 * Fluxo:
 * 1. User escolhe cliente (e opcionalmente caso) do tenant
 * 2. Backend renderiza HTML via POST /modelos/{id}/gerar
 * 3. HTML aparece em <iframe> isolado
 * 4. Botão "Imprimir / Salvar como PDF" chama window.print() do iframe
 *    (browser dialog gera PDF nativo via "Salvar como PDF")
 *
 * Decisão (Epic #9 fase 2): preferimos window.print() em vez de WeasyPrint
 * server-side. Custo zero, infra zero, qualidade boa pra documentos
 * jurídicos simples (procurações, contratos básicos). Dialog do browser
 * resolve "Salvar como PDF" nativamente desde Chrome 73 / Edge 79 / Firefox 87.
 */

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { listClientes } from '../api/clientes.js'
import { listCasos } from '../api/casos.js'
import { gerarDocumentoDoModelo } from '../api/modelos.js'

// CSS aplicado dentro do iframe — formata o documento renderizado pra
// impressão A4 com margens jurídicas (3cm topo/esq, 2cm base/dir).
const PRINT_CSS = `
  @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    margin: 0;
    padding: 0 0.5em;
  }
  h1, h2, h3 { text-align: center; }
  h2 { font-size: 14pt; margin: 1.2em 0 0.8em; }
  p { margin: 0.6em 0; text-align: justify; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 4px; }
  /* Quando imprime: esconde controles do browser, deixa só conteúdo */
  @media print {
    body { padding: 0; }
  }
`

export default function PreviewModeloModal({ modelo, onClose, clientePreSelecionadoId = null }) {
  const [clientes, setClientes] = useState([])
  const [casos, setCasos] = useState([])
  const [clienteId, setClienteId] = useState(
    clientePreSelecionadoId ? String(clientePreSelecionadoId) : ''
  )
  const [casoId, setCasoId] = useState('')
  const [htmlRenderizado, setHtmlRenderizado] = useState('')
  const [carregandoListas, setCarregandoListas] = useState(true)
  const [renderizando, setRenderizando] = useState(false)
  const iframeRef = useRef(null)

  useEffect(() => {
    let ativo = true
    setCarregandoListas(true)
    Promise.all([listClientes(), listCasos()])
      .then(([cls, css]) => {
        if (!ativo) return
        setClientes(Array.isArray(cls) ? cls : cls?.items || [])
        setCasos(Array.isArray(css) ? css : css?.items || [])
      })
      .catch(() => {
        if (ativo) toast.error('Falha ao carregar clientes/casos.')
      })
      .finally(() => {
        if (ativo) setCarregandoListas(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  // Casos filtrados pelo cliente selecionado (UX: não mostra caso de outro cliente)
  const casosDoCliente = clienteId
    ? casos.filter((c) => String(c.cliente_id) === String(clienteId))
    : []

  const renderizar = async () => {
    if (!clienteId) {
      toast.warning('Selecione um cliente.')
      return
    }
    setRenderizando(true)
    try {
      const resp = await gerarDocumentoDoModelo(modelo.id, {
        cliente_id: Number(clienteId),
        caso_id: casoId ? Number(casoId) : null,
      })
      setHtmlRenderizado(resp.html || '')
      // Injeta no iframe após próximo tick (state precisa ter atualizado)
      setTimeout(() => injetarNoIframe(resp.html || ''), 50)
    } catch (err) {
      toast.error(err?.message || 'Falha ao renderizar modelo.')
    } finally {
      setRenderizando(false)
    }
  }

  const injetarNoIframe = (html) => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(
      `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body>${html}</body></html>`
    )
    doc.close()
  }

  const imprimir = () => {
    const iframe = iframeRef.current
    if (!iframe || !htmlRenderizado) {
      toast.warning('Renderize o documento antes de imprimir.')
      return
    }
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (err) {
      toast.error('Falha ao abrir o diálogo de impressão.')
    }
  }

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1050 }}
        onClick={onClose}
        data-testid="preview-modelo-backdrop"
      />
      <div
        className="modal fade show d-block"
        style={{ zIndex: 1055 }}
        role="dialog"
        aria-modal="true"
        data-testid="preview-modelo-modal"
      >
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content" style={{ height: '90vh' }}>
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-file-earmark-text me-2" />
                Gerar: {modelo.titulo}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>

            <div className="modal-body p-3 d-flex gap-3" style={{ overflow: 'hidden' }}>
              {/* Coluna esquerda: seleção + botões */}
              <div style={{ width: 280, flexShrink: 0 }}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Cliente</label>
                  <select
                    className="form-select form-select-sm"
                    value={clienteId}
                    onChange={(e) => {
                      setClienteId(e.target.value)
                      setCasoId('')
                    }}
                    disabled={carregandoListas}
                    data-testid="preview-cliente-select"
                  >
                    <option value="">— Selecione —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_razao_social}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Caso (opcional)</label>
                  <select
                    className="form-select form-select-sm"
                    value={casoId}
                    onChange={(e) => setCasoId(e.target.value)}
                    disabled={!clienteId || casosDoCliente.length === 0}
                    data-testid="preview-caso-select"
                  >
                    <option value="">— Sem caso —</option>
                    {casosDoCliente.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.numero_processo || c.titulo || `Caso #${c.id}`}
                      </option>
                    ))}
                  </select>
                  {clienteId && casosDoCliente.length === 0 && (
                    <div className="form-text small">Cliente sem casos cadastrados.</div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-primary w-100 mb-2"
                  onClick={renderizar}
                  disabled={renderizando || !clienteId}
                  data-testid="btn-renderizar"
                >
                  {renderizando ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Renderizando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-right-circle me-1" />
                      Gerar prévia
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-success w-100"
                  onClick={imprimir}
                  disabled={!htmlRenderizado}
                  title="Abre o diálogo de impressão do navegador. Use 'Salvar como PDF' pra exportar."
                  data-testid="btn-imprimir"
                >
                  <i className="bi bi-printer me-1" />
                  Imprimir / Salvar PDF
                </button>

                {htmlRenderizado && (
                  <div className="alert alert-info small mt-3 mb-0">
                    <strong>Dica:</strong> No diálogo do navegador, escolha
                    <em> "Salvar como PDF"</em> como destino.
                  </div>
                )}
              </div>

              {/* Coluna direita: iframe com preview */}
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <iframe
                  ref={iframeRef}
                  title={`Preview ${modelo.titulo}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: '1px solid #dee2e6',
                    borderRadius: 4,
                    background: '#fff',
                  }}
                  data-testid="preview-iframe"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
