// Fase 1 (auditoria UX) — formulário de contrato de honorários em modal.
//
// Antes só existia criação DENTRO do caso (HonorariosCasoCard); a página
// global /contratos era read-only — quem entrava por ela não tinha como
// criar. Este modal serve a página global: escolhe o caso (o cliente é
// derivado dele, padrão Astrea de "lançar no contexto jurídico") e cria/
// edita o contrato. Ao criar com valor total, o caller pode emendar o
// GerarParcelasModal pra já injetar as parcelas nos Recebimentos.
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { listCasos } from '../api/casos.js'
import { createContrato, updateContrato } from '../api/contratos.js'

const TIPOS = ['Fixo', 'Êxito', 'Misto', 'Mensal', 'Horas']
const STATUS = ['Ativo', 'Pendente Assinatura', 'Minuta', 'Finalizado', 'Cancelado']

function ContratoFormModal({ contratoParaEditar = null, onSalvo, onCancel }) {
  const editando = Boolean(contratoParaEditar?.id)
  const [casos, setCasos] = useState([])
  const [carregandoCasos, setCarregandoCasos] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    caso_id: contratoParaEditar?.caso_id ? String(contratoParaEditar.caso_id) : '',
    tipo_honorario: contratoParaEditar?.tipo_honorario || 'Fixo',
    valor_total: contratoParaEditar?.valor_total ?? '',
    percentual_exito: contratoParaEditar?.percentual_exito ?? '',
    data_assinatura: contratoParaEditar?.data_assinatura
      ? String(contratoParaEditar.data_assinatura).slice(0, 10)
      : '',
    status: contratoParaEditar?.status || 'Ativo',
    notas_condicoes: contratoParaEditar?.notas_condicoes || '',
  })

  useEffect(() => {
    listCasos()
      .then((data) => setCasos(Array.isArray(data) ? data : data?.items || []))
      .catch(() => toast.error('Falha ao carregar a lista de casos.'))
      .finally(() => setCarregandoCasos(false))
  }, [])

  const casoSelecionado = useMemo(
    () => casos.find((c) => String(c.id) === String(form.caso_id)),
    [casos, form.caso_id]
  )

  const usaValor = form.tipo_honorario !== 'Êxito'
  const usaPercentual = form.tipo_honorario !== 'Fixo'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.caso_id) {
      toast.warning('Selecione o caso do contrato — o cliente vem dele.')
      return
    }
    setSalvando(true)
    try {
      const payload = {
        caso_id: parseInt(form.caso_id, 10),
        cliente_id: casoSelecionado?.cliente_id,
        tipo_honorario: form.tipo_honorario,
        valor_total: usaValor && form.valor_total !== '' ? parseFloat(form.valor_total) : null,
        percentual_exito:
          usaPercentual && form.percentual_exito !== '' ? parseFloat(form.percentual_exito) : null,
        data_assinatura: form.data_assinatura || null,
        status: form.status,
        notas_condicoes: form.notas_condicoes || null,
      }
      const salvo = editando
        ? await updateContrato(contratoParaEditar.id, payload)
        : await createContrato(payload)
      toast.success(editando ? 'Contrato atualizado.' : 'Contrato criado!')
      onSalvo?.(salvo)
    } catch (err) {
      toast.error(err?.message || 'Falha ao salvar o contrato.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      style={{ background: 'rgba(0,0,0,0.5)' }}
      data-testid="contrato-form-modal"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">
                {editando ? 'Editar contrato' : 'Novo contrato de honorários'}
              </h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onCancel} />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label small fw-semibold">
                  Caso <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={form.caso_id}
                  onChange={(e) => setForm({ ...form, caso_id: e.target.value })}
                  disabled={salvando || editando || carregandoCasos}
                  required
                  data-testid="contrato-caso-select"
                >
                  <option value="">
                    {carregandoCasos ? 'Carregando casos...' : '— Selecione o caso —'}
                  </option>
                  {casos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo} {c.numero_processo ? `(${c.numero_processo})` : ''}
                    </option>
                  ))}
                </select>
                {casoSelecionado && (
                  <small className="text-muted">
                    Cliente:{' '}
                    <strong>
                      {casoSelecionado.cliente_nome || `#${casoSelecionado.cliente_id}`}
                    </strong>
                  </small>
                )}
              </div>

              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Tipo de honorário</label>
                  <select
                    className="form-select"
                    value={form.tipo_honorario}
                    onChange={(e) => setForm({ ...form, tipo_honorario: e.target.value })}
                    disabled={salvando}
                  >
                    {TIPOS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Valor total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={form.valor_total}
                    onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
                    disabled={salvando || !usaValor}
                    placeholder={usaValor ? '0,00' : '— só êxito —'}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Êxito (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="form-control"
                    value={form.percentual_exito}
                    onChange={(e) => setForm({ ...form, percentual_exito: e.target.value })}
                    disabled={salvando || !usaPercentual}
                    placeholder={usaPercentual ? 'Ex: 20' : '— só fixo —'}
                  />
                </div>
              </div>

              <div className="row g-2 mt-1">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Data de assinatura</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.data_assinatura}
                    onChange={(e) => setForm({ ...form, data_assinatura: e.target.value })}
                    disabled={salvando}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    disabled={salvando}
                  >
                    {STATUS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-2">
                <label className="form-label small fw-semibold">Condições (opcional)</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.notas_condicoes}
                  onChange={(e) => setForm({ ...form, notas_condicoes: e.target.value })}
                  disabled={salvando}
                  placeholder="Ex: entrada de 30% + saldo em 5 parcelas; êxito sobre proveito econômico."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-light"
                onClick={onCancel}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={salvando}
                data-testid="btn-salvar-contrato"
              >
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar contrato'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ContratoFormModal
