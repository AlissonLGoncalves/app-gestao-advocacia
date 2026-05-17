// src/components/ConfigNFSeForm.jsx
// Form de configuracao de NFS-e do tenant. Usado na aba NFS-e do SettingsPage.
// Backend: GET/PUT /v1/nfse/config.
import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getConfigNFSe, updateConfigNFSe } from '../api/nfse.js'
import UploadCertificadoA1 from './UploadCertificadoA1.jsx'

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
    label: 'Portal Nacional NFS-e (gov.br) — em construção',
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
    // Etapa 5.6.1: campos do Portal Nacional. So aparecem na UI quando
    // gateway_tipo === 'portal_nacional'.
    nfse_base_url_homologacao: '',
    nfse_base_url_producao: '',
    codigo_municipio_ibge: '',
    nfse_serie_atual: '1',
    nfse_numero_atual: '0',
  })
  const [configurado, setConfigurado] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Etapa 5.6.2: info do certificado A1. Nao vai no form (separado) porque
  // upload e feito por endpoint dedicado /nfse/certificado.
  const [certInfo, setCertInfo] = useState({
    tem_certificado: false,
    certificado_nome_titular: null,
    certificado_valido_ate: null,
  })

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
          nfse_base_url_homologacao: data.nfse_base_url_homologacao || '',
          nfse_base_url_producao: data.nfse_base_url_producao || '',
          codigo_municipio_ibge: data.codigo_municipio_ibge || '',
          nfse_serie_atual:
            data.nfse_serie_atual != null ? String(data.nfse_serie_atual) : '1',
          nfse_numero_atual:
            data.nfse_numero_atual != null ? String(data.nfse_numero_atual) : '0',
        })
        setConfigurado(!!data.configurado)
        setCertInfo({
          tem_certificado: !!data.tem_certificado,
          certificado_nome_titular: data.certificado_nome_titular || null,
          certificado_valido_ate: data.certificado_valido_ate || null,
        })
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
        nfse_serie_atual:
          form.nfse_serie_atual === '' ? null : parseInt(form.nfse_serie_atual, 10),
        nfse_numero_atual:
          form.nfse_numero_atual === '' ? null : parseInt(form.nfse_numero_atual, 10),
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

      {/* Etapa 5.6.1: bloco do Portal Nacional, so quando selecionado. */}
      {form.gateway_tipo === 'portal_nacional' && (
        <>
          <h6 className="fw-bold text-dark mt-4 mb-3">Portal Nacional NFS-e (gov.br)</h6>
          <div className="alert alert-info py-2 small mb-3">
            Para emitir notas pelo Portal Nacional, configure os dados abaixo e faça upload
            do certificado A1 (.pfx) do escritório. URLs default já apontam para o
            ambiente oficial — sobrescreva apenas se necessário.
          </div>

          {/* Upload do certificado A1 */}
          <UploadCertificadoA1 config={certInfo} onConfigChange={setCertInfo} />
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-bold">
                Código IBGE do Município
              </label>
              <input
                type="text"
                className="form-control"
                maxLength={7}
                value={form.codigo_municipio_ibge}
                onChange={handleChange('codigo_municipio_ibge')}
                placeholder="Ex: 3550308 (São Paulo)"
              />
              <small className="text-muted">7 dígitos. Consulte no site do IBGE.</small>
            </div>
            <div className="col-md-3">
              <label className="form-label text-secondary small fw-bold">Série da DPS</label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={form.nfse_serie_atual}
                onChange={handleChange('nfse_serie_atual')}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label text-secondary small fw-bold">Último número emitido</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={form.nfse_numero_atual}
                onChange={handleChange('nfse_numero_atual')}
              />
              <small className="text-muted">Próxima DPS = este +1.</small>
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-bold">
                URL base — Homologação
              </label>
              <input
                type="text"
                className="form-control"
                value={form.nfse_base_url_homologacao}
                onChange={handleChange('nfse_base_url_homologacao')}
                placeholder="https://sefin.producaorestrita.nfse.gov.br/SefinNacional"
              />
              <small className="text-muted">Default oficial. Vazio = usa o default.</small>
            </div>
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-bold">
                URL base — Produção
              </label>
              <input
                type="text"
                className="form-control"
                value={form.nfse_base_url_producao}
                onChange={handleChange('nfse_base_url_producao')}
                placeholder="https://sefin.nfse.gov.br/SefinNacional"
              />
              <small className="text-muted">Default oficial. Vazio = usa o default.</small>
            </div>
          </div>
        </>
      )}

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
