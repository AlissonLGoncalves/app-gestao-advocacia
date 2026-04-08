// src/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';

import {
  UsersIcon as UsersIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ArrowTrendingDownIcon as TrendingDownIconSolid,
  ClockIcon as PrazoIconSolid,
  CalendarDaysIcon as EventoIconSolid
} from '@heroicons/react/24/solid';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

const StatCard = ({ title, value, icon: IconComponent, colorClass = "text-primary", bgColorClass = "bg-primary-subtle", onClick }) => (
  <div
    className={`card shadow-sm hover-shadow transition-shadow duration-200 ease-in-out d-flex flex-row align-items-center p-3 ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
    style={onClick ? { cursor: 'pointer' } : {}}
    role={onClick ? 'button' : 'figure'}
    tabIndex={onClick ? 0 : -1}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
  >
    <div className={`p-2 rounded-circle me-3 ${bgColorClass} ${colorClass}`}>
      <IconComponent style={{ width: '24px', height: '24px' }} />
    </div>
    <div className="flex-grow-1">
      <p className="text-muted small text-uppercase mb-1" style={{fontSize: '0.7rem'}}>{title}</p>
      <p className="h5 mb-0 fw-semibold text-dark">{value === undefined || value === null ? '...' : value}</p>
    </div>
  </div>
);

const EventListItem = ({ evento, onClick }) => {
  if (!evento || typeof evento !== 'object' || !evento.id || !evento.data_inicio) {
    return null;
  }

  let dataFormatada = 'Data inválida';
  let horaFormatada = '';
  try {
    const dataObj = new Date(evento.data_inicio);
    if (!isNaN(dataObj.getTime())) {
      dataFormatada = dataObj.toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short',
      });
      horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  } catch (e) {
    console.error("EventListItem: Erro ao formatar data_inicio:", evento.data_inicio, e);
  }

  const IconeEvento = evento.tipo_evento === 'Prazo' ? PrazoIconSolid : EventoIconSolid;
  const corIconeEvento = evento.tipo_evento === 'Prazo' ? "text-danger" : "text-primary";

  return (
    <li
      className="list-group-item list-group-item-action py-3 px-2 d-flex justify-content-between align-items-center"
      onClick={onClick} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className="d-flex align-items-center">
        <div className={`flex-shrink-0 me-2 ${corIconeEvento}`}><IconeEvento style={{ width: '20px', height: '20px' }} /></div>
        <div className="flex-grow-1 min-w-0">
          <p className="mb-0 fw-medium text-dark text-truncate" style={{fontSize: '0.9rem'}} title={evento.titulo || 'Evento sem título'}>
            {evento.titulo || 'Evento sem título'}
          </p>
          <p className="small text-muted text-truncate mb-0" style={{fontSize: '0.75rem'}}>
            {dataFormatada} {horaFormatada && `às ${horaFormatada}`}
          </p>
        </div>
      </div>
      <ChevronRightIcon className="text-muted" style={{ width: '16px', height: '16px' }} />
    </li>
  );
};

function Dashboard({ mudarSecao }) {
  const [stats, setStats] = useState({
    totalClientes: undefined,
    casosAtivos: undefined,
    recebimentosPendentesValor: 0,
    recebimentosPendentesQtd: 0,
    despesasAPagarValor: 0,
    despesasAPagarQtd: 0,
  });
  const [proximosEventos, setProximosEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setErro('');

    const token = localStorage.getItem('token');
    if (!token) {
      setErro("Autenticação necessária. Faça login para visualizar o dashboard.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro ao carregar dados (status ${response.status})`);
      }

      const data = await response.json();

      setStats({
        totalClientes: data.total_clientes ?? 0,
        casosAtivos: data.casos_ativos ?? 0,
        recebimentosPendentesValor: data.recebimentos_pendentes?.valor_total ?? 0,
        recebimentosPendentesQtd: data.recebimentos_pendentes?.quantidade ?? 0,
        despesasAPagarValor: data.despesas_a_pagar?.valor_total ?? 0,
        despesasAPagarQtd: data.despesas_a_pagar?.quantidade ?? 0,
      });
      setProximosEventos(data.proximos_eventos || []);

    } catch (error) {
      console.error("Dashboard: Erro ao carregar dados:", error);
      setErro(error.message || "Ocorreu um erro ao carregar os dados do dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando...</span>
        </div>
        <p className="ms-3 text-muted fs-5">Carregando Dashboard...</p>
      </div>
    );
  }

  if (erro) {
    return (
        <div className="alert alert-danger mx-auto mt-5" role="alert" style={{maxWidth: "600px"}}>
            <h4 className="alert-heading">Ocorreu um erro!</h4>
            <p>Não foi possível carregar os dados do dashboard. Verifique sua conexão com a API ou tente novamente.</p>
            <hr />
            <p className="mb-0 small">Detalhe: {erro}</p>
        </div>
    );
  }

  const handleCardClick = (secaoConstante) => {
    if (typeof mudarSecao === 'function') {
      mudarSecao(secaoConstante);
    }
  };

  return (
    <div className="container-fluid p-0">
      <div className="row g-3">
        <div className="col-sm-6 col-lg-3">
          <StatCard title="Total de Clientes" value={stats.totalClientes} icon={UsersIconSolid} colorClass="text-indigo" bgColorClass="bg-indigo-subtle" onClick={() => handleCardClick('CLIENTES')} />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard title="Casos Ativos" value={stats.casosAtivos} icon={BriefcaseIconSolid} colorClass="text-success" bgColorClass="bg-success-subtle" onClick={() => handleCardClick('CASOS')} />
        </div>
        <div className="col-sm-6 col-lg-3">
         <StatCard title="Recebimentos Pendentes" value={`${stats.recebimentosPendentesQtd} (R$ ${stats.recebimentosPendentesValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`} icon={CreditCardIconSolid} colorClass="text-warning" bgColorClass="bg-warning-subtle" onClick={() => handleCardClick('RECEBIMENTOS')} />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard title="Despesas a Pagar" value={`${stats.despesasAPagarQtd} (R$ ${stats.despesasAPagarValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`} icon={TrendingDownIconSolid} colorClass="text-danger" bgColorClass="bg-danger-subtle" onClick={() => handleCardClick('DESPESAS')} />
        </div>
      </div>
      <div className="card mt-4 shadow-sm">
        <div className="card-header bg-light"><h2 className="h6 mb-0 text-dark">Próximos Prazos e Eventos</h2></div>
        {proximosEventos && proximosEventos.length > 0 ? (
          <ul className="list-group list-group-flush">
            {proximosEventos.map(evento => ( <EventListItem key={evento.id} evento={evento} onClick={() => handleCardClick('AGENDA')} /> ))}
          </ul>
        ) : (
          <div className="card-body text-center"><p className="text-muted small">Nenhum prazo ou evento pendente nos próximos dias.</p></div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;