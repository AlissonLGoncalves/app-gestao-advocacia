// src/components/CalendarView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction'; // Para interatividade como dateClick, eventClick
import listPlugin from '@fullcalendar/list'; // Para visualização em lista
import bootstrap5Plugin from '@fullcalendar/bootstrap5'; // Integração com Bootstrap 5
import ptBrLocale from '@fullcalendar/core/locales/pt-br'; // Importa o locale Português Brasil
import { API_URL } from '../config'; // Ajuste o caminho se necessário
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Estilos do Bootstrap 5 para o FullCalendar (já deve ter o Bootstrap CSS globalmente)
// Se não, pode precisar de: import 'bootstrap/dist/css/bootstrap.css';
// E para os ícones do Bootstrap no calendário: import 'bootstrap-icons/font/bootstrap-icons.css';

function CalendarView() {
  console.log("CalendarView: Renderizando componente.");
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const navigate = useNavigate();

  const fetchEventsForCalendar = useCallback(async () => {
    console.log("CalendarView: fetchEventsForCalendar chamado.");
    setLoadingEvents(true);
    try {
      // Busca todos os eventos. A API pode precisar de parâmetros para buscar eventos num range de datas visível.
      // Para simplificar, vamos buscar todos por enquanto.
      const response = await fetch(`${API_URL}/eventos?sort_by=data_inicio&order=asc`); // Pode adicionar mais filtros se necessário
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("CalendarView: Erro da API ao buscar eventos:", errorData);
        throw new Error(errorData.erro || `Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      console.log("CalendarView: Eventos brutos da API:", data.eventos);

      const formattedEvents = (data.eventos || []).map(evento => {
        // O FullCalendar espera datas no formato ISO string ou objetos Date.
        // A sua API já deve estar a retornar datas em formato ISO.
        let allDayEvent = false;
        if (evento.data_inicio && !evento.data_fim) {
            // Se só tem data_inicio e não tem 'T' (hora), considera dia inteiro
            allDayEvent = !evento.data_inicio.includes('T');
        } else if (evento.data_inicio && evento.data_fim) {
            // Se data_inicio e data_fim são iguais sem parte de hora, pode ser dia inteiro
            const start = new Date(evento.data_inicio);
            const end = new Date(evento.data_fim);
            if (start.toISOString().split('T')[0] === end.toISOString().split('T')[0] &&
                start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0 &&
                end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
                // allDayEvent = true; // FullCalendar pode lidar com isso automaticamente se o fim for exclusivo
            }
        }


        return {
          id: String(evento.id), // ID deve ser string
          title: evento.titulo || 'Evento Sem Título',
          start: evento.data_inicio,
          end: evento.data_fim, // Pode ser null se não houver data de fim
          allDay: allDayEvent,
          extendedProps: { // Para guardar dados extras do evento
            tipo_evento: evento.tipo_evento,
            descricao: evento.descricao,
            local: evento.local,
            concluido: evento.concluido,
            caso_id: evento.caso_id,
            caso_titulo: evento.caso_titulo
          },
          // Pode adicionar classes ou cores com base no tipo_evento ou status
          className: evento.concluido ? 'fc-event-concluido' : (evento.tipo_evento === 'Prazo' ? 'fc-event-prazo' : ''),
          // backgroundColor: evento.tipo_evento === 'Prazo' ? '#dc3545' : '#0d6efd', // Exemplo de cores
          // borderColor: evento.tipo_evento === 'Prazo' ? '#dc3545' : '#0d6efd',
        };
      });
      console.log("CalendarView: Eventos formatados para o calendário:", formattedEvents);
      setEvents(formattedEvents);
    } catch (error) {
      console.error("CalendarView: Erro ao buscar eventos para o calendário:", error);
      toast.error(`Erro ao carregar eventos: ${error.message}`);
    } finally {
      setLoadingEvents(false);
    }
  }, []); // API_URL como dependência se vier de contexto/props

  useEffect(() => {
    fetchEventsForCalendar();
  }, [fetchEventsForCalendar]);

  const handleEventClick = (clickInfo) => {
    console.log("CalendarView: Evento clicado:", clickInfo.event);
    // Navega para a página de edição do evento
    navigate(`/agenda/editar/${clickInfo.event.id}`);
  };

  const handleDateSelect = (selectInfo) => {
    // Permite criar um novo evento ao selecionar um período no calendário
    console.log('CalendarView: Período selecionado:', selectInfo);
    // Passa as datas de início e fim para o formulário de novo evento
    // O formulário precisará de ser adaptado para receber estas props.
    navigate('/agenda/novo', { 
      state: { 
        defaultDataInicio: selectInfo.startStr,
        defaultDataFim: selectInfo.allDay ? null : selectInfo.endStr, // Se for dia inteiro, não passa data fim
        allDay: selectInfo.allDay
      } 
    });
  };
  
  // Função para renderizar o conteúdo do evento (opcional, para mais customização)
  // const renderEventContent = (eventInfo) => {
  //   return (
  //     <>
  //       <b>{eventInfo.timeText}</b>
  //       <i>{eventInfo.event.title}</i>
  //       {eventInfo.event.extendedProps.caso_titulo && <small className="d-block text-muted">{eventInfo.event.extendedProps.caso_titulo}</small>}
  //     </>
  //   );
  // };

  if (loadingEvents) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar calendário...</span>
        </div>
        <span className="ms-3 text-muted">A carregar eventos da agenda...</span>
      </div>
    );
  }

  return (
    <div className="p-1 bg-white rounded shadow-sm"> {/* Adiciona um pouco de padding e estilo ao container */}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, bootstrap5Plugin]}
        themeSystem='bootstrap5' // Usa o tema do Bootstrap 5
        initialView="dayGridMonth"
        locale={ptBrLocale} // Define o idioma para Português do Brasil
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        }}
        buttonText={{ // Traduz os botões, se o locale não o fizer completamente
            today:    'Hoje',
            month:    'Mês',
            week:     'Semana',
            day:      'Dia',
            list:     'Lista'
        }}
        events={events}
        selectable={true} // Permite selecionar datas/slots
        selectMirror={true}
        dayMaxEvents={true} // Limita o número de eventos por dia na visualização de mês (mostra "+X mais")
        select={handleDateSelect}
        eventClick={handleEventClick}
        // eventContent={renderEventContent} // Descomente para usar renderização customizada do evento
        height="auto" // Ajusta a altura automaticamente ao conteúdo, ou defina um valor fixo ex: "70vh"
        contentHeight="auto"
        weekends={true} // Mostra fins de semana
        navLinks={true} // Permite clicar nos números dos dias/semanas para navegar
        editable={false} // Desabilita arrastar e redimensionar eventos por enquanto. Pode ser habilitado depois.
        eventTimeFormat={{ // Formato da hora nos eventos
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false, // false para formato 24h
            hour12: false
        }}
      />
    </div>
  );
}

export default CalendarView;
