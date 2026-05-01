// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { useNavigate } from 'react-router-dom'
import { api } from './api/client.js'

// Importação dos componentes de página
import DashboardPage from './pages/DashboardPage.jsx'
import ClientesPage from './pages/ClientesPage.jsx'
import CasosPage from './pages/CasosPage.jsx'
import CasoDetalhePage from './pages/CasoDetalhePage.jsx'
import RecebimentosPage from './pages/RecebimentosPage.jsx'
import DespesasPage from './pages/DespesasPage.jsx'
import AgendaPage from './pages/AgendaPage.jsx'
import PrazosPage from './pages/PrazosPage.jsx'
import DocumentosPage from './pages/DocumentosPage.jsx'
import RelatoriosPage from './pages/RelatoriosPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import TermsPage from './pages/auth/TermsPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'
import SolicitarAcessoPage from './pages/SolicitarAcessoPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import DjenPage from './pages/DjenPage.jsx'
import PerfilPage from './pages/PerfilPage.jsx'
import OnboardingPage from './pages/auth/OnboardingPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import NovoClientePorProcuracao from './pages/clientes/NovoClientePorProcuracao.jsx'
import PortalPage from './pages/portal/PortalPage.jsx'
import PortalRegisterPage from './pages/portal/PortalRegisterPage.jsx'
// admin-fase0: paginas do backoffice super-admin
import AdminTenantsPage from './pages/admin/AdminTenantsPage.jsx'
import AdminTenantDetailPage from './pages/admin/AdminTenantDetailPage.jsx'
import AdminAccessRequestsPage from './pages/admin/AdminAccessRequestsPage.jsx'
import { adminApi } from './api/admin.js'
import { APP_VERSION } from './version.js'
import GlobalSearch from './components/GlobalSearch.jsx'

// Importação dos ícones
import {
  HomeIcon,
  UsersIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CreditCardIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ScaleIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  NewspaperIcon,
  UserCircleIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

// landing-page: rota raiz publica.
// Se ja existe sessao, manda direto para o dashboard preservando o comportamento
// anterior. Caso contrario mostra a LandingPage publica para captacao.
const HomeRoute = () => {
  const token = localStorage.getItem('token')
  if (token) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}

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
  const [sidebarCounts, setSidebarCounts] = useState({ djenPendentes: 0, tarefasAlerta: 0 })

  const fetchSidebarCounts = useCallback(async () => {
    try {
      const data = await api.get('/dashboard/stats')
      setSidebarCounts({
        djenPendentes: data.alertas_djen?.pendentes_triagem ?? 0,
        tarefasAlerta:
          (data.alertas_tarefas?.vencidas ?? 0) + (data.alertas_tarefas?.vencendo_hoje ?? 0),
      })
    } catch {
      // sidebar badges são não-críticos, ignorar falhas silenciosamente
    }
  }, [])

  useEffect(() => {
    fetchSidebarCounts()
  }, [fetchSidebarCounts, location.pathname])
  const dataAtual = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date())

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

    let baseTitle = ''
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

  const SidebarLink = ({ to, icon: IconComponent, children, badge }) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
      title={children}
    >
      <IconComponent className="sidebar-link-icon" />
      <span style={{ flex: 1 }}>{children}</span>
      {badge > 0 && (
        <span
          style={{
            backgroundColor: '#ef4444',
            color: '#fff',
            borderRadius: '10px',
            fontSize: '0.65rem',
            fontWeight: 700,
            minWidth: '18px',
            padding: '1px 5px',
            textAlign: 'center',
            lineHeight: '16px',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )

  return (
    <div className="app-shell">
      {/* Overlay para mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <ScaleIcon className="sidebar-brand-scale" strokeWidth={1.8} />
          </div>
          <div>
            <div className="sidebar-brand-text">Patronus</div>
            <div className="sidebar-brand-sub">Sistema Juridico</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <SidebarLink to="/dashboard" icon={HomeIcon}>
            Dashboard
          </SidebarLink>
          <SidebarLink to="/clientes" icon={UsersIcon}>
            Clientes
          </SidebarLink>
          <SidebarLink to="/casos" icon={BriefcaseIcon}>
            Casos
          </SidebarLink>
          <SidebarLink
            to="/prazos"
            icon={ClipboardDocumentListIcon}
            badge={sidebarCounts.tarefasAlerta}
          >
            Prazos (Kanban)
          </SidebarLink>
          {userRole !== 'assistente' && (
            <>
              <SidebarLink to="/recebimentos" icon={CurrencyDollarIcon}>
                Recebimentos
              </SidebarLink>
              <SidebarLink to="/despesas" icon={CreditCardIcon}>
                Despesas
              </SidebarLink>
            </>
          )}
          <SidebarLink to="/agenda" icon={CalendarDaysIcon}>
            Agenda
          </SidebarLink>
          <SidebarLink to="/documentos" icon={DocumentTextIcon}>
            Documentos
          </SidebarLink>
          <SidebarLink to="/djen" icon={NewspaperIcon} badge={sidebarCounts.djenPendentes}>
            DJEN — Publicações
          </SidebarLink>
          <SidebarLink to="/relatorios" icon={ChartBarIcon}>
            Relatórios
          </SidebarLink>
          <SidebarLink to="/configuracoes" icon={Cog6ToothIcon}>
            Configurações SaaS
          </SidebarLink>
          <SidebarLink to="/perfil" icon={UserCircleIcon}>
            Meu Perfil
          </SidebarLink>
          {/* admin-fase0: itens visiveis apenas para superadmin */}
          {userRole === 'superadmin' && (
            <>
              <SidebarLink to="/admin/tenants" icon={BuildingOffice2Icon}>
                Backoffice
              </SidebarLink>
              <SidebarLink to="/admin/access-requests" icon={UserCircleIcon}>
                Solicitações
              </SidebarLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="sidebar-link mt-2 text-danger"
            title="Sair do Sistema"
          >
            <ArrowLeftOnRectangleIcon className="sidebar-link-icon" />
            <span>Sair</span>
          </button>
          <div className="sidebar-copyright mt-3">
            &copy; {new Date().getFullYear()} Patronus{' '}
            <span className="app-version">v{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="app-content">
        <header className="app-header">
          <div className="d-flex align-items-center gap-3">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Menu"
            >
              {sidebarOpen ? <XMarkIcon /> : <Bars3Icon />}
            </button>
            <div>
              <h1>{getPageTitle()}</h1>
              <small className="app-header-meta text-muted">
                Organizado e fluido, como seu escritorio precisa
              </small>
            </div>
          </div>
          <GlobalSearch />
          <div className="app-header-date text-capitalize d-none d-lg-block">{dataAtual}</div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
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
          <Route path="clientes/:clienteId" element={<ClientesPage />} />

          <Route path="casos" element={<CasosPage />} />
          <Route path="casos/novo" element={<CasosPage />} />
          <Route path="casos/editar/:casoId" element={<CasosPage />} />
          <Route path="casos/detalhe/:casoId" element={<CasoDetalhePage />} />

          <Route path="prazos" element={<PrazosPage />} />

          <Route path="recebimentos" element={<RecebimentosPage />} />
          <Route path="recebimentos/novo" element={<RecebimentosPage />} />
          <Route path="recebimentos/editar/:recebimentoId" element={<RecebimentosPage />} />

          <Route path="despesas" element={<DespesasPage />} />
          <Route path="despesas/novo" element={<DespesasPage />} />
          <Route path="despesas/editar/:despesaId" element={<DespesasPage />} />

          <Route path="agenda" element={<AgendaPage />} />
          <Route path="agenda/novo" element={<AgendaPage />} />
          <Route path="agenda/editar/:eventoId" element={<AgendaPage />} />

          <Route path="documentos" element={<DocumentosPage />} />
          <Route path="documentos/novo" element={<DocumentosPage />} />
          <Route path="documentos/editar/:documentoId" element={<DocumentosPage />} />

          <Route path="djen" element={<DjenPage />} />

          <Route path="relatorios" element={<RelatoriosPage />} />

          <Route path="configuracoes" element={<SettingsPage />} />
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
    </>
  )
}

export default App
