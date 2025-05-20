// Arquivo: src/DocumentoForm.jsx
// Formulário para adicionar e editar metadados de documentos, e fazer upload de novos, usando react-toastify.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { toast } from 'react-toastify';

const initialState = {
    descricao: '', cliente_id: '', caso_id: '', arquivo: null,
};

function DocumentoForm({ documentoParaEditar, onDocumentoChange, onCancel }) {
    const [formData, setFormData] = useState(initialState);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [clientes, setClientes] = useState([]);
    const [casos, setCasos] = useState([]);
    const [selectedClienteIdForCasoFilter, setSelectedClienteIdForCasoFilter] = useState('');
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
        if (documentoParaEditar && documentoParaEditar.cliente_id) {
            setSelectedClienteIdForCasoFilter(String(documentoParaEditar.cliente_id));
            fetchCasos(String(documentoParaEditar.cliente_id));
        } else { fetchCasos(); }
    }, [fetchClientes, fetchCasos, documentoParaEditar]);

    useEffect(() => {
        clearValidationErrors();
        if (documentoParaEditar) {
            setFormData({
                descricao: documentoParaEditar.descricao || '',
                cliente_id: documentoParaEditar.cliente_id || '',
                caso_id: documentoParaEditar.caso_id || '',
                arquivo: null,
            });
            setFileName(documentoParaEditar.nome_original_arquivo || '');
            setIsEditing(true);
            if (documentoParaEditar.cliente_id) setSelectedClienteIdForCasoFilter(String(documentoParaEditar.cliente_id));
            // Removido o toast.info daqui para evitar que apareça sempre que o formulário é aberto para edição
        } else {
            setFormData(initialState);
            setSelectedFile(null);
            setFileName('');
            setIsEditing(false);
            setSelectedClienteIdForCasoFilter('');
        }
    }, [documentoParaEditar, clearValidationErrors]);

    const validateForm = () => {
        const errors = {};
        if (!isEditing && !selectedFile) errors.arquivo = 'A seleção de um arquivo é obrigatória.';
        if (!formData.descricao.trim()) errors.descricao = 'A descrição é obrigatória.';
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleFileChange = (e) => {
        if (validationErrors.arquivo) setValidationErrors(prev => ({...prev, arquivo: ''}));
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setFileName(file.name);
        } else {
            setSelectedFile(null);
            setFileName(isEditing ? (documentoParaEditar?.nome_original_arquivo || '') : '');
        }
    };
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (validationErrors[name]) setValidationErrors(prev => ({...prev, [name]: ''}));
        
        if (name === "cliente_id") { 
            setSelectedClienteIdForCasoFilter(value); 
            fetchCasos(value); 
            setFormData(prev => ({ ...prev, cliente_id: value, caso_id: '' })); 
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

        let url;
        let method;
        let body;
        let headers = {};

        if (isEditing) {
            url = `${API_URL}/documentos/${documentoParaEditar.id}`;
            method = 'PUT';
            // Para edição, apenas metadados. Upload de novo arquivo requereria uma lógica diferente
            // ou uma API que suporte substituição de arquivo via PUT com multipart/form-data.
            // Se um novo arquivo foi selecionado, idealmente o backend lidaria com a substituição.
            // Por ora, se selectedFile existir, vamos tentar enviar como FormData,
            // caso contrário, como JSON para metadados.
            if (selectedFile) {
                // Esta parte é complexa: o backend precisaria de uma rota PUT que aceite multipart/form-data
                // para substituir o arquivo E atualizar metadados.
                // A rota atual de upload é POST. A rota PUT /documentos/<id> espera JSON para metadados.
                // Vamos simplificar: se houver novo arquivo, o usuário deveria deletar e adicionar.
                // Se não houver novo arquivo, atualizamos apenas metadados.
                toast.warn('Para substituir o arquivo, por favor, delete o antigo e adicione um novo. Apenas metadados serão atualizados se nenhum novo arquivo for selecionado.');
                // Não enviaremos o selectedFile aqui para a rota PUT de metadados.
            }
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({
                descricao: formData.descricao,
                cliente_id: formData.cliente_id ? parseInt(formData.cliente_id) : null,
                caso_id: formData.caso_id ? parseInt(formData.caso_id) : null,
            });

        } else { // Adicionando novo documento
            url = `${API_URL}/documentos/upload`;
            method = 'POST';
            const uploadData = new FormData();
            uploadData.append('file', selectedFile);
            uploadData.append('descricao', formData.descricao);
            if (formData.cliente_id) uploadData.append('cliente_id', formData.cliente_id);
            if (formData.caso_id) uploadData.append('caso_id', formData.caso_id);
            body = uploadData;
            // Headers para FormData são definidos automaticamente pelo navegador
        }
        
        try {
            const response = await fetch(url, { method, headers: Object.keys(headers).length ? headers : undefined, body });
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'enviar'} documento`);
            toast.success(`Documento ${isEditing ? 'atualizado (metadados)' : 'enviado'} com sucesso!`);
            if (typeof onDocumentoChange === 'function') onDocumentoChange();
            if (isEditing && typeof onCancel === 'function') onCancel();
            if (!isEditing) {
                setFormData(initialState); setSelectedFile(null); setFileName(''); setSelectedClienteIdForCasoFilter('');
            }
        } catch (error) {
            toast.error(error.message || 'Erro desconhecido.');
        } finally { setLoading(false); }
    };
    
    return (
        <div className="card shadow-sm mb-4"><div className="card-header bg-light"><h5 className="mb-0">{isEditing ? 'Editar Metadados do Documento' : 'Adicionar Novo Documento'}</h5></div>
            <div className="card-body p-4">
                <form onSubmit={handleSubmit}>
                     <div className="mb-3">
                        <label htmlFor="arquivo" className="form-label form-label-sm">
                            Arquivo {isEditing ? `(Atual: ${fileName || 'Nenhum'})` : '*'}
                        </label>
                        <input type="file" name="arquivo" id="arquivo" className={`form-control form-control-sm ${validationErrors.arquivo ? 'is-invalid' : ''}`} onChange={handleFileChange} />
                        {isEditing && selectedFile && <small className="form-text text-muted">Novo arquivo selecionado (para substituir, a API precisa suportar): {selectedFile.name}</small>}
                        {isEditing && !selectedFile && <small className="form-text text-muted">Para substituir o arquivo, selecione um novo. Caso contrário, apenas os metadados abaixo serão atualizados.</small>}
                        {validationErrors.arquivo && <div className="invalid-feedback d-block">{validationErrors.arquivo}</div>}
                    </div>
                    <div className="mb-3">
                        <label htmlFor="descricao_doc" className="form-label form-label-sm">Descrição *</label>
                        <input type="text" name="descricao" id="descricao_doc" className={`form-control form-control-sm ${validationErrors.descricao ? 'is-invalid' : ''}`} value={formData.descricao} onChange={handleChange} />
                        {validationErrors.descricao && <div className="invalid-feedback d-block">{validationErrors.descricao}</div>}
                    </div>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label htmlFor="cliente_id_doc" className="form-label form-label-sm">Associar ao Cliente (Opcional)</label>
                            <select name="cliente_id" id="cliente_id_doc" className="form-select form-select-sm" value={formData.cliente_id || ''} onChange={handleChange}>
                                <option value="">Nenhum cliente</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
                            </select>
                        </div>
                        <div className="col-md-6 mb-3">
                            <label htmlFor="caso_id_doc" className="form-label form-label-sm">Associar ao Caso (Opcional)</label>
                            <select name="caso_id" id="caso_id_doc" className="form-select form-select-sm" value={formData.caso_id || ''} onChange={handleChange} disabled={!selectedClienteIdForCasoFilter && casos.length === 0 && !isEditing && !formData.cliente_id}>
                                <option value="">Nenhum caso</option>
                                {casos.filter(c => !selectedClienteIdForCasoFilter || c.cliente_id === parseInt(selectedClienteIdForCasoFilter)).map(cs => (<option key={cs.id} value={cs.id}>{cs.titulo} ({cs.cliente?.nome_razao_social || 'N/A'})</option>))}
                            </select>
                            {!selectedClienteIdForCasoFilter && !formData.cliente_id && <small className="form-text text-muted">Selecione um cliente para filtrar os casos.</small>}
                        </div>
                    </div>

                    <hr className="my-4" />
                    <div className="d-flex justify-content-end">
                        {typeof onCancel === 'function' && (<button type="button" className="btn btn-outline-secondary me-2 btn-sm" onClick={onCancel} disabled={loading}>Cancelar</button>)}
                        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || Object.keys(validationErrors).some(key => validationErrors[key])}>
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
