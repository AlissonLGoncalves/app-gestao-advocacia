/**
 * TriagemAssistidaPage — Wizard guiado para cadastrar clientes/casos a partir
 * das publicações DJEN pendentes (sem vínculo com cliente).
 *
 * Fluxo (5 etapas):
 *   1. Lista de pendentes (sidebar) — usuário escolhe a próxima a tratar
 *   2. IA analisa a publicação (Gemini) — extrai partes, docs, OABs, dados do caso
 *   3. Usuário escolhe QUAL parte é o cliente dele (cards com Autor/Réu)
 *   4. Form do cliente pré-preenchido — usuário revisa nome, CPF/CNPJ, tipo
 *   5. Form do caso pré-preenchido — usuário revisa numero, vara, valor
 *   6. Confirmar → cria tudo, vincula publicação, avança para próxima
 *
 * Atalhos:
 *   1, 2, 3 ... — escolhe a parte
 *   Enter — avança etapa
 *   Esc   — volta etapa
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { criarClienteCasoTriagem, getAnaliseIA, listTriagem } from '../api/djen.js'

const STEP_LIST = 0
const STEP_ANALYSE = 1
const STEP_PICK_PARTY = 2
const STEP_CLIENT_FORM = 3
const STEP_CASE_FORM = 4
const STEP_DONE = 5

const PROGRESS_LABELS = {
  [STEP_LIST]: 'Selecionar publicação',
  [STEP_ANALYSE]: 'Analisando com IA',
  [STEP_PICK_PARTY]: 'Identificar cliente',
  [STEP_CLIENT_FORM]: 'Revisar dados do cliente',
  [STEP_CASE_FORM]: 'Revisar dados do caso',
  [STEP_DONE]: 'Concluído',
}

function TriagemAssistidaPage() {
  const navigate = useNavigate()

  const [pendentes, setPendentes] = useState([])
  const [pendentesTotal, setPendentesTotal] = useState(0)
  const [pubAtual, setPubAtual] = useState(null)
  const [loadingLista, setLoadingLista] = useState(true)
  const [analise, setAnalise] = useState(null)
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [step, setStep] = useState(STEP_LIST)
  const [parteEscolhida, setParteEscolhida] = useState(null)
  const [clienteForm, setClienteForm] = useState({
    nome_razao_social: '',
    tipo_pessoa: 'PF',
    cpf_cnpj: '',
    email: '',
  })
  const [casoForm, setCasoForm] = useState({
    titulo: '',
    numero_processo: '',
    tipo_acao: '',
    vara_juizo: '',
    comarca: '',
    valor_causa: '',
    parte_contraria: '',
    notas_caso: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [tratadas, setTratadas] = useState(0)

  const carregarPendentes = useCallback(async () => {
    setLoadingLista(true)
    try {
      const data = await listTriagem({ somente_pendentes: true, limit: 100, offset: 0 })
      const items = (data.items || []).map((it) => it.publicacao)
      setPendentes(items)
      setPendentesTotal(data.total || items.length)
    } catch (err) {
      toast.error(err?.message || 'Falha ao carregar pendentes.')
    } finally {
      setLoadingLista(false)
    }
  }, [])

  useEffect(() => {
    carregarPendentes()
  }, [carregarPendentes])

  const iniciarComPub = async (pub) => {
    setPubAtual(pub)
    setAnalise(null)
    setParteEscolhida(null)
    setClienteForm({ nome_razao_social: '', tipo_pessoa: 'PF', cpf_cnpj: '', email: '' })
    setCasoForm({
      titulo: '',
      numero_processo: '',
      tipo_acao: '',
      vara_juizo: '',
      comarca: '',
      valor_causa: '',
      parte_contraria: '',
      notas_caso: '',
    })
    setStep(STEP_ANALYSE)
    setLoadingAnalise(true)
    try {
      const data = await getAnaliseIA(pub.id)
      setAnalise(data)
      const sugerido = data.dados_caso_sugeridos || {}
      setCasoForm((prev) => ({
        ...prev,
        titulo: sugerido.titulo || prev.titulo,
        numero_processo: sugerido.numero_processo || prev.numero_processo,
        tipo_acao: sugerido.tipo_acao || prev.tipo_acao,
        vara_juizo: sugerido.vara_juizo || prev.vara_juizo,
        comarca: sugerido.comarca || prev.comarca,
        valor_causa: sugerido.valor_causa || prev.valor_causa,
        notas_caso: 'Caso criado pela triagem assistida (revisar dados extraídos).',
      }))
      setStep(STEP_PICK_PARTY)
    } catch (err) {
      toast.error(err?.message || 'Falha ao analisar publicação.')
      setStep(STEP_LIST)
    } finally {
      setLoadingAnalise(false)
    }
  }

  const escolherParte = (parte) => {
    setParteEscolhida(parte)
    setClienteForm({
      nome_razao_social: parte.nome,
      tipo_pessoa: parte.tipo_pessoa || 'PF',
      cpf_cnpj: parte.cpf_cnpj_sugerido || '',
      email: '',
    })
    // Define parte contrária no caso (a outra parte do polo oposto)
    const partes = analise?.partes || []
    const oposto = partes.find((p) => p.papel !== parte.papel)
    setCasoForm((prev) => ({
      ...prev,
      parte_contraria: oposto?.nome || prev.parte_contraria,
    }))
    setStep(STEP_CLIENT_FORM)
  }

  const salvar = async () => {
    if (!pubAtual || !parteEscolhida) return
    setSalvando(true)
    try {
      const payload = {
        cliente_id: null,
        cliente_payload: {
          nome_razao_social: clienteForm.nome_razao_social,
          tipo_pessoa: clienteForm.tipo_pessoa,
          cpf_cnpj: clienteForm.cpf_cnpj || null,
          email: clienteForm.email || null,
        },
        papel_cliente: parteEscolhida.papel,
        caso_payload: {
          titulo: casoForm.titulo,
          numero_processo: casoForm.numero_processo || null,
          tipo_acao: casoForm.tipo_acao || null,
          vara_juizo: casoForm.vara_juizo || null,
          comarca: casoForm.comarca || null,
          valor_causa: casoForm.valor_causa || null,
          parte_contraria: casoForm.parte_contraria || null,
          notas_caso: casoForm.notas_caso || null,
        },
      }
      const result = await criarClienteCasoTriagem(pubAtual.id, payload)
      if (result?.mensagem && result?.caso_existente) {
        toast.warning(`Já existe caso com este número: ${result.caso_existente.titulo}`)
        return
      }
      toast.success('Cliente e caso criados, publicação vinculada!')
      setTratadas((n) => n + 1)
      setStep(STEP_DONE)
      // Remove a publicação da lista local e avança para a próxima
      setPendentes((prev) => prev.filter((p) => p.id !== pubAtual.id))
      setPendentesTotal((n) => Math.max(0, n - 1))
    } catch (err) {
      toast.error(err?.message || 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const proximaPublicacao = () => {
    if (pendentes.length > 0) {
      iniciarComPub(pendentes[0])
    } else {
      setStep(STEP_LIST)
      setPubAtual(null)
    }
  }

  const voltar = () => {
    if (step === STEP_PICK_PARTY) {
      setStep(STEP_LIST)
      setPubAtual(null)
    } else if (step === STEP_CLIENT_FORM) {
      setStep(STEP_PICK_PARTY)
      setParteEscolhida(null)
    } else if (step === STEP_CASE_FORM) {
      setStep(STEP_CLIENT_FORM)
    }
  }

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
      if (step === STEP_PICK_PARTY) {
        const partes = analise?.partes || []
        const num = parseInt(e.key, 10)
        if (!isNaN(num) && num >= 1 && num <= partes.length) {
          escolherParte(partes[num - 1])
        }
      }
      if (e.key === 'Escape') voltar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, analise]) // eslint-disable-line react-hooks/exhaustive-deps

  const progressPct = useMemo(() => {
    if (step === STEP_LIST) return 0
    if (step === STEP_ANALYSE) return 20
    if (step === STEP_PICK_PARTY) return 40
    if (step === STEP_CLIENT_FORM) return 60
    if (step === STEP_CASE_FORM) return 80
    return 100
  }, [step])

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1100 }}>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h3 className="mb-0 fw-bold">
            <i className="bi bi-magic me-2 text-primary" />
            Triagem assistida por IA
          </h3>
          <p className="text-muted mb-0 small">
            Wizard guiado para cadastrar clientes e casos a partir das publicações DJEN pendentes.
          </p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/djen')}>
          <i className="bi bi-arrow-left me-1" />
          Voltar para DJEN
        </button>
      </div>

      {/* Barra de progresso */}
      {pubAtual && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small fw-semibold text-muted">{PROGRESS_LABELS[step]}</span>
              <span className="small text-muted">
                {tratadas} tratada(s) · {pendentesTotal} restante(s)
              </span>
            </div>
            <div className="progress" style={{ height: 6 }}>
              <div
                className="progress-bar bg-primary"
                style={{ width: `${progressPct}%`, transition: 'width 0.3s ease' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 0: Lista */}
      {step === STEP_LIST && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <strong>{pendentesTotal} publicação(ões) pendente(s) sem vínculo</strong>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={carregarPendentes}
              disabled={loadingLista}
            >
              <i className="bi bi-arrow-repeat me-1" />
              Atualizar
            </button>
          </div>
          <div className="card-body">
            {loadingLista ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" />
                <p className="mt-3 text-muted small">Carregando pendentes...</p>
              </div>
            ) : pendentes.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3rem' }} />
                <h5 className="mt-3">Nenhuma publicação pendente!</h5>
                <p className="small">Tudo tratado. Volte depois quando chegarem novas.</p>
              </div>
            ) : (
              <>
                <p className="text-muted small mb-3">
                  Clique numa publicação para iniciar o wizard. A IA vai analisar e te perguntar
                  quem é o cliente.
                </p>
                <div className="d-grid gap-2">
                  {pendentes.slice(0, 30).map((pub) => (
                    <button
                      key={pub.id}
                      className="card border-0 shadow-sm text-start"
                      onClick={() => iniciarComPub(pub)}
                      style={{ cursor: 'pointer', background: '#fff' }}
                    >
                      <div className="card-body py-2 px-3">
                        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                          <span className="badge bg-secondary">{pub.sigla_tribunal || '—'}</span>
                          <span className="badge bg-light text-dark border">
                            {pub.tipo_comunicacao || 'Comunicação'}
                          </span>
                          <small className="text-muted ms-auto">{pub.data_disponibilizacao}</small>
                        </div>
                        <div className="fw-semibold small">
                          {pub.numero_processo_mascara || pub.numero_processo || 'Sem CNJ'}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {pub.nome_orgao}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {pendentes.length > 30 && (
                  <p className="text-muted small mt-2 text-center">
                    Mostrando 30 de {pendentes.length}. Trate algumas e atualize a lista.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 1: Análise */}
      {step === STEP_ANALYSE && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div
              className="spinner-border text-primary mb-3"
              style={{ width: '3rem', height: '3rem' }}
              role="status"
            />
            <h5>🤖 IA analisando publicação...</h5>
            <p className="text-muted">
              Extraindo partes, advogados, documentos e dados do processo.
            </p>
          </div>
        </div>
      )}

      {/* STEP 2: Escolher parte */}
      {step === STEP_PICK_PARTY && analise && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white">
            <strong>Quem é o seu cliente nesta publicação?</strong>
            <p className="text-muted small mb-0 mt-1">
              A IA identificou as partes abaixo. Clique em qual delas é o cliente que você
              representa (atalho: tecla numérica).
            </p>
          </div>
          <div className="card-body">
            {(analise.partes || []).length === 0 ? (
              <div className="alert alert-warning">
                A IA não conseguiu identificar partes nesta publicação. Use o fluxo manual.
              </div>
            ) : (
              <div className="row g-2">
                {(analise.partes || []).map((parte, idx) => (
                  <div key={`${parte.nome}-${idx}`} className="col-md-6">
                    <button
                      className="card border-0 shadow-sm w-100 text-start h-100"
                      onClick={() => escolherParte(parte)}
                      style={{ cursor: 'pointer', background: '#fff' }}
                    >
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span
                            className={`badge ${parte.papel === 'autor' ? 'bg-primary' : 'bg-warning text-dark'}`}
                          >
                            {parte.papel === 'autor' ? 'Autor / Polo Ativo' : 'Réu / Polo Passivo'}
                          </span>
                          <kbd className="bg-light text-dark border">{idx + 1}</kbd>
                        </div>
                        <h5 className="mb-2">{parte.nome}</h5>
                        <div className="d-flex gap-2 flex-wrap">
                          <span className="badge bg-light text-dark border">
                            {parte.tipo_pessoa === 'PJ' ? '🏢 PJ' : '👤 PF'}
                          </span>
                          {parte.cpf_cnpj_sugerido && (
                            <span className="badge bg-success-subtle text-success border">
                              <i className="bi bi-check-circle me-1" />
                              {parte.cpf_cnpj_sugerido}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Resumo da publicação */}
            <details className="mt-4">
              <summary className="text-muted small">
                Ver texto da publicação (
                {analise.publicacao?.numero_processo_mascara || analise.publicacao?.numero_processo}
                )
              </summary>
              <div
                className="mt-2 p-3 small bg-light rounded"
                style={{ maxHeight: 200, overflow: 'auto', fontSize: '0.8rem' }}
              >
                {analise.publicacao?.texto?.substring(0, 1500)}
                {(analise.publicacao?.texto?.length || 0) > 1500 && '...'}
              </div>
            </details>
          </div>
          <div className="card-footer bg-white text-end">
            <button className="btn btn-link" onClick={voltar}>
              <i className="bi bi-arrow-left me-1" />
              Escolher outra publicação
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Form Cliente */}
      {step === STEP_CLIENT_FORM && parteEscolhida && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white">
            <strong>Revisar dados do cliente</strong>
            <p className="text-muted small mb-0 mt-1">
              Dados pré-preenchidos pela IA. Ajuste o que precisar e avance.
            </p>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-8">
                <label className="form-label small fw-semibold">
                  Nome / Razão social <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={clienteForm.nome_razao_social}
                  onChange={(e) =>
                    setClienteForm({ ...clienteForm, nome_razao_social: e.target.value })
                  }
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Tipo</label>
                <select
                  className="form-select"
                  value={clienteForm.tipo_pessoa}
                  onChange={(e) => setClienteForm({ ...clienteForm, tipo_pessoa: e.target.value })}
                >
                  <option value="PF">Pessoa Física</option>
                  <option value="PJ">Pessoa Jurídica</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">
                  {clienteForm.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={clienteForm.cpf_cnpj}
                  onChange={(e) => setClienteForm({ ...clienteForm, cpf_cnpj: e.target.value })}
                  placeholder="(opcional — pode preencher depois)"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">E-mail</label>
                <input
                  type="email"
                  className="form-control"
                  value={clienteForm.email}
                  onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                  placeholder="(opcional)"
                />
              </div>
            </div>
          </div>
          <div className="card-footer bg-white d-flex justify-content-between">
            <button className="btn btn-outline-secondary" onClick={voltar}>
              <i className="bi bi-arrow-left me-1" />
              Voltar
            </button>
            <button
              className="btn btn-primary"
              disabled={!clienteForm.nome_razao_social.trim()}
              onClick={() => setStep(STEP_CASE_FORM)}
            >
              Avançar para o caso
              <i className="bi bi-arrow-right ms-1" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Form Caso */}
      {step === STEP_CASE_FORM && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white">
            <strong>Revisar dados do caso</strong>
            <p className="text-muted small mb-0 mt-1">
              Dados extraídos da publicação. Ajuste e confirme para criar tudo.
            </p>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label small fw-semibold">
                  Título do caso <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={casoForm.titulo}
                  onChange={(e) => setCasoForm({ ...casoForm, titulo: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Número do processo (CNJ)</label>
                <input
                  type="text"
                  className="form-control font-monospace"
                  value={casoForm.numero_processo}
                  onChange={(e) => setCasoForm({ ...casoForm, numero_processo: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Tipo de ação</label>
                <input
                  type="text"
                  className="form-control"
                  value={casoForm.tipo_acao}
                  onChange={(e) => setCasoForm({ ...casoForm, tipo_acao: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Vara / Juízo</label>
                <input
                  type="text"
                  className="form-control"
                  value={casoForm.vara_juizo}
                  onChange={(e) => setCasoForm({ ...casoForm, vara_juizo: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Comarca</label>
                <input
                  type="text"
                  className="form-control"
                  value={casoForm.comarca}
                  onChange={(e) => setCasoForm({ ...casoForm, comarca: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Parte contrária</label>
                <input
                  type="text"
                  className="form-control"
                  value={casoForm.parte_contraria}
                  onChange={(e) => setCasoForm({ ...casoForm, parte_contraria: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Valor da causa</label>
                <input
                  type="text"
                  className="form-control"
                  value={casoForm.valor_causa}
                  onChange={(e) => setCasoForm({ ...casoForm, valor_causa: e.target.value })}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="col-md-12">
                <label className="form-label small fw-semibold">Notas</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={casoForm.notas_caso}
                  onChange={(e) => setCasoForm({ ...casoForm, notas_caso: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="card-footer bg-white d-flex justify-content-between">
            <button className="btn btn-outline-secondary" onClick={voltar}>
              <i className="bi bi-arrow-left me-1" />
              Voltar
            </button>
            <button
              className="btn btn-success"
              disabled={salvando || !casoForm.titulo.trim()}
              onClick={salvar}
            >
              {salvando ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" />
                  Salvando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-1" />
                  Criar cliente, caso e vincular
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Done */}
      {step === STEP_DONE && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }} />
            <h4 className="mt-3">Pronto!</h4>
            <p className="text-muted">Cliente e caso criados, publicação vinculada com sucesso.</p>
            <div className="d-flex gap-2 justify-content-center flex-wrap mt-4">
              <button
                className="btn btn-primary"
                onClick={proximaPublicacao}
                disabled={pendentes.length === 0}
              >
                {pendentes.length > 0 ? (
                  <>
                    Próxima publicação ({pendentes.length} restantes)
                    <i className="bi bi-arrow-right ms-1" />
                  </>
                ) : (
                  'Todas tratadas!'
                )}
              </button>
              <button className="btn btn-outline-secondary" onClick={() => navigate('/djen')}>
                Voltar para DJEN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TriagemAssistidaPage
