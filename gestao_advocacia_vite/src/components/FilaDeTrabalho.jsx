// Fila de trabalho — a ÚNICA coisa no topo do Início.
//
// Substitui MeuDiaCard + MiniKanbanPrazos + "Próximos Prazos e Eventos", que
// mostravam os MESMOS dados em 3 lugares (e faziam 3 chamadas iguais à API).
// Feedback do uso real: "o app é confuso; o que eu tenho que fazer?".
//
// Princípio: a tela responde UMA pergunta — "o que eu faço agora?". Cada linha
// é uma ação com um botão. Nada de painel de números pra interpretar.
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import {
  ExclamationTriangleIcon,
  EnvelopeOpenIcon,
  CalendarDaysIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { listItensAgenda, tratarItemAgenda } from '../api/itensAgenda.js'
import { getContadoresInbox } from '../api/djen.js'
import { useConfirm } from '../hooks/useConfirm.jsx'

const hojeYMD = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

const ymd = (raw) => (raw ? String(raw).slice(0, 10) : null)

const concluido = (t) => t.status === 'Concluído' || t.status === 'Concluido'

const diasAtras = (dataYmd, hoje) => {
  const [ay, am, ad] = hoje.split('-').map(Number)
  const [by, bm, bd] = dataYmd.split('-').map(Number)
  return Math.round((new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd)) / 86400000)
}

// Uma linha da fila: ícone + o que é + botão de ação.
function LinhaAcao({ tom, icon: Icon, titulo, detalhe, acao, onAcao, extra }) {
  return (
    <div className="d-flex align-items-center gap-3 py-3 border-bottom flex-wrap">
      <Icon style={{ width: 22, height: 22, flexShrink: 0 }} className={`text-${tom}`} />
      <div className="flex-grow-1" style={{ minWidth: 200 }}>
        <div className="fw-semibold">{titulo}</div>
        {detalhe && <div className="text-muted small">{detalhe}</div>}
      </div>
      {extra}
      <button className={`btn btn-sm btn-${tom}`} onClick={onAcao}>
        {acao}
      </button>
    </div>
  )
}

export default function FilaDeTrabalho() {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [vencidos, setVencidos] = useState([])
  const [hojePrazos, setHojePrazos] = useState([])
  const [compromissos, setCompromissos] = useState([])
  const [naoTratadas, setNaoTratadas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [baixando, setBaixando] = useState(false)

  const carregar = useCallback(() => {
    const hoje = hojeYMD()
    // UMA busca só (antes: MeuDia, MiniKanban e Dashboard buscavam o mesmo).
    return Promise.allSettled([listItensAgenda({ status: 'Pendente' }), getContadoresInbox()]).then(
      ([itensRes, inboxRes]) => {
        if (itensRes.status === 'fulfilled') {
          const itens = Array.isArray(itensRes.value) ? itensRes.value : []
          const tarefas = itens.filter((i) => i.tipo === 'tarefa' && !concluido(i))
          setVencidos(
            tarefas
              .filter((t) => ymd(t.data_vencimento) && ymd(t.data_vencimento) < hoje)
              .sort((a, b) => ymd(a.data_vencimento).localeCompare(ymd(b.data_vencimento)))
          )
          setHojePrazos(tarefas.filter((t) => ymd(t.data_vencimento) === hoje))
          setCompromissos(
            itens.filter((i) => i.tipo === 'evento' && ymd(i.data_inicio) === hoje && !concluido(i))
          )
        }
        if (inboxRes.status === 'fulfilled') setNaoTratadas(inboxRes.value?.nao_tratadas ?? 0)
        setLoading(false)
      }
    )
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Baixa em massa: prazos que o advogado já cumpriu direto no sistema do
  // tribunal e nunca voltou aqui pra marcar. Fica registrado no histórico.
  const baixarVencidos = async () => {
    const ok = await confirm(
      `Marcar os ${vencidos.length} prazos vencidos como CUMPRIDOS (tratados direto no sistema do tribunal)? Eles saem da fila e ficam registrados no histórico de cada um.`,
      'Já tratei no tribunal'
    )
    if (!ok) return
    setBaixando(true)
    let okCount = 0
    for (const t of vencidos) {
      try {
        await tratarItemAgenda(t.id, {
          acao: 'cumpri',
          como_tratado: 'Tratado diretamente no sistema do tribunal (baixa em massa pela fila).',
        })
        okCount += 1
      } catch {
        /* segue o lote */
      }
    }
    setBaixando(false)
    toast.success(`${okCount} prazo(s) baixados.`)
    carregar()
  }

  if (loading) {
    return (
      <div className="card mb-4">
        <div className="card-body text-muted small py-4">Carregando sua fila...</div>
      </div>
    )
  }

  const temAlgo =
    vencidos.length > 0 || hojePrazos.length > 0 || compromissos.length > 0 || naoTratadas > 0

  return (
    <div className="card mb-4" data-testid="fila-trabalho">
      <div className="card-body">
        <div className="d-flex align-items-baseline justify-content-between mb-1">
          <h5 className="fw-bold mb-0" style={{ fontFamily: 'var(--font-title)' }}>
            O que fazer agora
          </h5>
          <span className="text-muted small text-capitalize">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            })}
          </span>
        </div>

        {!temAlgo && (
          <div className="d-flex align-items-center gap-2 text-success py-4">
            <CheckCircleIcon style={{ width: 22, height: 22 }} />
            <span className="fw-semibold">Tudo em dia. Nada precisa da sua atenção agora.</span>
          </div>
        )}

        {vencidos.length > 0 && (
          <LinhaAcao
            tom="danger"
            icon={ExclamationTriangleIcon}
            titulo={`${vencidos.length} ${vencidos.length === 1 ? 'prazo venceu' : 'prazos venceram'}`}
            detalhe={
              vencidos[0]?.data_vencimento
                ? `o mais antigo há ${diasAtras(ymd(vencidos[0].data_vencimento), hojeYMD())} dias — confira antes de baixar`
                : null
            }
            acao="Revisar"
            onAcao={() => navigate('/agenda?view=kanban&filtro=vencidos')}
            extra={
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={baixarVencidos}
                disabled={baixando}
              >
                {baixando ? 'Baixando...' : 'Já tratei no tribunal'}
              </button>
            }
          />
        )}

        {naoTratadas > 0 && (
          <LinhaAcao
            tom="warning"
            icon={EnvelopeOpenIcon}
            titulo={`${naoTratadas} ${naoTratadas === 1 ? 'intimação sem triagem' : 'intimações sem triagem'}`}
            detalhe="vire prazo, audiência ou tarefa — ou descarte"
            acao="Abrir caixa"
            onAcao={() => navigate('/djen')}
          />
        )}

        {hojePrazos.length > 0 && (
          <LinhaAcao
            tom="primary"
            icon={ClockIcon}
            titulo={`${hojePrazos.length} ${hojePrazos.length === 1 ? 'prazo vence' : 'prazos vencem'} hoje`}
            detalhe={hojePrazos
              .slice(0, 2)
              .map((t) => t.titulo)
              .join(' · ')}
            acao="Ver prazos"
            onAcao={() => navigate('/agenda?view=kanban')}
          />
        )}

        {compromissos.length > 0 && (
          <LinhaAcao
            tom="primary"
            icon={CalendarDaysIcon}
            titulo={`${compromissos.length} ${compromissos.length === 1 ? 'compromisso' : 'compromissos'} hoje`}
            detalhe={compromissos
              .slice(0, 2)
              .map((c) => `${String(c.data_inicio || '').slice(11, 16)} ${c.titulo}`)
              .join(' · ')}
            acao="Ver agenda"
            onAcao={() => navigate('/agenda?view=calendario')}
          />
        )}
      </div>
      {ConfirmDialog}
    </div>
  )
}
