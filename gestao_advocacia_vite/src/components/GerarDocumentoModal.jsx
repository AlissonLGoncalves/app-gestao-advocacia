// src/components/GerarDocumentoModal.jsx
import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { MODELOS, gerarDocumento } from '../utils/gerarDocumentoLegal.js'
import { api } from '../api/client.js'

const TIPOS = Object.entries(MODELOS).map(([id, v]) => ({ id, ...v }))

function GerarDocumentoModal({ cliente, onClose }) {
  const [tipo, setTipo] = useState(TIPOS[0].id)
  const [templateId, setTemplateId] = useState(TIPOS[0].templates[0].id)
  const [nomeAdvogado, setNomeAdvogado] = useState('')
  const [oab, setOab] = useState('')
  const [estadoOAB, setEstadoOAB] = useState('')
  const [cidade, setCidade] = useState('')
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    if (cliente?.cidade) setCidade(cliente.cidade)
    api
      .get('/auth/me')
      .then((perfil) => {
        if (perfil.nome_completo) setNomeAdvogado(perfil.nome_completo)
        if (perfil.numero_oab) setOab(perfil.numero_oab)
        if (perfil.sigla_oab_tribunal) setEstadoOAB(perfil.sigla_oab_tribunal)
      })
      .catch(() => {})
  }, [cliente?.cidade])

  const templatesDeTipo = MODELOS[tipo]?.templates ?? []

  function handleTipoChange(novoTipo) {
    setTipo(novoTipo)
    setTemplateId(MODELOS[novoTipo].templates[0].id)
  }

  function handleGerar() {
    setGerando(true)
    try {
      gerarDocumento(templateId, cliente, { nomeAdvogado, oab, estadoOAB, cidade })
      toast.success('Documento gerado com sucesso!')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar documento: ' + err.message)
    } finally {
      setGerando(false)
    }
  }

  const labelTemplate = templatesDeTipo.find((t) => t.id === templateId)?.label ?? ''

  return (
    <>
      {/* backdrop */}
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={onClose} />

      {/* modal */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
        aria-modal="true"
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered modal-md">
          <div className="modal-content shadow-lg border-0">
            {/* header */}
            <div
              className="modal-header border-0 pb-0"
              style={{ background: 'linear-gradient(135deg,#2980b9 0%,#1a5276 100%)' }}
            >
              <div>
                <h5 className="modal-title text-white mb-0 fw-bold">
                  <i className="bi bi-file-earmark-pdf me-2" />
                  Gerar Documento Jurídico
                </h5>
                <p className="text-white-50 small mb-0 mt-1">
                  {cliente.nome_razao_social}
                  {cliente.cpf_cnpj && (
                    <span className="ms-2 opacity-75">— {cliente.cpf_cnpj}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Fechar"
              />
            </div>

            {/* body */}
            <div className="modal-body px-4 pt-4 pb-2">
              {/* Tipo de documento */}
              <div className="mb-3">
                <label className="form-label fw-semibold small text-muted text-uppercase ls-1">
                  Tipo de Documento
                </label>
                <div className="d-flex gap-2 flex-wrap">
                  {TIPOS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`btn btn-sm px-3 py-2 ${tipo === t.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => handleTipoChange(t.id)}
                    >
                      <i className={`bi ${t.icon} me-1`} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modelo */}
              <div className="mb-3">
                <label
                  className="form-label fw-semibold small text-muted text-uppercase"
                  htmlFor="selectModelo"
                >
                  Modelo
                </label>
                <select
                  id="selectModelo"
                  className="form-select form-select-sm"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  {templatesDeTipo.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <hr className="my-3" />

              {/* Dados do advogado */}
              <p className="small text-muted mb-2 fw-semibold">
                <i className="bi bi-person-badge me-1" />
                Dados do(a) Advogado(a){' '}
                <span className="fw-normal">(opcional — pode preencher a mão no impresso)</span>
              </p>

              <div className="mb-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Nome completo do(a) advogado(a)"
                  value={nomeAdvogado}
                  onChange={(e) => setNomeAdvogado(e.target.value)}
                />
              </div>

              <div className="row g-2 mb-3">
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Número da OAB"
                    value={oab}
                    onChange={(e) => setOab(e.target.value)}
                  />
                </div>
                <div className="col-4">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="UF (ex: SP)"
                    maxLength={2}
                    value={estadoOAB}
                    onChange={(e) => setEstadoOAB(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="mb-2">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Cidade para assinatura (ex: São Paulo)"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
              </div>

              {/* Preview info */}
              <div
                className="alert alert-info d-flex align-items-start gap-2 py-2 px-3 small mt-3 mb-0 border-0"
                style={{ background: '#eaf4fb' }}
              >
                <i className="bi bi-info-circle-fill text-info flex-shrink-0 mt-1" />
                <div>
                  Será gerado: <strong>{labelTemplate}</strong> para{' '}
                  <strong>{cliente.nome_razao_social}</strong>. O PDF será baixado automaticamente.
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="modal-footer border-0 px-4 pb-4 pt-2 gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onClose}
                disabled={gerando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary px-4"
                onClick={handleGerar}
                disabled={gerando}
              >
                {gerando ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-download me-1" />
                    Gerar e Baixar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default GerarDocumentoModal
