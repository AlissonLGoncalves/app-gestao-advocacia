// Arquivo: src/EventoAgendaForm.jsx
// Formulário para adicionar e editar eventos/prazos da agenda.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';

const initialState = {
    caso_id: '',
    tipo_evento: 'Lembrete', // Padrão
    titulo: '',
    descricao: '',
    // Define a data e hora atuais como padrão, formatado para datetime-local
    data_inicio: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    data_fim: '',
    local: '',
    concluido: false,
};

function EventoAgendaForm({ eventoParaEditar, onEventoChange, onCancel }) {
    const [formData, setFormData] = useState(initialState);
    const [clientes, setClientes] = useState([]);
    const [casos, setCasos] = useState([]);
    const [selectedClienteId, setSelectedClienteId] = useState('');

    const [isEditing, setIsEditing] = useState(false);
    const [formMessage, setFormMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const clearMessagesAndErrors = useCallback(() => {
        setFormMessage({ text: '', type: '' });
        setValidationErrors({});
    }, []);

    const fetchClientes = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
            if (!response.ok) throw new Error('Falha ao carregar clientes');
            const data = await response.json();
            setClientes(data.clientes || []);
        } catch (error) {
            setFormMessage({ text: `Erro ao carregar clientes: ${error.message}`, type: 'danger' });
        }
    }, []);

    const fetchCasos = useCallback(async (clienteId = null) => {
        let url = `${API_URL}/casos?sort_by=titulo&order=asc`;
        if (clienteId) {
            url += `&cliente_id=${clienteId}`;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha ao carregar casos');
            const data = await response.json();
            setCasos(data.casos || []);
        } catch (error) {
            setFormMessage({ text: `Erro ao carregar casos: ${error.message}`, type: 'danger' });
        }
    }, []);

    useEffect(() => {
        fetchClientes();
        if (eventoParaEditar && eventoParaEditar.caso_id) {
            const fetchCasoDoCliente = async () => {
                try {
                    const casoRes = await fetch(`${API_URL}/casos/${eventoParaEditar.caso_id}`);
                    if(casoRes.ok) {
                        const casoData = await casoRes.json();
                        if(casoData && casoData.cliente_id) {
                            setSelectedClienteId(String(casoData.cliente_id));
                            fetchCasos(String(casoData.cliente_id));
                        } else {
                             fetchCasos();
                        }
                    } else {
                        fetchCasos();
                    }
                } catch (e) {
                    console.error("Erro ao buscar cliente do caso para edição de evento", e);
                    fetchCasos();
                }
            };
            fetchCasoDoCliente();
        } else {
             fetchCasos(selectedClienteId || null);
        }
    }, [fetchClientes, fetchCasos, eventoParaEditar, selectedClienteId]);


    useEffect(() => {
        clearMessagesAndErrors();
        if (eventoParaEditar) {
            const dadosEdit = { ...eventoParaEditar };
            if (dadosEdit.data_inicio && typeof dadosEdit.data_inicio === 'string') {
                dadosEdit.data_inicio = new Date(dadosEdit.data_inicio).toISOString().slice(0,16);
            }
            if (dadosEdit.data_fim && typeof dadosEdit.data_fim === 'string') {
                dadosEdit.data_fim = new Date(dadosEdit.data_fim).toISOString().slice(0,16);
            } else {
                dadosEdit.data_fim = ''; // Garante que é string vazia se for null/undefined
            }
            dadosEdit.caso_id = dadosEdit.caso_id || ''; 
            setFormData(dadosEdit);
            setIsEditing(true);
        } else {
            setFormData(initialState);
            setIsEditing(false);
            setSelectedClienteId('');
        }
    }, [eventoParaEditar, clearMessagesAndErrors]);

    const validateForm = () => {
        const errors = {};
        if (!formData.titulo.trim()) errors.titulo = 'Título é obrigatório.';
        if (!formData.tipo_evento) errors.tipo_evento = 'Tipo de evento é obrigatório.';
        if (!formData.data_inicio) errors.data_inicio = 'Data/Hora de Início é obrigatória.';
        else {
            try { new Date(formData.data_inicio); } catch { errors.data_inicio = 'Formato de Data/Hora de Início inválido.';}
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
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (formMessage.text) clearMessagesAndErrors();
        if (validationErrors[name]) setValidationErrors(prev => ({...prev, [name]: ''}));
        
        if (name === "selectedClienteId") { 
            setSelectedClienteId(value);
            fetchCasos(value); 
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
        clearMessagesAndErrors();
        if (!validateForm()) {
            setFormMessage({ text: 'Por favor, corrija os erros indicados.', type: 'danger' });
            return;
        }
        setLoading(true);

        const dadosParaEnviar = {
            ...formData,
            caso_id: formData.caso_id ? parseInt(formData.caso_id, 10) : null,
            data_inicio: formData.data_inicio ? new Date(formData.data_inicio).toISOString() : null,
            data_fim: formData.data_fim ? new Date(formData.data_fim).toISOString() : null,
        };
        
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
                throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} evento`);
            }
            setFormMessage({ text: `Evento/Prazo ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`, type: 'success' });
            if (typeof onEventoChange === 'function') onEventoChange();
            if (isEditing && typeof onCancel === 'function') {
                setTimeout(() => onCancel(), 1500);
            }
            if (!isEditing) {
                setFormData(initialState);
                setSelectedClienteId('');
            }
        } catch (error) {
            setFormMessage({ text: error.message || 'Erro desconhecido.', type: 'danger' });
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
                {formMessage.text && (
                    <div className={`alert alert-${formMessage.type} alert-dismissible fade show small`} role="alert">
                        {formMessage.text}
                        <button type="button" className="btn-close btn-sm" onClick={clearMessagesAndErrors} aria-label="Close"></button>
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="titulo" className="form-label form-label-sm">Título *</label>
                        <input type="text" name="titulo" id="titulo" className={`form-control form-control-sm ${validationErrors.titulo ? 'is-invalid' : ''}`} value={formData.titulo} onChange={handleChange} />
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
                            <label htmlFor="selectedClienteIdAgenda" className="form-label form-label-sm">Filtrar Casos por Cliente (Opcional)</label>
                             <select 
                                name="selectedClienteId" id="selectedClienteIdAgenda" 
                                className="form-select form-select-sm" 
                                value={selectedClienteId} 
                                onChange={handleChange}
                            >
                                <option value="">Selecione um cliente para filtrar casos...</option>
                                {clientes.map(cliente => (
                                    <option key={cliente.id} value={cliente.id}>{cliente.nome_razao_social}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                     <div className="mb-3">
                        <label htmlFor="caso_id" className="form-label form-label-sm">Associar ao Caso (Opcional)</label>
                        <select name="caso_id" id="caso_id" className="form-select form-select-sm" value={formData.caso_id || ''} onChange={handleChange}>
                            <option value="">Nenhum caso</option>
                            {casos.map(caso => (
                                <option key={caso.id} value={caso.id}>{caso.titulo} ({caso.cliente?.nome_razao_social || 'Cliente N/A'})</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="data_inicio" className="form-label form-label-sm">Data/Hora de Início *</label>
                            <input type="datetime-local" name="data_inicio" id="data_inicio" className={`form-control form-control-sm ${validationErrors.data_inicio ? 'is-invalid' : ''}`} value={formData.data_inicio} onChange={handleChange} />
                            {validationErrors.data_inicio && <div className="invalid-feedback d-block">{validationErrors.data_inicio}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="data_fim" className="form-label form-label-sm">Data/Hora de Fim (Opcional)</label>
                            <input type="datetime-local" name="data_fim" id="data_fim" className={`form-control form-control-sm ${validationErrors.data_fim ? 'is-invalid' : ''}`} value={formData.data_fim} onChange={handleChange} />
                            {validationErrors.data_fim && <div className="invalid-feedback d-block">{validationErrors.data_fim}</div>}
                        </div>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="local" className="form-label form-label-sm">Local (Opcional)</label>
                        <input type="text" name="local" id="local" className="form-control form-control-sm" value={formData.local || ''} onChange={handleChange} />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="descricao" className="form-label form-label-sm">Descrição (Opcional)</label>
                        <textarea name="descricao" id="descricao" className="form-control form-control-sm" value={formData.descricao || ''} onChange={handleChange} rows="3"></textarea>
                    </div>
                    
                    <div className="form-check mb-3">
                        <input className="form-check-input" type="checkbox" name="concluido" id="concluido" checked={formData.concluido} onChange={handleChange} />
                        <label className="form-check-label form-label-sm" htmlFor="concluido">
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
                        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || Object.keys(validationErrors).some(key => validationErrors[key])}>
                            {loading ? (
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            ) : null}
                            {isEditing ? 'Atualizar Evento' : 'Adicionar Evento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EventoAgendaForm;
