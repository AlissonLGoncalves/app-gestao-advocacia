/**
 * CategoriasPublicacoes — pills de categoria pra caixa de intimações DJEN.
 *
 * Fase 2 (inbox-zero, padrão Astrea): a fila de trabalho é por ESTADO DE
 * TRATAMENTO, não por leitura. "Não tratadas" é a caixa de entrada (default);
 * "Sem processo" são as que precisam de cadastro antes de tratar; intimação
 * só sai da fila tratando ou descartando — nunca some sem rastro.
 *
 * Redesign Stitch (set/2026): visual de segmented pill (fundo cinza, item
 * ativo branco). A toolbar mostra só 3 (Não tratadas · Sem processo ·
 * Tratadas); as demais (Descartadas / Todas / Importantes) ficam no popover
 * "Filtros" — por isso a prop `categorias` limita quais pills renderizar.
 *
 * Filtragem é server-side: ao trocar pill, dispara nova chamada com filtro
 * `inbox`/`vinculacao`/`importante` na querystring. Contagens vêm do mesmo
 * endpoint.
 */

import React from 'react'

export const CATEGORIAS = [
  { key: 'nao_tratadas', label: 'Não tratadas' },
  { key: 'sem_processo', label: 'Sem processo' },
  { key: 'tratadas', label: 'Tratadas' },
  { key: 'descartadas', label: 'Descartadas' },
  { key: 'todas', label: 'Todas' },
  { key: 'importantes', label: 'Importantes' },
]

export default function CategoriasPublicacoes({ ativa, contagens, onChange, categorias }) {
  const visiveis = categorias ? CATEGORIAS.filter((c) => categorias.includes(c.key)) : CATEGORIAS
  return (
    <div
      className="dj-pills"
      role="tablist"
      aria-label="Categorias de publicações"
      data-testid="djen-categorias"
    >
      {visiveis.map((cat) => {
        const ehAtiva = ativa === cat.key
        const total = contagens?.[cat.key] ?? 0
        return (
          <button
            key={cat.key}
            type="button"
            role="tab"
            aria-selected={ehAtiva}
            className={`dj-pill${ehAtiva ? ' is-active' : ''}`}
            title={`Mostrar ${cat.label.toLowerCase()}`}
            onClick={() => onChange(cat.key)}
            data-testid={`djen-cat-${cat.key}`}
          >
            <span>{cat.label}</span>
            {/* "Tratadas" não mostra contagem: é histórico, não fila */}
            {cat.key !== 'tratadas' && <span className="dj-count">{total}</span>}
          </button>
        )
      })}
    </div>
  )
}
