// ==================================================
// Conteúdo do arquivo: src/Dashboard.js
// (Atualizado com melhorias de UX/UI)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

// Componente para um Card de Estatística Individual
function StatCard({ title, value, icon, bgColor, textColor, iconColor, loading, unit = '' }) {
    if (loading) {
        return (
            <div className={`p-6 rounded-lg shadow border animate-pulse ${bgColor || 'bg-gray-100'} ${textColor || 'text-gray-800'}`}>
                <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-400 rounded w-1/2"></div>
            </div>
        );
    }
    return (
        <div className={`${bgColor || 'bg-gray-100'} border ${borderColorForBg(bgColor) || 'border-gray-200'} p-6 rounded-lg shadow hover:shadow-xl transition-shadow duration-300 ease-in-out`}>
            <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-semibold ${textColor || 'text-gray-800'}`}>{title}</h3>
                {icon && <i className={`${icon} ${iconColor || 'text-gray-500'} text-3xl`}></i>}
            </div>
            <p className={`text-4xl font-bold ${textColor || 'text-gray-700'} mt-1`}>
                {value} <span className="text-lg font-normal">{unit}</span>
            </p>
        </div>
    );
}

// Função auxiliar para determinar a cor da borda com base na cor de fundo
function borderColorForBg(bgColor) {
    if (bgColor?.includes('blue')) return 'border-blue-300';
    if (bgColor?.includes('green')) return 'border-green-300';
    if (bgColor?.includes('yellow')) return 'border-yellow-300';
    if (bgColor?.includes('purple')) return 'border-purple-300';
    if (bgColor?.includes('red')) return 'border-red-300';
    return 'border-gray-200';
}


function Dashboard() {
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalCasosAtivos: 0,
    proximosEventos: [],
    recebimentosPendentesValor: 0,
    recebimentosPendentesQtd: 0,
    despesasAPagarValor: 0,
    despesasAPagarQtd: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatarMoeda = (valor) => {
    if (valor === null || valor === undefined || isNaN(Number(valor))) return 'R$ 0,00';
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarDataHora = (dataIso) => {
    if (!dataIso) return '-';
    try {
      return new Date(dataIso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dataIso; }
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientesRes, casosRes, eventosRes, recebimentosRes, despesasRes] = await Promise.all([
        fetch(`${API_URL}/clientes`).catch(e => ({ ok: false, statusText: e.message, json: () => Promise.resolve({erro: e.message}) })),
        fetch(`${API_URL}/casos?status=Ativo`).catch(e => ({ ok: false, statusText: e.message, json: () => Promise.resolve({erro: e.message}) })), 
        fetch(`${API_URL}/eventos?_sort=data_inicio&_order=asc&_limit=5&concluido=false`).catch(e => ({ ok: false, statusText: e.message, json: () => Promise.resolve({erro: e.message}) })),
        fetch(`${API_URL}/recebimentos`).catch(e => ({ ok: false, statusText: e.message, json: () => Promise.resolve({erro: e.message}) })),
        fetch(`${API_URL}/despesas`).catch(e => ({ ok: false, statusText: e.message, json: () => Promise.resolve({erro: e.message}) }))
      ]);

      const processResponse = async (res, name) => {
          if (!res.ok) {
              const errorBody = await res.json().catch(() => ({erro: `Erro na rede ao buscar ${name}`}));
              throw new Error(`Erro ${name}: ${errorBody.erro || res.statusText}`);
          }
          return res.json();
      };
      
      const clientesData = await processResponse(clientesRes, 'clientes');
      const casosData = await processResponse(casosRes, 'casos');
      const eventosData = await processResponse(eventosRes, 'eventos');
      const recebimentosData = await processResponse(recebimentosRes, 'recebimentos');
      const despesasData = await processResponse(despesasRes, 'despesas');

      const recebimentosPendentes = recebimentosData.filter(r => r.status === 'Pendente');
      const totalPendente = recebimentosPendentes.reduce((acc, r) => acc + parseFloat(r.valor || 0), 0);
      const despesasAPagar = despesasData.filter(d => d.status === 'A Pagar');
      const totalAPagar = despesasAPagar.reduce((acc, d) => acc + parseFloat(d.valor || 0), 0);

      setStats({
        totalClientes: clientesData.length,
        totalCasosAtivos: casosData.length,
        proximosEventos: eventosData, 
        recebimentosPendentesValor: totalPendente,
        recebimentosPendentesQtd: recebimentosPendentes.length,
        despesasAPagarValor: totalAPagar,
        despesasAPagarQtd: despesasAPagar.length,
      });

    } catch (err) {
      console.error("Falha ao buscar dados do dashboard:", err);
      setError(`Falha ao carregar dados do dashboard: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) return (
    <div className="p-4">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
            {[1,2,3,4,5].map(i => <StatCard key={i} title="" value="" loading={true} />)}
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
            <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-300 rounded w-full"></div>)}
            </div>
        </div>
    </div>
  );

  if (error) return (
    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
        <span className="font-medium">Erro ao carregar Dashboard!</span> {error}
    </div>
  );

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Visão Geral</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8"> {/* Ajustado para 5 colunas se possível */}
        <StatCard title="Total de Clientes" value={stats.totalClientes} icon="fas fa-users" bgColor="bg-blue-50" textColor="text-blue-700" iconColor="text-blue-500" />
        <StatCard title="Casos Ativos" value={stats.totalCasosAtivos} icon="fas fa-briefcase" bgColor="bg-green-50" textColor="text-green-700" iconColor="text-green-500" />
        <StatCard title="Próximos Eventos" value={stats.proximosEventos.length} icon="fas fa-calendar-alt" bgColor="bg-yellow-50" textColor="text-yellow-700" iconColor="text-yellow-500" />
        <StatCard title="A Receber" value={formatarMoeda(stats.recebimentosPendentesValor)} unit={`(${stats.recebimentosPendentesQtd})`} icon="fas fa-hand-holding-usd" bgColor="bg-purple-50" textColor="text-purple-700" iconColor="text-purple-500" />
        <StatCard title="A Pagar" value={formatarMoeda(stats.despesasAPagarValor)} unit={`(${stats.despesasAPagarQtd})`} icon="fas fa-file-invoice-dollar" bgColor="bg-red-50" textColor="text-red-700" iconColor="text-red-500" />
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Próximos 5 Prazos/Eventos (Não Concluídos)</h3>
        {stats.proximosEventos.length === 0 ? (
          <p className="text-gray-500 italic">Nenhum prazo ou evento próximo para exibir.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {stats.proximosEventos.map(evento => (
              <li key={evento.id} className="py-4 px-2 hover:bg-gray-50 rounded transition-colors duration-150">
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${evento.tipo_evento === 'Prazo' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <i className={`fas ${evento.tipo_evento === 'Prazo' ? 'fa-flag' : 'fa-calendar-check'} fa-fw`}></i>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{evento.titulo}</p>
                        <p className="text-xs text-gray-500">
                            {evento.tipo_evento} - <span className="font-medium">{formatarDataHora(evento.data_inicio)}</span>
                            {evento.caso_id && <span className="ml-2 text-gray-400">(Caso ID: {evento.caso_id})</span>}
                        </p>
                    </div>
                    {/* TODO: Adicionar link ou ação para ver o evento/caso */}
                    {/* <button className="text-xs text-indigo-500 hover:underline">Detalhes</button> */}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Dashboard;