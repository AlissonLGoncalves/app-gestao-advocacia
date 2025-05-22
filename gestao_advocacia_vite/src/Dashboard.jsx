// src/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; // CORRETO: sem a barra no final do nome do arquivo

// Importação dos ícones da biblioteca Heroicons
import {
  UsersIcon as UsersIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ArrowTrendingDownIcon as TrendingDownIconSolid,
  ClockIcon as PrazoIconSolid,
  CalendarDaysIcon as EventoIconSolid
} from '@heroicons/react/24/solid';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

// Log para verificar se o módulo Dashboard.jsx está a ser carregado
console.log("Módulo Dashboard.jsx carregado.");

// Componente reutilizável para os cartões de estatísticas
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
      {/* Exibe '...' se o valor for undefined ou null, indicando carregamento ou ausência de dados */}
      <p className="h5 mb-0 fw-semibold text-dark">{value === undefined || value === null ? '...' : value}</p>
    </div>
  </div>
);

// Componente para item da lista de eventos
const EventListItem = ({ evento, onClick }) => {
  // Validação robusta do objeto evento e suas propriedades
  if (!evento || typeof evento !== 'object' || !evento.id || !evento.data_inicio) {
    console.warn("EventListItem: Objeto 'evento' inválido ou 'data_inicio' ausente.", evento);
    return null; // Não renderiza nada se o evento for inválido
  }

  let dataFormatada = 'Data inválida';
  let horaFormatada = '';
  try {
    const dataObj = new Date(evento.data_inicio);
    if (!isNaN(dataObj.getTime())) { // Verifica se a data é válida
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
        <div className="flex-grow-1 min-w-0"> {/* min-w-0 é importante para o text-truncate funcionar em flex items */}
          <p className="mb-0 fw-medium text-dark text-truncate" style={{fontSize: '0.9rem'}} title={evento.titulo || 'Evento sem título'}>
            {evento.titulo || 'Evento sem título'}
          </p>
          <p className="small text-muted text-truncate mb-0" style={{fontSize: '0.75rem'}} title={`${dataFormatada} ${horaFormatada && `às ${horaFormatada}`} ${evento.caso_titulo ? `| ${evento.caso_titulo}` : ''}`}>
            {dataFormatada} {horaFormatada && `às ${horaFormatada}`}
            {evento.caso_titulo && <span className="ms-1 text-body-secondary">| {evento.caso_titulo}</span>}
          </p>
        </div>
      </div>
      <ChevronRightIcon className="text-muted" style={{ width: '16px', height: '16px' }} />
    </li>
  );
};

function Dashboard({ mudarSecao }) { // mudarSecao é recebida como prop de DashboardPage
  console.log("Componente Dashboard está a ser renderizado.");
  const [stats, setStats] = useState({
    totalClientes: undefined, // Inicializa como undefined para o StatCard mostrar '...'
    casosAtivos: undefined,
    recebimentosPendentesValor: 0, // Mantém 0 para cálculos
    recebimentosPendentesQtd: 0,
    despesasAPagarValor: 0,
    despesasAPagarQtd: 0,
  });
  const [proximosEventos, setProximosEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const fetchDashboardData = useCallback(async () => {
    console.log("Dashboard: fetchDashboardData iniciado.");
    setLoading(true);
    setErro('');
    try {
      const apiRequests = [
        fetch(`${API_URL}/clientes?count_only=true`),
        fetch(`${API_URL}/casos?status=Ativo&count_only=true`),
        fetch(`${API_URL}/eventos?sort_by=data_inicio&order=asc&limit=5&concluido=false`), // Busca eventos não concluídos
        fetch(`${API_URL}/recebimentos?status=Pendente`), // API deve filtrar por pendente e vencido
        fetch(`${API_URL}/despesas?status=A Pagar`),      // API deve filtrar por a pagar e vencida
      ];
      
      const responses = await Promise.all(apiRequests);
      console.log("Dashboard: Respostas da API recebidas.");

      const processResponse = async (res, entityName) => {
        if (!res.ok) {
          let errorBody = `Status: ${res.status}`;
          try {
            const errorJson = await res.json();
            errorBody = errorJson.erro || errorJson.message || JSON.stringify(errorJson);
          } catch (e) {
            // Ignora se o corpo não for JSON válido
          }
          console.error(`Dashboard: Erro na API ao buscar ${entityName}: ${errorBody}`);
          throw new Error(`Falha ao carregar dados de ${entityName.toLowerCase()}.`);
        }
        return res.json();
      };

      const [
        clientesData, casosData, eventosData, recebimentosData, despesasData
      ] = await Promise.all([
        processResponse(responses[0], 'Clientes'),
        processResponse(responses[1], 'Casos Ativos'),
        processResponse(responses[2], 'Próximos Eventos'),
        processResponse(responses[3], 'Recebimentos Pendentes'),
        processResponse(responses[4], 'Despesas a Pagar')
      ]);
      console.log("Dashboard: Dados da API processados:", { clientesData, casosData, eventosData, recebimentosData, despesasData });

      // A API deve retornar os status corretos para estes filtros
      const recebimentosPendentes = (recebimentosData.recebimentos || []);
      const totalPendenteValor = recebimentosPendentes.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);

      const despesasAPagar = (despesasData.despesas || []);
      const totalAPagarValor = despesasAPagar.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);

      setStats({
        totalClientes: clientesData.total_clientes !== undefined ? clientesData.total_clientes : 0,
        casosAtivos: casosData.total_casos !== undefined ? casosData.total_casos : 0,
        recebimentosPendentesValor: totalPendenteValor,
        recebimentosPendentesQtd: recebimentosPendentes.length,
        despesasAPagarValor: totalAPagarValor,
        despesasAPagarQtd: despesasAPagar.length,
      });
      setProximosEventos(eventosData.eventos || []);
      console.log("Dashboard: Estado atualizado com sucesso.");

    } catch (error) {
      console.error("Dashboard: Erro detalhado no fetchDashboardData:", error);
      setErro(error.message || "Ocorreu um erro desconhecido ao carregar os dados do dashboard.");
    } finally {
      setLoading(false);
      console.log("Dashboard: fetchDashboardData finalizado.");
    }
  }, []); // API_URL deve ser estável ou incluída se vier de contexto/props

  useEffect(() => {
    console.log("Dashboard: useEffect a chamar fetchDashboardData.");
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    console.log("Dashboard: A renderizar estado de carregamento.");
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">A carregar...</span>
        </div>
        <p className="ms-3 text-muted fs-5">A carregar Dashboard...</p>
      </div>
    );
  }

  if (erro) {
    console.error("Dashboard: A renderizar estado de erro:", erro);
    return (
        <div className="alert alert-danger mx-auto mt-5" role="alert" style={{maxWidth: "600px"}}>
            <h4 className="alert-heading">Ocorreu um erro!</h4>
            <p>Não foi possível carregar os dados do dashboard. Verifique a sua ligação com a API ou tente novamente mais tarde.</p>
            <hr />
            <p className="mb-0 small">Detalhe do erro: {erro}</p>
        </div>
    );
  }

  const handleCardClick = (secaoConstante) => {
    if (typeof mudarSecao === 'function') {
      console.log("Dashboard: handleCardClick a chamar mudarSecao com:", secaoConstante);
      mudarSecao(secaoConstante); // mudarSecao espera a constante string como 'CLIENTES'
    } else {
      console.warn("Dashboard: prop 'mudarSecao' não é uma função ou não foi passada.");
    }
  };

  console.log("Dashboard: A renderizar conteúdo principal. Stats:", stats, "Eventos:", proximosEventos);
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
        <div className="card-header bg-light"><h2 className="h6 mb-0 text-dark">Próximos Prazos e Eventos (Não Concluídos)</h2></div>
        {proximosEventos && proximosEventos.length > 0 ? (
          <ul className="list-group list-group-flush">
            {proximosEventos.map(evento => ( <EventListItem key={evento.id} evento={evento} onClick={() => handleCardClick('AGENDA')} /> ))}
          </ul>
        ) : (
          <div className="card-body text-center"><p className="text-muted small">Nenhum prazo ou evento pendente e não concluído nos próximos dias.</p></div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
