// Fase 2 (inbox-zero) — o verbo central do produto: TRATAR a intimação.
//
// Padrão Astrea: toda captura converge pra um único botão "Tratar" com
// saídas claras — Prazo, Audiência, Tarefa, Só registrar ou Descartar.
// A sugestão vem do mesmo motor determinístico das auto-tarefas
// (calcular_prazo): tipo + título + vencimento + prioridade já preenchidos;
// o advogado revisa e confirma. Criar a ação marca a intimação como
// tratada (sai da fila de Não tratadas).
//
// Redesign Stitch (set/2026): o mesmo componente renderiza como MODAL
// (telas < lg) ou como PAINEL lateral sticky (`modo="painel"`, ≥ lg).
// Conteúdo: campos extraídos no topo (bolinha de confiança), bloco
// "Sugestão do Patronus", escolha segmentada, seletor de caso e o botão
// "Confirmar e próxima" — a página decide qual é a próxima da fila.
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ListBulletIcon,
  SparklesIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { getSugestaoTratamento, tratarPublicacao, ignorarPublicacao } from '../../api/djen.js'
import { createItemAgenda } from '../../api/itensAgenda.js'
import {
  TITULO_NAO_EXTRAIDO,
  assuntoDe,
  fmtDataCurta,
  numeroProcessoDe,
  partesDaPublicacao,
  prazoTexto,
  rotuloTipoSugerido,
} from '../../utils/djenExtracao.js'

const OPCOES = [
  {
    key: 'prazo',
    label: 'Prazo',
    desc: 'Vencimento processual — entra no Kanban e no calendário',
    icon: ClockIcon,
  },
  {
    key: 'audiencia',
    label: 'Audiência',
    desc: 'Compromisso com data e hora no calendário',
    icon: CalendarDaysIcon,
  },
  {
    key: 'tarefa',
    label: 'Tarefa',
    desc: 'Trabalho interno sem prazo fatal',
    icon: ListBulletIcon,
  },
  {
    key: 'registro',
    label: 'Registrar',
    desc: 'Só registrar ciência — nada a fazer, marca como tratada e sai da fila',
    icon: CheckCircleIcon,
  },
  {
    key: 'descartar',
    label: 'Descartar',
    desc: 'Não é meu / irrelevante — sai da fila como descartada',
    icon: XCircleIcon,
  },
]

function Campo({ rotulo, valor, numerico = false, indicador = null, titulo }) {
  const vazio = !valor
  return (
    <div className="dj-campo">
      <div className="dj-campo__k">{rotulo}</div>
      <div
        className={`dj-campo__v${vazio ? ' dj-campo__v--vazio' : ''}${numerico ? ' dj-num' : ''}`}
        title={vazio ? TITULO_NAO_EXTRAIDO : titulo || valor}
      >
        <span>{vazio ? '—' : valor}</span>
        {!vazio && indicador}
      </div>
    </div>
  )
}

function TratarIntimacaoModal({
  pub,
  onTratado,
  onClose,
  onCadastrarProcesso,
  modo = 'modal',
  casos = [],
  onVincularCaso,
  confirmadas = 0,
  totalFila = 0,
  temProxima = false,
}) {
  const [sugestao, setSugestao] = useState(null)
  const [opcao, setOpcao] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('09:00')
  const [salvando, setSalvando] = useState(false)
  // Caso vinculado: começa no que a publicação já tem; o seletor permite
  // trocar/vincular sem sair do fluxo (persistido via onVincularCaso).
  const [casoId, setCasoId] = useState(pub.caso_id || '')

  // Sugestão determinística (mesmo motor das auto-tarefas)
  useEffect(() => {
    let ativo = true
    getSugestaoTratamento(pub.id)
      .then((s) => {
        if (!ativo) return
        setSugestao(s)
        setOpcao(s.tipo_sugerido)
        setTitulo(s.titulo || '')
        setData(s.data_vencimento || '')
      })
      .catch(() => {
        if (!ativo) return
        setOpcao('prazo')
        setTitulo(`Intimação: ${pub.numero_processo_mascara || pub.numero_processo || ''}`)
      })
    return () => {
      ativo = false
    }
  }, [pub.id, pub.numero_processo, pub.numero_processo_mascara])

  const precisaCaso = ['prazo', 'audiencia', 'tarefa'].includes(opcao) && !casoId

  const confirmar = async () => {
    if (!opcao) return
    setSalvando(true)
    try {
      if (opcao === 'descartar') {
        await ignorarPublicacao(pub.id)
        toast.success('Intimação descartada.')
      } else if (opcao === 'registro') {
        await tratarPublicacao(pub.id, 'registro')
        toast.success('Ciência registrada — intimação tratada.')
      } else {
        const payload = {
          titulo: titulo.trim() || `Intimação: ${pub.numero_processo || ''}`,
          publicacao_djen_id: pub.id,
          caso_id: casoId || undefined,
          prioridade: sugestao?.prioridade || 'Normal',
        }
        if (opcao === 'audiencia') {
          payload.tipo = 'evento'
          payload.categoria = 'Audiência'
          payload.data_inicio = data ? `${data}T${hora || '09:00'}` : undefined
        } else {
          payload.tipo = 'tarefa'
          payload.categoria = opcao === 'prazo' ? 'Prazo' : 'Outros'
          payload.data_vencimento = data || undefined
        }
        await createItemAgenda(payload)
        toast.success(
          opcao === 'prazo'
            ? 'Prazo criado — intimação tratada.'
            : opcao === 'audiencia'
              ? 'Audiência agendada — intimação tratada.'
              : 'Tarefa criada — intimação tratada.'
        )
      }
      onTratado?.(pub, opcao)
    } catch (err) {
      toast.error(err?.message || 'Falha ao tratar a intimação.')
    } finally {
      setSalvando(false)
    }
  }

  const trocarCaso = (valor) => {
    const novo = valor ? parseInt(valor, 10) : null
    setCasoId(novo || '')
    onVincularCaso?.(pub, novo)
  }

  const mostraCamposData = ['prazo', 'audiencia', 'tarefa'].includes(opcao)
  const opcaoAtiva = OPCOES.find((o) => o.key === opcao)

  // Campos extraídos (mesma fonte do card da lista)
  const partes = partesDaPublicacao({ ...pub, caso_id: casoId || pub.caso_id }, casos)
  const numero = numeroProcessoDe(pub)
  const assunto = assuntoDe(pub)
  const temSugestaoReal = Boolean(sugestao?.providencia)
  const prazoExtraido = temSugestaoReal ? prazoTexto(sugestao) : prazoTexto(pub.prazo_sugerido)
  const dataPub = fmtDataCurta(pub.data_disponibilizacao)

  const corpo = (
    <div className="dj-tratar" data-testid="tratar-intimacao-corpo">
      <div className="dj-tratar__head">
        <div style={{ minWidth: 0 }}>
          <h2 className="dj-tratar__titulo">Tratar intimação</h2>
          <div className="dj-card__meta mt-1 mb-0">
            {pub.sigla_tribunal && (
              <span className="dj-chip dj-chip--tribunal">{pub.sigla_tribunal}</span>
            )}
            <span className="dj-num">{numero || 'sem nº de processo'}</span>
            {dataPub && <span>· {dataPub}</span>}
          </div>
        </div>
        <button
          type="button"
          className="dj-quiet"
          aria-label="Fechar"
          disabled={salvando}
          onClick={onClose}
        >
          <XMarkIcon />
        </button>
      </div>

      <div className="dj-tratar__body">
        <div>
          <div className="dj-extraido__label">
            <SparklesIcon aria-hidden="true" /> Extraído automaticamente
          </div>
          <div className="dj-grid">
            <Campo rotulo="Partes" valor={partes.texto} />
            <Campo
              rotulo="Nº do processo"
              valor={numero}
              numerico
              titulo={casoId ? 'vinculado ao caso' : 'revisar — sem caso vinculado'}
              indicador={
                <span
                  className={`dj-dot ${casoId ? 'dj-dot--ok' : 'dj-dot--revisar'}`}
                  aria-label={casoId ? 'vinculado ao caso' : 'revisar'}
                />
              }
            />
            <Campo rotulo="Assunto" valor={assunto} />
            <Campo
              rotulo="Prazo"
              valor={prazoExtraido}
              titulo="dias corridos, contados da disponibilização — ajuste se o prazo for em dias úteis"
            />
          </div>
        </div>

        {temSugestaoReal && (
          <div className="dj-sugestao" data-testid="sugestao-patronus">
            <div className="dj-sugestao__rotulo">Sugestão do Patronus</div>
            registrar {rotuloTipoSugerido(sugestao.tipo_sugerido)} de{' '}
            <strong>{sugestao.providencia}</strong>
            {sugestao.dias ? ` — ${sugestao.dias} dias` : ''}
            {sugestao.data_vencimento ? ` → vence ${fmtDataCurta(sugestao.data_vencimento)}` : ''}
            {dataPub ? ` (contado a partir de ${dataPub})` : ''}
            <small className="dj-sugestao__nota">
              Dias corridos, contagem conservadora. Ajuste a data se o prazo for em dias úteis.
            </small>
          </div>
        )}

        <div>
          <div className="dj-seg" role="radiogroup" aria-label="O que fazer com esta intimação">
            {OPCOES.map((o) => {
              const Icon = o.icon
              const ativa = opcao === o.key
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  className={`dj-seg__btn${ativa ? ' is-active' : ''}`}
                  onClick={() => setOpcao(o.key)}
                  disabled={salvando}
                  data-testid={`opcao-${o.key}`}
                >
                  <Icon aria-hidden="true" />
                  <span>{o.label}</span>
                </button>
              )
            })}
          </div>
          {opcaoAtiva && <p className="dj-seg__desc mt-2">{opcaoAtiva.desc}</p>}
        </div>

        {mostraCamposData && (
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label" htmlFor="tratar-titulo">
                Título
              </label>
              <input
                id="tratar-titulo"
                className="form-control form-control-sm"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                disabled={salvando}
                data-testid="tratar-titulo"
              />
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="tratar-data">
                {opcao === 'audiencia' ? 'Data da audiência' : 'Vencimento'}
              </label>
              <input
                id="tratar-data"
                type="date"
                className="form-control form-control-sm dj-num"
                value={data}
                onChange={(e) => setData(e.target.value)}
                disabled={salvando}
                data-testid="tratar-data"
              />
            </div>
            {opcao === 'audiencia' && (
              <div className="col-6">
                <label className="form-label" htmlFor="tratar-hora">
                  Hora
                </label>
                <input
                  id="tratar-hora"
                  type="time"
                  className="form-control form-control-sm dj-num"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  disabled={salvando}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="form-label" htmlFor="tratar-caso">
            Caso vinculado
          </label>
          <select
            id="tratar-caso"
            className="form-select form-select-sm"
            value={casoId || ''}
            onChange={(e) => trocarCaso(e.target.value)}
            disabled={salvando}
            data-testid="tratar-caso"
          >
            <option value="">— Nenhum —</option>
            {casos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero_processo ? `${c.numero_processo} — ` : ''}
                {c.titulo}
              </option>
            ))}
          </select>
        </div>

        {precisaCaso && (
          <div className="alert alert-warning small mb-0 d-flex justify-content-between align-items-center gap-2">
            <span>
              Esta intimação ainda <strong>não tem processo cadastrado</strong> — cadastre primeiro
              pra vincular o {opcao === 'audiencia' ? 'compromisso' : 'prazo'}.
            </span>
            {onCadastrarProcesso && (
              <button
                type="button"
                className="btn btn-sm btn-warning flex-shrink-0"
                onClick={() => onCadastrarProcesso(pub)}
                data-testid="btn-cadastrar-processo"
              >
                Cadastrar processo
              </button>
            )}
          </div>
        )}
      </div>

      <div className="dj-tratar__foot">
        <button
          type="button"
          className="btn btn-primary dj-btn-primary"
          onClick={confirmar}
          disabled={salvando || !opcao || precisaCaso}
          data-testid="btn-confirmar-tratamento"
        >
          {salvando ? 'Salvando…' : temProxima ? 'Confirmar e próxima' : 'Confirmar'}
        </button>
        <button type="button" className="dj-link" onClick={onClose} disabled={salvando}>
          Cancelar
        </button>
        <span className="dj-tratar__progresso" data-testid="tratar-progresso">
          Você confirmou {confirmadas} de {totalFila}.
        </span>
      </div>
    </div>
  )

  if (modo === 'painel') {
    return (
      <aside
        className="dj-painel"
        aria-label="Tratar intimação"
        data-testid="tratar-intimacao-painel"
      >
        {corpo}
      </aside>
    )
  }

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1075 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onClose?.()
      }}
      data-testid="tratar-intimacao-modal"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content" style={{ borderRadius: 'var(--radius-md)' }}>
          {corpo}
        </div>
      </div>
    </div>
  )
}

export default TratarIntimacaoModal
