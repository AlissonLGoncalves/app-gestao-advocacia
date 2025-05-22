// src/CasoForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; // Ajuste o caminho se config.js não estiver em src/
import { toast } from 'react-toastify';

const initialState = {
    cliente_id: '',
    titulo: '',
    numero_processo: '',
    status: 'Ativo', // Valor padrão
    parte_contraria: '',
    adv_parte_contraria: '',
    tipo_acao: '',
    vara_juizo: '',
    comarca: '',
    instancia: '',
    valor_causa: '',
    data_distribuicao: '', // Deve ser string vazia ou formato YYYY-MM-DD
    notas_caso: ''
};

function CasoForm({ casoParaEditar, onCasoChange, onCancel }) {
  console.log("CasoForm: Renderizando. Caso para editar:", casoParaEditar);

  const [formData, setFormData] = useState(initialState);
  const [clientes, setClientes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  const fetchClientes = useCallback(async () => {
    console.log("CasoForm: fetchClientes chamado.");
    try {
      const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.erro || 'Falha ao carregar clientes');
      }
      const data = await response.json();
      setClientes(data.clientes || []);
      console.log("CasoForm: Clientes carregados:", data.clientes);
    } catch (error) {
      console.error("CasoForm: Erro ao buscar clientes:", error);
      toast.error(`Erro ao carregar clientes: ${error.message}`);
    }
  }, []); // API_URL como dependência se vier de contexto/props

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    console.log("CasoForm: useEffect para casoParaEditar. Valor:", casoParaEditar);
    clearValidationErrors();
    if (casoParaEditar && casoParaEditar.id) { // Verifica se é um objeto válido e tem ID (para edição)
      const dadosEdit = { ...initialState, ...casoParaEditar }; // Garante todos os campos do initialState

      // Formata datas para o input type="date" (YYYY-MM-DD)
      if (dadosEdit.data_distribuicao && typeof dadosEdit.data_distribuicao === 'string') {
        dadosEdit.data_distribuicao = dadosEdit.data_distribuicao.split('T')[0];
      } else if (dadosEdit.data_distribuicao instanceof Date) {
        dadosEdit.data_distribuicao = dadosEdit.data_distribuicao.toISOString().split('T')[0];
      } else {
        dadosEdit.data_distribuicao = ''; // Define como string vazia se for null/undefined
      }

      // Garante que valor_causa seja string para o input
      dadosEdit.valor_causa = (dadosEdit.valor_causa === null || dadosEdit.valor_causa === undefined) ? '' : String(dadosEdit.valor_causa);
      
      // Garante que cliente_id seja string para o select
      dadosEdit.cliente_id = dadosEdit.cliente_id ? String(dadosEdit.cliente_id) : '';

      setFormData(dadosEdit);
      setIsEditing(true);
      console.log("CasoForm: Modo de edição. FormData definido:", dadosEdit);
    } else {
      setFormData(initialState);
      setIsEditing(false);
      console.log("CasoForm: Modo de adição ou casoParaEditar inválido. FormData resetado.");
    }
  }, [casoParaEditar, clearValidationErrors]);

  const validateForm = () => {
    const errors = {};
    if (!formData.titulo || !formData.titulo.trim()) errors.titulo = 'Título do caso é obrigatório.';
    if (!formData.cliente_id) errors.cliente_id = 'Cliente é obrigatório.';
    if (!formData.status || !formData.status.trim()) errors.status = 'Status é obrigatório.';
    
    if (formData.valor_causa && (isNaN(parseFloat(formData.valor_causa)) || parseFloat(formData.valor_causa) < 0)) {
      errors.valor_causa = 'Valor da causa deve ser um número positivo ou zero.';
    }
    // Adicionar mais validações conforme necessário (ex: formato de número de processo)
    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    console.log("CasoForm: Validação do formulário. É válido:", isValid, "Erros:", errors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Limpa erro de validação para o campo que está a ser alterado
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("CasoForm: handleSubmit chamado. FormData atual:", formData);
    clearValidationErrors();
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros indicados no formulário.');
      return;
    }
    setLoading(true);

    const dadosParaEnviar = {
      ...formData,
      valor_causa: formData.valor_causa ? parseFloat(formData.valor_causa) : null,
      data_distribuicao: formData.data_distribuicao || null, // Envia null se a string estiver vazia
      cliente_id: parseInt(formData.cliente_id, 10)
    };
    // Remove campos que não devem ser enviados ou que são apenas para o frontend
    // delete dadosParaEnviar.cliente; // Se 'cliente' for um objeto no formData vindo de to_dict()

    console.log("CasoForm: Enviando dados para API:", dadosParaEnviar);

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
        console.error("CasoForm: Erro da API:", responseData);
        throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} caso. Status: ${response.status}`);
      }

      toast.success(`Caso ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
      if (typeof onCasoChange === 'function') {
        onCasoChange(); // Chama o callback para fechar o formulário e atualizar a lista
      }
      // Não resetar o formulário aqui se onCasoChange já navega para longe
    } catch (error) {
      console.error("CasoForm: Erro no handleSubmit:", error);
      toast.error(error.message || 'Erro desconhecido ao salvar o caso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Caso' : 'Adicionar Novo Caso'}</h5>
      </div>
      <div className="card-body p-4">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="titulo_caso" className="form-label form-label-sm">Título do Caso *</label>
            <input type="text" name="titulo" id="titulo_caso" className={`form-control form-control-sm ${validationErrors.titulo ? 'is-invalid' : ''}`} value={formData.titulo} onChange={handleChange} />
            {validationErrors.titulo && <div className="invalid-feedback d-block">{validationErrors.titulo}</div>}
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="cliente_id_caso" className="form-label form-label-sm">Cliente Associado *</label>
              <select name="cliente_id" id="cliente_id_caso" className={`form-select form-select-sm ${validationErrors.cliente_id ? 'is-invalid' : ''}`} value={formData.cliente_id} onChange={handleChange} disabled={isEditing && !!casoParaEditar?.cliente_id} >
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
              <input type="number" name="valor_causa" id="valor_causa_caso" className={`form-control form-control-sm ${validationErrors.valor_causa ? 'is-invalid' : ''}`} value={formData.valor_causa} onChange={handleChange} step="0.01" placeholder="Ex: 1500.50"/>
              {validationErrors.valor_causa && <div className="invalid-feedback d-block">{validationErrors.valor_causa}</div>}
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="data_distribuicao_caso" className="form-label form-label-sm">Data de Distribuição</label>
              <input type="date" name="data_distribuicao" id="data_distribuicao_caso" className="form-control form-control-sm" value={formData.data_distribuicao} onChange={handleChange} />
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
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || Object.keys(validationErrors).some(key => validationErrors[key] && validationErrors[key] !== '')}>
              {loading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
              {isEditing ? 'Atualizar Caso' : 'Adicionar Caso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CasoForm;
