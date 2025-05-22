// src/DocumentoForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; // Ajuste o caminho se config.js não estiver em src/
import { toast } from 'react-toastify';

const initialState = {
    descricao: '',
    cliente_id: '', // Opcional
    caso_id: '',    // Opcional
    // O campo 'arquivo' será tratado separadamente pelo input type="file"
};

function DocumentoForm({ documentoParaEditar, onDocumentoChange, onCancel }) {
  console.log("DocumentoForm: Renderizando. Documento para editar (metadados):", documentoParaEditar);

  const [formData, setFormData] = useState(initialState);
  const [selectedFile, setSelectedFile] = useState(null); // Para o arquivo a ser enviado (novo)
  const [fileNameDisplay, setFileNameDisplay] = useState(''); // Para exibir o nome do arquivo selecionado ou existente
  
  const [clientes, setClientes] = useState([]);
  const [casos, setCasos] = useState([]);
  const [selectedClienteIdForCasoFilter, setSelectedClienteIdForCasoFilter] = useState(''); // Para filtrar casos

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  const fetchClientes = useCallback(async () => {
    console.log("DocumentoForm: fetchClientes chamado.");
    try {
      const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
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
    let url = `${API_URL}/casos?sort_by=titulo&order=asc`;
    if (clienteId) {
      url += `&cliente_id=${clienteId}`;
    }
    try {
      const response = await fetch(url);
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
    // Carrega casos baseado no cliente selecionado (se houver) ou todos se nenhum cliente selecionado
    // A lógica no useEffect de documentoParaEditar pode ajustar isso.
    fetchCasos(selectedClienteIdForCasoFilter || null);
  }, [fetchClientes, selectedClienteIdForCasoFilter]); // Removido fetchCasos daqui para ser chamado por selectedClienteIdForCasoFilter

  useEffect(() => {
    console.log("DocumentoForm: useEffect para documentoParaEditar. Valor:", documentoParaEditar);
    clearValidationErrors();
    setSelectedFile(null); // Limpa qualquer arquivo selecionado anteriormente

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

      // Se o documento editado tem um cliente_id, pré-seleciona o filtro de cliente
      if (documentoParaEditar.cliente_id) {
        setSelectedClienteIdForCasoFilter(String(documentoParaEditar.cliente_id));
        // O useEffect de selectedClienteIdForCasoFilter tratará de chamar fetchCasos
      } else {
        setSelectedClienteIdForCasoFilter(''); // Limpa se não houver cliente
        fetchCasos(null); // Carrega todos os casos se não houver cliente associado
      }
    } else {
      setFormData(initialState);
      setFileNameDisplay('');
      setIsEditing(false);
      setSelectedClienteIdForCasoFilter('');
      console.log("DocumentoForm: Modo de adição ou documentoParaEditar inválido. FormData resetado.");
    }
  }, [documentoParaEditar, clearValidationErrors]);

  const validateForm = () => {
    const errors = {};
    if (!isEditing && !selectedFile) { // Arquivo é obrigatório apenas para novos documentos
      errors.arquivo = 'A seleção de um arquivo é obrigatória para novos documentos.';
    }
    if (!formData.descricao || !formData.descricao.trim()) {
      errors.descricao = 'A descrição do documento é obrigatória.';
    }
    // cliente_id e caso_id são opcionais
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
      // Limpa o caso_id selecionado quando o filtro de cliente muda
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
    setLoading(true);

    let url;
    let method;
    let body;
    let headers = {}; // Definido como objeto vazio

    if (isEditing) {
      // Para edição, apenas metadados são enviados como JSON.
      // A substituição de arquivo exigiria uma lógica mais complexa ou um endpoint diferente.
      // Se um novo arquivo foi selecionado em modo de edição, esta lógica não o envia.
      // O utilizador teria que apagar o documento antigo e fazer upload de um novo.
      url = `${API_URL}/documentos/${documentoParaEditar.id}`;
      method = 'PUT';
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        descricao: formData.descricao,
        cliente_id: formData.cliente_id ? parseInt(formData.cliente_id, 10) : null,
        caso_id: formData.caso_id ? parseInt(formData.caso_id, 10) : null,
        // Não enviamos o arquivo em si na atualização de metadados
      });
      console.log("DocumentoForm: Editando metadados. Enviando JSON:", body);
      if (selectedFile) {
        toast.warn("Para substituir o arquivo, por favor, apague o antigo e adicione um novo. Apenas os metadados serão atualizados.");
      }
    } else { // Adicionando novo documento
      url = `${API_URL}/documentos/upload`;
      method = 'POST';
      const uploadData = new FormData();
      uploadData.append('file', selectedFile); // selectedFile deve estar definido
      uploadData.append('descricao', formData.descricao);
      if (formData.cliente_id) uploadData.append('cliente_id', formData.cliente_id);
      if (formData.caso_id) uploadData.append('caso_id', formData.caso_id);
      body = uploadData;
      // Headers para FormData são definidos automaticamente pelo navegador, não defina Content-Type manualmente.
      console.log("DocumentoForm: Adicionando novo documento. Enviando FormData.");
    }

    try {
      const response = await fetch(url, { method, headers: Object.keys(headers).length ? headers : {}, body }); // Só envia headers se não for FormData
      const responseData = await response.json();
      if (!response.ok) {
        console.error("DocumentoForm: Erro da API:", responseData);
        throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar metadados do' : 'enviar'} documento. Status: ${response.status}`);
      }
      toast.success(`Documento ${isEditing ? 'atualizado (metadados)' : 'enviado'} com sucesso!`);
      if (typeof onDocumentoChange === 'function') {
        onDocumentoChange();
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
              disabled={isEditing} // Desabilita a troca de arquivo na edição de metadados
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
