import React from 'react';

function ContatoSection({ formData, validationErrors, onChange }) {
  return (
    <>
      <h6 className="mt-4 mb-3 text-muted small">Contato</h6>
      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="telefone" className="form-label form-label-sm">Telefone</label>
          <input type="tel" name="telefone" id="telefone" className="form-control form-control-sm" value={formData.telefone || ''} onChange={onChange} />
        </div>
        <div className="col-md-6 mb-3">
          <label htmlFor="email" className="form-label form-label-sm">Email</label>
          <input type="email" name="email" id="email" className={`form-control form-control-sm ${validationErrors.email ? 'is-invalid' : ''}`} value={formData.email || ''} onChange={onChange} />
          {validationErrors.email && <div className="invalid-feedback d-block">{validationErrors.email}</div>}
        </div>
      </div>
      <div className="mb-3">
        <label htmlFor="notas_gerais" className="form-label form-label-sm">Notas Gerais</label>
        <textarea name="notas_gerais" id="notas_gerais" className="form-control form-control-sm" value={formData.notas_gerais || ''} onChange={onChange} rows="3"></textarea>
      </div>
    </>
  );
}

export default ContatoSection;
