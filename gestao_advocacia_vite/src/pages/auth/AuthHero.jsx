// Painel navy das telas de autenticacao (Login / Cadastro): marca, a promessa
// do produto e as tres coisas que o Patronus faz pelo advogado antes do PJe.
// TELA 4 do redesign Stitch (docs/design/stitch-2026-09/prompt.md).
import React from 'react'
import {
  NewspaperIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import PatronusLogo from '../../components/brand/PatronusLogo.jsx'
import './AuthHero.css'

const DIFERENCIAIS = [
  { icon: NewspaperIcon, texto: 'Lemos o DJEN todo dia às 7h por você' },
  {
    icon: DocumentMagnifyingGlassIcon,
    texto: 'Partes, nº do processo, assunto e prazo já extraídos',
  },
  { icon: DocumentTextIcon, texto: 'Peça pronta em Word, direto para o protocolo' },
]

export default function AuthHero({ className = '' }) {
  return (
    <aside className={`auth-hero ${className}`.trim()}>
      <PatronusLogo size={44} tone="light" />
      <div className="auth-hero-body">
        <h2 className="auth-hero-tagline">Abra o Patronus antes do PJe.</h2>
        <ul className="auth-hero-list">
          {DIFERENCIAIS.map(({ icon: Icon, texto }) => (
            <li key={texto} className="auth-hero-item">
              <span className="auth-hero-item-icon" aria-hidden="true">
                <Icon />
              </span>
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
