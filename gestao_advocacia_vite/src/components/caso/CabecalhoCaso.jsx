// Redesign Stitch (TELA 3) — breadcrumb + cabeçalho do caso.
//
// Título "{cliente} × {parte contrária}" (mesma heurística da lista, #207);
// sem parte contrária cai no título do caso. Linha de meta: nº CNJ
// (tabular-nums) · tribunal · vara · assunto. Chip de fase + prioridade.
// À direita o ÚNICO botão primário da tela: "Abrir no tribunal ↗"
// (utils/linkTribunal.js). "+ Novo no caso" e "Mais ações" são secundários.

import React from 'react'
import { Link } from 'react-router'
import { toast } from 'react-toastify'
import { ArrowTopRightOnSquareIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import PrioridadeBadge from '../ui/PrioridadeBadge.jsx'
import { destinoTribunalDoCaso } from './tribunalDoCaso.js'
import { linhaMetaDoCaso, tituloDoCaso } from './tituloCaso.js'

async function abrirNoTribunal(destino, numero) {
  if (!destino) return
  if (destino.precisaColar && numero) {
    try {
      await navigator.clipboard.writeText(numero)
      toast.info(`Nº ${numero} copiado — cole na busca do tribunal.`)
    } catch {
      /* clipboard bloqueado: segue abrindo mesmo assim */
    }
  }
  window.open(destino.url, '_blank', 'noopener,noreferrer')
}

export default function CabecalhoCaso({
  caso,
  publicacoes = [],
  onNovoPrazo,
  onNovoEvento,
  onNovoContrato,
  onSincronizarDjen,
  onGerarResumo,
  sincronizando = false,
  gerandoResumo = false,
}) {
  if (!caso) return null
  const titulo = tituloDoCaso(caso)
  const meta = linhaMetaDoCaso(caso, publicacoes)
  const destino = destinoTribunalDoCaso(caso, publicacoes)
  const fase = (caso.fase_processual || '').trim()

  return (
    <header className="cd-head-wrap">
      <nav aria-label="breadcrumb" className="cd-breadcrumb">
        <Link to="/casos">Casos</Link>
        <span aria-hidden="true">/</span>
        <span className="cd-num" aria-current="page">
          {caso.numero_processo || titulo}
        </span>
      </nav>

      <div className="cd-header">
        <div className="cd-header-main">
          <h1 className="cd-title" data-testid="caso-titulo">
            {titulo}
          </h1>
          {(caso.numero_processo || meta.length > 0) && (
            <p className="cd-meta" data-testid="caso-meta">
              {caso.numero_processo && <span className="cd-num">{caso.numero_processo}</span>}
              {meta.map((m, i) => (
                <React.Fragment key={`${m}-${i}`}>
                  {(caso.numero_processo || i > 0) && (
                    <span className="cd-meta-sep" aria-hidden="true">
                      {' · '}
                    </span>
                  )}
                  <span>{m}</span>
                </React.Fragment>
              ))}
            </p>
          )}
          <div className="cd-chips">
            {fase ? (
              <span className="cd-chip" data-testid="chip-fase">
                {fase}
              </span>
            ) : (
              <span className="cd-chip cd-chip--vazio" data-testid="chip-fase">
                Fase não informada
              </span>
            )}
            <PrioridadeBadge prioridade={caso.prioridade} />
          </div>
        </div>

        <div className="cd-actions">
          <div className="dropdown">
            <button
              type="button"
              className="btn btn-outline-secondary btn-icon"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              aria-label="Mais ações do caso"
              title="Mais ações"
              data-testid="btn-mais-acoes"
            >
              <EllipsisHorizontalIcon style={{ width: 20, height: 20 }} aria-hidden="true" />
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <Link to={`/casos/editar/${caso.id}`} className="dropdown-item">
                  Editar caso
                </Link>
              </li>
              <li>
                <Link
                  to={`/agenda?caso=${caso.id}`}
                  className="dropdown-item"
                  title="Calendário e prazos só deste caso"
                >
                  Agenda do caso
                </Link>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={onSincronizarDjen}
                  disabled={!caso.numero_processo || sincronizando}
                  title={
                    caso.numero_processo
                      ? 'Busca publicações novas no DJEN para este processo'
                      : 'Cadastre o nº do processo para consultar o DJEN'
                  }
                  data-testid="acao-sincronizar-djen"
                >
                  {sincronizando ? 'Verificando DJEN...' : 'Verificar publicações no DJEN'}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={onGerarResumo}
                  disabled={publicacoes.length === 0 || gerandoResumo}
                  title={
                    publicacoes.length === 0
                      ? 'Sincronize o DJEN primeiro'
                      : 'Usa IA para resumir as publicações DJEN'
                  }
                  data-testid="acao-gerar-resumo"
                >
                  {gerandoResumo ? 'Gerando resumo...' : 'Gerar resumo com IA'}
                </button>
              </li>
            </ul>
          </div>

          <div className="dropdown">
            <button
              className="btn btn-outline-secondary dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              data-testid="btn-mais-caso"
            >
              + Novo no caso
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <button className="dropdown-item" onClick={onNovoPrazo} data-testid="mais-prazo">
                  Prazo / tarefa
                </button>
              </li>
              <li>
                <button
                  className="dropdown-item"
                  onClick={onNovoEvento}
                  data-testid="mais-audiencia"
                >
                  Audiência / compromisso
                </button>
              </li>
              <li>
                <button
                  className="dropdown-item"
                  onClick={onNovoContrato}
                  data-testid="mais-contrato"
                >
                  Contrato de honorários
                </button>
              </li>
            </ul>
          </div>

          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            disabled={!destino}
            title={
              !destino
                ? 'Cadastre o nº do processo (CNJ) para abrir no tribunal'
                : destino.precisaColar
                  ? `Abre a consulta do ${destino.nome} e copia o nº do processo`
                  : `Abre a publicação mais recente no ${destino.nome}`
            }
            onClick={() => abrirNoTribunal(destino, caso.numero_processo)}
            data-testid="btn-abrir-tribunal"
          >
            Abrir no tribunal
            <ArrowTopRightOnSquareIcon style={{ width: 16, height: 16 }} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
