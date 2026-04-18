import React from 'react';

function EventoAgendaSection({ isEditing, criarEvento, setCriarEvento, eventoData, setEventoData }) {
  if (isEditing) return null;

  return (
    <div className="card bg-light border-0 mb-3 p-3">
      <div className="form-check mb-0">
        <input className="form-check-input" type="checkbox" id="criarEventoCheck" checked={criarEvento} onChange={(e) => setCriarEvento(e.target.checked)} />
        <label className="form-check-label fw-semibold" htmlFor="criarEventoCheck">
          Criar evento na agenda para este caso
        </label>
      </div>

      {criarEvento && (
        <div className="mt-3 row g-2">
          <div className="col-md-6">
            <label className="form-label form-label-sm">Título do Evento *</label>
            <input type="text" className="form-control form-control-sm" placeholder="Ex: Prazo de contestação" value={eventoData.titulo} onChange={(e) => setEventoData((p) => ({ ...p, titulo: e.target.value }))} />
          </div>
          <div className="col-md-6">
            <label className="form-label form-label-sm">Data e Hora *</label>
            <input type="datetime-local" className="form-control form-control-sm" value={eventoData.data_hora} onChange={(e) => setEventoData((p) => ({ ...p, data_hora: e.target.value }))} />
          </div>
          <div className="col-md-6">
            <label className="form-label form-label-sm">Tipo de Evento</label>
            <select className="form-select form-select-sm" value={eventoData.tipo} onChange={(e) => setEventoData((p) => ({ ...p, tipo: e.target.value }))}>
              <option>Prazo</option>
              <option>Audiência</option>
              <option>Reunião</option>
              <option>Perícia</option>
              <option>Outro</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label form-label-sm">Notas do Evento</label>
            <input type="text" className="form-control form-control-sm" value={eventoData.notas} onChange={(e) => setEventoData((p) => ({ ...p, notas: e.target.value }))} />
          </div>
        </div>
      )}
    </div>
  );
}

export default EventoAgendaSection;
