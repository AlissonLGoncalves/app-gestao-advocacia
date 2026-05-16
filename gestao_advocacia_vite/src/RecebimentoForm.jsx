// Arquivo: src/RecebimentoForm.jsx
//
// Formulario de Recebimento — versao "Recebimento Robusto" (Fase 2).
//
// Mudancas vs. versao anterior:
//   1. Cliente OPCIONAL (lancamento avulso permitido).
//   2. Botao "+ Novo" ao lado do select de Cliente abre modal de cadastro
//      rapido, sem perder o form. Cliente criado eh auto-selecionado.
//   3. Apos salvar SEM cliente, modal pergunta "Quer vincular cliente?"
//      com 3 acoes: vincular existente / criar novo / depois.
//   4. Toggle "Tipo": Unico | Recorrente | Parcelado. Quando nao for Unico,
//      o submit chama POST /recebimentos/serie em vez de POST /recebimentos.
//   5. Campos novos do backend Fase 1: status, data_vencimento, data_pagamento,
//      categoria, forma_pagamento, notas.

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import { api } from './api/client.js'
import { createRecebimento, createRecebimentoSerie, updateRecebimento } from './api/financeiro.js'
import CadastrarClienteRapidoModal from './components/CadastrarClienteRapidoModal.jsx'

const TIPO_UNICO = 'UNICO'
const TIPO_RECORRENTE = 'RECORRENTE'
const TIPO_PARCELADO = 'PARCELADO'

const STATUS_OPCOES = ['Pendente', 'Pago', 'Vencido', 'Cancelado', 'Em Negociacao']

const CATEGORIAS = [
  'Honorarios Advocaticios',
  'Honorarios de Exito',
  'Consultoria',
  'Custas Processuais (Reembolso)',
  'Despesas (Reembolso)',
  'Acordo Judicial',
  'Outros Recebimentos',
]

const FORMAS_PAGAMENTO = [
  'PIX',
  'Transferencia Bancaria',
  'Boleto',
  'Cartao de Credito',
  'Dinheiro',
  'Cheque',
  'Outro',
]

const FREQUENCIAS = [
  { value: 'MENSAL', label: 'Mensal' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'QUINZENAL', label: 'Quinzenal' },
  { value: 'ANUAL', label: 'Anual' },
]

const hoje = () => new Date().toISOString().split('T')[0]

const initialState = () => ({
  cliente_id: '',
  caso_id: '',
  descricao: '',
  categoria: 'Honorarios Advocaticios',
  valor: '',
  data_vencimento: hoje(),
  data_pagamento: '',
  status: 'Pendente',
  forma_pagamento: '',
  notas: '',
  // Tipo de criacao (so usado em modo "novo"; edicao sempre eh UNICO).
  tipo: TIPO_UNICO,
  // Campos da serie (so quando tipo != UNICO)
  frequencia: 'MENSAL',
  total_parcelas: 12,
  // Fase 4: flag "Sem vencimento". Quando true, data_vencimento e
  // enviado como null pro backend.
  semVencimento: false,
})

function RecebimentoForm({ recebimentoParaEditar, onRecebimentoChange, onCancel }) {
  const [formData, setFormData] = useState(initialState)
  const [clientes, setClientes] = useState([])
  const [casos, setCasos] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})

  // Modal de cadastro rapido de cliente
  const [modalClienteOpen, setModalClienteOpen] = useState(false)
  // Modal pos-save de "Deseja cadastrar/vincular cliente?"
  const [modalSugerirClienteData, setModalSugerirClienteData] = useState(null)

  const clearValidationErrors = useCallback(() => setValidationErrors({}), [])

  const fetchClientes = useCallback(async () => {
    try {
      const data = await api.get('/clientes?sort_by=nome_razao_social&order=asc')
      setClientes(Array.isArray(data) ? data : data.clientes || [])
    } catch (error) {
      toast.error(`Erro ao carregar clientes: ${error.message}`)
    }
  }, [])

  const fetchCasos = useCallback(async (clienteId = null) => {
    let url = '/casos?sort_by=titulo&order=asc'
    if (clienteId) url += `&cliente_id=${clienteId}`
    try {
      const data = await api.get(url)
      setCasos(Array.isArray(data) ? data : data.casos || [])
    } catch (error) {
      toast.error(`Erro ao carregar casos: ${error.message}`)
    }
  }, [])

  useEffect(() => {
    fetchClientes()
    if (recebimentoParaEditar && recebimentoParaEditar.cliente_id) {
      fetchCasos(recebimentoParaEditar.cliente_id)
    } else if (!recebimentoParaEditar) {
      fetchCasos()
    }
  }, [fetchClientes, fetchCasos, recebimentoParaEditar])

  useEffect(() => {
    clearValidationErrors()
    if (recebimentoParaEditar) {
      const dados = { ...initialState(), ...recebimentoParaEditar }
      // Datas: backend pode devolver string ISO completa.
      ;['data_vencimento', 'data_pagamento'].forEach((key) => {
        if (dados[key] && typeof dados[key] === 'string') {
          dados[key] = dados[key].split('T')[0]
        }
      })
      dados.valor = dados.valor === null || dados.valor === undefined ? '' : String(dados.valor)
      // Status default pra registros antigos sem status persistido.
      if (!dados.status) {
        dados.status = recebimentoParaEditar.recebido ? 'Pago' : 'Pendente'
      }
      dados.tipo = TIPO_UNICO // edicao nao suporta mudar pra serie
      // Detectar registros sem vencimento (data_vencimento=null no backend).
      dados.semVencimento = !dados.data_vencimento
      setFormData(dados)
      setIsEditing(true)
    } else {
      setFormData(initialState())
      setIsEditing(false)
    }
  }, [recebimentoParaEditar, clearValidationErrors])

  const validateForm = () => {
    const erros = {}
    if (!formData.descricao.trim()) erros.descricao = 'Descricao e obrigatoria.'
    if (
      formData.valor === '' ||
      Number.isNaN(parseFloat(formData.valor)) ||
      parseFloat(formData.valor) <= 0
    ) {
      erros.valor = 'Valor deve ser positivo.'
    }
    // Data de vencimento eh OPCIONAL para tipo UNICO (Fase 4: "Sem vencimento").
    // Para serie (RECORRENTE/PARCELADO) eh obrigatoria — precisa do ponto
    // de partida pra calcular vencimentos das parcelas.
    if (formData.tipo !== TIPO_UNICO && !formData.data_vencimento) {
      erros.data_vencimento = 'Data inicial e obrigatoria para series.'
    }
    if (!formData.status) erros.status = 'Status e obrigatorio.'
    if (!formData.categoria) erros.categoria = 'Categoria e obrigatoria.'
    if (formData.tipo !== TIPO_UNICO) {
      const total = parseInt(formData.total_parcelas, 10)
      if (!total || total < 1 || total > 120) {
        erros.total_parcelas = 'Numero de parcelas entre 1 e 120.'
      }
    }
    setValidationErrors(erros)
    return Object.keys(erros).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (validationErrors[name]) setValidationErrors((prev) => ({ ...prev, [name]: '' }))
    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'cliente_id') {
        fetchCasos(value)
        next.caso_id = ''
      }
      // Status -> Pago e preenche data_pagamento se vazia
      if (name === 'status' && value === 'Pago' && !prev.data_pagamento) {
        next.data_pagamento = hoje()
      }
      return next
    })
  }

  const handleClienteCriado = (cliente) => {
    setClientes((prev) =>
      [...prev, cliente].sort((a, b) =>
        String(a.nome_razao_social).localeCompare(String(b.nome_razao_social))
      )
    )
    setFormData((prev) => ({ ...prev, cliente_id: String(cliente.id), caso_id: '' }))
    fetchCasos(cliente.id)
  }

  const buildBaseBody = () => ({
    descricao: formData.descricao.trim(),
    valor: parseFloat(formData.valor),
    cliente_id: formData.cliente_id ? parseInt(formData.cliente_id, 10) : null,
    caso_id: formData.caso_id ? parseInt(formData.caso_id, 10) : null,
    categoria: formData.categoria || null,
    notas: formData.notas || null,
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearValidationErrors()
    if (!validateForm()) {
      toast.error('Corrija os campos destacados.')
      return
    }
    setLoading(true)
    try {
      if (formData.tipo === TIPO_UNICO) {
        const body = {
          ...buildBaseBody(),
          data_vencimento: formData.data_vencimento || null,
          data_pagamento: formData.data_pagamento || null,
          status: formData.status,
          forma_pagamento: formData.forma_pagamento || null,
        }
        if (isEditing) {
          await updateRecebimento(recebimentoParaEditar.id, body)
          toast.success('Recebimento atualizado.')
          onRecebimentoChange?.()
          onCancel?.()
        } else {
          const criado = await createRecebimento(body)
          toast.success('Recebimento adicionado.')
          if (!body.cliente_id) {
            // Sugerir vincular cliente apos criar sem
            setModalSugerirClienteData({ recebimento: criado, descricao: body.descricao })
          } else {
            onRecebimentoChange?.()
            setFormData(initialState())
          }
        }
      } else {
        // Serie RECORRENTE ou PARCELADO
        const body = {
          ...buildBaseBody(),
          tipo: formData.tipo,
          frequencia: formData.frequencia,
          valor_parcela: parseFloat(formData.valor),
          total_parcelas: parseInt(formData.total_parcelas, 10),
          data_inicio: formData.data_vencimento,
        }
        const resultado = await createRecebimentoSerie(body)
        toast.success(
          `Serie ${formData.tipo.toLowerCase()} criada: ${resultado.total_geradas} parcelas.`
        )
        if (!body.cliente_id) {
          setModalSugerirClienteData({
            recebimentos: resultado.parcelas,
            descricao: body.descricao,
            serie: true,
          })
        } else {
          onRecebimentoChange?.()
          setFormData(initialState())
        }
      }
    } catch (error) {
      toast.error(error?.message || 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  // ===== Modal pos-save: sugerir vincular cliente =====
  const handleSugestaoVincularExistente = () => {
    setModalSugerirClienteData(null)
    onRecebimentoChange?.()
    setFormData((prev) => ({ ...initialState(), cliente_id: prev.cliente_id }))
    toast.info('Selecione o cliente no proximo lancamento.')
  }

  const handleSugestaoCriarNovo = () => {
    setModalSugerirClienteData(null)
    setModalClienteOpen(true)
  }

  const handleSugestaoDepois = () => {
    setModalSugerirClienteData(null)
    onRecebimentoChange?.()
    setFormData(initialState())
  }

  return (
    <div className="card shadow-sm mb-4">
      <CadastrarClienteRapidoModal
        open={modalClienteOpen}
        onClose={() => setModalClienteOpen(false)}
        onCreated={(cliente) => {
          handleClienteCriado(cliente)
          // Se veio do modal pos-save, vincular ao recebimento ja criado
          if (modalSugerirClienteData) {
            const rec = modalSugerirClienteData.recebimento
            if (rec?.id) {
              updateRecebimento(rec.id, { cliente_id: cliente.id })
                .then(() => toast.success('Cliente vinculado ao recebimento.'))
                .catch((err) => toast.error(`Erro ao vincular: ${err.message}`))
            }
            onRecebimentoChange?.()
            setFormData(initialState())
          }
        }}
      />

      {modalSugerirClienteData && (
        <>
          <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <h6 className="modal-title">
                    <i className="bi bi-link-45deg me-2" />
                    Vincular um cliente?
                  </h6>
                </div>
                <div className="modal-body">
                  <p className="mb-2">
                    Voce criou{' '}
                    {modalSugerirClienteData.serie ? (
                      <strong>{modalSugerirClienteData.recebimentos.length} recebimentos</strong>
                    ) : (
                      <strong>1 recebimento</strong>
                    )}{' '}
                    sem cliente vinculado.
                  </p>
                  <p className="small text-muted mb-0">
                    Vincular ajuda a localizar depois e mantem o financeiro organizado. Voce pode
                    fazer isso depois — nao e obrigatorio.
                  </p>
                </div>
                <div className="modal-footer py-2 d-flex flex-wrap gap-2 justify-content-between">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={handleSugestaoDepois}
                  >
                    Depois
                  </button>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handleSugestaoVincularExistente}
                    >
                      <i className="bi bi-search me-1" />
                      Vincular existente
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleSugestaoCriarNovo}
                    >
                      <i className="bi bi-person-plus me-1" />
                      Cadastrar novo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}

      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Recebimento' : 'Adicionar Novo Recebimento'}</h5>
      </div>
      <div className="card-body p-4">
        <form onSubmit={handleSubmit}>
          {/* ===== Toggle Tipo (so em criacao) ===== */}
          {!isEditing && (
            <div className="mb-3">
              <label className="form-label form-label-sm d-block mb-2">Tipo de recebimento</label>
              <div className="btn-group btn-group-sm" role="group" aria-label="Tipo de recebimento">
                {[
                  { value: TIPO_UNICO, label: 'Unico', icon: 'bi-1-circle' },
                  { value: TIPO_RECORRENTE, label: 'Recorrente', icon: 'bi-arrow-repeat' },
                  { value: TIPO_PARCELADO, label: 'Parcelado', icon: 'bi-bar-chart-steps' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`btn ${formData.tipo === opt.value ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setFormData((prev) => ({ ...prev, tipo: opt.value }))}
                  >
                    <i className={`bi ${opt.icon} me-1`} />
                    {opt.label}
                  </button>
                ))}
              </div>
              <small className="d-block text-muted mt-1">
                {formData.tipo === TIPO_UNICO &&
                  'Um unico recebimento. Use pra PIX, honorario pontual, etc.'}
                {formData.tipo === TIPO_RECORRENTE &&
                  'Gera N parcelas pra frente (honorario mensal). Pode ser renovado.'}
                {formData.tipo === TIPO_PARCELADO &&
                  'Divide um valor total em N parcelas iguais (acordo, etc).'}
              </small>
            </div>
          )}

          {/* ===== Cliente + botao novo ===== */}
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="cliente_id_rec" className="form-label form-label-sm">
                Cliente Associado <span className="text-muted">(opcional)</span>
              </label>
              <div className="input-group input-group-sm">
                <select
                  name="cliente_id"
                  id="cliente_id_rec"
                  className={`form-select form-select-sm ${validationErrors.cliente_id ? 'is-invalid' : ''}`}
                  value={formData.cliente_id || ''}
                  onChange={handleChange}
                >
                  <option value="">Sem cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_razao_social}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  title="Cadastrar novo cliente sem sair do formulario"
                  onClick={() => setModalClienteOpen(true)}
                >
                  <i className="bi bi-person-plus" /> Novo
                </button>
              </div>
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="caso_id_rec" className="form-label form-label-sm">
                Caso Associado <span className="text-muted">(opcional)</span>
              </label>
              <select
                name="caso_id"
                id="caso_id_rec"
                className="form-select form-select-sm"
                value={formData.caso_id || ''}
                onChange={handleChange}
                disabled={!formData.cliente_id}
              >
                <option value="">
                  {formData.cliente_id ? 'Sem caso' : 'Escolha um cliente primeiro'}
                </option>
                {casos
                  .filter(
                    (c) =>
                      !formData.cliente_id || c.cliente_id === parseInt(formData.cliente_id, 10)
                  )
                  .map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.titulo}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* ===== Descricao ===== */}
          <div className="mb-3">
            <label htmlFor="descricao_rec" className="form-label form-label-sm">
              Descricao *
            </label>
            <input
              type="text"
              name="descricao"
              id="descricao_rec"
              className={`form-control form-control-sm ${validationErrors.descricao ? 'is-invalid' : ''}`}
              value={formData.descricao}
              onChange={handleChange}
              placeholder="Ex: Honorarios contratuais"
            />
            {validationErrors.descricao && (
              <div className="invalid-feedback d-block">{validationErrors.descricao}</div>
            )}
          </div>

          {/* ===== Categoria + Valor ===== */}
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="categoria_rec" className="form-label form-label-sm">
                Categoria *
              </label>
              <select
                name="categoria"
                id="categoria_rec"
                className={`form-select form-select-sm ${validationErrors.categoria ? 'is-invalid' : ''}`}
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
            <div className="col-md-6 mb-3">
              <label htmlFor="valor_rec" className="form-label form-label-sm">
                {formData.tipo === TIPO_UNICO ? 'Valor (R$) *' : 'Valor por parcela (R$) *'}
              </label>
              <input
                type="number"
                name="valor"
                id="valor_rec"
                className={`form-control form-control-sm ${validationErrors.valor ? 'is-invalid' : ''}`}
                value={formData.valor}
                onChange={handleChange}
                step="0.01"
                placeholder="Ex: 1500.00"
              />
              {validationErrors.valor && (
                <div className="invalid-feedback d-block">{validationErrors.valor}</div>
              )}
            </div>
          </div>

          {/* ===== Datas ===== */}
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="data_vencimento_rec" className="form-label form-label-sm">
                {formData.tipo === TIPO_UNICO ? 'Data de Vencimento' : 'Data da 1a parcela *'}
                {formData.tipo === TIPO_UNICO && (
                  <span className="text-muted ms-1">(opcional)</span>
                )}
              </label>
              <input
                type="date"
                name="data_vencimento"
                id="data_vencimento_rec"
                className={`form-control form-control-sm ${validationErrors.data_vencimento ? 'is-invalid' : ''}`}
                value={formData.data_vencimento}
                onChange={handleChange}
                disabled={formData.tipo === TIPO_UNICO && formData.semVencimento}
              />
              {formData.tipo === TIPO_UNICO && (
                <div className="form-check form-check-sm mt-1">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="semVencimentoCheck"
                    checked={!!formData.semVencimento}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setFormData((prev) => ({
                        ...prev,
                        semVencimento: checked,
                        data_vencimento: checked ? '' : hoje(),
                      }))
                    }}
                  />
                  <label className="form-check-label small text-muted" htmlFor="semVencimentoCheck">
                    Sem data de vencimento (lancamento sem prazo)
                  </label>
                </div>
              )}
              {validationErrors.data_vencimento && (
                <div className="invalid-feedback d-block">{validationErrors.data_vencimento}</div>
              )}
            </div>
            {formData.tipo === TIPO_UNICO && (
              <div className="col-md-6 mb-3">
                <label htmlFor="data_pagamento_rec" className="form-label form-label-sm">
                  Data de Pagamento <span className="text-muted">(quando recebido)</span>
                </label>
                <input
                  type="date"
                  name="data_pagamento"
                  id="data_pagamento_rec"
                  className="form-control form-control-sm"
                  value={formData.data_pagamento || ''}
                  onChange={handleChange}
                  disabled={formData.status !== 'Pago'}
                />
              </div>
            )}
          </div>

          {/* ===== Campos de serie ===== */}
          {formData.tipo !== TIPO_UNICO && (
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="frequencia_rec" className="form-label form-label-sm">
                  Frequencia
                </label>
                <select
                  name="frequencia"
                  id="frequencia_rec"
                  className="form-select form-select-sm"
                  value={formData.frequencia}
                  onChange={handleChange}
                >
                  {FREQUENCIAS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="total_parcelas_rec" className="form-label form-label-sm">
                  {formData.tipo === TIPO_PARCELADO
                    ? 'Numero de parcelas *'
                    : 'Quantas pra frente *'}
                </label>
                <input
                  type="number"
                  name="total_parcelas"
                  id="total_parcelas_rec"
                  className={`form-control form-control-sm ${validationErrors.total_parcelas ? 'is-invalid' : ''}`}
                  value={formData.total_parcelas}
                  onChange={handleChange}
                  min={1}
                  max={120}
                />
                {validationErrors.total_parcelas && (
                  <div className="invalid-feedback d-block">{validationErrors.total_parcelas}</div>
                )}
                {!validationErrors.total_parcelas &&
                  formData.valor &&
                  formData.total_parcelas > 0 && (
                    <small className="text-muted">
                      Total: R${' '}
                      {(
                        parseFloat(formData.valor || 0) * parseInt(formData.total_parcelas, 10)
                      ).toFixed(2)}
                    </small>
                  )}
              </div>
            </div>
          )}

          {/* ===== Status + Forma (so UNICO) ===== */}
          {formData.tipo === TIPO_UNICO && (
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="status_rec" className="form-label form-label-sm">
                  Status *
                </label>
                <select
                  name="status"
                  id="status_rec"
                  className={`form-select form-select-sm ${validationErrors.status ? 'is-invalid' : ''}`}
                  value={formData.status}
                  onChange={handleChange}
                >
                  {STATUS_OPCOES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="forma_pagamento_rec" className="form-label form-label-sm">
                  Forma de Pagamento
                </label>
                <select
                  name="forma_pagamento"
                  id="forma_pagamento_rec"
                  className="form-select form-select-sm"
                  value={formData.forma_pagamento || ''}
                  onChange={handleChange}
                >
                  <option value="">Selecione...</option>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ===== Notas ===== */}
          <div className="mb-3">
            <label htmlFor="notas_rec" className="form-label form-label-sm">
              Notas
            </label>
            <textarea
              name="notas"
              id="notas_rec"
              className="form-control form-control-sm"
              value={formData.notas || ''}
              onChange={handleChange}
              rows="2"
            />
          </div>

          <hr className="my-4" />
          <div className="d-flex justify-content-end">
            {typeof onCancel === 'function' && (
              <button
                type="button"
                className="btn btn-outline-secondary me-2 btn-sm"
                onClick={onCancel}
                disabled={loading}
              >
                Cancelar
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
              )}
              {isEditing
                ? 'Atualizar Recebimento'
                : formData.tipo === TIPO_UNICO
                  ? 'Adicionar Recebimento'
                  : `Gerar ${formData.total_parcelas} parcelas`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RecebimentoForm
