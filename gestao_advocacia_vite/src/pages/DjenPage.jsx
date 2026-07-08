import { TRIBUNAIS } from '../constants/tribunais.js'
import AbaOabs from '../components/djen/AbaOabs.jsx'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
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
import CategoriasPublicacoes from '../components/djen/CategoriasPublicacoes.jsx'
import ModalNovaTarefaInline from '../components/djen/ModalNovaTarefaInline.jsx'
import RiscoBadge from '../components/ui/RiscoBadge.jsx'
import {
  baixarCertidao as baixarCertidaoApi,
  createOab,
  deleteOab,
  getPublicacao,
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
} from '../api/djen.js'
import { listCasos } from '../api/casos.js'

export default function DjenPage() {
  const { confirm, ConfirmDialog } = useConfirm()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [aba, setAba] = useState('publicacoes')
  const [publicacoes, setPublicacoes] = useState([])
  const [total, setTotal] = useState(0)
  const [naoLidas, setNaoLidas] = useState(0)
  // Epic #10: aba de categoria DENTRO da aba "publicacoes". Inspirado no
  // Astrea (Importantes / Andamentos / Tarefas / etc). Por enquanto:
  // todas | nao_lidas | pendentes | vinculadas. "Importantes" fica visivel
  // como placeholder (em breve) ate a Epic #2 (#176) classificar via IA.
  // Fase 2 (inbox-zero): a caixa de entrada abre nas NÃO TRATADAS.
  const [categoria, setCategoria] = useState('nao_tratadas')
  const [pubTratar, setPubTratar] = useState(null)
  // Feedback 12/06: "quem contra quem" em toda intimação da lista.
  // Caso vinculado é a fonte preferida (cliente × parte contrária);
  // senão usa os polos extraídos da publicação (API ou regex do texto).
  const [contagens, setContagens] = useState({
    todas: 0,
    nao_lidas: 0,
    pendentes: 0,
    vinculadas: 0,
    importantes: 0,
  })
  const categoriaRef = useRef('nao_tratadas')
  useEffect(() => {
    categoriaRef.current = categoria
  }, [categoria])
  const [loadingPubs, setLoadingPubs] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [autoSyncExecutada, setAutoSyncExecutada] = useState(false)
  const [diasSync, setDiasSync] = useState(30)

  // Filtros — inicializa numero_processo a partir de ?processo= na URL
  const [filtros, setFiltros] = useState({
    lida: '',
    sigla_tribunal: '',
    numero_processo: searchParams.get('processo') || '',
    nome_parte: '',
    numero_oab: '',
    data_inicio: '',
    data_fim: '',
    origem: '',
    ordenar: 'data_desc',
  })
  const [offset, setOffset] = useState(0)
  const [itensPorPagina, setItensPorPagina] = useState(20)
  const filtrosRef = useRef(filtros)
  useEffect(() => {
    filtrosRef.current = filtros
  }, [filtros])

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
        toast.error('Erro ao carregar publicações DJEN.')
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
      toast.error('Erro de conexão na triagem DJEN.')
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
          if (!silencioso) toast.error('Falha ao enfileirar sync.')
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
        toast.error('Erro ao atualizar.')
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
      setPublicacoes((prev) => prev.map((p) => (p.id === pub.id ? updated : p)))
      setTriagemItems((prev) => prev.filter((i) => i.publicacao.id !== pub.id))
      setTriagemTotal((prev) => Math.max(0, prev - 1))
      if (pubSelecionada?.id === pub.id) setPubSelecionada(updated)
      toast.success('Vínculo atualizado.')
    } catch {
      toast.error('Erro ao vincular.')
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
      toast.error('Erro de conexão ao mesclar publicação.')
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
      toast.error('Erro de conexão ao ignorar publicação.')
    }
  }

  // ── Criar cliente + caso via triagem ──────────────────────────────────────
  const criarClienteECasoTriagem = async (pub) => {
    const item = triagemItems.find((i) => i.publicacao.id === pub.id)
    if (item) {
      setItemModalCriar(item)
    }
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
      toast.error('Erro de conexão no processamento em lote.')
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
      toast.success('OAB cadastrada para monitoramento!')
      setNovaOab({ numero_oab: '', uf_oab: '', nome_advogado: '', sigla_tribunal: '' })
      carregarOabs()
    } catch {
      toast.error('Erro de conexão.')
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
      toast.error('Erro ao remover.')
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
      toast.error('Erro de conexão.')
    }
  }

  const aplicarFiltros = (e) => {
    e.preventDefault()
    setOffset(0)
    carregarPublicacoes(0)
  }

  const limparFiltros = () => {
    setFiltros({
      lida: '',
      sigla_tribunal: '',
      numero_processo: '',
      nome_parte: '',
      numero_oab: '',
      data_inicio: '',
      data_fim: '',
      origem: '',
      ordenar: 'data_desc',
    })
    setOffset(0)
    setTimeout(() => carregarPublicacoes(0), 50)
  }

  const fmtData = (valor, comHora = false) => {
    if (!valor) return '—'

    const texto = String(valor).trim()
    const normalizado = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T12:00:00` : texto
    const d = new Date(normalizado)

    if (Number.isNaN(d.getTime())) return '—'

    return d.toLocaleString('pt-BR', comHora ? { dateStyle: 'short', timeStyle: 'short' } : {})
  }

  const textoDetalheOriginal = (pubSelecionada?.texto || '').trim()
  const textoDetalheDecodificado = decodeHtmlEntities(textoDetalheOriginal)
  const textoDetalheHtmlSeguro = sanitizarHtmlTribunal(textoDetalheDecodificado)
  const textoDetalhePlano = extrairTextoPlano(textoDetalheHtmlSeguro)

  return (
    <>
      {ConfirmDialog}
      <div className="container-fluid py-4">
        {/* Cabeçalho */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-0 fw-bold">
              <i className="bi bi-newspaper me-2 text-primary"></i>
              DJEN — Diário de Justiça Eletrônico
            </h2>
            <small className="text-muted">ComunicaAPI / CNJ — Resolução nº 455/2022</small>
          </div>
          <div className="d-flex align-items-center gap-3">
            {naoLidas > 0 && (
              <span className="badge bg-danger fs-6">
                {naoLidas} não lida{naoLidas !== 1 ? 's' : ''}
              </span>
            )}
            <div className="d-flex align-items-center gap-2">
              <div className="input-group input-group-sm" style={{ width: 130 }}>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={365}
                  value={diasSync}
                  onChange={(e) =>
                    setDiasSync(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))
                  }
                  disabled={syncing}
                />
                <span className="input-group-text">dias</span>
              </div>
              <button className="btn btn-primary" onClick={sincronizar} disabled={syncing}>
                {syncing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Sincronizando…
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-clockwise me-2" />
                    Sincronizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Abas */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${aba === 'publicacoes' ? 'active fw-semibold' : ''}`}
              onClick={() => setAba('publicacoes')}
            >
              <i className="bi bi-list-ul me-1" />
              Publicações
              {naoLidas > 0 && <span className="badge bg-danger ms-2">{naoLidas}</span>}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${aba === 'oabs' ? 'active fw-semibold' : ''}`}
              onClick={() => {
                setAba('oabs')
                carregarOabs()
                carregarUltimasPublicacoesDjen()
              }}
            >
              <i className="bi bi-person-badge me-1" />
              Monitorar OABs
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${aba === 'triagem' ? 'active fw-semibold' : ''}`}
              onClick={() => {
                setAba('triagem')
                carregarTriagem()
              }}
            >
              <i className="bi bi-magic me-1" />
              Triagem IA
              {triagemTotal > 0 && (
                <span className="badge bg-warning text-dark ms-2">{triagemTotal}</span>
              )}
            </button>
          </li>
        </ul>

        {/* ── Aba Publicações ────────────────────────────────────────────────── */}
        {aba === 'publicacoes' && (
          <div className="row g-4">
            {/* Epic #10: Categorias rápidas (pills) — alterna o filtro
                server-side via parametro `vinculacao`/`lida` na chamada. */}
            <div className="col-12">
              <CategoriasPublicacoes
                ativa={categoria}
                contagens={contagens}
                onChange={(novaCat) => {
                  setCategoria(novaCat)
                  setOffset(0)
                }}
              />
            </div>
            {/* Filtros */}
            <div className="col-12">
              <div className="card shadow-sm border-0">
                <div className="card-body">
                  <form onSubmit={aplicarFiltros} className="row g-2 align-items-end">
                    {/* Linha 1: Leitura, Tribunal, Nº processo, Ordenação */}
                    <div className="col-md-2">
                      <label className="form-label small mb-1">Leitura</label>
                      <select
                        className="form-select form-select-sm"
                        value={filtros.lida}
                        onChange={(e) => setFiltros((f) => ({ ...f, lida: e.target.value }))}
                      >
                        <option value="">Todas</option>
                        <option value="false">Não lidas</option>
                        <option value="true">Lidas</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small mb-1">Tribunal</label>
                      <select
                        className="form-select form-select-sm"
                        value={filtros.sigla_tribunal}
                        onChange={(e) =>
                          setFiltros((f) => ({ ...f, sigla_tribunal: e.target.value }))
                        }
                      >
                        <option value="">Todos os tribunais</option>
                        <optgroup label="Superiores">
                          {TRIBUNAIS.filter((t) =>
                            ['STF', 'STJ', 'TST', 'TSE', 'STM'].includes(t.sigla)
                          ).map((t) => (
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
                          {TRIBUNAIS.filter(
                            (t) => t.sigla.startsWith('TJ') && !t.sigla.startsWith('TJM')
                          ).map((t) => (
                            <option key={t.sigla} value={t.sigla}>
                              {t.sigla} — {t.nome.replace(/TJ\w+ – /, '')}
                            </option>
                          ))}
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
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small mb-1">Nº processo</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Parcial ou completo"
                        value={filtros.numero_processo}
                        onChange={(e) =>
                          setFiltros((f) => ({ ...f, numero_processo: e.target.value }))
                        }
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small mb-1">Ordenar por</label>
                      <select
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
                    {/* Linha 2: OAB, nome parte, datas + botões */}
                    <div className="col-md-2">
                      <label className="form-label small mb-1">OAB</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Ex: 94297"
                        value={filtros.numero_oab}
                        onChange={(e) => setFiltros((f) => ({ ...f, numero_oab: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small mb-1">Nome da parte</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Parcial ou completo"
                        value={filtros.nome_parte}
                        onChange={(e) => setFiltros((f) => ({ ...f, nome_parte: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small mb-1">Data início</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={filtros.data_inicio}
                        onChange={(e) => setFiltros((f) => ({ ...f, data_inicio: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small mb-1">Data fim</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={filtros.data_fim}
                        onChange={(e) => setFiltros((f) => ({ ...f, data_fim: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-1 d-flex gap-1">
                      <button type="submit" className="btn btn-primary btn-sm w-100">
                        <i className="bi bi-search" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm w-100"
                        onClick={limparFiltros}
                        title="Limpar filtros"
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Lista + Detalhe */}
            <div className={pubSelecionada ? 'col-md-6' : 'col-12'}>
              {loadingPubs ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" />
                </div>
              ) : publicacoes.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2" />
                  Nenhuma publicação encontrada.
                  <br />
                  <small>Cadastre suas OABs e clique em "Sincronizar agora".</small>
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 text-muted small mb-2">
                    <span>
                      {total} publicação(ões) · página {Math.floor(offset / itensPorPagina) + 1}
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <label className="small mb-0">Por página</label>
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 90 }}
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
                  </div>
                  {publicacoes.map((pub) => (
                    <div
                      key={pub.id}
                      className={`card mb-2 border-0 shadow-sm cursor-pointer ${!pub.lida ? 'border-start border-4 border-primary' : ''} ${pubSelecionada?.id === pub.id ? 'bg-light' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => abrirDetalhePublicacao(pub)}
                    >
                      <div className="card-body py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                              {!pub.lida && <span className="badge bg-primary">Nova</span>}
                              {/* Fase 2 — estado do inbox sempre visível */}
                              {pub.triagem_ignorada ? (
                                <span className="badge bg-secondary">Descartada</span>
                              ) : pub.tratada_em ? (
                                <span className="badge bg-success">Tratada</span>
                              ) : (
                                <span className="badge bg-warning text-dark">Não tratada</span>
                              )}
                              {/* Risk tag: deriva de importante + tipo_comunicacao
                                  para 3 niveis (Alto/Atencao/Rotina). Tooltip
                                  mostra o motivo da classificacao da IA. */}
                              <RiscoBadge pub={pub} />
                              <span className="badge bg-secondary">
                                {pub.sigla_tribunal || '—'}
                              </span>
                              <span className="badge bg-light text-dark border">
                                {pub.tipo_comunicacao || 'Comunicação'}
                              </span>
                              {pub.origem_busca === 'oab' && (
                                <span className="badge bg-info text-dark">via OAB</span>
                              )}
                              {pub.origem_busca === 'processo' && (
                                <span className="badge bg-warning text-dark">via Processo</span>
                              )}
                            </div>
                            <div className="fw-semibold text-truncate small">
                              {pub.numero_processo_mascara ||
                                pub.numero_processo ||
                                'Sem nº processo'}
                            </div>
                            {(() => {
                              const casoVinc = pub.caso_id
                                ? casos.find((c) => c.id === pub.caso_id)
                                : null
                              const ativo = casoVinc?.cliente_nome || pub.polo_ativo || ''
                              const passivo = casoVinc?.parte_contraria || pub.polo_passivo || ''
                              if (!ativo && !passivo) return null
                              return (
                                <div
                                  className="text-truncate"
                                  style={{ fontSize: '0.8rem' }}
                                  title={`${ativo || '?'} × ${passivo || '?'}`}
                                  data-testid={`partes-pub-${pub.id}`}
                                >
                                  <span className="fw-semibold text-dark">{ativo || '?'}</span>
                                  <span className="text-muted mx-1">×</span>
                                  <span className="text-dark">{passivo || '?'}</span>
                                  {casoVinc && (
                                    <span className="badge bg-success-subtle text-success-emphasis ms-2">
                                      cliente
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                            <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                              {pub.nome_orgao} · {fmtData(pub.data_disponibilizacao)}
                            </div>
                            {/* Trecho do texto da publicação (2 linhas, ellipsis).
                                Tribunais mandam HTML — sanitizamos pra texto plano
                                via extrairTextoPlano antes de exibir. */}
                            {pub.texto && (
                              <div
                                className="text-muted small mt-1"
                                style={{
                                  fontSize: '0.78rem',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  lineHeight: 1.35,
                                }}
                              >
                                {extrairTextoPlano(pub.texto).slice(0, 280)}
                              </div>
                            )}
                          </div>
                          <div className="d-flex gap-1">
                            {/* Fase 2 — o verbo central: Tratar */}
                            {!pub.tratada_em && !pub.triagem_ignorada && (
                              <button
                                className="btn btn-sm btn-primary"
                                title="Tratar intimação (prazo, audiência, tarefa...)"
                                data-testid={`btn-tratar-${pub.id}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPubTratar(pub)
                                }}
                              >
                                Tratar
                              </button>
                            )}
                            {pub.hash_comunicacao && (
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="Baixar certidão PDF"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  baixarCertidao(pub)
                                }}
                              >
                                <i className="bi bi-file-earmark-text" />
                              </button>
                            )}
                            <button
                              className={`btn btn-sm ${pub.lida ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                              title={pub.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                              onClick={(e) => {
                                e.stopPropagation()
                                marcarLida(pub, !pub.lida)
                              }}
                            >
                              <i
                                className={`bi ${pub.lida ? 'bi-envelope' : 'bi-envelope-open'}`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Paginação */}
                  <div className="d-flex gap-2 mt-3">
                    <button
                      className="btn btn-outline-secondary btn-sm"
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
                      className="btn btn-outline-secondary btn-sm"
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
                </>
              )}
            </div>

            {/* Painel de detalhe */}
            {pubSelecionada && (
              <div className="col-md-6">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center">
                    <strong className="small">Detalhe da Publicação</strong>
                    <div className="d-flex align-items-center gap-2">
                      {/* Epic #3 (#177): atalho pra criar tarefa vinculada a esta pub */}
                      <button
                        type="button"
                        className="btn btn-sm btn-primary py-0 px-2"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => setPubParaTarefa(pubSelecionada)}
                        title="Criar tarefa a partir desta publicação (Epic #3)"
                        data-testid="btn-criar-tarefa-pub"
                      >
                        <i className="bi bi-plus-circle me-1" /> Criar tarefa
                      </button>
                      <button className="btn-close btn-sm" onClick={fecharDetalhePublicacao} />
                    </div>
                  </div>
                  <div className="card-body overflow-auto" style={{ maxHeight: '75vh' }}>
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
                          <td className="small">
                            {pubSelecionada.numero_processo_mascara ||
                              pubSelecionada.numero_processo ||
                              '—'}
                          </td>
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
                          <td className="small">{fmtData(pubSelecionada.data_disponibilizacao)}</td>
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
                                <span className="badge bg-danger">⭐ Importante</span>
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
                                title="Forçar reclassificação via Gemini (ignora cache)"
                                data-testid="btn-reclassificar-ia"
                              >
                                {reclassificandoPub ? 'Classificando...' : 'Reclassificar'}
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
                      <label className="form-label small fw-semibold">
                        Vincular ao processo cadastrado
                      </label>
                      <select
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
                          <i className="bi bi-box-arrow-up-right me-1" />
                          Ver original
                        </a>
                      )}
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => baixarCertidao(pubSelecionada)}
                      >
                        <i className="bi bi-file-earmark-pdf me-1" />
                        Baixar certidão
                      </button>
                      <button
                        className={`btn btn-sm ${pubSelecionada.lida ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                        onClick={() => marcarLida(pubSelecionada, !pubSelecionada.lida)}
                      >
                        <i
                          className={`bi ${pubSelecionada.lida ? 'bi-envelope me-1' : 'bi-envelope-open me-1'}`}
                        />
                        {pubSelecionada.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
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

        {/* Fase 2 — Tratar intimação (inbox-zero) */}
        {pubTratar && (
          <TratarIntimacaoModal
            pub={pubTratar}
            onClose={() => setPubTratar(null)}
            onTratado={() => {
              setPubTratar(null)
              carregarPublicacoes(offset)
            }}
            onCadastrarProcesso={(p) => {
              setPubTratar(null)
              // p é a publicação crua vinda do "Tratar". Prefere o item rico da
              // triagem (se carregado); senão monta o wrapper a partir da própria
              // publicação pra o auto-preenchimento não vir vazio.
              const itemRico = triagemItems.find((i) => i.publicacao?.id === p.id)
              setItemModalCriar(itemRico || wrapPubParaModalCriar(p))
            }}
          />
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
