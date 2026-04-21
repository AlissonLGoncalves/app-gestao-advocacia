import React, { useState, useEffect } from 'react'
import { API_URL } from './config.js'
import { toast } from 'react-toastify'
import DocumentosClienteTab from './components/DocumentosClienteTab.jsx'
import DadosPessoaisSection from './components/forms/cliente/DadosPessoaisSection.jsx'
import EnderecoSection from './components/forms/cliente/EnderecoSection.jsx'
import ContatoSection from './components/forms/cliente/ContatoSection.jsx'
import useClienteForm from './hooks/useClienteForm.js'
import { anonimizarCliente, extrairDadosDocumentoCliente } from './api/clientes.js'

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
  nome_razao_social: '',
  cpf_cnpj: '',
  tipo_pessoa: 'PJ',
  nome_fantasia: '',
  nire: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  cnpj_secundario: '',
  descricao_cnpj_secundario: '',
  cnpj_terciario: '',
  descricao_cnpj_terciario: '',
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
}

function ClienteForm({ clienteParaEditar, onClienteChange, onCancel }) {
  const getInitialState = () => {
    if (clienteParaEditar && clienteParaEditar.tipo_pessoa === 'PJ') return initialStatePJ
    return initialStatePF
  }

  const [formData, setFormData] = useState(getInitialState())
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [loadingCnpj, setLoadingCnpj] = useState(false)
  const [loadingOcr, setLoadingOcr] = useState(false)

  const { validationErrors, setValidationErrors, clearValidationErrors, handleSubmit } =
    useClienteForm({ formData, isEditing, clienteParaEditar, onClienteChange, setLoading })

  const formatDataParaExibicao = (data) => {
    if (!data) return ''
    if (data.includes('/')) return data
    const partes = data.split('-')
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`
    return data
  }

  const formatDataParaArmazenamento = (data) => {
    if (!data) return ''
    const limpo = data.replace(/\D/g, '')
    if (limpo.length === 8)
      return `${limpo.substring(4, 8)}-${limpo.substring(2, 4)}-${limpo.substring(0, 2)}`
    return ''
  }

  useEffect(() => {
    clearValidationErrors()
    if (clienteParaEditar && clienteParaEditar.id) {
      const initialStateForEdit =
        clienteParaEditar.tipo_pessoa === 'PJ' ? initialStatePJ : initialStatePF
      const dadosEdit = { ...initialStateForEdit, ...clienteParaEditar }

      if (dadosEdit.data_nascimento && typeof dadosEdit.data_nascimento === 'string') {
        dadosEdit.data_nascimento = dadosEdit.data_nascimento.split('T')[0]
      } else if (dadosEdit.data_nascimento instanceof Date) {
        dadosEdit.data_nascimento = dadosEdit.data_nascimento.toISOString().split('T')[0]
      } else {
        dadosEdit.data_nascimento = ''
      }

      dadosEdit.cnpj_secundario = dadosEdit.cnpj_secundario || ''
      dadosEdit.descricao_cnpj_secundario = dadosEdit.descricao_cnpj_secundario || ''
      dadosEdit.cnpj_terciario = dadosEdit.cnpj_terciario || ''
      dadosEdit.descricao_cnpj_terciario = dadosEdit.descricao_cnpj_terciario || ''

      setFormData(dadosEdit)
      setIsEditing(true)
    } else {
      setFormData(initialStatePF)
      setIsEditing(false)
    }
  }, [clienteParaEditar, clearValidationErrors])

  const handleDataNascimentoChange = (e) => {
    let valor = e.target.value
    valor = valor.replace(/\D/g, '')
    if (valor.length >= 2) valor = valor.substring(0, 2) + '/' + valor.substring(2)
    if (valor.length >= 5) valor = valor.substring(0, 5) + '/' + valor.substring(5, 9)

    const dataArmazenada = formatDataParaArmazenamento(valor)
    setFormData((prev) => ({ ...prev, data_nascimento: dataArmazenada }))

    if (validationErrors.data_nascimento) {
      setValidationErrors((prev) => ({ ...prev, data_nascimento: '' }))
    }
  }

  const formatCPFCNPJ = (value, tipoPessoa, isAdicional = false) => {
    if (!value) return ''
    const apenasNumeros = value.replace(/\D/g, '')

    if (tipoPessoa === 'PF' && !isAdicional) {
      return apenasNumeros
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    }

    if (tipoPessoa === 'PJ') {
      return apenasNumeros
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    }

    return value
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: '' }))
    }

    let newFormData = { ...formData, [name]: value }

    if (name === 'tipo_pessoa') {
      const commonData = {
        nome_razao_social: formData.nome_razao_social,
        cep: formData.cep,
        rua: formData.rua,
        numero: formData.numero,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        pais: formData.pais,
        telefone: formData.telefone,
        email: formData.email,
        notas_gerais: formData.notas_gerais,
      }

      if (value === 'PF') {
        newFormData = {
          ...initialStatePF,
          ...commonData,
          tipo_pessoa: 'PF',
          cpf_cnpj: '',
        }
      } else if (value === 'PJ') {
        newFormData = {
          ...initialStatePJ,
          ...commonData,
          tipo_pessoa: 'PJ',
          cpf_cnpj: '',
        }
      }
    } else if (name === 'cpf_cnpj' || name === 'cnpj_secundario' || name === 'cnpj_terciario') {
      newFormData[name] = formatCPFCNPJ(value, formData.tipo_pessoa, name !== 'cpf_cnpj')
    }

    setFormData(newFormData)
  }

  const handleCpfCnpjChange = (e) => {
    const { name, value } = e.target
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: '' }))
    }
    const valorFormatado = formatCPFCNPJ(value, formData.tipo_pessoa, name !== 'cpf_cnpj')
    setFormData((prev) => ({ ...prev, [name]: valorFormatado }))
  }

  const buscarEnderecoPorCEP = async (cep) => {
    if (!cep) return
    const apenasNumeros = cep.replace(/\D/g, '')
    if (apenasNumeros.length !== 8) {
      if (cep.trim() !== '') toast.warn('CEP deve conter 8 dígitos.')
      return
    }

    setLoadingCep(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${apenasNumeros}/json/`)
      if (!response.ok) throw new Error('Falha ao buscar CEP na API ViaCEP.')
      const data = await response.json()

      if (data.erro) {
        toast.warn('CEP não encontrado.')
        setFormData((prev) => ({ ...prev, rua: '', bairro: '', cidade: '', estado: '' }))
      } else {
        setFormData((prev) => ({
          ...prev,
          rua: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        }))
        toast.info('Endereço carregado automaticamente pelo CEP.')
      }
    } catch (error) {
      toast.error(`Erro ao buscar CEP: ${error.message}`)
    } finally {
      setLoadingCep(false)
    }
  }

  const handleCepBlur = (e) => buscarEnderecoPorCEP(e.target.value)

  const buscarDadosCNPJ = async (cnpj, campoOrigem = 'cpf_cnpj') => {
    if (!cnpj) return
    const apenasNumeros = cnpj.replace(/\D/g, '')
    if (apenasNumeros.length !== 14) return

    setLoadingCnpj(true)
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${apenasNumeros}`)
      if (!response.ok) {
        toast.warn(
          response.status === 404
            ? `CNPJ ${cnpj} não encontrado na BrasilAPI.`
            : 'Falha ao buscar dados do CNPJ.'
        )
        return
      }

      const data = await response.json()
      if (campoOrigem === 'cpf_cnpj') {
        setFormData((prev) => ({
          ...prev,
          nome_razao_social: data.razao_social || prev.nome_razao_social,
          nome_fantasia: data.nome_fantasia || prev.nome_fantasia || '',
          cep: prev.cep || data.cep || '',
          rua: prev.rua || data.logradouro || '',
          numero: prev.numero || data.numero || '',
          bairro: prev.bairro || data.bairro || '',
          cidade: prev.cidade || data.municipio || '',
          estado: prev.estado || data.uf || '',
          telefone: prev.telefone || data.ddd_telefone_1 || '',
        }))
        toast.info('Dados da empresa (principal) carregados via CNPJ.')
        if (data.cep && !formData.rua) buscarEnderecoPorCEP(data.cep)
      } else {
        toast.info(`CNPJ ${cnpj} verificado.`)
      }
    } catch (error) {
      toast.error(`Erro ao buscar dados do CNPJ: ${error.message}`)
    } finally {
      setLoadingCnpj(false)
    }
  }

  const handleGenericCnpjBlur = (e) => {
    if (formData.tipo_pessoa === 'PJ') buscarDadosCNPJ(e.target.value, e.target.name)
  }

  const handleFileUploadOcr = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    let totalSize = 0
    Array.from(files).forEach((f) => {
      totalSize += f.size
    })

    if (totalSize > 100 * 1024 * 1024) {
      toast.warn('O tamanho total dos arquivos excede o limite de 100MB do Lote.')
      return
    }

    const permitidos = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ]

    const hasInvalid = Array.from(files).some(
      (file) =>
        !permitidos.includes(file.type) &&
        !file.name.match(/\.(pdf|docx|xlsx|xls|txt|jpg|jpeg|png)$/i)
    )

    if (hasInvalid) {
      toast.warn(
        'Algum formato inválido no Lote. Envie apenas Documentos, Planilhas, Textos ou Imagens JPG/PNG.'
      )
      return
    }

    setLoadingOcr(true)
    const dataToSend = new FormData()
    Array.from(files).forEach((file) => dataToSend.append('documentos', file))

    try {
      const data = await extrairDadosDocumentoCliente(dataToSend)

      const messageExtraida = []
      setFormData((prev) => {
        const documento = data.documento_principal || data.cnpj || data.cpf
        const tipoDetectado =
          data.tipo_pessoa_sugerida || (data.cnpj ? 'PJ' : data.cpf ? 'PF' : prev.tipo_pessoa)

        let updates = { ...prev }
        if (tipoDetectado !== prev.tipo_pessoa) {
          const commonData = {
            nome_razao_social: prev.nome_razao_social,
            cep: prev.cep,
            rua: prev.rua,
            numero: prev.numero,
            bairro: prev.bairro,
            cidade: prev.cidade,
            estado: prev.estado,
            pais: prev.pais,
            telefone: prev.telefone,
            email: prev.email,
            notas_gerais: prev.notas_gerais,
          }
          updates = {
            ...(tipoDetectado === 'PJ' ? initialStatePJ : initialStatePF),
            ...commonData,
            tipo_pessoa: tipoDetectado,
          }
          messageExtraida.push(`Tipo Pessoa (${tipoDetectado})`)
        }

        if (documento) {
          updates.cpf_cnpj = formatCPFCNPJ(documento, tipoDetectado, false)
          messageExtraida.push(tipoDetectado === 'PJ' ? 'CNPJ' : 'CPF')
        }
        if (data.nome_razao_social) {
          updates.nome_razao_social = data.nome_razao_social
          messageExtraida.push('Nome/Razão Social')
        }
        if (data.rg) {
          updates.rg = data.rg
          messageExtraida.push('RG')
        }
        if (data.data_nascimento) {
          updates.data_nascimento = data.data_nascimento
          messageExtraida.push('Data Nasc.')
        }
        if (data.nome_mae) {
          const maeStr = `Nome da Mãe: ${data.nome_mae}`
          updates.notas_gerais = updates.notas_gerais
            ? `${updates.notas_gerais}\n${maeStr}`
            : maeStr
          messageExtraida.push('Filiação')
        }
        if (data.email) {
          updates.email = data.email
          messageExtraida.push('E-mail')
        }
        if (data.telefone) {
          updates.telefone = data.telefone
          messageExtraida.push('Telefone')
        }
        if (data.cep) {
          updates.cep = data.cep
          messageExtraida.push('CEP')
        }
        if (data.rua) {
          updates.rua = data.rua
          messageExtraida.push('Rua')
        }
        if (data.numero) {
          updates.numero = data.numero
          messageExtraida.push('Número')
        }
        if (data.bairro) {
          updates.bairro = data.bairro
          messageExtraida.push('Bairro')
        }
        if (data.cidade) {
          updates.cidade = data.cidade
          messageExtraida.push('Cidade')
        }
        if (data.estado) {
          updates.estado = data.estado
          messageExtraida.push('UF')
        }
        if (data.nacionalidade && tipoDetectado === 'PF') {
          updates.nacionalidade = data.nacionalidade
          messageExtraida.push('Nacionalidade')
        }
        if (data.estado_civil && tipoDetectado === 'PF') {
          updates.estado_civil = data.estado_civil
          messageExtraida.push('Estado Civil')
        }
        if (data.profissao && tipoDetectado === 'PF') {
          updates.profissao = data.profissao
          messageExtraida.push('Profissão')
        }
        return updates
      })

      if (messageExtraida.length > 0) {
        toast.success(
          `Leitura Mágica (OCR) de PDF concluída! Campos preenchidos: ${messageExtraida.join(', ')}`
        )
      } else {
        toast.info(
          'Leitura concluída, mas as chaves biométricas não foram identificadas no arquivo submetido.'
        )
      }
    } catch (err) {
      toast.error(`Falha no OCR: ${err.message}`)
    } finally {
      setLoadingOcr(false)
      e.target.value = null
    }
  }

  const handleAnonymizar = async () => {
    if (
      !window.confirm(
        'ATENÇÃO: Esta ação anonimiza dados sensíveis e não pode ser desfeita. Deseja continuar?'
      )
    ) {
      return
    }

    setLoading(true)
    try {
      await anonimizarCliente(clienteParaEditar.id)
      toast.success('Direito ao esquecimento executado! Dados mascarados.')
      if (typeof onClienteChange === 'function') onClienteChange()
    } catch (error) {
      const details = error.payload?.message || error.payload?.erro || error.message
      toast.error(`Falha ao anonimizar: ${details}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</h5>
      </div>
      <div className="card-body p-4">
        {!isEditing && (
          <div className="alert alert-secondary d-flex align-items-center mb-4" role="alert">
            <div className="me-3">
              <span className="fs-3">📄✨</span>
            </div>
            <div className="flex-grow-1">
              <h6 className="mb-1 text-dark fw-bold">Auto-Preenchimento Mágico (Leitura IA)</h6>
              <p className="mb-0 small text-muted">
                Envie a procuração em PDF (ou outros formatos) para extrair e preencher
                automaticamente os dados do cliente.
              </p>
            </div>
            <div>
              <input
                type="file"
                multiple
                accept="application/pdf, .docx, .xlsx, .xls, .txt, image/png, image/jpeg, image/jpg"
                id="documento_ocr"
                style={{ display: 'none' }}
                onChange={handleFileUploadOcr}
              />
              <label
                htmlFor="documento_ocr"
                className="btn btn-primary btn-sm ms-2 mb-0"
                style={{ cursor: 'pointer' }}
              >
                {loadingOcr ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span> Analisando
                    Lote...
                  </>
                ) : (
                  'Importar Procuração/Documentos'
                )}
              </label>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <DadosPessoaisSection
            formData={formData}
            isEditing={isEditing}
            loadingCnpj={loadingCnpj}
            validationErrors={validationErrors}
            onChange={handleChange}
            onCpfCnpjChange={handleCpfCnpjChange}
            onDataNascimentoChange={handleDataNascimentoChange}
            onGenericCnpjBlur={handleGenericCnpjBlur}
            formatDataParaExibicao={formatDataParaExibicao}
          />

          <EnderecoSection
            formData={formData}
            loadingCep={loadingCep}
            onChange={handleChange}
            onCepBlur={handleCepBlur}
          />

          <ContatoSection
            formData={formData}
            validationErrors={validationErrors}
            onChange={handleChange}
          />

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
            {isEditing && (
              <button
                type="button"
                className="btn btn-outline-danger me-2 btn-sm d-flex align-items-center"
                onClick={handleAnonymizar}
                title="Direito ao Esquecimento LGPD / Mascarar Dados"
              >
                <i className="bi bi-shield-lock-fill me-1"></i> Anonimizar LGPD
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={
                loading ||
                loadingCep ||
                loadingCnpj ||
                Object.keys(validationErrors).some((key) => validationErrors[key])
              }
            >
              {(loading || loadingCep || loadingCnpj) && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              )}
              {isEditing ? 'Atualizar Cliente' : 'Adicionar Cliente'}
            </button>
          </div>
        </form>

        {isEditing && clienteParaEditar && (
          <DocumentosClienteTab clienteId={clienteParaEditar.id} />
        )}
      </div>
    </div>
  )
}

export default ClienteForm
