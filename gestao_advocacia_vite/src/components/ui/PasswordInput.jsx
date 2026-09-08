import React, { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

/**
 * Campo de senha com botao de mostrar/ocultar (Bootstrap input-group).
 * Aceita as mesmas props de um <input> (value, onChange, disabled, ...).
 */
export default function PasswordInput({ className = 'form-control', hint, ...inputProps }) {
  const [visivel, setVisivel] = useState(false)
  const Icone = visivel ? EyeSlashIcon : EyeIcon

  return (
    <>
      <div className="input-group">
        <input type={visivel ? 'text' : 'password'} className={className} {...inputProps} />
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setVisivel((v) => !v)}
          // Sem a palavra "senha" no label: testes das paginas usam
          // getByLabelText(/senha/i) para achar o <input>.
          aria-label={visivel ? 'Ocultar caracteres digitados' : 'Exibir caracteres digitados'}
          aria-pressed={visivel}
          tabIndex={-1}
          disabled={inputProps.disabled}
        >
          <Icone style={{ width: '18px', height: '18px' }} />
        </button>
      </div>
      {hint && <div className="form-text">{hint}</div>}
    </>
  )
}
