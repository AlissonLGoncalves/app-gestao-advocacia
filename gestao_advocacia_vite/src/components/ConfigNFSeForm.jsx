// src/components/ConfigNFSeForm.jsx
// Form de configuracao de NFS-e do tenant. Usado na aba NFS-e do SettingsPage.
// Backend: GET/PUT /v1/nfse/config.
import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getConfigNFSe, updateConfigNFSe } from '../api/nfse.js'

const REGIMES_TRIBUTARIOS = [
  'Simples Nacional',
  'Lucro Presumido',
  'Lucro Real',
  'MEI',
]

const GATEWAY_OPCOES = [
  {
    valor: 'mock',
    label: 'Mock (apenas teste — não emite nota de verdade)',
  },
  {
    valor: 'portal_nacional',
    label: 'Portal Nacional NFS-e (gov.br) — em breve',
    disabled: true,
  },
  { valor: 'focus_nfe', label: 'Focus NFe — em breve', disabled: true },
  { valor: 'plugnotas', label: 'PlugNotas — em breve', disabled: true },
]

function ConfigNFSeForm() {
  const [form, setForm] = useState({
    cnpj_emissor: '',
    inscricao_municipal: '',
    razao_social: '',
    municipio: '',
    uf: '',
    codigo_servico: '',
    regime_tributario: '',
    aliquota_iss: '',
    ambiente: 'sandbox',
    gateway_tipo: 'mock',
  })
  const [configurado, setConfigurado] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    getConfigNFSe()
      .then((data) => {
        if (cancelado) return
        setForm({
          cnpj_emissor: data.cnpj_emissor || '',
          inscricao_municipal: data.inscricao_municipal || '',
          razao_social: data.razao_social || '',
          municipio: data.municipio || '',
          uf: data.uf || '',
          codigo_servico: data.codigo_servico || '',
          regime_tributario: data.regime_tributario || '',
          aliquota_iss:
            data.aliquota_iss !== null && data.aliquota_iss !== undefined
              ? String(data.aliquota_iss)
              : '',
          ambiente: data.ambiente || 'sandbox',
          gateway_tipo: data.gateway_tipo || 'mock',
        })
        setConfigurado(!!data.configurado)
      })
      .catch((err) => {
        console.error('ConfigNFSeForm: erro ao carregar', err)
        toast.error('Erro ao carregar configuração de NFS-e.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const handleChange = (campo) => (e) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        aliquota_iss: form.aliquota_iss === '' ? null : parseFloat(form.aliquota_iss),
      }
      const data = await updateConfigNFSe(payload)
      setConfigurado(!!data.configurado)
      toast.success('Configuração de NFS-e salva.')
    } catch (err) {
      console.error('ConfigNFSeForm: erro ao salvar', err)
      toast.error(err?.message || 'Erro ao salvar configuração.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5 text-muted">Carregando configuração de NFS-e...</div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="alert alert-info py-2 small mb-3">
        <strong>⚠️ Modo Mock ativo:</strong> nesta versão, a emissão de NFS-e funciona apenas
        em modo simulado para você testar o fluxo. Nenhuma nota real é enviada à Receita ou
        prefeitura. A integração com o Portal Nacional NFS-e (gov.br) será habilitada quando
        o certificado A1 do escritório for cadastrado.
      </div>

      <h6 className="fw-bold text-dark mt-2 mb-3">Dados do Emissor</h6>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-bold">CNPJ do Emissor *</label>
          <input
            type="text"
            className="form-control"
            value={form.cnpj_emissor}
            onChange={handleChange('cnpj_emissor')}
            placeholder="00.000.000/0001-00"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-bold">Razão Social</label>
          <input
            type="text"
            className="form-control"
            value={form.razao_social}
            onChange={handleChange('razao_social')}
          />
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-bold">Inscrição Municipal</label>
          <input
            type="text"
            className="form-control"
            value={form.inscricao_municipal}
            onChange={handleChange('inscricao_municipal')}
            placeholder="Obrigatório no Portal Nacional"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-bold">Município</label>
          <input
            type="text"
            className="form-control"
            value={form.municipio}
            onChange={handleChange('municipio')}
            placeholder="Ex: São Paulo"
          />
        </div>
        <div className="col-md-2">
          <label className="form-label text-secondary small fw-bold">UF</label>
          <input
            type="text"
            className="form-control text-uppercase"
            maxLength={2}
            value={form.uf}
            onChange={handleChange('uf')}
            placeholder="SP"
          />
        </div>
      </div>

      <h6 className="fw-bold text-dark mt-4 mb-3">Dados do Serviço</h6>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-bold">Código de Serviço *</label>
          <input
            type="text"
            className="form-control"
            value={form.codigo_servico}
            onChange={handleChange('codigo_servico')}
            placeholder="17.06 — Consultoria"
          />
          <small className="text-muted">
            Comum p/ advocacia: 17.06 (consultoria) ou 17.14 (advocacia).
          </small>
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-bold">Regime Tributário</label>
          <select
            className="form-select"
            value={form.regime_tributario}
            onChange={handleChange('regime_tributario')}
          >
            <option value="">Selecione...</option>
            {REGIMES_TRIBUTARIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-bold">Alíquota ISS (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="form-control"
            value={form.aliquota_iss}
            onChange={handleChange('aliquota_iss')}
            placeholder="Ex: 5"
          />
        </div>
      </div>

      <h6 className="fw-bold text-dark mt-4 mb-3">Ambiente e Gateway</h6>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-bold">Ambiente</label>
          <select
            className="form-select"
            value={form.ambiente}
            onChange={handleChange('ambiente')}
          >
            <option value="sandbox">Sandbox (homologação)</option>
            <option value="producao">Produção</option>
          </select>
          <small className="text-muted">
            Sandbox emite notas de teste; Produção é pra valer.
          </small>
        </div>
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-bold">Gateway</label>
          <select
            className="form-select"
            value={form.gateway_tipo}
            onChange={handleChange('gateway_tipo')}
          >
            {GATEWAY_OPCOES.map((g) => (
              <option key={g.valor} value={g.valor} disabled={g.disabled}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-4">
        <span className={`badge ${configurado ? 'bg-success' : 'bg-warning text-dark'}`}>
          {configurado ? 'Configurado' : 'Configuração incompleta'}
        </span>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>
    </form>
  )
}

export default ConfigNFSeForm
