import React from 'react';

function TramitacaoSection({ formData, onChange }) {
  return (
    <>
      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="parte_contraria_caso" className="form-label form-label-sm">Parte Contrária</label>
          <input type="text" name="parte_contraria" id="parte_contraria_caso" className="form-control form-control-sm" value={formData.parte_contraria || ''} onChange={onChange} />
        </div>
        <div className="col-md-6 mb-3">
          <label htmlFor="adv_parte_contraria_caso" className="form-label form-label-sm">Adv. Parte Contrária</label>
          <input type="text" name="adv_parte_contraria" id="adv_parte_contraria_caso" className="form-control form-control-sm" value={formData.adv_parte_contraria || ''} onChange={onChange} />
        </div>
      </div>

      <div className="row">
        <div className="col-md-4 mb-3">
          <label htmlFor="vara_juizo_caso" className="form-label form-label-sm">Vara/Juízo</label>
          <input type="text" name="vara_juizo" id="vara_juizo_caso" className="form-control form-control-sm" value={formData.vara_juizo || ''} onChange={onChange} />
        </div>
        <div className="col-md-4 mb-3">
          <label htmlFor="comarca_caso" className="form-label form-label-sm">Comarca</label>
          <input type="text" name="comarca" id="comarca_caso" className="form-control form-control-sm" value={formData.comarca || ''} onChange={onChange} />
        </div>
        <div className="col-md-4 mb-3">
          <label htmlFor="instancia_caso" className="form-label form-label-sm">Instância</label>
          <input type="text" name="instancia" id="instancia_caso" className="form-control form-control-sm" value={formData.instancia || ''} onChange={onChange} />
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="fase_processual_caso" className="form-label form-label-sm">Fase Processual</label>
          <select name="fase_processual" id="fase_processual_caso" className="form-select form-select-sm" value={formData.fase_processual || ''} onChange={onChange}>
            <option value="">Selecione...</option>
            <option>Inicial</option>
            <option>Citação/Intimação</option>
            <option>Contestação</option>
            <option>Instrução</option>
            <option>Julgamento</option>
            <option>Recurso</option>
            <option>Execução</option>
            <option>Cumprimento de Sentença</option>
            <option>Encerrado</option>
          </select>
        </div>
        <div className="col-md-6 mb-3">
          <label htmlFor="data_distribuicao_caso" className="form-label form-label-sm">Data de Distribuição</label>
          <input type="date" name="data_distribuicao" id="data_distribuicao_caso" className="form-control form-control-sm" value={formData.data_distribuicao} onChange={onChange} />
        </div>
      </div>
    </>
  );
}

export default TramitacaoSection;
