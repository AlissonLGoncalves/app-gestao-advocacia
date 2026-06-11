// Fase 2 (inbox-zero) — o verbo central do produto: TRATAR a intimação.
//
// Padrão Astrea: toda captura converge pra um único botão "Tratar" com
// saídas claras — Prazo, Audiência, Tarefa, Só registrar ou Descartar.
// A sugestão vem do mesmo motor determinístico das auto-tarefas
// (calcular_prazo): tipo + título + vencimento + prioridade já preenchidos;
// o advogado revisa e confirma. Criar a ação marca a intimação como
// tratada (sai da fila de Não tratadas).
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ListBulletIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { getSugestaoTratamento, tratarPublicacao, ignorarPublicacao } from '../../api/djen.js'
import { createItemAgenda } from '../../api/itensAgenda.js'

const OPCOES = [
  {
    key: 'prazo',
    label: 'Prazo',
    desc: 'Vencimento processual — entra no Kanban e no calendário',
    icon: ClockIcon,
    cor: 'danger',
  },
  {
    key: 'audiencia',
    label: 'Audiência',
    desc: 'Compromisso com data e hora no calendário',
    icon: CalendarDaysIcon,
    cor: 'warning',
  },
  {
    key: 'tarefa',
    label: 'Tarefa',
    desc: 'Trabalho interno sem prazo fatal',
    icon: ListBulletIcon,
    cor: 'primary',
  },
  {
    key: 'registro',
    label: 'Só registrar ciência',
    desc: 'Nada a fazer — marca como tratada e sai da fila',
    icon: CheckCircleIcon,
    cor: 'success',
  },
  {
    key: 'descartar',
    label: 'Descartar',
    desc: 'Não é meu / irrelevante — sai da fila como descartada',
    icon: XCircleIcon,
    cor: 'secondary',
  },
]

function TratarIntimacaoModal({ pub, onTratado, onClose, onCadastrarProcesso }) {
  const [sugestao, setSugestao] = useState(null)
  const [opcao, setOpcao] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('09:00')
  const [salvando, setSalvando] = useState(false)

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

  const precisaCaso = ['prazo', 'audiencia', 'tarefa'].includes(opcao) && !pub.caso_id

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
          caso_id: pub.caso_id || undefined,
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
      onTratado?.()
    } catch (err) {
      toast.error(err?.message || 'Falha ao tratar a intimação.')
    } finally {
      setSalvando(false)
    }
  }

  const mostraCamposData = ['prazo', 'audiencia', 'tarefa'].includes(opcao)

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
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Tratar intimação</h5>
              <small className="text-muted">
                {pub.numero_processo_mascara || pub.numero_processo || 'sem nº de processo'}
                {sugestao?.regra && !sugestao.regra.startsWith('fallback') && (
                  <span className="badge bg-info-subtle text-info-emphasis ms-2">
                    sugerido: {OPCOES.find((o) => o.key === sugestao.tipo_sugerido)?.label}
                    {sugestao.dias ? ` em ${sugestao.dias} dias` : ''}
                  </span>
                )}
              </small>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Fechar"
              disabled={salvando}
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <div className="d-grid gap-2 mb-3">
              {OPCOES.map((o) => {
                const Icon = o.icon
                const ativa = opcao === o.key
                return (
                  <button
                    key={o.key}
                    type="button"
                    className={`btn text-start d-flex align-items-center gap-2 ${
                      ativa ? `btn-${o.cor}` : `btn-outline-${o.cor}`
                    }`}
                    onClick={() => setOpcao(o.key)}
                    disabled={salvando}
                    data-testid={`opcao-${o.key}`}
                  >
                    <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <span>
                      <strong>{o.label}</strong>
                      <span
                        className={`d-block small ${ativa ? '' : 'text-muted'}`}
                        style={{ fontSize: '0.78rem' }}
                      >
                        {o.desc}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {mostraCamposData && (
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small fw-semibold">Título</label>
                  <input
                    className="form-control form-control-sm"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    disabled={salvando}
                    data-testid="tratar-titulo"
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold">
                    {opcao === 'audiencia' ? 'Data da audiência' : 'Vencimento'}
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    disabled={salvando}
                    data-testid="tratar-data"
                  />
                  {sugestao?.dias && opcao === 'prazo' && (
                    <small className="text-muted">
                      calculado: {sugestao.dias} dias da disponibilização
                    </small>
                  )}
                </div>
                {opcao === 'audiencia' && (
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Hora</label>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                      disabled={salvando}
                    />
                  </div>
                )}
              </div>
            )}

            {precisaCaso && (
              <div className="alert alert-warning small mt-3 mb-0 d-flex justify-content-between align-items-center">
                <span>
                  Esta intimação ainda <strong>não tem processo cadastrado</strong> — cadastre
                  primeiro pra vincular o {opcao === 'audiencia' ? 'compromisso' : 'prazo'}.
                </span>
                {onCadastrarProcesso && (
                  <button
                    type="button"
                    className="btn btn-sm btn-warning flex-shrink-0 ms-2"
                    onClick={() => onCadastrarProcesso(pub)}
                    data-testid="btn-cadastrar-processo"
                  >
                    Cadastrar processo
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmar}
              disabled={salvando || !opcao || precisaCaso}
              data-testid="btn-confirmar-tratamento"
            >
              {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TratarIntimacaoModal
