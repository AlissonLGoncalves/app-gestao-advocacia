import React from 'react'
import { ORGAOS_EMISSORES, PROFISSOES, NACIONALIDADES } from '../../../constants/clienteOpcoes.js'

function DadosPessoaisSection({
  formData,
  isEditing,
  loadingCnpj,
  validationErrors,
  onChange,
  onCpfCnpjChange,
  onDataNascimentoChange,
  onGenericCnpjBlur,
  formatDataParaExibicao,
}) {
  const isDjenPlaceholder =
    isEditing && typeof formData.cpf_cnpj === 'string' && formData.cpf_cnpj.startsWith('DJEN-')
  const cpfCnpjBloqueado = isEditing && !isDjenPlaceholder
  const renderCamposPF = () => (
    <>
      <div className="col-md-6 mb-3">
        <label htmlFor="rg" className="form-label form-label-sm">
          RG
        </label>
        <input
          type="text"
          name="rg"
          id="rg"
          className="form-control form-control-sm"
          value={formData.rg || ''}
          onChange={onChange}
          placeholder="0.000.000-0"
        />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="orgao_emissor" className="form-label form-label-sm">
          Órgão Emissor
        </label>
        <input
          type="text"
          name="orgao_emissor"
          id="orgao_emissor"
          className="form-control form-control-sm"
          value={formData.orgao_emissor || ''}
          onChange={onChange}
          placeholder="Ex: SSP/PR"
          list="orgaos-emissores-list"
          autoComplete="off"
        />
        <datalist id="orgaos-emissores-list">
          {ORGAOS_EMISSORES.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="data_nascimento" className="form-label form-label-sm">
          Data de Nascimento (DD/MM/YYYY)
        </label>
        <input
          type="text"
          name="data_nascimento"
          id="data_nascimento"
          className="form-control form-control-sm"
          value={formData.data_nascimento ? formatDataParaExibicao(formData.data_nascimento) : ''}
          onChange={onDataNascimentoChange}
          placeholder="DD/MM/YYYY"
          maxLength="10"
        />
      </div>
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
      <div className="col-md-6 mb-3">
        <label htmlFor="profissao" className="form-label form-label-sm">
          Profissão
        </label>
        <input
          type="text"
          name="profissao"
          id="profissao"
          className="form-control form-control-sm"
          value={formData.profissao || ''}
          onChange={onChange}
          placeholder="Digite ou selecione..."
          list="profissoes-list"
          autoComplete="off"
        />
        <datalist id="profissoes-list">
          {PROFISSOES.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="nacionalidade" className="form-label form-label-sm">
          Nacionalidade
        </label>
        <input
          type="text"
          name="nacionalidade"
          id="nacionalidade"
          className="form-control form-control-sm"
          value={formData.nacionalidade || ''}
          onChange={onChange}
          placeholder="Digite ou selecione..."
          list="nacionalidades-list"
          autoComplete="off"
        />
        <datalist id="nacionalidades-list">
          {NACIONALIDADES.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
    </>
  )

  const renderCamposPJ = () => (
    <>
      <div className="col-md-6 mb-3">
        <label htmlFor="nome_fantasia" className="form-label form-label-sm">
          Nome Fantasia
        </label>
        <input
          type="text"
          name="nome_fantasia"
          id="nome_fantasia"
          className="form-control form-control-sm"
          value={formData.nome_fantasia || ''}
          onChange={onChange}
        />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="nire" className="form-label form-label-sm">
          NIRE
        </label>
        <input
          type="text"
          name="nire"
          id="nire"
          className="form-control form-control-sm"
          value={formData.nire || ''}
          onChange={onChange}
        />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="inscricao_estadual" className="form-label form-label-sm">
          Inscrição Estadual
        </label>
        <input
          type="text"
          name="inscricao_estadual"
          id="inscricao_estadual"
          className="form-control form-control-sm"
          value={formData.inscricao_estadual || ''}
          onChange={onChange}
        />
      </div>
      <div className="col-md-6 mb-3">
        <label htmlFor="inscricao_municipal" className="form-label form-label-sm">
          Inscrição Municipal
        </label>
        <input
          type="text"
          name="inscricao_municipal"
          id="inscricao_municipal"
          className="form-control form-control-sm"
          value={formData.inscricao_municipal || ''}
          onChange={onChange}
        />
      </div>
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
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor="nome_razao_social" className="form-label form-label-sm">
          {formData.tipo_pessoa === 'PF' ? 'Nome Completo *' : 'Razao Social *'}
        </label>
        <input
          type="text"
          name="nome_razao_social"
          id="nome_razao_social"
          className={`form-control form-control-sm ${validationErrors.nome_razao_social ? 'is-invalid' : ''}`}
          value={formData.nome_razao_social}
          onChange={onChange}
        />
        {validationErrors.nome_razao_social && (
          <div className="invalid-feedback d-block">{validationErrors.nome_razao_social}</div>
        )}
      </div>

      <div className="row">
        {formData.tipo_pessoa === 'PF' ? renderCamposPF() : renderCamposPJ()}
      </div>

      {formData.tipo_pessoa === 'PJ' && (
        <>
          <h6 className="mt-4 mb-3 text-muted small">CNPJs Adicionais (Opcional)</h6>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="cnpj_secundario" className="form-label form-label-sm">
                CNPJ Secundario
              </label>
              <input
                type="text"
                name="cnpj_secundario"
                id="cnpj_secundario"
                className={`form-control form-control-sm ${validationErrors.cnpj_secundario ? 'is-invalid' : ''}`}
                value={formData.cnpj_secundario || ''}
                onChange={onCpfCnpjChange}
                onBlur={onGenericCnpjBlur}
                maxLength={18}
              />
              {validationErrors.cnpj_secundario && (
                <div className="invalid-feedback d-block">{validationErrors.cnpj_secundario}</div>
              )}
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="descricao_cnpj_secundario" className="form-label form-label-sm">
                Descricao CNPJ Secundario
              </label>
              <input
                type="text"
                name="descricao_cnpj_secundario"
                id="descricao_cnpj_secundario"
                className="form-control form-control-sm"
                value={formData.descricao_cnpj_secundario || ''}
                onChange={onChange}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="cnpj_terciario" className="form-label form-label-sm">
                CNPJ Terciario
              </label>
              <input
                type="text"
                name="cnpj_terciario"
                id="cnpj_terciario"
                className={`form-control form-control-sm ${validationErrors.cnpj_terciario ? 'is-invalid' : ''}`}
                value={formData.cnpj_terciario || ''}
                onChange={onCpfCnpjChange}
                onBlur={onGenericCnpjBlur}
                maxLength={18}
              />
              {validationErrors.cnpj_terciario && (
                <div className="invalid-feedback d-block">{validationErrors.cnpj_terciario}</div>
              )}
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="descricao_cnpj_terciario" className="form-label form-label-sm">
                Descricao CNPJ Terciario
              </label>
              <input
                type="text"
                name="descricao_cnpj_terciario"
                id="descricao_cnpj_terciario"
                className="form-control form-control-sm"
                value={formData.descricao_cnpj_terciario || ''}
                onChange={onChange}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default DadosPessoaisSection
