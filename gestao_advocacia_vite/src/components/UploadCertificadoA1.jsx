// src/components/UploadCertificadoA1.jsx
// Upload do certificado A1 (.pfx) para NFS-e. Etapa 5.6.2.
//
// Backend exige multipart/form-data com arquivo + senha. Cert e
// senha sao criptografados antes de salvar no banco. UI mostra
// status atual (titular + validade) ou form de upload.
import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { DocumentCheckIcon, ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline'
import { uploadCertificadoA1, removerCertificadoA1 } from '../api/nfse.js'

const formatDataBR = (iso) => {
  if (!iso) return '-'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const diasAteVencer = (iso) => {
  if (!iso) return null
  const hoje = new Date()
  const v = new Date(iso)
  return Math.floor((v - hoje) / (1000 * 60 * 60 * 24))
}

function UploadCertificadoA1({ config, onConfigChange }) {
  const [arquivo, setArquivo] = useState(null)
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [removendo, setRemovendo] = useState(false)

  const handleArquivo = (e) => {
    const f = e.target.files?.[0]
    if (!f) {
      setArquivo(null)
      return
    }
    // Validacao mínima — backend faz a real.
    if (!f.name.toLowerCase().endsWith('.pfx') && !f.name.toLowerCase().endsWith('.p12')) {
      toast.error('Arquivo deve ter extensão .pfx ou .p12.')
      e.target.value = ''
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Arquivo excede 10 MB.')
      e.target.value = ''
      return
    }
    setArquivo(f)
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!arquivo || !senha) {
      toast.error('Selecione o arquivo e informe a senha.')
      return
    }
    setEnviando(true)
    try {
      const resp = await uploadCertificadoA1(arquivo, senha)
      toast.success('Certificado A1 carregado com sucesso.')
      setArquivo(null)
      setSenha('')
      // Atualiza config no pai sem precisar refetchar
      onConfigChange?.({
        ...config,
        tem_certificado: true,
        certificado_nome_titular: resp.certificado_nome_titular,
        certificado_valido_ate: resp.certificado_valido_ate,
      })
    } catch (err) {
      console.error('UploadCertificadoA1: erro ao enviar', err)
      toast.error(err?.message || 'Erro ao enviar certificado.')
    } finally {
      setEnviando(false)
    }
  }

  const handleRemover = async () => {
    if (!window.confirm('Tem certeza que deseja remover o certificado A1?')) return
    setRemovendo(true)
    try {
      await removerCertificadoA1()
      toast.success('Certificado removido.')
      onConfigChange?.({
        ...config,
        tem_certificado: false,
        certificado_nome_titular: null,
        certificado_valido_ate: null,
      })
    } catch (err) {
      console.error('UploadCertificadoA1: erro ao remover', err)
      toast.error(err?.message || 'Erro ao remover certificado.')
    } finally {
      setRemovendo(false)
    }
  }

  // Tem cert carregado: mostra status
  if (config?.tem_certificado) {
    const dias = diasAteVencer(config.certificado_valido_ate)
    const corBorda = dias != null && dias < 30 ? 'border-warning' : 'border-success'
    const corTexto = dias != null && dias < 30 ? 'text-warning' : 'text-success'
    return (
      <div className={`card border-2 ${corBorda} mb-3`}>
        <div className="card-body">
          <div className="d-flex align-items-start">
            <DocumentCheckIcon
              style={{ width: 28, height: 28 }}
              className={`me-3 ${corTexto}`}
            />
            <div className="flex-grow-1">
              <h6 className="fw-bold mb-1">Certificado A1 carregado</h6>
              <div className="small text-muted mb-1">
                <strong>Titular:</strong>{' '}
                {config.certificado_nome_titular || 'desconhecido'}
              </div>
              <div className="small text-muted">
                <strong>Validade:</strong>{' '}
                {formatDataBR(config.certificado_valido_ate)}{' '}
                {dias != null && (
                  <span className={dias < 30 ? 'text-warning fw-bold' : 'text-muted'}>
                    {dias > 0 ? `(${dias} dias restantes)` : '(VENCIDO)'}
                  </span>
                )}
              </div>
              {dias != null && dias < 30 && (
                <div className="alert alert-warning small mt-2 mb-0 d-flex align-items-start py-2">
                  <ExclamationTriangleIcon
                    style={{ width: 16, height: 16 }}
                    className="me-1 flex-shrink-0 mt-1"
                  />
                  Certificado próximo do vencimento. Providencie a renovação na AC certificadora.
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={handleRemover}
              disabled={removendo}
              title="Remover certificado"
            >
              <TrashIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Sem cert: form de upload
  return (
    <div className="card border-warning border-2 mb-3">
      <div className="card-body">
        <h6 className="fw-bold mb-2">
          <ExclamationTriangleIcon
            style={{ width: 18, height: 18 }}
            className="me-1 text-warning"
          />
          Certificado A1 não carregado
        </h6>
        <p className="small text-muted mb-3">
          O Portal Nacional NFS-e exige certificado digital ICP-Brasil A1 ou A3 (mTLS). Faça
          upload do seu arquivo .pfx com senha — ambos são criptografados antes de salvar.
        </p>
        <form onSubmit={handleUpload}>
          <div className="row g-2 align-items-end">
            <div className="col-md-6">
              <label className="form-label small fw-bold mb-1">Arquivo .pfx ou .p12</label>
              <input
                type="file"
                className="form-control form-control-sm"
                accept=".pfx,.p12"
                onChange={handleArquivo}
                disabled={enviando}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-bold mb-1">Senha do certificado</label>
              <input
                type="password"
                className="form-control form-control-sm"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={enviando}
                autoComplete="off"
              />
            </div>
            <div className="col-md-2">
              <button
                type="submit"
                className="btn btn-primary btn-sm w-100"
                disabled={enviando || !arquivo || !senha}
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UploadCertificadoA1
