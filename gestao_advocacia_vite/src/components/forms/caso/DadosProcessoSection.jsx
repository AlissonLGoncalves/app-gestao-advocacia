import React from 'react'
import FormInput from '../../FormInput.jsx'

// App leve: `mostrarAvancado` controla os campos secundários (status,
// prioridade, tipo de ação, área, valor, notas). Só o essencial — número do
// processo, título e cliente — fica visível por padrão; o resto vai pra
// "Mais detalhes". Todos continuam existindo e salvando igual.
function DadosProcessoSection({
  formData,
  clientes,
  cnjInfo,
  isSyncingCNJ,
  validationErrors,
  onChange,
  onNumeroProcessoChange,
  mostrarAvancado = true,
}) {
  return (
    <>
      <FormInput
        label="Número do Processo (CNJ)"
        type="text"
        name="numero_processo"
        id="numero_processo_caso"
        value={formData.numero_processo || ''}
        onChange={onNumeroProcessoChange}
        placeholder="0000000-00.0000.0.00.0000"
        maxLength={25}
        containerClassName="mb-1"
      />
      <div className="mb-3">
        {cnjInfo && (
          <div className="alert alert-info py-1 px-2 mt-1 mb-0 small d-flex gap-3 flex-wrap align-items-center">
            <span>
              <strong>Tribunal:</strong> {cnjInfo.tribunalNome}
            </span>
            <span>
              <strong>Âmbito:</strong> {cnjInfo.areaSugerida}
            </span>
            <span>
              <strong>Ano:</strong> {cnjInfo.ano}
            </span>
            <span>
              <strong>Instância sugerida:</strong> {cnjInfo.instanciaSugerida}
            </span>
            {isSyncingCNJ && (
              <span className="text-primary fw-semibold ms-auto" style={{ fontSize: '0.8rem' }}>
                <span
                  className="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                />
                Apurando DataJud/TJPR...
              </span>
            )}
          </div>
        )}
      </div>

      <FormInput
        label="Título do Caso"
        name="titulo"
        id="titulo_caso"
        value={formData.titulo}
        onChange={onChange}
        error={validationErrors.titulo}
        required
      />

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="cliente_id_caso" className="form-label form-label-sm">
            Cliente Associado *
          </label>
          <select
            name="cliente_id"
            id="cliente_id_caso"
            className={`form-select form-select-sm ${validationErrors.cliente_id ? 'is-invalid' : ''}`}
            value={formData.cliente_id}
            onChange={onChange}
          >
            <option value="">Selecione um cliente...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_razao_social}
              </option>
            ))}
          </select>
          {validationErrors.cliente_id && (
            <div className="invalid-feedback d-block">{validationErrors.cliente_id}</div>
          )}
        </div>
        <div className={`col-md-3 mb-3 ${mostrarAvancado ? '' : 'd-none'}`}>
          <label htmlFor="status_caso" className="form-label form-label-sm">
            Status *
          </label>
          <select
            name="status"
            id="status_caso"
            className={`form-select form-select-sm ${validationErrors.status ? 'is-invalid' : ''}`}
            value={formData.status}
            onChange={onChange}
          >
            <option value="Ativo">Ativo</option>
            <option value="Suspenso">Suspenso</option>
            <option value="Encerrado">Encerrado</option>
            <option value="Arquivado">Arquivado</option>
          </select>
        </div>
        <div className={`col-md-3 mb-3 ${mostrarAvancado ? '' : 'd-none'}`}>
          <label htmlFor="prioridade_caso" className="form-label form-label-sm">
            Prioridade
          </label>
          <select
            name="prioridade"
            id="prioridade_caso"
            className="form-select form-select-sm"
            value={formData.prioridade || 'Normal'}
            onChange={onChange}
          >
            <option value="Urgente">Urgente</option>
            <option value="Alta">Alta</option>
            <option value="Normal">Normal</option>
            <option value="Baixa">Baixa</option>
          </select>
        </div>
      </div>

      <div className={`row ${mostrarAvancado ? '' : 'd-none'}`}>
        <FormInput
          label="Tipo de Ação"
          name="tipo_acao"
          id="tipo_acao_caso"
          value={formData.tipo_acao || ''}
          onChange={onChange}
          containerClassName="col-md-6 mb-3"
        />
        <div className="col-md-6 mb-3">
          <label htmlFor="area_direito_caso" className="form-label form-label-sm">
            Área do Direito
          </label>
          <select
            name="area_direito"
            id="area_direito_caso"
            className="form-select form-select-sm"
            value={formData.area_direito || ''}
            onChange={onChange}
          >
            <option value="">Selecione...</option>
            <option>Cível</option>
            <option>Trabalhista</option>
            <option>Criminal</option>
            <option>Família</option>
            <option>Tributário</option>
            <option>Empresarial</option>
            <option>Previdenciário</option>
            <option>Administrativo</option>
            <option>Consumidor</option>
            <option>Eleitoral</option>
            <option>Federal</option>
            <option>Constitucional</option>
            <option>Militar</option>
            <option>Ambiental</option>
            <option>Outro</option>
          </select>
        </div>
      </div>

      <FormInput
        label="Valor da Causa (R$)"
        type="number"
        name="valor_causa"
        id="valor_causa_caso"
        value={formData.valor_causa}
        onChange={onChange}
        error={validationErrors.valor_causa}
        step="0.01"
        placeholder="Ex: 1500.50"
        containerClassName={mostrarAvancado ? 'mb-3' : 'd-none'}
      />

      <FormInput
        as="textarea"
        label="Notas sobre o Caso"
        name="notas_caso"
        id="notas_caso_form"
        value={formData.notas_caso || ''}
        onChange={onChange}
        rows="3"
        containerClassName={mostrarAvancado ? 'mb-3' : 'd-none'}
      />
    </>
  )
}

export default DadosProcessoSection
