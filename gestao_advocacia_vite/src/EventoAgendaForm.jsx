// src/EventoAgendaForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
// Corrigido o caminho de importação para config.js
import { API_URL } from './config.js'; 
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';

// Função para formatar data e hora para o input datetime-local (YYYY-MM-DDTHH:mm)
const formatDateTimeForInput = (dateTimeString) => {
  if (!dateTimeString) return '';
  try {
    const date = new Date(dateTimeString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    if (!dateTimeString.includes('T')) {
        return `${year}-${month}-${day}T00:00`;
    }
    return `${year}-${month}-${day}T${hours}:${minutes}`;

  } catch (error) {
    console.error("Erro ao formatar data e hora para input:", dateTimeString, error);
    if (typeof dateTimeString === 'string' && dateTimeString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return `${dateTimeString}T00:00`;
    }
    return '';
  }
};

const initialState = {
    caso_id: '',
    tipo_evento: 'Lembrete',
    titulo: '',
    descricao: '',
    data_inicio: formatDateTimeForInput(new Date().toISOString()),
    data_fim: '',
    local: '',
    concluido: false,
};

function EventoAgendaForm({ eventoParaEditar, onEventoChange, onCancel }) {
  const location = useLocation();
  console.log("EventoAgendaForm: Renderizando. Evento para editar:", eventoParaEditar, "Location state:", location.state);

  const [formData, setFormData] = useState(initialState);
  const [clientes, setClientes] = useState([]);
  const [casos, setCasos] = useState([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  const fetchClientes = useCallback(async () => {
    console.log("EventoAgendaForm: fetchClientes chamado.");
    try {
      const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
      if (!response.ok) throw new Error('Falha ao carregar clientes');
      const data = await response.json();
      setClientes(data.clientes || []);
      console.log("EventoAgendaForm: Clientes carregados:", data.clientes);
    } catch (error) {
      console.error("EventoAgendaForm: Erro ao buscar clientes:", error);
      toast.error(`Erro ao carregar clientes: ${error.message}`);
    }
  }, []);

  const fetchCasos = useCallback(async (clienteId = null) => {
    console.log("EventoAgendaForm: fetchCasos chamado. Cliente ID para filtro:", clienteId);
    let url = `${API_URL}/casos?sort_by=titulo&order=asc`;
    if (clienteId) {
      url += `&cliente_id=${clienteId}`;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha ao carregar casos');
      const data = await response.json();
      setCasos(data.casos || []);
      console.log("EventoAgendaForm: Casos carregados:", data.casos);
    } catch (error) {
      console.error("EventoAgendaForm: Erro ao buscar casos:", error);
      toast.error(`Erro ao carregar casos: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    console.log("EventoAgendaForm: useEffect para eventoParaEditar. Valor:", eventoParaEditar, "Location state:", location.state);
    clearValidationErrors();
    if (eventoParaEditar && eventoParaEditar.id) { // Modo Edição
      const dadosEdit = { ...initialState, ...eventoParaEditar };
      dadosEdit.data_inicio = formatDateTimeForInput(dadosEdit.data_inicio);
      dadosEdit.data_fim = formatDateTimeForInput(dadosEdit.data_fim);
      dadosEdit.caso_id = dadosEdit.caso_id ? String(dadosEdit.caso_id) : '';
      dadosEdit.concluido = dadosEdit.concluido || false;

      setFormData(dadosEdit);
      setIsEditing(true);
      console.log("EventoAgendaForm: Modo de edição. FormData definido:", dadosEdit);

      if (dadosEdit.caso_id) {
        const casoOriginal = eventoParaEditar.caso_ref; 
        if (casoOriginal && casoOriginal.cliente_id) {
            setSelectedClienteId(String(casoOriginal.cliente_id));
        } else {
            fetch(`${API_URL}/casos/${dadosEdit.caso_id}`)
              .then(res => res.ok ? res.json() : Promise.reject('Caso não encontrado para o evento'))
              .then(casoData => {
                if (casoData && casoData.cliente_id) {
                  setSelectedClienteId(String(casoData.cliente_id));
                }
              })
              .catch(err => console.warn("EventoAgendaForm: Não foi possível determinar o cliente do caso para edição do evento.", err));
        }
      } else {
        setSelectedClienteId('');
      }
    } else { // Modo Adição
      const defaultValuesFromState = location.state || {};
      const newEventInitialState = {
        ...initialState,
        data_inicio: formatDateTimeForInput(defaultValuesFromState.defaultDataInicio || new Date().toISOString()),
        data_fim: formatDateTimeForInput(defaultValuesFromState.defaultDataFim || ''),
      };
      setFormData(newEventInitialState);
      setIsEditing(false);
      setSelectedClienteId('');
      console.log("EventoAgendaForm: Modo de adição. FormData inicial:", newEventInitialState);
    }
  }, [eventoParaEditar, clearValidationErrors, location.state]);

  useEffect(() => {
    console.log("EventoAgendaForm: selectedClienteId mudou para:", selectedClienteId, ". A recarregar casos.");
    fetchCasos(selectedClienteId || null);
  }, [selectedClienteId, fetchCasos]);

  const validateForm = () => {
    const errors = {};
    if (!formData.titulo || !formData.titulo.trim()) errors.titulo = 'Título é obrigatório.';
    if (!formData.tipo_evento) errors.tipo_evento = 'Tipo de evento é obrigatório.';
    if (!formData.data_inicio) {
      errors.data_inicio = 'Data/Hora de Início é obrigatória.';
    } else {
      try { new Date(formData.data_inicio); } 
      catch { errors.data_inicio = 'Formato de Data/Hora de Início inválido.'; }
    }

    if (formData.data_fim) {
      try {
        const inicio = new Date(formData.data_inicio);
        const fim = new Date(formData.data_fim);
        if (fim < inicio) errors.data_fim = 'Data/Hora de Fim não pode ser anterior à Data/Hora de Início.';
      } catch {
        errors.data_fim = 'Formato de Data/Hora de Fim inválido.';
      }
    }
    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    console.log("EventoAgendaForm: Validação. Válido:", isValid, "Erros:", errors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === "selectedClienteId") {
      console.log("EventoAgendaForm: Filtro de cliente (para casos) alterado para:", value);
      setSelectedClienteId(value);
      setFormData(prev => ({ ...prev, caso_id: '' })); 
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("EventoAgendaForm: handleSubmit. FormData:", formData);
    clearValidationErrors();
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros indicados no formulário.');
      return;
    }
    setLoading(true);

    const dataInicioISO = formData.data_inicio ? new Date(formData.data_inicio).toISOString() : null;
    const dataFimISO = formData.data_fim ? new Date(formData.data_fim).toISOString() : null;

    const dadosParaEnviar = {
      ...formData,
      caso_id: formData.caso_id ? parseInt(formData.caso_id, 10) : null,
      data_inicio: dataInicioISO,
      data_fim: dataFimISO,
      concluido: formData.concluido || false,
    };
    console.log("EventoAgendaForm: Enviando dados para API:", dadosParaEnviar);

    try {
      const url = isEditing ? `${API_URL}/eventos/${eventoParaEditar.id}` : `${API_URL}/eventos`;
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosParaEnviar),
      });
      const responseData = await response.json();
      if (!response.ok) {
        console.error("EventoAgendaForm: Erro da API:", responseData);
        throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} evento. Status: ${response.status}`);
      }
      toast.success(`Evento/Prazo ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
      if (typeof onEventoChange === 'function') {
        onEventoChange();
      }
    } catch (error) {
      console.error("EventoAgendaForm: Erro no handleSubmit:", error);
      toast.error(error.message || 'Erro desconhecido ao salvar o evento.');
    } finally {
      setLoading(false);
    }
  };

  const tipoEventoOptions = ["Prazo", "Audiência", "Reunião", "Lembrete", "Outro"];

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Evento/Prazo' : 'Adicionar Novo Evento/Prazo'}</h5>
      </div>
      <div className="card-body p-4">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="titulo_evento" className="form-label form-label-sm">Título *</label>
            <input type="text" name="titulo" id="titulo_evento" className={`form-control form-control-sm ${validationErrors.titulo ? 'is-invalid' : ''}`} value={formData.titulo} onChange={handleChange} />
            {validationErrors.titulo && <div className="invalid-feedback d-block">{validationErrors.titulo}</div>}
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="tipo_evento" className="form-label form-label-sm">Tipo *</label>
              <select name="tipo_evento" id="tipo_evento" className={`form-select form-select-sm ${validationErrors.tipo_evento ? 'is-invalid' : ''}`} value={formData.tipo_evento} onChange={handleChange}>
                {tipoEventoOptions.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
              {validationErrors.tipo_evento && <div className="invalid-feedback d-block">{validationErrors.tipo_evento}</div>}
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="selectedClienteIdEvento" className="form-label form-label-sm">Filtrar Casos por Cliente (Opcional)</label>
              <select name="selectedClienteId" id="selectedClienteIdEvento" className="form-select form-select-sm" value={selectedClienteId} onChange={handleChange}>
                <option value="">Todos os clientes (para casos)</option>
                {clientes.map(cliente => (<option key={cliente.id} value={cliente.id}>{cliente.nome_razao_social}</option>))}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="caso_id_evento" className="form-label form-label-sm">Associar ao Caso (Opcional)</label>
            <select name="caso_id" id="caso_id_evento" className="form-select form-select-sm" value={formData.caso_id || ''} onChange={handleChange} disabled={casos.length === 0 && !selectedClienteId}>
              <option value="">Nenhum caso (Evento Geral)</option>
              {(selectedClienteId ? casos.filter(c => String(c.cliente_id) === selectedClienteId) : casos).map(cs => (
                <option key={cs.id} value={cs.id}>{cs.titulo} ({cs.cliente?.nome_razao_social || 'Cliente N/A'})</option>
              ))}
            </select>
             {!selectedClienteId && casos.length > 0 && <small className="form-text text-muted">Selecione um cliente para filtrar os casos ou deixe em branco para ver todos.</small>}
             {selectedClienteId && (selectedClienteId ? casos.filter(c => String(c.cliente_id) === selectedClienteId) : casos).length === 0 && <small className="form-text text-muted">Nenhum caso encontrado para este cliente.</small>}
          </div>
          
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="data_inicio_evento" className="form-label form-label-sm">Data/Hora de Início *</label>
              <input type="datetime-local" name="data_inicio" id="data_inicio_evento" className={`form-control form-control-sm ${validationErrors.data_inicio ? 'is-invalid' : ''}`} value={formData.data_inicio} onChange={handleChange} />
              {validationErrors.data_inicio && <div className="invalid-feedback d-block">{validationErrors.data_inicio}</div>}
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="data_fim_evento" className="form-label form-label-sm">Data/Hora de Fim (Opcional)</label>
              <input type="datetime-local" name="data_fim" id="data_fim_evento" className={`form-control form-control-sm ${validationErrors.data_fim ? 'is-invalid' : ''}`} value={formData.data_fim} onChange={handleChange} />
              {validationErrors.data_fim && <div className="invalid-feedback d-block">{validationErrors.data_fim}</div>}
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="local_evento" className="form-label form-label-sm">Local (Opcional)</label>
            <input type="text" name="local" id="local_evento" className="form-control form-control-sm" value={formData.local || ''} onChange={handleChange} />
          </div>

          <div className="mb-3">
            <label htmlFor="descricao_evento" className="form-label form-label-sm">Descrição (Opcional)</label>
            <textarea name="descricao" id="descricao_evento" className="form-control form-control-sm" value={formData.descricao || ''} onChange={handleChange} rows="3"></textarea>
          </div>
          
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" name="concluido" id="concluido_evento" checked={!!formData.concluido} onChange={handleChange} />
            <label className="form-check-label form-label-sm" htmlFor="concluido_evento">
              Marcar como Concluído
            </label>
          </div>

          <hr className="my-4" />
          <div className="d-flex justify-content-end">
            {typeof onCancel === 'function' && (
              <button type="button" className="btn btn-outline-secondary me-2 btn-sm" onClick={onCancel} disabled={loading}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || Object.keys(validationErrors).some(key => validationErrors[key] && validationErrors[key] !== '')}>
              {loading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
              {isEditing ? 'Atualizar Evento' : 'Adicionar Evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EventoAgendaForm;
