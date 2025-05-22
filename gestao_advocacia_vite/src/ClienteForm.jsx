// src/ClienteForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; // Ajuste o caminho se config.js não estiver em src/
import { toast } from 'react-toastify';

// Estado inicial para Pessoa Física
const initialStatePF = {
    nome_razao_social: '', cpf_cnpj: '', tipo_pessoa: 'PF', rg: '', orgao_emissor: '',
    data_nascimento: '', estado_civil: '', profissao: '', nacionalidade: 'Brasileiro(a)',
    cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', pais: 'Brasil',
    telefone: '', email: '', notas_gerais: '',
    // Campos de CNPJ adicionais devem ser nulos ou vazios para PF
    cnpj_secundario: '', descricao_cnpj_secundario: '',
    cnpj_terciario: '', descricao_cnpj_terciario: ''
};

// Estado inicial para Pessoa Jurídica
const initialStatePJ = {
    nome_razao_social: '', cpf_cnpj: '', tipo_pessoa: 'PJ', nome_fantasia: '', nire: '',
    inscricao_estadual: '', inscricao_municipal: '',
    // Campos para CNPJs adicionais
    cnpj_secundario: '', descricao_cnpj_secundario: '',
    cnpj_terciario: '', descricao_cnpj_terciario: '',
    // Endereço e contato
    cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', pais: 'Brasil',
    telefone: '', email: '', notas_gerais: ''
};

function ClienteForm({ clienteParaEditar, onClienteChange, onCancel }) {
  console.log("ClienteForm: Renderizando. Cliente para editar:", clienteParaEditar);

  const getInitialState = () => {
    if (clienteParaEditar && clienteParaEditar.tipo_pessoa === 'PJ') {
      return initialStatePJ;
    }
    return initialStatePF;
  };

  const [formData, setFormData] = useState(getInitialState());
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  useEffect(() => {
    console.log("ClienteForm: useEffect para clienteParaEditar. Valor:", clienteParaEditar);
    clearValidationErrors();
    if (clienteParaEditar && clienteParaEditar.id) {
      const initialStateForEdit = clienteParaEditar.tipo_pessoa === 'PJ' ? initialStatePJ : initialStatePF;
      const dadosEdit = { ...initialStateForEdit, ...clienteParaEditar };

      if (dadosEdit.data_nascimento && typeof dadosEdit.data_nascimento === 'string') {
        dadosEdit.data_nascimento = dadosEdit.data_nascimento.split('T')[0];
      } else if (dadosEdit.data_nascimento instanceof Date) {
        dadosEdit.data_nascimento = dadosEdit.data_nascimento.toISOString().split('T')[0];
      } else {
        dadosEdit.data_nascimento = '';
      }
      
      // Garante que os campos de CNPJ adicionais sejam strings vazias se forem null/undefined
      dadosEdit.cnpj_secundario = dadosEdit.cnpj_secundario || '';
      dadosEdit.descricao_cnpj_secundario = dadosEdit.descricao_cnpj_secundario || '';
      dadosEdit.cnpj_terciario = dadosEdit.cnpj_terciario || '';
      dadosEdit.descricao_cnpj_terciario = dadosEdit.descricao_cnpj_terciario || '';


      setFormData(dadosEdit);
      setIsEditing(true);
      console.log("ClienteForm: Modo de edição. FormData definido:", dadosEdit);
    } else {
      setFormData(initialStatePF);
      setIsEditing(false);
      console.log("ClienteForm: Modo de adição. FormData resetado para PF.");
    }
  }, [clienteParaEditar, clearValidationErrors]);

  const validateForm = () => {
    const errors = {};
    if (!formData.nome_razao_social || !formData.nome_razao_social.trim()) {
      errors.nome_razao_social = 'Nome / Razão Social é obrigatório.';
    }
    if (!formData.cpf_cnpj || !formData.cpf_cnpj.trim()) {
      errors.cpf_cnpj = 'CPF / CNPJ principal é obrigatório.';
    } else {
      const numCpfCnpj = formData.cpf_cnpj.replace(/\D/g, '');
      if (formData.tipo_pessoa === 'PF' && numCpfCnpj.length !== 11) errors.cpf_cnpj = 'CPF principal deve conter 11 dígitos.';
      if (formData.tipo_pessoa === 'PJ' && numCpfCnpj.length !== 14) errors.cpf_cnpj = 'CNPJ principal deve conter 14 dígitos.';
    }
    if (!formData.tipo_pessoa) errors.tipo_pessoa = 'Tipo de Pessoa é obrigatório.';
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = 'Formato de e-mail inválido.';
    }

    // Validação para CNPJs adicionais (apenas se PJ)
    if (formData.tipo_pessoa === 'PJ') {
      if (formData.cnpj_secundario && formData.cnpj_secundario.replace(/\D/g, '').length !== 14) {
        errors.cnpj_secundario = 'CNPJ secundário deve conter 14 dígitos.';
      }
      if (formData.cnpj_terciario && formData.cnpj_terciario.replace(/\D/g, '').length !== 14) {
        errors.cnpj_terciario = 'CNPJ terciário deve conter 14 dígitos.';
      }
      if (formData.cnpj_secundario && formData.cnpj_secundario === formData.cpf_cnpj) {
        errors.cnpj_secundario = 'CNPJ secundário não pode ser igual ao CNPJ principal.';
      }
      if (formData.cnpj_terciario && formData.cnpj_terciario === formData.cpf_cnpj) {
        errors.cnpj_terciario = 'CNPJ terciário não pode ser igual ao CNPJ principal.';
      }
      if (formData.cnpj_secundario && formData.cnpj_terciario && formData.cnpj_secundario === formData.cnpj_terciario) {
        errors.cnpj_secundario = 'CNPJ secundário e terciário não podem ser iguais.'; // Ou errors.cnpj_terciario
      }
    }
    
    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    console.log("ClienteForm: Validação. Válido:", isValid, "Erros:", errors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }

    let newFormData = { ...formData, [name]: value };

    if (name === "tipo_pessoa") {
      console.log("ClienteForm: Tipo de pessoa alterado para:", value);
      const commonData = {
        nome_razao_social: formData.nome_razao_social,
        cep: formData.cep, rua: formData.rua, numero: formData.numero, bairro: formData.bairro,
        cidade: formData.cidade, estado: formData.estado, pais: formData.pais,
        telefone: formData.telefone, email: formData.email, notas_gerais: formData.notas_gerais
      };
      if (value === "PF") {
        newFormData = { 
            ...initialStatePF, ...commonData, tipo_pessoa: 'PF', cpf_cnpj: '',
            // Limpa campos de PJ ao mudar para PF
            nome_fantasia: '', nire: '', inscricao_estadual: '', inscricao_municipal: '',
            cnpj_secundario: '', descricao_cnpj_secundario: '',
            cnpj_terciario: '', descricao_cnpj_terciario: ''
        };
      } else if (value === "PJ") {
        newFormData = { 
            ...initialStatePJ, ...commonData, tipo_pessoa: 'PJ', cpf_cnpj: '',
            // Limpa campos de PF ao mudar para PJ
            rg: '', orgao_emissor: '', data_nascimento: '', estado_civil: '', profissao: '', nacionalidade: 'Brasileiro(a)'
        };
      }
    } else if (name === "cpf_cnpj" || name === "cnpj_secundario" || name === "cnpj_terciario") {
        // Aplica máscara ao digitar CNPJ/CPF
        newFormData[name] = formatCPFCNPJ(value, formData.tipo_pessoa, name !== "cpf_cnpj");
    }


    setFormData(newFormData);
  };

  const formatCPFCNPJ = (value, tipoPessoa, isAdicional = false) => {
    if (!value) return '';
    const apenasNumeros = value.replace(/\D/g, '');
    
    if (tipoPessoa === 'PF' && !isAdicional) { // CPF só para o principal
      return apenasNumeros.slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else if (tipoPessoa === 'PJ') { // CNPJ para principal e adicionais
      return apenasNumeros.slice(0, 14)
        .replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    return value; 
  };

  const handleCpfCnpjChange = (e) => {
    const { name, value } = e.target; // Adicionado 'name' para saber qual campo está a mudar
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    const valorFormatado = formatCPFCNPJ(value, formData.tipo_pessoa, name !== "cpf_cnpj");
    setFormData(prev => ({ ...prev, [name]: valorFormatado }));
  };


  const buscarEnderecoPorCEP = async (cep) => {
    // ... (código existente)
    if (!cep) return;
    const apenasNumeros = cep.replace(/\D/g, '');
    if (apenasNumeros.length !== 8) {
      if (cep.trim() !== '') toast.warn('CEP deve conter 8 dígitos.');
      return;
    }
    setLoadingCep(true);
    console.log("ClienteForm: Buscando CEP:", apenasNumeros);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${apenasNumeros}/json/`);
      if (!response.ok) throw new Error('Falha ao buscar CEP na API ViaCEP.');
      const data = await response.json();
      if (data.erro) {
        toast.warn('CEP não encontrado.');
        setFormData(prev => ({ ...prev, rua: '', bairro: '', cidade: '', estado: '' }));
      } else {
        setFormData(prev => ({
          ...prev, rua: data.logradouro || '', bairro: data.bairro || '',
          cidade: data.localidade || '', estado: data.uf || ''
        }));
        toast.info('Endereço carregado automaticamente pelo CEP.');
      }
    } catch (error) {
      console.error("ClienteForm: Erro ao buscar CEP:", error);
      toast.error(`Erro ao buscar CEP: ${error.message}`);
    } finally {
      setLoadingCep(false);
    }
  };
  const handleCepBlur = (e) => buscarEnderecoPorCEP(e.target.value);

  const buscarDadosCNPJ = async (cnpj, campoOrigem = "cpf_cnpj") => {
    // ... (código existente, adaptado para não sobrescrever se for CNPJ adicional)
    if (!cnpj) return;
    const apenasNumeros = cnpj.replace(/\D/g, '');
    if (apenasNumeros.length !== 14) return;

    setLoadingCnpj(true);
    console.log("ClienteForm: Buscando dados do CNPJ:", apenasNumeros, "para o campo:", campoOrigem);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${apenasNumeros}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.warn(response.status === 404 ? `CNPJ ${cnpj} não encontrado na BrasilAPI.` : 'Falha ao buscar dados do CNPJ.');
        return;
      }
      const data = await response.json();
      console.log("ClienteForm: Dados do CNPJ recebidos:", data);

      if (campoOrigem === "cpf_cnpj") { // Apenas preenche tudo se for o CNPJ principal
        setFormData(prev => ({
          ...prev,
          nome_razao_social: data.razao_social || prev.nome_razao_social,
          nome_fantasia: data.nome_fantasia || prev.nome_fantasia || '',
          cep: prev.cep || data.cep || '',
          rua: prev.rua || data.logradouro || '',
          numero: prev.numero || data.numero || '',
          bairro: prev.bairro || data.bairro || '',
          cidade: prev.cidade || data.municipio || '',
          estado: prev.estado || data.uf || '',
          telefone: prev.telefone || data.ddd_telefone_1 || '',
        }));
        toast.info('Dados da empresa (principal) carregados via CNPJ.');
        if (data.cep && !formData.rua) {
            buscarEnderecoPorCEP(data.cep);
        }
      } else {
        // Para CNPJs adicionais, talvez só queiramos a razão social ou nome fantasia como descrição
        // ou permitir que o utilizador preencha a descrição manualmente.
        // Por agora, não preenchemos automaticamente a descrição dos CNPJs adicionais.
        toast.info(`CNPJ ${cnpj} verificado.`);
      }
      
    } catch (error) {
      console.error("ClienteForm: Erro ao buscar dados do CNPJ:", error);
      toast.error(`Erro ao buscar dados do CNPJ: ${error.message}`);
    } finally {
      setLoadingCnpj(false);
    }
  };
  // handleCnpjBlur agora é chamado pelo onBlur de cada campo CNPJ
  const handleGenericCnpjBlur = (e) => {
    if (formData.tipo_pessoa === 'PJ') {
        buscarDadosCNPJ(e.target.value, e.target.name);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("ClienteForm: handleSubmit chamado. FormData atual:", formData);
    clearValidationErrors();
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros indicados no formulário.');
      return;
    }
    setLoading(true);

    const dadosParaEnviar = {
      ...formData,
      cpf_cnpj: formData.cpf_cnpj.replace(/\D/g, ''),
      data_nascimento: formData.data_nascimento || null,
      // Limpa CNPJs adicionais se não for PJ ou se estiverem vazios
      cnpj_secundario: formData.tipo_pessoa === 'PJ' && formData.cnpj_secundario ? formData.cnpj_secundario.replace(/\D/g, '') : null,
      descricao_cnpj_secundario: formData.tipo_pessoa === 'PJ' ? formData.descricao_cnpj_secundario : null,
      cnpj_terciario: formData.tipo_pessoa === 'PJ' && formData.cnpj_terciario ? formData.cnpj_terciario.replace(/\D/g, '') : null,
      descricao_cnpj_terciario: formData.tipo_pessoa === 'PJ' ? formData.descricao_cnpj_terciario : null,
    };
    // Remove campos que são apenas para PF se for PJ, e vice-versa (opcional, mas bom para limpeza)
    if (dadosParaEnviar.tipo_pessoa === 'PJ') {
        delete dadosParaEnviar.rg; delete dadosParaEnviar.orgao_emissor;
        delete dadosParaEnviar.data_nascimento; delete dadosParaEnviar.estado_civil;
        delete dadosParaEnviar.profissao; delete dadosParaEnviar.nacionalidade;
    } else {
        delete dadosParaEnviar.nome_fantasia; delete dadosParaEnviar.nire;
        delete dadosParaEnviar.inscricao_estadual; delete dadosParaEnviar.inscricao_municipal;
    }


    console.log("ClienteForm: Enviando dados para API:", dadosParaEnviar);

    try {
      const url = isEditing ? `${API_URL}/clientes/${clienteParaEditar.id}` : `${API_URL}/clientes`;
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosParaEnviar),
      });

      const responseData = await response.json();
      if (!response.ok) {
        console.error("ClienteForm: Erro da API:", responseData);
        throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} cliente. Status: ${response.status}`);
      }

      toast.success(`Cliente ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
      if (typeof onClienteChange === 'function') {
        onClienteChange();
      }
    } catch (error) {
      console.error("ClienteForm: Erro no handleSubmit:", error);
      toast.error(error.message || 'Erro desconhecido ao salvar o cliente.');
    } finally {
      setLoading(false);
    }
  };

  const renderCamposPF = () => ( /* ... código dos campos PF existente ... */ <>
      <div className="col-md-6 mb-3">
        <label htmlFor="rg" className="form-label form-label-sm">RG</label>
        <input type="text" name="rg" id="rg" className="form-control form-control-sm" value={formData.rg || ''} onChange={handleChange} />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="orgao_emissor" className="form-label form-label-sm">Órgão Emissor</label>
        <input type="text" name="orgao_emissor" id="orgao_emissor" className="form-control form-control-sm" value={formData.orgao_emissor || ''} onChange={handleChange} />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="data_nascimento" className="form-label form-label-sm">Data de Nascimento</label>
        <input type="date" name="data_nascimento" id="data_nascimento" className="form-control form-control-sm" value={formData.data_nascimento} onChange={handleChange} />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="estado_civil" className="form-label form-label-sm">Estado Civil</label>
        <select name="estado_civil" id="estado_civil" className="form-select form-select-sm" value={formData.estado_civil || ''} onChange={handleChange}>
          <option value="">Selecione...</option>
          <option value="Solteiro(a)">Solteiro(a)</option>
          <option value="Casado(a)">Casado(a)</option>
          <option value="Divorciado(a)">Divorciado(a)</option>
          <option value="Viúvo(a)">Viúvo(a)</option>
          <option value="União Estável">União Estável</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="profissao" className="form-label form-label-sm">Profissão</label>
        <input type="text" name="profissao" id="profissao" className="form-control form-control-sm" value={formData.profissao || ''} onChange={handleChange} />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="nacionalidade" className="form-label form-label-sm">Nacionalidade</label>
        <input type="text" name="nacionalidade" id="nacionalidade" className="form-control form-control-sm" value={formData.nacionalidade || 'Brasileiro(a)'} onChange={handleChange} />
      </div>
    </>);

  const renderCamposPJ = () => ( /* ... código dos campos PJ existente ... */ <>
      <div className="col-md-6 mb-3">
        <label htmlFor="nome_fantasia" className="form-label form-label-sm">Nome Fantasia</label>
        <input type="text" name="nome_fantasia" id="nome_fantasia" className="form-control form-control-sm" value={formData.nome_fantasia || ''} onChange={handleChange} />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="nire" className="form-label form-label-sm">NIRE</label>
        <input type="text" name="nire" id="nire" className="form-control form-control-sm" value={formData.nire || ''} onChange={handleChange} />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="inscricao_estadual" className="form-label form-label-sm">Inscrição Estadual</label>
        <input type="text" name="inscricao_estadual" id="inscricao_estadual" className="form-control form-control-sm" value={formData.inscricao_estadual || ''} onChange={handleChange} />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="inscricao_municipal" className="form-label form-label-sm">Inscrição Municipal</label>
        <input type="text" name="inscricao_municipal" id="inscricao_municipal" className="form-control form-control-sm" value={formData.inscricao_municipal || ''} onChange={handleChange} />
      </div>
    </>);
  
  const renderCamposCnpjAdicionais = () => (
    <>
        <h6 className="mt-4 mb-3 text-muted small">CNPJs Adicionais (Opcional)</h6>
        <div className="row">
            <div className="col-md-6 mb-3">
                <label htmlFor="cnpj_secundario" className="form-label form-label-sm">CNPJ Secundário</label>
                <input 
                    type="text" 
                    name="cnpj_secundario" 
                    id="cnpj_secundario" 
                    className={`form-control form-control-sm ${validationErrors.cnpj_secundario ? 'is-invalid' : ''}`} 
                    value={formData.cnpj_secundario || ''} 
                    onChange={handleCpfCnpjChange} // Usa o handler genérico para formatação
                    onBlur={handleGenericCnpjBlur} // Para buscar dados se desejado
                    maxLength={18}
                />
                {validationErrors.cnpj_secundario && <div className="invalid-feedback d-block">{validationErrors.cnpj_secundario}</div>}
            </div>
            <div className="col-md-6 mb-3">
                <label htmlFor="descricao_cnpj_secundario" className="form-label form-label-sm">Descrição CNPJ Secundário</label>
                <input type="text" name="descricao_cnpj_secundario" id="descricao_cnpj_secundario" className="form-control form-control-sm" value={formData.descricao_cnpj_secundario || ''} onChange={handleChange} />
            </div>
        </div>
        <div className="row">
            <div className="col-md-6 mb-3">
                <label htmlFor="cnpj_terciario" className="form-label form-label-sm">CNPJ Terciário</label>
                <input 
                    type="text" 
                    name="cnpj_terciario" 
                    id="cnpj_terciario" 
                    className={`form-control form-control-sm ${validationErrors.cnpj_terciario ? 'is-invalid' : ''}`} 
                    value={formData.cnpj_terciario || ''} 
                    onChange={handleCpfCnpjChange} // Usa o handler genérico para formatação
                    onBlur={handleGenericCnpjBlur} // Para buscar dados se desejado
                    maxLength={18}
                />
                {validationErrors.cnpj_terciario && <div className="invalid-feedback d-block">{validationErrors.cnpj_terciario}</div>}
            </div>
            <div className="col-md-6 mb-3">
                <label htmlFor="descricao_cnpj_terciario" className="form-label form-label-sm">Descrição CNPJ Terciário</label>
                <input type="text" name="descricao_cnpj_terciario" id="descricao_cnpj_terciario" className="form-control form-control-sm" value={formData.descricao_cnpj_terciario || ''} onChange={handleChange} />
            </div>
        </div>
    </>
  );

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</h5>
      </div>
      <div className="card-body p-4">
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="tipo_pessoa" className="form-label form-label-sm">Tipo Pessoa *</label>
              <select name="tipo_pessoa" id="tipo_pessoa" className={`form-select form-select-sm ${validationErrors.tipo_pessoa ? 'is-invalid' : ''}`} value={formData.tipo_pessoa} onChange={handleChange} disabled={isEditing}>
                <option value="PF">Pessoa Física (PF)</option>
                <option value="PJ">Pessoa Jurídica (PJ)</option>
              </select>
              {validationErrors.tipo_pessoa && <div className="invalid-feedback d-block">{validationErrors.tipo_pessoa}</div>}
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="cpf_cnpj" className="form-label form-label-sm">{formData.tipo_pessoa === 'PF' ? 'CPF *' : 'CNPJ Principal *'}</label>
              <div className="input-group input-group-sm">
                <input 
                    type="text" 
                    name="cpf_cnpj" 
                    id="cpf_cnpj" 
                    className={`form-control form-control-sm ${validationErrors.cpf_cnpj ? 'is-invalid' : ''}`} 
                    value={formData.cpf_cnpj} 
                    onChange={handleCpfCnpjChange} 
                    onBlur={handleGenericCnpjBlur} // Usa o handler genérico
                    disabled={isEditing} 
                    maxLength={formData.tipo_pessoa === 'PF' ? 14 : 18} 
                />
                {loadingCnpj && formData.tipo_pessoa === 'PJ' && formData.cpf_cnpj && <span className="input-group-text"><div className="spinner-border spinner-border-sm" role="status"><span className="visually-hidden">Buscando...</span></div></span>}
              </div>
              {validationErrors.cpf_cnpj && <div className="invalid-feedback d-block">{validationErrors.cpf_cnpj}</div>}
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="nome_razao_social" className="form-label form-label-sm">{formData.tipo_pessoa === 'PF' ? 'Nome Completo *' : 'Razão Social *'}</label>
            <input type="text" name="nome_razao_social" id="nome_razao_social" className={`form-control form-control-sm ${validationErrors.nome_razao_social ? 'is-invalid' : ''}`} value={formData.nome_razao_social} onChange={handleChange} />
            {validationErrors.nome_razao_social && <div className="invalid-feedback d-block">{validationErrors.nome_razao_social}</div>}
          </div>

          <div className="row">
            {formData.tipo_pessoa === 'PF' ? renderCamposPF() : renderCamposPJ()}
          </div>
          
          {/* Renderiza campos de CNPJ adicionais apenas se for Pessoa Jurídica */}
          {formData.tipo_pessoa === 'PJ' && renderCamposCnpjAdicionais()}

          <h6 className="mt-4 mb-3 text-muted small">Endereço</h6>
          <div className="row">
            <div className="col-md-4 mb-3">
              <label htmlFor="cep" className="form-label form-label-sm">CEP</label>
              <div className="input-group input-group-sm">
                <input type="text" name="cep" id="cep" className="form-control form-control-sm" value={formData.cep || ''} onChange={handleChange} onBlur={handleCepBlur} maxLength="9" />
                {loadingCep && <span className="input-group-text"><div className="spinner-border spinner-border-sm" role="status"><span className="visually-hidden">Buscando...</span></div></span>}
              </div>
            </div>
            <div className="col-md-8 mb-3">
              <label htmlFor="rua" className="form-label form-label-sm">Rua</label>
              <input type="text" name="rua" id="rua" className="form-control form-control-sm" value={formData.rua || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="row">
            <div className="col-md-3 mb-3">
              <label htmlFor="numero" className="form-label form-label-sm">Número</label>
              <input type="text" name="numero" id="numero" className="form-control form-control-sm" value={formData.numero || ''} onChange={handleChange} />
            </div>
            <div className="col-md-5 mb-3">
              <label htmlFor="bairro" className="form-label form-label-sm">Bairro</label>
              <input type="text" name="bairro" id="bairro" className="form-control form-control-sm" value={formData.bairro || ''} onChange={handleChange} />
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="cidade" className="form-label form-label-sm">Cidade</label>
              <input type="text" name="cidade" id="cidade" className="form-control form-control-sm" value={formData.cidade || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="estado" className="form-label form-label-sm">Estado (UF)</label>
              <input type="text" name="estado" id="estado" className="form-control form-control-sm" value={formData.estado || ''} onChange={handleChange} maxLength="2" />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="pais" className="form-label form-label-sm">País</label>
              <input type="text" name="pais" id="pais" className="form-control form-control-sm" value={formData.pais || 'Brasil'} onChange={handleChange} />
            </div>
          </div>

          <h6 className="mt-4 mb-3 text-muted small">Contato</h6>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="telefone" className="form-label form-label-sm">Telefone</label>
              <input type="tel" name="telefone" id="telefone" className="form-control form-control-sm" value={formData.telefone || ''} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="email" className="form-label form-label-sm">Email</label>
              <input type="email" name="email" id="email" className={`form-control form-control-sm ${validationErrors.email ? 'is-invalid' : ''}`} value={formData.email || ''} onChange={handleChange} />
              {validationErrors.email && <div className="invalid-feedback d-block">{validationErrors.email}</div>}
            </div>
          </div>
          
          <div className="mb-3">
            <label htmlFor="notas_gerais" className="form-label form-label-sm">Notas Gerais</label>
            <textarea name="notas_gerais" id="notas_gerais" className="form-control form-control-sm" value={formData.notas_gerais || ''} onChange={handleChange} rows="3"></textarea>
          </div>

          <hr className="my-4" />
          <div className="d-flex justify-content-end">
            {typeof onCancel === 'function' && (
              <button type="button" className="btn btn-outline-secondary me-2 btn-sm" onClick={onCancel} disabled={loading}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || loadingCep || loadingCnpj || Object.keys(validationErrors).some(key => validationErrors[key] && validationErrors[key] !== '')}>
              {(loading || loadingCep || loadingCnpj) && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
              {isEditing ? 'Atualizar Cliente' : 'Adicionar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ClienteForm;
