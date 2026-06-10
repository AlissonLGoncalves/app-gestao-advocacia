// src/components/ItemAgendaForm.jsx
// Modal unificado para criar/editar ItemAgenda (PR D3).
//
// Substitui a separacao entre "Novo Evento" (EventoAgendaForm) e "Novo
// Prazo" (PrazosPage modal). Usuario escolhe o tipo no inicio do form e
// os campos relevantes aparecem condicionalmente:
//   - tipo=tarefa: titulo + categoria + data_vencimento (opcional)
//                  + status + prioridade + caso + descricao
//   - tipo=evento: titulo + categoria + data_inicio (obrigat.) + data_fim
//                  + status + prioridade + caso + descricao
//
// Backend single source: POST/PUT /v1/itens-agenda
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { createItemAgenda, updateItemAgenda } from '../api/itensAgenda.js'
import { listCasos } from '../api/casos.js'

const CATEGORIAS = [
  'Prazo',
  'Audiencia',
  'Reuniao',
  'Peticionamento',
  'Ligacao',
  'Lembrete',
  'Outros',
]
const STATUS = ['Pendente', 'Em Andamento', 'Concluido', 'Cancelado']
const PRIORIDADES = ['Baixa', 'Normal', 'Alta', 'Urgente']

// Converte ISO 8601 do backend pra valor de <input type="datetime-local">
const toDateTimeLocal = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

// Converte 'YYYY-MM-DD' do <input type="date"> pra ISO completo
// (00:00 local) que o backend aceita.
const toDateOnly = (iso) => {
  if (!iso) return ''
  if (iso.includes('T')) return iso.split('T')[0]
  return iso
}

const initialState = {
  tipo: 'tarefa',
  titulo: '',
  categoria: 'Prazo',
  status: 'Pendente',
  prioridade: 'Normal',
  data_inicio: '',
  data_fim: '',
  data_vencimento: '',
  caso_id: '',
  descricao: '',
}

// casoFixo: { id, label } — quando passado (ex: criar prazo DENTRO de um caso),
// o item ja nasce vinculado aquele caso e o seletor de caso fica travado.
// Evita o usuario ter que reescolher o caso e impede vincular ao caso errado.
function ItemAgendaForm({
  itemParaEditar,
  onSalvo,
  onCancel,
  defaultTipo = 'tarefa',
  casoFixo = null,
}) {
  const [formData, setFormData] = useState({
    ...initialState,
    tipo: defaultTipo,
    caso_id: casoFixo?.id ? String(casoFixo.id) : '',
  })
  const [salvando, setSalvando] = useState(false)
  const [casos, setCasos] = useState([])

  const editando = Boolean(itemParaEditar?.id)

  // Carrega casos pra select (single fetch — pequena lista). Pula quando o
  // caso ja vem travado (casoFixo) — nao precisa da lista.
  useEffect(() => {
    if (casoFixo?.id) return
    listCasos()
      .then((data) => setCasos(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.warn('ItemAgendaForm: erro ao carregar casos', err)
      })
  }, [casoFixo])

  // Hidrata form com dados do item ao editar
  useEffect(() => {
    if (!itemParaEditar) {
      setFormData({
        ...initialState,
        tipo: defaultTipo,
        caso_id: casoFixo?.id ? String(casoFixo.id) : '',
      })
      return
    }
    setFormData({
      tipo: itemParaEditar.tipo || 'tarefa',
      titulo: itemParaEditar.titulo || '',
      categoria: itemParaEditar.categoria || 'Prazo',
      status: itemParaEditar.status || 'Pendente',
      prioridade: itemParaEditar.prioridade || 'Normal',
      data_inicio: toDateTimeLocal(itemParaEditar.data_inicio),
      data_fim: toDateTimeLocal(itemParaEditar.data_fim),
      data_vencimento: toDateOnly(itemParaEditar.data_vencimento),
      caso_id: itemParaEditar.caso_id
        ? String(itemParaEditar.caso_id)
        : casoFixo?.id
          ? String(casoFixo.id)
          : '',
      descricao: itemParaEditar.descricao || '',
    })
  }, [itemParaEditar, defaultTipo, casoFixo])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.titulo.trim()) {
      toast.error('Título é obrigatório.')
      return
    }
    if (formData.tipo === 'evento' && !formData.data_inicio) {
      toast.error('Eventos exigem data de início.')
      return
    }

    setSalvando(true)
    try {
      // Monta payload: omite campos vazios pra deixar backend usar defaults.
      const payload = {
        tipo: formData.tipo,
        titulo: formData.titulo.trim(),
        categoria: formData.categoria,
        status: formData.status,
        prioridade: formData.prioridade,
        descricao: formData.descricao.trim() || null,
        caso_id: formData.caso_id ? parseInt(formData.caso_id, 10) : null,
      }
      if (formData.tipo === 'evento') {
        payload.data_inicio = formData.data_inicio
        payload.data_fim = formData.data_fim || null
      } else {
        // Tarefa: data_vencimento (data pura, sem hora). Backend aceita
        // 'YYYY-MM-DD' direto.
        payload.data_vencimento = formData.data_vencimento || null
      }

      if (editando) {
        await updateItemAgenda(itemParaEditar.id, payload)
        toast.success('Item atualizado.')
      } else {
        await createItemAgenda(payload)
        toast.success(formData.tipo === 'evento' ? 'Evento criado.' : 'Tarefa criada.')
      }
      onSalvo?.()
    } catch (err) {
      console.error('ItemAgendaForm: erro ao salvar', err)
      toast.error(err?.message || 'Erro ao salvar item.')
    } finally {
      setSalvando(false)
    }
  }

  const ehEvento = formData.tipo === 'evento'

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      role="dialog"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onCancel?.()
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{editando ? 'Editar item' : 'Novo item na agenda'}</h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Fechar"
              disabled={salvando}
              onClick={onCancel}
            />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Tipo selector — pivot principal do form */}
              {!editando && (
                <div className="mb-3">
                  <label className="form-label small text-muted">Tipo</label>
                  <div className="btn-group w-100" role="group">
                    <input
                      type="radio"
                      className="btn-check"
                      name="tipo"
                      id="tipo-tarefa"
                      value="tarefa"
                      checked={formData.tipo === 'tarefa'}
                      onChange={handleChange}
                    />
                    <label className="btn btn-outline-primary" htmlFor="tipo-tarefa">
                      Prazo
                      <small className="d-block text-muted">Aparece no Kanban; data opcional</small>
                    </label>
                    <input
                      type="radio"
                      className="btn-check"
                      name="tipo"
                      id="tipo-evento"
                      value="evento"
                      checked={formData.tipo === 'evento'}
                      onChange={handleChange}
                    />
                    <label className="btn btn-outline-primary" htmlFor="tipo-evento">
                      Evento / Compromisso
                      <small className="d-block text-muted">
                        Aparece no calendário; exige data
                      </small>
                    </label>
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">Título *</label>
                <input
                  type="text"
                  className="form-control"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleChange}
                  required
                  maxLength={250}
                />
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Categoria</label>
                  <select
                    className="form-select"
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleChange}
                  >
                    {CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Prioridade</label>
                  <select
                    className="form-select"
                    name="prioridade"
                    value={formData.prioridade}
                    onChange={handleChange}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Datas — depende do tipo */}
              <div className="row g-3 mt-1">
                {ehEvento ? (
                  <>
                    <div className="col-md-6">
                      <label className="form-label">Início *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        name="data_inicio"
                        value={formData.data_inicio}
                        onChange={handleChange}
                        required={ehEvento}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Fim</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        name="data_fim"
                        value={formData.data_fim}
                        onChange={handleChange}
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-md-6">
                    <label className="form-label">Vencimento (opcional)</label>
                    <input
                      type="date"
                      className="form-control"
                      name="data_vencimento"
                      value={formData.data_vencimento}
                      onChange={handleChange}
                    />
                  </div>
                )}
              </div>

              <div className="row g-3 mt-1">
                <div className="col-md-6">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Caso vinculado</label>
                  {casoFixo?.id ? (
                    // Caso travado: criando/editando prazo DENTRO de um caso.
                    <input
                      type="text"
                      className="form-control"
                      value={casoFixo.label || `Caso #${casoFixo.id}`}
                      disabled
                      title="Vinculado a este caso"
                    />
                  ) : (
                    <select
                      className="form-select"
                      name="caso_id"
                      value={formData.caso_id}
                      onChange={handleChange}
                    >
                      <option value="">— Sem caso —</option>
                      {casos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titulo || c.numero_processo || `Caso #${c.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label">Descrição</label>
                <textarea
                  className="form-control"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
                disabled={salvando}
              >
                <XMarkIcon style={{ width: 14, height: 14 }} className="me-1" />
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ItemAgendaForm
