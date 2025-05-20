// ==================================================
// Conteúdo do arquivo: src/ClienteForm.js
// (Atualizado com melhorias de estilo e feedback)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

const initialStateCliente = { 
    nome_razao_social: '', cpf_cnpj: '', tipo_pessoa: '', rg: '', orgao_emissor: '', 
    data_nascimento: '', estado_civil: '', profissao: '', nacionalidade: '', 
    nome_fantasia: '', nire: '', inscricao_estadual: '', inscricao_municipal: '', 
    cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', pais: 'Brasil', 
    telefone: '', email: '', notas_gerais: '' 
};

const validarEmail = (email) => { if (!email) return true; const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; return re.test(String(email).toLowerCase()); };

function ClienteForm({ clienteParaEditar, onClienteChange, onCancel }) { 
  const [formData, setFormData] = useState(initialStateCliente); 
  const [formMessage, setFormMessage] = useState({ type: '', text: '' }); 
  const [loading, setLoading] = useState(false); 
  const [cepStatus, setCepStatus] = useState(''); 
  const [cnpjStatus, setCnpjStatus] = useState(''); 
  const [isEditing, setIsEditing] = useState(false); 
  const [errors, setErrors] = useState({}); 

  useEffect(() => { 
      if (clienteParaEditar) {
          const dataNascFormatada = clienteParaEditar.data_nascimento ? clienteParaEditar.data_nascimento.split('T')[0] : '';
          setFormData({ ...initialStateCliente, ...clienteParaEditar, data_nascimento: dataNascFormatada, rg: clienteParaEditar.rg || '', orgao_emissor: clienteParaEditar.orgao_emissor || '', estado_civil: clienteParaEditar.estado_civil || '', profissao: clienteParaEditar.profissao || '', nacionalidade: clienteParaEditar.nacionalidade || '', nome_fantasia: clienteParaEditar.nome_fantasia || '', nire: clienteParaEditar.nire || '', inscricao_estadual: clienteParaEditar.inscricao_estadual || '', inscricao_municipal: clienteParaEditar.inscricao_municipal || '', cep: clienteParaEditar.cep || '', rua: clienteParaEditar.rua || '', numero: clienteParaEditar.numero || '', bairro: clienteParaEditar.bairro || '', cidade: clienteParaEditar.cidade || '', estado: clienteParaEditar.estado || '', pais: clienteParaEditar.pais || 'Brasil', telefone: clienteParaEditar.telefone || '', email: clienteParaEditar.email || '', notas_gerais: clienteParaEditar.notas_gerais || '' });
          setIsEditing(true); 
          const tipoPessoa = clienteParaEditar.tipo_pessoa; 
          const pfGroup = document.getElementById('camposPessoaFisicaForm'); 
          const pjGroup = document.getElementById('camposPessoaJuridicaForm');
          if (pfGroup && pjGroup) { pfGroup.classList.toggle('hidden-field', tipoPessoa !== 'PF'); pjGroup.classList.toggle('hidden-field', tipoPessoa !== 'PJ'); }
      } else { 
          setFormData(initialStateCliente); setIsEditing(false); 
           const pfGroup = document.getElementById('camposPessoaFisicaForm'); const pjGroup = document.getElementById('camposPessoaJuridicaForm');
           if(pfGroup) pfGroup.classList.add('hidden-field'); if(pjGroup) pjGroup.classList.add('hidden-field');
      }
      setFormMessage({ type: '', text: '' }); setCepStatus(''); setCnpjStatus(''); setErrors({}); 
  }, [clienteParaEditar]);

  const formatarEIdentificarCPFCNPJ = useCallback((value) => { /* ... (código como antes) ... */ }, [formData.tipo_pessoa]);
  const buscarEnderecoPorCEP = useCallback(async (cepValue) => { /* ... (código como antes) ... */ }, [formData.tipo_pessoa]);
  const buscarDadosCNPJ = useCallback(async (cnpjValue) => { /* ... (código como antes) ... */ }, [buscarEnderecoPorCEP]);

  const handleChange = (e) => { 
    const { name, value } = e.target;
    if (errors[name]) { setErrors(prev => ({ ...prev, [name]: null })); }
    if (name === 'cpf_cnpj') { formatarEIdentificarCPFCNPJ(value); } 
    else if (name === 'cep') { const cepFormatado = value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2'); setFormData(prev => ({ ...prev, [name]: cepFormatado })); } 
    else { setFormData(prev => ({ ...prev, [name]: value })); }
    setFormMessage({ type: '', text: '' }); 
  };

  useEffect(() => { 
    const pfGroup = document.getElementById('camposPessoaFisicaForm'); 
    const pjGroup = document.getElementById('camposPessoaJuridicaForm');
    if (pfGroup && pjGroup) { 
        pfGroup.classList.toggle('hidden-field', formData.tipo_pessoa !== 'PF'); 
        pjGroup.classList.toggle('hidden-field', formData.tipo_pessoa !== 'PJ'); 
    }
  }, [formData.tipo_pessoa]); 

  const handleCepBlur = (e) => { buscarEnderecoPorCEP(e.target.value); };
  const handleCnpjBlur = (e) => { if (formData.tipo_pessoa === 'PJ') { buscarDadosCNPJ(e.target.value); } };

  const validarFormulario = () => { /* ... (código como antes) ... */ };
  const handleSubmit = async (e) => { /* ... (lógica submit POST/PUT como antes) ... */ };
  const isFormValid = formData.nome_razao_social && formData.cpf_cnpj && formData.tipo_pessoa && (!formData.email || validarEmail(formData.email)) && Object.keys(errors).every(key => !errors[key]);
  
  return ( 
    <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white shadow-xl rounded-lg border border-gray-200">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">{isEditing ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</h2>
      
      {formMessage.text && ( 
        <div className={`p-4 mb-4 text-sm rounded-lg border ${formMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-700 border-red-300'}`} role="alert">
          <span className="font-medium">{formMessage.type === 'success' ? 'Sucesso!' : 'Erro!'}</span> {formMessage.text}
        </div>
      )}

      {/* Campos Principais com mensagens de erro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 mb-6">
        {/* ... (JSX dos campos principais com classes de erro e label melhoradas) ... */}
      </div>

      {/* Campos Condicionais PF */}
      <div id="camposPessoaFisicaForm" className={`conditional-fields-group ${formData.tipo_pessoa !== 'PF' ? 'hidden-field' : ''}`}>
         <h4 className="text-lg font-medium text-gray-700 mb-3">Dados Adicionais (PF)</h4>
         {/* ... (JSX dos campos PF com classes de erro e label melhoradas) ... */}
      </div>

      {/* Campos Condicionais PJ */}
       <div id="camposPessoaJuridicaForm" className={`conditional-fields-group ${formData.tipo_pessoa !== 'PJ' ? 'hidden-field' : ''}`}>
         <h4 className="text-lg font-medium text-gray-700 mb-3">Dados Adicionais (PJ)</h4>
         {/* ... (JSX dos campos PJ com classes de erro e label melhoradas) ... */}
      </div>
      
      {/* Notas Gerais */}
       <div className="input-group mt-6">
          <label htmlFor="notasGeraisForm" className="block text-sm font-medium text-gray-700">Notas Gerais:</label>
          <textarea id="notasGeraisForm" name="notas_gerais" value={formData.notas_gerais} onChange={handleChange} rows="3" 
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
       </div>

      {/* Botões de Ação */}
      <div className="flex justify-end items-center mt-8 pt-6 border-t border-gray-200 space-x-3">
         {(isEditing || onCancel) && (<button type="button" onClick={onCancel} className="btn btn-secondary hover:bg-gray-600">Cancelar</button>)}
        <button 
          type="submit" 
          className={`btn ${isEditing ? 'btn-success hover:bg-green-700' : 'btn-primary hover:bg-indigo-700'} disabled:opacity-60 disabled:cursor-not-allowed`} 
          disabled={loading || !isFormValid} 
        >
          {loading ? <><div className="loading-spinner mr-2"></div> Processando...</> : (isEditing ? <><i className="fas fa-save mr-2"></i>Atualizar Cliente</> : <><i className="fas fa-plus mr-2"></i>Adicionar Cliente</>)}
        </button>
      </div>
    </form> 
  );
}
export default ClienteForm;

