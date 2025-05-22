// src/App.jsx
import React from 'react';
import { Routes, Route, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom'; // Adicionado Navigate
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "bootstrap-icons/font/bootstrap-icons.css";

// Importação dos componentes de página
import DashboardPage from './pages/DashboardPage.jsx';
import ClientesPage from './pages/ClientesPage.jsx';
import CasosPage from './pages/CasosPage.jsx';
import RecebimentosPage from './pages/RecebimentosPage.jsx';
import DespesasPage from './pages/DespesasPage.jsx';
import AgendaPage from './pages/AgendaPage.jsx';
import DocumentosPage from './pages/DocumentosPage.jsx';
import RelatoriosPage from './pages/RelatoriosPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx'; // Importa a LoginPage

// Importação dos ícones
import {
  HomeIcon, UsersIcon, BriefcaseIcon, DocumentTextIcon,
  CurrencyDollarIcon, CalendarDaysIcon, ChartBarIcon, CreditCardIcon, ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom'; // Importar useNavigate

console.log("Módulo App.jsx carregado.");

// Componente para proteger rotas
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    // Usuário não autenticado, redireciona para a página de login
    return <Navigate to="/login" replace />;
  }
  return children; // Usuário autenticado, renderiza o componente filho
};


const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate(); // Hook para navegação
  console.log("MainLayout renderizado. Pathname:", location.pathname);

  const handleLogout = () => {
    localStorage.removeItem('token'); // Remove o token
    toast.info("Logout realizado com sucesso!");
    navigate('/login'); // Redireciona para a página de login
  };

  const getPageTitle = () => {
    const path = location.pathname.toLowerCase();
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const pathSegments = cleanPath.split('/');
    const baseSegment = pathSegments[0];
    const actionSegment = pathSegments[1];
    const idSegment = pathSegments[2];

    if (baseSegment === '' || baseSegment === 'dashboard') return 'Dashboard';
    
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

    if (!titlePrefix && baseSegment.endsWith('s') && (baseSegment === 'clientes' || baseSegment === 'casos' || baseSegment === 'recebimentos' || baseSegment === 'despesas' || baseSegment === 'agenda' || baseSegment === 'documentos')) {
       baseTitle = baseSegment.charAt(0).toUpperCase() + baseSegment.slice(1);
       return baseTitle;
    }
    
    const finalTitle = `${titlePrefix}${baseTitle}`;
    return finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
  };


  const NavButton = ({ to, icon: IconComponent, children }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `btn w-100 d-flex align-items-center text-start mb-1 ${isActive ? 'btn-primary active' : 'btn-light'}`
      }
      title={children}
    >
      <IconComponent className="me-2" style={{ width: '18px', height: '18px' }} />
      <span className="ms-1">{children}</span>
    </NavLink>
  );

  return (
    <div className="d-flex vh-100">
      <aside className="bg-light border-end p-3 d-flex flex-column" style={{ width: '250px', flexShrink: 0 }}>
        <div className="h3 text-primary mb-4 text-center pt-2">Gestão ADV</div>
        <NavButton to="/dashboard" icon={HomeIcon}>Dashboard</NavButton>
        <NavButton to="/clientes" icon={UsersIcon}>Clientes</NavButton>
        <NavButton to="/casos" icon={BriefcaseIcon}>Casos</NavButton>
        <NavButton to="/recebimentos" icon={CurrencyDollarIcon}>Recebimentos</NavButton>
        <NavButton to="/despesas" icon={CreditCardIcon}>Despesas</NavButton>
        <NavButton to="/agenda" icon={CalendarDaysIcon}>Agenda</NavButton>
        <NavButton to="/documentos" icon={DocumentTextIcon}>Documentos</NavButton>
        <NavButton to="/relatorios" icon={ChartBarIcon}>Relatórios</NavButton>
        <div className="mt-auto pt-3 border-top">
           <button
            onClick={handleLogout}
            className="btn btn-outline-danger w-100 d-flex align-items-center text-start mb-1"
            title="Sair do Sistema"
          >
            <ArrowLeftOnRectangleIcon className="me-2" style={{ width: '18px', height: '18px' }} />
            <span className="ms-1">Sair</span>
          </button>
          <p className="text-muted small text-center mt-2">&copy; {new Date().getFullYear()} ALG Jurídico</p>
        </div>
      </aside>
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">
        <header className="bg-white shadow-sm border-bottom p-3">
          <h1 className="h5 mb-0 text-capitalize">{getPageTitle()}</h1>
        </header>
        <main className="flex-grow-1 overflow-auto p-4" style={{ backgroundColor: '#f8f9fa' }}>
          {console.log("MainLayout: Outlet a ser renderizado.")}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

function App() {
  console.log("Componente App renderizado.");
  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      <Routes>
        {/* Rota de Login fora do MainLayout */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rotas Protegidas que usam MainLayout */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} /> {/* Redireciona / para /dashboard */}
          <Route path="dashboard" element={<DashboardPage />} />
          
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/novo" element={<ClientesPage />} />
          <Route path="clientes/editar/:clienteId" element={<ClientesPage />} />
          
          <Route path="casos" element={<CasosPage />} />
          <Route path="casos/novo" element={<CasosPage />} />
          <Route path="casos/editar/:casoId" element={<CasosPage />} />
          <Route path="casos/detalhe/:casoId" element={<CasoDetalhePage />} /> {/* Adicionada rota de detalhe */}


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