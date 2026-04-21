import React, { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config.js'
import { toast } from 'react-toastify'
import { useConfirm } from '../hooks/useConfirm.jsx'
import {
  DocumentCurrencyDollarIcon,
  PlusIcon,
  CalculatorIcon,
  TrashIcon,
} from '@heroicons/react/24/outline' // Ajustado o ícone CurrencyDollarIcon no HeroIcons V2 é apenas CurrencyDollarIcon mas deixei Document pro arquivo

function HonorariosCasoCard({ casoId, clienteId }) {
  const { confirm, ConfirmDialog } = useConfirm()
  const [contratos, setContratos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedContrato, setSelectedContrato] = useState(null)
  const [qtdParcelas, setQtdParcelas] = useState(1)
  const [dataVencimento, setDataVencimento] = useState('')

  const [form, setForm] = useState({
    tipo_honorario: 'Fixo',
    valor_total: '',
    percentual_exito: '',
    data_assinatura: '',
    notas_condicoes: '',
  })

  const carregarContratos = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return

    setIsLoading(true)
    try {
      const res = await fetch(`${API_URL}/contratos/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        // Filtra os contratos específicos deste caso
        const filtro = data.filter((c) => c.caso_id === parseInt(casoId))
        setContratos(filtro)
      }
    } catch (err) {
      console.error('Erro carregando contratos:', err)
      toast.error('Erro ao carregar contratos de honorários.')
    } finally {
      setIsLoading(false)
    }
  }, [casoId])

  useEffect(() => {
    carregarContratos()
  }, [carregarContratos])

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    const token = localStorage.getItem('token')
    try {
      const body = {
        ...form,
        caso_id: parseInt(casoId),
        cliente_id: parseInt(clienteId),
      }

      const res = await fetch(`${API_URL}/contratos/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success('Contrato de honorários criado com sucesso!')
        setIsCreating(false)
        carregarContratos()
      } else {
        const errData = await res.json()
        toast.error(errData.message || 'Falha ao criar o contrato.')
      }
    } catch (error) {
      console.error('Erro criar contrato:', error)
      toast.error('Erro de comunicação com o servidor.')
    }
  }

  const handleGerarParcelas = async (contratoId) => {
    if (!dataVencimento || qtdParcelas < 1) {
      toast.warn('Selecione a quantidade de parcelas e a data do 1º vencimento.')
      return
    }

    const token = localStorage.getItem('token')
    setIsGenerating(true)
    try {
      const res = await fetch(`${API_URL}/contratos/${contratoId}/gerar-parcelas`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantidade_parcelas: qtdParcelas,
          primeiro_vencimento: dataVencimento,
        }),
      })

      if (res.ok) {
        toast.success('Parcelas geradas nos Recebimentos com sucesso!')
        setSelectedContrato(null)
      } else {
        const errData = await res.json()
        toast.error(errData.message || 'Erro ao gerar parcelas financeiras.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Falha no servidor.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = async (contratoId) => {
    const ok = await confirm(
      'Certeza que deseja deletar este contrato? As parcelas baseadas nele nas Despesas permanecerão intactas.',
      'Excluir contrato'
    )
    if (!ok) return
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_URL}/contratos/${contratoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Contrato removido.')
        carregarContratos()
      }
    } catch (err) {
      toast.error('Erro ao deletar.')
    }
  }

  if (isLoading) return <p className="text-muted p-3">Carregando honorários...</p>

  return (
    <div className="card shadow-lg mb-4 border-0 rounded-lg">
      {ConfirmDialog}
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
        <h5 className="card-title mb-0 text-primary fw-bold">Gestão de Honorários</h5>
        <button className="btn btn-sm btn-primary" onClick={() => setIsCreating(!isCreating)}>
          <PlusIcon style={{ width: '16px', height: '16px' }} className="me-1 mb-1 d-inline" />
          Novo Contrato
        </button>
      </div>

      <div className="card-body bg-light">
        {isCreating && (
          <div className="bg-white p-3 border rounded mb-3 shadow-sm">
            <h6 className="border-bottom pb-2">Cadastrar Novo Contrato</h6>
            <form onSubmit={handleCreateSubmit}>
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label small">Tipo</label>
                  <select
                    className="form-select form-select-sm"
                    required
                    value={form.tipo_honorario}
                    onChange={(e) => setForm({ ...form, tipo_honorario: e.target.value })}
                  >
                    <option value="Fixo">Fixo</option>
                    <option value="Êxito">Ad Exitum (Êxito)</option>
                    <option value="Mensal">Partido / Mensal</option>
                    <option value="Horas">Relógio (Horas)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-select-sm"
                    value={form.valor_total}
                    onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
                    placeholder="0.00"
                    disabled={form.tipo_honorario === 'Êxito'}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Percentual Êxito (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-select-sm"
                    value={form.percentual_exito}
                    onChange={(e) => setForm({ ...form, percentual_exito: e.target.value })}
                    placeholder="Ex: 20%"
                    disabled={form.tipo_honorario === 'Fixo'}
                  />
                </div>
                <div className="col-md-6 mt-2">
                  <label className="form-label small">Data de Assinatura</label>
                  <input
                    type="date"
                    className="form-control form-select-sm"
                    value={form.data_assinatura}
                    onChange={(e) => setForm({ ...form, data_assinatura: e.target.value })}
                  />
                </div>
                <div className="col-md-6 mt-2">
                  <label className="form-label small">Condições</label>
                  <textarea
                    className="form-control form-select-sm"
                    rows="1"
                    value={form.notas_condicoes}
                    onChange={(e) => setForm({ ...form, notas_condicoes: e.target.value })}
                  ></textarea>
                </div>
              </div>
              <div className="mt-3 text-end">
                <button
                  type="button"
                  className="btn btn-sm btn-light me-2"
                  onClick={() => setIsCreating(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-sm btn-success">
                  Salvar Contrato
                </button>
              </div>
            </form>
          </div>
        )}

        {contratos.length === 0 && !isCreating ? (
          <p className="text-muted text-center py-4 mb-0 fst-italic">
            Nenhum contrato de honorário atrelado a este processo.
          </p>
        ) : (
          <div className="row g-3">
            {contratos.map((c) => (
              <div className="col-md-12" key={c.id}>
                <div className="bg-white p-3 rounded border border-start-0 border-end-0 border-bottom-0 border-primary border-4 shadow-sm relative">
                  <div className="d-flex justify-content-between">
                    <div>
                      <span className="badge bg-primary mb-2">{c.tipo_honorario}</span>
                      {c.status === 'Inadimplente' && (
                        <span className="badge bg-danger ms-2 mb-2">Inadimplente</span>
                      )}
                      <p className="mb-1 text-dark">
                        <strong>Contrato #{c.id}</strong>
                      </p>
                      <p className="small text-muted mb-0">
                        Total: {c.valor_total ? `R$ ${c.valor_total}` : 'N/D'} | Êxito:{' '}
                        {c.percentual_exito ? `${c.percentual_exito}%` : 'N/D'}
                      </p>
                    </div>
                    <div className="text-end">
                      <button
                        onClick={() => setSelectedContrato(selectedContrato === c.id ? null : c.id)}
                        className="btn btn-sm btn-outline-success me-2"
                        title="Gerar Boletos / Parcelas na aba de Recebimentos"
                      >
                        <CalculatorIcon style={{ width: '15px' }} className="d-inline mb-1" /> Gerar
                        Parcelas
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="btn btn-sm btn-outline-danger"
                        title="Excluir Contrato"
                      >
                        <TrashIcon style={{ width: '15px' }} className="d-inline" />
                      </button>
                    </div>
                  </div>

                  {selectedContrato === c.id && (
                    <div className="mt-3 p-3 bg-light rounded border border-success">
                      <h6 className="text-success mb-3">
                        <CalculatorIcon style={{ width: '18px' }} className="me-1 d-inline" />
                        Gerar Parcelamento Financeiro
                      </h6>
                      <p className="small text-muted mb-3 form-text mt-0 pt-0">
                        Este assistente vai dividir automaticamente o valor de{' '}
                        <b>R$ {c.valor_total}</b> do respectivo contrato e injetá-las no módulo
                        global de <strong className="text-dark">Recebimentos</strong> do sistema.
                      </p>
                      <div className="row g-2">
                        <div className="col-sm-4">
                          <label className="form-label small fw-bold">Número de Parcelas</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min="1"
                            value={qtdParcelas}
                            onChange={(e) => setQtdParcelas(e.target.value)}
                          />
                        </div>
                        <div className="col-sm-4">
                          <label className="form-label small fw-bold">Data 1º Vencimento</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={dataVencimento}
                            onChange={(e) => setDataVencimento(e.target.value)}
                          />
                        </div>
                        <div className="col-sm-4 d-flex align-items-end">
                          <button
                            onClick={() => handleGerarParcelas(c.id)}
                            disabled={isGenerating}
                            className="btn btn-sm btn-success w-100 fw-bold"
                          >
                            {isGenerating ? 'Aguarde...' : 'Criar Títulos Agora'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HonorariosCasoCard
