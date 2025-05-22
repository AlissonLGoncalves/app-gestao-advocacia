// src/DespesaForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { toast } from 'react-toastify';

const initialState = {
    caso_id: '', 
    descricao: '',
    categoria: 'Custas Processuais',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    data_despesa: '',
    status: 'A Pagar',
    forma_pagamento: '',
    notas: ''
};

function DespesaForm({ despesaParaEditar, onDespesaChange, onCancel }) {
  console.log("DespesaForm: Renderizando. Despesa para editar:", despesaParaEditar);

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
    console.log("DespesaForm: fetchClientes chamado.");
    const token = localStorage.getItem('token');
    if (!token) {
        toast.warn("Sessão não encontrada para carregar clientes.");
        return;
    }
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    try {
      const response = await fetch(`${API_URL}/clientes/?sort_by=nome_razao_social&order=asc`, { headers: authHeaders });
      if (!response.ok) throw new Error('Falha ao carregar clientes');
      const data = await response.json();
      setClientes(data.clientes || []);
      console.log("DespesaForm: Clientes carregados:", data.clientes);
    } catch (error) {
      console.error("DespesaForm: Erro ao buscar clientes:", error);
      toast.error(`Erro ao carregar clientes: ${error.message}`);
    }
  }, []);

  const fetchCasos = useCallback(async (clienteId = null) => {
    console.log("DespesaForm: fetchCasos chamado. Cliente ID para filtro:", clienteId);
    const token = localStorage.getItem('token');
    if (!token) {
        toast.warn("Sessão não encontrada para carregar casos.");
        return;
    }
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    let url = `${API_URL}/casos/?sort_by=titulo&order=asc`;
    if (clienteId) {
      url += `&cliente_id=${clienteId}`;
    }
    try {
      const response = await fetch(url, { headers: authHeaders });
      if (!response.ok) throw new Error('Falha ao carregar casos');
      const data = await response.json();
      setCasos(data.casos || []);
      console.log("DespesaForm: Casos carregados:", data.casos);
    } catch (error) {
      console.error("DespesaForm: Erro ao buscar casos:", error);
      toast.error(`Erro ao carregar casos: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
    if (!despesaParaEditar) {
        fetchCasos(selectedClienteId || null);
    }
  }, [fetchClientes, despesaParaEditar, selectedClienteId]);

  useEffect(() => {
    console.log("DespesaForm: useEffect para despesaParaEditar. Valor:", despesaParaEditar);
    clearValidationErrors();
    if (despesaParaEditar && despesaParaEditar.id) {
      const dadosEdit = { ...initialState, ...despesaParaEditar };

      ['data_vencimento', 'data_despesa'].forEach(key => {
        if (dadosEdit[key] && typeof dadosEdit[key] === 'string') {
          dadosEdit[key] = dadosEdit[key].split('T')[0];
        } else if (dadosEdit[key] instanceof Date) {
          dadosEdit[key] = dadosEdit[key].toISOString().split('T')[0];
        } else {
          dadosEdit[key] = '';
        }
      });
      dadosEdit.valor = (dadosEdit.valor === null || dadosEdit.valor === undefined) ? '' : String(dadosEdit.valor);
      dadosEdit.caso_id = dadosEdit.caso_id ? String(dadosEdit.caso_id) : '';

      setFormData(dadosEdit);
      setIsEditing(true);
      console.log("DespesaForm: Modo de edição. FormData definido:", dadosEdit);

      if (dadosEdit.caso_id) {
        const casoOriginal = despesaParaEditar.caso_associado_ref; // Supondo que a API envie esta referência
        if (casoOriginal && casoOriginal.cliente_id) {
            setSelectedClienteId(String(casoOriginal.cliente_id));
        } else {
            // Fallback se a referência não vier, busca o caso para achar o cliente
            const token = localStorage.getItem('token');
            if(token) {
                fetch(`${API_URL}/casos/${dadosEdit.caso_id}`, { headers: { 'Authorization': `Bearer ${token}` } })
                  .then(res => res.ok ? res.json() : Promise.reject('Caso não encontrado para despesa'))
                  .then(casoData => {
                    if (casoData && casoData.cliente_id) {
                      setSelectedClienteId(String(casoData.cliente_id));
                    }
                  })
                  .catch(err => console.warn("DespesaForm: Não foi possível determinar o cliente do caso para edição.", err));
            }
        }
      } else {
        setSelectedClienteId('');
      }
    } else {
      setFormData(initialState);
      setIsEditing(false);
      setSelectedClienteId('');
      console.log("DespesaForm: Modo de adição. FormData resetado.");
    }
  }, [despesaParaEditar, clearValidationErrors]);

  useEffect(() => {
    console.log("DespesaForm: selectedClienteId mudou para:", selectedClienteId, ". A recarregar casos.");
    fetchCasos(selectedClienteId || null);
  }, [selectedClienteId, fetchCasos]);

  const validateForm = () => {
    const errors = {};
    if (!formData.descricao || !formData.descricao.trim()) errors.descricao = 'Descrição é obrigatória.';
    if (!formData.valor || isNaN(parseFloat(formData.valor)) || parseFloat(formData.valor) <= 0) {
      errors.valor = 'Valor deve ser um número positivo.';
    }
    if (!formData.data_vencimento) errors.data_vencimento = 'Data de vencimento é obrigatória.';
    if (!formData.status) errors.status = 'Status é obrigatório.';
    if (!formData.categoria) errors.categoria = 'Categoria é obrigatória.';
    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    console.log("DespesaForm: Validação. Válido:", isValid, "Erros:", errors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (name === "selectedClienteId") {
      console.log("DespesaForm: Filtro de cliente alterado para:", value);
      setSelectedClienteId(value);
      setFormData(prev => ({ ...prev, caso_id: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("DespesaForm: handleSubmit. FormData:", formData);
    clearValidationErrors();
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros indicados no formulário.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        toast.error("Autenticação necessária para salvar. Faça login.");
        setLoading(false);
        return;
    }
    const authHeaders = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    setLoading(true);

    const dadosParaEnviar = {
      ...formData,
      valor: parseFloat(formData.valor),
      caso_id: formData.caso_id ? parseInt(formData.caso_id, 10) : null,
      data_vencimento: formData.data_vencimento || null,
      data_despesa: formData.data_despesa || null,
    };
    console.log("DespesaForm: Enviando dados para API:", dadosParaEnviar);

    try {
      const url = isEditing ? `${API_URL}/despesas/${despesaParaEditar.id}` : `${API_URL}/despesas/`; // Adicionada barra final para POST
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(dadosParaEnviar),
      });
      const responseData = await response.json();
      if (!response.ok) {
        console.error("DespesaForm: Erro da API:", responseData);
        throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} despesa. Status: ${response.status}`);
      }
      toast.success(`Despesa ${isEditing ? 'atualizada' : 'adicionada'} com sucesso!`);
      if (typeof onDespesaChange === 'function') {
        onDespesaChange();
      }
      if (!isEditing) setFormData(initialState); // Resetar apenas se for novo
    } catch (error) {
      console.error("DespesaForm: Erro no handleSubmit:", error);
      toast.error(error.message || 'Erro desconhecido ao salvar a despesa.');
    } finally {
      setLoading(false);
    }
  };

  const categoriasDespesa = ["Custas Processuais", "Honorários Periciais", "Cópias e Impressões", "Deslocamento/Viagem", "Aluguer Escritório", "Contas (Água, Luz, Internet, Telefone)", "Software e Assinaturas", "Material de Escritório", "Marketing e Publicidade", "Impostos e Taxas Escritório", "Outras Despesas"];
  const statusDespesa = ["A Pagar", "Paga", "Vencida", "Cancelada"];
  const formasPagamentoDespesa = ["PIX", "Transferência Bancária", "Boleto", "Cartão de Crédito Corporativo", "Dinheiro", "Débito Automático", "Outro"];

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Despesa' : 'Adicionar Nova Despesa'}</h5>
      </div>
      <div className="card-body p-4">
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="selectedClienteIdDesp" className="form-label form-label-sm">Filtrar Casos por Cliente (Opcional)</label>
              <select name="selectedClienteId" id="selectedClienteIdDesp" className="form-select form-select-sm" value={selectedClienteId} onChange={handleChange}>
                <option value="">Todos os clientes (para casos)</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="caso_id_desp" className="form-label form-label-sm">Associar ao Caso (Opcional)</label>
              <select name="caso_id" id="caso_id_desp" className="form-select form-select-sm" value={formData.caso_id || ''} onChange={handleChange} disabled={casos.length === 0 && !selectedClienteId}>
                <option value="">Nenhum caso (Despesa Geral)</option>
                {(selectedClienteId ? casos.filter(c => String(c.cliente_id) === selectedClienteId) : casos).map(cs => (
                  <option key={cs.id} value={cs.id}>{cs.titulo} ({cs.cliente?.nome_razao_social || 'Cliente N/A'})</option>
                ))}
              </select>
              {!selectedClienteId && casos.length > 0 && <small className="form-text text-muted">Selecione um cliente para filtrar os casos ou deixe em branco para ver todos.</small>}
              {selectedClienteId && casos.filter(c => String(c.cliente_id) === selectedClienteId).length === 0 && <small className="form-text text-muted">Nenhum caso encontrado para este cliente.</small>}
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="descricao_desp" className="form-label form-label-sm">Descrição *</label>
            <input type="text" name="descricao" id="descricao_desp" className={`form-control form-control-sm ${validationErrors.descricao ? 'is-invalid' : ''}`} value={formData.descricao} onChange={handleChange} />
            {validationErrors.descricao && <div className="invalid-feedback d-block">{validationErrors.descricao}</div>}
          </div>

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
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || Object.keys(validationErrors).some(key => validationErrors[key] && validationErrors[key] !== '')}>
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