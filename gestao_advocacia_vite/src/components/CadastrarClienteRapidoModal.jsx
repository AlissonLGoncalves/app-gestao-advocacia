/**
 * CadastrarClienteRapidoModal
 * ===========================
 * Modal compacto pra cadastrar um cliente no meio de outro fluxo (criar
 * recebimento, agendar tarefa etc) sem perder o contexto do form pai.
 *
 * Campos minimos: nome_razao_social (obrigatorio), tipo_pessoa (default PF),
 * cpf_cnpj (opcional), email (opcional). O usuario pode complementar dados
 * depois na pagina /clientes.
 *
 * Props:
 *   - open: boolean — controla visibilidade
 *   - onClose: () => void
 *   - onCreated: (cliente) => void — chamado com o cliente criado
 *   - nomeInicial?: string — pre-preencher quando o usuario digitou algo
 */
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { createCliente } from '../api/clientes.js'

const INITIAL = {
  nome_razao_social: '',
  tipo_pessoa: 'PF',
  cpf_cnpj: '',
  email: '',
}

export default function CadastrarClienteRapidoModal({
  open,
  onClose,
  onCreated,
  nomeInicial = '',
}) {
  const [form, setForm] = useState(INITIAL)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState({})

  // Reset/pre-preencher quando abre.
  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL, nome_razao_social: nomeInicial || '' })
      setErros({})
    }
  }, [open, nomeInicial])

  if (!open) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (erros[name]) setErros((prev) => ({ ...prev, [name]: '' }))
  }

  const validar = () => {
    const erro = {}
    if (!form.nome_razao_social.trim()) {
      erro.nome_razao_social = 'Nome obrigatorio.'
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      erro.email = 'E-mail invalido.'
    }
    setErros(erro)
    return Object.keys(erro).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validar()) return
    setSalvando(true)
    try {
      const payload = {
        nome_razao_social: form.nome_razao_social.trim(),
        tipo_pessoa: form.tipo_pessoa,
        cpf_cnpj: form.cpf_cnpj.trim() || null,
        email: form.email.trim() || null,
      }
      const cliente = await createCliente(payload)
      toast.success(`Cliente "${cliente.nome_razao_social}" cadastrado.`)
      onCreated?.(cliente)
      onClose?.()
    } catch (err) {
      // Backend pode rejeitar duplicata de CPF/CNPJ etc.
      toast.error(err?.message || 'Erro ao cadastrar cliente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div
        className="modal show d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadastrarClienteRapidoModalTitle"
        onClick={(e) => {
          // Fechar ao clicar no backdrop (mas nao no conteudo)
          if (e.target === e.currentTarget) onClose?.()
        }}
      >
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-header py-2">
                <h6 className="modal-title" id="cadastrarClienteRapidoModalTitle">
                  <i className="bi bi-person-plus me-2" />
                  Cadastro rapido de cliente
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Fechar"
                  onClick={onClose}
                  disabled={salvando}
                ></button>
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-3">
                  Cadastro com o minimo necessario. Voce pode complementar depois em{' '}
                  <strong>/clientes</strong>.
                </p>

                <div className="mb-2">
                  <label className="form-label form-label-sm" htmlFor="cli_rapid_nome">
                    Nome / Razao Social *
                  </label>
                  <input
                    id="cli_rapid_nome"
                    type="text"
                    name="nome_razao_social"
                    className={`form-control form-control-sm ${erros.nome_razao_social ? 'is-invalid' : ''}`}
                    value={form.nome_razao_social}
                    onChange={handleChange}
                    autoFocus
                    disabled={salvando}
                  />
                  {erros.nome_razao_social && (
                    <div className="invalid-feedback d-block">{erros.nome_razao_social}</div>
                  )}
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-4">
                    <label className="form-label form-label-sm" htmlFor="cli_rapid_tipo">
                      Tipo
                    </label>
                    <select
                      id="cli_rapid_tipo"
                      name="tipo_pessoa"
                      className="form-select form-select-sm"
                      value={form.tipo_pessoa}
                      onChange={handleChange}
                      disabled={salvando}
                    >
                      <option value="PF">PF</option>
                      <option value="PJ">PJ</option>
                    </select>
                  </div>
                  <div className="col-8">
                    <label className="form-label form-label-sm" htmlFor="cli_rapid_cpf">
                      CPF / CNPJ <span className="text-muted">(opcional)</span>
                    </label>
                    <input
                      id="cli_rapid_cpf"
                      type="text"
                      name="cpf_cnpj"
                      className="form-control form-control-sm"
                      value={form.cpf_cnpj}
                      onChange={handleChange}
                      placeholder={
                        form.tipo_pessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'
                      }
                      disabled={salvando}
                    />
                  </div>
                </div>

                <div className="mb-1">
                  <label className="form-label form-label-sm" htmlFor="cli_rapid_email">
                    E-mail <span className="text-muted">(opcional)</span>
                  </label>
                  <input
                    id="cli_rapid_email"
                    type="email"
                    name="email"
                    className={`form-control form-control-sm ${erros.email ? 'is-invalid' : ''}`}
                    value={form.email}
                    onChange={handleChange}
                    disabled={salvando}
                  />
                  {erros.email && <div className="invalid-feedback d-block">{erros.email}</div>}
                </div>
              </div>
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={onClose}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-sm btn-primary" disabled={salvando}>
                  {salvando && (
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                  )}
                  Cadastrar e usar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  )
}
