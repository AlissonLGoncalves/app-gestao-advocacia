// Epic #12 (#186): busca on-demand de processo via CNJ.
// Inspirado no Astrea ('Busca de processo automatica > Pelo numero CNJ').

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BuildingLibraryIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { buscarProcessoOnDemand, createCaso } from '../api/casos.js'
import { createCliente, listClientes } from '../api/clientes.js'

// Converte valor da causa textual ("R$ 1.500,00" ou "1500.00") em número.
function parseValorCausa(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return valor
  const txt = String(valor).replace('R$', '').trim()
  if (!txt) return null
  const normalizado = txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt
  const num = Number(normalizado)
  return Number.isFinite(num) ? num : null
}

const ERRO_LEGIVEL = {
  cnj_invalido: 'Número CNJ inválido. Verifique e tente novamente.',
  tribunal_nao_suportado: 'Este tribunal ainda não é suportado pela busca automática.',
  sem_adapter: 'Sem adapter configurado para este tribunal.',
  tribunal_indisponivel: 'O tribunal está fora do ar. Tente novamente em instantes.',
  tribunal_erro_cliente: 'Tribunal recusou a consulta. Verifique o número.',
  nao_encontrado: 'Processo não encontrado nos registros públicos.',
  adapter_exception: 'Erro inesperado ao consultar o tribunal.',
  missing_cnj: 'Informe o número CNJ.',
}

function BuscarProcessoCnjPage() {
  const navigate = useNavigate()
  const [cnj, setCnj] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resposta, setResposta] = useState(null)

  // Fluxo "Criar caso com estes dados" (modal)
  const [modalCriar, setModalCriar] = useState(false)
  const [papelCliente, setPapelCliente] = useState('autor') // autor | reu
  const [clienteSel, setClienteSel] = useState('novo') // 'novo' | id
  const [tipoNovo, setTipoNovo] = useState('PF')
  const [tituloCaso, setTituloCaso] = useState('')
  const [clientes, setClientes] = useState([])
  const [criando, setCriando] = useState(false)

  const r = resposta?.resultado
  const poloAtivoNome = (r?.polo_ativo || [])[0]?.nome || ''
  const poloPassivoNome = (r?.polo_passivo || [])[0]?.nome || ''
  // Nome do cliente (lado escolhido) e parte contraria (lado oposto)
  const nomeClientePadrao = papelCliente === 'autor' ? poloAtivoNome : poloPassivoNome
  const parteContraria = papelCliente === 'autor' ? poloPassivoNome : poloAtivoNome

  const abrirModalCriar = async () => {
    setTituloCaso(r?.titulo_sugerido || (r?.cnj_normalizado ? `Processo ${r.cnj_normalizado}` : ''))
    // Default: cliente eh o polo ativo (autor) — caso mais comum
    setPapelCliente('autor')
    setClienteSel('novo')
    setTipoNovo('PF')
    setModalCriar(true)
    try {
      const data = await listClientes({ sort_by: 'nome_razao_social', order: 'asc' })
      setClientes(Array.isArray(data) ? data : data?.clientes || [])
    } catch {
      setClientes([])
    }
  }

  const handleCriarCaso = async () => {
    if (!tituloCaso.trim()) {
      toast.warn('Informe um título para o caso.')
      return
    }
    setCriando(true)
    try {
      // 1) resolve cliente: existente ou novo (com o nome do polo escolhido)
      let clienteId = clienteSel
      if (clienteSel === 'novo') {
        if (!nomeClientePadrao.trim()) {
          toast.warn('Não há nome de parte para criar o cliente. Selecione um cliente existente.')
          setCriando(false)
          return
        }
        const novo = await createCliente({
          nome_razao_social: nomeClientePadrao.trim(),
          tipo_pessoa: tipoNovo,
        })
        clienteId = novo.id
      }
      // 2) cria o caso com os dados do tribunal pre-preenchidos
      const caso = await createCaso({
        titulo: tituloCaso.trim(),
        cliente_id: parseInt(clienteId, 10),
        numero_processo: r.cnj_normalizado || cnj.trim(),
        tipo_acao: r.classe_acao || null,
        vara_juizo: r.vara_juizo || null,
        instancia: r.instancia || null,
        data_distribuicao: r.data_distribuicao || null,
        valor_causa: parseValorCausa(r.valor_causa),
        parte_contraria: parteContraria || null,
        status: 'Ativo',
      })
      toast.success('Caso criado com os dados do tribunal!')
      const vinc = caso?.publicacoes_djen_vinculadas || 0
      if (vinc > 0) {
        toast.info(`${vinc} intimação(ões) do DJEN deste processo foram vinculadas ao caso.`, {
          autoClose: 7000,
        })
      }
      setModalCriar(false)
      navigate(`/casos/detalhe/${caso.id}`)
    } catch (err) {
      toast.error(err?.message || 'Falha ao criar o caso.')
    } finally {
      setCriando(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cnj.trim()) {
      toast.warn('Informe o número CNJ.')
      return
    }
    setBuscando(true)
    setResposta(null)
    try {
      const data = await buscarProcessoOnDemand(cnj.trim())
      setResposta(data)
      if (data.resultado?.sucesso) {
        toast.success('Processo encontrado.')
      } else if (data.code) {
        toast.warn(ERRO_LEGIVEL[data.code] || data.message || 'Falha na busca.')
      } else if (data.resultado?.erro_codigo) {
        toast.warn(ERRO_LEGIVEL[data.resultado.erro_codigo] || data.resultado.erro)
      }
    } catch (err) {
      // Erro HTTP — pega body se for JSON estruturado
      const body = err.body || {}
      const msg = ERRO_LEGIVEL[body.code] || err.message || 'Erro inesperado.'
      toast.error(msg)
      setResposta({ erro_request: msg, body })
    } finally {
      setBuscando(false)
    }
  }

  const renderTribunal = () => {
    if (!resposta?.tribunal) return null
    const t = resposta.tribunal
    return (
      <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2">
        <BuildingLibraryIcon style={{ width: 16, height: 16 }} />
        <span>
          Tribunal detectado: <strong>{t.tribunal_nome || t.tribunal_codigo}</strong>
          {t.segmento_nome && <span className="text-muted ms-1">({t.segmento_nome})</span>}
        </span>
      </div>
    )
  }

  const renderResultado = () => {
    if (!resposta?.resultado) return null
    const r = resposta.resultado // eslint-disable-line no-shadow
    if (!r.sucesso) {
      return (
        <div className="alert alert-warning d-flex gap-2 align-items-start">
          <ExclamationTriangleIcon style={{ width: 20, height: 20, flexShrink: 0 }} />
          <div>
            <div className="fw-semibold">{ERRO_LEGIVEL[r.erro_codigo] || 'Falha na busca.'}</div>
            {r.erro && <div className="small text-muted">{r.erro}</div>}
          </div>
        </div>
      )
    }
    return (
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-success-subtle py-2 px-3 d-flex align-items-center gap-2">
          <CheckCircleIcon style={{ width: 16, height: 16 }} className="text-success" />
          <h6 className="mb-0">Processo encontrado</h6>
          {r.fonte && <span className="badge bg-light text-muted">via {r.fonte}</span>}
          {/* So oferece criar quando ainda NAO existe caso com esse numero */}
          {!resposta?.ja_cadastrado && (
            <button
              type="button"
              className="btn btn-sm btn-success ms-auto d-inline-flex align-items-center gap-1"
              onClick={abrirModalCriar}
              data-testid="btn-criar-caso-da-busca"
            >
              <PlusIcon style={{ width: 14, height: 14 }} />
              Criar caso com estes dados
            </button>
          )}
        </div>
        <div className="card-body">
          {r.titulo_sugerido && <h5 className="mb-3">{r.titulo_sugerido}</h5>}
          <dl className="row mb-0 small">
            <dt className="col-sm-3">Número CNJ</dt>
            <dd className="col-sm-9">
              <code>{r.cnj_normalizado}</code>
            </dd>
            {r.classe_acao && (
              <>
                <dt className="col-sm-3">Classe / Ação</dt>
                <dd className="col-sm-9">{r.classe_acao}</dd>
              </>
            )}
            {r.vara_juizo && (
              <>
                <dt className="col-sm-3">Vara / Juízo</dt>
                <dd className="col-sm-9">{r.vara_juizo}</dd>
              </>
            )}
            {r.instancia && (
              <>
                <dt className="col-sm-3">Instância</dt>
                <dd className="col-sm-9">{r.instancia}</dd>
              </>
            )}
            {r.data_distribuicao && (
              <>
                <dt className="col-sm-3">Distribuição</dt>
                <dd className="col-sm-9">{r.data_distribuicao}</dd>
              </>
            )}
            {r.valor_causa && (
              <>
                <dt className="col-sm-3">Valor da causa</dt>
                <dd className="col-sm-9">R$ {r.valor_causa}</dd>
              </>
            )}
          </dl>

          {(r.polo_ativo?.length > 0 || r.polo_passivo?.length > 0) && (
            <div className="row mt-3">
              <div className="col-md-6">
                <h6 className="small text-muted">Polo Ativo</h6>
                <ul className="list-unstyled small">
                  {(r.polo_ativo || []).map((p, idx) => (
                    <li key={idx}>{p.nome}</li>
                  ))}
                </ul>
              </div>
              <div className="col-md-6">
                <h6 className="small text-muted">Polo Passivo</h6>
                <ul className="list-unstyled small">
                  {(r.polo_passivo || []).map((p, idx) => (
                    <li key={idx}>{p.nome}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {r.movimentacoes?.length > 0 && (
            <details className="mt-3">
              <summary className="small text-muted">
                Últimas {r.movimentacoes.length} movimentações
              </summary>
              <ul className="list-unstyled small mt-2 ps-3">
                {r.movimentacoes.map((m, idx) => (
                  <li key={idx} className="mb-1">
                    <span className="text-muted">
                      {m.data_hora ? m.data_hora.slice(0, 10) : ''}
                    </span>{' '}
                    {m.descricao}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    )
  }

  const renderJaCadastrado = () => {
    if (!resposta?.ja_cadastrado) return null
    const j = resposta.ja_cadastrado
    return (
      <div className="alert alert-warning d-flex justify-content-between align-items-center">
        <span>
          Este processo já está cadastrado: <strong>{j.titulo}</strong>
        </span>
        <button
          className="btn btn-sm btn-outline-warning"
          onClick={() => navigate(`/casos/detalhe/${j.caso_id}`)}
        >
          Abrir caso
        </button>
      </div>
    )
  }

  return (
    <div className="container-fluid p-3 p-md-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-1 d-flex align-items-center gap-2">
            <MagnifyingGlassIcon style={{ width: 22, height: 22 }} />
            Buscar processo no tribunal
          </h4>
          <p className="text-muted small mb-0">
            Cole o número CNJ. O sistema detecta o tribunal e busca os dados públicos.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => navigate('/casos')}
        >
          ← Voltar para Casos
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card shadow-sm mb-4">
        <div className="card-body">
          <label htmlFor="cnj-input" className="form-label fw-semibold">
            Número CNJ
          </label>
          <div className="input-group">
            <input
              id="cnj-input"
              type="text"
              className="form-control font-monospace"
              placeholder="0000000-00.0000.0.00.0000 ou 20 dígitos"
              value={cnj}
              onChange={(e) => setCnj(e.target.value)}
              disabled={buscando}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary d-inline-flex align-items-center gap-1"
              disabled={buscando || !cnj.trim()}
            >
              {buscando ? (
                <>
                  <ArrowPathIcon
                    style={{ width: 14, height: 14 }}
                    className="spinner-icon-rotate"
                  />
                  Buscando…
                </>
              ) : (
                <>Buscar</>
              )}
            </button>
          </div>
          <small className="text-muted mt-2 d-block">
            Suporta tribunais estaduais (TJs), TRFs e TRTs via DataJud/CNJ.
          </small>
        </div>
      </form>

      {renderTribunal()}
      {renderJaCadastrado()}
      {renderResultado()}

      {/* Modal: criar caso com os dados do tribunal */}
      {modalCriar && r && (
        <>
          <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <h6 className="modal-title">
                    <PlusIcon style={{ width: 16, height: 16 }} className="me-1" />
                    Criar caso com os dados do tribunal
                  </h6>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    onClick={() => setModalCriar(false)}
                    disabled={criando}
                  />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label form-label-sm">Título do caso</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={tituloCaso}
                      onChange={(e) => setTituloCaso(e.target.value)}
                      disabled={criando}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label form-label-sm d-block">Meu cliente é o:</label>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${papelCliente === 'autor' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => {
                          setPapelCliente('autor')
                          setClienteSel('novo')
                        }}
                        disabled={criando}
                      >
                        Autor {poloAtivoNome && `(${poloAtivoNome})`}
                      </button>
                      <button
                        type="button"
                        className={`btn ${papelCliente === 'reu' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => {
                          setPapelCliente('reu')
                          setClienteSel('novo')
                        }}
                        disabled={criando}
                      >
                        Réu {poloPassivoNome && `(${poloPassivoNome})`}
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label form-label-sm">Cliente</label>
                    <select
                      className="form-select form-select-sm"
                      value={clienteSel}
                      onChange={(e) => setClienteSel(e.target.value)}
                      disabled={criando}
                    >
                      <option value="novo">
                        ➕ Criar novo cliente{nomeClientePadrao ? `: ${nomeClientePadrao}` : ''}
                      </option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome_razao_social}
                        </option>
                      ))}
                    </select>
                    {clienteSel === 'novo' && !nomeClientePadrao && (
                      <small className="text-danger d-block mt-1">
                        O tribunal não retornou o nome do {papelCliente}. Escolha um cliente
                        existente ou troque o polo.
                      </small>
                    )}
                  </div>

                  {clienteSel === 'novo' && nomeClientePadrao && (
                    <div className="mb-2">
                      <label className="form-label form-label-sm">Tipo do novo cliente</label>
                      <select
                        className="form-select form-select-sm"
                        style={{ maxWidth: 120 }}
                        value={tipoNovo}
                        onChange={(e) => setTipoNovo(e.target.value)}
                        disabled={criando}
                      >
                        <option value="PF">PF</option>
                        <option value="PJ">PJ</option>
                      </select>
                    </div>
                  )}

                  <div className="bg-light rounded p-2 small text-muted mt-3">
                    Será criado com: nº <code>{r.cnj_normalizado}</code>
                    {r.classe_acao && <> · {r.classe_acao}</>}
                    {r.vara_juizo && <> · {r.vara_juizo}</>}
                    {parteContraria && (
                      <>
                        {' '}
                        · parte contrária: <strong>{parteContraria}</strong>
                      </>
                    )}
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setModalCriar(false)}
                    disabled={criando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={handleCriarCaso}
                    disabled={criando}
                  >
                    {criando && (
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                    )}
                    Criar caso
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </div>
  )
}

export default BuscarProcessoCnjPage
