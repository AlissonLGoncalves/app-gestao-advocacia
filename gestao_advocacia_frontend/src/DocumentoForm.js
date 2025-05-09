// ==================================================
// Conteúdo do arquivo: src/DocumentoForm.js
// (Novo arquivo)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config';

const initialDocumentoState = {
    cliente_id: '',
    caso_id: '',
    descricao: '',
    arquivo: null, // Para o input de arquivo
};

function DocumentoForm({ onDocumentoChange, onCancel }) {
    const [formData, setFormData] = useState(initialDocumentoState);
    const [clientes, setClientes] = useState([]);
    const [casos, setCasos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formMessage, setFormMessage] = useState({ type: '', text: '' });
    const [errors, setErrors] = useState({});
    const [selectedFile, setSelectedFile] = useState(null); // Para o arquivo selecionado

    // Busca clientes e casos para os selects
    const fetchDataForSelects = useCallback(async () => {
        try {
            const [clientesRes, casosRes] = await Promise.all([
                fetch(`${API_URL}/clientes`),
                fetch(`${API_URL}/casos`)
            ]);
            if (!clientesRes.ok) throw new Error('Erro ao buscar clientes');
            if (!casosRes.ok) throw new Error('Erro ao buscar casos');
            
            const clientesData = await clientesRes.json();
            const casosData = await casosRes.json();
            setClientes(clientesData);
            setCasos(casosData);
        } catch (err) {
            console.error("Erro buscando dados para selects:", err);
            setFormMessage({ type: 'error', text: `Erro ao carregar dados: ${err.message}` });
        }
    }, []);

    useEffect(() => {
        fetchDataForSelects();
    }, [fetchDataForSelects]);

    const handleChange = (e) => {
        const { name, value, type, files } = e.target;
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        if (type === 'file') {
            setSelectedFile(files[0]); // Armazena o objeto do arquivo
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        setFormMessage({ type: '', text: '' });
    };

    const validarFormulario = () => {
        const novosErros = {};
        if (!selectedFile) novosErros.arquivo = 'Selecione um arquivo para upload.';
        // Descrição é opcional, cliente_id e caso_id também são opcionais
        setErrors(novosErros);
        return Object.keys(novosErros).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validarFormulario()) {
            setFormMessage({ type: 'error', text: 'Por favor, corrija os erros no formulário.' });
            return;
        }
        setLoading(true);
        setFormMessage({ type: '', text: '' });

        const uploadData = new FormData(); // Usa FormData para enviar arquivos
        uploadData.append('file', selectedFile);
        uploadData.append('descricao', formData.descricao);
        if (formData.cliente_id) uploadData.append('cliente_id', formData.cliente_id);
        if (formData.caso_id) uploadData.append('caso_id', formData.caso_id);

        try {
            const response = await fetch(`${API_URL}/documentos/upload`, {
                method: 'POST',
                body: uploadData, // Não definir Content-Type, o navegador faz isso para FormData
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.erro || `Erro HTTP: ${response.status}`);
            }
            setFormMessage({ type: 'success', text: 'Documento enviado com sucesso!' });
            setFormData(initialDocumentoState); // Limpa formulário
            setSelectedFile(null); // Limpa arquivo selecionado
            document.getElementById('docArquivo').value = null; // Limpa o input file visualmente
            setErrors({});
            if (onDocumentoChange) onDocumentoChange(); // Atualiza a lista
            if (onCancel) { // Fecha o formulário se for um modal, por exemplo
                 setTimeout(() => onCancel(), 1500);
            } else {
                 setTimeout(() => setFormMessage({ type: '', text: '' }), 2000);
            }
        } catch (err) {
            console.error("Erro ao enviar documento:", err);
            setFormMessage({ type: 'error', text: `Erro ao enviar documento: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };
    
    const isFormValid = selectedFile && Object.keys(errors).every(key => !errors[key]);

    return (
        <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white shadow-md rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-700 mb-6">Adicionar Novo Documento</h2>
            {formMessage.text && (
                <div className={`p-3 mb-4 text-sm rounded-lg ${formMessage.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                    {formMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="input-group md:col-span-2">
                    <label htmlFor="docArquivo" className="block text-sm font-medium text-gray-700">Arquivo*:</label>
                    <input 
                        type="file" 
                        id="docArquivo" 
                        name="arquivo" 
                        onChange={handleChange} 
                        required 
                        className={`mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold ${errors.arquivo ? 'file:bg-red-50 file:text-red-700 hover:file:bg-red-100' : 'file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100'} `}
                    />
                     {errors.arquivo && <p className="mt-1 text-xs text-red-600">{errors.arquivo}</p>}
                </div>

                <div className="input-group">
                    <label htmlFor="docClienteId" className="block text-sm font-medium text-gray-700">Associar ao Cliente (Opcional):</label>
                    <select id="docClienteId" name="cliente_id" value={formData.cliente_id} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        <option value="">Nenhum</option>
                        {clientes.map(cliente => (
                            <option key={cliente.id} value={cliente.id}>{cliente.nome_razao_social}</option>
                        ))}
                    </select>
                </div>

                <div className="input-group">
                    <label htmlFor="docCasoId" className="block text-sm font-medium text-gray-700">Associar ao Caso (Opcional):</label>
                    <select id="docCasoId" name="caso_id" value={formData.caso_id} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        <option value="">Nenhum</option>
                        {casos.map(caso => (
                            <option key={caso.id} value={caso.id}>{caso.titulo} (Cliente: {caso.cliente?.nome_razao_social || 'N/A'})</option>
                        ))}
                    </select>
                </div>

                <div className="input-group md:col-span-2">
                    <label htmlFor="docDescricao" className="block text-sm font-medium text-gray-700">Descrição (Opcional):</label>
                    <textarea id="docDescricao" name="descricao" value={formData.descricao} onChange={handleChange} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                </div>
            </div>

            <div className="flex justify-end items-center mt-8 space-x-3">
                {onCancel && (<button type="button" onClick={onCancel} className="btn btn-secondary">Cancelar</button>)}
                <button 
                    type="submit" 
                    className="btn btn-primary disabled:opacity-50"
                    disabled={loading || !isFormValid}
                >
                    {loading ? 'Enviando...' : 'Enviar Documento'}
                </button>
            </div>
        </form>
    );
}
export default DocumentoForm;
