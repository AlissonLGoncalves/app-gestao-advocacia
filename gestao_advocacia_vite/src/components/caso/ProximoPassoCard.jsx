// Redesign Stitch (TELA 3) — card alto "Próximo passo" (estrela do Resumo).
//
// Três blocos num card só, como no mockup caso-detalhe.png:
//   1. frase grande "{ação} até {data}" + chip de urgência + origem DJEN
//      + barra "Decurso de prazo";
//   2. checklist "O que falta" derivado de dados reais (checklistCaso.js);
//   3. "Peça cabível: {nome}" com botão que abre o fluxo EXISTENTE
//      "Responder com peça" (TratarPrazoModal) — o app não gera .docx,
//      por isso o rótulo é "Gerar peça".
//
// Componente puro: recebe o item já selecionado (proximoPasso.js) e callbacks.

import React from 'react'
import { Link } from 'react-router'
import { CheckCircleIcon, DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  acaoDoItem,
  chipVencimento,
  decursoPrazo,
  diasAte,
  formatDataBR,
  pecaCabivelDoItem,
} from './proximoPasso.js'

function ChecklistItem({ item, onAcao }) {
  const cls = `cd-check-item ${item.concluido ? 'cd-check-item--ok' : 'cd-check-item--pendente'}`
  return (
    <li className={cls} data-testid={`check-${item.id}`} data-concluido={item.concluido}>
      {item.concluido ? (
        <CheckCircleIcon className="cd-check-icon cd-check-icon--ok" aria-hidden="true" />
      ) : (
        <span className="cd-check-box" aria-hidden="true" />
      )}
      <span className="cd-check-label">
        <span className="visually-hidden">{item.concluido ? 'Concluído: ' : 'Pendente: '}</span>
        {item.label}
      </span>
      {!item.concluido &&
        item.acao &&
        (item.acao.tipo === 'link' ? (
          <Link className="cd-check-acao" to={item.acao.to}>
            {item.acao.label}
          </Link>
        ) : (
          <button
            type="button"
            className="cd-check-acao"
            onClick={() => onAcao?.(item.acao.id, item)}
          >
            {item.acao.label}
          </button>
        ))}
    </li>
  )
}

export default function ProximoPassoCard({
  item,
  publicacao,
  checklist = [],
  onRegistrar,
  onGerarPeca,
  onChecklistAcao,
  hoje,
}) {
  const dias = item ? diasAte(item.data_vencimento, hoje) : null
  const chip = item ? chipVencimento(dias) : null
  const vencido = dias !== null && dias < 0
  const decurso = item ? decursoPrazo(item, hoje) : null
  const acao = acaoDoItem(item)
  const peca = pecaCabivelDoItem(item)
  const dataBR = item ? formatDataBR(item.data_vencimento) : ''
  const concluidos = checklist.filter((c) => c.concluido).length

  return (
    <section
      className="cd-card cd-proximo"
      aria-labelledby="cd-proximo-titulo"
      data-testid="proximo-passo-card"
    >
      <div className="cd-kicker">
        <span className="cd-kicker-label" id="cd-proximo-titulo">
          Próximo passo
        </span>
        {chip && (
          <span className={`cd-chip-urg cd-chip-urg--${chip.tom}`} data-testid="chip-vencimento">
            {chip.texto}
          </span>
        )}
      </div>

      {item ? (
        <>
          <h2 className="cd-passo-frase" data-testid="passo-frase">
            {acao}
            {dataBR ? (
              vencido ? (
                <>
                  {' '}
                  <span className="cd-vencido">
                    — venceu em <span className="cd-num">{dataBR}</span>
                  </span>
                </>
              ) : (
                <>
                  {' '}
                  até <span className="cd-num">{dataBR}</span>
                </>
              )
            ) : (
              <span className="cd-sub"> — sem data definida</span>
            )}
          </h2>
          {item.tipo_providencia && item.titulo && item.titulo !== acao && (
            <p className="cd-passo-titulo">{item.titulo}</p>
          )}
          {item.publicacao_djen_id && (
            <p className="cd-passo-fonte" data-testid="passo-fonte-djen">
              Prazo extraído da publicação do DJEN
              {publicacao?.data_disponibilizacao ? (
                <>
                  {' '}
                  de{' '}
                  <span className="cd-num">{formatDataBR(publicacao.data_disponibilizacao)}</span>
                </>
              ) : null}{' '}
              · <Link to={`/djen?publicacao=${item.publicacao_djen_id}`}>ver publicação</Link>
            </p>
          )}
          {decurso && (
            <div
              className={`cd-decurso ${vencido ? 'cd-decurso--vencido' : ''}`}
              data-testid="passo-decurso"
            >
              <div className="cd-decurso-head">
                <span>
                  Decurso de prazo: dia <span className="cd-num">{decurso.atual}</span> de{' '}
                  <span className="cd-num">{decurso.total}</span>
                </span>
                <strong className="cd-num">{decurso.pct}% consumido</strong>
              </div>
              <div
                className="cd-decurso-bar"
                role="progressbar"
                aria-label="Decurso do prazo"
                aria-valuemin={0}
                aria-valuemax={decurso.total}
                aria-valuenow={decurso.atual}
              >
                <span style={{ width: `${decurso.pct}%` }} />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="cd-passo-vazio" data-testid="passo-vazio">
          <h2 className="cd-passo-frase">Nenhum passo pendente.</h2>
          <p className="cd-passo-titulo">
            Não há prazo nem tarefa em aberto neste caso. Registre o próximo quando ele chegar.
          </p>
          <button
            type="button"
            className="btn btn-outline-primary d-inline-flex align-items-center gap-1"
            onClick={onRegistrar}
            data-testid="btn-registrar-passo"
          >
            <PlusIcon style={{ width: 16, height: 16 }} aria-hidden="true" />
            Registrar prazo ou tarefa
          </button>
        </div>
      )}

      {checklist.length > 0 && (
        <>
          <div className="cd-divider" />
          <div className="cd-check-head">
            <h3 className="cd-card-title">O que falta</h3>
            <span className="cd-check-progress" data-testid="check-progresso">
              {concluidos} de {checklist.length} concluídos
            </span>
          </div>
          <ul className="cd-check-list">
            {checklist.map((c) => (
              <ChecklistItem key={c.id} item={c} onAcao={onChecklistAcao} />
            ))}
          </ul>
        </>
      )}

      {item && peca && (
        <div className="cd-peca" data-testid="peca-cabivel">
          <div>
            <p className="cd-peca-kicker">Peça cabível</p>
            <p className="cd-peca-nome">{peca}</p>
            <p className="cd-peca-texto">
              Endereçamento, qualificação das partes e nº do processo preenchidos com os dados do
              caso.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
            onClick={() => onGerarPeca?.(item)}
            data-testid="btn-gerar-peca"
          >
            <DocumentTextIcon style={{ width: 18, height: 18 }} aria-hidden="true" />
            Gerar peça
          </button>
        </div>
      )}
    </section>
  )
}
