// ==================================================
// Conteúdo do arquivo: src/ClienteForm.js
// (Refinado com validação e melhor feedback)
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

// Função simples para validar email (pode ser mais complexa se necessário)
const validarEmail = (email) => {
    if (!email) return true; // Permite campo vazio
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

function ClienteForm({ clienteParaEditar, onClienteChange, onCancel }) { 
  const [formData, setFormData] = useState(initialStateCliente); 
  const [formMessage, setFormMessage] = useState({ type: '', text: '' }); 
  const [loading, setLoading] = useState(false); 
  const [cepStatus, setCepStatus] = useState(''); 
  const [cnpjStatus, setCnpjStatus] = useState(''); 
  const [isEditing, setIsEditing] = useState(false); 
  const [errors, setErrors] = useState({}); // Estado para erros de validação

  // Preenche formulário para edição (igual à versão anterior)
  useEffect(() => { 
      if (clienteParaEditar) {
          const dataNascFormatada = clienteParaEditar.data_nascimento ? clienteParaEditar.data_nascimento.split('T')[0] : '';
          setFormData({ ...initialStateCliente, ...clienteParaEditar, data_nascimento: dataNascFormatada, rg: clienteParaEditar.rg || '', orgao_emissor: clienteParaEditar.orgao_emissor || '', estado_civil: clienteParaEditar.estado_civil || '', profissao: clienteParaEditar.profissao || '', nacionalidade: clienteParaEditar.nacionalidade || '', nome_fantasia: clienteParaEditar.nome_fantasia || '', nire: clienteParaEditar.nire || '', inscricao_estadual: clienteParaEditar.inscricao_estadual || '', inscricao_municipal: clienteParaEditar.inscricao_municipal || '', cep: clienteParaEditar.cep || '', rua: clienteParaEditar.rua || '', numero: clienteParaEditar.numero || '', bairro: clienteParaEditar.bairro || '', cidade: clienteParaEditar.cidade || '', estado: clienteParaEditar.estado || '', pais: clienteParaEditar.pais || 'Brasil', telefone: clienteParaEditar.telefone || '', email: clienteParaEditar.email || '', notas_gerais: clienteParaEditar.notas_gerais || '' });
          setIsEditing(true); 
          const tipoPessoa = clienteParaEditar.tipo_pessoa; const pfGroup = document.getElementById('camposPessoaFisicaForm'); const pjGroup = document.getElementById('camposPessoaJuridicaForm');
          if (pfGroup && pjGroup) { pfGroup.classList.toggle('hidden-field', tipoPessoa !== 'PF'); pjGroup.classList.toggle('hidden-field', tipoPessoa !== 'PJ'); }
      } else { setFormData(initialStateCliente); setIsEditing(false); 
          const pfGroup = document.getElementById('camposPessoaFisicaForm'); const pjGroup = document.getElementById('camposPessoaJuridicaForm');
          if(pfGroup) pfGroup.classList.add('hidden-field'); if(pjGroup) pjGroup.classList.add('hidden-field');
      }
      setFormMessage({ type: '', text: '' }); setCepStatus(''); setCnpjStatus(''); setErrors({}); // Limpa erros ao carregar
  }, [clienteParaEditar]);

  // Formata CPF/CNPJ (igual à versão anterior)
  const formatarEIdentificarCPFCNPJ = useCallback((value) => { /* ... */ }, [formData.tipo_pessoa]);
  // Busca endereço por CEP (igual à versão anterior)
  const buscarEnderecoPorCEP = useCallback(async (cepValue) => { /* ... */ }, [formData.tipo_pessoa]);
  // Busca dados CNPJ (igual à versão anterior)
  const buscarDadosCNPJ = useCallback(async (cnpjValue) => { /* ... */ }, [buscarEnderecoPorCEP]);

  // Atualiza estado do formulário e limpa erros/mensagens
  const handleChange = (e) => { 
    const { name, value } = e.target;
    
    // Limpa o erro específico deste campo ao começar a digitar
    if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: null }));
    }

    if (name === 'cpf_cnpj') { formatarEIdentificarCPFCNPJ(value); } 
    else if (name === 'cep') { const cepFormatado = value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2'); setFormData(prev => ({ ...prev, [name]: cepFormatado })); } 
    else { setFormData(prev => ({ ...prev, [name]: value })); }
    
    setFormMessage({ type: '', text: '' }); // Limpa mensagem geral
  };

  // Controla visibilidade dos campos PF/PJ (igual à versão anterior)
  useEffect(() => { /* ... */ }, [formData.tipo_pessoa]); 

  // Busca CEP/CNPJ ao sair do campo (igual à versão anterior)
  const handleCepBlur = (e) => { buscarEnderecoPorCEP(e.target.value); };
  const handleCnpjBlur = (e) => { if (formData.tipo_pessoa === 'PJ') { buscarDadosCNPJ(e.target.value); } };

  // Valida o formulário antes do envio
  const validarFormulario = () => {
      const novosErros = {};
      if (!formData.nome_razao_social.trim()) novosErros.nome_razao_social = 'Nome/Razão Social é obrigatório.';
      if (!formData.cpf_cnpj.trim()) novosErros.cpf_cnpj = 'CPF/CNPJ é obrigatório.';
      // Adicionar validação de formato CPF/CNPJ se necessário (mais complexo)
      if (!formData.tipo_pessoa) novosErros.tipo_pessoa = 'Tipo de Pessoa é obrigatório.';
      if (formData.email && !validarEmail(formData.email)) novosErros.email = 'Formato de email inválido.';
      // Adicionar outras validações (CEP, telefone, etc.) se desejar

      setErrors(novosErros);
      // Retorna true se não houver erros (objeto de erros está vazio)
      return Object.keys(novosErros).length === 0; 
  };

  // Envia o formulário para a API (cria ou atualiza)
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    
    // Executa a validação
    if (!validarFormulario()) {
        setFormMessage({ type: 'error', text: 'Por favor, corrija os erros no formulário.' });
        return; // Interrompe o envio se houver erros
    }

    setLoading(true); 
    setFormMessage({ type: '', text: '' }); 
    
    const dadosParaEnviar = { ...formData };
    if (dadosParaEnviar.data_nascimento) { try { dadosParaEnviar.data_nascimento = new Date(dadosParaEnviar.data_nascimento).toISOString().split('T')[0]; } catch (err) { dadosParaEnviar.data_nascimento = null; } }

    const url = isEditing ? `${API_URL}/clientes/${clienteParaEditar.id}` : `${API_URL}/clientes`; 
    const method = isEditing ? 'PUT' : 'POST';

    try { 
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(dadosParaEnviar), });
        const responseData = await response.json(); 
        if (!response.ok) { throw new Error(responseData.erro || `Erro HTTP: ${response.status}`); }
        
        setFormMessage({ type: 'success', text: `Cliente ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!` });
        if (!isEditing) { setFormData(initialStateCliente); setCepStatus(''); setCnpjStatus(''); } // Limpa só se adicionou
        if (onClienteChange) { onClienteChange(); } 
        if(isEditing && onCancel) { 
            // Pequeno delay para o usuário ver a msg de sucesso antes de fechar
            setTimeout(() => onCancel(), 1500); 
        } else if (!isEditing) {
             // Pequeno delay para o usuário ver a msg de sucesso antes de limpar
             setTimeout(() => setFormMessage({ type: '', text: '' }), 2000);
        }

    } catch (err) { 
        console.error(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} cliente:`, err); 
        setFormMessage({ type: 'error', text: `Erro: ${err.message}` });
    } finally { 
        setLoading(false); 
    } 
  };

  // Verifica se o formulário é válido para habilitar/desabilitar o botão submit
  const isFormValid = formData.nome_razao_social && formData.cpf_cnpj && formData.tipo_pessoa && (!formData.email || validarEmail(formData.email));

  // --- Renderização do Formulário JSX ---
  return ( 
    <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white shadow-md rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">{isEditing ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</h2>
      
      {/* Mensagem de Feedback */}
      {formMessage.text && ( 
        <div className={`p-3 mb-4 text-sm rounded-lg ${formMessage.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
          {formMessage.text}
        </div>
      )}

      {/* Campos Principais com mensagens de erro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="input-group">
          <label htmlFor="cpfCnpjClienteForm" className="block text-sm font-medium text-gray-700">CPF/CNPJ*:</label>
          <input type="text" id="cpfCnpjClienteForm" name="cpf_cnpj" value={formData.cpf_cnpj} onChange={handleChange} onBlur={handleCnpjBlur} maxLength="18" required disabled={isEditing} 
                 className={`mt-1 block w-full px-3 py-2 border ${errors.cpf_cnpj ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}/>
          {errors.cpf_cnpj && <p className="mt-1 text-xs text-red-600">{errors.cpf_cnpj}</p>}
          <div className="lookup-status">{cnpjStatus}</div>
        </div>
        <div className="input-group">
          <label htmlFor="tipoPessoaClienteForm" className="block text-sm font-medium text-gray-700">Tipo Pessoa*:</label>
          <select id="tipoPessoaClienteForm" name="tipo_pessoa" value={formData.tipo_pessoa} onChange={handleChange} required disabled={isEditing} 
                  className={`mt-1 block w-full px-3 py-2 border ${errors.tipo_pessoa ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
            <option value="">Selecione...</option><option value="PF">PF</option><option value="PJ">PJ</option>
          </select>
          {errors.tipo_pessoa && <p className="mt-1 text-xs text-red-600">{errors.tipo_pessoa}</p>}
        </div>
        <div className="input-group">
          <label htmlFor="nomeClienteForm" className="block text-sm font-medium text-gray-700">Nome/Razão Social*:</label>
          <input type="text" id="nomeClienteForm" name="nome_razao_social" value={formData.nome_razao_social} onChange={handleChange} required 
                 className={`mt-1 block w-full px-3 py-2 border ${errors.nome_razao_social ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
          {errors.nome_razao_social && <p className="mt-1 text-xs text-red-600">{errors.nome_razao_social}</p>}
        </div>
      </div>

      {/* Campos Condicionais PF */}
      <div id="camposPessoaFisicaForm" className={`conditional-fields-group ${formData.tipo_pessoa !== 'PF' ? 'hidden-field' : ''}`}>
         <h4 className="text-md font-semibold text-gray-700 mb-2">Dados Adicionais (PF)</h4>
         {/* ... (campos PF como antes) ... */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> 
            <div className="input-group"><label htmlFor="rgClienteForm">RG:</label><input type="text" id="rgClienteForm" name="rg" value={formData.rg} onChange={handleChange}/></div>
            <div className="input-group"><label htmlFor="orgaoEmissorClienteForm">Órgão Emissor:</label><input type="text" id="orgaoEmissorClienteForm" name="orgao_emissor" value={formData.orgao_emissor} onChange={handleChange}/></div>
            <div className="input-group"><label htmlFor="dataNascimentoClienteForm">Data Nasc.:</label><input type="date" id="dataNascimentoClienteForm" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange}/></div>
         </div>
         <h5 className="text-sm font-medium text-gray-600 mb-2 mt-3">Endereço (PF)</h5>
         <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
             <div className="input-group md:col-span-2"><label htmlFor="cepClientePFForm">CEP:</label><input type="text" id="cepClientePFForm" name="cep" value={formData.cep} onChange={handleChange} onBlur={handleCepBlur} maxLength="9"/><div className="lookup-status">{cepStatus}</div></div>
             <div className="input-group md:col-span-4"><label htmlFor="ruaClientePFForm">Rua:</label><input type="text" id="ruaClientePFForm" name="rua" value={formData.rua} onChange={handleChange} readOnly={cepStatus === 'Endereço preenchido!'} /></div>
             <div className="input-group md:col-span-2"><label htmlFor="numeroClientePFForm">Número:</label><input type="text" id="numeroClientePFForm" name="numero" value={formData.numero} onChange={handleChange}/></div>
             <div className="input-group md:col-span-4"><label htmlFor="bairroClientePFForm">Bairro:</label><input type="text" id="bairroClientePFForm" name="bairro" value={formData.bairro} onChange={handleChange} readOnly={cepStatus === 'Endereço preenchido!'} /></div>
             <div className="input-group md:col-span-3"><label htmlFor="cidadeClientePFForm">Cidade:</label><input type="text" id="cidadeClientePFForm" name="cidade" value={formData.cidade} onChange={handleChange} readOnly={cepStatus === 'Endereço preenchido!'} /></div>
             <div className="input-group md:col-span-1"><label htmlFor="estadoClientePFForm">UF:</label><input type="text" id="estadoClientePFForm" name="estado" value={formData.estado} onChange={handleChange} maxLength="2" readOnly={cepStatus === 'Endereço preenchido!'} /></div>
             <div className="input-group md:col-span-2"><label htmlFor="paisClientePFForm">País:</label><input type="text" id="paisClientePFForm" name="pais" value={formData.pais} onChange={handleChange}/></div>
         </div>
          <h5 className="text-sm font-medium text-gray-600 mb-2 mt-3">Contato (PF)</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="input-group"><label htmlFor="telefoneClientePFForm">Telefone:</label><input type="tel" id="telefoneClientePFForm" name="telefone" value={formData.telefone} onChange={handleChange}/></div>
              <div className="input-group">
                  <label htmlFor="emailClientePFForm">Email:</label>
                  <input type="email" id="emailClientePFForm" name="email" value={formData.email} onChange={handleChange} 
                         className={`mt-1 block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
          </div>
      </div>

      {/* Campos Condicionais PJ */}
       <div id="camposPessoaJuridicaForm" className={`conditional-fields-group ${formData.tipo_pessoa !== 'PJ' ? 'hidden-field' : ''}`}>
         <h4 className="text-md font-semibold text-gray-700 mb-2">Dados Adicionais (PJ)</h4>
         {/* ... (campos PJ como antes) ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-group"><label htmlFor="nomeFantasiaForm">Nome Fantasia:</label><input type="text" id="nomeFantasiaForm" name="nome_fantasia" value={formData.nome_fantasia} onChange={handleChange}/></div>
            <div className="input-group"><label htmlFor="nireClienteForm">NIRE:</label><input type="text" id="nireClienteForm" name="nire" value={formData.nire} onChange={handleChange}/></div>
         </div>
         <h5 className="text-sm font-medium text-gray-600 mb-2 mt-3">Endereço (PJ)</h5>
         <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
             <div className="input-group md:col-span-2"><label htmlFor="cepClientePJForm">CEP:</label><input type="text" id="cepClientePJForm" name="cep" value={formData.cep} onChange={handleChange} onBlur={handleCepBlur} maxLength="9"/><div className="lookup-status">{cepStatus}</div></div>
             <div className="input-group md:col-span-4"><label htmlFor="ruaClientePJForm">Rua:</label><input type="text" id="ruaClientePJForm" name="rua" value={formData.rua} onChange={handleChange} readOnly={cepStatus === 'Endereço preenchido!'} /></div>
             <div className="input-group md:col-span-2"><label htmlFor="numeroClientePJForm">Número:</label><input type="text" id="numeroClientePJForm" name="numero" value={formData.numero} onChange={handleChange}/></div>
             <div className="input-group md:col-span-4"><label htmlFor="bairroClientePJForm">Bairro:</label><input type="text" id="bairroClientePJForm" name="bairro" value={formData.bairro} onChange={handleChange} readOnly={cepStatus === 'Endereço preenchido!'} /></div>
             <div className="input-group md:col-span-3"><label htmlFor="cidadeClientePJForm">Cidade:</label><input type="text" id="cidadeClientePJForm" name="cidade" value={formData.cidade} onChange={handleChange} readOnly={cepStatus === 'Endereço preenchido!'} /></div>
             <div className="input-group md:col-span-1"><label htmlFor="estadoClientePJForm">UF:</label><input type="text" id="estadoClientePJForm" name="estado" value={formData.estado} onChange={handleChange} maxLength="2" readOnly={cepStatus === 'Endereço preenchido!'} /></div>
             <div className="input-group md:col-span-2"><label htmlFor="paisClientePJForm">País:</label><input type="text" id="paisClientePJForm" name="pais" value={formData.pais} onChange={handleChange}/></div>
         </div>
          <h5 className="text-sm font-medium text-gray-600 mb-2 mt-3">Contato (PJ)</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="input-group"><label htmlFor="telefoneClientePJForm">Telefone:</label><input type="tel" id="telefoneClientePJForm" name="telefone" value={formData.telefone} onChange={handleChange}/></div>
              <div className="input-group">
                  <label htmlFor="emailClientePJForm">Email:</label>
                  <input type="email" id="emailClientePJForm" name="email" value={formData.email} onChange={handleChange} 
                         className={`mt-1 block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
          </div>
      </div>
      
      {/* Notas Gerais */}
       <div className="input-group mt-4">
          <label htmlFor="notasGeraisForm">Notas Gerais:</label>
          <textarea id="notasGeraisForm" name="notas_gerais" value={formData.notas_gerais} onChange={handleChange} rows="3" className="border border-gray-300 rounded-md p-2 w-full"></textarea>
       </div>

      {/* Botões de Ação */}
      <div className="flex justify-end items-center mt-6 space-x-3">
         {(isEditing || onCancel) && (<button type="button" onClick={onCancel} className="btn btn-secondary">Cancelar</button>)}
        <button 
          type="submit" 
          className={`btn ${isEditing ? 'btn-success' : 'btn-primary'} disabled:opacity-50`} 
          disabled={loading || !isFormValid} // Desabilita se carregando OU se formulário inválido
        >
          {loading ? (isEditing ? 'Atualizando...' : 'Adicionando...') : (isEditing ? 'Atualizar Cliente' : 'Adicionar Cliente')}
        </button>
      </div>
    </form>
  );
}
export default ClienteForm;