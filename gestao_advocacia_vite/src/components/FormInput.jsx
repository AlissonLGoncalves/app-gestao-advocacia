import React from 'react'

function FormInput({
  as = 'input',
  label,
  name,
  id,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required = false,
  disabled = false,
  maxLength,
  step,
  rows,
  list,
  autoComplete,
  className = 'form-control-sm',
  containerClassName = 'mb-3',
}) {
  const isTextarea = as === 'textarea'
  const inputClass = `form-control ${className} ${error ? 'is-invalid' : ''}`.trim()

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={id} className="form-label form-label-sm">
          {label}
          {required && ' *'}
        </label>
      )}

      {isTextarea ? (
        <textarea
          name={name}
          id={id}
          className={inputClass}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
        />
      ) : (
        <input
          type={type}
          name={name}
          id={id}
          className={inputClass}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          step={step}
          list={list}
          autoComplete={autoComplete}
        />
      )}

      {error && <div className="invalid-feedback d-block">{error}</div>}
    </div>
  )
}

export default FormInput
