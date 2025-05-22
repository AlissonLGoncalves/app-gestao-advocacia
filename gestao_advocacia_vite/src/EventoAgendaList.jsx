// src/EventoAgendaList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; 
import {
  PencilSquareIcon, TrashIcon, CheckCircleIcon, XCircleIcon,
  ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, FunnelIcon,
  CalendarDaysIcon, ClockIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

function EventoAgendaList({ onEditEvento, refreshKey }) {
  console.log("EventoAgendaList: Renderizando. RefreshKey:", refreshKey);

  const [eventos, setEventos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [clienteFilter, setClienteFilter] = useState('');
  const [casoFilter, setCasoFilter] = useState('');
  const [tipoEventoFilter, setTipoEventoFilter] = useState('');
  const [statusConclusaoFilter, setStatusConclusaoFilter] = useState('');
  const [dataInicioRangeStart, setDataInicioRangeStart] = useState('');
  const [dataInicioRangeEnd, setDataInicioRangeEnd] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: 'data_inicio', direction: 'asc' });

  const tipoEventoOptions = ["Prazo", "Audiência", "Reunião", "Lembrete", "Outro"];

  const fetchClientesECasosParaFiltro = useCallback(async () => {
    console.log("EventoAgendaList: fetchClientesECasosParaFiltro chamado. Cliente para filtro de casos:", clienteFilter);
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("EventoAgendaList: Token não encontrado para fetchClientesECasosParaFiltro.");
        return;
    }
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    try {
      const clientesRes = await fetch(`${API_URL}/clientes/?sort_by=nome_razao_social&order=asc`, { headers: authHeaders });
      if (!clientesRes.ok) throw new Error('Falha ao carregar clientes para filtro.');
      const clientesData = await clientesRes.json();
      setClientes(clientesData.clientes || []);
      console.log("EventoAgendaList: Clientes para filtro carregados:", clientesData.clientes);

      let casosUrl = `${API_URL}/casos/?sort_by=titulo&order=asc`;
      if (clienteFilter) {
        casosUrl += `&cliente_id=${clienteFilter}`;
      }
      const casosRes = await fetch(casosUrl, { headers: authHeaders });
      if (!casosRes.ok) throw new Error('Falha ao carregar casos para filtro.');
      const casosData = await casosRes.json();
      setCasos(casosData.casos || []);
      console.log("EventoAgendaList: Casos para filtro carregados:", casosData.casos);
    } catch (err) {
      console.error("EventoAgendaList: Erro ao buscar clientes/casos para filtro:", err);
      toast.error(`Erro ao carregar dados para filtros da agenda: ${err.message}`);
    }
  }, [clienteFilter]);

  const fetchEventos = useCallback(async () => {
    console.log("EventoAgendaList: fetchEventos chamado. Ordenação:", sortConfig, "Filtros:", { searchTerm, clienteFilter, casoFilter, tipoEventoFilter, statusConclusaoFilter, dataInicioRangeStart, dataInicioRangeEnd });
    setLoading(true);
    setError('');

    const token = localStorage.getItem('token');
    if (!token) {
        setError("Autenticação necessária. Por favor, faça login.");
        setLoading(false);
        toast.error("Sessão expirada ou inválida.");
        return;
    }
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    let url = `${API_URL}/eventos/?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;

    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
    if (tipoEventoFilter) url += `&tipo_evento=${encodeURIComponent(tipoEventoFilter)}`;

    if (casoFilter) {
      if (casoFilter === "EVENTO_GERAL") {
        url += `&caso_id=-1`; 
      } else {
        url += `&caso_id=${casoFilter}`;
      }
    }
    // Não há filtro direto por cliente_id para eventos, apenas indireto por caso.

    if (statusConclusaoFilter === 'concluido') url += `&concluido=true`;
    if (statusConclusaoFilter === 'pendente') url += `&concluido=false`;
    
    if (dataInicioRangeStart) url += `&data_inicio_gte=${dataInicioRangeStart}`;
    if (dataInicioRangeEnd) url += `&data_inicio_lte=${dataInicioRangeEnd}`;

    try {
      const response = await fetch(url, { headers: authHeaders });
      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        console.error("EventoAgendaList: Erro da API ao buscar eventos:", resData);
        throw new Error(resData.erro || `Erro HTTP: ${response.status} ao buscar eventos`);
      }
      const data = await response.json();
      setEventos(data.eventos || []);
      console.log("EventoAgendaList: Eventos carregados:", data.eventos);
    } catch (err) {
      console.error("EventoAgendaList: Erro detalhado ao buscar eventos:", err);
      setError(`Erro ao carregar eventos: ${err.message}`);
      if (!err.message.includes("Autenticação")) {
        toast.error(`Erro ao carregar eventos: ${err.message}`);
      }
    } finally {
      setLoading(false);
      console.log("EventoAgendaList: fetchEventos finalizado.");
    }
  }, [searchTerm, clienteFilter, casoFilter, tipoEventoFilter, statusConclusaoFilter, dataInicioRangeStart, dataInicioRangeEnd, sortConfig]);

  useEffect(() => {
    fetchClientesECasosParaFiltro();
  }, [fetchClientesECasosParaFiltro]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos, refreshKey]);

  const handleDeleteClick = async (id) => {
    console.log("EventoAgendaList: handleDeleteClick chamado para ID:", id);
    const token = localStorage.getItem('token');
    if (!token) {
        toast.error("Autenticação expirada. Faça login novamente.");
        return;
    }
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    if (window.confirm(`Tem certeza que deseja excluir o evento/prazo ID ${id}?`)) {
      setDeletingId(id);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE', headers: authHeaders });
        if (!response.ok) {
          const resData = await response.json().catch(() => ({}));
          throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
        }
        toast.success(`Evento ID ${id} excluído com sucesso!`);
        fetchEventos();
      } catch (err) {
        console.error(`EventoAgendaList: Erro ao deletar evento ${id}:`, err);
        setError(`Erro ao deletar evento: ${err.message}`);
        toast.error(`Erro ao deletar evento: ${err.message}`);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleToggleConcluido = async (evento) => {
    console.log("EventoAgendaList: handleToggleConcluido chamado para evento ID:", evento.id, "Novo status:", !evento.concluido);
    const token = localStorage.getItem('token');
    if (!token) {
        toast.error("Autenticação expirada. Faça login novamente.");
        return;
    }
    const authHeaders = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    setTogglingId(evento.id);
    setError(null);

    const dadosAtualizados = {
      tipo_evento: evento.tipo_evento,
      titulo: evento.titulo,
      descricao: evento.descricao,
      data_inicio: evento.data_inicio ? new Date(evento.data_inicio).toISOString() : null,
      data_fim: evento.data_fim ? new Date(evento.data_fim).toISOString() : null,
      local: evento.local,
      concluido: !evento.concluido,
      caso_id: evento.caso_id 
    };
    
    console.log("EventoAgendaList: Enviando para atualizar status:", dadosAtualizados);

    try {
      const response = await fetch(`${API_URL}/eventos/${evento.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(dadosAtualizados)
      });
      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        console.error("EventoAgendaList: Erro da API ao atualizar status:", resData);
        throw new Error(resData.erro || `Erro HTTP: ${response.status} ao atualizar status`);
      }
      toast.success(`Status do evento ID ${evento.id} atualizado!`);
      fetchEventos(); 
    } catch (err) {
      console.error(`EventoAgendaList: Erro ao atualizar status do evento ${evento.id}:`, err);
      setError(`Erro ao atualizar status: ${err.message}`);
      toast.error(`Erro ao atualizar status: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    console.log("EventoAgendaList: requestSort. Nova ordenação:", { key, direction });
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    const iconStyle = { width: '14px', height: '14px', display: 'inline', verticalAlign: 'text-bottom', marginLeft: '4px' };
    if (sortConfig.key !== key) return <ArrowsUpDownIcon className="text-muted" style={iconStyle} />;
    if (sortConfig.direction === 'asc') return <ArrowUpIcon className="text-primary" style={iconStyle} />;
    return <ArrowDownIcon className="text-primary" style={iconStyle} />;
  };

  const resetFilters = () => {
    console.log("EventoAgendaList: resetFilters chamado.");
    setSearchTerm('');
    setClienteFilter('');
    setCasoFilter('');
    setTipoEventoFilter('');
    setStatusConclusaoFilter('');
    setDataInicioRangeStart('');
    setDataInicioRangeEnd('');
    setShowFilters(false);
  };

  if (loading && eventos.length === 0) {
    console.log("EventoAgendaList: Renderizando estado de carregamento inicial.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar agenda...</span>
        </div>
        <span className="ms-3 text-muted">A carregar agenda...</span>
      </div>
    );
  }

  if (error && eventos.length === 0) {
    return <div className="alert alert-danger m-3 small" role="alert">{error}</div>;
  }

  console.log("EventoAgendaList: Renderizando tabela de eventos ou mensagem de erro/lista vazia.");
  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light p-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap">
          <h6 className="mb-0 text-secondary me-3">Filtros e Busca na Agenda</h6>
          <button
            className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="filtrosAvancadosAgenda"
          >
            <FunnelIcon style={{width: '16px', height: '16px'}} className="me-1" />
            {showFilters ? 'Ocultar Avançados' : 'Mostrar Avançados'}
          </button>
        </div>
        <div className="row g-2 align-items-end">
          <div className="col-lg-3 col-md-6">
            <label htmlFor="searchTermAgendaList" className="form-label form-label-sm visually-hidden">Buscar</label>
            <input
              type="text"
              id="searchTermAgendaList"
              className="form-control form-control-sm"
              placeholder="Buscar por Título/Descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="clienteFilterAgendaList" className="form-label form-label-sm visually-hidden">Filtrar Casos por Cliente</label>
            <select 
              id="clienteFilterAgendaList" 
              className="form-select form-select-sm" 
              value={clienteFilter} 
              onChange={(e) => {
                setClienteFilter(e.target.value);
                setCasoFilter(''); 
              }}
            >
              <option value="">Todos Clientes (para Casos)</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
            </select>
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="casoFilterAgendaList" className="form-label form-label-sm visually-hidden">Filtrar por Caso</label>
            <select 
              id="casoFilterAgendaList" 
              className="form-select form-select-sm" 
              value={casoFilter} 
              onChange={(e) => setCasoFilter(e.target.value)}
              disabled={!clienteFilter && casos.length === 0}
            >
              <option value="">Todos os Casos/Eventos Gerais</option>
              <option value="EVENTO_GERAL">Apenas Eventos Gerais (Sem Caso)</option>
              {(clienteFilter ? casos.filter(c => String(c.cliente_id) === clienteFilter) : casos).map(cs => (
                <option key={cs.id} value={cs.id}>{cs.titulo}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-3 col-md-12 text-lg-end mt-2 mt-lg-0">
            <button onClick={resetFilters} className="btn btn-sm btn-outline-secondary py-1 px-2 w-100">Limpar Filtros Básicos</button>
          </div>
        </div>
        {showFilters && (
          <div className="mt-3 pt-3 border-top" id="filtrosAvancadosAgenda">
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-3 col-sm-6">
                <label htmlFor="tipoEventoFilterAgendaList" className="form-label form-label-sm mb-1">Tipo de Evento:</label>
                <select id="tipoEventoFilterAgendaList" className="form-select form-select-sm" value={tipoEventoFilter} onChange={(e) => setTipoEventoFilter(e.target.value)}>
                  <option value="">Todos os Tipos</option>
                  {tipoEventoOptions.map(tipo => (<option key={tipo} value={tipo}>{tipo}</option>))}
                </select>
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="statusConclusaoFilterAgendaList" className="form-label form-label-sm mb-1">Status Conclusão:</label>
                <select id="statusConclusaoFilterAgendaList" className="form-select form-select-sm" value={statusConclusaoFilter} onChange={(e) => setStatusConclusaoFilter(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="pendente">Pendentes</option>
                  <option value="concluido">Concluídos</option>
                </select>
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataInicioRangeStartList" className="form-label form-label-sm mb-1">Início De:</label>
                <input type="date" id="dataInicioRangeStartList" className="form-control form-control-sm" value={dataInicioRangeStart} onChange={e => setDataInicioRangeStart(e.target.value)} />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataInicioRangeEndList" className="form-label form-label-sm mb-1">Início Até:</label>
                <input type="date" id="dataInicioRangeEndList" className="form-control form-control-sm" value={dataInicioRangeEnd} onChange={e => setDataInicioRangeEnd(e.target.value)} />
              </div>
            </div>
            <div className="row mt-2">
              <div className="col-12 text-end">
                <button onClick={resetFilters} className="btn btn-sm btn-outline-danger py-1 px-2">Limpar Todos os Filtros</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && eventos.length > 0 && <div className="alert alert-warning m-3 small" role="alert">Erro ao atualizar a lista: {error}. Exibindo dados anteriores.</div>}

      <div className="table-responsive">
        <table className="table table-hover table-striped table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('data_inicio')} style={{ cursor: 'pointer' }}>Data/Hora Início {getSortIcon('data_inicio')}</th>
              <th onClick={() => requestSort('titulo')} style={{ cursor: 'pointer' }}>Título {getSortIcon('titulo')}</th>
              <th onClick={() => requestSort('tipo_evento')} style={{ cursor: 'pointer' }}>Tipo {getSortIcon('tipo_evento')}</th>
              <th onClick={() => requestSort('caso_titulo')} style={{ cursor: 'pointer' }}>Caso {getSortIcon('caso_titulo')}</th>
              <th className="text-center" onClick={() => requestSort('concluido')} style={{ cursor: 'pointer' }}>Concluído {getSortIcon('concluido')}</th>
              <th className="text-center" style={{width: '100px'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && eventos.length > 0 && (
              <tr><td colSpan="6" className="text-center p-4"><div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">A atualizar...</span></div></td></tr>
            )}
            {!loading && eventos.length === 0 && !error && (
              <tr><td colSpan="6" className="text-center text-muted p-4">Nenhum evento/prazo encontrado com os filtros aplicados.</td></tr>
            )}
            {eventos.map((evento) => (
                <tr key={evento.id} className={evento.concluido ? 'table-light text-muted' : ''} style={evento.concluido ? {textDecoration: 'line-through'} : {}}>
                  <td className="px-3 py-2">
                    {evento.data_inicio ? new Date(evento.data_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="px-3 py-2">{evento.titulo}</td>
                  <td className="px-3 py-2">
                    {evento.tipo_evento === 'Prazo' && <ClockIcon className="me-1 text-danger d-inline" style={{width: '16px', height: '16px'}}/>}
                    {evento.tipo_evento !== 'Prazo' && <CalendarDaysIcon className="me-1 text-primary d-inline" style={{width: '16px', height: '16px'}}/>}
                    {evento.tipo_evento}
                  </td>
                  <td className="px-3 py-2">{evento.caso_titulo || (evento.caso_id ? 'Caso N/A' : 'Evento Geral')}</td>
                  <td className="text-center px-3 py-2">
                    <button
                      onClick={() => handleToggleConcluido(evento)}
                      className={`btn btn-sm p-1 lh-1 ${evento.concluido ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                      title={evento.concluido ? 'Marcar como Pendente' : 'Marcar como Concluído'}
                      disabled={togglingId === evento.id}
                      style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                    >
                      {togglingId === evento.id ? <div className="spinner-border spinner-border-sm" role="status"></div> : (evento.concluido ? <XCircleIcon style={{ width: '18px', height: '18px' }}/> : <CheckCircleIcon style={{ width: '18px', height: '18px' }} />)}
                    </button>
                  </td>
                  <td className="text-center px-3 py-2">
                    <button onClick={() => onEditEvento(evento)} className="btn btn-sm btn-outline-primary me-1 p-1 lh-1" title="Editar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === evento.id || togglingId === evento.id}><PencilSquareIcon style={{ width: '16px', height: '16px' }} /></button>
                    <button onClick={() => handleDeleteClick(evento.id)} className="btn btn-sm btn-outline-danger p-1 lh-1" title="Deletar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === evento.id || togglingId === evento.id}>
                      {deletingId === evento.id ? <div className="spinner-border spinner-border-sm" role="status" style={{width: '1rem', height: '1rem'}}></div> : <TrashIcon style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && eventos.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {eventos.length} evento(s) encontrado(s)
        </div>
      )}
    </div>
  );
}

export default EventoAgendaList;