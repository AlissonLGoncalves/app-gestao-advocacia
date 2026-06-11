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

// Fase 2 (inbox-zero, padrão Astrea): a fila de trabalho é por ESTADO DE
// TRATAMENTO, não por leitura. "Não tratadas" é a caixa de entrada (default);
// "Sem processo" são as que precisam de cadastro antes de tratar; intimação
// só sai da fila tratando ou descartando — nunca some sem rastro.
const CATEGORIAS = [
  { key: 'nao_tratadas', label: 'Não tratadas', cor: 'warning' },
  { key: 'sem_processo', label: 'Sem processo', cor: 'danger' },
  { key: 'tratadas', label: 'Tratadas', cor: 'success' },
  { key: 'descartadas', label: 'Descartadas', cor: 'secondary' },
  { key: 'todas', label: 'Todas', cor: 'secondary' },
  { key: 'importantes', label: 'Importantes', cor: 'danger' },
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
        const cls = ehAtiva
          ? `btn btn-sm btn-${cat.cor} d-flex align-items-center gap-2 px-3`
          : `btn btn-sm btn-outline-${cat.cor} d-flex align-items-center gap-2 px-3`
        return (
          <button
            key={cat.key}
            type="button"
            role="tab"
            aria-selected={ehAtiva}
            className={cls}
            title={`Mostrar ${cat.label.toLowerCase()}`}
            onClick={() => onChange(cat.key)}
            data-testid={`djen-cat-${cat.key}`}
          >
            <span style={{ fontSize: '0.85rem' }}>{cat.label}</span>
            <span
              className={`badge ${ehAtiva ? 'bg-light text-dark' : `bg-${cat.cor}-subtle text-${cat.cor}-emphasis`}`}
              style={{ fontSize: '0.72rem' }}
            >
              {total}
            </span>
          </button>
        )
      })}
    </div>
  )
}
