// Arquivo: src/DespesaForm.jsx
// Formulário para adicionar e editar despesas.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';

const initialState = {
    caso_id: '', // Pode ser nulo para despesas gerais
    descricao: '',
    categoria: 'Custas Processuais', // Padrão
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0], // Data atual como padrão
    data_despesa: '', // Data do pagamento/ocorrência
    status: 'A Pagar', // Padrão
    forma_pagamento: '',
    notas: ''
};

function DespesaForm({ despesaParaEditar, onDespesaChange, onCancel }) {
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
            console.error("Erro ao buscar clientes:", error);
            setFormMessage({ text: `Erro ao carregar lista de clientes: ${error.message}`, type: 'danger' });
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
            console.error("Erro ao buscar casos:", error);
            setFormMessage({ text: `Erro ao carregar lista de casos: ${error.message}`, type: 'danger' });
        }
    }, []);

    useEffect(() => {
        fetchClientes();
        if (despesaParaEditar && despesaParaEditar.caso_id) {
            const fetchCasoDoCliente = async () => {
                try {
                    const casoRes = await fetch(`${API_URL}/casos/${despesaParaEditar.caso_id}`);
                    if(casoRes.ok) {
                        const casoData = await casoRes.json();
                        if(casoData && casoData.cliente_id) {
                            setSelectedClienteId(String(casoData.cliente_id));
                            fetchCasos(String(casoData.cliente_id)); // Carrega casos do cliente do caso
                        } else {
                             fetchCasos(); // Carrega todos se não encontrar cliente_id no caso
                        }
                    } else {
                        fetchCasos();
                    }
                } catch (e) {
                    console.error("Erro ao buscar cliente do caso para edição da despesa", e);
                    fetchCasos();
                }
            };
            fetchCasoDoCliente();
        } else {
             fetchCasos(selectedClienteId || null); // Carrega casos baseado no filtro de cliente ou todos
        }
    }, [fetchClientes, fetchCasos, despesaParaEditar, selectedClienteId]); // Adicionado selectedClienteId


    useEffect(() => {
        clearMessagesAndErrors();
        if (despesaParaEditar) {
            const dadosEdit = { ...despesaParaEditar };
            if (dadosEdit.data_vencimento && typeof dadosEdit.data_vencimento === 'string') {
                dadosEdit.data_vencimento = dadosEdit.data_vencimento.split('T')[0];
            }
            if (dadosEdit.data_despesa && typeof dadosEdit.data_despesa === 'string') {
                dadosEdit.data_despesa = dadosEdit.data_despesa.split('T')[0];
            }
            if (dadosEdit.valor === null || dadosEdit.valor === undefined) {
                dadosEdit.valor = '';
            } else {
                dadosEdit.valor = String(dadosEdit.valor);
            }
            dadosEdit.caso_id = dadosEdit.caso_id || ''; 
            setFormData(dadosEdit);
            setIsEditing(true);
        } else {
            setFormData(initialState);
            setIsEditing(false);
            setSelectedClienteId(''); // Reseta filtro de cliente ao adicionar nova despesa
        }
    }, [despesaParaEditar, clearMessagesAndErrors]);

    const validateForm = () => {
        const errors = {};
        if (!formData.descricao.trim()) errors.descricao = 'Descrição é obrigatória.';
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
        
        if (name === "selectedClienteId") { 
            setSelectedClienteId(value);
            fetchCasos(value); 
            setFormData(prev => ({ ...prev, caso_id: '' })); 
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
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
            caso_id: formData.caso_id ? parseInt(formData.caso_id, 10) : null,
            data_vencimento: formData.data_vencimento || null,
            data_despesa: formData.data_despesa || null,
        };
        
        try {
            const url = isEditing ? `${API_URL}/despesas/${despesaParaEditar.id}` : `${API_URL}/despesas`;
            const method = isEditing ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosParaEnviar),
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} despesa`);
            }
            setFormMessage({ text: `Despesa ${isEditing ? 'atualizada' : 'adicionada'} com sucesso!`, type: 'success' });
            if (typeof onDespesaChange === 'function') onDespesaChange();
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

    const categoriasDespesa = [
        "Custas Processuais", "Honorários Periciais", "Cópias e Impressões", "Deslocamento/Viagem", 
        "Aluguel Escritório", "Contas (Água, Luz, Internet, Telefone)", "Software e Assinaturas", 
        "Material de Escritório", "Marketing e Publicidade", "Impostos e Taxas Escritório", "Outras Despesas"
    ];
    const statusDespesa = ["A Pagar", "Paga", "Vencida", "Cancelada"];
    const formasPagamentoDespesa = ["PIX", "Transferência Bancária", "Boleto", "Cartão de Crédito Corporativo", "Dinheiro", "Débito Automático", "Outro"];

    return (
        <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
                <h5 className="mb-0">{isEditing ? 'Editar Despesa' : 'Adicionar Nova Despesa'}</h5>
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
                            <label htmlFor="selectedClienteId" className="form-label form-label-sm">Filtrar Casos por Cliente (Opcional)</label>
                            <select 
                                name="selectedClienteId" id="selectedClienteId" 
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
                        <div className="col-md-6 mb-3">
                            <label htmlFor="caso_id" className="form-label form-label-sm">Associar ao Caso (Opcional)</label>
                            <select 
                                name="caso_id" id="caso_id" 
                                className="form-select form-select-sm" 
                                value={formData.caso_id || ''} 
                                onChange={handleChange}
                            >
                                <option value="">Nenhum caso (Despesa Geral)</option>
                                {casos.map(caso => ( // Casos já devem estar filtrados pelo selectedClienteId
                                    <option key={caso.id} value={caso.id}>{caso.titulo} ({caso.cliente?.nome_razao_social || 'Cliente N/A'})</option>
                                ))}
                            </select>
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
                                {categoriasDespesa.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            {validationErrors.categoria && <div className="invalid-feedback d-block">{validationErrors.categoria}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="valor" className="form-label form-label-sm">Valor (R$) *</label>
                            <input type="number" name="valor" id="valor" className={`form-control form-control-sm ${validationErrors.valor ? 'is-invalid' : ''}`} value={formData.valor} onChange={handleChange} step="0.01" placeholder="Ex: 350.75"/>
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
                            <label htmlFor="data_despesa" className="form-label form-label-sm">Data da Despesa/Pagamento</label>
                            <input type="date" name="data_despesa" id="data_despesa" className="form-control form-control-sm" value={formData.data_despesa || ''} onChange={handleChange} />
                        </div>
                    </div>

                     <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="status" className="form-label form-label-sm">Status *</label>
                            <select name="status" id="status" className={`form-select form-select-sm ${validationErrors.status ? 'is-invalid' : ''}`} value={formData.status} onChange={handleChange}>
                                {statusDespesa.map(stat => <option key={stat} value={stat}>{stat}</option>)}
                            </select>
                            {validationErrors.status && <div className="invalid-feedback d-block">{validationErrors.status}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="forma_pagamento" className="form-label form-label-sm">Forma de Pagamento</label>
                            <select name="forma_pagamento" id="forma_pagamento" className="form-select form-select-sm" value={formData.forma_pagamento || ''} onChange={handleChange}>
                                <option value="">Selecione...</option>
                                {formasPagamentoDespesa.map(fp => <option key={fp} value={fp}>{fp}</option>)}
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
                            {isEditing ? 'Atualizar Despesa' : 'Adicionar Despesa'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default DespesaForm;
