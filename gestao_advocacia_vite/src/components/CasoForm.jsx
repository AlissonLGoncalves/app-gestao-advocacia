import React, { useState, useEffect, useCallback, useRef } from 'react'
import { API_URL } from '../config.js'
import { toast } from 'react-toastify'
import { parseCNJ, formatCNJ } from '../utils/cnj.js'
import { consultaPublicaCnj } from '../api/casos.js'
import DadosProcessoSection from './forms/caso/DadosProcessoSection.jsx'
import TramitacaoSection from './forms/caso/TramitacaoSection.jsx'
import EventoAgendaSection from './forms/caso/EventoAgendaSection.jsx'
import useCasoForm from '../hooks/useCasoForm.js'

const initialState = {
  cliente_id: '',
  titulo: '',
  numero_processo: '',
  status: 'Ativo',
  prioridade: 'Normal',
  parte_contraria: '',
  adv_parte_contraria: '',
  tipo_acao: '',
  area_direito: '',
  fase_processual: '',
  vara_juizo: '',
  comarca: '',
  instancia: '',
  valor_causa: '',
  data_distribuicao: '',
  notas_caso: '',
}

function CasoForm({ casoParaEditar, onCasoChange, onCancel, clienteIdInicial }) {
  const [formData, setFormData] = useState(initialState)
  const [clientes, setClientes] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cnjInfo, setCnjInfo] = useState(null)
  const [isSyncingCNJ, setIsSyncingCNJ] = useState(false)
  const [isMagicLoading, setIsMagicLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [magicUploadProgress, setMagicUploadProgress] = useState(0)
  const magicFileRef = useRef(null)
  // App leve: campos secundários começam recolhidos ao CRIAR. Ao editar um
  // caso existente, abre tudo (quem edita quer ver o que já está preenchido).
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false)
  const [criarEvento, setCriarEvento] = useState(false)
  const [eventoData, setEventoData] = useState({
    titulo: '',
    data_hora: '',
    tipo: 'Prazo',
    notas: '',
  })
  // Eventos sugeridos pela IA (após upload de PDF). Cada um tem `selecionado`.
  const [eventosIA, setEventosIA] = useState([])
  // Texto extraido do PDF de origem (auto-preenchimento magico).
  // Persistido como Documento .md ao salvar caso (~50 KB vs ~5 MB do PDF).
  const [textoExtraido, setTextoExtraido] = useState(null)
  const [nomeArquivoOrigem, setNomeArquivoOrigem] = useState(null)

  const { validationErrors, setValidationErrors, clearValidationErrors, handleSubmit } =
    useCasoForm({
      formData,
      isEditing,
      casoParaEditar,
      onCasoChange,
      criarEvento,
      eventoData,
      eventosIA,
      textoExtraido,
      nomeArquivoOrigem,
      setLoading,
    })

  const normalizarDataParaInput = (value) => {
    if (!value) return ''
    const texto = String(value).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
    const digits = texto.replace(/\D/g, '')
    if (digits.length >= 8) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    }
    return ''
  }

  const inferirParteContraria = (titulo, nomeCliente) => {
    const t = String(titulo || '').trim()
    if (!t) return ''
    const separador = t.includes(' x ') ? ' x ' : t.includes(' X ') ? ' X ' : null
    if (!separador) return ''
    const [a, b] = t.split(separador).map((v) => v.trim())
    const cliente = String(nomeCliente || '')
      .trim()
      .toLowerCase()
    if (!cliente) return a || b || ''
    if (a.toLowerCase().includes(cliente)) return b || ''
    if (b.toLowerCase().includes(cliente)) return a || ''
    return a || b || ''
  }

  const fetchClientes = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/clientes/?sort_by=nome_razao_social&sort_order=asc`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!response.ok) throw new Error('Falha ao carregar clientes')
      const data = await response.json()
      setClientes(Array.isArray(data) ? data : data.clientes || [])
    } catch (error) {
      toast.error(`Erro ao carregar clientes: ${error.message}`)
    }
  }, [])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  useEffect(() => {
    clearValidationErrors()
    if (casoParaEditar && casoParaEditar.id) {
      const dadosEdit = { ...initialState, ...casoParaEditar }
      dadosEdit.data_distribuicao =
        typeof dadosEdit.data_distribuicao === 'string'
          ? dadosEdit.data_distribuicao.split('T')[0]
          : ''
      dadosEdit.valor_causa = dadosEdit.valor_causa == null ? '' : String(dadosEdit.valor_causa)
      dadosEdit.cliente_id = dadosEdit.cliente_id ? String(dadosEdit.cliente_id) : ''
      setFormData(dadosEdit)
      setIsEditing(true)
      // Editando: mostra tudo que já está preenchido.
      setMostrarDetalhes(true)
      if (dadosEdit.numero_processo) setCnjInfo(parseCNJ(dadosEdit.numero_processo))
    } else {
      const estado = { ...initialState }
      if (clienteIdInicial) estado.cliente_id = String(clienteIdInicial)
      setFormData(estado)
      setIsEditing(false)
      setMostrarDetalhes(false)
    }
  }, [casoParaEditar, clienteIdInicial, clearValidationErrors])

  const handleChange = (e) => {
    const { name, value } = e.target
    if (validationErrors[name]) setValidationErrors((prev) => ({ ...prev, [name]: '' }))
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const buscarDadosDataJud = async (numeroCNJ) => {
    setIsSyncingCNJ(true)
    try {
      const data = await consultaPublicaCnj(numeroCNJ)
      setFormData((prev) => {
        let dataDistr = prev.data_distribuicao
        if (data.data_distribuicao && !prev.data_distribuicao) dataDistr = data.data_distribuicao
        return {
          ...prev,
          vara_juizo: data.vara_juizo || prev.vara_juizo,
          instancia: data.instancia || prev.instancia,
          tipo_acao: data.classe_acao || prev.tipo_acao,
          fase_processual: data.fase_processual || prev.fase_processual,
          data_distribuicao: dataDistr,
          notas_caso: data.resumo_andamentos
            ? prev.notas_caso
              ? `${prev.notas_caso}\n\n${data.resumo_andamentos}`
              : data.resumo_andamentos
            : prev.notas_caso,
        }
      })
      toast.info('Resumo das movimentacoes e vara do processo preenchidos com sucesso!')
    } catch (e) {
      console.warn('Falha silenciosa ao sincronizar CNJ ao digitar: ', e)
    } finally {
      setIsSyncingCNJ(false)
    }
  }

  const handleNumeroProcessoChange = (e) => {
    const formatado = formatCNJ(e.target.value)
    if (validationErrors.numero_processo)
      setValidationErrors((prev) => ({ ...prev, numero_processo: '' }))
    const info = parseCNJ(formatado)
    setCnjInfo(info)

    setFormData((prev) => {
      const updates = { ...prev, numero_processo: formatado }
      if (info) {
        if (!prev.area_direito) updates.area_direito = info.areaSugerida
        if (!prev.instancia) updates.instancia = info.instanciaSugerida
        if (!prev.titulo && formatado.length > 10) updates.titulo = `Processo ${formatado}`
      }
      return updates
    })

    if (info && formatado.length === 25) buscarDadosDataJud(formatado)
  }

  const handleMagicUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsMagicLoading(true)
    setMagicUploadProgress(0)
    const token = localStorage.getItem('token')
    const formDataUpload = new FormData()
    formDataUpload.append('documento', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/casos/leitura-peticao`, true)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setMagicUploadProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      setIsMagicLoading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const jsonRes = JSON.parse(xhr.responseText)
          if (jsonRes.dados) {
            const clienteSelecionado = clientes.find(
              (c) => String(c.id) === String(formData.cliente_id)
            )
            const parteContrariaInferida = inferirParteContraria(
              jsonRes.dados.titulo,
              clienteSelecionado?.nome_razao_social
            )

            setFormData((prev) => ({
              ...prev,
              numero_processo: jsonRes.dados.numero_processo || prev.numero_processo,
              valor_causa: jsonRes.dados.valor_causa
                ? String(jsonRes.dados.valor_causa)
                : prev.valor_causa,
              titulo: jsonRes.dados.titulo || prev.titulo,
              tipo_acao: jsonRes.dados.tipo_acao || prev.tipo_acao,
              fase_processual: jsonRes.dados.fase_processual || prev.fase_processual,
              vara_juizo: jsonRes.dados.vara_juizo || prev.vara_juizo,
              comarca: jsonRes.dados.comarca || prev.comarca,
              instancia: jsonRes.dados.instancia || prev.instancia,
              data_distribuicao:
                normalizarDataParaInput(jsonRes.dados.data_distribuicao) || prev.data_distribuicao,
              area_direito: jsonRes.dados.area_direito || prev.area_direito,
              parte_contraria:
                jsonRes.dados.parte_contraria || parteContrariaInferida || prev.parte_contraria,
              notas_caso: jsonRes.dados.resumo_fatos
                ? prev.notas_caso
                  ? `${prev.notas_caso}\n\n-- Resumo IA dos Fatos:\n${jsonRes.dados.resumo_fatos}`
                  : `-- Resumo IA dos Fatos:\n${jsonRes.dados.resumo_fatos}`
                : prev.notas_caso,
            }))
            // Guarda o texto extraido (markdown leve) para persistir como
            // Documento vinculado ao caso quando salvar. ~50 KB vs ~5 MB do PDF.
            if (jsonRes.texto_extraido) {
              setTextoExtraido(jsonRes.texto_extraido)
              setNomeArquivoOrigem(jsonRes.nome_arquivo_original || file.name)
            }
            toast.success(`Leitura Concluida via ${jsonRes.dados.fonte || 'IA'}!`)
            // A IA preencheu campos avançados — abre pra você conferir.
            setMostrarDetalhes(true)
            if (jsonRes.dados.numero_processo && jsonRes.dados.numero_processo.length === 25)
              buscarDadosDataJud(jsonRes.dados.numero_processo)
          } else {
            toast.error(jsonRes.message || 'Erro na Leitura da IA.')
          }
        } catch {
          toast.error('Erro ao analisar a resposta da API.')
        }
      } else {
        toast.error(`Falha do Servidor: ${xhr.status} ${xhr.responseText}`)
      }
    }

    xhr.onerror = () => {
      setIsMagicLoading(false)
      toast.error('Erro fatal de Conexao ao invocar o Motor Magico.')
    }

    xhr.send(formDataUpload)
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Caso' : 'Adicionar Novo Caso'}</h5>
      </div>
      <div className="card-body p-4">
        <div
          className="alert alert-secondary mb-4"
          style={{
            border: isDragOver ? '2px dashed #0d6efd' : '2px dashed #6c757d',
            backgroundColor: isDragOver ? '#e8f0fe' : '#f8f9fa',
            transition: 'border-color 0.2s, background-color 0.2s',
            cursor: 'pointer',
          }}
          role="alert"
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleMagicUpload({ target: { files: [file] } })
          }}
          onClick={() => !isMagicLoading && magicFileRef.current?.click()}
        >
          <h6 className="alert-heading text-primary fw-bold">Preenchimento Magico (RegEx + IA)</h6>
          <p className="small mb-2">
            {isDragOver
              ? 'Solte o arquivo aqui...'
              : 'Arraste o arquivo aqui ou clique para selecionar. Extrai título, valor e número do CNJ automaticamente.'}
          </p>

          {isMagicLoading && (
            <div className="mb-3">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>
                  {magicUploadProgress === 100
                    ? 'Processando Automacao IA (Aguarde...)'
                    : 'Enviando...'}
                </span>
                <span>{magicUploadProgress}%</span>
              </div>
              <div className="progress" style={{ height: '6px' }}>
                <div
                  className={`progress-bar progress-bar-striped ${magicUploadProgress === 100 ? 'progress-bar-animated bg-success' : 'bg-primary'}`}
                  role="progressbar"
                  style={{ width: `${magicUploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <input
            type="file"
            style={{ display: 'none' }}
            ref={magicFileRef}
            onChange={handleMagicUpload}
            accept="application/pdf,image/*,.docx"
          />
          {!isMagicLoading && (
            <button
              type="button"
              className="btn btn-outline-primary shadow-sm rounded-pill btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                magicFileRef.current?.click()
              }}
              disabled={isMagicLoading}
            >
              Carregar Arquivo do Processo
            </button>
          )}
          {isMagicLoading && (
            <span className="spinner-border spinner-border-sm text-primary"></span>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* App leve: por padrão só o essencial (número do processo, título e
              cliente). Os outros ~15 campos continuam existindo, mas atrás de
              "Mais detalhes" — cadastrar um caso deixa de parecer um
              formulário de imposto de renda. Ao editar, abre tudo. */}
          <DadosProcessoSection
            formData={formData}
            clientes={clientes}
            cnjInfo={cnjInfo}
            isSyncingCNJ={isSyncingCNJ}
            validationErrors={validationErrors}
            onChange={handleChange}
            onNumeroProcessoChange={handleNumeroProcessoChange}
            mostrarAvancado={mostrarDetalhes}
          />

          <button
            type="button"
            className="btn btn-sm btn-link text-decoration-none px-0 mb-2"
            onClick={() => setMostrarDetalhes((v) => !v)}
            aria-expanded={mostrarDetalhes}
          >
            {mostrarDetalhes ? '− Menos detalhes' : '+ Mais detalhes'}
            <span className="text-muted ms-2 small">
              {mostrarDetalhes
                ? ''
                : 'status, prioridade, valor, vara, comarca, parte contrária...'}
            </span>
          </button>

          {mostrarDetalhes && (
            <>
              <TramitacaoSection formData={formData} onChange={handleChange} />

              <EventoAgendaSection
                isEditing={isEditing}
                criarEvento={criarEvento}
                setCriarEvento={setCriarEvento}
                eventoData={eventoData}
                setEventoData={setEventoData}
                formData={formData}
                eventosIA={eventosIA}
                setEventosIA={setEventosIA}
              />
            </>
          )}

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
              {isEditing ? 'Atualizar Caso' : 'Adicionar Caso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CasoForm
