import React, { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config.js'
import { toast } from 'react-toastify'
import DOMPurify from 'dompurify'

const decodeHtmlEntities = (texto = '') => {
  if (!texto) return ''

  // Alguns tribunais enviam HTML com codificacao em camadas
  // (ex.: &amp;lt;table&amp;gt;), entao decodificamos em ate 5 passagens.
  const textarea = document.createElement('textarea')
  let atual = texto

  for (let i = 0; i < 5; i += 1) {
    textarea.innerHTML = atual
    const decodificado = textarea.value
    if (decodificado === atual) break
    atual = decodificado
  }

  return atual
}

const sanitizarHtmlTribunal = (texto = '') => {
  if (!texto) return ''
  return DOMPurify.sanitize(texto, {
    // Preserva ao maximo a formatacao do CNJ (cores, tamanhos, tabelas, classes)
    // sem permitir execucao de scripts/eventos inseguros.
    USE_PROFILES: { html: true },
    ADD_TAGS: [
      'style',
      'font',
      'center',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'colgroup',
      'col',
      'caption',
      'br',
    ],
    ADD_ATTR: [
      'style',
      'class',
      'align',
      'bgcolor',
      'cellpadding',
      'cellspacing',
      'border',
      'width',
      'height',
      'valign',
      'colspan',
      'rowspan',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: [/^on/i],
  })
}

const extrairTextoPlano = (html = '') => {
  if (!html) return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

// ── Lista completa de tribunais brasileiros ────────────────────────────────
const TRIBUNAIS = [
  // Superiores
  { sigla: 'STF', nome: 'Supremo Tribunal Federal' },
  { sigla: 'STJ', nome: 'Superior Tribunal de Justiça' },
  { sigla: 'TST', nome: 'Tribunal Superior do Trabalho' },
  { sigla: 'TSE', nome: 'Tribunal Superior Eleitoral' },
  { sigla: 'STM', nome: 'Superior Tribunal Militar' },
  // TRFs
  { sigla: 'TRF1', nome: 'TRF 1ª Região (DF, MG, GO, BA…)' },
  { sigla: 'TRF2', nome: 'TRF 2ª Região (RJ, ES)' },
  { sigla: 'TRF3', nome: 'TRF 3ª Região (SP, MS)' },
  { sigla: 'TRF4', nome: 'TRF 4ª Região (RS, SC, PR)' },
  { sigla: 'TRF5', nome: 'TRF 5ª Região (CE, RN, PB, PE, AL, SE)' },
  { sigla: 'TRF6', nome: 'TRF 6ª Região (MG)' },
  // TJs
  { sigla: 'TJAC', nome: 'TJAC – Acre' },
  { sigla: 'TJAL', nome: 'TJAL – Alagoas' },
  { sigla: 'TJAM', nome: 'TJAM – Amazonas' },
  { sigla: 'TJAP', nome: 'TJAP – Amapá' },
  { sigla: 'TJBA', nome: 'TJBA – Bahia' },
  { sigla: 'TJCE', nome: 'TJCE – Ceará' },
  { sigla: 'TJDFT', nome: 'TJDFT – Distrito Federal' },
  { sigla: 'TJES', nome: 'TJES – Espírito Santo' },
  { sigla: 'TJGO', nome: 'TJGO – Goiás' },
  { sigla: 'TJMA', nome: 'TJMA – Maranhão' },
  { sigla: 'TJMG', nome: 'TJMG – Minas Gerais' },
  { sigla: 'TJMS', nome: 'TJMS – Mato Grosso do Sul' },
  { sigla: 'TJMT', nome: 'TJMT – Mato Grosso' },
  { sigla: 'TJPA', nome: 'TJPA – Pará' },
  { sigla: 'TJPB', nome: 'TJPB – Paraíba' },
  { sigla: 'TJPE', nome: 'TJPE – Pernambuco' },
  { sigla: 'TJPI', nome: 'TJPI – Piauí' },
  { sigla: 'TJPR', nome: 'TJPR – Paraná' },
  { sigla: 'TJRJ', nome: 'TJRJ – Rio de Janeiro' },
  { sigla: 'TJRN', nome: 'TJRN – Rio Grande do Norte' },
  { sigla: 'TJRO', nome: 'TJRO – Rondônia' },
  { sigla: 'TJRR', nome: 'TJRR – Roraima' },
  { sigla: 'TJRS', nome: 'TJRS – Rio Grande do Sul' },
  { sigla: 'TJSC', nome: 'TJSC – Santa Catarina' },
  { sigla: 'TJSE', nome: 'TJSE – Sergipe' },
  { sigla: 'TJSP', nome: 'TJSP – São Paulo' },
  { sigla: 'TJTO', nome: 'TJTO – Tocantins' },
  // TRTs
  { sigla: 'TRT1', nome: 'TRT 1ª Região (RJ)' },
  { sigla: 'TRT2', nome: 'TRT 2ª Região (SP Capital)' },
  { sigla: 'TRT3', nome: 'TRT 3ª Região (MG)' },
  { sigla: 'TRT4', nome: 'TRT 4ª Região (RS)' },
  { sigla: 'TRT5', nome: 'TRT 5ª Região (BA)' },
  { sigla: 'TRT6', nome: 'TRT 6ª Região (PE)' },
  { sigla: 'TRT7', nome: 'TRT 7ª Região (CE)' },
  { sigla: 'TRT8', nome: 'TRT 8ª Região (PA e AP)' },
  { sigla: 'TRT9', nome: 'TRT 9ª Região (PR)' },
  { sigla: 'TRT10', nome: 'TRT 10ª Região (DF e TO)' },
  { sigla: 'TRT11', nome: 'TRT 11ª Região (AM e RR)' },
  { sigla: 'TRT12', nome: 'TRT 12ª Região (SC)' },
  { sigla: 'TRT13', nome: 'TRT 13ª Região (PB)' },
  { sigla: 'TRT14', nome: 'TRT 14ª Região (RO e AC)' },
  { sigla: 'TRT15', nome: 'TRT 15ª Região (SP Interior)' },
  { sigla: 'TRT16', nome: 'TRT 16ª Região (MA)' },
  { sigla: 'TRT17', nome: 'TRT 17ª Região (ES)' },
  { sigla: 'TRT18', nome: 'TRT 18ª Região (GO)' },
  { sigla: 'TRT19', nome: 'TRT 19ª Região (AL)' },
  { sigla: 'TRT20', nome: 'TRT 20ª Região (SE)' },
  { sigla: 'TRT21', nome: 'TRT 21ª Região (RN)' },
  { sigla: 'TRT22', nome: 'TRT 22ª Região (PI)' },
  { sigla: 'TRT23', nome: 'TRT 23ª Região (MT)' },
  { sigla: 'TRT24', nome: 'TRT 24ª Região (MS)' },
  // TREs
  { sigla: 'TREAC', nome: 'TRE – Acre' },
  { sigla: 'TREAL', nome: 'TRE – Alagoas' },
  { sigla: 'TREAM', nome: 'TRE – Amazonas' },
  { sigla: 'TREAP', nome: 'TRE – Amapá' },
  { sigla: 'TREBA', nome: 'TRE – Bahia' },
  { sigla: 'TRECE', nome: 'TRE – Ceará' },
  { sigla: 'TREDF', nome: 'TRE – Distrito Federal' },
  { sigla: 'TREES', nome: 'TRE – Espírito Santo' },
  { sigla: 'TREGO', nome: 'TRE – Goiás' },
  { sigla: 'TREMA', nome: 'TRE – Maranhão' },
  { sigla: 'TREMG', nome: 'TRE – Minas Gerais' },
  { sigla: 'TREMS', nome: 'TRE – Mato Grosso do Sul' },
  { sigla: 'TREMT', nome: 'TRE – Mato Grosso' },
  { sigla: 'TREPA', nome: 'TRE – Pará' },
  { sigla: 'TREPB', nome: 'TRE – Paraíba' },
  { sigla: 'TREPE', nome: 'TRE – Pernambuco' },
  { sigla: 'TREPI', nome: 'TRE – Piauí' },
  { sigla: 'TREPR', nome: 'TRE – Paraná' },
  { sigla: 'TRERJ', nome: 'TRE – Rio de Janeiro' },
  { sigla: 'TRERN', nome: 'TRE – Rio Grande do Norte' },
  { sigla: 'TRERO', nome: 'TRE – Rondônia' },
  { sigla: 'TRERR', nome: 'TRE – Roraima' },
  { sigla: 'TRERS', nome: 'TRE – Rio Grande do Sul' },
  { sigla: 'TRESC', nome: 'TRE – Santa Catarina' },
  { sigla: 'TRESE', nome: 'TRE – Sergipe' },
  { sigla: 'TRESP', nome: 'TRE – São Paulo' },
  { sigla: 'TRETO', nome: 'TRE – Tocantins' },
  // TJMs
  { sigla: 'TJMMG', nome: 'TJM – Minas Gerais' },
  { sigla: 'TJMRS', nome: 'TJM – Rio Grande do Sul' },
  { sigla: 'TJMSP', nome: 'TJM – São Paulo' },
]

export default function DjenPage() {
  const [aba, setAba] = useState('publicacoes')
  const [publicacoes, setPublicacoes] = useState([])
  const [total, setTotal] = useState(0)
  const [naoLidas, setNaoLidas] = useState(0)
  const [loadingPubs, setLoadingPubs] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [diasSync, setDiasSync] = useState(30)

  // Filtros
  const [filtros, setFiltros] = useState({
    lida: '',
    sigla_tribunal: '',
    numero_processo: '',
    data_inicio: '',
    data_fim: '',
    origem: '',
    ordenar: 'data_desc',
  })
  const [offset, setOffset] = useState(0)
  const [itensPorPagina, setItensPorPagina] = useState(20)

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

  // Detalhe
  const [pubSelecionada, setPubSelecionada] = useState(null)
  const [casos, setCasos] = useState([])

  const token = () => localStorage.getItem('token')

  // ── Carregar publicações ────────────────────────────────────────────────────
  const carregarPublicacoes = useCallback(
    async (offsetParam = 0, limitParam = itensPorPagina) => {
      setLoadingPubs(true)
      try {
        const params = new URLSearchParams()
        params.set('limit', limitParam)
        params.set('offset', offsetParam)
        if (filtros.lida !== '') params.set('lida', filtros.lida)
        if (filtros.sigla_tribunal) params.set('sigla_tribunal', filtros.sigla_tribunal)
        if (filtros.numero_processo) params.set('numero_processo', filtros.numero_processo)
        if (filtros.data_inicio) params.set('data_inicio', filtros.data_inicio)
        if (filtros.data_fim) params.set('data_fim', filtros.data_fim)
        if (filtros.origem) params.set('origem', filtros.origem)
        params.set('ordenar', filtros.ordenar || 'data_desc')

        const res = await fetch(`${API_URL}/djen/publicacoes?${params}`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
        if (res.ok) {
          const data = await res.json()
          setPublicacoes(data.items || [])
          setTotal(data.total || 0)
          setNaoLidas(data.nao_lidas || 0)
        } else {
          toast.error('Erro ao carregar publicações DJEN.')
        }
      } catch {
        toast.error('Erro de conexão.')
      } finally {
        setLoadingPubs(false)
      }
    },
    [filtros, itensPorPagina]
  )

  // ── Carregar OABs ───────────────────────────────────────────────────────────
  const carregarOabs = useCallback(async () => {
    setLoadingOabs(true)
    try {
      const res = await fetch(`${API_URL}/djen/oabs`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.ok) setOabs(await res.json())
    } catch {
      /* silencioso */
    } finally {
      setLoadingOabs(false)
    }
  }, [])

  // ── Carregar casos para vínculo ─────────────────────────────────────────────
  const carregarCasos = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/casos`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.ok) setCasos(await res.json())
    } catch {
      /* silencioso */
    }
  }, [])

  // ── Últimas publicações DJEN para aba OABs ────────────────────────────────
  const carregarUltimasPublicacoesDjen = useCallback(async () => {
    setLoadingUltimasPublicacoesDjen(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '8')
      params.set('offset', '0')

      const res = await fetch(`${API_URL}/djen/publicacoes?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })

      if (res.ok) {
        const data = await res.json()
        setUltimasPublicacoesDjen(data.items || [])
      } else {
        setUltimasPublicacoesDjen([])
      }
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
      const res = await fetch(
        `${API_URL}/djen/triagem?limit=${TRIAGEM_LIMIT}&offset=${offsetParam}&somente_pendentes=true`,
        {
          headers: { Authorization: `Bearer ${token()}` },
        }
      )
      if (res.ok) {
        const data = await res.json()
        setTriagemItems(data.items || [])
        setTriagemTotal(data.total || 0)
        setTriagemSelecionadas([])
      } else {
        toast.error('Erro ao carregar fila de triagem DJEN.')
      }
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

  // ── Sincronizar ─────────────────────────────────────────────────────────────
  const sincronizar = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${API_URL}/djen/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: diasSync }),
      })
      const payload = await res.json().catch(() => ({}))
      if (res.ok) {
        const resumo = payload?.resumo || {}
        const salvas = resumo.publicacoes_salvas ?? 0
        const encontrados = resumo.itens_encontrados ?? 0
        const oabsProc = resumo.oabs_processadas ?? 0
        const casosProc = resumo.casos_processados ?? 0
        toast.success(
          `Sync DJEN concluído: ${salvas} nova(s), ${encontrados} encontrada(s), OABs ${oabsProc}, casos ${casosProc}.`
        )
        setOffset(0)
        await carregarPublicacoes(0)
        await carregarOabs()
        await carregarTriagem()
        await carregarUltimasPublicacoesDjen()
      } else {
        toast.error(payload.message || 'Erro ao sincronizar.')
      }
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setSyncing(false)
    }
  }

  // ── Marcar publicação como lida ─────────────────────────────────────────────
  const marcarLida = async (pub, lida) => {
    try {
      const res = await fetch(`${API_URL}/djen/publicacoes/${pub.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lida }),
      })
      if (res.ok) {
        setPublicacoes((prev) => prev.map((p) => (p.id === pub.id ? { ...p, lida } : p)))
        setNaoLidas((prev) => (lida ? prev - 1 : prev + 1))
        if (pubSelecionada?.id === pub.id) setPubSelecionada({ ...pubSelecionada, lida })
      }
    } catch {
      toast.error('Erro ao atualizar.')
    }
  }

  // ── Vincular caso ───────────────────────────────────────────────────────────
  const vincularCaso = async (pub, caso_id) => {
    try {
      const res = await fetch(`${API_URL}/djen/publicacoes/${pub.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caso_id: caso_id || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPublicacoes((prev) => prev.map((p) => (p.id === pub.id ? updated : p)))
        setTriagemItems((prev) => prev.filter((i) => i.publicacao.id !== pub.id))
        setTriagemTotal((prev) => Math.max(0, prev - 1))
        if (pubSelecionada?.id === pub.id) setPubSelecionada(updated)
        toast.success('Vínculo atualizado.')
      }
    } catch {
      toast.error('Erro ao vincular.')
    }
  }

  const mesclarTriagemCaso = async (pub, casoId) => {
    try {
      const res = await fetch(`${API_URL}/djen/triagem/${pub.id}/mesclar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caso_id: casoId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(payload.message || 'Erro ao mesclar publicação.')
        return
      }

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
      const res = await fetch(`${API_URL}/djen/triagem/${pub.id}/ignorar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Sem ação necessária' }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(payload.message || 'Erro ao ignorar publicação.')
        return
      }

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
    try {
      const res = await fetch(`${API_URL}/djen/triagem/${pub.id}/criar-cliente-caso`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(payload.message || 'Erro ao criar cliente/caso pela triagem.')
        return
      }

      setTriagemItems((prev) => prev.filter((i) => i.publicacao.id !== pub.id))
      setTriagemTotal((prev) => Math.max(0, prev - 1))
      await carregarPublicacoes(0)
      await carregarCasos()
      await carregarUltimasPublicacoesDjen()

      const clienteNome = payload?.cliente?.nome_razao_social || 'Cliente'
      const casoNumero =
        payload?.caso?.numero_processo || payload?.caso?.titulo || `#${payload?.caso?.id}`
      toast.success(`Cliente/Caso processados: ${clienteNome} · ${casoNumero}`)
    } catch {
      toast.error('Erro de conexão ao criar cliente/caso.')
    }
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

  const processarLoteTriagem = async () => {
    if (triagemSelecionadas.length === 0) {
      toast.info('Selecione ao menos uma publicação na triagem.')
      return
    }

    setProcessandoLoteTriagem(true)
    try {
      const res = await fetch(`${API_URL}/djen/triagem/processar-lote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pub_ids: triagemSelecionadas }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(payload.message || 'Erro ao processar lote da triagem.')
        return
      }

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
      const res = await fetch(`${API_URL}/djen/oabs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(novaOab),
      })
      if (res.ok) {
        toast.success('OAB cadastrada para monitoramento!')
        setNovaOab({ numero_oab: '', uf_oab: '', nome_advogado: '', sigla_tribunal: '' })
        carregarOabs()
      } else {
        const err = await res.json()
        toast.error(err.message || 'Erro ao cadastrar OAB.')
      }
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setSalvandoOab(false)
    }
  }

  // ── Remover OAB ─────────────────────────────────────────────────────────────
  const removerOab = async (id) => {
    if (!window.confirm('Remover esta OAB do monitoramento?')) return
    try {
      const res = await fetch(`${API_URL}/djen/oabs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.status === 204) {
        toast.success('OAB removida.')
        setOabs((prev) => prev.filter((o) => o.id !== id))
      }
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
      const res = await fetch(`${API_URL}/djen/publicacoes/${pub.id}/certidao`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `certidao_djen_${pub.id}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        toast.error('Erro ao baixar certidão.')
      }
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
      data_inicio: '',
      data_fim: '',
      origem: '',
      ordenar: 'data_desc',
    })
    setOffset(0)
    setTimeout(() => carregarPublicacoes(0), 50)
  }

  const fmtData = (str) => {
    if (!str) return '—'
    const d = new Date(str + 'T12:00:00')
    return d.toLocaleDateString('pt-BR')
  }

  const textoDetalheOriginal = (pubSelecionada?.texto || '').trim()
  const textoDetalheDecodificado = decodeHtmlEntities(textoDetalheOriginal)
  const textoDetalheHtmlSeguro = sanitizarHtmlTribunal(textoDetalheDecodificado)
  const textoDetalhePlano = extrairTextoPlano(textoDetalheHtmlSeguro)

  return (
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
                  {/* Linha 2: datas + botões */}
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
                    onClick={() => {
                      setPubSelecionada(pub)
                      if (!pub.lida) marcarLida(pub, true)
                    }}
                  >
                    <div className="card-body py-2 px-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            {!pub.lida && <span className="badge bg-primary">Nova</span>}
                            <span className="badge bg-secondary">{pub.sigla_tribunal || '—'}</span>
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
                          <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                            {pub.nome_orgao} · {fmtData(pub.data_disponibilizacao)}
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${pub.lida ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                          title={pub.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                          onClick={(e) => {
                            e.stopPropagation()
                            marcarLida(pub, !pub.lida)
                          }}
                        >
                          <i className={`bi ${pub.lida ? 'bi-envelope' : 'bi-envelope-open'}`} />
                        </button>
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
                  <button className="btn-close btn-sm" onClick={() => setPubSelecionada(null)} />
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
        <div className="row g-4">
          <div className="col-md-5">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-plus-circle me-2 text-success" />
                Cadastrar OAB para monitoramento
              </div>
              <div className="card-body">
                <form onSubmit={salvarOab}>
                  <div className="mb-3">
                    <label className="form-label small">
                      Número da OAB <span className="text-danger">*</span>
                    </label>
                    <input
                      className="form-control"
                      placeholder="Ex: 123456"
                      required
                      value={novaOab.numero_oab}
                      onChange={(e) => setNovaOab((o) => ({ ...o, numero_oab: e.target.value }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small">
                      UF da OAB <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      required
                      value={novaOab.uf_oab}
                      onChange={(e) => setNovaOab((o) => ({ ...o, uf_oab: e.target.value }))}
                    >
                      <option value="">Selecione a UF</option>
                      {[
                        'AC',
                        'AL',
                        'AP',
                        'AM',
                        'BA',
                        'CE',
                        'DF',
                        'ES',
                        'GO',
                        'MA',
                        'MT',
                        'MS',
                        'MG',
                        'PA',
                        'PB',
                        'PR',
                        'PE',
                        'PI',
                        'RJ',
                        'RN',
                        'RS',
                        'RO',
                        'RR',
                        'SC',
                        'SP',
                        'SE',
                        'TO',
                      ].map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small">
                      Tribunal (sigla){' '}
                      <span className="text-muted fw-normal">— opcional, ex: TRT9, TJPR, TST</span>
                    </label>
                    <input
                      className="form-control"
                      placeholder="Deixe em branco para usar a UF (ex: TJPR)"
                      value={novaOab.sigla_tribunal}
                      onChange={(e) =>
                        setNovaOab((o) => ({ ...o, sigla_tribunal: e.target.value.toUpperCase() }))
                      }
                    />
                    <div className="form-text">Use quando a OAB atua em TRTs, TST, STJ, etc.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small">Nome do advogado (opcional)</label>
                    <input
                      className="form-control"
                      placeholder="Para identificação interna"
                      value={novaOab.nome_advogado}
                      onChange={(e) => setNovaOab((o) => ({ ...o, nome_advogado: e.target.value }))}
                    />
                  </div>
                  <button type="submit" className="btn btn-success w-100" disabled={salvandoOab}>
                    {salvandoOab ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Salvando…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg me-2" />
                        Cadastrar OAB
                      </>
                    )}
                  </button>
                </form>
                <div className="alert alert-info mt-3 small mb-0">
                  <i className="bi bi-info-circle me-1" />
                  Após cadastrar, clique em <strong>"Sincronizar agora"</strong> para buscar
                  publicações imediatamente. O job automático roda diariamente às 04:00 e considera
                  os últimos 30 dias.
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-7">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-list-check me-2" />
                OABs monitoradas
              </div>
              <div className="card-body p-0">
                {loadingOabs ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" />
                  </div>
                ) : oabs.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="bi bi-person-badge fs-2 d-block mb-2" />
                    Nenhuma OAB cadastrada ainda.
                  </div>
                ) : (
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="small">OAB</th>
                        <th className="small">Tribunal</th>
                        <th className="small">Advogado</th>
                        <th className="small">Última sync</th>
                        <th className="small"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {oabs.map((o) => (
                        <tr key={o.id}>
                          <td className="fw-semibold small">{o.numero_oab}</td>
                          <td className="small">
                            <span className="badge bg-secondary">
                              {o.sigla_tribunal || o.uf_oab}
                            </span>
                          </td>
                          <td className="small text-muted">{o.nome_advogado || '—'}</td>
                          <td className="small text-muted">
                            {o.ultima_sincronizacao ? fmtData(o.ultima_sincronizacao) : 'Nunca'}
                          </td>
                          <td>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => removerOab(o.id)}
                              title="Remover"
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card shadow-sm border-0 mt-3">
              <div className="card-header bg-white fw-semibold d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-journal-text me-2" />
                  Últimas publicações capturadas
                </span>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={carregarUltimasPublicacoesDjen}
                >
                  <i className="bi bi-arrow-repeat me-1" />
                  Atualizar
                </button>
              </div>
              <div className="card-body p-0">
                {loadingUltimasPublicacoesDjen ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" />
                  </div>
                ) : ultimasPublicacoesDjen.length === 0 ? (
                  <div className="p-3 text-muted small">
                    Nenhuma publicação foi capturada ainda. Clique em{' '}
                    <strong>Sincronizar agora</strong> para buscar no DJEN.
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {ultimasPublicacoesDjen.map((pub) => (
                      <button
                        key={pub.id}
                        type="button"
                        className="list-group-item list-group-item-action"
                        onClick={() => {
                          setAba('publicacoes')
                          setPubSelecionada(pub)
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="small" style={{ minWidth: 0 }}>
                            <div className="fw-semibold text-truncate">
                              {pub.numero_processo_mascara ||
                                pub.numero_processo ||
                                'Sem número de processo'}
                            </div>
                            <div className="text-muted text-truncate">
                              {pub.sigla_tribunal || '—'} · {pub.tipo_comunicacao || 'Comunicação'}
                            </div>
                          </div>
                          <span className={`badge ${pub.lida ? 'bg-secondary' : 'bg-primary'}`}>
                            {pub.lida ? 'Lida' : 'Nova'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Aba Triagem ───────────────────────────────────────────────────── */}
      {aba === 'triagem' &&
        (() => {
          // filtro local por busca de texto
          const triagemFiltrados = triagemBusca.trim()
            ? triagemItems.filter((item) => {
                const pub = item.publicacao
                const analise = item.analise || {}
                const textoNormalizado = extrairTextoPlano(
                  sanitizarHtmlTribunal(decodeHtmlEntities(pub.texto || ''))
                )
                const haystack = [
                  pub.numero_processo,
                  pub.numero_processo_mascara,
                  pub.nome_orgao,
                  pub.sigla_tribunal,
                  analise.tribunal,
                  textoNormalizado,
                  ...(analise.partes_autoras || []),
                  ...(analise.partes_reus || []),
                  ...(analise.representantes || []),
                ]
                  .join(' ')
                  .toLowerCase()
                return haystack.includes(triagemBusca.toLowerCase())
              })
            : triagemItems

          const badgeConfianca = (v) => {
            const pct = Math.round((v || 0) * 100)
            const cls = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning text-dark' : 'bg-danger'
            return (
              <span className={`badge ${cls} ms-2`} style={{ fontSize: '0.7rem' }}>
                {pct}% confiança
              </span>
            )
          }

          const toggleExpandido = (id) =>
            setTriagemExpandido((prev) => ({ ...prev, [id]: !prev[id] }))

          return (
            <div className="row g-3">
              {/* Barra de controles */}
              <div className="col-12">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge bg-secondary fs-6 px-3 py-2">
                      {triagemTotal} pendente(s)
                    </span>
                    <input
                      type="search"
                      className="form-control form-control-sm"
                      style={{ width: 260 }}
                      placeholder="Buscar por processo, parte, órgão..."
                      value={triagemBusca}
                      onChange={(e) => setTriagemBusca(e.target.value)}
                    />
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={selecionarTodasTriagem}
                    >
                      <i className="bi bi-check2-all me-1" />
                      Selecionar todas
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={limparSelecaoTriagem}
                    >
                      Limpar seleção
                    </button>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        setTriagemOffset(0)
                        carregarTriagem(0)
                      }}
                    >
                      <i className="bi bi-arrow-repeat me-1" />
                      Atualizar
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={processarLoteTriagem}
                      disabled={processandoLoteTriagem || triagemSelecionadas.length === 0}
                    >
                      <i className="bi bi-robot me-1" />
                      {processandoLoteTriagem
                        ? 'Processando...'
                        : `Processar selecionadas (${triagemSelecionadas.length})`}
                    </button>
                  </div>
                </div>
              </div>

              {loadingTriagem ? (
                <div className="col-12 text-center py-5">
                  <div className="spinner-border text-primary" />
                </div>
              ) : triagemFiltrados.length === 0 ? (
                <div className="col-12">
                  <div className="alert alert-success mb-0">
                    {triagemBusca
                      ? 'Nenhuma publicação encontrada para esse filtro.'
                      : 'Nenhuma pendência na fila de triagem. As publicações novas aparecerão aqui após a sincronização.'}
                  </div>
                </div>
              ) : (
                <>
                  {triagemFiltrados.map((item) => {
                    const pub = item.publicacao
                    const analise = item.analise || {}
                    const sugestoes = item.sugestoes || {}
                    const tribunal = analise.tribunal || pub.sigla_tribunal || ''
                    const dataFormatada = pub.data_disponibilizacao
                      ? new Date(pub.data_disponibilizacao).toLocaleDateString('pt-BR')
                      : null
                    const textoOriginal = (pub.texto || '').trim()
                    const textoDecodificado = decodeHtmlEntities(textoOriginal)
                    const textoHtmlSeguro = sanitizarHtmlTribunal(textoDecodificado)
                    const textoPreview = extrairTextoPlano(textoHtmlSeguro)
                    const expandido = !!triagemExpandido[pub.id]
                    const temPartes =
                      (analise.partes_autoras || []).length > 0 ||
                      (analise.partes_reus || []).length > 0
                    const temRepresentantes = (analise.representantes || []).length > 0
                    const temDocumentos = (analise.documentos_extraidos || []).length > 0
                    const temSugestoesCasos = (sugestoes.casos || []).length > 0
                    const temSugestoesClientes = (sugestoes.clientes || []).length > 0
                    const confianca = analise.confianca || 0
                    const borderColor =
                      confianca >= 0.7 ? '#198754' : confianca >= 0.4 ? '#ffc107' : '#dc3545'

                    return (
                      <div className="col-12" key={pub.id}>
                        <div
                          className="card shadow-sm"
                          style={{ borderLeft: `4px solid ${borderColor}` }}
                        >
                          {/* Cabeçalho do card */}
                          <div className="card-header bg-white py-2 px-3 d-flex align-items-center gap-2 flex-wrap">
                            <input
                              className="form-check-input mt-0 flex-shrink-0"
                              type="checkbox"
                              title="Selecionar para lote"
                              id={`triagem-check-${pub.id}`}
                              checked={triagemSelecionadas.includes(pub.id)}
                              onChange={() => toggleSelecaoTriagem(pub.id)}
                            />
                            <div className="fw-semibold me-1" style={{ fontSize: '0.95rem' }}>
                              {pub.numero_processo_mascara || pub.numero_processo || (
                                <span className="text-muted fst-italic">
                                  Sem número de processo
                                </span>
                              )}
                            </div>
                            {tribunal && (
                              <span
                                className="badge bg-primary bg-opacity-10 text-primary border border-primary"
                                style={{ fontSize: '0.72rem' }}
                              >
                                {tribunal}
                              </span>
                            )}
                            {pub.tipo_comunicacao && (
                              <span
                                className="badge bg-light text-secondary border"
                                style={{ fontSize: '0.72rem' }}
                              >
                                {pub.tipo_comunicacao}
                              </span>
                            )}
                            {dataFormatada && (
                              <span className="text-muted ms-auto small">
                                <i className="bi bi-calendar3 me-1" />
                                {dataFormatada}
                              </span>
                            )}
                            {badgeConfianca(confianca)}
                            {analise.revisao_manual_recomendada && (
                              <span
                                className="badge bg-warning text-dark ms-1"
                                style={{ fontSize: '0.7rem' }}
                              >
                                <i className="bi bi-exclamation-triangle me-1" />
                                Revisão manual
                              </span>
                            )}
                          </div>

                          <div className="card-body py-2 px-3">
                            {/* Órgão */}
                            {pub.nome_orgao && (
                              <div className="small text-muted mb-2">
                                <i className="bi bi-building me-1" />
                                {pub.nome_orgao}
                              </div>
                            )}

                            {/* Preview do texto */}
                            {textoPreview && (
                              <div className="mb-3">
                                {expandido ? (
                                  <div
                                    className="small text-secondary p-2 rounded"
                                    style={{
                                      background: '#f8f9fa',
                                      borderLeft: '3px solid #dee2e6',
                                      wordBreak: 'break-word',
                                      overflowX: 'auto',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: textoHtmlSeguro }}
                                  />
                                ) : (
                                  <div
                                    className="small text-secondary p-2 rounded"
                                    style={{
                                      background: '#f8f9fa',
                                      borderLeft: '3px solid #dee2e6',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {textoPreview.slice(0, 320) +
                                      (textoPreview.length > 320 ? '…' : '')}
                                  </div>
                                )}
                                {textoPreview.length > 320 && (
                                  <button
                                    className="btn btn-link btn-sm p-0 mt-1"
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={() => toggleExpandido(pub.id)}
                                  >
                                    {expandido ? 'Ver menos ▲' : 'Ver texto completo ▼'}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Partes + Representantes */}
                            {(temPartes || temRepresentantes) && (
                              <div className="row g-2 small mb-2">
                                {(analise.partes_autoras || []).length > 0 && (
                                  <div className="col-md-4">
                                    <div className="text-muted fw-semibold mb-1">
                                      <i className="bi bi-person me-1" />
                                      Polo ativo
                                    </div>
                                    {analise.partes_autoras.map((p, idx) => (
                                      <div key={`a-${idx}`} className="text-truncate" title={p}>
                                        {p}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(analise.partes_reus || []).length > 0 && (
                                  <div className="col-md-4">
                                    <div className="text-muted fw-semibold mb-1">
                                      <i className="bi bi-person-x me-1" />
                                      Polo passivo
                                    </div>
                                    {analise.partes_reus.map((p, idx) => (
                                      <div key={`r-${idx}`} className="text-truncate" title={p}>
                                        {p}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {temRepresentantes && (
                                  <div className="col-md-4">
                                    <div className="text-muted fw-semibold mb-1">
                                      <i className="bi bi-briefcase me-1" />
                                      Advogado(s)
                                    </div>
                                    {analise.representantes.map((p, idx) => (
                                      <div key={`rep-${idx}`} className="text-truncate" title={p}>
                                        {p}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Documentos + Sugestões */}
                            {(temDocumentos || temSugestoesCasos || temSugestoesClientes) && (
                              <div className="row g-2 small mb-2">
                                {temDocumentos && (
                                  <div className="col-md-4">
                                    <div className="text-muted fw-semibold mb-1">
                                      <i className="bi bi-file-earmark-text me-1" />
                                      CPF/CNPJ
                                    </div>
                                    {analise.documentos_extraidos.map((d, idx) => (
                                      <div key={`doc-${idx}`}>{d}</div>
                                    ))}
                                  </div>
                                )}
                                {temSugestoesCasos && (
                                  <div className="col-md-4">
                                    <div className="text-muted fw-semibold mb-1">
                                      <i className="bi bi-folder2-open me-1" />
                                      Casos sugeridos
                                    </div>
                                    <div className="d-flex flex-wrap gap-1">
                                      {sugestoes.casos.slice(0, 3).map((s) => (
                                        <button
                                          key={`caso-${s.id}`}
                                          className="btn btn-outline-primary btn-sm py-0 px-2"
                                          style={{ fontSize: '0.72rem' }}
                                          onClick={() => mesclarTriagemCaso(pub, s.id)}
                                          title={`Mesclar com caso #${s.id}`}
                                        >
                                          #{s.id} {s.numero_processo || s.titulo} ·{' '}
                                          {Math.round((s.score || 0) * 100)}%
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {temSugestoesClientes && (
                                  <div className="col-md-4">
                                    <div className="text-muted fw-semibold mb-1">
                                      <i className="bi bi-people me-1" />
                                      Clientes sugeridos
                                    </div>
                                    <div className="d-flex flex-wrap gap-1">
                                      {sugestoes.clientes.slice(0, 3).map((s) => (
                                        <span
                                          key={`cli-${s.id}`}
                                          className="badge bg-light text-dark border"
                                          style={{ fontSize: '0.72rem' }}
                                        >
                                          {s.nome_razao_social} · {Math.round((s.score || 0) * 100)}
                                          %
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Ações */}
                            <div className="d-flex gap-2 flex-wrap mt-2 pt-2 border-top">
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => criarClienteECasoTriagem(pub)}
                              >
                                <i className="bi bi-plus-circle me-1" />
                                Criar cliente e caso
                              </button>
                              {temSugestoesCasos && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => mesclarTriagemCaso(pub, sugestoes.casos[0].id)}
                                >
                                  <i className="bi bi-arrow-left-right me-1" />
                                  Mesclar com #{sugestoes.casos[0].id}
                                </button>
                              )}
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => marcarLida(pub, true)}
                              >
                                <i className="bi bi-check2 me-1" />
                                Marcar lida
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm ms-auto"
                                onClick={() => ignorarTriagem(pub)}
                              >
                                <i className="bi bi-x-circle me-1" />
                                Ignorar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Paginação */}
                  {triagemTotal > TRIAGEM_LIMIT && !triagemBusca && (
                    <div className="col-12 d-flex justify-content-between align-items-center mt-1">
                      <small className="text-muted">
                        Exibindo {triagemOffset + 1}–
                        {Math.min(triagemOffset + TRIAGEM_LIMIT, triagemTotal)} de {triagemTotal}
                      </small>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          disabled={triagemOffset === 0}
                          onClick={() => {
                            const o = Math.max(0, triagemOffset - TRIAGEM_LIMIT)
                            setTriagemOffset(o)
                            carregarTriagem(o)
                          }}
                        >
                          <i className="bi bi-chevron-left" /> Anterior
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          disabled={triagemOffset + TRIAGEM_LIMIT >= triagemTotal}
                          onClick={() => {
                            const o = triagemOffset + TRIAGEM_LIMIT
                            setTriagemOffset(o)
                            carregarTriagem(o)
                          }}
                        >
                          Próxima <i className="bi bi-chevron-right" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}
    </div>
  )
}
