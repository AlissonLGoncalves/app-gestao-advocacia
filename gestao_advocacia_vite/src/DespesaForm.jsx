// Arquivo: src/DespesaForm.jsx
// Formulário para adicionar e editar despesas, utilizando react-toastify.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { toast } from 'react-toastify';

const initialState = {
    caso_id: '', descricao: '', categoria: 'Custas Processuais', valor: '',
    data_vencimento: new Date().toISOString().split('T')[0], data_despesa: '',
    status: 'A Pagar', forma_pagamento: '', notas: ''
};

function DespesaForm({ despesaParaEditar, onDespesaChange, onCancel }) {
    const [formData, setFormData] = useState(initialState);
    const [clientes, setClientes] = useState([]);
    const [casos, setCasos] = useState([]);
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const clearValidationErrors = useCallback(() => setValidationErrors({}), []);

    const fetchClientes = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
            if (!response.ok) throw new Error('Falha ao carregar clientes');
            const data = await response.json();
            setClientes(data.clientes || []);
        } catch (error) { toast.error(`Erro ao carregar clientes: ${error.message}`); }
    }, []);

    const fetchCasos = useCallback(async (clienteId = null) => {
        let url = `${API_URL}/casos?sort_by=titulo&order=asc`;
        if (clienteId) url += `&cliente_id=${clienteId}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha ao carregar casos');
            const data = await response.json();
            setCasos(data.casos || []);
        } catch (error) { toast.error(`Erro ao carregar casos: ${error.message}`); }
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
                            fetchCasos(String(casoData.cliente_id));
                        } else { fetchCasos(); }
                    } else { fetchCasos(); }
                } catch (e) { fetchCasos(); }
            };
            fetchCasoDoCliente();
        } else { fetchCasos(selectedClienteId || null); }
    }, [fetchClientes, fetchCasos, despesaParaEditar, selectedClienteId]);

    useEffect(() => {
        clearValidationErrors();
        if (despesaParaEditar) {
            const dadosEdit = { ...despesaParaEditar };
            ['data_vencimento', 'data_despesa'].forEach(key => {
                if (dadosEdit[key] && typeof dadosEdit[key] === 'string') {
                    dadosEdit[key] = dadosEdit[key].split('T')[0];
                }
            });
            dadosEdit.valor = (dadosEdit.valor === null || dadosEdit.valor === undefined) ? '' : String(dadosEdit.valor);
            dadosEdit.caso_id = dadosEdit.caso_id || '';
            setFormData(dadosEdit);
            setIsEditing(true);
        } else {
            setFormData(initialState);
            setIsEditing(false);
            setSelectedClienteId('');
        }
    }, [despesaParaEditar, clearValidationErrors]);

    const validateForm = () => {
        const errors = {};
        if (!formData.descricao.trim()) errors.descricao = 'Descrição é obrigatória.';
        if (!formData.valor.trim() || isNaN(parseFloat(formData.valor)) || parseFloat(formData.valor) <= 0) errors.valor = 'Valor deve ser um número positivo.';
        if (!formData.data_vencimento) errors.data_vencimento = 'Data de vencimento é obrigatória.';
        if (!formData.status) errors.status = 'Status é obrigatório.';
        if (!formData.categoria) errors.categoria = 'Categoria é obrigatória.';
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
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
        clearValidationErrors();
        if (!validateForm()) {
            toast.error('Por favor, corrija os erros indicados.');
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
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosParaEnviar) });
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} despesa`);
            toast.success(`Despesa ${isEditing ? 'atualizada' : 'adicionada'} com sucesso!`);
            if (typeof onDespesaChange === 'function') onDespesaChange();
            if (isEditing && typeof onCancel === 'function') onCancel();
            if (!isEditing) { setFormData(initialState); setSelectedClienteId('');}
        } catch (error) {
            toast.error(error.message || 'Erro desconhecido.');
        } finally { setLoading(false); }
    };
    
    const categoriasDespesa = ["Custas Processuais", "Honorários Periciais", "Cópias e Impressões", "Deslocamento/Viagem", "Aluguel Escritório", "Contas (Água, Luz, Internet, Telefone)", "Software e Assinaturas", "Material de Escritório", "Marketing e Publicidade", "Impostos e Taxas Escritório", "Outras Despesas"];
    const statusDespesa = ["A Pagar", "Paga", "Vencida", "Cancelada"];
    const formasPagamentoDespesa = ["PIX", "Transferência Bancária", "Boleto", "Cartão de Crédito Corporativo", "Dinheiro", "Débito Automático", "Outro"];

    return (
        <div className="card shadow-sm mb-4"><div className="card-header bg-light"><h5 className="mb-0">{isEditing ? 'Editar Despesa' : 'Adicionar Nova Despesa'}</h5></div>
            <div className="card-body p-4">
                <form onSubmit={handleSubmit}>
                    {/* Campos do formulário aqui, seguindo o padrão */}
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="selectedClienteIdDesp" className="form-label form-label-sm">Filtrar Casos por Cliente (Opcional)</label>
                            <select name="selectedClienteId" id="selectedClienteIdDesp" className="form-select form-select-sm" value={selectedClienteId} onChange={handleChange}>
                                <option value="">Selecione cliente para filtrar casos...</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
                            </select>
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="caso_id_desp" className="form-label form-label-sm">Associar ao Caso (Opcional)</label>
                            <select name="caso_id" id="caso_id_desp" className="form-select form-select-sm" value={formData.caso_id || ''} onChange={handleChange}>
                                <option value="">Nenhum caso (Despesa Geral)</option>
                                {casos.map(cs => (<option key={cs.id} value={cs.id}>{cs.titulo} ({cs.cliente?.nome_razao_social || 'N/A'})</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="descricao_desp" className="form-label form-label-sm">Descrição *</label>
                        <input type="text" name="descricao" id="descricao_desp" className={`form-control form-control-sm ${validationErrors.descricao ? 'is-invalid' : ''}`} value={formData.descricao} onChange={handleChange} />
                        {validationErrors.descricao && <div className="invalid-feedback d-block">{validationErrors.descricao}</div>}
                    </div>
                    {/* Mais campos: Categoria, Valor, Datas, Status, Forma Pagamento, Notas */}
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="categoria_desp" className="form-label form-label-sm">Categoria *</label>
                            <select name="categoria" id="categoria_desp" className={`form-select form-select-sm ${validationErrors.categoria ? 'is-invalid' : ''}`} value={formData.categoria} onChange={handleChange}>
                                {categoriasDespesa.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            {validationErrors.categoria && <div className="invalid-feedback d-block">{validationErrors.categoria}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="valor_desp" className="form-label form-label-sm">Valor (R$) *</label>
                            <input type="number" name="valor" id="valor_desp" className={`form-control form-control-sm ${validationErrors.valor ? 'is-invalid' : ''}`} value={formData.valor} onChange={handleChange} step="0.01" placeholder="Ex: 350.75"/>
                            {validationErrors.valor && <div className="invalid-feedback d-block">{validationErrors.valor}</div>}
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="data_vencimento_desp" className="form-label form-label-sm">Data de Vencimento *</label>
                            <input type="date" name="data_vencimento" id="data_vencimento_desp" className={`form-control form-control-sm ${validationErrors.data_vencimento ? 'is-invalid' : ''}`} value={formData.data_vencimento} onChange={handleChange} />
                            {validationErrors.data_vencimento && <div className="invalid-feedback d-block">{validationErrors.data_vencimento}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="data_despesa_desp" className="form-label form-label-sm">Data da Despesa/Pagamento</label>
                            <input type="date" name="data_despesa" id="data_despesa_desp" className="form-control form-control-sm" value={formData.data_despesa || ''} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="status_desp" className="form-label form-label-sm">Status *</label>
                            <select name="status" id="status_desp" className={`form-select form-select-sm ${validationErrors.status ? 'is-invalid' : ''}`} value={formData.status} onChange={handleChange}>
                                {statusDespesa.map(stat => <option key={stat} value={stat}>{stat}</option>)}
                            </select>
                            {validationErrors.status && <div className="invalid-feedback d-block">{validationErrors.status}</div>}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="forma_pagamento_desp" className="form-label form-label-sm">Forma de Pagamento</label>
                            <select name="forma_pagamento" id="forma_pagamento_desp" className="form-select form-select-sm" value={formData.forma_pagamento || ''} onChange={handleChange}>
                                <option value="">Selecione...</option>
                                {formasPagamentoDespesa.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="notas_desp" className="form-label form-label-sm">Notas</label>
                        <textarea name="notas" id="notas_desp" className="form-control form-control-sm" value={formData.notas || ''} onChange={handleChange} rows="2"></textarea>
                    </div>

                    <hr className="my-4" />
                    <div className="d-flex justify-content-end">
                        {typeof onCancel === 'function' && (<button type="button" className="btn btn-outline-secondary me-2 btn-sm" onClick={onCancel} disabled={loading}>Cancelar</button>)}
                        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || Object.keys(validationErrors).some(key => validationErrors[key])}>
                            {loading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
                            {isEditing ? 'Atualizar Despesa' : 'Adicionar Despesa'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default DespesaForm;