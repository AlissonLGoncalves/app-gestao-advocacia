import React from 'react'
import FormInput from '../../FormInput.jsx'

const UFS_BRASIL = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
]

const PAISES = [
  'Brasil',
  'Argentina',
  'Bolívia',
  'Chile',
  'Colômbia',
  'Equador',
  'Paraguai',
  'Peru',
  'Suriname',
  'Uruguai',
  'Venezuela',
  'Alemanha',
  'Espanha',
  'Estados Unidos',
  'França',
  'Itália',
  'Portugal',
  'Reino Unido',
  'Angola',
  'Moçambique',
  'Cabo Verde',
  'China',
  'Índia',
  'Japão',
  'México',
]

function EnderecoSection({ formData, loadingCep, onChange, onCepBlur }) {
  return (
    <>
      <h6 className="mt-4 mb-3 text-muted small">Endereco</h6>
      <div className="row">
        <div className="col-md-4 mb-3">
          <label htmlFor="cep" className="form-label form-label-sm">
            CEP
          </label>
          <div className="input-group input-group-sm">
            <input
              type="text"
              name="cep"
              id="cep"
              className="form-control form-control-sm"
              value={formData.cep || ''}
              onChange={onChange}
              onBlur={onCepBlur}
              maxLength="9"
              placeholder="00000-000"
            />
            {loadingCep && (
              <span className="input-group-text">
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Buscando...</span>
                </div>
              </span>
            )}
          </div>
        </div>
        <FormInput
          label="Rua / Logradouro"
          name="rua"
          id="rua"
          value={formData.rua || ''}
          onChange={onChange}
          containerClassName="col-md-8 mb-3"
        />
      </div>
      <div className="row">
        <FormInput
          label="Número"
          name="numero"
          id="numero"
          value={formData.numero || ''}
          onChange={onChange}
          containerClassName="col-md-3 mb-3"
        />
        <FormInput
          label="Bairro"
          name="bairro"
          id="bairro"
          value={formData.bairro || ''}
          onChange={onChange}
          containerClassName="col-md-5 mb-3"
        />
        <FormInput
          label="Cidade"
          name="cidade"
          id="cidade"
          value={formData.cidade || ''}
          onChange={onChange}
          containerClassName="col-md-4 mb-3"
        />
      </div>
      <div className="row">
        <div className="col-md-3 mb-3">
          <label htmlFor="estado" className="form-label form-label-sm">
            Estado (UF)
          </label>
          <select
            name="estado"
            id="estado"
            className="form-select form-select-sm"
            value={formData.estado || ''}
            onChange={onChange}
          >
            <option value="">UF...</option>
            {UFS_BRASIL.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
            <option value="EX">EX (Exterior)</option>
          </select>
        </div>
        <FormInput
          label="País"
          name="pais"
          id="pais"
          value={formData.pais || ''}
          onChange={onChange}
          list="paises-list"
          autoComplete="off"
          containerClassName="col-md-5 mb-3"
        />
          <datalist id="paises-list">
            {PAISES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
      </div>
    </>
  )
}

export default EnderecoSection
