// src/App.jsx
// Componente principal da aplicação React.
// Gere a navegação e renderiza o conteúdo da seção ativa.
// Garante que o formulário correto é renderizado para cada seção.

import React, { useState, useCallback } from 'react';

// Importação do Toastify
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // CSS do Toastify

// Importação dos componentes de cada seção
import ClienteList from './ClienteList.jsx';
import ClienteForm from './ClienteForm.jsx';
import CasoList from './CasoList.jsx';
import CasoForm from './CasoForm.jsx';
import RecebimentoList from './RecebimentoList.jsx';
import RecebimentoForm from './RecebimentoForm.jsx';
import DespesaList from './DespesaList.jsx';
import DespesaForm from './DespesaForm.jsx';
import EventoAgendaList from './EventoAgendaList.jsx';
import EventoAgendaForm from './EventoAgendaForm.jsx';
import Dashboard from './Dashboard.jsx';
import RelatoriosPage from './RelatoriosPage.jsx';
import DocumentoList from './DocumentoList.jsx';
import DocumentoForm from './DocumentoForm.jsx';

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

// Constantes para identificar as seções da aplicação
export const SECOES = { 
  DASHBOARD: 'DASHBOARD',
  CLIENTES: 'CLIENTES',
  CASOS: 'CASOS',
  RECEBIMENTOS: 'RECEBIMENTOS',
  DESPESAS: 'DESPESAS',
  AGENDA: 'AGENDA',
  DOCUMENTOS: 'DOCUMENTOS',
  RELATORIOS: 'RELATORIOS',
};

function App() {
  const [secaoAtiva, setSecaoAtiva] = useState(SECOES.DASHBOARD);
  const [itemParaEditar, setItemParaEditar] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const mudarSecao = useCallback((secao) => { 
    setSecaoAtiva(secao);
    setItemParaEditar(null);
    setMostrarFormulario(false);
  }, []); 

  const handleEditarClick = (item, secaoEspecifica = null) => {
    const secaoAlvo = secaoEspecifica || secaoAtiva;
    if (Object.values(SECOES).includes(secaoAlvo) && secaoAlvo !== SECOES.DASHBOARD && secaoAlvo !== SECOES.RELATORIOS) {
      setItemParaEditar(item);
      setMostrarFormulario(true);
    }
  };

  const handleAdicionarClick = () => {
    if (Object.values(SECOES).includes(secaoAtiva) && secaoAtiva !== SECOES.DASHBOARD && secaoAtiva !== SECOES.RELATORIOS) {
      setItemParaEditar(null);
      setMostrarFormulario(true);
    }
  };
  
  const handleFormularioFechado = useCallback(() => {
    setMostrarFormulario(false);
    setItemParaEditar(null);
    setRefreshKey(prevKey => prevKey + 1); 
  }, []);

  const renderizarConteudoPrincipal = () => {
    const propsComunsForm = {
        onCancel: () => { setMostrarFormulario(false); setItemParaEditar(null); }
    };

    if (mostrarFormulario) {
      switch (secaoAtiva) { // ESTE SWITCH É CRUCIAL
        case SECOES.CLIENTES:
          return <ClienteForm clienteParaEditar={itemParaEditar} onClienteChange={handleFormularioFechado} {...propsComunsForm} />;
        case SECOES.CASOS:
          return <CasoForm casoParaEditar={itemParaEditar} onCasoChange={handleFormularioFechado} {...propsComunsForm} />;
        case SECOES.RECEBIMENTOS:
          return <RecebimentoForm recebimentoParaEditar={itemParaEditar} onRecebimentoChange={handleFormularioFechado} {...propsComunsForm} />;
        case SECOES.DESPESAS:
          return <DespesaForm despesaParaEditar={itemParaEditar} onDespesaChange={handleFormularioFechado} {...propsComunsForm} />;
        case SECOES.AGENDA:
          return <EventoAgendaForm eventoParaEditar={itemParaEditar} onEventoChange={handleFormularioFechado} {...propsComunsForm} />;
        case SECOES.DOCUMENTOS: // Garante que DocumentoForm é chamado para a seção DOCUMENTOS
          return <DocumentoForm documentoParaEditar={itemParaEditar} onDocumentoChange={handleFormularioFechado} {...propsComunsForm} />;
        default:
          return null;
      }
    }

    const BotaoAdicionar = ({ texto }) => (
      <button 
        onClick={handleAdicionarClick} 
        className="btn btn-primary mb-3 d-flex align-items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="me-2" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        {texto}
      </button>
    );

    switch (secaoAtiva) {
      case SECOES.DASHBOARD:
        return <Dashboard mudarSecao={mudarSecao} />; 
      case SECOES.CLIENTES:
        return (
          <>
            {!mostrarFormulario && <BotaoAdicionar texto="Adicionar Novo Cliente" />}
            <ClienteList key={refreshKey} onEditCliente={(cliente) => handleEditarClick(cliente, SECOES.CLIENTES)} />
          </>
        );
      case SECOES.CASOS:
        return (
          <>
            {!mostrarFormulario && <BotaoAdicionar texto="Adicionar Novo Caso" />}
            <CasoList key={refreshKey} onEditCaso={(caso) => handleEditarClick(caso, SECOES.CASOS)} />
          </>
        );
      case SECOES.RECEBIMENTOS:
        return (
          <>
            {!mostrarFormulario && <BotaoAdicionar texto="Adicionar Novo Recebimento" />}
            <RecebimentoList key={refreshKey} onEditRecebimento={(item) => handleEditarClick(item, SECOES.RECEBIMENTOS)} />
          </>
        );
      case SECOES.DESPESAS:
         return (
          <>
            {!mostrarFormulario && <BotaoAdicionar texto="Adicionar Nova Despesa" />}
            <DespesaList key={refreshKey} onEditDespesa={(item) => handleEditarClick(item, SECOES.DESPESAS)} />
          </>
        );
      case SECOES.AGENDA:
        return (
          <>
            {!mostrarFormulario && <BotaoAdicionar texto="Adicionar Novo Evento" />}
            <EventoAgendaList key={refreshKey} onEditEvento={(item) => handleEditarClick(item, SECOES.AGENDA)} />
          </>
        );
      case SECOES.DOCUMENTOS:
        return (
          <>
            {!mostrarFormulario && <BotaoAdicionar texto="Adicionar Novo Documento" />}
            <DocumentoList key={refreshKey} onEditDocumento={(doc) => handleEditarClick(doc, SECOES.DOCUMENTOS)} />
          </>
        );
      case SECOES.RELATORIOS:
        return <RelatoriosPage />;
      default:
        return <div className="text-center text-muted mt-5">Selecione uma seção no menu.</div>;
    }
  };

  const NavButton = ({ secao, icon: IconComponent, children }) => (
    <button
      onClick={() => mudarSecao(secao)}
      className={`btn w-100 d-flex align-items-center text-start mb-1 ${secaoAtiva === secao ? 'btn-primary active' : 'btn-light'}`}
      title={children}
    >
      <IconComponent className="me-2" style={{ width: '18px', height: '18px' }} />
      <span className="ms-1">{children}</span>
    </button>
  );

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
      <div className="d-flex vh-100">
        <aside className="bg-light border-end p-3 d-flex flex-column" style={{ width: '250px', flexShrink: 0 }}>
          <div className="h3 text-primary mb-4 text-center pt-2">
            Gestão ADV
          </div>
          <NavButton secao={SECOES.DASHBOARD} icon={HomeIcon}>Dashboard</NavButton>
          <NavButton secao={SECOES.CLIENTES} icon={UsersIcon}>Clientes</NavButton>
          <NavButton secao={SECOES.CASOS} icon={BriefcaseIcon}>Casos</NavButton>
          <NavButton secao={SECOES.RECEBIMENTOS} icon={CurrencyDollarIcon}>Recebimentos</NavButton>
          <NavButton secao={SECOES.DESPESAS} icon={CreditCardIcon}>Despesas</NavButton>
          <NavButton secao={SECOES.AGENDA} icon={CalendarDaysIcon}>Agenda</NavButton>
          <NavButton secao={SECOES.DOCUMENTOS} icon={DocumentTextIcon}>Documentos</NavButton>
          <NavButton secao={SECOES.RELATORIOS} icon={ChartBarIcon}>Relatórios</NavButton>
          
          <div className="mt-auto pt-3 border-top">
              <p className="text-muted small text-center">
                  App Gestão ADV <br/>
                  &copy; {new Date().getFullYear()}
              </p>
          </div>
        </aside>

        <div className="flex-grow-1 d-flex flex-column overflow-hidden">
          <header className="bg-white shadow-sm border-bottom p-3">
              <h1 className="h5 mb-0 text-capitalize">
                {secaoAtiva.toLowerCase().replace('_', ' ')} 
              </h1>
          </header>
          
          <main className="flex-grow-1 overflow-auto p-4" style={{backgroundColor: '#f8f9fa'}}>
            {renderizarConteudoPrincipal()}
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
