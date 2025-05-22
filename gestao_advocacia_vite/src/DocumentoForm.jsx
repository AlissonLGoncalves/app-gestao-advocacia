// src/DocumentoForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { toast } from 'react-toastify';

const initialState = {
    descricao: '',
    cliente_id: '',
    caso_id: '',
};

function DocumentoForm({ documentoParaEditar, onDocumentoChange, onCancel }) {
  console.log("DocumentoForm: Renderizando. Documento para editar (metadados):", documentoParaEditar);

  const [formData, setFormData] = useState(initialState);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileNameDisplay, setFileNameDisplay] = useState('');
  
  const [clientes, setClientes] = useState([]);
  const [casos, setCasos] = useState([]);
  const [selectedClienteIdForCasoFilter, setSelectedClienteIdForCasoFilter] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  const fetchClientes = useCallback(async () => {
    console.log("DocumentoForm: fetchClientes chamado.");
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
      console.log("DocumentoForm: Clientes carregados:", data.clientes);
    } catch (error) {
      console.error("DocumentoForm: Erro ao buscar clientes:", error);
      toast.error(`Erro ao carregar clientes: ${error.message}`);
    }
  }, []);

  const fetchCasos = useCallback(async (clienteId = null) => {
    console.log("DocumentoForm: fetchCasos chamado. Cliente ID para filtro:", clienteId);
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
      console.log("DocumentoForm: Casos carregados:", data.casos);
    } catch (error) {
      console.error("DocumentoForm: Erro ao buscar casos:", error);
      toast.error(`Erro ao carregar casos: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
    fetchCasos(selectedClienteIdForCasoFilter || null);
  }, [fetchClientes, selectedClienteIdForCasoFilter, fetchCasos]);

  useEffect(() => {
    console.log("DocumentoForm: useEffect para documentoParaEditar. Valor:", documentoParaEditar);
    clearValidationErrors();
    setSelectedFile(null);

    if (documentoParaEditar && documentoParaEditar.id) {
      const dadosEdit = {
        descricao: documentoParaEditar.descricao || '',
        cliente_id: documentoParaEditar.cliente_id ? String(documentoParaEditar.cliente_id) : '',
        caso_id: documentoParaEditar.caso_id ? String(documentoParaEditar.caso_id) : '',
      };
      setFormData(dadosEdit);
      setFileNameDisplay(documentoParaEditar.nome_original_arquivo || 'Nenhum arquivo associado (apenas metadados)');
      setIsEditing(true);
      console.log("DocumentoForm: Modo de edição. FormData definido:", dadosEdit);

      if (documentoParaEditar.cliente_id) {
        setSelectedClienteIdForCasoFilter(String(documentoParaEditar.cliente_id));
      } else {
        setSelectedClienteIdForCasoFilter('');
        fetchCasos(null);
      }
    } else {
      setFormData(initialState);
      setFileNameDisplay('');
      setIsEditing(false);
      setSelectedClienteIdForCasoFilter('');
      console.log("DocumentoForm: Modo de adição. FormData resetado.");
    }
  }, [documentoParaEditar, clearValidationErrors, fetchCasos]); // Adicionado fetchCasos para garantir que é chamado se selectedClienteIdForCasoFilter mudar

  const validateForm = () => {
    const errors = {};
    if (!isEditing && !selectedFile) {
      errors.arquivo = 'A seleção de um arquivo é obrigatória para novos documentos.';
    }
    if (!formData.descricao || !formData.descricao.trim()) {
      errors.descricao = 'A descrição do documento é obrigatória.';
    }
    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    console.log("DocumentoForm: Validação. Válido:", isValid, "Erros:", errors);
    return isValid;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileNameDisplay(file.name);
      if (validationErrors.arquivo) {
        setValidationErrors(prev => ({ ...prev, arquivo: '' }));
      }
      console.log("DocumentoForm: Arquivo selecionado:", file.name);
    } else {
      setSelectedFile(null);
      setFileNameDisplay(isEditing ? (documentoParaEditar?.nome_original_arquivo || '') : '');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === "cliente_id") {
      console.log("DocumentoForm: Filtro de cliente (para casos) alterado para:", value);
      setSelectedClienteIdForCasoFilter(value);
      setFormData(prev => ({ ...prev, cliente_id: value, caso_id: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("DocumentoForm: handleSubmit. FormData:", formData, "Arquivo selecionado:", selectedFile);
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
    setLoading(true);
    
    let url;
    let method;
    let body;
    let headers = { 'Authorization': `Bearer ${token}` }; // Token sempre presente

    if (isEditing) {
      url = `${API_URL}/documentos/${documentoParaEditar.id}`;
      method = 'PUT';
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        descricao: formData.descricao,
        cliente_id: formData.cliente_id ? parseInt(formData.cliente_id, 10) : null,
        caso_id: formData.caso_id ? parseInt(formData.caso_id, 10) : null,
      });
      console.log("DocumentoForm: Editando metadados. Enviando JSON:", body);
      if (selectedFile) {
        toast.warn("Para substituir o arquivo, por favor, apague o antigo e adicione um novo. Apenas os metadados serão atualizados.");
      }
    } else { 
      url = `${API_URL}/documentos/upload`; // Endpoint de upload deve ter a barra, se a API exigir
      method = 'POST';
      const uploadData = new FormData();
      uploadData.append('file', selectedFile);
      uploadData.append('descricao', formData.descricao);
      if (formData.cliente_id) uploadData.append('cliente_id', formData.cliente_id);
      if (formData.caso_id) uploadData.append('caso_id', formData.caso_id);
      body = uploadData;
      // Para FormData, não defina Content-Type manualmente nos headers; o navegador fará isso.
      // Mas o header de Authorization ainda é necessário.
      // delete headers['Content-Type']; // Remova se estiver definido para FormData
      console.log("DocumentoForm: Adicionando novo documento. Enviando FormData.");
    }

    try {
      const fetchOptions = { method, headers, body };
      if (body instanceof FormData) { // Se for FormData, não defina Content-Type
        delete fetchOptions.headers['Content-Type'];
      }
      const response = await fetch(url, fetchOptions);

      const responseData = await response.json();
      if (!response.ok) {
        console.error("DocumentoForm: Erro da API:", responseData);
        throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar metadados do' : 'enviar'} documento. Status: ${response.status}`);
      }
      toast.success(`Documento ${isEditing ? 'atualizado (metadados)' : 'enviado'} com sucesso!`);
      if (typeof onDocumentoChange === 'function') {
        onDocumentoChange();
      }
      if (!isEditing) { // Resetar form apenas se for novo
        setFormData(initialState);
        setSelectedFile(null);
        setFileNameDisplay('');
      }
    } catch (error) {
      console.error("DocumentoForm: Erro no handleSubmit:", error);
      toast.error(error.message || 'Erro desconhecido ao salvar o documento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Metadados do Documento' : 'Adicionar Novo Documento'}</h5>
      </div>
      <div className="card-body p-4">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="arquivo" className="form-label form-label-sm">
              Arquivo {isEditing ? `(Atual: ${fileNameDisplay || 'N/A'})` : '*'}
            </label>
            <input 
              type="file" 
              name="arquivo" 
              id="arquivo" 
              className={`form-control form-control-sm ${validationErrors.arquivo ? 'is-invalid' : ''}`} 
              onChange={handleFileChange} 
              disabled={isEditing}
            />
            {isEditing && <small className="form-text text-muted">Para substituir o arquivo, apague este registo e adicione um novo documento.</small>}
            {!isEditing && fileNameDisplay && <small className="form-text text-muted">Selecionado: {fileNameDisplay}</small>}
            {validationErrors.arquivo && <div className="invalid-feedback d-block">{validationErrors.arquivo}</div>}
          </div>

          <div className="mb-3">
            <label htmlFor="descricao_doc" className="form-label form-label-sm">Descrição *</label>
            <input type="text" name="descricao" id="descricao_doc" className={`form-control form-control-sm ${validationErrors.descricao ? 'is-invalid' : ''}`} value={formData.descricao} onChange={handleChange} />
            {validationErrors.descricao && <div className="invalid-feedback d-block">{validationErrors.descricao}</div>}
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="cliente_id_doc_form" className="form-label form-label-sm">Associar ao Cliente (Opcional)</label>
              <select 
                name="cliente_id" 
                id="cliente_id_doc_form" 
                className="form-select form-select-sm" 
                value={formData.cliente_id || ''} 
                onChange={handleChange}
              >
                <option value="">Nenhum cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="caso_id_doc_form" className="form-label form-label-sm">Associar ao Caso (Opcional)</label>
              <select 
                name="caso_id" 
                id="caso_id_doc_form" 
                className="form-select form-select-sm" 
                value={formData.caso_id || ''} 
                onChange={handleChange} 
                disabled={casos.length === 0 && !selectedClienteIdForCasoFilter}
              >
                <option value="">Nenhum caso</option>
                {(selectedClienteIdForCasoFilter ? casos.filter(c => String(c.cliente_id) === selectedClienteIdForCasoFilter) : casos).map(cs => (
                  <option key={cs.id} value={cs.id}>{cs.titulo} ({cs.cliente?.nome_razao_social || 'Cliente N/A'})</option>
                ))}
              </select>
              {!selectedClienteIdForCasoFilter && casos.length > 0 && <small className="form-text text-muted">Selecione um cliente para filtrar os casos ou deixe em branco para ver todos.</small>}
               {selectedClienteIdForCasoFilter && (selectedClienteIdForCasoFilter ? casos.filter(c => String(c.cliente_id) === selectedClienteIdForCasoFilter) : casos).length === 0 && <small className="form-text text-muted">Nenhum caso encontrado para este cliente.</small>}
            </div>
          </div>

          <hr className="my-4" />
          <div className="d-flex justify-content-end">
            {typeof onCancel === 'function' && (<button type="button" className="btn btn-outline-secondary me-2 btn-sm" onClick={onCancel} disabled={loading}>Cancelar</button>)}
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || Object.keys(validationErrors).some(key => validationErrors[key] && validationErrors[key] !== '')}>
              {loading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
              {isEditing ? 'Atualizar Metadados' : 'Adicionar Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DocumentoForm;