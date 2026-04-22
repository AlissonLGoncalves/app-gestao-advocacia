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
import SettingsPage from './pages/SettingsPage.jsx'
import DjenPage from './pages/DjenPage.jsx'
import PerfilPage from './pages/PerfilPage.jsx'
import NovoClientePorProcuracao from './pages/clientes/NovoClientePorProcuracao.jsx'
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
} from '@heroicons/react/24/outline'

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/login" replace />
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
        <Route path="/termos" element={<TermsPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
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

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
