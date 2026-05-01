import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import CampoExtraido from '../../components/procuracao/CampoExtraido.jsx'
import { API_URL } from '../../config.js'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx']
const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const initialStatePF = {
  nome_razao_social: '',
  cpf_cnpj: '',
  tipo_pessoa: 'PF',
  rg: '',
  orgao_emissor: '',
  data_nascimento: '',
  estado_civil: '',
  profissao: '',
  nacionalidade: 'Brasileiro(a)',
  cep: '',
  rua: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  pais: 'Brasil',
  telefone: '',
  email: '',
  notas_gerais: '',
  cnpj_secundario: '',
  descricao_cnpj_secundario: '',
  cnpj_terciario: '',
  descricao_cnpj_terciario: '',
}

const initialStatePJ = {
  ...initialStatePF,
  tipo_pessoa: 'PJ',
  nome_fantasia: '',
  nire: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
}

function normalizeTipoPessoa(raw) {
  const value = String(raw || '').toUpperCase()
  return value === 'PJ' ? 'PJ' : 'PF'
}

function toFieldMap(dadosExtraidos) {
  const outorgante = dadosExtraidos?.outorgante || {}
  const endereco = outorgante?.endereco || {}

  return {
    nome_razao_social: outorgante?.nome_completo || '',
    cpf_cnpj: outorgante?.cpf_cnpj || '',
    tipo_pessoa: normalizeTipoPessoa(outorgante?.tipo_pessoa),
    rg: outorgante?.rg || '',
    estado_civil: outorgante?.estado_civil || '',
    profissao: outorgante?.profissao || '',
    nacionalidade: outorgante?.nacionalidade || 'Brasileiro(a)',
    cep: endereco?.cep || '',
    rua: endereco?.logradouro || '',
    numero: endereco?.numero || '',
    bairro: endereco?.bairro || '',
    cidade: endereco?.cidade || '',
    estado: endereco?.uf || '',
    telefone: outorgante?.telefone || '',
    email: outorgante?.email || '',
  }
}

function fieldWarningFor(fieldName, avisosValidacao) {
  const warnings = Array.isArray(avisosValidacao) ? avisosValidacao : []
  const lowerField = String(fieldName || '').toLowerCase()

  const aliases = {
    cpf_cnpj: ['cpf', 'cnpj'],
    cep: ['cep'],
    email: ['email', 'e-mail'],
    telefone: ['telefone', 'celular'],
  }

  const terms = aliases[lowerField] || [lowerField]
  return warnings.find((warning) =>
    terms.some((term) =>
      String(warning || '')
        .toLowerCase()
        .includes(term)
    )
  )
}

function NovoClientePorProcuracao() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [arquivo, setArquivo] = useState(null)
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [avisosValidacao, setAvisosValidacao] = useState([])
  const [analiseResult, setAnaliseResult] = useState(null)
  const [formData, setFormData] = useState(initialStatePF)
  const [showCriarCasoModal, setShowCriarCasoModal] = useState(false)
  const [clienteCriadoId, setClienteCriadoId] = useState(null)
  const [numeroCnjSugerido, setNumeroCnjSugerido] = useState('')
  const [criandoCaso, setCriandoCaso] = useState(false)

  const extractedMap = useMemo(() => {
    const mapped = toFieldMap(analiseResult?.dados_extraidos || {})
    return Object.fromEntries(
      Object.entries(mapped).map(([key, value]) => [key, !!String(value).trim()])
    )
  }, [analiseResult])

  const processoExtraido = analiseResult?.dados_extraidos?.processo || {}
  const objetoProcuracao = analiseResult?.dados_extraidos?.objeto_procuracao || ''

  function setFileFromInput(file) {
    if (!file) {
      setArquivo(null)
      return
    }

    const fileName = String(file.name || '').toLowerCase()
    const extOk = ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
    const mimeOk = ACCEPTED_MIME.includes(file.type)

    if (!extOk && !mimeOk) {
      toast.warn('Formato inválido. Envie apenas PDF ou DOCX.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.warn('Arquivo acima do limite de 10MB.')
      return
    }

    setArquivo(file)
  }

  function statusFor(fieldName) {
    const warning = fieldWarningFor(fieldName, avisosValidacao)
    if (warning) {
      return 'warning'
    }
    return extractedMap[fieldName] ? 'extracted' : 'missing'
  }

  function warningFor(fieldName) {
    return fieldWarningFor(fieldName, avisosValidacao)
  }

  async function handleAnalisar() {
    if (!arquivo) {
      return
    }

    setAnalisando(true)
    try {
      const token = localStorage.getItem('token')
      const body = new FormData()
      body.append('arquivo', arquivo)

      const response = await fetch(`${API_URL}/procuracoes/analisar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.message || data?.erro || 'Falha ao analisar procuração.')
      }

      setAnaliseResult(data)
      setAvisosValidacao(Array.isArray(data?.avisos_validacao) ? data.avisos_validacao : [])

      const mapped = toFieldMap(data?.dados_extraidos || {})
      const tipoPessoa = normalizeTipoPessoa(mapped.tipo_pessoa)
      const base = tipoPessoa === 'PJ' ? initialStatePJ : initialStatePF
      setFormData({ ...base, ...mapped })

      setStep(2)
    } catch (error) {
      toast.error(error.message || 'Erro ao analisar arquivo.')
    } finally {
      setAnalisando(false)
    }
  }

  function handleFieldChange(event) {
    const { name, value } = event.target
    if (name === 'tipo_pessoa') {
      const tipo = normalizeTipoPessoa(value)
      const base = tipo === 'PJ' ? initialStatePJ : initialStatePF
      setFormData((prev) => ({
        ...base,
        ...prev,
        tipo_pessoa: tipo,
      }))
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleCriarCliente() {
    setSalvando(true)
    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...formData,
        cpf_cnpj: String(formData.cpf_cnpj || '').replace(/\D/g, ''),
        processo_cnj: processoExtraido?.numero_cnj || undefined,
      }

      const response = await fetch(`${API_URL}/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.erro || data?.message || 'Falha ao criar cliente.')
      }

      const id = data?.id || data?.cliente?.id

      if (data?.caso_existente === true && data?.caso_id) {
        toast.success(
          <span>
            Cliente vinculado ao caso já existente.{' '}
            <button
              type="button"
              className="btn btn-link btn-sm p-0 align-baseline"
              onClick={() => navigate(`/casos/detalhe/${data.caso_id}`)}
            >
              Abrir caso
            </button>
          </span>
        )
        navigate('/clientes')
        return
      }

      if (data?.caso_existente === false && data?.numero_cnj_sugerido && id) {
        setClienteCriadoId(id)
        setNumeroCnjSugerido(data.numero_cnj_sugerido)
        setShowCriarCasoModal(true)
        return
      }

      toast.success('Cliente criado com sucesso.')
      navigate('/clientes')
    } catch (error) {
      toast.error(error.message || 'Erro ao criar cliente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleCriarCasoAutomatico() {
    if (!clienteCriadoId || !analiseResult?.id) {
      setShowCriarCasoModal(false)
      navigate('/clientes')
      return
    }

    setCriandoCaso(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/procuracoes/${analiseResult.id}/criar-caso`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cliente_id: clienteCriadoId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.message || data?.erro || 'Falha ao criar caso automaticamente.')
      }

      toast.success(
        <span>
          Caso criado com sucesso.{' '}
          <button
            type="button"
            className="btn btn-link btn-sm p-0 align-baseline"
            onClick={() => navigate(`/casos/detalhe/${data.id}`)}
          >
            Abrir caso
          </button>
        </span>
      )
      setShowCriarCasoModal(false)
      navigate('/clientes')
    } catch (error) {
      toast.error(error.message || 'Erro ao criar caso.')
      setShowCriarCasoModal(false)
      navigate('/clientes')
    } finally {
      setCriandoCaso(false)
    }
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light">
        <h5 className="mb-0">Cadastrar Cliente por Procuração</h5>
      </div>
      <div className="card-body p-4">
        <div className="mb-4">
          <span className={`badge me-2 ${step >= 1 ? 'bg-primary' : 'bg-secondary'}`}>
            1. Upload
          </span>
          <span className={`badge me-2 ${step >= 2 ? 'bg-primary' : 'bg-secondary'}`}>
            2. Revisão
          </span>
          <span className={`badge ${step >= 3 ? 'bg-primary' : 'bg-secondary'}`}>
            3. Confirmação
          </span>
        </div>

        {step === 1 && (
          <section>
            <p className="text-muted small mb-3">
              Envie uma procuração em PDF ou DOCX. O processamento pode levar de 10 a 30 segundos.
            </p>
            <div
              className="border border-2 border-dashed rounded p-4 text-center bg-light"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                setFileFromInput(event.dataTransfer.files?.[0])
              }}
            >
              <p className="mb-2 fw-semibold">Arraste o arquivo aqui</p>
              <p className="text-muted small mb-3">ou selecione manualmente</p>
              <input
                id="arquivo-procuracao"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="d-none"
                onChange={(event) => setFileFromInput(event.target.files?.[0])}
              />
              <label className="btn btn-outline-primary btn-sm" htmlFor="arquivo-procuracao">
                Selecionar arquivo
              </label>
              {arquivo ? (
                <p className="mt-3 mb-0 small text-success" data-testid="arquivo-selecionado">
                  {arquivo.name}
                </p>
              ) : null}
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!arquivo || analisando}
                onClick={handleAnalisar}
              >
                {analisando ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    ></span>
                    Analisando procuração...
                  </>
                ) : (
                  'Analisar procuração'
                )}
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            {avisosValidacao.length > 0 ? (
              <div className="alert alert-warning" role="alert">
                <h6 className="fw-bold mb-2">Avisos de validação</h6>
                <ul className="mb-0">
                  {avisosValidacao.map((aviso, index) => (
                    <li key={`${aviso}-${index}`}>{aviso}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="alert alert-info small" role="alert">
              <strong>Objeto da procuração:</strong>{' '}
              {objetoProcuracao || 'Não detectado no arquivo.'}
            </div>

            <div className="row">
              <div className="col-md-6">
                <CampoExtraido
                  id="nome_razao_social"
                  label="Nome / Razão Social"
                  status={statusFor('nome_razao_social')}
                  warning={warningFor('nome_razao_social')}
                >
                  <input
                    id="nome_razao_social"
                    name="nome_razao_social"
                    className="form-control form-control-sm"
                    value={formData.nome_razao_social}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-3">
                <CampoExtraido
                  id="tipo_pessoa"
                  label="Tipo Pessoa"
                  status={statusFor('tipo_pessoa')}
                >
                  <select
                    id="tipo_pessoa"
                    name="tipo_pessoa"
                    className="form-select form-select-sm"
                    value={formData.tipo_pessoa}
                    onChange={handleFieldChange}
                  >
                    <option value="PF">Pessoa Física (PF)</option>
                    <option value="PJ">Pessoa Jurídica (PJ)</option>
                  </select>
                </CampoExtraido>
              </div>
              <div className="col-md-3">
                <CampoExtraido
                  id="cpf_cnpj"
                  label="CPF/CNPJ"
                  status={statusFor('cpf_cnpj')}
                  warning={warningFor('cpf_cnpj')}
                >
                  <input
                    id="cpf_cnpj"
                    name="cpf_cnpj"
                    className="form-control form-control-sm"
                    value={formData.cpf_cnpj}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3">
                <CampoExtraido id="rg" label="RG" status={statusFor('rg')}>
                  <input
                    id="rg"
                    name="rg"
                    className="form-control form-control-sm"
                    value={formData.rg || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-3">
                <CampoExtraido
                  id="estado_civil"
                  label="Estado Civil"
                  status={statusFor('estado_civil')}
                >
                  <input
                    id="estado_civil"
                    name="estado_civil"
                    className="form-control form-control-sm"
                    value={formData.estado_civil || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-3">
                <CampoExtraido id="profissao" label="Profissão" status={statusFor('profissao')}>
                  <input
                    id="profissao"
                    name="profissao"
                    className="form-control form-control-sm"
                    value={formData.profissao || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-3">
                <CampoExtraido
                  id="nacionalidade"
                  label="Nacionalidade"
                  status={statusFor('nacionalidade')}
                >
                  <input
                    id="nacionalidade"
                    name="nacionalidade"
                    className="form-control form-control-sm"
                    value={formData.nacionalidade || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
            </div>

            <div className="row">
              <div className="col-md-2">
                <CampoExtraido
                  id="cep"
                  label="CEP"
                  status={statusFor('cep')}
                  warning={warningFor('cep')}
                >
                  <input
                    id="cep"
                    name="cep"
                    className="form-control form-control-sm"
                    value={formData.cep || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-5">
                <CampoExtraido id="rua" label="Rua" status={statusFor('rua')}>
                  <input
                    id="rua"
                    name="rua"
                    className="form-control form-control-sm"
                    value={formData.rua || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-2">
                <CampoExtraido id="numero" label="Número" status={statusFor('numero')}>
                  <input
                    id="numero"
                    name="numero"
                    className="form-control form-control-sm"
                    value={formData.numero || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-3">
                <CampoExtraido id="bairro" label="Bairro" status={statusFor('bairro')}>
                  <input
                    id="bairro"
                    name="bairro"
                    className="form-control form-control-sm"
                    value={formData.bairro || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
            </div>

            <div className="row">
              <div className="col-md-4">
                <CampoExtraido id="cidade" label="Cidade" status={statusFor('cidade')}>
                  <input
                    id="cidade"
                    name="cidade"
                    className="form-control form-control-sm"
                    value={formData.cidade || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-2">
                <CampoExtraido id="estado" label="UF" status={statusFor('estado')}>
                  <input
                    id="estado"
                    name="estado"
                    className="form-control form-control-sm"
                    value={formData.estado || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-3">
                <CampoExtraido
                  id="telefone"
                  label="Telefone"
                  status={statusFor('telefone')}
                  warning={warningFor('telefone')}
                >
                  <input
                    id="telefone"
                    name="telefone"
                    className="form-control form-control-sm"
                    value={formData.telefone || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
              <div className="col-md-3">
                <CampoExtraido
                  id="email"
                  label="Email"
                  status={statusFor('email')}
                  warning={warningFor('email')}
                >
                  <input
                    id="email"
                    name="email"
                    className="form-control form-control-sm"
                    value={formData.email || ''}
                    onChange={handleFieldChange}
                  />
                </CampoExtraido>
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="notas_gerais" className="form-label form-label-sm">
                Notas gerais
              </label>
              <textarea
                id="notas_gerais"
                name="notas_gerais"
                className="form-control form-control-sm"
                rows="3"
                value={formData.notas_gerais || ''}
                onChange={handleFieldChange}
              ></textarea>
            </div>

            <div className="d-flex justify-content-between mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setStep(1)}
              >
                Voltar para upload
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                Revisar confirmação
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h6 className="fw-bold mb-3">Confirme os dados antes de criar o cliente</h6>

            <div className="card border-0 bg-light mb-3">
              <div className="card-body py-3">
                <div className="row g-2 small">
                  <div className="col-md-6">
                    <strong>Nome/Razão social:</strong>{' '}
                    {formData.nome_razao_social || 'Não informado'}
                  </div>
                  <div className="col-md-3">
                    <strong>Tipo:</strong> {formData.tipo_pessoa}
                  </div>
                  <div className="col-md-3">
                    <strong>CPF/CNPJ:</strong> {formData.cpf_cnpj || 'Não informado'}
                  </div>
                  <div className="col-md-6">
                    <strong>Email:</strong> {formData.email || 'Não informado'}
                  </div>
                  <div className="col-md-6">
                    <strong>Telefone:</strong> {formData.telefone || 'Não informado'}
                  </div>
                </div>
              </div>
            </div>

            {processoExtraido?.numero_cnj ? (
              <div className="alert alert-secondary small mb-3" role="alert">
                Processo identificado na procuração: <strong>{processoExtraido.numero_cnj}</strong>
              </div>
            ) : null}

            <div className="d-flex justify-content-between mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setStep(2)}
              >
                Voltar para revisão
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleCriarCliente}
                disabled={salvando}
              >
                {salvando ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    ></span>
                    Criando cliente...
                  </>
                ) : (
                  'Criar cliente'
                )}
              </button>
            </div>
          </section>
        )}
      </div>

      {showCriarCasoModal ? (
        <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Criar caso automaticamente</h5>
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  Criar caso para processo <strong>{numeroCnjSugerido}</strong>?
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setShowCriarCasoModal(false)
                    navigate('/clientes')
                  }}
                  disabled={criandoCaso}
                >
                  Pular
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCriarCasoAutomatico}
                  disabled={criandoCaso}
                >
                  {criandoCaso ? 'Criando caso...' : 'Criar caso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default NovoClientePorProcuracao
