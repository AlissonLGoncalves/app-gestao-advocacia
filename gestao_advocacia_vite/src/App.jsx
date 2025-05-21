// CAMINHO: gestao_advocacia_vite/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config';
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
import DocumentoList from './DocumentoList'; // Importação para estrutura
import DocumentoForm from './DocumentoForm';   // Importação para estrutura
import RelatoriosPage from './RelatoriosPage'; // Importação para estrutura

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css'; 
import 'bootstrap-icons/font/bootstrap-icons.css';


function App() {
    // Estados para Clientes
    const [clientes, setClientes] = useState([]);
    const [clienteToEdit, setClienteToEdit] = useState(null);
    const [searchTermCliente, setSearchTermCliente] = useState('');
    const [tipoPessoaFilter, setTipoPessoaFilter] = useState('');

    // Estados para Casos
    const [casos, setCasos] = useState([]);
    const [casoToEdit, setCasoToEdit] = useState(null);
    const [searchTermCaso, setSearchTermCaso] = useState('');
    const [statusCasoFilter, setStatusCasoFilter] = useState('');
    const [clienteCasoFilter, setClienteCasoFilter] = useState('');

    // Estados para Recebimentos
    const [recebimentos, setRecebimentos] = useState([]);
    const [recebimentoToEdit, setRecebimentoToEdit] = useState(null);
    const [searchTermRecebimento, setSearchTermRecebimento] = useState('');
    const [statusRecebimentoFilter, setStatusRecebimentoFilter] = useState('');
    const [clienteRecebimentoFilter, setClienteRecebimentoFilter] = useState('');
    const [casoRecebimentoFilter, setCasoRecebimentoFilter] = useState('');

    // Estados para Despesas
    const [despesas, setDespesas] = useState([]);
    const [despesaToEdit, setDespesaToEdit] = useState(null);
    const [searchTermDespesa, setSearchTermDespesa] = useState('');
    const [statusDespesaFilter, setStatusDespesaFilter] = useState('');
    const [casoDespesaFilter, setCasoDespesaFilter] = useState('');

    // Estados para Eventos da Agenda
    const [eventos, setEventos] = useState([]);
    const [eventoToEdit, setEventoToEdit] = useState(null);
    const [searchTermEvento, setSearchTermEvento] = useState('');
    const [tipoEventoFilter, setTipoEventoFilter] = useState('');
    const [concluidoEventoFilter, setConcluidoEventoFilter] = useState(''); 
    const [casoEventoFilter, setCasoEventoFilter] = useState('');

    // Estados para Documentos (Estrutura inicial)
    const [documentos, setDocumentos] = useState([]);
    const [documentoToEdit, setDocumentoToEdit] = useState(null); // Para edição de metadados
    const [searchTermDocumento, setSearchTermDocumento] = useState('');
    const [clienteDocumentoFilter, setClienteDocumentoFilter] = useState('');
    const [casoDocumentoFilter, setCasoDocumentoFilter] = useState('');


    const [currentView, setCurrentView] = useState('dashboard');
    const [isLoading, setIsLoading] = useState(false);


    // --- Funções de Fetch ---
    const fetchClientes = useCallback(async () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (searchTermCliente) params.append('search', searchTermCliente);
        if (tipoPessoaFilter) params.append('tipo_pessoa', tipoPessoaFilter);
        try {
            const response = await fetch(`${API_URL}/clientes?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setClientes(data.clientes || []);
        } catch (error) {
            console.error("Erro ao buscar clientes:", error);
            toast.error("Falha ao carregar clientes.");
            setClientes([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTermCliente, tipoPessoaFilter]);

    const fetchCasos = useCallback(async (forceNoClienteFilter = false, forFilters = false) => {
        if(!forFilters) setIsLoading(true);
        const params = new URLSearchParams();
        if (searchTermCaso && !forFilters) params.append('search', searchTermCaso);
        if (statusCasoFilter && !forFilters) params.append('status', statusCasoFilter);
        if (clienteCasoFilter && !forceNoClienteFilter && !forFilters) params.append('cliente_id', clienteCasoFilter);
        if (forFilters && clienteCasoFilter) params.append('cliente_id', clienteCasoFilter);

        try {
            const response = await fetch(`${API_URL}/casos?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setCasos(data.casos || []);
        } catch (error) {
            console.error("Erro ao buscar casos:", error);
            if(!forFilters) toast.error("Falha ao carregar casos.");
            setCasos([]);
        } finally {
            if(!forFilters) setIsLoading(false);
        }
    }, [searchTermCaso, statusCasoFilter, clienteCasoFilter]);

    const fetchRecebimentos = useCallback(async () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (searchTermRecebimento) params.append('search', searchTermRecebimento);
        if (statusRecebimentoFilter) params.append('status', statusRecebimentoFilter);
        if (clienteRecebimentoFilter) params.append('cliente_id', clienteRecebimentoFilter);
        if (casoRecebimentoFilter) params.append('caso_id', casoRecebimentoFilter);
        try {
            const response = await fetch(`${API_URL}/recebimentos?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setRecebimentos(data.recebimentos || []);
        } catch (error) {
            console.error("Erro ao buscar recebimentos:", error);
            toast.error("Falha ao carregar recebimentos.");
            setRecebimentos([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTermRecebimento, statusRecebimentoFilter, clienteRecebimentoFilter, casoRecebimentoFilter]);

    const fetchDespesas = useCallback(async () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (searchTermDespesa) params.append('search', searchTermDespesa);
        if (statusDespesaFilter) params.append('status', statusDespesaFilter);
        if (casoDespesaFilter) params.append('caso_id', casoDespesaFilter);
        try {
            const response = await fetch(`${API_URL}/despesas?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setDespesas(data.despesas || []);
        } catch (error) {
            console.error("Erro ao buscar despesas:", error);
            toast.error("Falha ao carregar despesas.");
            setDespesas([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTermDespesa, statusDespesaFilter, casoDespesaFilter]);

    const fetchEventos = useCallback(async () => { 
        setIsLoading(true);
        const params = new URLSearchParams();
        if (searchTermEvento) params.append('search', searchTermEvento);
        if (tipoEventoFilter) params.append('tipo_evento', tipoEventoFilter);
        if (concluidoEventoFilter !== '') params.append('concluido', concluidoEventoFilter);
        if (casoEventoFilter) params.append('caso_id', casoEventoFilter);
        try {
            const response = await fetch(`${API_URL}/eventos?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setEventos(data.eventos || []);
        } catch (error) {
            console.error("Erro ao buscar eventos:", error);
            toast.error("Falha ao carregar eventos da agenda.");
            setEventos([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTermEvento, tipoEventoFilter, concluidoEventoFilter, casoEventoFilter]);

    const fetchDocumentos = useCallback(async () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (searchTermDocumento) params.append('search', searchTermDocumento);
        if (clienteDocumentoFilter) params.append('cliente_id', clienteDocumentoFilter);
        if (casoDocumentoFilter) params.append('caso_id', casoDocumentoFilter);
        try {
            const response = await fetch(`${API_URL}/documentos?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setDocumentos(data.documentos || []);
        } catch (error) {
            console.error("Erro ao buscar documentos:", error);
            toast.error("Falha ao carregar documentos.");
            setDocumentos([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTermDocumento, clienteDocumentoFilter, casoDocumentoFilter]);


    useEffect(() => {
        if (currentView === 'clientesList') {
            fetchClientes();
        } else if (currentView === 'casosList') {
            fetchCasos();
            if (clientes.length === 0) fetchClientes(); 
        } else if (currentView === 'recebimentosList') {
            fetchRecebimentos();
            if (clientes.length === 0) fetchClientes(); 
            if (casos.length === 0) fetchCasos(false, true); 
        } else if (currentView === 'despesasList') { 
            fetchDespesas();
            if (casos.length === 0) fetchCasos(false, true); 
        } else if (currentView === 'eventosList') { 
            fetchEventos();
            if (casos.length === 0) fetchCasos(false, true); 
        } else if (currentView === 'documentosList') { 
            fetchDocumentos();
            if (clientes.length === 0) fetchClientes();
            if (casos.length === 0) fetchCasos(false, true);
        }
        // Não há fetch para 'relatoriosPage' aqui, pois os dados são buscados dentro do componente RelatoriosPage
    }, [currentView, fetchClientes, fetchCasos, fetchRecebimentos, fetchDespesas, fetchEventos, fetchDocumentos, clientes.length, casos.length]);

    // --- Manipuladores de Submissão de Formulário ---
    const handleClienteFormSubmit = (clienteSalvo) => {
        fetchClientes(); 
        setCurrentView('clientesList');
        setClienteToEdit(null);
    };
    
    const handleCasoFormSubmit = (casoSalvo) => {
        fetchCasos(); 
        setCurrentView('casosList');
        setCasoToEdit(null);
    };

    const handleRecebimentoFormSubmit = (recebimentoSalvo) => {
        fetchRecebimentos();
        setCurrentView('recebimentosList');
        setRecebimentoToEdit(null);
    };

    const handleDespesaFormSubmit = (despesaSalva) => { 
        fetchDespesas();
        setCurrentView('despesasList');
        setDespesaToEdit(null);
    };

    const handleEventoFormSubmit = (eventoSalvo) => { 
        fetchEventos();
        setCurrentView('eventosList');
        setEventoToEdit(null);
    };

    const handleDocumentoFormSubmit = (documentoSalvo) => { 
        fetchDocumentos();
        setCurrentView('documentosList');
        setDocumentoToEdit(null); 
    };


    // --- Manipuladores de Edição ---
    const handleEditCliente = (cliente) => {
        setClienteToEdit(cliente);
        setCurrentView('clienteForm');
    };
    const handleEditCaso = (caso) => {
        setCasoToEdit(caso);
        setCurrentView('casoForm');
    };
    const handleEditRecebimento = (recebimento) => {
        setRecebimentoToEdit(recebimento);
        setCurrentView('recebimentoForm');
    };
    const handleEditDespesa = (despesa) => { 
        setDespesaToEdit(despesa);
        setCurrentView('despesaForm');
    };
    const handleEditEvento = (evento) => { 
        setEventoToEdit(evento);
        setCurrentView('eventoForm');
    };
    const handleEditDocumento = (documento) => { 
        setDocumentoToEdit(documento);
        setCurrentView('documentoForm');
    };


    // --- Manipuladores de Deleção ---
    const handleDeleteCliente = async (id) => {
        if (window.confirm('Tem certeza que deseja deletar este cliente? Casos e outros registros associados também podem ser afetados.')) {
            try {
                setIsLoading(true);
                const response = await fetch(`${API_URL}/clientes/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    toast.success('Cliente deletado com sucesso!');
                    fetchClientes(); 
                } else {
                    const result = await response.json();
                    toast.error(result.erro || 'Erro ao deletar cliente.');
                }
            } catch (error) {
                toast.error('Erro de conexão ao deletar cliente.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDeleteCaso = async (id) => {
        if (window.confirm('Tem certeza que deseja deletar este caso?')) {
            try {
                setIsLoading(true);
                const response = await fetch(`${API_URL}/casos/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    toast.success('Caso deletado com sucesso!');
                    fetchCasos(); 
                } else {
                    const result = await response.json();
                    toast.error(result.erro || 'Erro ao deletar caso.');
                }
            } catch (error) {
                toast.error('Erro de conexão ao deletar caso.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDeleteRecebimento = async (id) => {
        if (window.confirm('Tem certeza que deseja deletar este recebimento?')) {
            try {
                setIsLoading(true);
                const response = await fetch(`${API_URL}/recebimentos/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    toast.success('Recebimento deletado com sucesso!');
                    fetchRecebimentos();
                } else {
                    const result = await response.json();
                    toast.error(result.erro || 'Erro ao deletar recebimento.');
                }
            } catch (error) {
                toast.error('Erro de conexão ao deletar recebimento.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDeleteDespesa = async (id) => { 
        if (window.confirm('Tem certeza que deseja deletar esta despesa?')) {
            try {
                setIsLoading(true);
                const response = await fetch(`${API_URL}/despesas/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    toast.success('Despesa deletada com sucesso!');
                    fetchDespesas();
                } else {
                    const result = await response.json();
                    toast.error(result.erro || 'Erro ao deletar despesa.');
                }
            } catch (error) {
                toast.error('Erro de conexão ao deletar despesa.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDeleteEvento = async (id) => { 
        if (window.confirm('Tem certeza que deseja deletar este evento da agenda?')) {
            try {
                setIsLoading(true);
                const response = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    toast.success('Evento deletado com sucesso!');
                    fetchEventos();
                } else {
                    const result = await response.json();
                    toast.error(result.erro || 'Erro ao deletar evento.');
                }
            } catch (error) {
                toast.error('Erro de conexão ao deletar evento.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleDeleteDocumento = async (id) => { // NOVO
        if (window.confirm('Tem certeza que deseja deletar este documento? O arquivo físico também será removido.')) {
            try {
                setIsLoading(true);
                const response = await fetch(`${API_URL}/documentos/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    toast.success('Documento deletado com sucesso!');
                    fetchDocumentos();
                } else {
                    const result = await response.json();
                    toast.error(result.erro || 'Erro ao deletar documento.');
                }
            } catch (error) {
                toast.error('Erro de conexão ao deletar documento.');
            } finally {
                setIsLoading(false);
            }
        }
    };
    
    // --- Navegação ---
    const renderView = () => {
        switch (currentView) {
            case 'dashboard':
                return <div><h2>Dashboard</h2><p>Bem-vindo ao sistema de Gestão de Advocacia!</p></div>;
            case 'clientesList':
                return (
                    <>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2>Lista de Clientes</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => { setClienteToEdit(null); setCurrentView('clienteForm'); }}>
                                <i className="bi bi-plus-circle me-1"></i> Adicionar Cliente
                            </button>
                        </div>
                        <div className="row mb-3 gx-2">
                            <div className="col-md-8"><input type="text" className="form-control form-control-sm" placeholder="Buscar por nome, CPF/CNPJ..." value={searchTermCliente} onChange={(e) => setSearchTermCliente(e.target.value)} /></div>
                            <div className="col-md-4">
                                <select className="form-select form-select-sm" value={tipoPessoaFilter} onChange={(e) => setTipoPessoaFilter(e.target.value)}>
                                    <option value="">Todos os Tipos</option><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option>
                                </select>
                            </div>
                        </div>
                        {isLoading ? <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div></div> : <ClienteList clientes={clientes} onEdit={handleEditCliente} onDelete={handleDeleteCliente} onSelectCliente={(id) => console.log("Selecionar cliente ID:", id)} />}
                    </>
                );
            case 'clienteForm':
                return <ClienteForm clienteToEdit={clienteToEdit} onFormSubmit={handleClienteFormSubmit} onCancel={() => { setCurrentView('clientesList'); setClienteToEdit(null); }} />;
            
            case 'casosList':
                return (
                    <>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2>Lista de Casos</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => { setCasoToEdit(null); setCurrentView('casoForm'); }}>
                                <i className="bi bi-plus-circle me-1"></i> Adicionar Caso
                            </button>
                        </div>
                        <div className="row mb-3 gx-2">
                            <div className="col-md-4"><input type="text" className="form-control form-control-sm" placeholder="Buscar por título, nº processo..." value={searchTermCaso} onChange={(e) => setSearchTermCaso(e.target.value)} /></div>
                            <div className="col-md-4">
                                <select className="form-select form-select-sm" value={clienteCasoFilter} onChange={(e) => setClienteCasoFilter(e.target.value)}>
                                    <option value="">Todos os Clientes</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <select className="form-select form-select-sm" value={statusCasoFilter} onChange={(e) => setStatusCasoFilter(e.target.value)}>
                                    <option value="">Todos os Status</option>
                                    <option value="Ativo">Ativo</option><option value="Pendente">Pendente</option><option value="Suspenso">Suspenso</option><option value="Encerrado">Encerrado</option><option value="Arquivado">Arquivado</option>
                                </select>
                            </div>
                        </div>
                        {isLoading ? <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div></div> : <CasoList casos={casos} clientes={clientes} onEdit={handleEditCaso} onDelete={handleDeleteCaso} />}
                    </>
                );
            case 'casoForm':
                return <CasoForm casoToEdit={casoToEdit} clientes={clientes} onFormSubmit={handleCasoFormSubmit} onCancel={() => { setCurrentView('casosList'); setCasoToEdit(null); }} />;

            case 'recebimentosList':
                return (
                    <>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2>Recebimentos</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => { setRecebimentoToEdit(null); setCurrentView('recebimentoForm'); }}>
                                <i className="bi bi-plus-circle me-1"></i> Adicionar Recebimento
                            </button>
                        </div>
                         <div className="row mb-3 gx-2">
                            <div className="col-md-3"><input type="text" className="form-control form-control-sm" placeholder="Buscar por descrição..." value={searchTermRecebimento} onChange={(e) => setSearchTermRecebimento(e.target.value)} /></div>
                            <div className="col-md-3">
                                <select className="form-select form-select-sm" value={clienteRecebimentoFilter} onChange={(e) => { setClienteRecebimentoFilter(e.target.value); setCasoRecebimentoFilter(''); }}>
                                    <option value="">Todos Clientes</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <select className="form-select form-select-sm" value={casoRecebimentoFilter} onChange={(e) => setCasoRecebimentoFilter(e.target.value)} disabled={!clienteRecebimentoFilter && !casos.some(c => !c.cliente_id) }>
                                    <option value="">Todos Casos (do cliente)</option>
                                    { (clienteRecebimentoFilter ? casos.filter(c => c.cliente_id === parseInt(clienteRecebimentoFilter)) : casos).map(c => <option key={c.id} value={c.id}>{c.titulo}</option>) }
                                </select>
                            </div>
                            <div className="col-md-3">
                                <select className="form-select form-select-sm" value={statusRecebimentoFilter} onChange={(e) => setStatusRecebimentoFilter(e.target.value)}>
                                    <option value="">Todos Status</option>
                                    <option value="Pendente">Pendente</option><option value="Pago">Pago</option><option value="Vencido">Vencido</option><option value="Cancelado">Cancelado</option>
                                </select>
                            </div>
                        </div>
                        {isLoading ? <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div></div> : <RecebimentoList recebimentos={recebimentos} onEdit={handleEditRecebimento} onDelete={handleDeleteRecebimento} />}
                    </>
                );
            case 'recebimentoForm':
                return <RecebimentoForm recebimentoToEdit={recebimentoToEdit} clientes={clientes} casos={casos} onFormSubmit={handleRecebimentoFormSubmit} onCancel={() => { setCurrentView('recebimentosList'); setRecebimentoToEdit(null); }} />;
            
            case 'despesasList': 
                return (
                    <>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2>Despesas</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => { setDespesaToEdit(null); setCurrentView('despesaForm'); }}>
                                <i className="bi bi-plus-circle me-1"></i> Adicionar Despesa
                            </button>
                        </div>
                         <div className="row mb-3 gx-2">
                            <div className="col-md-4"><input type="text" className="form-control form-control-sm" placeholder="Buscar por descrição..." value={searchTermDespesa} onChange={(e) => setSearchTermDespesa(e.target.value)} /></div>
                            <div className="col-md-4">
                                <select className="form-select form-select-sm" value={casoDespesaFilter} onChange={(e) => setCasoDespesaFilter(e.target.value)}>
                                    <option value="">Todos Casos / Gerais</option>
                                    <option value="-1">Despesas Gerais (Sem Caso)</option>
                                    {casos.map(c => <option key={c.id} value={c.id}>{c.titulo} (Cliente: {c.cliente?.nome_razao_social || 'N/A'})</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <select className="form-select form-select-sm" value={statusDespesaFilter} onChange={(e) => setStatusDespesaFilter(e.target.value)}>
                                    <option value="">Todos Status</option>
                                    <option value="A Pagar">A Pagar</option><option value="Paga">Paga</option><option value="Vencida">Vencida</option><option value="Cancelada">Cancelada</option>
                                </select>
                            </div>
                        </div>
                        {isLoading ? <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div></div> : <DespesaList despesas={despesas} onEdit={handleEditDespesa} onDelete={handleDeleteDespesa} />}
                    </>
                );
            case 'despesaForm': 
                return <DespesaForm despesaToEdit={despesaToEdit} casos={casos} onFormSubmit={handleDespesaFormSubmit} onCancel={() => { setCurrentView('despesasList'); setDespesaToEdit(null); }} />;

            case 'eventosList': 
                return (
                    <>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2>Agenda</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => { setEventoToEdit(null); setCurrentView('eventoForm'); }}>
                                <i className="bi bi-plus-circle me-1"></i> Adicionar Evento/Prazo
                            </button>
                        </div>
                         <div className="row mb-3 gx-2">
                            <div className="col-md-3"><input type="text" className="form-control form-control-sm" placeholder="Buscar por título..." value={searchTermEvento} onChange={(e) => setSearchTermEvento(e.target.value)} /></div>
                            <div className="col-md-3">
                                <select className="form-select form-select-sm" value={casoEventoFilter} onChange={(e) => setCasoEventoFilter(e.target.value)}>
                                    <option value="">Todos Casos / Gerais</option>
                                    <option value="-1">Eventos Gerais (Sem Caso)</option>
                                    {casos.map(c => <option key={c.id} value={c.id}>{c.titulo} (Cliente: {c.cliente?.nome_razao_social || 'N/A'})</option>)}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <select className="form-select form-select-sm" value={tipoEventoFilter} onChange={(e) => setTipoEventoFilter(e.target.value)}>
                                    <option value="">Todos os Tipos</option>
                                    <option value="Prazo">Prazo Processual</option>
                                    <option value="Audiência">Audiência</option>
                                    <option value="Reunião">Reunião</option>
                                    <option value="Lembrete">Lembrete</option>
                                    <option value="Outro">Outro Compromisso</option>
                                </select>
                            </div>
                             <div className="col-md-3">
                                <select className="form-select form-select-sm" value={concluidoEventoFilter} onChange={(e) => setConcluidoEventoFilter(e.target.value)}>
                                    <option value="">Todos Status</option>
                                    <option value="false">Pendente</option>
                                    <option value="true">Concluído</option>
                                </select>
                            </div>
                        </div>
                        {isLoading ? <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div></div> : <EventoAgendaList eventos={eventos} onEdit={handleEditEvento} onDelete={handleDeleteEvento} />}
                    </>
                );
            case 'eventoForm': 
                return <EventoAgendaForm eventoToEdit={eventoToEdit} casos={casos} onFormSubmit={handleEventoFormSubmit} onCancel={() => { setCurrentView('eventosList'); setEventoToEdit(null); }} />;
            
            case 'documentosList': // NOVO
                return (
                    <>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2>Documentos</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => { setDocumentoToEdit(null); setCurrentView('documentoForm'); }}>
                                <i className="bi bi-plus-circle me-1"></i> Adicionar Documento
                            </button>
                        </div>
                        <div className="row mb-3 gx-2">
                            <div className="col-md-4"><input type="text" className="form-control form-control-sm" placeholder="Buscar por nome/descrição..." value={searchTermDocumento} onChange={(e) => setSearchTermDocumento(e.target.value)} /></div>
                            <div className="col-md-4">
                                <select className="form-select form-select-sm" value={clienteDocumentoFilter} onChange={(e) => {setClienteDocumentoFilter(e.target.value); setCasoDocumentoFilter('')}}>
                                    <option value="">Todos Clientes</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <select className="form-select form-select-sm" value={casoDocumentoFilter} onChange={(e) => setCasoDocumentoFilter(e.target.value)} disabled={!clienteDocumentoFilter && !casos.some(c => !c.cliente_id)}>
                                    <option value="">Todos Casos (do cliente)</option>
                                     <option value="-1">Documentos Gerais (Sem Caso)</option>
                                    { (clienteDocumentoFilter ? casos.filter(c => c.cliente_id === parseInt(clienteDocumentoFilter)) : casos).map(c => <option key={c.id} value={c.id}>{c.titulo}</option>) }
                                </select>
                            </div>
                        </div>
                        {isLoading ? <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div></div> : <DocumentoList documentos={documentos} onEdit={handleEditDocumento} onDelete={handleDeleteDocumento} />}
                    </>
                );
            case 'documentoForm': // NOVO
                return <DocumentoForm documentoToEdit={documentoToEdit} clientes={clientes} casos={casos} onFormSubmit={handleDocumentoFormSubmit} onCancel={() => {setCurrentView('documentosList'); setDocumentoToEdit(null);}} />;

            case 'relatoriosPage': // NOVO
                return <RelatoriosPage />;

            default:
                return <div><h2>Dashboard</h2><p>Bem-vindo ao sistema de Gestão de Advocacia!</p></div>;
        }
    };

    return (
        <>
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
                <div className="container-fluid">
                    <a className="navbar-brand" href="#" onClick={(e) => {e.preventDefault(); setCurrentView('dashboard');}}>Gestão Advocacia</a>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="navbarNav">
                        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                            <li className="nav-item"><a className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`} href="#" onClick={(e) => {e.preventDefault(); setCurrentView('dashboard');}}>Dashboard</a></li>
                            <li className="nav-item"><a className={`nav-link ${currentView.startsWith('cliente') ? 'active' : ''}`} href="#" onClick={(e) => {e.preventDefault(); setCurrentView('clientesList');}}>Clientes</a></li>
                            <li className="nav-item"><a className={`nav-link ${currentView.startsWith('caso') ? 'active' : ''}`} href="#" onClick={(e) => {e.preventDefault(); setCurrentView('casosList');}}>Casos</a></li>
                            <li className="nav-item"><a className={`nav-link ${currentView.startsWith('recebimento') ? 'active' : ''}`} href="#" onClick={(e) => {e.preventDefault(); setCurrentView('recebimentosList');}}>Recebimentos</a></li>
                            <li className="nav-item"><a className={`nav-link ${currentView.startsWith('despesa') ? 'active' : ''}`} href="#" onClick={(e) => {e.preventDefault(); setCurrentView('despesasList');}}>Despesas</a></li>
                            <li className="nav-item"><a className={`nav-link ${currentView.startsWith('evento') ? 'active' : ''}`} href="#" onClick={(e) => {e.preventDefault(); setCurrentView('eventosList');}}>Agenda</a></li>
                            <li className="nav-item"><a className={`nav-link ${currentView.startsWith('documento') ? 'active' : ''}`} href="#" onClick={(e) => {e.preventDefault(); setCurrentView('documentosList');}}>Documentos</a></li>
                            <li className="nav-item"><a className={`nav-link ${currentView.startsWith('relatorio') ? 'active' : ''}`} href="#" onClick={(e) => {e.preventDefault(); setCurrentView('relatoriosPage');}}>Relatórios</a></li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main className="container mt-4">
                {isLoading && <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div></div>}
                {!isLoading && renderView()}
            </main>

            <footer className="py-4 mt-auto border-top text-center text-muted">
                 <p>&copy; {new Date().getFullYear()} Gestão Advocacia. Todos os direitos reservados.</p>
            </footer>
        </>
    );
}

export default App;
