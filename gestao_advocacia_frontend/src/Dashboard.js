// src/Dashboard.js
// Este componente exibe o painel principal da aplicação com estatísticas e informações relevantes.
// Versão 4: Correção de erro de sintaxe e remoção de comentário problemático.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; // Certifique-se que config.js existe e exporta API_URL

// Ícones SVG para os cards (Exemplos)
const UsersIconSolid = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6.07 11c.046.327.07.66.07 1a6.97 6.97 0 00-1.5 4.33A5 5 0 011 16v1h6.07z" /></svg>;
const BriefcaseIconSolid = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v1H2.5A1.5 1.5 0 001 6.5V16a2 2 0 002 2h14a2 2 0 002-2V6.5A1.5 1.5 0 0017.5 5H16V4a2 2 0 00-2-2H6zm4 10.5a.5.5 0 000-1H7.5a.5.5 0 000 1H10zm0-2a.5.5 0 000-1H7.5a.5.5 0 000 1H10zM7 6.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-1z" clipRule="evenodd" /></svg>;
const CreditCardIconSolid = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zm-7 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
const TrendingDownIconSolid = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0L12 13zm-9-4a1 1 0 011-1h5a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;


// Componente reutilizável para os cards de estatísticas
const StatCard = ({ title, value, icon, colorClass = "text-blue-600", bgColorClass = "bg-blue-100" }) => (
  <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200 ease-in-out flex items-center space-x-3">
    <div className={`p-2.5 rounded-full ${bgColorClass} ${colorClass}`}>
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-normal">{title}</p>
      <p className="text-xl font-semibold text-gray-800">{value}</p>
    </div>
  </div>
);

// Componente para item da lista de eventos
const EventListItem = ({ evento }) => {
  const dataFormatada = new Date(evento.data_inicio).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
  const horaFormatada = evento.data_inicio ? new Date(evento.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  return (
    <li className="py-3 px-1.5 hover:bg-gray-50 rounded-md transition-colors duration-150 cursor-pointer group">
      <div className="flex items-center space-x-2.5">
        <div className="flex-shrink-0">
          {evento.tipo_evento === 'Prazo' ? (
            <svg className="h-5 w-5 text-red-500 group-hover:text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="h-5 w-5 text-blue-500 group-hover:text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">{evento.titulo}</p>
          <p className="text-xs text-gray-500 group-hover:text-gray-600 truncate">
            {dataFormatada} {horaFormatada && `às ${horaFormatada}`}
            {evento.caso_titulo && <span className="ml-1.5 text-gray-400 group-hover:text-gray-500">| {evento.caso_titulo}</span>}
          </p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 group-hover:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    </li>
  );
};


function Dashboard() {
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-600 text-sm">Carregando...</p>
      </div>
    );
  }

  if (erro) {
    return <div className="bg-red-50 border border-red-300 text-red-600 px-4 py-3 rounded-lg shadow-sm relative" role="alert">
        <strong className="font-semibold">Ocorreu um erro!</strong>
        <span className="block sm:inline ml-2 text-sm">{erro}</span>
    </div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard 
          title="Total de Clientes" 
          value={stats.totalClientes} 
          icon={<UsersIconSolid />} 
          colorClass="text-indigo-500"
          bgColorClass="bg-indigo-50"
        />
        <StatCard 
          title="Casos Ativos" 
          value={stats.casosAtivos} 
          icon={<BriefcaseIconSolid />} 
          colorClass="text-green-500"
          bgColorClass="bg-green-50"
        />
         <StatCard 
          title="Recebimentos Pendentes" 
          value={`${stats.recebimentosPendentesQtd} (R$ ${stats.recebimentosPendentesValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
          icon={<CreditCardIconSolid />}
          colorClass="text-amber-500" 
          bgColorClass="bg-amber-50"
        />
        <StatCard 
          title="Despesas a Pagar" 
          value={`${stats.despesasAPagarQtd} (R$ ${stats.despesasAPagarValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
          icon={<TrendingDownIconSolid />}
          colorClass="text-red-500"
          bgColorClass="bg-red-50"
        />
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-base font-semibold text-gray-700 mb-2.5">Próximos Prazos e Eventos</h2>
        {proximosEventos.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {proximosEventos.map(evento => (
              <EventListItem key={evento.id} evento={evento} />
            ))}
          </ul>
        ) : (
          // Removido o comentário problemático da linha abaixo
          <p className="text-gray-500 text-center py-5 text-xs">Nenhum prazo ou evento pendente nos próximos dias.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
