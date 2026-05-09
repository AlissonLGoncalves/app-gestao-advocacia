import React from 'react'
import FormInput from '../../FormInput.jsx'

function ContatoSection({ formData, validationErrors, onChange }) {
  return (
    <>
      <h6 className="mt-4 mb-3 text-muted small">Contato</h6>
      <div className="row">
        <FormInput
          label="Telefone"
          type="tel"
          name="telefone"
          id="telefone"
          value={formData.telefone || ''}
          onChange={onChange}
          containerClassName="col-md-6 mb-3"
        />
        <FormInput
          label="Email"
          type="email"
          name="email"
          id="email"
          value={formData.email || ''}
          onChange={onChange}
          error={validationErrors.email}
          containerClassName="col-md-6 mb-3"
        />
      </div>
      <FormInput
        as="textarea"
        label="Notas Gerais"
        name="notas_gerais"
        id="notas_gerais"
        value={formData.notas_gerais || ''}
        onChange={onChange}
        rows="3"
      />
    </>
  )
}

export default ContatoSection
