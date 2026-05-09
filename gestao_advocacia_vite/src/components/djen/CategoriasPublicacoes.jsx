/**
 * CategoriasPublicacoes — pills de categoria pra lista de publicações DJEN.
 *
 * Inspirado no Astrea (abas Importantes / Andamentos / Tarefas / Agenda...).
 * Aqui é uma versão minimalista focada nas distinções operacionais que o
 * usuário usa hoje:
 * - Todas: tudo do tenant
 * - Não lidas: lida=false
 * - Pendentes: caso_id IS NULL (publicação ainda não vinculada a nenhum caso)
 * - Vinculadas: caso_id IS NOT NULL
 * - Importantes: placeholder (Epic #2 #176 — classificação IA)
 *
 * Filtragem é server-side: ao trocar pill, dispara nova chamada com filtro
 * `vinculacao`/`lida` na querystring. Contagens vêm do mesmo endpoint.
 */

import React from 'react'

const CATEGORIAS = [
  { key: 'todas', label: 'Todas', cor: 'secondary' },
  { key: 'nao_lidas', label: 'Não lidas', cor: 'primary' },
  { key: 'pendentes', label: 'Pendentes', cor: 'warning' },
  { key: 'vinculadas', label: 'Vinculadas', cor: 'success' },
  // Placeholder até Epic #2 (#176). Mostra disabled com tooltip pra preparar
  // o usuário pra feature que vem por aí.
  { key: 'importantes', label: 'Importantes', cor: 'danger', em_breve: true },
]

export default function CategoriasPublicacoes({ ativa, contagens, onChange }) {
  return (
    <div
      className="d-flex flex-wrap gap-2 mb-2"
      role="tablist"
      aria-label="Categorias de publicações"
      data-testid="djen-categorias"
    >
      {CATEGORIAS.map((cat) => {
        const ehAtiva = ativa === cat.key
        const total = contagens?.[cat.key] ?? 0
        const desabilitada = cat.em_breve === true
        const cls = ehAtiva
          ? `btn btn-sm btn-${cat.cor} d-flex align-items-center gap-2 px-3`
          : `btn btn-sm btn-outline-${cat.cor} d-flex align-items-center gap-2 px-3`
        const title = desabilitada
          ? 'Em breve — classificação automática por IA'
          : `Mostrar ${cat.label.toLowerCase()}`
        return (
          <button
            key={cat.key}
            type="button"
            role="tab"
            aria-selected={ehAtiva}
            aria-disabled={desabilitada}
            disabled={desabilitada}
            className={cls}
            title={title}
            onClick={() => !desabilitada && onChange(cat.key)}
            data-testid={`djen-cat-${cat.key}`}
            style={desabilitada ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
          >
            <span style={{ fontSize: '0.85rem' }}>{cat.label}</span>
            <span
              className={`badge ${ehAtiva ? 'bg-light text-dark' : `bg-${cat.cor}-subtle text-${cat.cor}-emphasis`}`}
              style={{ fontSize: '0.72rem' }}
            >
              {desabilitada ? '—' : total}
            </span>
          </button>
        )
      })}
    </div>
  )
}
