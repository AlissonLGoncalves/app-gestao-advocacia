import { useState, useCallback } from 'react'

export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    message: '',
    title: null,
    resolve: null,
  })

  const confirm = useCallback((message, title = null) => {
    return new Promise((resolve) => {
      setState({ open: true, message, title, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state.resolve(true)
    setState({ open: false, message: '', title: null, resolve: null })
  }

  const handleCancel = () => {
    state.resolve(false)
    setState({ open: false, message: '', title: null, resolve: null })
  }

  const ConfirmDialog = state.open ? (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 420 }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '14px' }}>
          <div className="modal-header border-0 pb-0 pt-4 px-4">
            <h6 className="modal-title fw-bold mb-0">{state.title || 'Confirmar ação'}</h6>
          </div>
          <div className="modal-body py-3 px-4">
            <p className="mb-0 text-muted" style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>
              {state.message}
            </p>
          </div>
          <div className="modal-footer border-0 pt-0 pb-4 px-4 gap-2">
            <button type="button" className="btn btn-light btn-sm px-4" onClick={handleCancel}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm px-4 fw-semibold"
              onClick={handleConfirm}
              autoFocus
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, ConfirmDialog }
}
