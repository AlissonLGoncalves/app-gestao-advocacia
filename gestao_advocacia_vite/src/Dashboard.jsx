// src/Dashboard.jsx
// Este componente exibe o painel principal da aplicação com estatísticas e informações relevantes.
// v6: Usa Heroicons para os cards e implementa navegação ao clicar.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { SECOES } from './App.jsx'; // Importa as constantes de seção do App.jsx

// Importação dos ícones da biblioteca Heroicons (solid para um visual mais preenchido nos cards)
import {
  UsersIcon as UsersIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ArrowTrendingDownIcon as TrendingDownIconSolid, // Ícone para Despesas
  ClockIcon as PrazoIconSolid, // Ícone para Prazos
  CalendarDaysIcon as EventoIconSolid // Ícone para Eventos gerais
} from '@heroicons/react/24/solid'; // Usando a versão 'solid' para os cards para maior destaque

// Ícone de Chevron para a lista de eventos (pode ser outline ou solid)
import { ChevronRightIcon } from '@heroicons/react/24/outline';


// Componente reutilizável para os cards de estatísticas
const StatCard = ({ title, value, icon: IconComponent, colorClass = "text-primary", bgColorClass = "bg-primary-subtle", onClick }) => (
  <div 
    className={`card shadow-sm hover-shadow transition-shadow duration-200 ease-in-out d-flex flex-row align-items-center p-3 ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
    style={onClick ? { cursor: 'pointer' } : {}}
    role={onClick ? 'button' : 'figure'} // Adiciona role para acessibilidade
    tabIndex={onClick ? 0 : -1} // Adiciona tabIndex para acessibilidade
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined} // Permite ativação com teclado
  >
    <div className={`p-2 rounded-circle me-3 ${bgColorClass} ${colorClass}`}>
      {/* Renderiza o componente Heroicon passado como prop */}
      <IconComponent style={{ width: '24px', height: '24px' }} />
    </div>
    <div className="flex-grow-1">
      <p className="text-muted small text-uppercase mb-1" style={{fontSize: '0.7rem'}}>{title}</p>
      <p className="h5 mb-0 fw-semibold text-dark">{value}</p>
    </div>
  </div>
);

// Componente para item da lista de eventos
const EventListItem = ({ evento, onClick }) => {
  const dataFormatada = new Date(evento.data_inicio).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
  const horaFormatada = evento.data_inicio ? new Date(evento.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  // Escolhe o ícone baseado no tipo de evento
  const IconeEvento = evento.tipo_evento === 'Prazo' ? PrazoIconSolid : EventoIconSolid;
  const corIconeEvento = evento.tipo_evento === 'Prazo' ? "text-danger" : "text-primary";

  return (
    <li 
      className="list-group-item list-group-item-action py-3 px-2 d-flex justify-content-between align-items-center"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
      role={onClick ? 'button' : 'listitem'}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className="d-flex align-items-center">
        <div className={`flex-shrink-0 me-2 ${corIconeEvento}`}>
          <IconeEvento style={{ width: '20px', height: '20px' }} />
        </div>
        <div className="flex-grow-1 min-w-0">
          <p className="mb-0 fw-medium text-dark text-truncate" style={{fontSize: '0.9rem'}}>{evento.titulo}</p>
          <p className="small text-muted text-truncate mb-0" style={{fontSize: '0.75rem'}}>
            {dataFormatada} {horaFormatada && `às ${horaFormatada}`}
            {evento.caso_titulo && <span className="ms-1 text-body-secondary">| {evento.caso_titulo}</span>}
          </p>
        </div>
      </div>
      <ChevronRightIcon className="text-muted" style={{ width: '16px', height: '16px' }} />
    </li>
  );
};

// Recebe mudarSecao como prop
function Dashboard({ mudarSecao }) { 
  const [stats, setStats] = useState({
    totalClientes: 0,
    casosAtivos: 0,
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
    try {
      const [clientesRes, casosRes, eventosRes, recebimentosRes, despesasRes] = await Promise.all([
        fetch(`${API_URL}/clientes?count_only=true`),
        fetch(`${API_URL}/casos?status=Ativo&count_only=true`),
        fetch(`${API_URL}/eventos?sort_by=data_inicio&order=asc&limit=5&status=Pendente`),
        fetch(`${API_URL}/recebimentos?status=Pendente`),
        fetch(`${API_URL}/despesas?status=A Pagar`),
      ]);

      if (!clientesRes.ok) throw new Error('Falha ao carregar dados de clientes.');
      if (!casosRes.ok) throw new Error('Falha ao carregar dados de casos.');
      if (!eventosRes.ok) throw new Error('Falha ao carregar próximos eventos.');
      if (!recebimentosRes.ok) throw new Error('Falha ao carregar recebimentos pendentes.');
      if (!despesasRes.ok) throw new Error('Falha ao carregar despesas a pagar.');

      const clientesData = await clientesRes.json();
      const casosData = await casosRes.json();
      const eventosData = await eventosRes.json();
      const recebimentosData = await recebimentosRes.json();
      const despesasData = await despesasRes.json();
      
      const recebimentosPendentes = (recebimentosData.recebimentos || []).filter(r => r.status === 'Pendente');
      const totalPendenteValor = recebimentosPendentes.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
      const totalPendenteQtd = recebimentosPendentes.length;

      const despesasAPagar = (despesasData.despesas || []).filter(d => d.status === 'A Pagar');
      const totalAPagarValor = despesasAPagar.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
      const totalAPagarQtd = despesasAPagar.length;

      setStats({
        totalClientes: clientesData.total_clientes || 0,
        casosAtivos: casosData.total_casos || 0,
        recebimentosPendentesValor: totalPendenteValor,
        recebimentosPendentesQtd: totalPendenteQtd,
        despesasAPagarValor: totalAPagarValor,
        despesasAPagarQtd: totalAPagarQtd,
      });
      setProximosEventos(eventosData.eventos || []);

    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
      setErro(`Erro ao carregar Dashboard! ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '10rem' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
        <p className="ms-3 text-muted">Carregando...</p>
      </div>
    );
  }

  if (erro) {
    return <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">Ocorreu um erro!</h4>
        <p>{erro}</p>
    </div>;
  }

  return (
    <div className="container-fluid p-0">
      <div className="row g-3"> {/* g-3 para espaçamento entre colunas */}
        <div className="col-sm-6 col-lg-3">
          <StatCard 
            title="Total de Clientes" 
            value={stats.totalClientes} 
            icon={UsersIconSolid} // Usando Heroicon importado
            colorClass="text-indigo" // Pode precisar de uma classe CSS personalizada se 'text-indigo' não for padrão Bootstrap
            bgColorClass="bg-indigo-subtle" // Bootstrap 5.3+ para bg-*-subtle
            onClick={() => mudarSecao(SECOES.CLIENTES)}
          />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard 
            title="Casos Ativos" 
            value={stats.casosAtivos} 
            icon={BriefcaseIconSolid} // Usando Heroicon importado
            colorClass="text-success"
            bgColorClass="bg-success-subtle"
            onClick={() => mudarSecao(SECOES.CASOS)}
          />
        </div>
        <div className="col-sm-6 col-lg-3">
         <StatCard 
            title="Recebimentos Pendentes" 
            value={`${stats.recebimentosPendentesQtd} (R$ ${stats.recebimentosPendentesValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={CreditCardIconSolid} // Usando Heroicon importado
            colorClass="text-warning" 
            bgColorClass="bg-warning-subtle"
            onClick={() => mudarSecao(SECOES.RECEBIMENTOS)}
          />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard 
            title="Despesas a Pagar" 
            value={`${stats.despesasAPagarQtd} (R$ ${stats.despesasAPagarValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={TrendingDownIconSolid} // Usando Heroicon importado
            colorClass="text-danger"
            bgColorClass="bg-danger-subtle"
            onClick={() => mudarSecao(SECOES.DESPESAS)}
          />
        </div>
      </div>

      <div className="card mt-4 shadow-sm">
        <div className="card-header bg-light">
          <h2 className="h6 mb-0 text-dark">Próximos Prazos e Eventos</h2>
        </div>
        {proximosEventos.length > 0 ? (
          <ul className="list-group list-group-flush">
            {proximosEventos.map(evento => (
              <EventListItem 
                key={evento.id} 
                evento={evento} 
                onClick={() => mudarSecao(SECOES.AGENDA)} // Navega para Agenda
              />
            ))}
          </ul>
        ) : (
          <div className="card-body text-center">
            <p className="text-muted small">Nenhum prazo ou evento pendente nos próximos dias.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
