import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  UsersIcon,
  BriefcaseIcon,
  NewspaperIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api/client.js'

// Ctrl+K como command palette (padrão GitHub/Linear/Slack): além de buscar
// casos/clientes, dá pra EXECUTAR ações e pular pras telas que saíram do menu
// diário (Relatórios, Financeiro, Configurações). É o que absorve o "long
// tail" sem precisar de item de sidebar pra tudo.
const ACOES = [
  {
    id: 'tratar-intimacoes',
    label: 'Tratar intimações',
    hint: 'Caixa de publicações',
    icon: NewspaperIcon,
    path: '/djen',
    keywords: 'intimacao publicacao djen triagem prazo diario justica',
  },
  {
    id: 'novo-prazo',
    label: 'Novo prazo / tarefa',
    hint: 'Agenda · Kanban',
    icon: CalendarDaysIcon,
    path: '/agenda?novo=tarefa',
    keywords: 'prazo tarefa kanban agenda compromisso',
  },
  {
    id: 'novo-evento',
    label: 'Novo evento / audiência',
    hint: 'Agenda',
    icon: CalendarDaysIcon,
    path: '/agenda?novo=evento',
    keywords: 'evento audiencia compromisso reuniao agenda',
  },
  {
    id: 'novo-cliente',
    label: 'Novo cliente',
    hint: 'Clientes',
    icon: UsersIcon,
    path: '/clientes/novo',
    keywords: 'cliente cadastro contato parte',
  },
  {
    id: 'novo-caso',
    label: 'Novo caso / processo',
    hint: 'Casos',
    icon: BriefcaseIcon,
    path: '/casos/novo',
    keywords: 'caso processo acao novo',
  },
  {
    id: 'importar-cnjs',
    label: 'Importar processos (CNJ)',
    hint: 'Casos · lote',
    icon: BriefcaseIcon,
    path: '/casos/importar',
    keywords: 'importar cnj lote processo varios',
  },
  {
    id: 'consultar-cnj',
    label: 'Consultar processo (CNJ)',
    hint: 'Casos · DataJud',
    icon: MagnifyingGlassIcon,
    path: '/casos/buscar',
    keywords: 'consultar processo cnj datajud tribunal',
  },
  {
    id: 'novo-recebimento',
    label: 'Novo recebimento',
    hint: 'Financeiro',
    icon: CurrencyDollarIcon,
    path: '/recebimentos/novo',
    keywords: 'recebimento receber honorario financeiro entrada',
  },
  {
    id: 'nova-despesa',
    label: 'Nova despesa',
    hint: 'Financeiro',
    icon: CurrencyDollarIcon,
    path: '/despesas/novo',
    keywords: 'despesa pagar custa financeiro saida',
  },
  {
    id: 'abrir-financeiro',
    label: 'Abrir Financeiro',
    hint: 'Recebimentos · Despesas · Contratos · NF',
    icon: CurrencyDollarIcon,
    path: '/financeiro',
    keywords: 'financeiro recebimentos despesas contratos notas fiscais',
  },
  {
    id: 'abrir-relatorios',
    label: 'Abrir Relatórios',
    hint: 'Gerenciais e financeiros',
    icon: ChartBarIcon,
    path: '/relatorios',
    keywords: 'relatorio relatorios grafico bi gerencial fluxo caixa',
  },
  {
    id: 'abrir-configuracoes',
    label: 'Abrir Configurações',
    hint: 'Escritório · Integrações · Perfil',
    icon: Cog6ToothIcon,
    path: '/configuracoes',
    keywords: 'configuracoes ajustes integracoes perfil plano equipe',
  },
]

// Combining diacritical marks U+0300–U+036F via RegExp(String) pra não embutir
// caracteres combinantes literais no fonte (frágeis com CRLF/encoding).
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')
const normalizar = (s) => (s || '').normalize('NFD').replace(DIACRITICOS, '').toLowerCase()

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ clientes: [], casos: [] })
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const timerRef = useRef(null)
  // Issue #297 — cancela a busca anterior ao digitar (AbortController) e
  // garante que só a ÚLTIMA query aplica resultados. Sem isso, a resposta
  // atrasada de "A" sobrescrevia os resultados corretos de "AB".
  const abortRef = useRef(null)
  const seqRef = useRef(0)

  const buscar = useCallback(async (q) => {
    abortRef.current?.abort()
    if (q.trim().length < 2) {
      setResults({ clientes: [], casos: [] })
      setLoading(false)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    const seq = ++seqRef.current
    setLoading(true)
    try {
      const [clientesRes, casosRes] = await Promise.all([
        api.get(`/clientes/?search=${encodeURIComponent(q)}`, { signal: controller.signal }),
        api.get(`/casos/?search=${encodeURIComponent(q)}`, { signal: controller.signal }),
      ])
      if (seq !== seqRef.current) return // chegou tarde — descarta
      setResults({
        clientes: Array.isArray(clientesRes) ? clientesRes.slice(0, 5) : [],
        casos: Array.isArray(casosRes) ? casosRes.slice(0, 5) : [],
      })
    } catch (err) {
      if (err?.name === 'AbortError' || seq !== seqRef.current) return
      setResults({ clientes: [], casos: [] })
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [])

  const handleInputChange = (e) => {
    const q = e.target.value
    setQuery(q)
    setActiveIndex(0)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(q), 300)
  }

  const handleOpen = () => {
    setOpen(true)
    setActiveIndex(0)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleClose = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults({ clientes: [], casos: [] })
    setActiveIndex(0)
    clearTimeout(timerRef.current)
    abortRef.current?.abort()
    seqRef.current += 1 // invalida respostas em voo
    setLoading(false)
  }, [])

  // Cleanup no unmount: cancela timer e request pendentes
  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      abortRef.current?.abort()
    },
    []
  )

  const handleSelect = (path) => {
    navigate(path)
    handleClose()
  }

  // Ctrl+K (ou Cmd+K no Mac) abre/fecha de qualquer tela.
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        if (open) {
          handleClose()
        } else {
          handleOpen()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) handleClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, handleClose])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, handleClose])

  const q = normalizar(query.trim())
  const acoesFiltradas =
    q.length === 0
      ? ACOES
      : ACOES.filter((a) => normalizar(`${a.label} ${a.hint} ${a.keywords}`).includes(q))

  // Lista plana pra navegação por teclado (setas + Enter). Ordem visual:
  // ações, depois clientes, depois casos.
  const flat = [
    ...acoesFiltradas.map((a) => ({ path: a.path })),
    ...results.clientes.map((c) => ({ path: `/clientes/${c.id}` })),
    ...results.casos.map((c) => ({ path: `/casos/detalhe/${c.id}` })),
  ]
  const idxClientes = acoesFiltradas.length
  const idxCasos = acoesFiltradas.length + results.clientes.length

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      const item = flat[activeIndex]
      if (item) {
        e.preventDefault()
        handleSelect(item.path)
      }
    }
  }

  const temBusca = results.clientes.length > 0 || results.casos.length > 0
  const semNada = !temBusca && acoesFiltradas.length === 0 && !loading

  if (!open) {
    return (
      <button
        className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-1 px-3"
        onClick={handleOpen}
        title="Buscar e executar ações (Ctrl+K)"
        style={{ opacity: 0.85, whiteSpace: 'nowrap' }}
      >
        <MagnifyingGlassIcon style={{ width: 15, height: 15 }} />
        <span className="d-none d-md-inline" style={{ fontSize: '0.82rem' }}>
          Buscar...
        </span>
        <kbd
          className="d-none d-lg-inline ms-1"
          style={{ fontSize: '0.62rem', opacity: 0.6, background: 'transparent', border: 0 }}
        >
          Ctrl K
        </kbd>
      </button>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: 1050, flex: '0 0 auto' }}>
      <div
        className="input-group input-group-sm shadow-sm"
        style={{ width: 'clamp(200px, 28vw, 360px)' }}
      >
        <span className="input-group-text bg-white border-end-0">
          {loading ? (
            <span
              className="spinner-border spinner-border-sm text-secondary"
              style={{ width: 13, height: 13 }}
            />
          ) : (
            <MagnifyingGlassIcon style={{ width: 14, height: 14, color: '#6b7280' }} />
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          className="form-control border-start-0 ps-0"
          placeholder="Buscar casos, clientes ou ação..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          style={{ fontSize: '0.88rem' }}
        />
        <button
          className="btn btn-outline-secondary border-start-0"
          onClick={handleClose}
          tabIndex={-1}
        >
          <XMarkIcon style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {open && (
        <div
          className="card shadow border-0 mt-1"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '420px',
            overflowY: 'auto',
            borderRadius: '10px',
            minWidth: '320px',
            zIndex: 2000,
          }}
        >
          {semNada && (
            <div className="p-3 text-center text-muted small">
              Nenhum resultado para &ldquo;<strong>{query}</strong>&rdquo;
            </div>
          )}

          {acoesFiltradas.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 d-flex align-items-center gap-2">
                <CommandLineIcon style={{ width: 12, height: 12, color: '#6b7280' }} />
                <span
                  className="text-muted"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Ações
                </span>
              </div>
              {acoesFiltradas.map((a, i) => {
                const Icon = a.icon
                const isActive = activeIndex === i
                return (
                  <button
                    key={a.id}
                    className={`btn border-0 w-100 text-start px-3 py-2 d-flex align-items-center gap-2 ${isActive ? 'bg-primary-subtle' : 'btn-light'}`}
                    style={{ borderRadius: 0, fontSize: '0.88rem' }}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => handleSelect(a.path)}
                  >
                    <div className="p-1 rounded bg-secondary-subtle flex-shrink-0">
                      <Icon style={{ width: 12, height: 12, color: '#475569' }} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="fw-semibold text-truncate">{a.label}</div>
                      <div className="text-muted text-truncate" style={{ fontSize: '0.74rem' }}>
                        {a.hint}
                      </div>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {results.clientes.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 d-flex align-items-center gap-2">
                <UsersIcon style={{ width: 12, height: 12, color: '#6b7280' }} />
                <span
                  className="text-muted"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Clientes
                </span>
              </div>
              {results.clientes.map((c, i) => {
                const isActive = activeIndex === idxClientes + i
                return (
                  <button
                    key={c.id}
                    className={`btn border-0 w-100 text-start px-3 py-2 d-flex align-items-center gap-2 ${isActive ? 'bg-primary-subtle' : 'btn-light'}`}
                    style={{ borderRadius: 0, fontSize: '0.88rem' }}
                    onMouseEnter={() => setActiveIndex(idxClientes + i)}
                    onClick={() => handleSelect(`/clientes/${c.id}`)}
                  >
                    <div className="p-1 rounded bg-primary-subtle flex-shrink-0">
                      <UsersIcon style={{ width: 12, height: 12, color: '#2563eb' }} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="fw-semibold text-truncate">{c.nome_razao_social}</div>
                      {c.cpf_cnpj && (
                        <div className="text-muted text-truncate" style={{ fontSize: '0.74rem' }}>
                          {c.cpf_cnpj}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {results.casos.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 d-flex align-items-center gap-2">
                <BriefcaseIcon style={{ width: 12, height: 12, color: '#6b7280' }} />
                <span
                  className="text-muted"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Casos
                </span>
              </div>
              {results.casos.map((c, i) => {
                const isActive = activeIndex === idxCasos + i
                return (
                  <button
                    key={c.id}
                    className={`btn border-0 w-100 text-start px-3 py-2 d-flex align-items-center gap-2 ${isActive ? 'bg-primary-subtle' : 'btn-light'}`}
                    style={{ borderRadius: 0, fontSize: '0.88rem' }}
                    onMouseEnter={() => setActiveIndex(idxCasos + i)}
                    onClick={() => handleSelect(`/casos/detalhe/${c.id}`)}
                  >
                    <div className="p-1 rounded bg-success-subtle flex-shrink-0">
                      <BriefcaseIcon style={{ width: 12, height: 12, color: '#16a34a' }} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="fw-semibold text-truncate">{c.titulo}</div>
                      <div className="text-muted text-truncate" style={{ fontSize: '0.74rem' }}>
                        {c.numero_processo ? `${c.numero_processo} · ` : ''}
                        {c.status}
                      </div>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          <div className="px-3 py-2 border-top text-muted" style={{ fontSize: '0.7rem' }}>
            ↑↓ navegar · ↵ abrir · digite 2+ letras pra buscar casos e clientes
          </div>
        </div>
      )}
    </div>
  )
}
