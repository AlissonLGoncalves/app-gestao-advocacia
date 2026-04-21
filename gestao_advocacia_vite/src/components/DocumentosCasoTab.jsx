import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import { CloudArrowUpIcon, DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { downloadDocumento, listDocumentos, uploadDocumento } from '../api/documentos.js'

const DocumentosCasoTab = ({ casoId }) => {
  const [documentos, setDocumentos] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

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
