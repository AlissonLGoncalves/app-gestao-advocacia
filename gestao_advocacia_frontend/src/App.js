// ==================================================
// Conteúdo do arquivo: src/App.js 
// (Atualizado para incluir Documentos na navegação e renderização)
// ==================================================
import React, { useState, useCallback } from 'react'; 
import ClienteList from './ClienteList'; 
import ClienteForm from './ClienteForm'; 
import CasoList from './CasoList'; 
import CasoForm from './CasoForm'; 
import RecebimentoList from './RecebimentoList'; 
import RecebimentoForm from './RecebimentoForm'; 
import DespesaList from './DespesaList'; 
import DespesaForm from './DespesaForm'; 
import EventoAgendaList from './EventoAgendaList'; 
import EventoAgendaForm from './EventoAgendaForm'; 
import Dashboard from './Dashboard'; 
import RelatoriosPage from './RelatoriosPage';
import DocumentoList from './DocumentoList'; // <<< NOVO IMPORT
import DocumentoForm from './DocumentoForm'; // <<< NOVO IMPORT
import './App.css'; // Certifique-se que este arquivo existe na pasta src

const SECOES = { 
  DASHBOARD: 'dashboard', 
  CLIENTES: 'clientes', 
  CASOS: 'casos', 
  RECEBIMENTOS: 'recebimentos', 
  DESPESAS: 'despesas', 
  AGENDA: 'agenda', 
  RELATORIOS: 'relatorios',
  DOCUMENTOS: 'documentos', // <<< NOVA SEÇÃO
};

function App() {
  const [secaoAtiva, setSecaoAtiva] = useState(SECOES.DASHBOARD); 
  const [mostrarFormulario, setMostrarFormulario] = useState(false); 
  const [itemParaEditar, setItemParaEditar] = useState(null); 
  const [refreshKey, setRefreshKey] = useState(0); 

  const handleItemChange = useCallback(() => { 
    setRefreshKey(prevKey => prevKey + 1); 
    setMostrarFormulario(false); 
    setItemParaEditar(null); 
    console.log(`App: Item na seção ${secaoAtiva} alterado, atualizando lista/dashboard...`); 
  }, [secaoAtiva]); 

  const handleAdicionarClick = () => { 
    setItemParaEditar(null); 
    setMostrarFormulario(true); 
  };

  const handleEditarClick = useCallback((item) => { 
    console.log(`App: Editando item na seção ${secaoAtiva}`, item); 
    setItemParaEditar(item); 
    setMostrarFormulario(true); 
  }, [secaoAtiva]);

  const handleCancelarForm = () => { 
    setItemParaEditar(null); 
    setMostrarFormulario(false); 
  };

  const mudarSecao = (novaSecao) => { 
    setSecaoAtiva(novaSecao); 
    setMostrarFormulario(false); 
    setItemParaEditar(null); 
    setRefreshKey(prevKey => prevKey + 1); 
  };

  const renderizarFormulario = () => { 
      if (secaoAtiva === SECOES.DASHBOARD || secaoAtiva === SECOES.RELATORIOS) return null; 
      switch (secaoAtiva) {
          case SECOES.CLIENTES: return <ClienteForm clienteParaEditar={itemParaEditar} onClienteChange={handleItemChange} onCancel={handleCancelarForm} />;
          case SECOES.CASOS: return <CasoForm casoParaEditar={itemParaEditar} onCasoChange={handleItemChange} onCancel={handleCancelarForm} />;
          case SECOES.RECEBIMENTOS: return <RecebimentoForm recebimentoParaEditar={itemParaEditar} onRecebimentoChange={handleItemChange} onCancel={handleCancelarForm} />;
          case SECOES.DESPESAS: return <DespesaForm despesaParaEditar={itemParaEditar} onDespesaChange={handleItemChange} onCancel={handleCancelarForm} />;
          case SECOES.AGENDA: return <EventoAgendaForm eventoParaEditar={itemParaEditar} onEventoChange={handleItemChange} onCancel={handleCancelarForm} />;
          case SECOES.DOCUMENTOS: return <DocumentoForm onDocumentoChange={handleItemChange} onCancel={handleCancelarForm} />; 
          default: return null;
      }
  };
  
  const renderizarConteudoPrincipal = () => { 
      const key = `${secaoAtiva}-${refreshKey}`; 
      switch (secaoAtiva) {
          case SECOES.DASHBOARD: return <Dashboard key={key} />; 
          case SECOES.CLIENTES: return <ClienteList key={key} onEditCliente={handleEditarClick} onClienteChange={handleItemChange} />;
          case SECOES.CASOS: return <CasoList key={key} onEditCaso={handleEditarClick} onCasoChange={handleItemChange} />;
          case SECOES.RECEBIMENTOS: return <RecebimentoList key={key} onEditRecebimento={handleEditarClick} onRecebimentoChange={handleItemChange} />;
          case SECOES.DESPESAS: return <DespesaList key={key} onEditDespesa={handleEditarClick} onDespesaChange={handleItemChange} />;
          case SECOES.AGENDA: return <EventoAgendaList key={key} onEditEvento={handleEditarClick} onEventoChange={handleItemChange} />;
          case SECOES.RELATORIOS: return <RelatoriosPage key={key} />; 
          case SECOES.DOCUMENTOS: return <DocumentoList key={key} onDocumentoChange={handleItemChange} />; 
          default: return <p>Selecione uma seção.</p>;
      }
  };
  
  const navButtonStyle = "px-4 py-2 rounded-md mr-2 text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500";
  const activeNavButtonStyle = "bg-indigo-600 text-white"; 
  const inactiveNavButtonStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300";
  
  return (
    <div className="App container mx-auto p-4"> 
      <header className="App-header mb-6"><h1 className="text-3xl font-bold text-gray-800 text-center">Gestão Advocacia</h1></header>
      <nav className="mb-8 flex justify-center flex-wrap gap-2"> 
        <button onClick={() => mudarSecao(SECOES.DASHBOARD)} className={`${navButtonStyle} ${secaoAtiva === SECOES.DASHBOARD ? activeNavButtonStyle : inactiveNavButtonStyle}`}>Dashboard</button>
        <button onClick={() => mudarSecao(SECOES.CLIENTES)} className={`${navButtonStyle} ${secaoAtiva === SECOES.CLIENTES ? activeNavButtonStyle : inactiveNavButtonStyle}`}>Clientes</button>
        <button onClick={() => mudarSecao(SECOES.CASOS)} className={`${navButtonStyle} ${secaoAtiva === SECOES.CASOS ? activeNavButtonStyle : inactiveNavButtonStyle}`}>Casos</button>
        <button onClick={() => mudarSecao(SECOES.RECEBIMENTOS)} className={`${navButtonStyle} ${secaoAtiva === SECOES.RECEBIMENTOS ? activeNavButtonStyle : inactiveNavButtonStyle}`}>Recebimentos</button>
        <button onClick={() => mudarSecao(SECOES.DESPESAS)} className={`${navButtonStyle} ${secaoAtiva === SECOES.DESPESAS ? activeNavButtonStyle : inactiveNavButtonStyle}`}>Despesas</button>
        <button onClick={() => mudarSecao(SECOES.AGENDA)} className={`${navButtonStyle} ${secaoAtiva === SECOES.AGENDA ? activeNavButtonStyle : inactiveNavButtonStyle}`}>Agenda</button>
        <button onClick={() => mudarSecao(SECOES.RELATORIOS)} className={`${navButtonStyle} ${secaoAtiva === SECOES.RELATORIOS ? activeNavButtonStyle : inactiveNavButtonStyle}`}>Relatórios</button> 
        <button onClick={() => mudarSecao(SECOES.DOCUMENTOS)} className={`${navButtonStyle} ${secaoAtiva === SECOES.DOCUMENTOS ? activeNavButtonStyle : inactiveNavButtonStyle}`}>Documentos</button> 
      </nav>
      <main>
        {!mostrarFormulario && secaoAtiva !== SECOES.DASHBOARD && secaoAtiva !== SECOES.RELATORIOS && (
          <div className="text-center mb-6"><button onClick={handleAdicionarClick} className="btn btn-primary"><i className="fas fa-plus mr-2"></i>Adicionar Novo(a) {secaoAtiva === SECOES.DOCUMENTOS ? 'Documento' : secaoAtiva.charAt(0).toUpperCase() + secaoAtiva.slice(1, -1)}</button></div>
        )}
        {mostrarFormulario && secaoAtiva !== SECOES.DASHBOARD && secaoAtiva !== SECOES.RELATORIOS && renderizarFormulario()}
        {(!mostrarFormulario || (secaoAtiva !== SECOES.DASHBOARD && secaoAtiva !== SECOES.RELATORIOS)) && <hr className="my-8 border-t border-gray-300" /> }
        {renderizarConteudoPrincipal()}
      </main>
      <footer className="text-center mt-8 text-gray-500 text-sm"><p>&copy; {new Date().getFullYear()} Sua Aplicação de Gestão</p></footer>
    </div>
  );
}
export default App;

