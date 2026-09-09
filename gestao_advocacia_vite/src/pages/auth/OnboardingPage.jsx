import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { api } from '../../api/client.js'
import {
  BuildingOffice2Icon,
  IdentificationIcon,
  UserPlusIcon,
  BriefcaseIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

const PASSOS = [
  { id: 1, titulo: 'Escritório', icone: BuildingOffice2Icon },
  { id: 2, titulo: 'Sua OAB', icone: IdentificationIcon },
  { id: 3, titulo: '1º Cliente', icone: UserPlusIcon },
  { id: 4, titulo: '1º Caso', icone: BriefcaseIcon },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [savingStep, setSavingStep] = useState(false)
  const [finalizando, setFinalizando] = useState(false)

  // Se o tenant ja completou, nao mostrar wizard de novo.
  useEffect(() => {
    let active = true
    api
      .get('/tenant/onboarding-status')
      .then((data) => {
        if (active && data?.onboarding_completed) navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        /* falha silenciosa — guard ja redireciona se necessario */
      })
    return () => {
      active = false
    }
  }, [navigate])

  // ── Passo 1: Escritório ──
  const [escritorio, setEscritorio] = useState({
    nome_escritorio: '',
    telefone: '',
    email_contato: '',
    endereco: '',
  })

  // ── Passo 2: OAB do advogado ──
  const [oab, setOab] = useState({ numero_oab: '', sigla_oab_tribunal: '' })

  // ── Passo 3: 1º cliente ──
  const [cliente, setCliente] = useState({
    nome_razao_social: '',
    cpf_cnpj: '',
    tipo_pessoa: 'PF',
  })
  const [clienteCriadoId, setClienteCriadoId] = useState(null)

  // ── Passo 4: 1º caso ──
  const [caso, setCaso] = useState({ titulo: '', numero_processo: '' })

  const avancar = () => setStep((s) => Math.min(s + 1, PASSOS.length))
  const voltar = () => setStep((s) => Math.max(s - 1, 1))

  const finalizar = async () => {
    setFinalizando(true)
    try {
      await api.post('/tenant/complete-onboarding')
      sessionStorage.setItem('onboarding_completed', 'true')
      toast.success('Configuração inicial concluída!')
      navigate('/dashboard', { replace: true })
    } catch (e) {
      toast.error(e?.message || 'Falha ao concluir onboarding.')
    } finally {
      setFinalizando(false)
    }
  }

  const salvarEscritorioEAvancar = async () => {
    if (!escritorio.nome_escritorio.trim()) {
      toast.error('Informe o nome do escritório.')
      return
    }
    setSavingStep(true)
    try {
      await api.put('/tenant/', escritorio)
      avancar()
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar dados do escritório.')
    } finally {
      setSavingStep(false)
    }
  }

  const salvarOABEAvancar = async () => {
    setSavingStep(true)
    try {
      await api.put('/auth/me', oab)
      avancar()
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar a OAB.')
    } finally {
      setSavingStep(false)
    }
  }

  const salvarClienteEAvancar = async () => {
    if (!cliente.nome_razao_social.trim() || !cliente.cpf_cnpj.trim()) {
      toast.error('Preencha nome e CPF/CNPJ do cliente, ou pule este passo.')
      return
    }
    setSavingStep(true)
    try {
      const novo = await api.post('/clientes/', cliente)
      setClienteCriadoId(novo?.id ?? null)
      avancar()
    } catch (e) {
      toast.error(e?.message || 'Não foi possível criar o cliente.')
    } finally {
      setSavingStep(false)
    }
  }

  const salvarCasoEFinalizar = async () => {
    setSavingStep(true)
    try {
      if (clienteCriadoId && caso.titulo.trim()) {
        await api.post('/casos/', { ...caso, cliente_id: clienteCriadoId })
      }
      await finalizar()
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar o caso.')
      setSavingStep(false)
    }
  }

  const renderStepper = () => (
    <div className="d-flex justify-content-center mb-4 flex-wrap gap-3">
      {PASSOS.map((p) => {
        const Icone = p.icone
        const concluido = step > p.id
        const ativo = step === p.id
        return (
          <div
            key={p.id}
            className="d-flex align-items-center gap-2"
            style={{ opacity: ativo || concluido ? 1 : 0.45 }}
          >
            <span
              className={`rounded-circle d-flex align-items-center justify-content-center ${
                concluido ? 'bg-success' : ativo ? 'bg-primary' : 'bg-light border'
              }`}
              style={{ width: 36, height: 36 }}
            >
              {concluido ? (
                <CheckCircleIcon style={{ width: 20, color: '#fff' }} />
              ) : (
                <Icone style={{ width: 18, color: ativo ? '#fff' : '#6b7280' }} />
              )}
            </span>
            <small className="fw-semibold">{p.titulo}</small>
          </div>
        )
      })}
    </div>
  )

  const renderPassoEscritorio = () => (
    <>
      <h5 className="fw-bold mb-1">Vamos configurar o escritório</h5>
      <p className="text-muted small mb-3">
        Esses dados aparecem em documentos e relatórios. Você pode editar depois em Configurações.
      </p>
      <div className="mb-3">
        <label className="form-label small fw-semibold">
          Nome do escritório <span className="text-danger">*</span>
        </label>
        <input
          className="form-control"
          value={escritorio.nome_escritorio}
          onChange={(e) => setEscritorio({ ...escritorio, nome_escritorio: e.target.value })}
          placeholder="Ex: Patronus Advocacia"
        />
      </div>
      <div className="row">
        <div className="col-md-6 mb-3">
          <label className="form-label small fw-semibold">Telefone</label>
          <input
            className="form-control"
            value={escritorio.telefone}
            onChange={(e) => setEscritorio({ ...escritorio, telefone: e.target.value })}
          />
        </div>
        <div className="col-md-6 mb-3">
          <label className="form-label small fw-semibold">Email de contato</label>
          <input
            type="email"
            className="form-control"
            value={escritorio.email_contato}
            onChange={(e) => setEscritorio({ ...escritorio, email_contato: e.target.value })}
          />
        </div>
      </div>
      <div className="mb-1">
        <label className="form-label small fw-semibold">Endereço</label>
        <input
          className="form-control"
          value={escritorio.endereco}
          onChange={(e) => setEscritorio({ ...escritorio, endereco: e.target.value })}
        />
      </div>
    </>
  )

  const renderPassoOAB = () => (
    <>
      <h5 className="fw-bold mb-1">Sua inscrição na OAB</h5>
      <p className="text-muted small mb-3">
        Necessária para o monitoramento automático de publicações no DJEN.
      </p>
      <div className="row">
        <div className="col-md-8 mb-3">
          <label className="form-label small fw-semibold">Número da OAB</label>
          <input
            className="form-control"
            value={oab.numero_oab}
            onChange={(e) => setOab({ ...oab, numero_oab: e.target.value })}
            placeholder="Ex: 123456"
          />
        </div>
        <div className="col-md-4 mb-3">
          <label className="form-label small fw-semibold">UF</label>
          <input
            className="form-control text-uppercase"
            maxLength={2}
            value={oab.sigla_oab_tribunal}
            onChange={(e) => setOab({ ...oab, sigla_oab_tribunal: e.target.value.toUpperCase() })}
            placeholder="PR"
          />
        </div>
      </div>
    </>
  )

  const renderPassoCliente = () => (
    <>
      <h5 className="fw-bold mb-1">Cadastre seu primeiro cliente</h5>
      <p className="text-muted small mb-3">
        Pode ser PF ou PJ. Você poderá ajustar e adicionar campos depois.
      </p>
      <div className="row">
        <div className="col-md-3 mb-3">
          <label className="form-label small fw-semibold">Tipo</label>
          <select
            className="form-select"
            value={cliente.tipo_pessoa}
            onChange={(e) => setCliente({ ...cliente, tipo_pessoa: e.target.value })}
          >
            <option value="PF">PF</option>
            <option value="PJ">PJ</option>
          </select>
        </div>
        <div className="col-md-9 mb-3">
          <label className="form-label small fw-semibold">
            {cliente.tipo_pessoa === 'PF' ? 'Nome completo' : 'Razão social'}
          </label>
          <input
            className="form-control"
            value={cliente.nome_razao_social}
            onChange={(e) => setCliente({ ...cliente, nome_razao_social: e.target.value })}
          />
        </div>
      </div>
      <div className="mb-1">
        <label className="form-label small fw-semibold">
          {cliente.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}
        </label>
        <input
          className="form-control"
          value={cliente.cpf_cnpj}
          onChange={(e) => setCliente({ ...cliente, cpf_cnpj: e.target.value })}
        />
      </div>
    </>
  )

  const renderPassoCaso = () => {
    if (!clienteCriadoId) {
      return (
        <>
          <h5 className="fw-bold mb-1">Pronto para começar</h5>
          <p className="text-muted small mb-3">
            Você pulou o cadastro do cliente. Você pode criar casos quando quiser, em Casos &gt;
            Novo.
          </p>
        </>
      )
    }
    return (
      <>
        <h5 className="fw-bold mb-1">Vincule o primeiro caso a este cliente</h5>
        <p className="text-muted small mb-3">
          Opcional: você pode criar agora ou adicionar mais tarde em Casos.
        </p>
        <div className="mb-3">
          <label className="form-label small fw-semibold">Título do caso</label>
          <input
            className="form-control"
            value={caso.titulo}
            onChange={(e) => setCaso({ ...caso, titulo: e.target.value })}
            placeholder="Ex: Ação de cobrança vs. Empresa X"
          />
        </div>
        <div className="mb-1">
          <label className="form-label small fw-semibold">Número do processo (opcional)</label>
          <input
            className="form-control"
            value={caso.numero_processo}
            onChange={(e) => setCaso({ ...caso, numero_processo: e.target.value })}
            placeholder="0000000-00.0000.0.00.0000"
          />
        </div>
      </>
    )
  }

  const acaoPrimaria = () => {
    if (savingStep || finalizando) return null
    if (step === 1)
      return (
        <button className="btn btn-primary px-4" onClick={salvarEscritorioEAvancar}>
          Próximo
        </button>
      )
    if (step === 2)
      return (
        <button className="btn btn-primary px-4" onClick={salvarOABEAvancar}>
          Próximo
        </button>
      )
    if (step === 3)
      return (
        <button className="btn btn-primary px-4" onClick={salvarClienteEAvancar}>
          Próximo
        </button>
      )
    return (
      <button className="btn btn-success px-4" onClick={salvarCasoEFinalizar}>
        Concluir
      </button>
    )
  }

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: '100vh', background: 'var(--bg-main, #f8f9fa)' }}
    >
      <div className="card shadow-sm border-0" style={{ width: 'min(640px, 95vw)' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <h3 className="fw-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              Bem-vindo(a) ao Patronus
            </h3>
            <p className="text-muted small mb-0">Configuração inicial — leva menos de 2 minutos.</p>
          </div>

          {renderStepper()}

          <div className="mb-4">
            {step === 1 && renderPassoEscritorio()}
            {step === 2 && renderPassoOAB()}
            {step === 3 && renderPassoCliente()}
            {step === 4 && renderPassoCaso()}
          </div>

          <div className="d-flex justify-content-between align-items-center pt-3 border-top">
            <button
              className="btn btn-link text-muted"
              onClick={voltar}
              disabled={step === 1 || savingStep || finalizando}
            >
              ← Voltar
            </button>
            <div className="d-flex gap-2">
              {step < PASSOS.length && (
                <button
                  className="btn btn-outline-secondary"
                  onClick={avancar}
                  disabled={savingStep}
                >
                  Pular
                </button>
              )}
              {step === PASSOS.length && (
                <button
                  className="btn btn-outline-secondary"
                  onClick={finalizar}
                  disabled={finalizando}
                >
                  Pular e concluir
                </button>
              )}
              {(savingStep || finalizando) && (
                <button className="btn btn-primary px-4" disabled>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Salvando…
                </button>
              )}
              {acaoPrimaria()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
