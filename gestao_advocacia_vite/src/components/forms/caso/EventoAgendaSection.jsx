import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { API_URL } from '../../../config'

// Mapeamento de tipo IA → tipo de evento da agenda
const TIPO_IA_PARA_AGENDA = {
  audiencia: 'Audiência',
  prazo_contestacao: 'Prazo',
  prazo_impugnacao: 'Prazo',
  prazo_replica: 'Prazo',
  prazo_treplica: 'Prazo',
  prazo_recurso: 'Prazo',
  prazo_embargos: 'Prazo',
  prazo_alegacoes_finais: 'Prazo',
  prazo_cumprimento: 'Prazo',
  pericia: 'Perícia',
  sustentacao_oral: 'Audiência',
  outro: 'Outro',
}

const BADGE_CONFIANCA = {
  alta: { className: 'badge bg-success-subtle text-success', label: '✓ alta confiança' },
  media: { className: 'badge bg-warning-subtle text-warning', label: '~ confiança média' },
  baixa: { className: 'badge bg-danger-subtle text-danger', label: '? baixa confiança' },
}

function EventoAgendaSection({
  isEditing,
  criarEvento,
  setCriarEvento,
  eventoData,
  setEventoData,
  formData,
  eventosIA,
  setEventosIA,
}) {
  const [arquivo, setArquivo] = useState(null)
  const [extraindo, setExtraindo] = useState(false)

  if (isEditing) return null

  const handleExtrair = async () => {
    if (!arquivo) {
      toast.warning('Anexe um arquivo (PDF da intimação ou autos completos) primeiro.')
      return
    }
    setExtraindo(true)
    try {
      const fd = new FormData()
      fd.append('documento', arquivo)
      if (formData?.data_distribuicao) fd.append('data_distribuicao', formData.data_distribuicao)
      if (formData?.tipo_acao) fd.append('tipo_acao', formData.tipo_acao)
      if (formData?.vara_juizo) fd.append('vara_juizo', formData.vara_juizo)

      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/casos/extrair-eventos-ia`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 429) {
          toast.warning(data.message || 'Cota da IA esgotada.', { autoClose: 6000 })
        } else if (res.status === 503) {
          toast.error(data.message || 'IA indisponível no momento.')
        } else {
          toast.error(data.message || 'Falha ao extrair eventos.')
        }
        return
      }
      const eventos = data.eventos || []
      if (eventos.length === 0) {
        toast.info('Nenhum evento detectado no documento.')
      } else {
        toast.success(`${eventos.length} evento(s) detectado(s). Selecione quais criar.`)
      }
      // Marca todos com selecionado=true por padrão (user pode desmarcar os que não quer)
      setEventosIA(eventos.map((ev) => ({ ...ev, selecionado: true })))
    } catch (e) {
      toast.error(e?.message || 'Erro de conexão.')
    } finally {
      setExtraindo(false)
    }
  }

  const toggleEvento = (idx) => {
    setEventosIA((prev) =>
      prev.map((ev, i) => (i === idx ? { ...ev, selecionado: !ev.selecionado } : ev))
    )
  }

  const formatarData = (data, hora) => {
    if (!data) return '—'
    try {
      const d = new Date(data + (hora ? `T${hora}` : 'T00:00'))
      const opts = hora ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }
      return new Intl.DateTimeFormat('pt-BR', opts).format(d)
    } catch {
      return data + (hora ? ` ${hora}` : '')
    }
  }

  return (
    <div className="card bg-light border-0 mb-3 p-3">
      <div className="form-check mb-0">
        <input
          className="form-check-input"
          type="checkbox"
          id="criarEventoCheck"
          checked={criarEvento}
          onChange={(e) => setCriarEvento(e.target.checked)}
        />
        <label className="form-check-label fw-semibold" htmlFor="criarEventoCheck">
          Criar evento na agenda para este caso
        </label>
      </div>

      {criarEvento && (
        <>
          {/* Seção de extração via IA */}
          <div className="mt-3 p-3 border rounded bg-white">
            <div className="d-flex align-items-center mb-2">
              <span className="me-2" style={{ fontSize: '1.1rem' }}>
                ✨
              </span>
              <strong className="small">Sugerir eventos com IA (recomendado)</strong>
            </div>
            <p className="text-muted small mb-2">
              Anexe a intimação, mandado ou autos completos. A IA lê o documento e detecta
              audiências, prazo de contestação, recursos, embargos, etc — você escolhe quais virar
              evento na agenda.
            </p>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                className="form-control form-control-sm"
                style={{ maxWidth: 360 }}
                disabled={extraindo}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleExtrair}
                disabled={!arquivo || extraindo}
              >
                {extraindo ? 'Analisando...' : 'Sugerir eventos'}
              </button>
            </div>

            {/* Lista de eventos detectados pela IA */}
            {eventosIA.length > 0 && (
              <div className="mt-3">
                <small className="text-muted fw-bold d-block mb-2">
                  {eventosIA.length} evento(s) detectado(s) — desmarque os que não quer criar:
                </small>
                {eventosIA.map((ev, idx) => {
                  const badge = BADGE_CONFIANCA[ev.confianca] || BADGE_CONFIANCA.media
                  return (
                    <div
                      key={idx}
                      className={`p-2 mb-2 border rounded ${ev.selecionado ? 'bg-light' : 'bg-white opacity-50'}`}
                    >
                      <div className="form-check d-flex align-items-start gap-2">
                        <input
                          className="form-check-input mt-1"
                          type="checkbox"
                          checked={ev.selecionado}
                          onChange={() => toggleEvento(idx)}
                          id={`ev-${idx}`}
                        />
                        <label
                          className="form-check-label flex-grow-1"
                          htmlFor={`ev-${idx}`}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-flex justify-content-between align-items-start">
                            <strong className="small">{ev.titulo}</strong>
                            <span className={badge.className} style={{ fontSize: '0.65rem' }}>
                              {badge.label}
                            </span>
                          </div>
                          <div className="small text-muted mt-1">
                            <strong>{formatarData(ev.data, ev.hora)}</strong>
                            {ev.modalidade && ev.modalidade !== 'prazo_so' && (
                              <span> · {ev.modalidade}</span>
                            )}
                            {ev.local && <div>📍 {ev.local}</div>}
                            {ev.link && (
                              <div>
                                🔗{' '}
                                <a
                                  href={ev.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {ev.link.length > 60 ? ev.link.slice(0, 60) + '...' : ev.link}
                                </a>
                              </div>
                            )}
                            {ev.base_legal && <div>⚖️ {ev.base_legal}</div>}
                            {ev.observacao && (
                              <div className="mt-1" style={{ fontStyle: 'italic' }}>
                                {ev.observacao}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Formulário manual (sempre disponível, complementar à IA) */}
          <details className="mt-3">
            <summary className="text-muted small" style={{ cursor: 'pointer' }}>
              Ou crie 1 evento manualmente
            </summary>
            <div className="mt-3 row g-2">
              <div className="col-md-6">
                <label className="form-label form-label-sm">Título do Evento</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Ex: Prazo de contestação"
                  value={eventoData.titulo}
                  onChange={(e) => setEventoData((p) => ({ ...p, titulo: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label form-label-sm">Data e Hora</label>
                <input
                  type="datetime-local"
                  className="form-control form-control-sm"
                  value={eventoData.data_hora}
                  onChange={(e) => setEventoData((p) => ({ ...p, data_hora: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label form-label-sm">Tipo de Evento</label>
                <select
                  className="form-select form-select-sm"
                  value={eventoData.tipo}
                  onChange={(e) => setEventoData((p) => ({ ...p, tipo: e.target.value }))}
                >
                  <option>Prazo</option>
                  <option>Audiência</option>
                  <option>Reunião</option>
                  <option>Perícia</option>
                  <option>Outro</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label form-label-sm">Notas do Evento</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={eventoData.notas}
                  onChange={(e) => setEventoData((p) => ({ ...p, notas: e.target.value }))}
                />
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  )
}

// Exporta junto com mapping para uso em hook de submit
export { TIPO_IA_PARA_AGENDA }
export default EventoAgendaSection
