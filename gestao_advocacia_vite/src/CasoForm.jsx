// Arquivo: src/CasoForm.jsx
// Formulário para adicionar e editar casos, utilizando react-toastify para feedback.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { toast } from 'react-toastify';

const initialState = {
    cliente_id: '',
    titulo: '',
    numero_processo: '',
    status: 'Ativo',
    parte_contraria: '',
    adv_parte_contraria: '',
    tipo_acao: '',
    vara_juizo: '',
    comarca: '',
    instancia: '',
    valor_causa: '',
    data_distribuicao: '',
    notas_caso: ''
};

function CasoForm({ casoParaEditar, onCasoChange, onCancel }) {
    const [formData, setFormData] = useState(initialState);
    const [clientes, setClientes] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const clearValidationErrors = useCallback(() => {
        setValidationErrors({});
    }, []);

    const fetchClientes = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
            if (!response.ok) throw new Error('Falha ao carregar clientes');
            const data = await response.json();
            setClientes(data.clientes || []);
        } catch (error) {
            console.error("Erro ao buscar clientes para o formulário de caso:", error);
            toast.error(`Erro ao carregar clientes: ${error.message}`);
        }
    }, []);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

    useEffect(() => {
        clearValidationErrors();
        if (casoParaEditar) {
            const dadosEdit = { ...casoParaEditar };
            if (dadosEdit.data_distribuicao && typeof dadosEdit.data_distribuicao === 'string') {
                dadosEdit.data_distribuicao = dadosEdit.data_distribuicao.split('T')[0];
            }
            if (dadosEdit.valor_causa === null || dadosEdit.valor_causa === undefined) {
                dadosEdit.valor_causa = '';
            } else {
                dadosEdit.valor_causa = String(dadosEdit.valor_causa);
            }
            setFormData(dadosEdit);
            setIsEditing(true);
        } else {
            setFormData(initialState);
            setIsEditing(false);
        }
    }, [casoParaEditar, clearValidationErrors]);

    const validateForm = () => {
        const errors = {};
        if (!formData.titulo.trim()) errors.titulo = 'Título do caso é obrigatório.';
        if (!formData.cliente_id) errors.cliente_id = 'Cliente é obrigatório.';
        if (!formData.status.trim()) errors.status = 'Status é obrigatório.';
        if (formData.valor_causa && isNaN(parseFloat(formData.valor_causa))) {
            errors.valor_causa = 'Valor da causa deve ser um número.';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (validationErrors[name]) setValidationErrors(prev => ({...prev, [name]: ''}));
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearValidationErrors();
        if (!validateForm()) {
            toast.error('Por favor, corrija os erros indicados.');
            return;
        }
        setLoading(true);
        const dadosParaEnviar = {
            ...formData,
            valor_causa: formData.valor_causa ? parseFloat(formData.valor_causa) : null,
            data_distribuicao: formData.data_distribuicao || null,
            cliente_id: parseInt(formData.cliente_id, 10)
        };

        try {
            const url = isEditing ? `${API_URL}/casos/${casoParaEditar.id}` : `${API_URL}/casos`;
            const method = isEditing ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosParaEnviar),
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} caso`);
            }
            toast.success(`Caso ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
            if (typeof onCasoChange === 'function') onCasoChange();
            if (isEditing && typeof onCancel === 'function') onCancel();
            if (!isEditing) setFormData(initialState);
        } catch (error) {
            toast.error(error.message || 'Erro desconhecido ao salvar caso.');
        } finally { setLoading(false); }
    };

    return (
        <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
                <h5 className="mb-0">{isEditing ? 'Editar Caso' : 'Adicionar Novo Caso'}</h5>
            </div>
            <div className="card-body p-4">
                {/* Removida a renderização do formMessage local */}
                <form onSubmit={handleSubmit}>
                     <div className="mb-3">
                        <label htmlFor="titulo_caso" className="form-label form-label-sm">Título do Caso *</label>
                        <input type="text" name="titulo" id="titulo_caso" className={`form-control form-control-sm ${validationErrors.titulo ? 'is-invalid' : ''}`} value={formData.titulo} onChange={handleChange} />
                        {validationErrors.titulo && <div className="invalid-feedback d-block">{validationErrors.titulo}</div>}
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="cliente_id_caso" className="form-label form-label-sm">Cliente Associado *</label>
                            <select name="cliente_id" id="cliente_id_caso" className={`form-select form-select-sm ${validationErrors.cliente_id ? 'is-invalid' : ''}`} value={formData.cliente_id} onChange={handleChange} disabled={isEditing}>
                                <option value="">Selecione um cliente...</option>
                                {clientes.map(cliente => (
                                    <option key={cliente.id} value={cliente.id}>{cliente.nome_razao_social}</option>
                                ))}
                            </select>
                            {validationErrors.cliente_id && <div className="invalid-feedback d-block">{validationErrors.cliente_id}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="status_caso" className="form-label form-label-sm">Status *</label>
                            <select name="status" id="status_caso" className={`form-select form-select-sm ${validationErrors.status ? 'is-invalid' : ''}`} value={formData.status} onChange={handleChange}>
                                <option value="Ativo">Ativo</option>
                                <option value="Suspenso">Suspenso</option>
                                <option value="Encerrado">Encerrado</option>
                                <option value="Arquivado">Arquivado</option>
                            </select>
                            {validationErrors.status && <div className="invalid-feedback d-block">{validationErrors.status}</div>}
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="numero_processo_caso" className="form-label form-label-sm">Número do Processo</label>
                            <input type="text" name="numero_processo" id="numero_processo_caso" className="form-control form-control-sm" value={formData.numero_processo || ''} onChange={handleChange} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="tipo_acao_caso" className="form-label form-label-sm">Tipo de Ação</label>
                            <input type="text" name="tipo_acao" id="tipo_acao_caso" className="form-control form-control-sm" value={formData.tipo_acao || ''} onChange={handleChange} />
                        </div>
                    </div>
                    
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="parte_contraria_caso" className="form-label form-label-sm">Parte Contrária</label>
                            <input type="text" name="parte_contraria" id="parte_contraria_caso" className="form-control form-control-sm" value={formData.parte_contraria || ''} onChange={handleChange} />
                        </div>
                         <div className="col-md-6 mb-3">
                            <label htmlFor="adv_parte_contraria_caso" className="form-label form-label-sm">Adv. Parte Contrária</label>
                            <input type="text" name="adv_parte_contraria" id="adv_parte_contraria_caso" className="form-control form-control-sm" value={formData.adv_parte_contraria || ''} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label htmlFor="vara_juizo_caso" className="form-label form-label-sm">Vara/Juízo</label>
                            <input type="text" name="vara_juizo" id="vara_juizo_caso" className="form-control form-control-sm" value={formData.vara_juizo || ''} onChange={handleChange} />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label htmlFor="comarca_caso" className="form-label form-label-sm">Comarca</label>
                            <input type="text" name="comarca" id="comarca_caso" className="form-control form-control-sm" value={formData.comarca || ''} onChange={handleChange} />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label htmlFor="instancia_caso" className="form-label form-label-sm">Instância</label>
                            <input type="text" name="instancia" id="instancia_caso" className="form-control form-control-sm" value={formData.instancia || ''} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="valor_causa_caso" className="form-label form-label-sm">Valor da Causa (R$)</label>
                            <input type="number" name="valor_causa" id="valor_causa_caso" className={`form-control form-control-sm ${validationErrors.valor_causa ? 'is-invalid' : ''}`} value={formData.valor_causa || ''} onChange={handleChange} step="0.01" placeholder="Ex: 1500.50"/>
                            {validationErrors.valor_causa && <div className="invalid-feedback d-block">{validationErrors.valor_causa}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="data_distribuicao_caso" className="form-label form-label-sm">Data de Distribuição</label>
                            <input type="date" name="data_distribuicao" id="data_distribuicao_caso" className="form-control form-control-sm" value={formData.data_distribuicao || ''} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="notas_caso_form" className="form-label form-label-sm">Notas sobre o Caso</label>
                        <textarea name="notas_caso" id="notas_caso_form" className="form-control form-control-sm" value={formData.notas_caso || ''} onChange={handleChange} rows="3"></textarea>
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
                            {isEditing ? 'Atualizar Caso' : 'Adicionar Caso'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CasoForm;