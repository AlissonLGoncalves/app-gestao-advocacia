import React from 'react'

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
        <div className="col-md-8 mb-3">
          <label htmlFor="rua" className="form-label form-label-sm">
            Rua
          </label>
          <input
            type="text"
            name="rua"
            id="rua"
            className="form-control form-control-sm"
            value={formData.rua || ''}
            onChange={onChange}
          />
        </div>
      </div>
      <div className="row">
        <div className="col-md-3 mb-3">
          <label htmlFor="numero" className="form-label form-label-sm">
            Numero
          </label>
          <input
            type="text"
            name="numero"
            id="numero"
            className="form-control form-control-sm"
            value={formData.numero || ''}
            onChange={onChange}
          />
        </div>
        <div className="col-md-5 mb-3">
          <label htmlFor="bairro" className="form-label form-label-sm">
            Bairro
          </label>
          <input
            type="text"
            name="bairro"
            id="bairro"
            className="form-control form-control-sm"
            value={formData.bairro || ''}
            onChange={onChange}
          />
        </div>
        <div className="col-md-4 mb-3">
          <label htmlFor="cidade" className="form-label form-label-sm">
            Cidade
          </label>
          <input
            type="text"
            name="cidade"
            id="cidade"
            className="form-control form-control-sm"
            value={formData.cidade || ''}
            onChange={onChange}
          />
        </div>
      </div>
      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="estado" className="form-label form-label-sm">
            Estado (UF)
          </label>
          <input
            type="text"
            name="estado"
            id="estado"
            className="form-control form-control-sm"
            value={formData.estado || ''}
            onChange={onChange}
            maxLength="2"
          />
        </div>
        <div className="col-md-6 mb-3">
          <label htmlFor="pais" className="form-label form-label-sm">
            Pais
          </label>
          <input
            type="text"
            name="pais"
            id="pais"
            className="form-control form-control-sm"
            value={formData.pais || 'Brasil'}
            onChange={onChange}
          />
        </div>
      </div>
    </>
  )
}

export default EnderecoSection
