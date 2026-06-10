// Issue #316 — editor da minuta redigida pela IA ("fazer a peça").
//
// A IA devolve markdown; aqui o advogado REVISA (textarea editável),
// e então: copia (colar no Word/PJe), imprime/PDF (iframe com CSS
// jurídico A4) ou salva como documento .md vinculado ao caso (reusa o
// endpoint /documentos/upload-texto-extraido — o doc salvo aparece no
// select de "petição cumpridora" do tratamento do prazo).
import React, { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { API_URL } from '../config.js'

const PRINT_CSS = `
  @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt;
         line-height: 1.6; color: #000; }
  h2, h3 { text-align: center; }
  p { margin: 0.6em 0; text-align: justify; }
`

// Conversão mínima markdown→HTML pra impressão (títulos ## e parágrafos).
// Não usamos lib: a minuta é texto corrido com headers simples.
function markdownParaHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return md
    .split(/\n{2,}/)
    .map((bloco) => {
      const b = bloco.trim()
      if (!b) return ''
      if (b.startsWith('### ')) return `<h3>${esc(b.slice(4))}</h3>`
      if (b.startsWith('## ')) return `<h2>${esc(b.slice(3))}</h2>`
      if (b.startsWith('# ')) return `<h2>${esc(b.slice(2))}</h2>`
      const linhas = esc(b).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      return `<p>${linhas.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

function MinutaEditorModal({ minutaInicial, tipoPeca, casoId, numeroProcesso, onClose, onSalvo }) {
  const [texto, setTexto] = useState(minutaInicial)
  const [salvando, setSalvando] = useState(false)
  const iframeRef = useRef(null)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Minuta copiada — cole no Word ou no editor do tribunal.')
    } catch {
      toast.error('Não foi possível copiar automaticamente. Selecione o texto e use Ctrl+C.')
    }
  }

  const imprimir = () => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(
      `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body>${markdownParaHtml(texto)}</body></html>`
    )
    doc.close()
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        toast.error('Falha ao abrir o diálogo de impressão.')
      }
    }, 100)
  }

  const salvarNoCaso = async () => {
    setSalvando(true)
    try {
      const token = localStorage.getItem('token')
      const nomeBase = `Minuta ${tipoPeca}${numeroProcesso ? ` — ${numeroProcesso}` : ''}`
      const blob = new Blob([texto], { type: 'text/markdown' })
      const fd = new FormData()
      fd.append('file', blob, `${nomeBase}.md`.slice(0, 180))
      fd.append('caso_id', String(casoId))
      const resp = await fetch(`${API_URL}/documentos/upload-texto-extraido`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.message || 'Falha ao salvar a minuta no caso.')
      }
      toast.success('Minuta salva nos Documentos do caso.')
      onSalvo?.()
    } catch (err) {
      toast.error(err?.message || 'Falha ao salvar a minuta.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1080 }}
      data-testid="minuta-editor-modal"
    >
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Minuta: {tipoPeca}</h5>
              <small className="text-muted">
                Rascunho gerado por IA — <strong>revise antes de protocolar</strong>. Campos entre
                [colchetes] precisam ser completados.
              </small>
            </div>
            <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
          </div>
          <div className="modal-body p-2">
            <textarea
              className="form-control"
              style={{
                minHeight: '55vh',
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: '0.95rem',
                lineHeight: 1.55,
              }}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              data-testid="minuta-textarea"
            />
            {/* iframe oculto só pra impressão A4 */}
            <iframe ref={iframeRef} title="Impressão da minuta" style={{ display: 'none' }} />
          </div>
          <div className="modal-footer justify-content-between">
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={copiar}>
                Copiar texto
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={imprimir}>
                Imprimir / PDF
              </button>
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Fechar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={salvarNoCaso}
                disabled={salvando || !texto.trim()}
                data-testid="btn-salvar-minuta"
              >
                {salvando ? 'Salvando...' : 'Salvar nos Documentos do caso'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MinutaEditorModal
