// Intimações — inbox zero com extração (redesign Stitch, set/2026).
//
// A tela tem UM trabalho: o advogado decide, em 30 segundos por publicação,
// o que fazer com o que o Patronus leu no DJEN. Toda a lógica madura
// (sync assíncrono, filtros server-side, triagem, OABs, tratar, mutirão,
// paginação) foi preservada; o que mudou foi a organização: cards com a
// zona "Extraído automaticamente", painel lateral "Tratar" (≥ lg) com
// "Confirmar e próxima", filtros secundários escondidos num popover e
// estados vazios como recompensa.
import { TRIBUNAIS } from '../constants/tribunais.js'
import AbaOabs from '../components/djen/AbaOabs.jsx'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'react-toastify'
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  IdentificationIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { useConfirm } from '../hooks/useConfirm.jsx'
import {
  decodeHtmlEntities,
  sanitizarHtmlTribunal,
  extrairTextoPlano,
} from '../utils/htmlTribunal.js'
import ModalCriarClienteCaso from '../components/djen/ModalCriarClienteCaso.jsx'
import { wrapPubParaModalCriar } from '../utils/djenModal.js'
import TratarIntimacaoModal from '../components/djen/TratarIntimacaoModal.jsx'
import AbaTriagem from '../components/djen/AbaTriagem.jsx'
import CategoriasPublicacoes, { CATEGORIAS } from '../components/djen/CategoriasPublicacoes.jsx'
import ModalNovaTarefaInline from '../components/djen/ModalNovaTarefaInline.jsx'
import RiscoBadge from '../components/ui/RiscoBadge.jsx'
import {
  baixarCertidao as baixarCertidaoApi,
  createOab,
  deleteOab,
  getPublicacao,
  ignorarPublicacao as ignorarPublicacaoApi,
  ignorarTriagem as ignorarTriagemApi,
  listOabs,
  listPublicacoes,
  autoVincularPendentes as autoVincularPendentesApi,
  listTriagem,
  processarLoteTriagem as processarLoteTriagemApi,
  syncDjen,
  getSyncJobStatus,
  updatePublicacao,
  reclassificarPublicacao,
  vincularDecisao,
  backfillPartes,
  tratarPublicacoesEmLote,
} from '../api/djen.js'
import { listCasos } from '../api/casos.js'
import { destinoNoTribunal } from '../utils/linkTribunal.js'
import {
  TITULO_NAO_EXTRAIDO,
  assuntoDe,
  numeroProcessoDe,
  partesDaPublicacao,
  prazoTexto,
} from '../utils/djenExtracao.js'
import './DjenPage.css'

// ?aba=nao-tratadas|sem-processo|tratadas|oabs (Início linka assim).
// Os valores de SEÇÃO (oabs/triagem) abrem a aba secundária; os demais
// selecionam a categoria dentro da caixa de entrada.
const SECOES_PARAM = ['oabs', 'triagem']
const CATEGORIA_POR_PARAM = {
  'nao-tratadas': 'nao_tratadas',
  'sem-processo': 'sem_processo',
  tratadas: 'tratadas',
  descartadas: 'descartadas',
  todas: 'todas',
  importantes: 'importantes',
}
const PARAM_POR_CATEGORIA = Object.fromEntries(
  Object.entries(CATEGORIA_POR_PARAM).map(([param, cat]) => [cat, param])
)
const PILLS_TOOLBAR = ['nao_tratadas', 'sem_processo', 'tratadas']

const FILTROS_VAZIOS = {
  lida: '',
  sigla_tribunal: '',
  numero_processo: '',
  nome_parte: '',
  numero_oab: '',
  data_inicio: '',
  data_fim: '',
  origem: '',
  ordenar: 'data_desc',
}

const MQ_LG = '(min-width: 992px)'
const matchLg = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(MQ_LG).matches
    : false

export default function DjenPage() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const [aba, setAba] = useState(() =>
    SECOES_PARAM.includes(searchParams.get('aba') || '') ? searchParams.get('aba') : 'publicacoes'
  )
  const [publicacoes, setPublicacoes] = useState([])
  const [total, setTotal] = useState(0)
  const [naoLidas, setNaoLidas] = useState(0)
  // Epic #10: aba de categoria DENTRO da aba "publicacoes". Inspirado no
  // Astrea (Importantes / Andamentos / Tarefas / etc).
  // Fase 2 (inbox-zero): a caixa de entrada abre nas NÃO TRATADAS.
  // Redesign: ?aba= pré-seleciona a pill.
  const [categoria, setCategoria] = useState(
    () => CATEGORIA_POR_PARAM[searchParams.get('aba') || ''] || 'nao_tratadas'
  )
  const [pubTratar, setPubTratar] = useState(null)
  const [contagens, setContagens] = useState({
    todas: 0,
    nao_lidas: 0,
    pendentes: 0,
    vinculadas: 0,
    importantes: 0,
  })
  const categoriaRef = useRef(categoria)
  useEffect(() => {
    categoriaRef.current = categoria
  }, [categoria])
  const [loadingPubs, setLoadingPubs] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [autoSyncExecutada, setAutoSyncExecutada] = useState(false)
  const [diasSync, setDiasSync] = useState(30)

  // Filtros — inicializa numero_processo a partir de ?processo= e o
  // tribunal a partir de ?tribunal= na URL
  const [filtros, setFiltros] = useState(() => ({
    ...FILTROS_VAZIOS,
    numero_processo: searchParams.get('processo') || '',
    sigla_tribunal: (searchParams.get('tribunal') || '').toUpperCase(),
  }))
  const [offset, setOffset] = useState(0)
  const [itensPorPagina, setItensPorPagina] = useState(20)
  const filtrosRef = useRef(filtros)
  useEffect(() => {
    filtrosRef.current = filtros
  }, [filtros])

  // Redesign: busca única da toolbar (nº do processo ou nome da parte),
  // popover "Filtros", painel lateral, progresso da sessão.
  const [busca, setBusca] = useState(searchParams.get('processo') || '')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const popoverRef = useRef(null)
  const [telaLarga, setTelaLarga] = useState(matchLg)
  const [confirmadasSessao, setConfirmadasSessao] = useState(0)
  const [saindoId, setSaindoId] = useState(null)

  // OABs monitoradas
  const [oabs, setOabs] = useState([])
  const [loadingOabs, setLoadingOabs] = useState(false)
  const [novaOab, setNovaOab] = useState({
    numero_oab: '',
    uf_oab: '',
    nome_advogado: '',
    sigla_tribunal: '',
  })
  const [salvandoOab, setSalvandoOab] = useState(false)
  const [ultimasPublicacoesDjen, setUltimasPublicacoesDjen] = useState([])
  const [loadingUltimasPublicacoesDjen, setLoadingUltimasPublicacoesDjen] = useState(false)
  const [triagemItems, setTriagemItems] = useState([])
  const [triagemTotal, setTriagemTotal] = useState(0)
  const [loadingTriagem, setLoadingTriagem] = useState(false)
  const [triagemSelecionadas, setTriagemSelecionadas] = useState([])
  const [processandoLoteTriagem, setProcessandoLoteTriagem] = useState(false)
  const [triagemOffset, setTriagemOffset] = useState(0)
  const TRIAGEM_LIMIT = 20
  const [triagemBusca, setTriagemBusca] = useState('')
  const [triagemExpandido, setTriagemExpandido] = useState({})
  const [itemModalCriar, setItemModalCriar] = useState(null)

  // Entrega 1 (destravar) — mutirão na caixa de intimações.
  const [selecionadas, setSelecionadas] = useState([])
  const [tratandoLote, setTratandoLote] = useState(false)

  // Detalhe
  const [pubSelecionada, setPubSelecionada] = useState(null)
  // Epic #2 (#176): estado de "classificando" pra desabilitar botao durante chamada
  const [reclassificandoPub, setReclassificandoPub] = useState(false)
  // Epic #3 (#177): pub-alvo do modal "criar tarefa inline" (null = fechado)
  const [pubParaTarefa, setPubParaTarefa] = useState(null)
  const [casos, setCasos] = useState([])
  const publicacaoAlvo = searchParams.get('publicacao')

  // ── Carregar publicações ────────────────────────────────────────────────────
  const carregarPublicacoes = useCallback(
    async (offsetParam = 0, limitParam = itensPorPagina) => {
      const f = filtrosRef.current
      const cat = categoriaRef.current
      setLoadingPubs(true)
      try {
        // Epic #10: a categoria selecionada vira filtro server-side. Quando
        // o user filtrou explicitamente em "Leitura", manda o valor dele;
        // senao, deriva de "categoria" (ex: aba "Nao lidas" => lida=false).
        const lidaFromCat = cat === 'nao_lidas' ? 'false' : ''
        const lidaFiltro = f.lida !== '' ? f.lida : lidaFromCat
        // Fase 2 (inbox-zero): categorias por estado de tratamento.
        const inbox =
          cat === 'nao_tratadas' || cat === 'sem_processo'
            ? 'nao_tratadas'
            : cat === 'tratadas'
              ? 'tratadas'
              : cat === 'descartadas'
                ? 'descartadas'
                : undefined
        const vinculacao =
          cat === 'sem_processo' || cat === 'pendentes'
            ? 'sem_caso'
            : cat === 'vinculadas'
              ? 'com_caso'
              : undefined
        // Epic #2: categoria "Importantes" filtra por classificacao IA
        const importante = cat === 'importantes' ? 'true' : undefined

        const data = await listPublicacoes({
          limit: limitParam,
          offset: offsetParam,
          lida: lidaFiltro !== '' ? lidaFiltro : undefined,
          sigla_tribunal: f.sigla_tribunal || undefined,
          numero_processo: f.numero_processo || undefined,
          nome_parte: f.nome_parte || undefined,
          numero_oab: f.numero_oab || undefined,
          data_inicio: f.data_inicio || undefined,
          data_fim: f.data_fim || undefined,
          origem: f.origem || undefined,
          ordenar: f.ordenar || 'data_desc',
          vinculacao,
          importante,
          inbox,
        })

        setPublicacoes(data.items || [])
        setTotal(data.total || 0)
        setNaoLidas(data.nao_lidas || 0)
        if (data.contagens) setContagens(data.contagens)
      } catch {
        toast.error('Não foi possível carregar as publicações. Recarregue a página.')
      } finally {
        setLoadingPubs(false)
      }
    },
    [itensPorPagina]
  )

  // Feedback 12/06 — auto-backfill das partes do acervo antigo: roda UMA
  // vez por sessão, em lotes, sob a sessão do próprio usuário. Novas
  // publicações já chegam com partes pela ingestão.
  useEffect(() => {
    if (sessionStorage.getItem('djen_backfill_partes_ok')) return
    let ativo = true
    ;(async () => {
      try {
        for (let i = 0; i < 5; i++) {
          const r = await backfillPartes(500)
          if (!ativo) return
          if (!r || r.restantes === 0) break
        }
        sessionStorage.setItem('djen_backfill_partes_ok', '1')
        carregarPublicacoes(0)
      } catch {
        /* silencioso — tenta de novo na próxima sessão */
      }
    })()
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Carregar OABs ───────────────────────────────────────────────────────────
  const carregarOabs = useCallback(async () => {
    setLoadingOabs(true)
    try {
      const data = await listOabs()
      setOabs(Array.isArray(data) ? data : [])
    } catch {
      /* silencioso */
    } finally {
      setLoadingOabs(false)
    }
  }, [])

  // ── Carregar casos para vínculo ─────────────────────────────────────────────
  const carregarCasos = useCallback(async () => {
    try {
      const data = await listCasos()
      setCasos(Array.isArray(data) ? data : data?.casos || [])
    } catch {
      /* silencioso */
    }
  }, [])

  // ── Últimas publicações DJEN para aba OABs ────────────────────────────────
  const carregarUltimasPublicacoesDjen = useCallback(async () => {
    setLoadingUltimasPublicacoesDjen(true)
    try {
      const data = await listPublicacoes({ limit: 8, offset: 0 })
      setUltimasPublicacoesDjen(data.items || [])
    } catch {
      setUltimasPublicacoesDjen([])
    } finally {
      setLoadingUltimasPublicacoesDjen(false)
    }
  }, [])

  // ── Carregar fila de triagem ───────────────────────────────────────────────
  const carregarTriagem = useCallback(async (offsetParam = 0) => {
    setLoadingTriagem(true)
    try {
      const data = await listTriagem({
        limit: TRIAGEM_LIMIT,
        offset: offsetParam,
        somente_pendentes: true,
      })
      setTriagemItems(data.items || [])
      setTriagemTotal(data.total || 0)
      setTriagemSelecionadas([])
    } catch {
      toast.error('Não foi possível carregar a triagem. Verifique sua conexão.')
    } finally {
      setLoadingTriagem(false)
    }
  }, [])

  useEffect(() => {
    carregarPublicacoes(0)
    carregarOabs()
    carregarCasos()
    carregarTriagem()
    carregarUltimasPublicacoesDjen()
  }, [
    carregarPublicacoes,
    carregarOabs,
    carregarCasos,
    carregarTriagem,
    carregarUltimasPublicacoesDjen,
  ])

  // Epic #10: ao trocar de categoria, recarrega lista (server-side filter).
  // categoriaRef pega o valor atual dentro da callback estavel.
  useEffect(() => {
    carregarPublicacoes(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria])

  // Painel lateral só em ≥ lg; abaixo disso o "Tratar" continua modal.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(MQ_LG)
    const onChange = (e) => setTelaLarga(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  // Popover "Filtros": fecha com Esc ou clique fora.
  useEffect(() => {
    if (!filtrosAbertos) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFiltrosAbertos(false)
    }
    const onClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setFiltrosAbertos(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [filtrosAbertos])

  // ── Sincronizar (B1 2026-05-01: async via djen-worker) ────────────────────
  // POST /djen/sync retorna 202 + job_id; depois polling em GET /djen/sync/<id>
  // a cada 3s ate status 'done' ou 'failed'. Timeout 5min total.
  const sincronizar = useCallback(
    async ({ silencioso = false } = {}) => {
      setSyncing(true)
      let toastId = null
      try {
        const enqueueResp = await syncDjen(diasSync)
        const jobId = enqueueResp?.job_id
        if (!jobId) {
          if (!silencioso)
            toast.error('Não foi possível iniciar a leitura do DJEN. Tente de novo em instantes.')
          return
        }

        if (!silencioso) {
          const reused = enqueueResp?.reused
          toastId = toast.info(
            reused ? 'Sync ja em andamento, acompanhando...' : 'Sync iniciado em background...',
            { autoClose: false, closeButton: false }
          )
        }

        // Polling: 3s entre chamadas, max 5 min total
        const MAX_POLL_ATTEMPTS = 100 // 100 * 3s = 300s = 5min
        let attempt = 0
        let finalJob = null
        while (attempt < MAX_POLL_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 3000))
          attempt += 1
          try {
            const job = await getSyncJobStatus(jobId)
            if (job.status === 'done' || job.status === 'failed') {
              finalJob = job
              break
            }
            // pending ou running: continua polling silenciosamente
          } catch (e) {
            // Erro de rede em uma chamada de polling nao aborta — tenta de novo
            console.warn('Poll error (will retry):', e)
          }
        }

        if (toastId !== null) toast.dismiss(toastId)

        if (!finalJob) {
          if (!silencioso) {
            toast.warning('Sync ainda em andamento. Recarregue em alguns minutos.', {
              autoClose: 6000,
            })
          }
          return
        }

        if (finalJob.status === 'done') {
          const resumo = finalJob.resumo || {}
          const salvas = resumo.publicacoes_salvas ?? 0
          const encontrados = resumo.itens_encontrados ?? 0
          const oabsProc = resumo.oabs_processadas ?? 0
          const casosProc = resumo.casos_processados ?? 0
          if (!silencioso) {
            toast.success(
              `Sync DJEN concluído: ${salvas} nova(s), ${encontrados} encontrada(s), OABs ${oabsProc}, casos ${casosProc}.`
            )
          }
          setOffset(0)
          await carregarPublicacoes(0)
          await carregarOabs()
          await carregarTriagem()
          await carregarUltimasPublicacoesDjen()
        } else {
          // failed
          const erro = finalJob.erro || ''
          if (!silencioso) {
            if (erro.toLowerCase().includes('rate limit') || erro.includes('429')) {
              toast.warning(
                'API do DJEN está limitada. Aguarde alguns minutos e tente novamente.',
                { autoClose: 6000 }
              )
            } else {
              toast.error(`Sync falhou: ${erro || 'erro desconhecido'}`, { autoClose: 8000 })
            }
          }
        }
      } catch (err) {
        if (toastId !== null) toast.dismiss(toastId)
        if (silencioso) return
        if (err?.status === 429 || err?.payload?.code === 'djen_rate_limit') {
          toast.warning(
            err?.payload?.message ||
              'API do DJEN está limitada. Aguarde alguns minutos e tente novamente.',
            { autoClose: 6000 }
          )
        } else if (err?.status === 503) {
          toast.error('Serviço DJEN indisponível no momento. Tente novamente em alguns minutos.')
        } else {
          toast.error(err?.message || 'Erro ao sincronizar.')
        }
      } finally {
        setSyncing(false)
      }
    },
    [carregarOabs, carregarPublicacoes, carregarTriagem, carregarUltimasPublicacoesDjen, diasSync]
  )

  useEffect(() => {
    if (autoSyncExecutada || loadingOabs || syncing) return

    // Não força sync quando não há OAB cadastrada.
    if (oabs.length === 0) {
      setAutoSyncExecutada(true)
      return
    }

    setAutoSyncExecutada(true)
    sincronizar({ silencioso: true })
  }, [autoSyncExecutada, loadingOabs, syncing, oabs, sincronizar])

  // ── Marcar publicação como lida ─────────────────────────────────────────────
  const marcarLida = useCallback(
    async (pub, lida) => {
      try {
        await updatePublicacao(pub.id, { lida })
        setPublicacoes((prev) => prev.map((p) => (p.id === pub.id ? { ...p, lida } : p)))
        setNaoLidas((prev) => (lida ? prev - 1 : prev + 1))
        if (pubSelecionada?.id === pub.id) setPubSelecionada({ ...pubSelecionada, lida })
      } catch {
        toast.error('Não foi possível atualizar a publicação. Tente de novo.')
      }
    },
    [pubSelecionada]
  )

  const abrirDetalhePublicacao = useCallback(
    (pub) => {
      if (!pub?.id) return

      setAba('publicacoes')
      setPubSelecionada(pub)

      const novosParams = new URLSearchParams(searchParams)
      novosParams.set('publicacao', String(pub.id))
      setSearchParams(novosParams, { replace: true })

      if (!pub.lida) {
        marcarLida(pub, true)
      }
    },
    [marcarLida, searchParams, setSearchParams]
  )

  const fecharDetalhePublicacao = useCallback(() => {
    setPubSelecionada(null)
    const novosParams = new URLSearchParams(searchParams)
    novosParams.delete('publicacao')
    setSearchParams(novosParams, { replace: true })
  }, [searchParams, setSearchParams])

  // Epic #2 (#176): forca reclassificacao IA da publicacao selecionada.
  // Atualiza otimisticamente o detalhe + a lista (mesmo id na lista) sem
  // refazer fetch completo. Em caso de erro, toast e mantem estado anterior.
  const reclassificarPub = useCallback(async (pub) => {
    if (!pub?.id) return
    setReclassificandoPub(true)
    try {
      const atualizada = await reclassificarPublicacao(pub.id)
      setPubSelecionada((cur) => (cur && cur.id === atualizada.id ? atualizada : cur))
      setPublicacoes((prev) =>
        prev.map((p) => (p.id === atualizada.id ? { ...p, ...atualizada } : p))
      )
      toast.success(
        atualizada.importante ? '⭐ Classificada como importante.' : 'Classificada como rotina.'
      )
    } catch (err) {
      toast.error(err?.message || 'Falha ao reclassificar.')
    } finally {
      setReclassificandoPub(false)
    }
  }, [])

  useEffect(() => {
    if (!publicacaoAlvo) {
      return
    }

    const publicacaoId = Number(publicacaoAlvo)
    if (!Number.isInteger(publicacaoId) || publicacaoId <= 0) {
      return
    }

    if (pubSelecionada?.id === publicacaoId) {
      return
    }

    const pubNaLista = publicacoes.find((pub) => pub.id === publicacaoId)
    if (pubNaLista) {
      setAba('publicacoes')
      setPubSelecionada(pubNaLista)
      if (!pubNaLista.lida) {
        marcarLida(pubNaLista, true)
      }
      return
    }

    let ativo = true

    const carregarPublicacaoAlvo = async () => {
      try {
        const data = await getPublicacao(publicacaoId)
        if (!ativo) return

        setAba('publicacoes')
        setPubSelecionada(data)

        if (!data.lida) {
          marcarLida(data, true)
        }
      } catch {
        /* silencioso */
      }
    }

    carregarPublicacaoAlvo()

    return () => {
      ativo = false
    }
  }, [publicacaoAlvo, publicacoes, pubSelecionada, marcarLida])

  // ── Vincular caso ───────────────────────────────────────────────────────────
  const vincularCaso = async (pub, caso_id) => {
    try {
      const updated = await updatePublicacao(pub.id, { caso_id: caso_id || null })
      setPublicacoes((prev) => prev.map((p) => (p.id === pub.id ? { ...p, ...updated } : p)))
      setTriagemItems((prev) => prev.filter((i) => i.publicacao.id !== pub.id))
      setTriagemTotal((prev) => Math.max(0, prev - 1))
      if (pubSelecionada?.id === pub.id) setPubSelecionada(updated)
      toast.success('Vínculo atualizado.')
    } catch {
      toast.error('Não foi possível vincular ao caso. Tente de novo.')
    }
  }

  const mesclarTriagemCaso = async (pub, casoId) => {
    try {
      await vincularDecisao(pub.id, casoId)

      setTriagemItems((prev) => prev.filter((i) => i.publicacao.id !== pub.id))
      setTriagemTotal((prev) => Math.max(0, prev - 1))
      await carregarPublicacoes(0)
      await carregarUltimasPublicacoesDjen()
      toast.success('Publicação mesclada ao caso com sucesso.')
    } catch {
      toast.error('Não foi possível mesclar a publicação. Verifique sua conexão.')
    }
  }

  const ignorarTriagem = async (pub) => {
    try {
      await ignorarTriagemApi(pub.id, 'Sem ação necessária')

      setTriagemItems((prev) => prev.filter((i) => i.publicacao.id !== pub.id))
      setTriagemTotal((prev) => Math.max(0, prev - 1))
      await carregarPublicacoes(0)
      await carregarUltimasPublicacoesDjen()
      toast.success('Publicação ignorada na triagem.')
    } catch {
      toast.error('Não foi possível ignorar a publicação. Verifique sua conexão.')
    }
  }

  // ── Criar cliente + caso via triagem ──────────────────────────────────────
  const criarClienteECasoTriagem = async (pub) => {
    const item = triagemItems.find((i) => i.publicacao.id === pub.id)
    if (item) {
      setItemModalCriar(item)
    }
  }

  // Redesign: "Criar caso" direto do card. Prefere o item rico da triagem
  // (se carregado); senão monta o wrapper a partir da própria publicação.
  const abrirCriarCaso = (pub) => {
    const itemRico = triagemItems.find((i) => i.publicacao?.id === pub.id)
    setItemModalCriar(itemRico || wrapPubParaModalCriar(pub))
  }

  const onSucessoModalCriar = async () => {
    setItemModalCriar(null)
    await carregarTriagem(triagemOffset)
    await carregarPublicacoes(0)
    await carregarCasos()
    await carregarUltimasPublicacoesDjen()
  }

  const toggleSelecaoTriagem = (pubId) => {
    setTriagemSelecionadas((prev) =>
      prev.includes(pubId) ? prev.filter((id) => id !== pubId) : [...prev, pubId]
    )
  }

  const selecionarTodasTriagem = () => {
    const ids = triagemItems.map((i) => i.publicacao.id)
    setTriagemSelecionadas(ids)
  }

  const limparSelecaoTriagem = () => {
    setTriagemSelecionadas([])
  }

  const [autoVinculandoPendentes, setAutoVinculandoPendentes] = useState(false)
  const autoVincularPendentes = async () => {
    if (autoVinculandoPendentes) return
    setAutoVinculandoPendentes(true)
    try {
      const payload = await autoVincularPendentesApi()
      const total = payload.total ?? 0
      const vinculadas = payload.vinculadas ?? 0
      const ainda = payload.ainda_pendentes ?? 0
      if (vinculadas > 0) {
        toast.success(
          `${vinculadas} de ${total} publicações vinculadas automaticamente. ${ainda} continuam pendentes.`
        )
      } else {
        toast.info(
          `Nenhum vínculo automático possível. As ${ainda} pendentes são de processos ainda não cadastrados como caso (e sem cliente com CPF/CNPJ ou nome compatível). Use "Criar cliente e caso" — a partir daí, novas intimações desse processo já chegam vinculadas.`,
          { autoClose: 8000 }
        )
      }
      await carregarTriagem()
      await carregarPublicacoes(0)
    } catch (err) {
      toast.error(err?.message || 'Falha ao reprocessar pendentes.')
    } finally {
      setAutoVinculandoPendentes(false)
    }
  }

  // Entrega 1 — mutirão: trata/descarta as selecionadas de uma vez.
  const tratarSelecionadasEmLote = async (acao) => {
    if (selecionadas.length === 0) return
    const verbo = acao === 'descartar' ? 'DESCARTAR' : 'marcar como TRATADAS'
    const ok = await confirm(
      `${verbo} ${selecionadas.length} intimação(ões)? ` +
        (acao === 'descartar'
          ? 'Elas saem da caixa como não relevantes.'
          : 'Elas saem da caixa e ficam registradas como tratadas.'),
      'Confirmar mutirão'
    )
    if (!ok) return
    setTratandoLote(true)
    try {
      const r = await tratarPublicacoesEmLote(selecionadas, acao)
      toast.success(`${r?.processadas ?? selecionadas.length} intimação(ões) processada(s).`)
      setSelecionadas([])
      await carregarPublicacoes(0)
    } catch {
      toast.error('Não foi possível processar o lote. Tente de novo.')
    } finally {
      setTratandoLote(false)
    }
  }

  const processarLoteTriagem = async () => {
    if (triagemSelecionadas.length === 0) {
      toast.info('Selecione ao menos uma publicação na triagem.')
      return
    }

    setProcessandoLoteTriagem(true)
    try {
      const payload = await processarLoteTriagemApi(triagemSelecionadas)

      const processadas = payload.processadas ?? 0
      const erros = payload.erros ?? 0
      toast.success(`Lote concluído: ${processadas} processada(s), ${erros} erro(s).`)

      await carregarTriagem()
      await carregarPublicacoes(0)
      await carregarCasos()
      await carregarUltimasPublicacoesDjen()
    } catch {
      toast.error('Não foi possível processar o lote. Verifique sua conexão.')
    } finally {
      setProcessandoLoteTriagem(false)
    }
  }

  // ── Salvar OAB ──────────────────────────────────────────────────────────────
  const salvarOab = async (e) => {
    e.preventDefault()
    setSalvandoOab(true)
    try {
      await createOab(novaOab)
      toast.success('OAB cadastrada. O DJEN dela será lido amanhã às 7h.')
      setNovaOab({ numero_oab: '', uf_oab: '', nome_advogado: '', sigla_tribunal: '' })
      carregarOabs()
    } catch {
      toast.error('Não foi possível cadastrar a OAB. Verifique sua conexão.')
    } finally {
      setSalvandoOab(false)
    }
  }

  // ── Remover OAB ─────────────────────────────────────────────────────────────
  const removerOab = async (id) => {
    const ok = await confirm('Remover esta OAB do monitoramento?', 'Remover OAB')
    if (!ok) return
    try {
      await deleteOab(id)
      toast.success('OAB removida.')
      setOabs((prev) => prev.filter((o) => o.id !== id))
    } catch {
      toast.error('Não foi possível remover a OAB. Tente de novo.')
    }
  }

  // ── Baixar certidão ─────────────────────────────────────────────────────────
  const baixarCertidao = async (pub) => {
    if (!pub.hash_comunicacao) {
      toast.warning('Esta publicação não possui certidão disponível.')
      return
    }
    try {
      const blob = await baixarCertidaoApi(pub.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certidao_djen_${pub.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível baixar a certidão. Verifique sua conexão.')
    }
  }

  // Entrega 1 — o app não substitui o tribunal: leva até ele.
  const abrirNoTribunal = async (pub) => {
    const destino = destinoNoTribunal(pub)
    if (!destino) return
    const numero = numeroProcessoDe(pub)
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

  // ── Filtros ─────────────────────────────────────────────────────────────────
  // Aplica um conjunto de filtros IMEDIATAMENTE (atualiza a ref síncrona
  // pra callback estável enxergar o valor novo sem esperar o re-render).
  const aplicarFiltrosImediato = (novos) => {
    filtrosRef.current = novos
    setFiltros(novos)
    setOffset(0)
    carregarPublicacoes(0)
  }

  const aplicarFiltros = (e) => {
    e?.preventDefault?.()
    setOffset(0)
    carregarPublicacoes(0)
    setFiltrosAbertos(false)
  }

  const atualizarParams = (mutator) => {
    const p = new URLSearchParams(searchParams)
    mutator(p)
    setSearchParams(p, { replace: true })
  }

  const limparFiltros = () => {
    setBusca('')
    aplicarFiltrosImediato({ ...FILTROS_VAZIOS })
    atualizarParams((p) => {
      p.delete('tribunal')
      p.delete('processo')
    })
    setFiltrosAbertos(false)
  }

  const trocarCategoria = (novaCat) => {
    setCategoria(novaCat)
    setOffset(0)
    setSelecionadas([])
    atualizarParams((p) => p.set('aba', PARAM_POR_CATEGORIA[novaCat] || novaCat))
  }

  // Seções (caixa de entrada / OABs / triagem) também vivem em ?aba=, pra o
  // link do Início e o F5 caírem na mesma tela.
  const irParaAba = (novaAba) => {
    setAba(novaAba)
    atualizarParams((p) =>
      p.set(
        'aba',
        novaAba === 'publicacoes' ? PARAM_POR_CATEGORIA[categoria] || categoria : novaAba
      )
    )
  }

  const trocarTribunal = (sigla) => {
    aplicarFiltrosImediato({ ...filtrosRef.current, sigla_tribunal: sigla })
    atualizarParams((p) => (sigla ? p.set('tribunal', sigla) : p.delete('tribunal')))
  }

  // Busca única: com dígitos vira nº do processo; senão nome da parte.
  const submeterBusca = (e) => {
    e.preventDefault()
    const q = busca.trim()
    const ehNumero = /\d/.test(q)
    aplicarFiltrosImediato({
      ...filtrosRef.current,
      numero_processo: ehNumero ? q : '',
      nome_parte: ehNumero ? '' : q,
    })
  }

  const filtrosAtivos = [
    filtros.lida,
    filtros.numero_oab,
    filtros.data_inicio,
    filtros.data_fim,
    filtros.origem,
    filtros.ordenar !== 'data_desc' ? 'x' : '',
    !PILLS_TOOLBAR.includes(categoria) ? 'x' : '',
  ].filter(Boolean).length
  const temFiltroDeBusca = Boolean(
    filtros.numero_processo || filtros.nome_parte || filtros.sigla_tribunal
  )

  const fmtData = (valor, comHora = false) => {
    if (!valor) return '—'

    const texto = String(valor).trim()
    const normalizado = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T12:00:00` : texto
    const d = new Date(normalizado)

    if (Number.isNaN(d.getTime())) return '—'

    return d.toLocaleString('pt-BR', comHora ? { dateStyle: 'short', timeStyle: 'short' } : {})
  }

  // ── Tratar: painel/modal + "Confirmar e próxima" ────────────────────────────
  const fila = publicacoes.filter((p) => !p.tratada_em && !p.triagem_ignorada)
  const proximaDaFila = (depoisDeId) => {
    const idx = fila.findIndex((p) => p.id === depoisDeId)
    if (idx === -1) return fila[0] || null
    return fila[idx + 1] || fila.slice(0, idx)[0] || null
  }

  // Tira a publicação da caixa (ou marca in-place nas categorias históricas)
  // e ajusta as contagens localmente — sem refetch, pra fila "andar" na hora.
  const removerDaCaixa = (pub, { descartada = false } = {}) => {
    const emFila = categoria === 'nao_tratadas' || categoria === 'sem_processo'
    const agora = new Date().toISOString()
    setSaindoId(pub.id)
    setTimeout(() => {
      setSaindoId(null)
      setPublicacoes((prev) =>
        emFila
          ? prev.filter((p) => p.id !== pub.id)
          : prev.map((p) =>
              p.id === pub.id
                ? descartada
                  ? { ...p, triagem_ignorada: true }
                  : { ...p, tratada_em: agora }
                : p
            )
      )
    }, 280)
    setSelecionadas((prev) => prev.filter((id) => id !== pub.id))
    if (emFila) setTotal((t) => Math.max(0, t - 1))
    setContagens((c) => ({
      ...c,
      nao_tratadas: Math.max(0, (c.nao_tratadas || 0) - 1),
      sem_processo: pub.caso_id ? c.sem_processo : Math.max(0, (c.sem_processo || 0) - 1),
      tratadas: descartada ? c.tratadas : (c.tratadas || 0) + 1,
      descartadas: descartada ? (c.descartadas || 0) + 1 : c.descartadas,
      tratadas_hoje:
        typeof c.tratadas_hoje === 'number' && !descartada ? c.tratadas_hoje + 1 : c.tratadas_hoje,
    }))
    // Página esvaziou mas o servidor ainda tem mais: busca a próxima leva.
    if (emFila && publicacoes.length <= 1 && total > 1) {
      setTimeout(() => carregarPublicacoes(0), 300)
    }
  }

  const onTratado = (pub, opcao) => {
    setConfirmadasSessao((n) => n + 1)
    const proxima = proximaDaFila(pub.id)
    removerDaCaixa(pub, { descartada: opcao === 'descartar' })
    setPubTratar(proxima && proxima.id !== pub.id ? proxima : null)
  }

  const descartarDoCard = async (pub) => {
    const ok = await confirm(
      'Descartar esta intimação? Ela sai da caixa como não relevante.',
      'Descartar'
    )
    if (!ok) return
    try {
      await ignorarPublicacaoApi(pub.id)
      toast.success('Intimação descartada.')
      if (pubTratar?.id === pub.id) setPubTratar(proximaDaFila(pub.id))
      removerDaCaixa(pub, { descartada: true })
    } catch {
      toast.error('Não foi possível descartar a intimação. Tente de novo.')
    }
  }

  const pubTratarAtual = pubTratar
    ? publicacoes.find((p) => p.id === pubTratar.id) || pubTratar
    : null
  const painelAberto = Boolean(pubTratarAtual) && telaLarga
  const temProxima = pubTratarAtual ? fila.some((p) => p.id !== pubTratarAtual.id) : false

  // Progresso do dia: API dá tratadas_hoje; senão conta a sessão.
  const tratadasHojeApi = contagens.tratadas_hoje
  const temTratadasHojeApi = typeof tratadasHojeApi === 'number'
  const feitas = temTratadasHojeApi ? tratadasHojeApi : confirmadasSessao
  const pendentes = contagens.nao_tratadas || 0
  const totalDia = feitas + pendentes
  const pctDia = totalDia > 0 ? Math.round((feitas / totalDia) * 100) : 0

  const textoDetalheOriginal = (pubSelecionada?.texto || '').trim()
  const textoDetalheDecodificado = decodeHtmlEntities(textoDetalheOriginal)
  const textoDetalheHtmlSeguro = sanitizarHtmlTribunal(textoDetalheDecodificado)
  const textoDetalhePlano = extrairTextoPlano(textoDetalheHtmlSeguro)

  const semOab = !loadingOabs && oabs.length === 0 && (contagens.todas || 0) === 0

  // ── Card de publicação ──────────────────────────────────────────────────────
  const renderCard = (pub) => {
    const partes = partesDaPublicacao(pub, casos)
    const numero = numeroProcessoDe(pub)
    const assunto = assuntoDe(pub)
    const prazo = prazoTexto(pub.prazo_sugerido)
    const semCaso = !pub.caso_id
    const pendente = !pub.tratada_em && !pub.triagem_ignorada
    const destino = destinoNoTribunal(pub)
    const ativa = pubTratarAtual?.id === pub.id
    const classes = [
      'dj-card',
      ativa ? 'is-ativa' : '',
      saindoId === pub.id ? 'is-saindo' : '',
      !pendente ? 'is-tratada' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <article key={pub.id} className={classes} data-testid={`card-pub-${pub.id}`}>
        {/* Zona esquerda: bruto */}
        <div style={{ minWidth: 0 }}>
          <div className="dj-card__meta">
            <input
              type="checkbox"
              className="form-check-input dj-card__check"
              aria-label={`Selecionar publicação ${numero || pub.id}`}
              checked={selecionadas.includes(pub.id)}
              onChange={(e) =>
                setSelecionadas((prev) =>
                  e.target.checked ? [...prev, pub.id] : prev.filter((id) => id !== pub.id)
                )
              }
            />
            <span className="dj-chip dj-chip--tribunal">{pub.sigla_tribunal || '—'}</span>
            <span className="dj-num">{fmtData(pub.data_disponibilizacao)}</span>
            {pub.nome_orgao && (
              <span className="text-truncate" style={{ maxWidth: 260 }} title={pub.nome_orgao}>
                · {pub.nome_orgao}
              </span>
            )}
            {pub.tipo_comunicacao && (
              <span className="dj-chip dj-chip--quiet">{pub.tipo_comunicacao}</span>
            )}
            <RiscoBadge pub={pub} />
            {pub.triagem_ignorada ? (
              <span className="dj-chip dj-chip--descartada">Descartada</span>
            ) : pub.tratada_em ? (
              <span className="dj-chip dj-chip--tratada">
                Tratada · {fmtData(pub.tratada_em, true)}
              </span>
            ) : null}
          </div>
          <p
            className="dj-card__texto"
            role="button"
            tabIndex={0}
            title="Ver publicação completa"
            onClick={() => abrirDetalhePublicacao(pub)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                abrirDetalhePublicacao(pub)
              }
            }}
          >
            {pub.texto ? extrairTextoPlano(pub.texto).slice(0, 320) : 'Sem texto disponível.'}
          </p>
          <div className="dj-card__hover">
            {destino && (
              <button
                type="button"
                className="dj-quiet"
                onClick={() => abrirNoTribunal(pub)}
                title={
                  destino.precisaColar
                    ? `Abre a consulta do ${destino.nome} e copia o nº do processo`
                    : `Abre esta publicação no ${destino.nome}`
                }
                data-testid={`btn-abrir-tribunal-${pub.id}`}
              >
                <ArrowTopRightOnSquareIcon aria-hidden="true" /> Abrir no tribunal
              </button>
            )}
            {pendente && (
              <button
                type="button"
                className="dj-quiet dj-quiet--danger"
                onClick={() => descartarDoCard(pub)}
                data-testid={`btn-descartar-${pub.id}`}
              >
                <TrashIcon aria-hidden="true" /> Descartar
              </button>
            )}
          </div>
        </div>

        {/* Zona direita: extraído automaticamente */}
        <div className="dj-card__extraido" style={{ minWidth: 0 }}>
          <div className="dj-extraido__label">
            <SparklesIcon aria-hidden="true" /> Extraído automaticamente
          </div>
          <div className="dj-grid">
            <div className="dj-campo">
              <div className="dj-campo__k">Partes</div>
              <div
                className={`dj-campo__v${partes.texto ? '' : ' dj-campo__v--vazio'}`}
                title={partes.texto || TITULO_NAO_EXTRAIDO}
                data-testid={`partes-pub-${pub.id}`}
              >
                <span>{partes.texto || '—'}</span>
              </div>
            </div>
            <div className="dj-campo">
              <div className="dj-campo__k">Nº do processo</div>
              <div
                className={`dj-campo__v dj-num${numero ? '' : ' dj-campo__v--vazio'}`}
                title={
                  numero
                    ? semCaso
                      ? 'revisar — sem caso vinculado'
                      : 'vinculado ao caso'
                    : TITULO_NAO_EXTRAIDO
                }
              >
                <span>{numero || '—'}</span>
                {numero && (
                  <span
                    className={`dj-dot ${semCaso ? 'dj-dot--revisar' : 'dj-dot--ok'}`}
                    aria-label={semCaso ? 'revisar' : 'vinculado ao caso'}
                    data-testid={`dot-${pub.id}`}
                  />
                )}
                {semCaso && <span className="dj-chip dj-chip--sem-processo">Sem processo</span>}
              </div>
            </div>
            <div className="dj-campo">
              <div className="dj-campo__k">Assunto</div>
              <div
                className={`dj-campo__v${assunto ? '' : ' dj-campo__v--vazio'}`}
                title={assunto || TITULO_NAO_EXTRAIDO}
              >
                <span>{assunto || '—'}</span>
              </div>
            </div>
            <div className="dj-campo">
              <div className="dj-campo__k">Prazo</div>
              <div
                className={`dj-campo__v${prazo ? '' : ' dj-campo__v--vazio'}`}
                title={
                  prazo
                    ? 'dias corridos, contados da disponibilização — confirme ao tratar'
                    : TITULO_NAO_EXTRAIDO
                }
                data-testid={`prazo-pub-${pub.id}`}
              >
                <span>{prazo || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ação */}
        <div className="dj-card__acao">
          {pendente ? (
            <button
              type="button"
              className="btn btn-primary dj-btn-primary"
              title="Tratar intimação (prazo, audiência, tarefa…)"
              data-testid={`btn-tratar-${pub.id}`}
              onClick={() => setPubTratar(pub)}
            >
              Tratar
            </button>
          ) : (
            <button
              type="button"
              className="dj-btn-quiet"
              onClick={() => abrirDetalhePublicacao(pub)}
            >
              Ver
            </button>
          )}
          {semCaso && pendente && (
            <button
              type="button"
              className="dj-link"
              onClick={() => abrirCriarCaso(pub)}
              data-testid={`btn-criar-caso-${pub.id}`}
            >
              Criar caso
            </button>
          )}
        </div>
      </article>
    )
  }

  // ── Estados vazios ──────────────────────────────────────────────────────────
  const renderVazio = () => {
    if (semOab) {
      return (
        <div className="dj-vazio" data-testid="vazio-sem-oab">
          <div className="dj-vazio__icone dj-vazio__icone--neutro">
            <IdentificationIcon aria-hidden="true" />
          </div>
          <h2 className="dj-vazio__titulo">
            Cadastre sua OAB para o Patronus ler o DJEN por você.
          </h2>
          <p className="dj-vazio__texto">
            Todo dia às 7h as publicações chegam aqui com partes, nº do processo e prazo já
            extraídos.
          </p>
          <button
            type="button"
            className="btn btn-primary dj-btn-primary"
            onClick={() => {
              irParaAba('oabs')
              carregarOabs()
              carregarUltimasPublicacoesDjen()
            }}
          >
            Cadastrar OAB
          </button>
        </div>
      )
    }
    if (categoria === 'nao_tratadas' && !temFiltroDeBusca && filtrosAtivos === 0) {
      return (
        <div className="dj-vazio" data-testid="vazio-caixa-zerada">
          <div className="dj-vazio__icone">
            <CheckIcon aria-hidden="true" />
          </div>
          <h2 className="dj-vazio__titulo">Caixa zerada.</h2>
          <p className="dj-vazio__texto">
            Todas as publicações de hoje foram tratadas. Próxima leitura do DJEN amanhã às 7h.
          </p>
          <button
            type="button"
            className="dj-btn-quiet"
            onClick={() => trocarCategoria('tratadas')}
          >
            Ver tratadas
          </button>
        </div>
      )
    }
    return (
      <div className="dj-vazio" data-testid="vazio-filtros">
        <div className="dj-vazio__icone dj-vazio__icone--neutro">
          <InboxIcon aria-hidden="true" />
        </div>
        <h2 className="dj-vazio__titulo">Nenhuma publicação aqui.</h2>
        <p className="dj-vazio__texto">Nada combina com a caixa e os filtros escolhidos.</p>
        <button
          type="button"
          className="btn btn-primary dj-btn-primary"
          onClick={() => {
            limparFiltros()
            if (categoria !== 'nao_tratadas') trocarCategoria('nao_tratadas')
          }}
        >
          Limpar filtros
        </button>
      </div>
    )
  }

  // ── Select de tribunal (dropdown agrupado) ──────────────────────────────────
  const renderOpcoesTribunais = () => (
    <>
      <option value="">Todos os tribunais</option>
      <optgroup label="Superiores">
        {TRIBUNAIS.filter((t) => ['STF', 'STJ', 'TST', 'TSE', 'STM'].includes(t.sigla)).map((t) => (
          <option key={t.sigla} value={t.sigla}>
            {t.sigla} — {t.nome.replace(/^[A-Z]+ – /, '')}
          </option>
        ))}
      </optgroup>
      <optgroup label="TRFs – Justiça Federal">
        {TRIBUNAIS.filter((t) => t.sigla.startsWith('TRF')).map((t) => (
          <option key={t.sigla} value={t.sigla}>
            {t.sigla} — {t.nome.replace(/TRF \d+ª Região /, '')}
          </option>
        ))}
      </optgroup>
      <optgroup label="TJs – Justiça Estadual">
        {TRIBUNAIS.filter((t) => t.sigla.startsWith('TJ') && !t.sigla.startsWith('TJM')).map(
          (t) => (
            <option key={t.sigla} value={t.sigla}>
              {t.sigla} — {t.nome.replace(/TJ\w+ – /, '')}
            </option>
          )
        )}
      </optgroup>
      <optgroup label="TRTs – Justiça do Trabalho">
        {TRIBUNAIS.filter((t) => t.sigla.startsWith('TRT')).map((t) => (
          <option key={t.sigla} value={t.sigla}>
            {t.sigla} — {t.nome.replace(/TRT \d+ª Região /, '')}
          </option>
        ))}
      </optgroup>
      <optgroup label="TREs – Justiça Eleitoral">
        {TRIBUNAIS.filter((t) => t.sigla.startsWith('TRE')).map((t) => (
          <option key={t.sigla} value={t.sigla}>
            {t.sigla}
          </option>
        ))}
      </optgroup>
      <optgroup label="TJMs – Justiça Militar Estadual">
        {TRIBUNAIS.filter((t) => t.sigla.startsWith('TJM')).map((t) => (
          <option key={t.sigla} value={t.sigla}>
            {t.sigla} — {t.nome.replace(/TJM – /, '')}
          </option>
        ))}
      </optgroup>
    </>
  )

  const tratarProps = pubTratarAtual
    ? {
        pub: pubTratarAtual,
        casos,
        onVincularCaso: vincularCaso,
        confirmadas: confirmadasSessao,
        totalFila: confirmadasSessao + pendentes,
        temProxima,
        onClose: () => setPubTratar(null),
        onTratado,
        onCadastrarProcesso: (p) => {
          setPubTratar(null)
          abrirCriarCaso(p)
        },
      }
    : null

  return (
    <>
      {ConfirmDialog}
      <div className={`dj-page${painelAberto ? ' dj-page--largo' : ''}`}>
        {/* Cabeçalho */}
        <div className="dj-head">
          <div>
            <h1 className="dj-title">Intimações</h1>
            <p className="dj-sub" data-testid="dj-subtitulo">
              {pendentes === 1
                ? '1 publicação aguarda sua decisão'
                : `${pendentes} publicações aguardam sua decisão`}
            </p>
          </div>
          <div className="dj-head__acoes">
            <button
              type="button"
              className="dj-btn-quiet"
              onClick={() => sincronizar()}
              disabled={syncing}
              title={`Ler o DJEN dos últimos ${diasSync} dias agora`}
            >
              <ArrowPathIcon aria-hidden="true" className={syncing ? 'dj-spin' : ''} />
              {syncing ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          </div>
        </div>

        {/* Linha de progresso do dia */}
        <div className="dj-progress" data-testid="dj-progresso">
          <div className="dj-progress__label">
            <span>
              {temTratadasHojeApi
                ? `${feitas} de ${totalDia} tratadas hoje`
                : `${feitas} tratadas nesta sessão`}
            </span>
            {temTratadasHojeApi && totalDia > 0 && <span>{pctDia}%</span>}
          </div>
          <div className="dj-progress__bar" aria-hidden="true">
            <div
              className={`dj-progress__fill${pendentes === 0 && feitas > 0 ? ' dj-progress__fill--completo' : ''}`}
              style={{ width: `${pctDia}%` }}
            />
          </div>
        </div>

        {/* Abas secundárias */}
        <nav className="dj-tabs" aria-label="Seções do DJEN">
          <button
            type="button"
            className={`dj-tab${aba === 'publicacoes' ? ' is-active' : ''}`}
            onClick={() => irParaAba('publicacoes')}
          >
            Caixa de entrada
            {pendentes > 0 && <span className="dj-count dj-count--danger">{pendentes}</span>}
          </button>
          <button
            type="button"
            className={`dj-tab${aba === 'oabs' ? ' is-active' : ''}`}
            onClick={() => {
              irParaAba('oabs')
              carregarOabs()
              carregarUltimasPublicacoesDjen()
            }}
            data-testid="tab-oabs"
          >
            OABs monitoradas
          </button>
          <button
            type="button"
            className={`dj-tab${aba === 'triagem' ? ' is-active' : ''}`}
            onClick={() => {
              irParaAba('triagem')
              carregarTriagem()
            }}
          >
            Triagem IA
            {triagemTotal > 0 && <span className="dj-count dj-count--warning">{triagemTotal}</span>}
          </button>
        </nav>

        {/* ── Caixa de entrada ──────────────────────────────────────────────── */}
        {aba === 'publicacoes' && (
          <>
            {/* Toolbar: pills · tribunal · busca · Filtros */}
            <div className="dj-toolbar">
              <CategoriasPublicacoes
                ativa={categoria}
                contagens={contagens}
                onChange={trocarCategoria}
                categorias={PILLS_TOOLBAR}
              />
              <select
                className="dj-select"
                aria-label="Tribunal"
                value={filtros.sigla_tribunal}
                onChange={(e) => trocarTribunal(e.target.value)}
                data-testid="select-tribunal"
              >
                {renderOpcoesTribunais()}
              </select>
              <span className="dj-toolbar__spacer" />
              <form className="dj-search-wrap" onSubmit={submeterBusca} role="search">
                <MagnifyingGlassIcon className="dj-search-wrap__icone" aria-hidden="true" />
                <input
                  className="dj-search"
                  type="search"
                  aria-label="Buscar por nº do processo ou nome da parte"
                  placeholder="Buscar nº do processo ou parte"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  data-testid="busca-pubs"
                />
              </form>
              <div className="dj-filtros" ref={popoverRef}>
                <button
                  type="button"
                  className={`dj-btn-quiet${filtrosAbertos ? ' is-active' : ''}`}
                  aria-expanded={filtrosAbertos}
                  aria-haspopup="dialog"
                  onClick={() => setFiltrosAbertos((v) => !v)}
                  data-testid="btn-filtros"
                >
                  <AdjustmentsHorizontalIcon aria-hidden="true" />
                  Filtros
                  {filtrosAtivos > 0 && <span className="dj-count">{filtrosAtivos}</span>}
                </button>
                {filtrosAbertos && (
                  <form
                    className="dj-popover"
                    role="dialog"
                    aria-label="Filtros"
                    onSubmit={aplicarFiltros}
                    data-testid="popover-filtros"
                  >
                    <div className="dj-popover__titulo">Filtros</div>
                    <div className="row g-2">
                      <div className="col-12">
                        <label className="form-label" htmlFor="f-caixa">
                          Caixa
                        </label>
                        <select
                          id="f-caixa"
                          className="form-select form-select-sm"
                          value={categoria}
                          onChange={(e) => trocarCategoria(e.target.value)}
                        >
                          {CATEGORIAS.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label} ({contagens?.[c.key] ?? 0})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="f-ordenar">
                          Ordenar por
                        </label>
                        <select
                          id="f-ordenar"
                          className="form-select form-select-sm"
                          value={filtros.ordenar}
                          onChange={(e) => setFiltros((f) => ({ ...f, ordenar: e.target.value }))}
                        >
                          <option value="data_desc">Mais nova primeiro</option>
                          <option value="data_asc">Mais antiga primeiro</option>
                          <option value="tribunal_asc">Tribunal (A–Z)</option>
                          <option value="orgao_asc">Órgão (A–Z)</option>
                          <option value="tipo_asc">Tipo (A–Z)</option>
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="f-lida">
                          Leitura
                        </label>
                        <select
                          id="f-lida"
                          className="form-select form-select-sm"
                          value={filtros.lida}
                          onChange={(e) => setFiltros((f) => ({ ...f, lida: e.target.value }))}
                        >
                          <option value="">Todas</option>
                          <option value="false">Não lidas ({naoLidas})</option>
                          <option value="true">Lidas</option>
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="f-inicio">
                          Data início
                        </label>
                        <input
                          id="f-inicio"
                          type="date"
                          className="form-control form-control-sm"
                          value={filtros.data_inicio}
                          onChange={(e) =>
                            setFiltros((f) => ({ ...f, data_inicio: e.target.value }))
                          }
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="f-fim">
                          Data fim
                        </label>
                        <input
                          id="f-fim"
                          type="date"
                          className="form-control form-control-sm"
                          value={filtros.data_fim}
                          onChange={(e) => setFiltros((f) => ({ ...f, data_fim: e.target.value }))}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="f-oab">
                          OAB
                        </label>
                        <input
                          id="f-oab"
                          className="form-control form-control-sm"
                          placeholder="Ex: 94297"
                          value={filtros.numero_oab}
                          onChange={(e) =>
                            setFiltros((f) => ({ ...f, numero_oab: e.target.value }))
                          }
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="f-origem">
                          Origem
                        </label>
                        <select
                          id="f-origem"
                          className="form-select form-select-sm"
                          value={filtros.origem}
                          onChange={(e) => setFiltros((f) => ({ ...f, origem: e.target.value }))}
                        >
                          <option value="">Todas</option>
                          <option value="oab">via OAB</option>
                          <option value="processo">via Processo</option>
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="f-porpagina">
                          Por página
                        </label>
                        <select
                          id="f-porpagina"
                          className="form-select form-select-sm"
                          value={itensPorPagina}
                          onChange={(e) => {
                            const novoLimite = Number(e.target.value)
                            setItensPorPagina(novoLimite)
                            setOffset(0)
                            carregarPublicacoes(0, novoLimite)
                          }}
                        >
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="f-dias-sync">
                          Sincronizar últimos (dias)
                        </label>
                        <input
                          id="f-dias-sync"
                          type="number"
                          className="form-control form-control-sm"
                          min={1}
                          max={365}
                          value={diasSync}
                          onChange={(e) =>
                            setDiasSync(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))
                          }
                          disabled={syncing}
                        />
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-3">
                      <button type="submit" className="btn btn-primary btn-sm dj-btn-primary">
                        Aplicar
                      </button>
                      <button
                        type="button"
                        className="btn btn-light btn-sm"
                        onClick={limparFiltros}
                      >
                        Limpar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="row g-4">
              {/* Lista */}
              <div className={painelAberto ? 'col-lg-7' : 'col-12'}>
                {loadingPubs ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Carregando…</span>
                    </div>
                  </div>
                ) : publicacoes.length === 0 ? (
                  renderVazio()
                ) : (
                  <div className={painelAberto ? 'dj-lista dj-lista--com-painel' : 'dj-lista'}>
                    <div className="dj-lista__head">
                      <span className="dj-num">
                        {total} publicação(ões) · página {Math.floor(offset / itensPorPagina) + 1}
                      </span>
                      <button
                        type="button"
                        className="dj-link"
                        onClick={() =>
                          setSelecionadas(
                            selecionadas.length === publicacoes.length
                              ? []
                              : publicacoes.map((p) => p.id)
                          )
                        }
                      >
                        {selecionadas.length === publicacoes.length
                          ? 'Limpar seleção'
                          : 'Selecionar esta página'}
                      </button>
                    </div>

                    {/* Entrega 1 (destravar) — mutirão. Antes só dava pra tratar
                        UMA por vez: zerar um acervo de 300+ exigia 300 cliques,
                        então ninguém começava. Agora seleciona e resolve em lote. */}
                    {selecionadas.length > 0 && (
                      <div className="dj-lote" data-testid="barra-lote">
                        <strong className="dj-num">{selecionadas.length} selecionada(s)</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          disabled={tratandoLote}
                          onClick={() => tratarSelecionadasEmLote('registro')}
                        >
                          {tratandoLote ? 'Processando…' : 'Marcar como tratadas'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={tratandoLote}
                          onClick={() => tratarSelecionadasEmLote('descartar')}
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          className="dj-link"
                          onClick={() => setSelecionadas([])}
                        >
                          Limpar
                        </button>
                      </div>
                    )}

                    {publicacoes.map(renderCard)}

                    {/* Paginação */}
                    {total > itensPorPagina && (
                      <div className="dj-pag">
                        <button
                          type="button"
                          className="dj-btn-quiet"
                          disabled={offset === 0}
                          onClick={() => {
                            const o = Math.max(0, offset - itensPorPagina)
                            setOffset(o)
                            carregarPublicacoes(o)
                          }}
                        >
                          ← Anterior
                        </button>
                        <button
                          type="button"
                          className="dj-btn-quiet"
                          disabled={offset + itensPorPagina >= total}
                          onClick={() => {
                            const o = offset + itensPorPagina
                            setOffset(o)
                            carregarPublicacoes(o)
                          }}
                        >
                          Próxima →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Painel lateral "Tratar" (≥ lg) */}
              {painelAberto && (
                <div className="col-lg-5">
                  <TratarIntimacaoModal key={pubTratarAtual.id} {...tratarProps} modo="painel" />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Aba OABs ──────────────────────────────────────────────────────── */}
        {aba === 'oabs' && (
          <AbaOabs
            oabs={oabs}
            novaOab={novaOab}
            setNovaOab={setNovaOab}
            salvarOab={salvarOab}
            removerOab={removerOab}
            salvandoOab={salvandoOab}
            fmtData={fmtData}
            loadingOabs={loadingOabs}
            ultimasPublicacoesDjen={ultimasPublicacoesDjen}
            loadingUltimasPublicacoesDjen={loadingUltimasPublicacoesDjen}
            carregarUltimasPublicacoesDjen={carregarUltimasPublicacoesDjen}
            abrirDetalhePublicacao={abrirDetalhePublicacao}
          />
        )}

        {/* ── Aba Triagem ───────────────────────────────────────────────────── */}
        {/* Issue #300 (3b): aba extraída — props explícitas do estado da página */}
        {aba === 'triagem' && (
          <AbaTriagem
            triagemItems={triagemItems}
            triagemTotal={triagemTotal}
            triagemOffset={triagemOffset}
            setTriagemOffset={setTriagemOffset}
            triagemBusca={triagemBusca}
            setTriagemBusca={setTriagemBusca}
            triagemExpandido={triagemExpandido}
            setTriagemExpandido={setTriagemExpandido}
            triagemSelecionadas={triagemSelecionadas}
            toggleSelecaoTriagem={toggleSelecaoTriagem}
            selecionarTodasTriagem={selecionarTodasTriagem}
            limparSelecaoTriagem={limparSelecaoTriagem}
            loadingTriagem={loadingTriagem}
            carregarTriagem={carregarTriagem}
            processarLoteTriagem={processarLoteTriagem}
            processandoLoteTriagem={processandoLoteTriagem}
            autoVincularPendentes={autoVincularPendentes}
            autoVinculandoPendentes={autoVinculandoPendentes}
            criarClienteECasoTriagem={criarClienteECasoTriagem}
            ignorarTriagem={ignorarTriagem}
            mesclarTriagemCaso={mesclarTriagemCaso}
            marcarLida={marcarLida}
          />
        )}

        {/* Fase 2 — Tratar intimação como modal (telas < lg) */}
        {pubTratarAtual && !painelAberto && (
          <TratarIntimacaoModal key={pubTratarAtual.id} {...tratarProps} modo="modal" />
        )}

        {/* Detalhe da publicação (texto completo, classificação IA, certidão) */}
        {pubSelecionada && (
          <div
            className="modal d-block"
            tabIndex={-1}
            style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1070 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) fecharDetalhePublicacao()
            }}
            data-testid="detalhe-publicacao"
          >
            <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
              <div className="modal-content" style={{ borderRadius: 'var(--radius-md)' }}>
                <div className="dj-tratar__head">
                  <div style={{ minWidth: 0 }}>
                    <h2 className="dj-tratar__titulo">Publicação completa</h2>
                    <div className="dj-card__meta mt-1 mb-0">
                      {pubSelecionada.sigla_tribunal && (
                        <span className="dj-chip dj-chip--tribunal">
                          {pubSelecionada.sigla_tribunal}
                        </span>
                      )}
                      <span className="dj-num">
                        {numeroProcessoDe(pubSelecionada) || 'sem nº de processo'}
                      </span>
                      <span>· {fmtData(pubSelecionada.data_disponibilizacao)}</span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-1 flex-shrink-0">
                    {destinoNoTribunal(pubSelecionada) && (
                      <button
                        type="button"
                        className="dj-quiet"
                        onClick={() => abrirNoTribunal(pubSelecionada)}
                        data-testid="btn-abrir-tribunal"
                      >
                        <ArrowTopRightOnSquareIcon aria-hidden="true" /> Abrir no tribunal
                      </button>
                    )}
                    {/* Epic #3 (#177): atalho pra criar tarefa vinculada a esta pub */}
                    <button
                      type="button"
                      className="dj-quiet"
                      onClick={() => setPubParaTarefa(pubSelecionada)}
                      title="Criar tarefa a partir desta publicação"
                      data-testid="btn-criar-tarefa-pub"
                    >
                      Criar tarefa
                    </button>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Fechar"
                      onClick={fecharDetalhePublicacao}
                    />
                  </div>
                </div>
                <div className="modal-body">
                  <table className="table table-sm table-borderless mb-3">
                    <tbody>
                      <tr>
                        <td className="text-muted small fw-semibold" style={{ width: 130 }}>
                          Tribunal
                        </td>
                        <td className="small">
                          {pubSelecionada.sigla_tribunal} — {pubSelecionada.nome_orgao}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted small fw-semibold">Processo</td>
                        <td className="small dj-num">{numeroProcessoDe(pubSelecionada) || '—'}</td>
                      </tr>
                      <tr>
                        <td className="text-muted small fw-semibold">Tipo</td>
                        <td className="small">
                          {pubSelecionada.tipo_comunicacao} / {pubSelecionada.tipo_documento}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted small fw-semibold">Classe</td>
                        <td className="small">{pubSelecionada.nome_classe || '—'}</td>
                      </tr>
                      <tr>
                        <td className="text-muted small fw-semibold">Disponibilizado</td>
                        <td className="small dj-num">
                          {fmtData(pubSelecionada.data_disponibilizacao)}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted small fw-semibold">Meio</td>
                        <td className="small">
                          {pubSelecionada.meio === 'D'
                            ? 'Diário Eletrônico'
                            : pubSelecionada.meio === 'E'
                              ? 'Edital'
                              : '—'}
                        </td>
                      </tr>
                      {/* Epic #2 (#176): linha de classificacao IA com motivo
                          + botao reclassificar manual. */}
                      <tr>
                        <td className="text-muted small fw-semibold">Classificação IA</td>
                        <td className="small">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            {pubSelecionada.importante === true && (
                              <span className="badge bg-danger">Importante</span>
                            )}
                            {pubSelecionada.importante === false && (
                              <span className="badge bg-secondary">Rotina</span>
                            )}
                            {pubSelecionada.importante === null && (
                              <span className="badge bg-light text-muted border">
                                Não classificada
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary py-0 px-2"
                              style={{ fontSize: '0.72rem' }}
                              disabled={reclassificandoPub}
                              onClick={() => reclassificarPub(pubSelecionada)}
                              title="Forçar reclassificação via IA (ignora cache)"
                              data-testid="btn-reclassificar-ia"
                            >
                              {reclassificandoPub ? 'Classificando…' : 'Reclassificar'}
                            </button>
                          </div>
                          {pubSelecionada.classificacao_motivo && (
                            <div
                              className="text-muted mt-1"
                              style={{ fontSize: '0.72rem', fontStyle: 'italic' }}
                            >
                              {pubSelecionada.classificacao_motivo}
                            </div>
                          )}
                        </td>
                      </tr>
                      {pubSelecionada.nome_juiz && (
                        <tr>
                          <td className="text-muted small fw-semibold">Magistrado</td>
                          <td className="small">{pubSelecionada.nome_juiz}</td>
                        </tr>
                      )}
                      {pubSelecionada.polo_ativo && (
                        <tr>
                          <td className="text-muted small fw-semibold">Polo Ativo</td>
                          <td className="small">{pubSelecionada.polo_ativo}</td>
                        </tr>
                      )}
                      {pubSelecionada.polo_passivo && (
                        <tr>
                          <td className="text-muted small fw-semibold">Polo Passivo</td>
                          <td className="small">{pubSelecionada.polo_passivo}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Texto da publicação */}
                  <div className="mb-3">
                    <div className="text-muted small fw-semibold mb-1">Texto da Publicação</div>
                    {textoDetalhePlano ? (
                      <div
                        className="p-2 bg-light rounded border small"
                        style={{
                          maxHeight: 260,
                          overflowY: 'auto',
                          overflowX: 'auto',
                          wordBreak: 'break-word',
                        }}
                        dangerouslySetInnerHTML={{ __html: textoDetalheHtmlSeguro }}
                      />
                    ) : (
                      <div className="p-2 bg-light rounded border small text-muted">
                        Sem texto disponível.
                      </div>
                    )}
                  </div>

                  {/* Vincular ao caso */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold" htmlFor="detalhe-caso">
                      Vincular ao processo cadastrado
                    </label>
                    <select
                      id="detalhe-caso"
                      className="form-select form-select-sm"
                      value={pubSelecionada.caso_id || ''}
                      onChange={(e) =>
                        vincularCaso(
                          pubSelecionada,
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
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

                  {/* Ações */}
                  <div className="d-flex gap-2 flex-wrap">
                    {pubSelecionada.link && (
                      <a
                        href={pubSelecionada.link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline-primary btn-sm"
                      >
                        Ver original
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => baixarCertidao(pubSelecionada)}
                    >
                      Baixar certidão
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => marcarLida(pubSelecionada, !pubSelecionada.lida)}
                    >
                      {pubSelecionada.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                    </button>
                    {!pubSelecionada.tratada_em && !pubSelecionada.triagem_ignorada && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm ms-auto"
                        onClick={() => {
                          setPubTratar(pubSelecionada)
                          fecharDetalhePublicacao()
                        }}
                      >
                        Tratar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {itemModalCriar && (
          <ModalCriarClienteCaso
            publicacao={itemModalCriar}
            onClose={() => setItemModalCriar(null)}
            onSuccess={onSucessoModalCriar}
          />
        )}

        {/* Epic #3 (#177): modal de criação rápida de tarefa a partir da pub.
            Após criar, marca a pub como lida (refletido localmente) e fecha. */}
        {pubParaTarefa && (
          <ModalNovaTarefaInline
            pub={pubParaTarefa}
            casos={casos}
            onClose={() => setPubParaTarefa(null)}
            onCriada={() => {
              // Otimisticamente marca a pub como lida na lista + detalhe
              setPublicacoes((prev) =>
                prev.map((p) => (p.id === pubParaTarefa.id ? { ...p, lida: true } : p))
              )
              if (pubSelecionada?.id === pubParaTarefa.id) {
                setPubSelecionada({ ...pubSelecionada, lida: true })
              }
              setNaoLidas((prev) => Math.max(0, prev - (pubParaTarefa.lida ? 0 : 1)))
            }}
          />
        )}
      </div>
    </>
  )
}
