// src/pages/ClienteDetalhePage.jsx
// Pagina de detalhe do cliente — drill-down a partir da lista.
// Antes (PR #248-), click no nome do cliente abria a lista GLOBAL de
// casos filtrada por cliente. Agora, abre esta pagina dedicada com
// abas: Dados, Casos, Contratos, Documentos, Hist. Financeiro.
//
// Acesso direto a /casos continua existindo no menu lateral.
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  IdentificationIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api/client.js'
import { getCliente } from '../api/clientes.js'
import { listCasosByCliente } from '../api/casos.js'
import { listDocumentosPorCliente } from '../api/documentos.js'
import { listRecebimentos } from '../api/financeiro.js'

// Contratos ainda nao tem wrapper em src/api/ — chama direto via api client.
// Se virar um modulo proprio, trocar este helper.
const listContratos = () => api.get('/contratos/')

const ABAS = {
  DADOS: 'dados',
  CASOS: 'casos',
  CONTRATOS: 'contratos',
  DOCUMENTOS: 'documentos',
  RECEBIMENTOS: 'recebimentos',
}

const formatBRL = (v) => {
  const num = typeof v === 'number' ? v : parseFloat(v)
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const formatDataBR = (iso) => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

function ClienteDetalhePage() {
  const { clienteId } = useParams()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState(null)
  const [loadingCliente, setLoadingCliente] = useState(true)
  const [erroCliente, setErroCliente] = useState('')
  const [abaAtiva, setAbaAtiva] = useState(ABAS.DADOS)

  // Dados de cada aba (carregadas lazy quando aba abre)
  const [casos, setCasos] = useState(null)
  const [contratos, setContratos] = useState(null)
  const [documentos, setDocumentos] = useState(null)
  const [recebimentos, setRecebimentos] = useState(null)
  const [loadingAba, setLoadingAba] = useState(false)

  const carregarCliente = useCallback(async () => {
    setLoadingCliente(true)
    setErroCliente('')
    try {
      const data = await getCliente(clienteId)
      setCliente(data)
    } catch (err) {
      console.error('ClienteDetalhePage: erro ao carregar cliente', err)
      setErroCliente(err?.message || 'Falha ao carregar cliente.')
    } finally {
      setLoadingCliente(false)
    }
  }, [clienteId])

  useEffect(() => {
    carregarCliente()
  }, [carregarCliente])

  // Lazy load por aba — so puxa quando user abre.
  useEffect(() => {
    if (!cliente) return
    let cancelado = false
    const carregar = async () => {
      setLoadingAba(true)
      try {
        if (abaAtiva === ABAS.CASOS && casos === null) {
          const c = await listCasosByCliente(cliente.id, {
            sort_by: 'data_atualizacao',
            sort_order: 'desc',
          })
          if (!cancelado) setCasos(Array.isArray(c) ? c : c?.casos || [])
        } else if (abaAtiva === ABAS.CONTRATOS && contratos === null) {
          const todos = await listContratos()
          if (!cancelado) {
            const lista = Array.isArray(todos) ? todos : todos?.contratos || []
            setContratos(lista.filter((co) => co.cliente_id === cliente.id))
          }
        } else if (abaAtiva === ABAS.DOCUMENTOS && documentos === null) {
          const docs = await listDocumentosPorCliente(cliente.id)
          if (!cancelado) {
            setDocumentos(Array.isArray(docs) ? docs : docs?.documentos || [])
          }
        } else if (abaAtiva === ABAS.RECEBIMENTOS && recebimentos === null) {
          const todos = await listRecebimentos()
          if (!cancelado) {
            const lista = Array.isArray(todos) ? todos : todos?.recebimentos || []
            setRecebimentos(lista.filter((r) => r.cliente_id === cliente.id))
          }
        }
      } catch (err) {
        console.error('ClienteDetalhePage: erro ao carregar aba', abaAtiva, err)
        if (!cancelado) toast.error(`Falha ao carregar ${abaAtiva}.`)
      } finally {
        if (!cancelado) setLoadingAba(false)
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaAtiva, cliente])

  if (loadingCliente) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando cliente...</span>
        </div>
        <span className="ms-3 text-muted">Carregando dados do cliente...</span>
      </div>
    )
  }

  if (erroCliente || !cliente) {
    return (
      <div className="container-fluid p-4">
        <div className="alert alert-danger">{erroCliente || 'Cliente não encontrado.'}</div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate('/clientes')}
        >
          <ArrowLeftIcon style={{ width: 14, height: 14 }} className="me-1" /> Voltar
        </button>
      </div>
    )
  }

  const tipo = cliente.tipo_pessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'
  const tipoTag = cliente.tipo_pessoa === 'PJ' ? 'PJ' : 'PF'

  return (
    <div className="container-fluid px-md-3 px-lg-4 py-3">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center">
          <button
            type="button"
            className="btn btn-link text-decoration-none me-2 p-0"
            onClick={() => navigate('/clientes')}
            aria-label="Voltar para lista de clientes"
          >
            <ArrowLeftIcon style={{ width: 20, height: 20 }} />
          </button>
          <div>
            <h2 className="h4 mb-0 fw-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              {cliente.nome_razao_social}
            </h2>
            <div className="small text-muted">
              <span className="badge bg-secondary me-2">{tipoTag}</span>
              {tipo} · {cliente.cpf_cnpj || '—'}
            </div>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => navigate(`/clientes/editar/${cliente.id}`)}
          >
            <PencilSquareIcon style={{ width: 14, height: 14 }} className="me-1" />
            Editar dados
          </button>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        {[
          { id: ABAS.DADOS, label: 'Dados', Icone: IdentificationIcon },
          { id: ABAS.CASOS, label: 'Casos', Icone: BriefcaseIcon },
          { id: ABAS.CONTRATOS, label: 'Contratos', Icone: DocumentTextIcon },
          { id: ABAS.DOCUMENTOS, label: 'Documentos', Icone: DocumentTextIcon },
          { id: ABAS.RECEBIMENTOS, label: 'Histórico Financeiro', Icone: CurrencyDollarIcon },
        ].map(({ id, label, Icone }) => (
          <li className="nav-item" key={id}>
            <button
              type="button"
              className={`nav-link ${abaAtiva === id ? 'active' : ''}`}
              onClick={() => setAbaAtiva(id)}
            >
              <Icone style={{ width: 14, height: 14 }} className="me-1 d-inline align-text-bottom" />
              {label}
            </button>
          </li>
        ))}
      </ul>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-3 p-md-4">
          {abaAtiva === ABAS.DADOS && <AbaDados cliente={cliente} />}

          {abaAtiva === ABAS.CASOS && (
            <AbaCasos
              cliente={cliente}
              casos={casos}
              loading={loadingAba}
              onNovoCaso={() => navigate(`/casos/novo?cliente_id=${cliente.id}`)}
              onAbrirCaso={(caso) => navigate(`/casos/detalhe/${caso.id}`)}
            />
          )}

          {abaAtiva === ABAS.CONTRATOS && (
            <AbaContratos
              contratos={contratos}
              loading={loadingAba}
              clienteId={cliente.id}
              onAbrirContrato={() => navigate('/contratos')}
            />
          )}

          {abaAtiva === ABAS.DOCUMENTOS && (
            <AbaDocumentos
              documentos={documentos}
              loading={loadingAba}
              onAbrirDocumentos={() => navigate('/documentos')}
            />
          )}

          {abaAtiva === ABAS.RECEBIMENTOS && (
            <AbaRecebimentos
              recebimentos={recebimentos}
              loading={loadingAba}
              clienteId={cliente.id}
              onNovoRecebimento={() => navigate(`/recebimentos/novo?cliente_id=${cliente.id}`)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ===================== Sub-componentes das abas =====================

function AbaDados({ cliente }) {
  const linhas = [
    ['Tipo de pessoa', cliente.tipo_pessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'],
    ['Nome / Razão Social', cliente.nome_razao_social],
    [cliente.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF', cliente.cpf_cnpj || '—'],
    ['Email', cliente.email || '—'],
    ['Telefone', cliente.telefone || '—'],
    ['Endereço', cliente.endereco || '—'],
    ['Cidade / UF', `${cliente.cidade || '—'} / ${cliente.estado || '—'}`],
    ['Profissão', cliente.profissao || '—'],
    ['Observações', cliente.observacoes || '—'],
  ]
  return (
    <dl className="row g-2 mb-0">
      {linhas.map(([rotulo, valor]) => (
        <React.Fragment key={rotulo}>
          <dt className="col-sm-3 text-secondary small fw-bold">{rotulo}</dt>
          <dd className="col-sm-9 mb-0">{valor}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function AbaCasos({ cliente, casos, loading, onNovoCaso, onAbrirCaso }) {
  if (loading && casos === null) {
    return <Loading texto="Carregando casos..." />
  }
  const lista = casos || []
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="text-muted small">
          {lista.length === 0
            ? 'Este cliente ainda não tem casos.'
            : `${lista.length} caso${lista.length === 1 ? '' : 's'} para ${cliente.nome_razao_social}.`}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onNovoCaso}>
          <PlusIcon style={{ width: 14, height: 14 }} className="me-1" />
          Novo caso para este cliente
        </button>
      </div>
      {lista.length === 0 ? (
        <EmptyState
          texto="Adicione o primeiro caso deste cliente clicando no botão acima."
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Título</th>
                <th>Nº Processo</th>
                <th>Status</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onAbrirCaso(c)}>
                  <td className="fw-medium">{c.titulo}</td>
                  <td className="font-monospace small">{c.numero_processo || '—'}</td>
                  <td>
                    <span className="badge bg-info-subtle text-info-emphasis border">
                      {c.status || '—'}
                    </span>
                  </td>
                  <td className="small text-muted">
                    {formatDataBR(c.data_atualizacao || c.data_criacao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function AbaContratos({ contratos, loading, clienteId, onAbrirContrato }) {
  if (loading && contratos === null) {
    return <Loading texto="Carregando contratos..." />
  }
  const lista = contratos || []
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="text-muted small">
          {lista.length === 0
            ? 'Sem contratos ativos para este cliente.'
            : `${lista.length} contrato${lista.length === 1 ? '' : 's'}.`}
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={onAbrirContrato}
        >
          Ir para Contratos
        </button>
      </div>
      {lista.length === 0 ? (
        <EmptyState texto="Crie um contrato vinculando a este cliente na página de Contratos." />
      ) : (
        <ul className="list-group list-group-flush">
          {lista.map((co) => (
            <li
              key={co.id}
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              <div>
                <div className="fw-medium">{co.tipo_honorario || '—'}</div>
                <div className="small text-muted">
                  Status: {co.status || '—'} · Assinado em{' '}
                  {formatDataBR(co.data_assinatura)}
                </div>
              </div>
              <div className="text-end">
                {co.valor_total && (
                  <div className="fw-bold">{formatBRL(co.valor_total)}</div>
                )}
                {co.percentual_exito && (
                  <div className="small text-muted">{co.percentual_exito}% êxito</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function AbaDocumentos({ documentos, loading, onAbrirDocumentos }) {
  if (loading && documentos === null) {
    return <Loading texto="Carregando documentos..." />
  }
  const lista = documentos || []
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="text-muted small">
          {lista.length === 0
            ? 'Sem documentos vinculados a este cliente.'
            : `${lista.length} documento${lista.length === 1 ? '' : 's'}.`}
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={onAbrirDocumentos}
        >
          Ir para Documentos
        </button>
      </div>
      {lista.length === 0 ? (
        <EmptyState texto="Anexe ou gere documentos vinculados a este cliente." />
      ) : (
        <ul className="list-group list-group-flush">
          {lista.map((d) => (
            <li
              key={d.id}
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              <div>
                <div className="fw-medium">{d.nome_arquivo || d.titulo || '—'}</div>
                <div className="small text-muted">
                  {d.tipo_documento || '—'} ·{' '}
                  {formatDataBR(d.data_upload || d.created_at)}
                </div>
              </div>
              {d.url && (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-secondary btn-sm"
                >
                  Abrir
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function AbaRecebimentos({ recebimentos, loading, onNovoRecebimento }) {
  if (loading && recebimentos === null) {
    return <Loading texto="Carregando recebimentos..." />
  }
  const lista = recebimentos || []
  const totalPago = lista
    .filter((r) => r.status === 'Pago')
    .reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0)
  const totalPendente = lista
    .filter((r) => r.status !== 'Pago' && r.status !== 'Cancelado')
    .reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0)

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="text-muted small">
          {lista.length === 0
            ? 'Sem lançamentos financeiros para este cliente.'
            : `${lista.length} lançamento${lista.length === 1 ? '' : 's'} · pago: ${formatBRL(totalPago)} · pendente: ${formatBRL(totalPendente)}`}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onNovoRecebimento}>
          <PlusIcon style={{ width: 14, height: 14 }} className="me-1" />
          Novo recebimento
        </button>
      </div>
      {lista.length === 0 ? (
        <EmptyState texto="Lance um recebimento vinculando a este cliente." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th className="text-end">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td>{r.descricao}</td>
                  <td className="small text-muted">{formatDataBR(r.data_vencimento)}</td>
                  <td className="small text-muted">{formatDataBR(r.data_pagamento)}</td>
                  <td>
                    <span className="badge bg-light text-dark border">{r.status}</span>
                  </td>
                  <td className="text-end fw-bold">{formatBRL(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Loading({ texto }) {
  return (
    <div className="d-flex justify-content-center align-items-center py-4">
      <div className="spinner-border spinner-border-sm text-primary" role="status">
        <span className="visually-hidden">Carregando...</span>
      </div>
      <span className="ms-2 text-muted small">{texto}</span>
    </div>
  )
}

function EmptyState({ texto }) {
  return (
    <div className="text-center text-muted py-4 fst-italic small bg-light rounded">
      {texto}
    </div>
  )
}

export default ClienteDetalhePage
