// Arquivo: src/RecebimentoForm.jsx
// Formulário para adicionar e editar recebimentos.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';

const initialState = {
    cliente_id: '',
    caso_id: '',
    descricao: '',
    categoria: 'Honorários Advocatícios', // Padrão
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0], // Data atual como padrão
    data_recebimento: '',
    status: 'Pendente', // Padrão
    forma_pagamento: '',
    notas: ''
};

function RecebimentoForm({ recebimentoParaEditar, onRecebimentoChange, onCancel }) {
    const [formData, setFormData] = useState(initialState);
    const [clientes, setClientes] = useState([]);
    const [casos, setCasos] = useState([]); // Casos filtrados pelo cliente selecionado
    const [isEditing, setIsEditing] = useState(false);
    const [formMessage, setFormMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const clearMessagesAndErrors = useCallback(() => {
        setFormMessage({ text: '', type: '' });
        setValidationErrors({});
    }, []);

    // Busca clientes para o select
    const fetchClientes = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
            if (!response.ok) throw new Error('Falha ao carregar clientes');
            const data = await response.json();
            setClientes(data.clientes || []);
        } catch (error) {
            console.error("Erro ao buscar clientes:", error);
            setFormMessage({ text: `Erro ao carregar lista de clientes: ${error.message}`, type: 'danger' });
        }
    }, []);

    // Busca casos, opcionalmente filtrados por cliente_id
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
            console.error("Erro ao buscar casos:", error);
            setFormMessage({ text: `Erro ao carregar lista de casos: ${error.message}`, type: 'danger' });
        }
    }, []);

    useEffect(() => {
        fetchClientes();
        // Carrega todos os casos inicialmente se não estiver editando, ou filtra se estiver
        if (recebimentoParaEditar && recebimentoParaEditar.cliente_id) {
            fetchCasos(recebimentoParaEditar.cliente_id);
        } else if (!recebimentoParaEditar) {
             fetchCasos(); // Carrega todos os casos se for um novo recebimento
        }
    }, [fetchClientes, fetchCasos, recebimentoParaEditar]);


    useEffect(() => {
        clearMessagesAndErrors();
        if (recebimentoParaEditar) {
            const dadosEdit = { ...recebimentoParaEditar };
            if (dadosEdit.data_vencimento && typeof dadosEdit.data_vencimento === 'string') {
                dadosEdit.data_vencimento = dadosEdit.data_vencimento.split('T')[0];
            }
            if (dadosEdit.data_recebimento && typeof dadosEdit.data_recebimento === 'string') {
                dadosEdit.data_recebimento = dadosEdit.data_recebimento.split('T')[0];
            }
             if (dadosEdit.valor === null || dadosEdit.valor_causa === undefined) {
                dadosEdit.valor = '';
            } else {
                dadosEdit.valor = String(dadosEdit.valor);
            }
            setFormData(dadosEdit);
            setIsEditing(true);
        } else {
            setFormData(initialState);
            setIsEditing(false);
        }
    }, [recebimentoParaEditar, clearMessagesAndErrors]);

    const validateForm = () => {
        const errors = {};
        if (!formData.descricao.trim()) errors.descricao = 'Descrição é obrigatória.';
        if (!formData.cliente_id) errors.cliente_id = 'Cliente é obrigatório.';
        if (!formData.caso_id) errors.caso_id = 'Caso é obrigatório.';
        if (!formData.valor.trim() || isNaN(parseFloat(formData.valor)) || parseFloat(formData.valor) <= 0) {
            errors.valor = 'Valor deve ser um número positivo.';
        }
        if (!formData.data_vencimento) errors.data_vencimento = 'Data de vencimento é obrigatória.';
        if (!formData.status) errors.status = 'Status é obrigatório.';
        if (!formData.categoria) errors.categoria = 'Categoria é obrigatória.';
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (formMessage.text) clearMessagesAndErrors();
        if (validationErrors[name]) setValidationErrors(prev => ({...prev, [name]: ''}));
        
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === "cliente_id") {
            fetchCasos(value); // Filtra casos quando o cliente muda
            setFormData(prev => ({ ...prev, caso_id: '' })); // Reseta o caso selecionado
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
            valor: parseFloat(formData.valor),
            cliente_id: parseInt(formData.cliente_id, 10),
            caso_id: parseInt(formData.caso_id, 10),
            data_vencimento: formData.data_vencimento || null,
            data_recebimento: formData.data_recebimento || null,
        };
        
        try {
            const url = isEditing ? `${API_URL}/recebimentos/${recebimentoParaEditar.id}` : `${API_URL}/recebimentos`;
            const method = isEditing ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosParaEnviar),
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} recebimento`);
            }
            setFormMessage({ text: `Recebimento ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`, type: 'success' });
            if (typeof onRecebimentoChange === 'function') onRecebimentoChange();
            if (isEditing && typeof onCancel === 'function') {
                setTimeout(() => onCancel(), 1500);
            }
            if (!isEditing) {
                setFormData(initialState);
            }
        } catch (error) {
            setFormMessage({ text: error.message || 'Erro desconhecido.', type: 'danger' });
        } finally {
            setLoading(false);
        }
    };

    // Opções para o select de Categoria
    const categoriasRecebimento = [
        "Honorários Advocatícios", "Honorários de Êxito", "Consultoria", 
        "Custas Processuais (Reembolso)", "Despesas (Reembolso)", "Acordo Judicial", 
        "Outros Recebimentos"
    ];
    // Opções para o select de Status
    const statusRecebimento = ["Pendente", "Pago", "Vencido", "Cancelado", "Em Negociação"];
    // Opções para Forma de Pagamento
    const formasPagamento = ["PIX", "Transferência Bancária", "Boleto", "Cartão de Crédito", "Dinheiro", "Cheque", "Outro"];


    return (
        <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
                <h5 className="mb-0">{isEditing ? 'Editar Recebimento' : 'Adicionar Novo Recebimento'}</h5>
            </div>
            <div className="card-body p-4">
                {formMessage.text && (
                    <div className={`alert alert-${formMessage.type} alert-dismissible fade show small`} role="alert">
                        {formMessage.text}
                        <button type="button" className="btn-close btn-sm" onClick={clearMessagesAndErrors} aria-label="Close"></button>
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="cliente_id" className="form-label form-label-sm">Cliente Associado *</label>
                            <select 
                                name="cliente_id" id="cliente_id" 
                                className={`form-select form-select-sm ${validationErrors.cliente_id ? 'is-invalid' : ''}`} 
                                value={formData.cliente_id} 
                                onChange={handleChange}
                                disabled={isEditing} // Desabilita se estiver editando para não mudar o cliente de um recebimento existente
                            >
                                <option value="">Selecione um cliente...</option>
                                {clientes.map(cliente => (
                                    <option key={cliente.id} value={cliente.id}>{cliente.nome_razao_social}</option>
                                ))}
                            </select>
                            {validationErrors.cliente_id && <div className="invalid-feedback d-block">{validationErrors.cliente_id}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="caso_id" className="form-label form-label-sm">Caso Associado *</label>
                            <select 
                                name="caso_id" id="caso_id" 
                                className={`form-select form-select-sm ${validationErrors.caso_id ? 'is-invalid' : ''}`} 
                                value={formData.caso_id} 
                                onChange={handleChange}
                                disabled={isEditing || !formData.cliente_id} // Desabilita se editando ou se nenhum cliente selecionado
                            >
                                <option value="">Selecione um caso...</option>
                                {casos
                                    .filter(caso => !formData.cliente_id || caso.cliente_id === parseInt(formData.cliente_id))
                                    .map(caso => (
                                    <option key={caso.id} value={caso.id}>{caso.titulo}</option>
                                ))}
                            </select>
                            {validationErrors.caso_id && <div className="invalid-feedback d-block">{validationErrors.caso_id}</div>}
                        </div>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="descricao" className="form-label form-label-sm">Descrição *</label>
                        <input type="text" name="descricao" id="descricao" className={`form-control form-control-sm ${validationErrors.descricao ? 'is-invalid' : ''}`} value={formData.descricao} onChange={handleChange} />
                        {validationErrors.descricao && <div className="invalid-feedback d-block">{validationErrors.descricao}</div>}
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="categoria" className="form-label form-label-sm">Categoria *</label>
                            <select name="categoria" id="categoria" className={`form-select form-select-sm ${validationErrors.categoria ? 'is-invalid' : ''}`} value={formData.categoria} onChange={handleChange}>
                                {categoriasRecebimento.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            {validationErrors.categoria && <div className="invalid-feedback d-block">{validationErrors.categoria}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="valor" className="form-label form-label-sm">Valor (R$) *</label>
                            <input type="number" name="valor" id="valor" className={`form-control form-control-sm ${validationErrors.valor ? 'is-invalid' : ''}`} value={formData.valor} onChange={handleChange} step="0.01" placeholder="Ex: 1500.00"/>
                            {validationErrors.valor && <div className="invalid-feedback d-block">{validationErrors.valor}</div>}
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="data_vencimento" className="form-label form-label-sm">Data de Vencimento *</label>
                            <input type="date" name="data_vencimento" id="data_vencimento" className={`form-control form-control-sm ${validationErrors.data_vencimento ? 'is-invalid' : ''}`} value={formData.data_vencimento} onChange={handleChange} />
                            {validationErrors.data_vencimento && <div className="invalid-feedback d-block">{validationErrors.data_vencimento}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="data_recebimento" className="form-label form-label-sm">Data de Recebimento</label>
                            <input type="date" name="data_recebimento" id="data_recebimento" className="form-control form-control-sm" value={formData.data_recebimento || ''} onChange={handleChange} />
                        </div>
                    </div>

                     <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="status" className="form-label form-label-sm">Status *</label>
                            <select name="status" id="status" className={`form-select form-select-sm ${validationErrors.status ? 'is-invalid' : ''}`} value={formData.status} onChange={handleChange}>
                                {statusRecebimento.map(stat => <option key={stat} value={stat}>{stat}</option>)}
                            </select>
                            {validationErrors.status && <div className="invalid-feedback d-block">{validationErrors.status}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="forma_pagamento" className="form-label form-label-sm">Forma de Pagamento</label>
                            <select name="forma_pagamento" id="forma_pagamento" className="form-select form-select-sm" value={formData.forma_pagamento || ''} onChange={handleChange}>
                                <option value="">Selecione...</option>
                                {formasPagamento.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="notas" className="form-label form-label-sm">Notas</label>
                        <textarea name="notas" id="notas" className="form-control form-control-sm" value={formData.notas || ''} onChange={handleChange} rows="2"></textarea>
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
                            {isEditing ? 'Atualizar Recebimento' : 'Adicionar Recebimento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default RecebimentoForm;
