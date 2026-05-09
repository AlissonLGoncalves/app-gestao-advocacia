import React from 'react'
import { ORGAOS_EMISSORES, PROFISSOES, NACIONALIDADES } from '../../../constants/clienteOpcoes.js'
import FormInput from '../../FormInput.jsx'

function DadosPessoaisSection({
  formData,
  isEditing,
  cpfCnpjLiberadoEdicao,
  loadingCnpj,
  validationErrors,
  onChange,
  onCpfCnpjChange,
  onToggleCpfCnpjEdicao,
  onDataNascimentoChange,
  onGenericCnpjBlur,
  formatDataParaExibicao,
}) {
  const isDjenPlaceholder =
    isEditing && typeof formData.cpf_cnpj === 'string' && formData.cpf_cnpj.startsWith('DJEN-')
  const cpfCnpjBloqueado = isEditing && !isDjenPlaceholder && !cpfCnpjLiberadoEdicao
  const renderCamposPF = () => (
    <>
      <FormInput
        label="RG"
        name="rg"
        id="rg"
        value={formData.rg || ''}
        onChange={onChange}
        placeholder="0.000.000-0"
        containerClassName="col-md-6 mb-3"
      />
      <FormInput
        label="Órgão Emissor"
        name="orgao_emissor"
        id="orgao_emissor"
        value={formData.orgao_emissor || ''}
        onChange={onChange}
        placeholder="Ex: SSP/PR"
        list="orgaos-emissores-list"
        autoComplete="off"
        containerClassName="col-md-6 mb-3"
      />
      <datalist id="orgaos-emissores-list">
        {ORGAOS_EMISSORES.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <FormInput
        label="Data de Nascimento (DD/MM/YYYY)"
        name="data_nascimento"
        id="data_nascimento"
        value={formData.data_nascimento ? formatDataParaExibicao(formData.data_nascimento) : ''}
        onChange={onDataNascimentoChange}
        placeholder="DD/MM/YYYY"
        maxLength={10}
        containerClassName="col-md-6 mb-3"
      />
      <div className="col-md-6 mb-3">
        <label htmlFor="estado_civil" className="form-label form-label-sm">
          Estado Civil
        </label>
        <select
          name="estado_civil"
          id="estado_civil"
          className="form-select form-select-sm"
          value={formData.estado_civil || ''}
          onChange={onChange}
        >
          <option value="">Selecione...</option>
          <option value="Solteiro(a)">Solteiro(a)</option>
          <option value="Casado(a)">Casado(a)</option>
          <option value="Divorciado(a)">Divorciado(a)</option>
          <option value="Viuvo(a)">Viúvo(a)</option>
          <option value="Uniao Estavel">União Estável</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <FormInput
        label="Profissão"
        name="profissao"
        id="profissao"
        value={formData.profissao || ''}
        onChange={onChange}
        placeholder="Digite ou selecione..."
        list="profissoes-list"
        autoComplete="off"
        containerClassName="col-md-6 mb-3"
      />
      <datalist id="profissoes-list">
        {PROFISSOES.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <FormInput
        label="Nacionalidade"
        name="nacionalidade"
        id="nacionalidade"
        value={formData.nacionalidade || ''}
        onChange={onChange}
        placeholder="Digite ou selecione..."
        list="nacionalidades-list"
        autoComplete="off"
        containerClassName="col-md-6 mb-3"
      />
      <datalist id="nacionalidades-list">
        {NACIONALIDADES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  )

  const renderCamposPJ = () => (
    <>
      <FormInput
        label="Nome Fantasia"
        name="nome_fantasia"
        id="nome_fantasia"
        value={formData.nome_fantasia || ''}
        onChange={onChange}
        containerClassName="col-md-6 mb-3"
      />
      <FormInput
        label="NIRE"
        name="nire"
        id="nire"
        value={formData.nire || ''}
        onChange={onChange}
        containerClassName="col-md-6 mb-3"
      />
      <FormInput
        label="Inscrição Estadual"
        name="inscricao_estadual"
        id="inscricao_estadual"
        value={formData.inscricao_estadual || ''}
        onChange={onChange}
        containerClassName="col-md-6 mb-3"
      />
      <FormInput
        label="Inscrição Municipal"
        name="inscricao_municipal"
        id="inscricao_municipal"
        value={formData.inscricao_municipal || ''}
        onChange={onChange}
        containerClassName="col-md-6 mb-3"
      />
    </>
  )

  return (
    <>
      <h6 className="mt-3 mb-3 text-muted small">Dados Pessoais</h6>
      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="tipo_pessoa" className="form-label form-label-sm">
            Tipo Pessoa *
          </label>
          <select
            name="tipo_pessoa"
            id="tipo_pessoa"
            className={`form-select form-select-sm ${validationErrors.tipo_pessoa ? 'is-invalid' : ''}`}
            value={formData.tipo_pessoa}
            onChange={onChange}
            disabled={cpfCnpjBloqueado}
          >
            <option value="PF">Pessoa Fisica (PF)</option>
            <option value="PJ">Pessoa Juridica (PJ)</option>
          </select>
          {validationErrors.tipo_pessoa && (
            <div className="invalid-feedback d-block">{validationErrors.tipo_pessoa}</div>
          )}
        </div>

        <div className="col-md-6 mb-3">
          <label htmlFor="cpf_cnpj" className="form-label form-label-sm">
            {formData.tipo_pessoa === 'PF' ? 'CPF *' : 'CNPJ Principal *'}
          </label>
          <div className="input-group input-group-sm">
            <input
              type="text"
              name="cpf_cnpj"
              id="cpf_cnpj"
              className={`form-control form-control-sm ${validationErrors.cpf_cnpj ? 'is-invalid' : ''}`}
              value={isDjenPlaceholder ? '' : formData.cpf_cnpj}
              onChange={onCpfCnpjChange}
              onBlur={onGenericCnpjBlur}
              disabled={cpfCnpjBloqueado}
              maxLength={formData.tipo_pessoa === 'PF' ? 14 : 18}
              placeholder={formData.tipo_pessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
            />
            {loadingCnpj && formData.tipo_pessoa === 'PJ' && formData.cpf_cnpj && (
              <span className="input-group-text">
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Buscando...</span>
                </div>
              </span>
            )}
          </div>
          {isDjenPlaceholder && (
            <small className="text-muted d-block mt-1">
              Cliente criado pela triagem DJEN sem CPF/CNPJ. Preencha o documento real para
              completar o cadastro.
            </small>
          )}
          {validationErrors.cpf_cnpj && (
            <div className="invalid-feedback d-block">{validationErrors.cpf_cnpj}</div>
          )}
          {isEditing && !isDjenPlaceholder && (
            <button
              type="button"
              className="btn btn-link btn-sm px-0 mt-1"
              onClick={onToggleCpfCnpjEdicao}
            >
              {cpfCnpjLiberadoEdicao
                ? `Bloquear ${formData.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}`
                : `Alterar ${formData.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}`}
            </button>
          )}
        </div>
      </div>

      <FormInput
        label={formData.tipo_pessoa === 'PF' ? 'Nome Completo *' : 'Razao Social *'}
        name="nome_razao_social"
        id="nome_razao_social"
        value={formData.nome_razao_social}
        onChange={onChange}
        error={validationErrors.nome_razao_social}
      />

      <div className="row">
        {formData.tipo_pessoa === 'PF' ? renderCamposPF() : renderCamposPJ()}
      </div>

      {formData.tipo_pessoa === 'PJ' && (
        <>
          <h6 className="mt-4 mb-3 text-muted small">CNPJs Adicionais (Opcional)</h6>
          <div className="row">
            <FormInput
              label="CNPJ Secundario"
              name="cnpj_secundario"
              id="cnpj_secundario"
              value={formData.cnpj_secundario || ''}
              onChange={onCpfCnpjChange}
              onBlur={onGenericCnpjBlur}
              error={validationErrors.cnpj_secundario}
              maxLength={18}
              containerClassName="col-md-6 mb-3"
            />
            <FormInput
              label="Descricao CNPJ Secundario"
              name="descricao_cnpj_secundario"
              id="descricao_cnpj_secundario"
              value={formData.descricao_cnpj_secundario || ''}
              onChange={onChange}
              containerClassName="col-md-6 mb-3"
            />
          </div>
          <div className="row">
            <FormInput
              label="CNPJ Terciario"
              name="cnpj_terciario"
              id="cnpj_terciario"
              value={formData.cnpj_terciario || ''}
              onChange={onCpfCnpjChange}
              onBlur={onGenericCnpjBlur}
              error={validationErrors.cnpj_terciario}
              maxLength={18}
              containerClassName="col-md-6 mb-3"
            />
            <FormInput
              label="Descricao CNPJ Terciario"
              name="descricao_cnpj_terciario"
              id="descricao_cnpj_terciario"
              value={formData.descricao_cnpj_terciario || ''}
              onChange={onChange}
              containerClassName="col-md-6 mb-3"
            />
          </div>

          <h6 className="mt-4 mb-3 text-muted small">
            Representante Legal (pessoa que assina pela empresa)
          </h6>
          <div className="row">
            <FormInput
              label="Nome do Responsável"
              name="responsavel_nome"
              id="responsavel_nome"
              value={formData.responsavel_nome || ''}
              onChange={onChange}
              placeholder="Ex: João da Silva"
              containerClassName="col-md-5 mb-3"
            />
            <FormInput
              label="CPF do Responsável"
              name="responsavel_cpf"
              id="responsavel_cpf"
              value={formData.responsavel_cpf || ''}
              onChange={onChange}
              placeholder="000.000.000-00"
              maxLength={14}
              containerClassName="col-md-3 mb-3"
            />
            <FormInput
              label="Cargo"
              name="responsavel_cargo"
              id="responsavel_cargo"
              value={formData.responsavel_cargo || ''}
              onChange={onChange}
              placeholder="Ex: Sócio Administrador"
              containerClassName="col-md-4 mb-3"
            />
          </div>
        </>
      )}
    </>
  )
}

export default DadosPessoaisSection
