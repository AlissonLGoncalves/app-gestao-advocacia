// src/App.jsx
import React, { useState } from 'react';
import { Routes, Route, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "bootstrap-icons/font/bootstrap-icons.css";
import { useNavigate } from 'react-router-dom';

// Importação dos componentes de página
import DashboardPage from './pages/DashboardPage.jsx';
import ClientesPage from './pages/ClientesPage.jsx';
import CasosPage from './pages/CasosPage.jsx';
import CasoDetalhePage from './pages/CasoDetalhePage.jsx';
import RecebimentosPage from './pages/RecebimentosPage.jsx';
import DespesasPage from './pages/DespesasPage.jsx';
import AgendaPage from './pages/AgendaPage.jsx';
import DocumentosPage from './pages/DocumentosPage.jsx';
import RelatoriosPage from './pages/RelatoriosPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';

// Importação dos ícones
import {
  HomeIcon, UsersIcon, BriefcaseIcon, DocumentTextIcon,
  CurrencyDollarIcon, CalendarDaysIcon, ChartBarIcon, CreditCardIcon, ArrowLeftOnRectangleIcon,
  Bars3Icon, XMarkIcon, ScaleIcon
} from '@heroicons/react/24/outline';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userString = localStorage.getItem('user');
  let userRole = 'admin'; 
  try {
    if (userString) {
      userRole = JSON.parse(userString).role || 'admin';
    }
  } catch (e) {
    console.error("Erro lendo usuario", e);
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.info("Logout realizado com sucesso!");
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname.toLowerCase();
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const pathSegments = cleanPath.split('/');
    const baseSegment = pathSegments[0];
    const actionSegment = pathSegments[1];
    const idSegment = pathSegments[2];

    if (baseSegment === '' || baseSegment === 'dashboard') return 'Dashboard';
    if (baseSegment === 'casos' && actionSegment === 'detalhe' && idSegment) return 'Detalhes do Caso';

    let titlePrefix = '';
    if (actionSegment === 'novo') titlePrefix = 'Novo ';
    else if (actionSegment === 'editar' && idSegment) titlePrefix = 'Editar ';

    let baseTitle = '';
    switch (baseSegment) {
      case 'clientes': baseTitle = 'Cliente'; break;
      case 'casos': baseTitle = 'Caso'; break;
      case 'recebimentos': baseTitle = 'Recebimento'; break;
      case 'despesas': baseTitle = 'Despesa'; break;
      case 'agenda': baseTitle = 'Evento'; break;
      case 'documentos': baseTitle = 'Documento'; break;
      case 'relatorios': return 'Relatórios';
      default: baseTitle = baseSegment.replace('-', ' ');
    }

    if (!titlePrefix && ['clientes','casos','recebimentos','despesas','agenda','documentos'].includes(baseSegment)) {
       return baseSegment.charAt(0).toUpperCase() + baseSegment.slice(1);
    }
    
    const finalTitle = `${titlePrefix}${baseTitle}`;
    return finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
  };

  const SidebarLink = ({ to, icon: IconComponent, children }) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? 'active' : ''}`
      }
      title={children}
    >
      <IconComponent className="sidebar-link-icon" />
      <span>{children}</span>
    </NavLink>
  );

  return (
    <div className="d-flex vh-100">
      {/* Overlay para mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <ScaleIcon style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <div className="sidebar-brand-text">Patronus</div>
            <div className="sidebar-brand-sub">Gestão Jurídica</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <SidebarLink to="/dashboard" icon={HomeIcon}>Dashboard</SidebarLink>
          <SidebarLink to="/clientes" icon={UsersIcon}>Clientes</SidebarLink>
          <SidebarLink to="/casos" icon={BriefcaseIcon}>Casos</SidebarLink>
          {userRole !== 'assistente' && (
            <>
              <SidebarLink to="/recebimentos" icon={CurrencyDollarIcon}>Recebimentos</SidebarLink>
              <SidebarLink to="/despesas" icon={CreditCardIcon}>Despesas</SidebarLink>
            </>
          )}
          <SidebarLink to="/agenda" icon={CalendarDaysIcon}>Agenda</SidebarLink>
          <SidebarLink to="/documentos" icon={DocumentTextIcon}>Documentos</SidebarLink>
          <SidebarLink to="/relatorios" icon={ChartBarIcon}>Relatórios</SidebarLink>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="sidebar-link" title="Sair do Sistema">
            <ArrowLeftOnRectangleIcon className="sidebar-link-icon" />
            <span>Sair</span>
          </button>
          <div className="sidebar-copyright">&copy; {new Date().getFullYear()} Patronus</div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">
        <header className="app-header">
          <div className="d-flex align-items-center gap-3">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Menu"
            >
              {sidebarOpen ? <XMarkIcon /> : <Bars3Icon />}
            </button>
            <h1>{getPageTitle()}</h1>
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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
          <Route path="clientes/editar/:clienteId" element={<ClientesPage />} />
          
          <Route path="casos" element={<CasosPage />} />
          <Route path="casos/novo" element={<CasosPage />} />
          <Route path="casos/editar/:casoId" element={<CasosPage />} />
          <Route path="casos/detalhe/:casoId" element={<CasoDetalhePage />} />


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
          
          <Route path="relatorios" element={<RelatoriosPage />} />
          
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;