/**
 * TriagemAssistidaPage — Wizard guiado para cadastrar clientes/casos a partir
 * das publicações DJEN pendentes (sem vínculo com cliente).
 *
 * Fluxo (com agrupamento):
 *   1. Lista de GRUPOS — pubs agrupadas por mesmo processo, mesmo cliente
 *      cadastrado, mesmo nome novo, ou isoladas.
 *   2. Click num grupo:
 *      - Se 'cliente_existente' → confirmação simples (vincula tudo direto)
 *      - Se 'mesmo_processo' / 'mesmo_nome_novo' / 'isolada' → wizard:
 *        2a. IA analisa a primeira pub do grupo
 *        2b. Usuário escolhe parte (cliente)
 *        2c. Form cliente (pré-preenchido)
 *        2d. Form caso (pré-preenchido)
 *        2e. Confirma → cria cliente + caso + vincula TODAS as pubs do grupo
 *
 * Atalhos:
 *   1, 2, 3 ... — escolhe a parte na etapa de seleção
 *   Esc       — volta etapa
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'

import {
  getAnaliseIA,
  listCasosCompativeis,
  listGruposPendentes,
  vincularEmLote,
} from '../api/djen.js'

const STEP_LIST = 0
const STEP_CONFIRM_EXISTING = 1
const STEP_ANALYSE = 2
const STEP_PICK_PARTY = 3
const STEP_CLIENT_FORM = 4
const STEP_CASE_FORM = 5
const STEP_DONE = 6

const PROGRESS_LABELS = {
  [STEP_LIST]: 'Selecionar grupo',
  [STEP_CONFIRM_EXISTING]: 'Confirmar vínculo',
  [STEP_ANALYSE]: 'Analisando com IA',
  [STEP_PICK_PARTY]: 'Identificar cliente',
  [STEP_CLIENT_FORM]: 'Revisar dados do cliente',
  [STEP_CASE_FORM]: 'Revisar dados do caso',
  [STEP_DONE]: 'Concluído',
}

const TIPO_LABELS = {
  mesmo_processo: { label: 'Mesmo processo', cor: 'primary', icone: 'bi-folder' },
  cliente_existente: {
    label: 'Cliente já cadastrado',
    cor: 'success',
    icone: 'bi-person-check',
  },
  mesmo_nome_novo: {
    label: 'Mesmo nome (cliente novo)',
    cor: 'warning',
    icone: 'bi-people',
  },
  isolada: { label: 'Publicação isolada', cor: 'secondary', icone: 'bi-file-earmark' },
}

function TriagemAssistidaPage() {
  const navigate = useNavigate()

  const [grupos, setGrupos] = useState([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [grupoAtual, setGrupoAtual] = useState(null)
  const [analise, setAnalise] = useState(null)
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
  // Casos compativeis pra reuso (em vez de criar novo)
  const [casosCompativeis, setCasosCompativeis] = useState([])
  const [casoEscolhidoId, setCasoEscolhidoId] = useState(null) // null = criar novo

  const carregarGrupos = useCallback(async () => {
    setLoadingLista(true)
    try {
      const data = await listGruposPendentes()
      setGrupos(data.grupos || [])
    } catch (err) {
      toast.error(err?.message || 'Falha ao carregar grupos.')
    } finally {
      setLoadingLista(false)
    }
  }, [])

  useEffect(() => {
    carregarGrupos()
  }, [carregarGrupos])

  const totalPendentes = useMemo(() => grupos.reduce((acc, g) => acc + (g.count || 0), 0), [grupos])

  const iniciarComGrupo = async (grupo) => {
    setGrupoAtual(grupo)
    setAnalise(null)
    setParteEscolhida(null)
    setClienteForm({
      nome_razao_social: grupo.cliente_existente_nome || grupo.titulo || '',
      tipo_pessoa: 'PF',
      cpf_cnpj: '',
      email: '',
    })
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

    if (grupo.tipo === 'cliente_existente') {
      // Pula direto para confirmação
      setStep(STEP_CONFIRM_EXISTING)
      // Mas ainda roda análise da primeira pub pra preencher dados do caso
      try {
        const data = await getAnaliseIA(grupo.pub_ids[0])
        setAnalise(data)
        const sugerido = data.dados_caso_sugeridos || {}
        setCasoForm((prev) => ({
          ...prev,
          titulo: sugerido.titulo || `Processo de ${grupo.cliente_existente_nome}`,
          numero_processo: sugerido.numero_processo || '',
          tipo_acao: sugerido.tipo_acao || '',
          vara_juizo: sugerido.vara_juizo || '',
          comarca: sugerido.comarca || '',
          valor_causa: sugerido.valor_causa || '',
          notas_caso: `Caso criado via triagem em lote (${grupo.count} publicações vinculadas).`,
        }))
      } catch {
        // Se falhar análise, deixa form vazio — usuário preenche
      }
      return
    }

    setStep(STEP_ANALYSE)
    try {
      const data = await getAnaliseIA(grupo.pub_ids[0])
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
        notas_caso: `Caso criado via triagem assistida (${grupo.count} publicação(ões) vinculadas).`,
      }))
      setStep(STEP_PICK_PARTY)
    } catch (err) {
      toast.error(err?.message || 'Falha ao analisar publicação.')
      setStep(STEP_LIST)
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
    const partes = analise?.partes || []
    const oposto = partes.find((p) => p.papel !== parte.papel)
    setCasoForm((prev) => ({
      ...prev,
      parte_contraria: oposto?.nome || prev.parte_contraria,
    }))
    setStep(STEP_CLIENT_FORM)
  }

  // Busca casos compativeis ao entrar no step CASE_FORM (ou CONFIRM_EXISTING)
  // pra oferecer reuso em vez de criar duplicata.
  const carregarCasosCompativeis = useCallback(async ({ numero_processo, cliente_id }) => {
    try {
      const data = await listCasosCompativeis({ numero_processo, cliente_id })
      setCasosCompativeis(data.casos || [])
    } catch {
      setCasosCompativeis([])
    }
  }, [])

  useEffect(() => {
    if (step !== STEP_CASE_FORM && step !== STEP_CONFIRM_EXISTING) {
      setCasosCompativeis([])
      setCasoEscolhidoId(null)
      return
    }
    const numero = casoForm.numero_processo
    const clienteId = grupoAtual?.cliente_existente_id || null
    if (!numero && !clienteId) {
      setCasosCompativeis([])
      return
    }
    carregarCasosCompativeis({
      numero_processo: numero,
      cliente_id: clienteId,
    })
  }, [step, casoForm.numero_processo, grupoAtual, carregarCasosCompativeis])

  const salvarLote = async ({ usarClienteExistente }) => {
    if (!grupoAtual) return
    setSalvando(true)
    try {
      const payload = {
        pub_ids: grupoAtual.pub_ids,
        papel_cliente: parteEscolhida?.papel || 'autor',
      }
      // Se usuario escolheu reusar caso existente, manda caso_id (backend pula
      // a criacao). Caso contrario, manda caso_payload pra criar novo.
      if (casoEscolhidoId) {
        payload.caso_id = casoEscolhidoId
      } else {
        payload.caso_payload = {
          titulo: casoForm.titulo,
          numero_processo: casoForm.numero_processo || null,
          tipo_acao: casoForm.tipo_acao || null,
          vara_juizo: casoForm.vara_juizo || null,
          comarca: casoForm.comarca || null,
          valor_causa: casoForm.valor_causa || null,
          parte_contraria: casoForm.parte_contraria || null,
          notas_caso: casoForm.notas_caso || null,
        }
      }
      if (usarClienteExistente && grupoAtual.cliente_existente_id) {
        payload.cliente_id = grupoAtual.cliente_existente_id
      } else {
        payload.cliente_payload = {
          nome_razao_social: clienteForm.nome_razao_social,
          tipo_pessoa: clienteForm.tipo_pessoa,
          cpf_cnpj: clienteForm.cpf_cnpj || null,
          email: clienteForm.email || null,
        }
      }
      const result = await vincularEmLote(payload)
      toast.success(
        `${result.vinculadas} publicação(ões) vinculadas! ` +
          (result.cliente_criado ? 'Cliente criado. ' : 'Cliente reutilizado. ') +
          (result.caso_criado ? 'Caso criado.' : 'Caso reutilizado.')
      )
      setTratadas((n) => n + result.vinculadas)
      setStep(STEP_DONE)
      // Remove grupo da lista local
      setGrupos((prev) => prev.filter((g) => g.id !== grupoAtual.id))
    } catch (err) {
      toast.error(err?.message || 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const proximoGrupo = () => {
    if (grupos.length > 0) {
      iniciarComGrupo(grupos[0])
    } else {
      setStep(STEP_LIST)
      setGrupoAtual(null)
    }
  }

  const voltar = () => {
    if (step === STEP_CONFIRM_EXISTING || step === STEP_PICK_PARTY) {
      setStep(STEP_LIST)
      setGrupoAtual(null)
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
    if (step === STEP_CONFIRM_EXISTING) return 50
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
            Wizard guiado por grupos. Cadastre uma vez e vincule várias publicações de uma vez.
          </p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/djen')}>
          <i className="bi bi-arrow-left me-1" />
          Voltar para DJEN
        </button>
      </div>

      {/* Barra de progresso */}
      {grupoAtual && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small fw-semibold text-muted">{PROGRESS_LABELS[step]}</span>
              <span className="small text-muted">
                {tratadas} pub. tratadas · {totalPendentes} restantes em {grupos.length} grupo(s)
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

      {/* STEP 0: Lista de grupos */}
      {step === STEP_LIST && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <strong>
              {totalPendentes} publicação(ões) em {grupos.length} grupo(s)
            </strong>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={carregarGrupos}
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
                <p className="mt-3 text-muted small">
                  Agrupando pendentes (pode levar alguns segundos)...
                </p>
              </div>
            ) : grupos.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3rem' }} />
                <h5 className="mt-3">Nenhuma publicação pendente!</h5>
                <p className="small">Tudo tratado. Volte depois quando chegarem novas.</p>
              </div>
            ) : (
              <>
                <p className="text-muted small mb-3">
                  Clique num grupo para tratá-lo. <strong>Cliente já cadastrado</strong> vincula
                  tudo de uma vez. Os demais grupos abrem o wizard guiado.
                </p>
                <div className="d-grid gap-2">
                  {grupos.map((grupo) => {
                    const meta = TIPO_LABELS[grupo.tipo] || TIPO_LABELS.isolada
                    return (
                      <button
                        key={grupo.id}
                        className="card border-0 shadow-sm text-start"
                        onClick={() => iniciarComGrupo(grupo)}
                        style={{ cursor: 'pointer', background: '#fff' }}
                      >
                        <div className="card-body py-3 px-3">
                          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <span className={`badge bg-${meta.cor}`}>
                              <i className={`bi ${meta.icone} me-1`} />
                              {meta.label}
                            </span>
                            <span className="badge bg-light text-dark border">
                              {grupo.count} publicação(ões)
                            </span>
                            {grupo.cliente_existente_id && (
                              <span className="badge bg-success-subtle text-success border">
                                <i className="bi bi-check-circle me-1" />
                                Cliente cadastrado
                              </span>
                            )}
                          </div>
                          <h6 className="mb-1">{grupo.titulo}</h6>
                          <div className="text-muted small">{grupo.descricao}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 1 (cliente_existente): Confirmação */}
      {step === STEP_CONFIRM_EXISTING && grupoAtual && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white">
            <strong>
              <i className="bi bi-person-check text-success me-2" />
              Vincular ao cliente existente
            </strong>
          </div>
          <div className="card-body">
            <div className="alert alert-success">
              <strong>{grupoAtual.cliente_existente_nome}</strong> já está cadastrado. Vamos criar 1
              caso novo (ou reutilizar caso existente com mesmo CNJ) e vincular as{' '}
              <strong>{grupoAtual.count} publicação(ões)</strong> a ele.
            </div>

            <h6 className="mt-3">Dados do caso a criar:</h6>
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
                <label className="form-label small fw-semibold">CNJ</label>
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
                <label className="form-label small fw-semibold">Parte contrária</label>
                <input
                  type="text"
                  className="form-control"
                  value={casoForm.parte_contraria}
                  onChange={(e) => setCasoForm({ ...casoForm, parte_contraria: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="card-footer bg-white d-flex justify-content-between">
            <button className="btn btn-outline-secondary" onClick={voltar}>
              Cancelar
            </button>
            <button
              className="btn btn-success"
              disabled={salvando || !casoForm.titulo.trim()}
              onClick={() => salvarLote({ usarClienteExistente: true })}
            >
              {salvando ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" />
                  Vinculando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-1" />
                  Vincular {grupoAtual.count} publicação(ões)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Analyse */}
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

      {/* STEP 3: Pick party */}
      {step === STEP_PICK_PARTY && analise && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white">
            <strong>Quem é o seu cliente neste grupo?</strong>
            <p className="text-muted small mb-0 mt-1">
              {grupoAtual?.count} publicação(ões) serão vinculadas ao cliente que você escolher.
              Atalho: tecla numérica.
            </p>
          </div>
          <div className="card-body">
            {(analise.partes || []).length === 0 ? (
              <div className="alert alert-warning">
                A IA não identificou partes nesta publicação. Volte e use o fluxo manual.
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
                          {parte.oabs?.length > 0 && (
                            <span
                              className="badge bg-info-subtle text-info border"
                              title="OAB(s) do(s) advogado(s) desta parte"
                            >
                              <i className="bi bi-person-badge me-1" />
                              {parte.oabs.join(', ')}
                            </span>
                          )}
                        </div>
                        {parte.advogados?.length > 0 && (
                          <div className="mt-2 small text-muted">
                            <i className="bi bi-briefcase me-1" />
                            Advogado(s): {parte.advogados.join(', ')}
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card-footer bg-white text-end">
            <button className="btn btn-link" onClick={voltar}>
              <i className="bi bi-arrow-left me-1" />
              Voltar para grupos
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Form Cliente */}
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
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">E-mail</label>
                <input
                  type="email"
                  className="form-control"
                  value={clienteForm.email}
                  onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
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

      {/* STEP 5: Form Caso */}
      {step === STEP_CASE_FORM && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white">
            <strong>Revisar dados do caso</strong>
            <p className="text-muted small mb-0 mt-1">
              {casoEscolhidoId
                ? `Vincular as ${grupoAtual?.count} publicação(ões) ao caso existente abaixo.`
                : `Vamos criar 1 caso e vincular as ${grupoAtual?.count} publicação(ões) do grupo.`}
            </p>
          </div>
          <div className="card-body">
            {/* Casos compativeis (reuso) */}
            {casosCompativeis.length > 0 && (
              <div className="alert alert-info border mb-3">
                <strong className="d-block mb-2">
                  <i className="bi bi-folder-check me-1" />
                  {casosCompativeis.length} caso(s) compatível(eis) já existe(m)
                </strong>
                <p className="small text-muted mb-2">
                  Selecione um pra vincular as publicações sem criar novo, ou mantenha "Criar caso
                  novo" abaixo.
                </p>
                <div className="d-grid gap-2">
                  {casosCompativeis.map((c) => (
                    <label
                      key={c.id}
                      className="card border-0 shadow-sm p-2"
                      style={{
                        cursor: 'pointer',
                        background: casoEscolhidoId === c.id ? '#e3f2fd' : '#fff',
                        border:
                          casoEscolhidoId === c.id
                            ? '2px solid var(--primary)'
                            : '1px solid #e0e0e0',
                      }}
                    >
                      <div className="d-flex align-items-start gap-2">
                        <input
                          type="radio"
                          name="caso_compativel"
                          checked={casoEscolhidoId === c.id}
                          onChange={() => setCasoEscolhidoId(c.id)}
                          className="mt-1"
                        />
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                            <span className="badge bg-success">{c.motivo}</span>
                            <span className="badge bg-light text-dark border">
                              {c.status || '—'}
                            </span>
                            {c.numero_processo && (
                              <span className="small font-monospace text-muted">
                                {c.numero_processo}
                              </span>
                            )}
                          </div>
                          <div className="fw-semibold small">{c.titulo}</div>
                          {(c.cliente_nome || c.vara_juizo) && (
                            <div className="small text-muted">
                              {c.cliente_nome && <>👤 {c.cliente_nome}</>}
                              {c.cliente_nome && c.vara_juizo && ' · '}
                              {c.vara_juizo && <>⚖ {c.vara_juizo}</>}
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                  <label
                    className="card border-0 shadow-sm p-2"
                    style={{
                      cursor: 'pointer',
                      background: !casoEscolhidoId ? '#fff3e0' : '#fff',
                      border: !casoEscolhidoId
                        ? '2px solid var(--warning)'
                        : '1px solid #e0e0e0',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="radio"
                        name="caso_compativel"
                        checked={!casoEscolhidoId}
                        onChange={() => setCasoEscolhidoId(null)}
                      />
                      <div>
                        <span className="fw-semibold">
                          <i className="bi bi-plus-circle me-1" />
                          Criar caso novo
                        </span>
                        <div className="small text-muted">
                          Use o formulário abaixo. Será criado um novo Caso com esses dados.
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div
              className="row g-3"
              style={{
                opacity: casoEscolhidoId ? 0.4 : 1,
                pointerEvents: casoEscolhidoId ? 'none' : 'auto',
              }}
            >
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
            </div>
          </div>
          <div className="card-footer bg-white d-flex justify-content-between">
            <button className="btn btn-outline-secondary" onClick={voltar}>
              <i className="bi bi-arrow-left me-1" />
              Voltar
            </button>
            <button
              className="btn btn-success"
              disabled={salvando || (!casoEscolhidoId && !casoForm.titulo.trim())}
              onClick={() => salvarLote({ usarClienteExistente: false })}
            >
              {salvando ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" />
                  Salvando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-1" />
                  {casoEscolhidoId
                    ? `Vincular ${grupoAtual?.count} publicação(ões) ao caso existente`
                    : `Criar e vincular ${grupoAtual?.count} publicação(ões)`}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Done */}
      {step === STEP_DONE && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }} />
            <h4 className="mt-3">Pronto!</h4>
            <p className="text-muted">Grupo tratado com sucesso.</p>
            <div className="d-flex gap-2 justify-content-center flex-wrap mt-4">
              <button
                className="btn btn-primary"
                onClick={proximoGrupo}
                disabled={grupos.length === 0}
              >
                {grupos.length > 0 ? (
                  <>
                    Próximo grupo ({grupos.length} restantes)
                    <i className="bi bi-arrow-right ms-1" />
                  </>
                ) : (
                  'Todos os grupos tratados!'
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
