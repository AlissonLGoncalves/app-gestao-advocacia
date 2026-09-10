// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, NavLink, Outlet, useLocation, Navigate } from 'react-router'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { useNavigate } from 'react-router'
import { api } from './api/client.js'
import { lazyRetry } from './utils/lazyRetry.js'

// Issue #298 — code-splitting: páginas viram React.lazy (cada rota gera
// um chunk próprio; FullCalendar, dnd-kit, DjenPage etc. saem do bundle
// inicial — antes 2.6 MB num arquivo só). Mantidas estáticas só as de
// primeiro paint (Landing, Login) e a NotFound (minúscula).
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

const { Suspense } = React
const DashboardPage = lazyRetry(() => import('./pages/DashboardPage.jsx'))
const ClientesPage = lazyRetry(() => import('./pages/ClientesPage.jsx'))
const CasosPage = lazyRetry(() => import('./pages/CasosPage.jsx'))
const CasoDetalhePage = lazyRetry(() => import('./pages/CasoDetalhePage.jsx'))
const ImportarCnjsPage = lazyRetry(() => import('./pages/ImportarCnjsPage.jsx'))
const BuscarProcessoCnjPage = lazyRetry(() => import('./pages/BuscarProcessoCnjPage.jsx'))
const RecebimentosPage = lazyRetry(() => import('./pages/RecebimentosPage.jsx'))
const RecebimentosHistoricoPage = lazyRetry(() => import('./pages/RecebimentosHistoricoPage.jsx'))
const NotasFiscaisPage = lazyRetry(() => import('./pages/NotasFiscaisPage.jsx'))
const ClienteDetalhePage = lazyRetry(() => import('./pages/ClienteDetalhePage.jsx'))
const ContratosPage = lazyRetry(() => import('./pages/ContratosPage.jsx'))
const DespesasPage = lazyRetry(() => import('./pages/DespesasPage.jsx'))
const AgendaUnificadaPage = lazyRetry(() => import('./pages/AgendaUnificadaPage.jsx'))
const DocumentosPage = lazyRetry(() => import('./pages/DocumentosPage.jsx'))
const RelatoriosPage = lazyRetry(() => import('./pages/RelatoriosPage.jsx'))
// Hubs do "menu enxuto": uma entrada de sidebar -> tela com abas que reembrulha
// páginas já existentes (Financeiro, Documentos+Modelos, Configurações).
const FinanceiroPage = lazyRetry(() => import('./pages/FinanceiroPage.jsx'))
const DocumentosHubPage = lazyRetry(() => import('./pages/DocumentosHubPage.jsx'))
const ConfiguracoesPage = lazyRetry(() => import('./pages/ConfiguracoesPage.jsx'))
const RegisterPage = lazyRetry(() => import('./pages/auth/RegisterPage.jsx'))
const TermsPage = lazyRetry(() => import('./pages/auth/TermsPage.jsx'))
const ForgotPasswordPage = lazyRetry(() => import('./pages/auth/ForgotPasswordPage.jsx'))
const ResetPasswordPage = lazyRetry(() => import('./pages/auth/ResetPasswordPage.jsx'))
const SolicitarAcessoPage = lazyRetry(() => import('./pages/SolicitarAcessoPage.jsx'))
const SettingsPage = lazyRetry(() => import('./pages/SettingsPage.jsx'))
const IntegracoesPage = lazyRetry(() => import('./pages/IntegracoesPage.jsx'))
const ModelosDocumentoPage = lazyRetry(() => import('./pages/ModelosDocumentoPage.jsx'))
const DjenPage = lazyRetry(() => import('./pages/DjenPage.jsx'))
const TriagemAssistidaPage = lazyRetry(() => import('./pages/TriagemAssistidaPage.jsx'))
const PerfilPage = lazyRetry(() => import('./pages/PerfilPage.jsx'))
const OnboardingPage = lazyRetry(() => import('./pages/auth/OnboardingPage.jsx'))
const NovoClientePorProcuracao = lazyRetry(
  () => import('./pages/clientes/NovoClientePorProcuracao.jsx')
)
const PortalPage = lazyRetry(() => import('./pages/portal/PortalPage.jsx'))
const PortalRegisterPage = lazyRetry(() => import('./pages/portal/PortalRegisterPage.jsx'))
// admin-fase0: paginas do backoffice super-admin
const AdminTenantsPage = lazyRetry(() => import('./pages/admin/AdminTenantsPage.jsx'))
const AdminTenantDetailPage = lazyRetry(() => import('./pages/admin/AdminTenantDetailPage.jsx'))
const AdminAccessRequestsPage = lazyRetry(() => import('./pages/admin/AdminAccessRequestsPage.jsx'))
import { adminApi } from './api/admin.js'
import { APP_VERSION } from './version.js'
import GlobalSearch from './components/GlobalSearch.jsx'
import HeaderQuickAdd from './components/HeaderQuickAdd.jsx'
import NotificacoesBell from './components/NotificacoesBell.jsx'
import MenuItemBadge from './components/ui/MenuItemBadge.jsx'
import PatronusLogo from './components/brand/PatronusLogo.jsx'

// Importação dos ícones
import {
  HomeIcon,
  UsersIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  Cog6ToothIcon,
  NewspaperIcon,
  UserCircleIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'

const getStoredRole = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').role || ''
  } catch {
    return ''
  }
}

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  if (getStoredRole() === 'cliente') {
    return <Navigate to="/portal" replace />
  }
  return children
}

// landing-page: rota raiz publica.
// Se ja existe sessao, manda direto para o dashboard preservando o comportamento
// anterior. Caso contrario mostra a LandingPage publica para captacao.
const HomeRoute = () => {
  const token = localStorage.getItem('token')
  if (token) {
    return <Navigate to={getStoredRole() === 'cliente' ? '/portal' : '/dashboard'} replace />
  }
  return <LandingPage />
}

// Context pra propagar o callback de "fechar sidebar mobile" pros
// SidebarLink. Antes o SidebarLink vivia aninhado no AppLayout e capturava
// setSidebarOpen via closure — mas como era recriado a cada render, o
// React-Hooks lint reclamava (static-components) e cada NavLink remontava
// a cada render, perdendo o highlight active.
const SidebarContext = React.createContext({ onClose: () => {} })

// Componente de link da sidebar. Top-level pra ser estavel entre renders.
const SidebarLink = ({ to, icon: IconComponent, children, badge, badgeCor = 'danger' }) => {
  const { onClose } = React.useContext(SidebarContext)
  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
      title={children}
    >
      <IconComponent className="sidebar-link-icon" />
      <span style={{ flex: 1 }}>{children}</span>
      <MenuItemBadge count={badge} cor={badgeCor} />
    </NavLink>
  )
}

// Header de secao da sidebar (agrupa links visualmente).
// PR #250: substitui sequencia flat de 15 itens por grupos.
const SidebarSection = ({ children }) => <div className="sidebar-section-label">{children}</div>

// onboarding-wizard: gate que checa /tenant/onboarding-status uma vez por sessao
// e redireciona para /onboarding se o tenant ainda nao completou o wizard.
// Nao se aplica a roles 'cliente' (portal) e 'superadmin' (backoffice).
const OnboardingGate = ({ children }) => {
  const userStr = localStorage.getItem('user')
  let role = ''
  try {
    role = userStr ? JSON.parse(userStr).role : ''
  } catch {
    /* */
  }

  // Cache em sessionStorage para nao re-disparar request a cada navegacao.
  const cached = sessionStorage.getItem('onboarding_completed')
  const [estado, setEstado] = useState(cached === 'true' ? 'completo' : null)

  useEffect(() => {
    if (estado === 'completo') return
    if (role === 'cliente' || role === 'superadmin') {
      setEstado('completo')
      return
    }
    let active = true
    api
      .get('/tenant/onboarding-status')
      .then((data) => {
        if (!active) return
        if (data?.onboarding_completed) {
          sessionStorage.setItem('onboarding_completed', 'true')
          setEstado('completo')
        } else {
          setEstado('pendente')
        }
      })
      .catch(() => {
        // Em caso de falha, nao bloquear o usuario — assume completo.
        if (active) setEstado('completo')
      })
    return () => {
      active = false
    }
  }, [estado, role])

  if (estado === null) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '60vh' }}
      >
        <span className="spinner-border text-primary" role="status" aria-label="Carregando" />
      </div>
    )
  }
  if (estado === 'pendente') return <Navigate to="/onboarding" replace />
  return children
}

const PortalRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  const userStr = localStorage.getItem('user')
  let role = ''
  try {
    role = userStr ? JSON.parse(userStr).role : ''
  } catch {
    /* */
  }
  if (role !== 'cliente') return <Navigate to="/dashboard" replace />
  return children
}

// admin-fase0: gate do backoffice super-admin.
// Frontend gating e somente UX — fazemos GET /admin/v1/me no mount para confirmar role server-side.
const SuperAdminRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  let role = ''
  try {
    role = userStr ? JSON.parse(userStr).role : ''
  } catch {
    /* */
  }
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!token || role !== 'superadmin') return
    let active = true
    adminApi
      .me()
      .then((data) => {
        if (active && data?.role === 'superadmin') setConfirmed(true)
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        toast.error('Acesso negado')
        navigate('/login')
      })
    return () => {
      active = false
    }
  }, [token, role, navigate])

  if (!token) return <Navigate to="/login" replace />
  if (role !== 'superadmin') return <Navigate to="/dashboard" replace />
  if (!confirmed) {
    return (
      <div className="text-center py-5 text-muted">
        <div className="spinner-border" role="status" aria-label="Validando acesso" />
      </div>
    )
  }
  return children
}

const MainLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Callback estavel pra passar pro SidebarLink (que agora vive fora do
  // componente). useCallback garante referencia estavel entre renders,
  // o que permite o React poupar re-renders dos NavLinks.
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const [sidebarCounts, setSidebarCounts] = useState({
    djenPendentes: 0,
    tarefasAlerta: 0,
    recebimentosVencidos: 0,
    despesasVencidas: 0,
    solicitacoesPendentes: 0,
  })

  const fetchSidebarCounts = useCallback(async () => {
    try {
      const data = await api.get('/dashboard/stats')
      setSidebarCounts({
        djenPendentes: data.alertas_djen?.pendentes_triagem ?? 0,
        // Feature Kanban<>DJEN: badge inclui prazos pendentes de confirmacao
        // (gerados pela IA) — assim o advogado ve no menu que ha cards
        // aguardando revisao mesmo quando nao ha tarefas vencidas.
        tarefasAlerta:
          (data.alertas_tarefas?.vencidas ?? 0) +
          (data.alertas_tarefas?.vencendo_hoje ?? 0) +
          (data.alertas_tarefas?.aguardando_confirmacao ?? 0),
        recebimentosVencidos: data.alertas_financeiro?.recebimentos_vencidos ?? 0,
        despesasVencidas: data.alertas_financeiro?.despesas_vencidas ?? 0,
        solicitacoesPendentes: data.alertas_admin?.solicitacoes_pendentes ?? 0,
      })
    } catch {
      // sidebar badges são não-críticos, ignorar falhas silenciosamente
    }
  }, [])

  useEffect(() => {
    fetchSidebarCounts()
  }, [fetchSidebarCounts, location.pathname])

  // Sync DJEN automatico na primeira renderizacao do dia. O backend ja faz a
  // checagem de "ja sincronizou hoje?" — frontend so dispara uma vez por sessao
  // (sessionStorage evita refire em cada navegacao SPA). Se o servidor decide
  // skipar (status 200 + skipped=true), zero overhead.
  useEffect(() => {
    if (sessionStorage.getItem('djen_diario_disparado') === 'true') return
    const userStr = localStorage.getItem('user')
    let role = ''
    try {
      role = userStr ? JSON.parse(userStr).role : ''
    } catch {
      /* */
    }
    // Cliente do portal e super-admin nao tem DJEN proprio.
    if (role === 'cliente' || role === 'superadmin') {
      sessionStorage.setItem('djen_diario_disparado', 'true')
      return
    }
    api
      .post('/djen/sync/diario', {})
      .then((data) => {
        sessionStorage.setItem('djen_diario_disparado', 'true')
        if (!data?.skipped) {
          // Toast discreto so quando realmente disparamos um sync novo.
          toast.info('Sincronizando publicacoes do DJEN em segundo plano...', {
            autoClose: 4000,
          })
        }
      })
      .catch(() => {
        // Falha nao deve impedir o usuario de usar o app — silencia. Tenta
        // novamente na proxima sessao (sessionStorage so seta em sucesso).
      })
  }, [])

  const userString = localStorage.getItem('user')
  let userRole = 'admin'
  try {
    if (userString) {
      userRole = JSON.parse(userString).role || 'admin'
    }
  } catch (e) {
    console.error('Erro lendo usuario', e)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('onboarding_completed')
    toast.info('Logout realizado com sucesso!')
    navigate('/login')
  }

  const getPageTitle = () => {
    const path = location.pathname.toLowerCase()
    const cleanPath = path.startsWith('/') ? path.substring(1) : path
    const pathSegments = cleanPath.split('/')
    const baseSegment = pathSegments[0]
    const actionSegment = pathSegments[1]
    const idSegment = pathSegments[2]

    if (baseSegment === '' || baseSegment === 'dashboard') return 'Dashboard'
    if (baseSegment === 'casos' && actionSegment === 'detalhe' && idSegment)
      return 'Detalhes do Caso'

    let titlePrefix = ''
    if (actionSegment === 'novo') titlePrefix = 'Novo '
    else if (actionSegment === 'editar' && idSegment) titlePrefix = 'Editar '

    // Sempre atribuido no switch (incluindo default). Nao precisa de seed.
    let baseTitle
    switch (baseSegment) {
      case 'clientes':
        baseTitle = 'Cliente'
        break
      case 'casos':
        baseTitle = 'Caso'
        break
      case 'recebimentos':
        baseTitle = 'Recebimento'
        break
      case 'despesas':
        baseTitle = 'Despesa'
        break
      case 'financeiro':
        return 'Financeiro'
      case 'prazos':
        baseTitle = 'Prazos/Tarefas'
        break
      case 'agenda':
        baseTitle = 'Evento'
        break
      case 'documentos':
        baseTitle = 'Documento'
        break
      case 'relatorios':
        return 'Relatórios'
      case 'djen':
        return 'DJEN — Diário de Justiça'
      case 'configuracoes':
        return 'Configurações do Sistema'
      case 'perfil':
        return 'Meu Perfil'
      default:
        baseTitle = baseSegment.replace('-', ' ')
    }

    if (
      !titlePrefix &&
      ['clientes', 'casos', 'recebimentos', 'despesas', 'agenda', 'documentos'].includes(
        baseSegment
      )
    ) {
      return baseSegment.charAt(0).toUpperCase() + baseSegment.slice(1)
    }

    const finalTitle = `${titlePrefix}${baseTitle}`
    return finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1)
  }

  // PR 5 (polimentos): subtitulo contextual por pagina. Substitui o
  // "Organizado e fluido, como seu escritorio precisa" que se repetia
  // identico em TODA pagina (ruido visual sem informacao util).
  const getPageSubtitle = () => {
    const path = location.pathname.toLowerCase()
    const seg = path.split('/').filter(Boolean)[0] || 'dashboard'
    const map = {
      dashboard: 'Visão geral do escritório',
      clientes: 'Cadastros e gestão da carteira',
      casos: 'Processos e casos jurídicos',
      prazos: 'Kanban de prazos e tarefas',
      recebimentos: 'Lançamentos a receber e histórico de pagamentos',
      contratos: 'Contratos de honorários',
      despesas: 'Lançamentos a pagar e pagas',
      financeiro: 'Recebimentos, contratos, despesas e notas fiscais',
      nfse: 'Emissão e gerenciamento de Notas Fiscais de Serviço',
      agenda: 'Compromissos, audiências e prazos com data',
      documentos: 'Anexos e arquivos do escritório',
      modelos: 'Modelos editáveis de peças jurídicas',
      djen: 'Publicações capturadas do Diário de Justiça Eletrônico',
      relatorios: 'Relatórios gerenciais e financeiros',
      configuracoes: 'Escritório, integrações e seu perfil',
      integracoes: 'Integrações com sistemas externos',
      perfil: 'Suas informações pessoais e segurança',
      admin: 'Backoffice — gerencia tenants e solicitações',
    }
    return map[seg] || 'Patronus — Sistema Jurídico'
  }

  // Valor do contexto memoizado pra nao recriar a cada render.
  const sidebarCtxValue = React.useMemo(() => ({ onClose: closeSidebar }), [closeSidebar])

  return (
    <SidebarContext.Provider value={sidebarCtxValue}>
      <div className="app-shell">
        {/* Overlay para mobile */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <PatronusLogo size={40} tone="light" />
          </div>

          <nav className="sidebar-nav">
            {/* === MENU ENXUTO (15 itens planos -> 7 por frequência de uso) ===
                Diário: o que o advogado abre toda manhã. Semanal: um nível
                abaixo. O resto (Relatórios, Integrações, Perfil, Modelos)
                saiu do caminho diário: virou aba de hub ou Ctrl+K. */}

            {/* === DIÁRIO === */}
            <SidebarSection>Diário</SidebarSection>
            <SidebarLink to="/dashboard" icon={HomeIcon}>
              Início
            </SidebarLink>
            {/* Badge vermelho: publicacoes aguardando decisao (mockup Stitch). */}
            <SidebarLink to="/djen" icon={NewspaperIcon} badge={sidebarCounts.djenPendentes}>
              Intimações
            </SidebarLink>
            <SidebarLink to="/casos" icon={BriefcaseIcon}>
              Casos
            </SidebarLink>
            {/* Agenda unificada: UMA entrada. /agenda abre a tela com o seletor
                de 3 visoes (Calendario | Kanban | Lista). Badge de prazos
                vencidos/IA pendentes (tarefasAlerta) fica aqui. */}
            <SidebarLink
              to="/agenda"
              icon={CalendarDaysIcon}
              badge={sidebarCounts.tarefasAlerta}
              badgeCor="info"
            >
              Agenda
            </SidebarLink>

            {/* === SEMANAL === */}
            <SidebarSection>Semanal</SidebarSection>
            <SidebarLink to="/clientes" icon={UsersIcon}>
              Clientes
            </SidebarLink>
            {/* Financeiro consolidado: Recebimentos + Contratos + Despesas +
                Notas Fiscais viram abas de /financeiro (era 4 itens). Oculto
                pra assistente. Badge soma vencidos de recebimentos e despesas. */}
            {userRole !== 'assistente' && (
              <SidebarLink
                to="/financeiro"
                icon={CurrencyDollarIcon}
                badge={sidebarCounts.recebimentosVencidos + sidebarCounts.despesasVencidas}
              >
                Financeiro
              </SidebarLink>
            )}
            {/* Documentos + Modelos viram abas de /documentos. */}
            <SidebarLink to="/documentos" icon={DocumentTextIcon}>
              Documentos
            </SidebarLink>

            {/* === SISTEMA === Configurações + Integrações + Perfil num hub só */}
            <SidebarSection>Sistema</SidebarSection>
            <SidebarLink to="/configuracoes" icon={Cog6ToothIcon}>
              Configurações
            </SidebarLink>
            {/* === ADMINISTRAÇÃO === so visivel pra superadmin */}
            {userRole === 'superadmin' && (
              <>
                <SidebarSection>Administração</SidebarSection>
                <SidebarLink to="/admin/tenants" icon={BuildingOffice2Icon}>
                  Backoffice
                </SidebarLink>
                <SidebarLink
                  to="/admin/access-requests"
                  icon={UserCircleIcon}
                  badge={sidebarCounts.solicitacoesPendentes}
                >
                  Solicitações
                </SidebarLink>
              </>
            )}
          </nav>

          <div className="sidebar-footer">
            <button
              type="button"
              onClick={handleLogout}
              className="sidebar-link sidebar-link-logout"
              title="Sair do sistema"
            >
              <ArrowLeftOnRectangleIcon className="sidebar-link-icon" />
              <span>Sair</span>
            </button>
            <div className="sidebar-copyright">
              <span>&copy; {new Date().getFullYear()} Patronus</span>
              <span className="app-version">v{APP_VERSION}</span>
            </div>
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <div className="app-content">
          <header className="app-header">
            <div className="app-header-title">
              <button
                type="button"
                className="mobile-menu-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? <XMarkIcon /> : <Bars3Icon />}
              </button>
              <div className="app-header-heading">
                <h1>{getPageTitle()}</h1>
                <small className="app-header-meta">{getPageSubtitle()}</small>
              </div>
            </div>
            {/* Direita: busca (Ctrl K), sino e "+ Novo" — nada mais (mockup Stitch). */}
            <div className="app-header-actions">
              <GlobalSearch />
              <NotificacoesBell />
              <HeaderQuickAdd />
            </div>
          </header>
          <main className="app-main">
            <div className="app-main-inner">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}

function App() {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      {/* Issue #298 — Suspense cobre os chunks lazy das rotas. O fallback
          é o mesmo spinner padrão das páginas. */}
      <Suspense
        fallback={
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ minHeight: '60vh' }}
          >
            <span className="spinner-border text-primary" role="status" aria-label="Carregando" />
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/solicitar-acesso" element={<SolicitarAcessoPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/portal/registro" element={<PortalRegisterPage />} />
          <Route
            path="/portal"
            element={
              <PortalRoute>
                <PortalPage />
              </PortalRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<HomeRoute />} />
          <Route
            element={
              <ProtectedRoute>
                <OnboardingGate>
                  <MainLayout />
                </OnboardingGate>
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />

            <Route path="clientes" element={<ClientesPage />} />
            <Route path="clientes/novo" element={<ClientesPage />} />
            <Route path="clientes/novo/procuracao" element={<NovoClientePorProcuracao />} />
            <Route path="clientes/editar/:clienteId" element={<ClientesPage />} />
            {/* PR #249: drill-down do cliente. /clientes/:id agora abre pagina
              de detalhe com abas (Dados, Casos, Contratos, Documentos,
              Hist Financeiro) em vez do form de edicao read-only antigo. */}
            <Route path="clientes/:clienteId" element={<ClienteDetalhePage />} />

            <Route path="casos" element={<CasosPage />} />
            <Route path="casos/novo" element={<CasosPage />} />
            <Route path="casos/importar" element={<ImportarCnjsPage />} />
            <Route path="casos/buscar" element={<BuscarProcessoCnjPage />} />
            <Route path="casos/editar/:casoId" element={<CasosPage />} />
            <Route path="casos/detalhe/:casoId" element={<CasoDetalhePage />} />

            {/* Kanban unificado: /prazos agora é a aba Kanban da Agenda.
              Mantém todos os links existentes (Dashboard, onboarding, caso). */}
            <Route path="prazos" element={<Navigate to="/agenda?view=kanban" replace />} />

            <Route path="recebimentos" element={<RecebimentosPage />} />
            <Route path="recebimentos/historico" element={<RecebimentosHistoricoPage />} />
            <Route path="recebimentos/novo" element={<RecebimentosPage />} />
            <Route path="recebimentos/editar/:recebimentoId" element={<RecebimentosPage />} />

            <Route path="contratos" element={<ContratosPage />} />

            <Route path="despesas" element={<DespesasPage />} />
            <Route path="despesas/novo" element={<DespesasPage />} />
            <Route path="despesas/editar/:despesaId" element={<DespesasPage />} />

            <Route path="nfse" element={<NotasFiscaisPage />} />

            {/* Hub Financeiro: /financeiro?aba=recebimentos|contratos|despesas|notas.
                As rotas acima (/recebimentos, /despesas...) seguem válidas pra
                deep-links, formulários (novo/editar) e back-compat. */}
            <Route path="financeiro" element={<FinanceiroPage />} />

            {/* Issue #301: AgendaPage legada removida. A unificada cobre as
              3 visões; criação via ?novo=evento|tarefa (abre o modal).
              Redirects preservam links/favoritos antigos. */}
            <Route path="agenda" element={<AgendaUnificadaPage />} />
            <Route path="agenda/legado" element={<Navigate to="/agenda" replace />} />
            <Route path="agenda/novo" element={<Navigate to="/agenda?novo=evento" replace />} />
            <Route path="agenda/editar/:eventoId" element={<Navigate to="/agenda" replace />} />

            {/* Hub Documentos: /documentos abre abas (Documentos | Modelos).
                /documentos/novo|editar continuam na DocumentosPage standalone. */}
            <Route path="documentos" element={<DocumentosHubPage />} />
            <Route path="documentos/novo" element={<DocumentosPage />} />
            <Route path="documentos/editar/:documentoId" element={<DocumentosPage />} />

            <Route path="djen" element={<DjenPage />} />
            <Route path="djen/triagem-assistida" element={<TriagemAssistidaPage />} />

            <Route path="relatorios" element={<RelatoriosPage />} />

            {/* Hub Configurações: /configuracoes abre abas (Escritório |
                Integrações | Meu perfil). As rotas standalone abaixo seguem
                válidas pra deep-links e back-compat. */}
            <Route path="configuracoes" element={<ConfiguracoesPage />} />
            <Route path="integracoes" element={<IntegracoesPage />} />
            <Route path="modelos" element={<ModelosDocumentoPage />} />
            <Route path="perfil" element={<PerfilPage />} />

            {/* admin-fase0: rotas do backoffice (gated por SuperAdminRoute) */}
            <Route path="admin" element={<Navigate to="/admin/tenants" replace />} />
            <Route
              path="admin/tenants"
              element={
                <SuperAdminRoute>
                  <AdminTenantsPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="admin/tenants/:id"
              element={
                <SuperAdminRoute>
                  <AdminTenantDetailPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="admin/access-requests"
              element={
                <SuperAdminRoute>
                  <AdminAccessRequestsPage />
                </SuperAdminRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

export default App
