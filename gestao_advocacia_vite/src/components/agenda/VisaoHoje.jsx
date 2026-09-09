// src/components/agenda/VisaoHoje.jsx
// Visao "Hoje" (fila do dia) — redesign Stitch, lote2-2.html.
// Barata por desenho: reusa os itens que o Calendario ja carregou e o
// CardItemDia do painel. Tres blocos: Hoje (por hora), Amanhã e Esta
// semana (proximos 7 dias). Vencidos entram no topo — sao o que mais
// precisa de decisao.
import React from 'react'
import CardItemDia from './CardItemDia.jsx'
import { hojeYmd, somarDias, ymdDoItem, itensDoDia, diasEntre, tituloDia } from './agendaHelpers.js'

function Bloco({ titulo, itens, casos, hoje, acoes, testId }) {
  if (!itens.length) return null
  return (
    <section className="ag-hoje-bloco" data-testid={testId}>
      <h3 className="ag-hoje-bloco-titulo">
        {titulo} <span className="tabular">({itens.length})</span>
      </h3>
      <div className="ag-painel-lista">
        {itens.map((item) => (
          <CardItemDia key={item.id} item={item} casos={casos} hoje={hoje} {...acoes} />
        ))}
      </div>
    </section>
  )
}

function VisaoHoje({ itens, casos, hoje = hojeYmd(), onAbrir, onResponder, onConcluir }) {
  const lista = itens || []
  const amanha = somarDias(hoje, 1)
  const ativos = lista.filter((i) => i.status !== 'Concluido' && i.status !== 'Cancelado')

  const vencidos = ativos
    .filter((i) => {
      const d = ymdDoItem(i)
      return d && diasEntre(hoje, d) < 0
    })
    .sort((a, b) => ymdDoItem(a).localeCompare(ymdDoItem(b)))
  const deHoje = itensDoDia(lista, hoje)
  const deAmanha = itensDoDia(ativos, amanha)
  const daSemana = ativos
    .filter((i) => {
      const d = ymdDoItem(i)
      if (!d) return false
      const diff = diasEntre(hoje, d)
      return diff >= 2 && diff <= 7
    })
    .sort((a, b) => ymdDoItem(a).localeCompare(ymdDoItem(b)))

  const acoes = { onAbrir, onResponder, onConcluir }
  const total = vencidos.length + deHoje.length + deAmanha.length + daSemana.length
  const pendentesHoje = deHoje.filter((i) => i.status !== 'Concluido' && i.status !== 'Cancelado')

  return (
    <div className="ag-hoje" data-testid="visao-hoje">
      <p className="ag-hoje-resumo">
        {pendentesHoje.length === 0
          ? 'Nada pendente para hoje.'
          : `${pendentesHoje.length} ${pendentesHoje.length === 1 ? 'compromisso' : 'compromissos'} hoje`}
        {vencidos.length > 0 && (
          <span className="ag-hoje-resumo-vencidos">
            {' · '}
            {vencidos.length} {vencidos.length === 1 ? 'vencido' : 'vencidos'}
          </span>
        )}
      </p>

      {total === 0 ? (
        <div className="ag-vazio ag-vazio--ok" data-testid="hoje-vazio">
          <p className="ag-vazio-titulo">Tudo em dia.</p>
          <p className="ag-vazio-texto">Nenhum prazo ou compromisso nos próximos 7 dias.</p>
        </div>
      ) : (
        <>
          <Bloco
            titulo="Vencidos"
            itens={vencidos}
            casos={casos}
            hoje={hoje}
            acoes={acoes}
            testId="bloco-vencidos"
          />
          <Bloco
            titulo="Hoje"
            itens={deHoje}
            casos={casos}
            hoje={hoje}
            acoes={acoes}
            testId="bloco-hoje"
          />
          <Bloco
            titulo={`Amanhã · ${tituloDia(amanha)}`}
            itens={deAmanha}
            casos={casos}
            hoje={hoje}
            acoes={acoes}
            testId="bloco-amanha"
          />
          <Bloco
            titulo="Esta semana"
            itens={daSemana}
            casos={casos}
            hoje={hoje}
            acoes={acoes}
            testId="bloco-semana"
          />
        </>
      )}
    </div>
  )
}

export default VisaoHoje
