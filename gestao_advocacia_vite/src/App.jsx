// src/App.jsx
// Componente principal da aplicação React com React Router.

import React from 'react';
import { Routes, Route, NavLink, Outlet } from 'react-router-dom'; // Removido useNavigate, useParams não usados diretamente aqui

// Importação do Toastify
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "bootstrap-icons/font/bootstrap-icons.css";

// Importação dos componentes de página
import DashboardPage from './pages/DashboardPage.jsx';
import ClientesPage from './pages/ClientesPage.jsx';
import CasosPage from './pages/CasosPage.jsx';
import RecebimentosPage from './pages/RecebimentosPage.jsx';
import DespesasPage from './pages/DespesasPage.jsx'; // Corrigido o nome do arquivo se você chamou de "DepesasPage"
import AgendaPage from './pages/AgendaPage.jsx';
import DocumentosPage from './pages/DocumentosPage.jsx';
import RelatoriosPage from './pages/RelatoriosPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx'; // Esta é a importação problemática

// Importação dos ícones da biblioteca Heroicons
import {
  HomeIcon,
  UsersIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';

// Layout principal que inclui a sidebar e o header
const MainLayout = () => {
  // Para obter o título da página de forma reativa, use useLocation
  // import { useLocation } from 'react-router-dom';
  // const location = useLocation();
  // const getPageTitle = () => { ... lógica baseada em location.pathname ... }
  // Por simplicidade, mantendo a versão anterior por enquanto:
  const { pathname } = window.location;
  const getPageTitle = () => {
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length === 0 || pathParts[0] === 'dashboard' || pathParts[0] === '') return 'Dashboard';
    if (pathParts[0] === 'clientes' && pathParts[1] === 'novo') return 'Novo Cliente';
    if (pathParts[0] === 'clientes' && pathParts[1] === 'editar') return 'Editar Cliente';
    if (pathParts[0] === 'casos' && pathParts[1] === 'novo') return 'Novo Caso';
    if (pathParts[0] === 'casos' && pathParts[1] === 'editar') return 'Editar Caso';
    if (pathParts[0] === 'recebimentos' && pathParts[1] === 'novo') return 'Novo Recebimento';
    if (pathParts[0] === 'recebimentos' && pathParts[1] === 'editar') return 'Editar Recebimento';
    if (pathParts[0] === 'despesas' && pathParts[1] === 'novo') return 'Nova Despesa';
    if (pathParts[0] === 'despesas' && pathParts[1] === 'editar') return 'Editar Despesa';
    if (pathParts[0] === 'agenda' && pathParts[1] === 'novo') return 'Novo Evento';
    if (pathParts[0] === 'agenda' && pathParts[1] === 'editar') return 'Editar Evento';
    if (pathParts[0] === 'documentos' && pathParts[1] === 'novo') return 'Novo Documento';
    if (pathParts[0] === 'documentos' && pathParts[1] === 'editar') return 'Editar Documento';
    
    // Garante que o título seja capitalizado corretamente
    const title = pathParts[0] ? pathParts[0].replace('-', ' ') : 'Página';
    return title.charAt(0).toUpperCase() + title.slice(1);
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
        <div className="h3 text-primary mb-4 text-center pt-2">
          Gestão ADV
        </div>
        <NavButton to="/dashboard" icon={HomeIcon}>Dashboard</NavButton>
        <NavButton to="/clientes" icon={UsersIcon}>Clientes</NavButton>
        <NavButton to="/casos" icon={BriefcaseIcon}>Casos</NavButton>
        <NavButton to="/recebimentos" icon={CurrencyDollarIcon}>Recebimentos</NavButton>
        <NavButton to="/despesas" icon={CreditCardIcon}>Despesas</NavButton>
        <NavButton to="/agenda" icon={CalendarDaysIcon}>Agenda</NavButton>
        <NavButton to="/documentos" icon={DocumentTextIcon}>Documentos</NavButton>
        <NavButton to="/relatorios" icon={ChartBarIcon}>Relatórios</NavButton>

        <div className="mt-auto pt-3 border-top">
          <p className="text-muted small text-center">
            App Gestão ADV <br />
            &copy; {new Date().getFullYear()}
          </p>
        </div>
      </aside>

      <div className="flex-grow-1 d-flex flex-column overflow-hidden">
        <header className="bg-white shadow-sm border-bottom p-3">
          <h1 className="h5 mb-0 text-capitalize">
             {getPageTitle()}
          </h1>
        </header>

        <main className="flex-grow-1 overflow-auto p-4" style={{ backgroundColor: '#f8f9fa' }}>
          <Outlet /> {/* Componentes da rota aninhada serão renderizados aqui */}
        </main>
      </div>
    </div>
  );
};


function App() {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
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
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />

          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/novo" element={<ClientesPage />} /> 
          <Route path="clientes/editar/:clienteId" element={<ClientesPage />} />
          
          <Route path="casos" element={<CasosPage />} />
          <Route path="casos/novo" element={<CasosPage />} />
          <Route path="casos/editar/:casoId" element={<CasosPage />} />

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
