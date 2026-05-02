import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { downloadDocumento, listDocumentos, uploadDocumento } from '../api/documentos.js'
import { extrairEventosDeDocumento } from '../api/casos.js'
import { API_URL } from '../config.js'

const DocumentosCasoTab = ({ casoId }) => {
  const [documentos, setDocumentos] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [extraindoDoc, setExtraindoDoc] = useState(null) // documento_id em extracao
  const [eventosExtraidos, setEventosExtraidos] = useState(null) // {documento_id, eventos}
  const [criandoEventos, setCriandoEventos] = useState(false)

  const fetchDocumentos = useCallback(async () => {
    try {
      const data = await listDocumentos(casoId)
      setDocumentos(Array.isArray(data) ? data : data?.documentos || [])
    } catch (e) {
      console.error('Erro buscar docs:', e)
    }
  }, [casoId])

  useEffect(() => {
    fetchDocumentos()
  }, [fetchDocumentos])

  const handleFileDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length === 0) return
    subirArquivos(files)
  }

  const handleFileSelect = async (e) => {
    const files = e.target.files
    if (files.length === 0) return
    subirArquivos(files)
  }

  const subirArquivos = async (files) => {
    setUploading(true)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        await uploadDocumento(casoId, file)
        toast.success(`Arquivo ${file.name} salvo na nuvem com sucesso!`)
      } catch (error) {
        toast.error(`Erro envio ${file.name}: ${error.message || 'falha desconhecida'}`)
      }
    }
    setUploading(false)
    fetchDocumentos()
  }

  const handleExtrairEventos = async (doc) => {
    setExtraindoDoc(doc.id)
    setEventosExtraidos(null)
    try {
      const data = await extrairEventosDeDocumento(doc.id)
      const eventos = (data.eventos || []).map((ev) => ({ ...ev, selecionado: true }))
      if (eventos.length === 0) {
        toast.info('Nenhum evento detectado neste documento.')
      } else {
        toast.success(`${eventos.length} evento(s) detectado(s).`)
        setEventosExtraidos({
          documento_id: doc.id,
          documento_nome: doc.nome_arquivo,
          eventos,
        })
      }
    } catch (err) {
      toast.error(err?.message || 'Falha ao extrair eventos.')
    } finally {
      setExtraindoDoc(null)
    }
  }

  const TIPO_IA_PARA_AGENDA = {
    audiencia: 'Audiência',
    prazo_contestacao: 'Prazo',
    prazo_impugnacao: 'Prazo',
    prazo_replica: 'Prazo',
    prazo_treplica: 'Prazo',
    prazo_recurso: 'Prazo',
    prazo_embargos: 'Prazo',
    prazo_alegacoes_finais: 'Prazo',
    prazo_cumprimento: 'Prazo',
    pericia: 'Perícia',
    sustentacao_oral: 'Audiência',
    outro: 'Outro',
  }

  const toggleEvento = (idx) => {
    setEventosExtraidos((prev) =>
      prev
        ? {
            ...prev,
            eventos: prev.eventos.map((ev, i) =>
              i === idx ? { ...ev, selecionado: !ev.selecionado } : ev
            ),
          }
        : prev
    )
  }

  const criarEventosNaAgenda = async () => {
    if (!eventosExtraidos) return
    const selecionados = eventosExtraidos.eventos.filter((ev) => ev.selecionado && ev.data)
    if (selecionados.length === 0) {
      toast.info('Marque ao menos um evento com data válida.')
      return
    }
    setCriandoEventos(true)
    const token = localStorage.getItem('token')
    let criados = 0
    let falhas = 0
    for (const ev of selecionados) {
      const dataHora = ev.hora ? `${ev.data}T${ev.hora}` : `${ev.data}T09:00`
      const notasParts = []
      if (ev.local) notasParts.push(`Local: ${ev.local}`)
      if (ev.modalidade && ev.modalidade !== 'prazo_so')
        notasParts.push(`Modalidade: ${ev.modalidade}`)
      if (ev.link) notasParts.push(`Link: ${ev.link}`)
      if (ev.base_legal) notasParts.push(`Base legal: ${ev.base_legal}`)
      if (ev.observacao) notasParts.push(ev.observacao)
      try {
        const resp = await fetch(`${API_URL}/agenda/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            titulo: ev.titulo,
            data_hora_inicio: dataHora,
            tipo_evento: TIPO_IA_PARA_AGENDA[ev.tipo] || 'Outro',
            notas: notasParts.join('\n'),
            caso_id: casoId,
          }),
        })
        if (resp.ok) criados += 1
        else falhas += 1
      } catch {
        falhas += 1
      }
    }
    setCriandoEventos(false)
    if (criados > 0) {
      toast.success(
        criados === 1 ? 'Evento criado na agenda!' : `${criados} eventos criados na agenda!`
      )
      setEventosExtraidos(null)
    }
    if (falhas > 0) {
      toast.warning(`${falhas} evento(s) não foram criados.`)
    }
  }

  const handleDownload = async (docId, fileName, viewOnly = false) => {
    try {
      const blob = await downloadDocumento(docId)
      const url = window.URL.createObjectURL(blob)
      if (viewOnly) {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
    } catch (error) {
      toast.error(`Erro de rede ao baixar: ${error.message || 'falha desconhecida'}`)
    }
  }

  return (
    <div className="mt-4 pt-4 border-top">
      <h6 className="text-primary fw-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
        <DocumentTextIcon
          style={{ width: 20, display: 'inline', marginTop: '-4px' }}
          className="me-1"
        />
        Drive do Processo (Peticoẽs, Decisões e PJe)
      </h6>

      <div
        className={`p-4 text-center rounded border ${isDragging ? 'border-primary bg-primary-subtle' : 'border-dashed bg-light'}`}
        style={{ transition: 'all 0.2s', borderStyle: isDragging ? 'solid' : 'dashed' }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
      >
        <CloudArrowUpIcon className="text-muted mb-2" style={{ width: 32 }} />
        <p className="mb-2 text-muted fw-bold">Arraste seus Pdfs e Protocolos para cá</p>
        <p className="small text-muted mb-3">Ou selecione os arquivos do seu computador</p>
        <input
          type="file"
          multiple
          accept="application/pdf,image/*"
          id="file_btn_upload"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <label
          htmlFor="file_btn_upload"
          className="btn btn-sm btn-outline-primary shadow-sm rounded-pill"
        >
          {uploading ? (
            <span className="spinner-border spinner-border-sm me-1"></span>
          ) : (
            'Selecionar Arquivos'
          )}
        </label>
      </div>

      {eventosExtraidos && (
        <div className="alert alert-info border mt-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <strong>
              <SparklesIcon style={{ width: 18, display: 'inline' }} className="me-1" />
              {eventosExtraidos.eventos.length} evento(s) detectado(s) em "
              {eventosExtraidos.documento_nome}"
            </strong>
            <button type="button" className="btn-close" onClick={() => setEventosExtraidos(null)} />
          </div>
          <p className="small text-muted mb-2">
            Marque os que quer criar na agenda e clique em "Criar selecionados".
          </p>
          <div className="d-grid gap-1 mb-2">
            {eventosExtraidos.eventos.map((ev, idx) => (
              <label
                key={idx}
                className="d-flex align-items-start gap-2 p-2 rounded bg-white"
                style={{ cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ev.selecionado}
                  onChange={() => toggleEvento(idx)}
                />
                <div className="flex-grow-1 small">
                  <div className="fw-semibold">{ev.titulo}</div>
                  <div className="text-muted">
                    {ev.data || '(sem data)'} {ev.hora && `às ${ev.hora}`}{' '}
                    {ev.local && `· ${ev.local}`}
                  </div>
                  {ev.observacao && (
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                      {ev.observacao}
                    </div>
                  )}
                </div>
                <span className="badge bg-light text-dark border">
                  {ev.tipo} · {ev.confianca}
                </span>
              </label>
            ))}
          </div>
          <div className="d-flex gap-2 justify-content-end">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setEventosExtraidos(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-sm btn-success"
              onClick={criarEventosNaAgenda}
              disabled={criandoEventos}
            >
              {criandoEventos ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" />
                  Criando...
                </>
              ) : (
                'Criar selecionados na agenda'
              )}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        {documentos.length === 0 ? (
          <p className="text-muted small fst-italic">Nenhum documento arquivado neste cliente.</p>
        ) : (
          <ul className="list-group list-group-flush border rounded shadow-sm">
            {documentos.map((doc) => (
              <li
                key={doc.id}
                className="list-group-item d-flex justify-content-between align-items-center bg-white"
              >
                <div className="d-flex align-items-center">
                  <div className="bg-primary-subtle text-primary p-2 rounded me-3">
                    <DocumentTextIcon style={{ width: 18 }} />
                  </div>
                  <div>
                    <h6 className="mb-0 fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>
                      {doc.nome_arquivo}
                    </h6>
                    <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                      Enviado em: {new Date(doc.data_upload).toLocaleDateString()}
                    </small>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success border hover-shadow"
                    title="Extrair eventos (audiências, prazos) com IA"
                    onClick={() => handleExtrairEventos(doc)}
                    disabled={extraindoDoc !== null}
                  >
                    {extraindoDoc === doc.id ? (
                      <span className="spinner-border spinner-border-sm" role="status" />
                    ) : (
                      <SparklesIcon style={{ width: 16 }} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary border hover-shadow"
                    title="Visualizar"
                    onClick={() => handleDownload(doc.id, doc.nome_arquivo, true)}
                  >
                    Visualizar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-light border hover-shadow"
                    title="Baixar"
                    onClick={() => handleDownload(doc.id, doc.nome_arquivo, false)}
                  >
                    <ArrowDownTrayIcon style={{ width: 16 }} className="text-dark" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default DocumentosCasoTab
