// Arquivo: src/ClienteForm.jsx
// Formulário para adicionar e editar clientes, utilizando react-toastify para feedback.
// Nenhuma alteração de estilização significativa nesta etapa, pois o foco é na lista.
// O código deste formulário já foi atualizado para usar toasts.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { toast } from 'react-toastify'; 

// Estado inicial para Pessoa Física
const initialStatePF = {
    nome_razao_social: '', cpf_cnpj: '', tipo_pessoa: 'PF', rg: '', orgao_emissor: '',
    data_nascimento: '', estado_civil: '', profissao: '', nacionalidade: 'Brasileiro(a)',
    cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '', pais: 'Brasil',
    telefone: '', email: '', notas_gerais: ''
};

// Estado inicial para Pessoa Jurídica
const initialStatePJ = {
    nome_razao_social: '', cpf_cnpj: '', tipo_pessoa: 'PJ', nome_fantasia: '', nire: '',
    inscricao_estadual: '', inscricao_municipal: '', cep: '', rua: '', numero: '',
    bairro: '', cidade: '', estado: '', pais: 'Brasil', telefone: '', email: '', notas_gerais: ''
};

function ClienteForm({ clienteParaEditar, onClienteChange, onCancel }) {
    const [formData, setFormData] = useState(initialStatePF);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    const clearValidationErrors = useCallback(() => {
        setValidationErrors({});
    }, []);

    useEffect(() => {
        clearValidationErrors();
        if (clienteParaEditar) {
            const dadosEdit = { ...clienteParaEditar };
            if (dadosEdit.data_nascimento && typeof dadosEdit.data_nascimento === 'string') {
                dadosEdit.data_nascimento = dadosEdit.data_nascimento.split('T')[0];
            }
            if (!dadosEdit.tipo_pessoa) { 
                dadosEdit.tipo_pessoa = dadosEdit.cpf_cnpj && dadosEdit.cpf_cnpj.replace(/\D/g, '').length === 14 ? 'PJ' : 'PF';
            }
            const initialStateForEdit = dadosEdit.tipo_pessoa === 'PJ' ? initialStatePJ : initialStatePF;
            setFormData({ ...initialStateForEdit, ...dadosEdit });
            setIsEditing(true);
        } else {
            setFormData(initialStatePF); 
            setIsEditing(false);
        }
    }, [clienteParaEditar, clearValidationErrors]);

    const validateForm = () => {
        const errors = {};
        if (!formData.nome_razao_social.trim()) errors.nome_razao_social = 'Nome / Razão Social é obrigatório.';
        if (!formData.cpf_cnpj.trim()) {
            errors.cpf_cnpj = 'CPF / CNPJ é obrigatório.';
        } else {
            const numCpfCnpj = formData.cpf_cnpj.replace(/\D/g, '');
            if (formData.tipo_pessoa === 'PF' && numCpfCnpj.length !== 11) errors.cpf_cnpj = 'CPF deve conter 11 dígitos.';
            if (formData.tipo_pessoa === 'PJ' && numCpfCnpj.length !== 14) errors.cpf_cnpj = 'CNPJ deve conter 14 dígitos.';
        }
        if (!formData.tipo_pessoa) errors.tipo_pessoa = 'Tipo de Pessoa é obrigatório.';
        if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) errors.email = 'Formato de e-mail inválido.';
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (validationErrors[name]) setValidationErrors(prev => ({...prev, [name]: ''}));

        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === "tipo_pessoa") {
            const commonData = { 
                nome_razao_social: formData.nome_razao_social, 
                cpf_cnpj: formData.cpf_cnpj,
                cep: formData.cep, rua: formData.rua, numero: formData.numero, bairro: formData.bairro, 
                cidade: formData.cidade, estado: formData.estado, pais: formData.pais,
                telefone: formData.telefone, email: formData.email, notas_gerais: formData.notas_gerais
            };
            if (value === "PF") {
                setFormData({ ...initialStatePF, ...commonData, tipo_pessoa: 'PF' });
            } else if (value === "PJ") {
                setFormData({ ...initialStatePJ, ...commonData, tipo_pessoa: 'PJ' });
            }
        }
    };

    const formatCPFCNPJ = (value, tipo) => {
        const apenasNumeros = value.replace(/\D/g, '');
        if (tipo === 'PF') {
            return apenasNumeros.slice(0, 11)
                .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else if (tipo === 'PJ') {
            return apenasNumeros.slice(0, 14)
                .replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        }
        return value;
    };
    const handleCpfCnpjChange = (e) => {
        if (validationErrors.cpf_cnpj) setValidationErrors(prev => ({...prev, cpf_cnpj: ''}));
        const valorFormatado = formatCPFCNPJ(e.target.value, formData.tipo_pessoa);
        setFormData(prev => ({ ...prev, cpf_cnpj: valorFormatado }));
    };

    const buscarEnderecoPorCEP = async (cep) => {
        const apenasNumeros = cep.replace(/\D/g, '');
        if (apenasNumeros.length !== 8) {
            if (cep.trim() !== '') toast.warn('CEP deve conter 8 dígitos.');
            return;
        }
        setLoadingCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${apenasNumeros}/json/`);
            if (!response.ok) throw new Error('Falha ao buscar CEP.');
            const data = await response.json();
            if (data.erro) {
                toast.warn('CEP não encontrado.');
                setFormData(prev => ({ ...prev, rua: '', bairro: '', cidade: '', estado: '' }));
            } else {
                setFormData(prev => ({
                    ...prev, rua: data.logradouro || '', bairro: data.bairro || '',
                    cidade: data.localidade || '', estado: data.uf || ''
                }));
                toast.info('Endereço carregado pelo CEP.');
            }
        } catch (error) {
            toast.error(`Erro ao buscar CEP: ${error.message}`);
        } finally { setLoadingCep(false); }
    };
    const handleCepBlur = (e) => buscarEnderecoPorCEP(e.target.value);

    const buscarDadosCNPJ = async (cnpj) => {
        const apenasNumeros = cnpj.replace(/\D/g, '');
        if (apenasNumeros.length !== 14) return;
        setLoadingCnpj(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${apenasNumeros}`);
            if (!response.ok) {
                toast.warn(response.status === 404 ? 'CNPJ não encontrado.' : 'Falha ao buscar CNPJ.');
                return;
            }
            const data = await response.json();
            setFormData(prev => ({
                ...prev,
                nome_razao_social: data.razao_social || prev.nome_razao_social,
                nome_fantasia: data.nome_fantasia || '',
                cep: data.cep || prev.cep,
                rua: data.logradouro || '', numero: data.numero || '', bairro: data.bairro || '',
                cidade: data.municipio || '', estado: data.uf || '',
                telefone: data.ddd_telefone_1 || prev.telefone,
                email: data.email || prev.email,
            }));
            toast.info('Dados do CNPJ carregados.');
            if (data.cep) buscarEnderecoPorCEP(data.cep);
        } catch (error) {
            toast.error(`Erro ao buscar dados do CNPJ: ${error.message}`);
        } finally { setLoadingCnpj(false); }
    };
    const handleCnpjBlur = (e) => { if (formData.tipo_pessoa === 'PJ') buscarDadosCNPJ(e.target.value); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearValidationErrors();
        if (!validateForm()) {
            toast.error('Por favor, corrija os erros indicados no formulário.');
            return;
        }
        setLoading(true);
        const dadosParaEnviar = { ...formData, cpf_cnpj: formData.cpf_cnpj.replace(/\D/g, '') };
        if (dadosParaEnviar.data_nascimento === '') dadosParaEnviar.data_nascimento = null;

        try {
            const url = isEditing ? `${API_URL}/clientes/${clienteParaEditar.id}` : `${API_URL}/clientes`;
            const method = isEditing ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosParaEnviar),
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.erro || `Falha ao ${isEditing ? 'atualizar' : 'adicionar'} cliente`);
            }
            toast.success(`Cliente ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
            if (typeof onClienteChange === 'function') onClienteChange();
            if (isEditing && typeof onCancel === 'function') {
                 onCancel(); 
            }
            if (!isEditing) {
                 setFormData(formData.tipo_pessoa === 'PJ' ? initialStatePJ : initialStatePF);
            }
        } catch (error) {
            toast.error(error.message || `Erro desconhecido ao salvar cliente.`);
        } finally { setLoading(false); }
    };

    const renderCamposPF = () => (
        <>
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
                <input type="date" name="data_nascimento" id="data_nascimento" className="form-control form-control-sm" value={formData.data_nascimento || ''} onChange={handleChange} />
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
        </>
    );

    const renderCamposPJ = () => (
        <>
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
        </>
    );

    return (
        <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
                <h5 className="mb-0">{isEditing ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</h5>
            </div>
            <div className="card-body p-4">
                {/* Removida a renderização do formMessage local, pois usaremos toasts */}
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
                            <label htmlFor="cpf_cnpj" className="form-label form-label-sm">{formData.tipo_pessoa === 'PF' ? 'CPF *' : 'CNPJ *'}</label>
                            <input type="text" name="cpf_cnpj" id="cpf_cnpj" className={`form-control form-control-sm ${validationErrors.cpf_cnpj ? 'is-invalid' : ''}`} value={formData.cpf_cnpj} onChange={handleCpfCnpjChange} onBlur={handleCnpjBlur} disabled={isEditing} maxLength={formData.tipo_pessoa === 'PF' ? 14 : 18} />
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
                        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || loadingCep || loadingCnpj || Object.keys(validationErrors).some(key => validationErrors[key])}>
                            {loading || loadingCep || loadingCnpj ? ( 
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            ) : null}
                            {isEditing ? 'Atualizar Cliente' : 'Adicionar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ClienteForm;
