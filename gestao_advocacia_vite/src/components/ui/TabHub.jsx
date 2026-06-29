import React from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Shell de abas reutilizável para os "hubs" de navegação (Financeiro,
 * Documentos, Configurações). Em vez de N entradas soltas na sidebar, cada
 * domínio vira UMA entrada que abre um hub com abas — o "menu enxuto"
 * (15 itens planos -> 7 agrupados por frequência).
 *
 * A aba ativa fica no query param `aba`, então é linkável (o Ctrl+K aponta
 * direto pra /financeiro?aba=despesas) e o botão "voltar" do navegador
 * funciona. Cada aba renderiza um componente de página JÁ EXISTENTE
 * (RecebimentosPage, etc.) — nenhuma tela foi reescrita, só reembrulhada.
 * As rotas antigas (/recebimentos, /despesas, /modelos...) seguem válidas
 * pra deep-links e back-compat.
 */
export default function TabHub({ tabs }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const atual = searchParams.get('aba')
  const ativa = tabs.find((t) => t.key === atual) || tabs[0]

  const selecionar = (key) => {
    const next = new URLSearchParams(searchParams)
    next.set('aba', key)
    setSearchParams(next)
  }

  return (
    <div className="tab-hub">
      <ul className="nav nav-tabs tab-hub-nav mb-4 flex-nowrap" style={{ overflowX: 'auto' }}>
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = ativa?.key === t.key
          return (
            <li className="nav-item" key={t.key}>
              <button
                type="button"
                className={`nav-link d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
                onClick={() => selecionar(t.key)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {Icon ? <Icon style={{ width: 17, height: 17 }} /> : null}
                <span>{t.label}</span>
                {t.badge ? (
                  <span className="badge rounded-pill bg-danger ms-1">{t.badge}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="tab-hub-body">{ativa?.element}</div>
    </div>
  )
}
