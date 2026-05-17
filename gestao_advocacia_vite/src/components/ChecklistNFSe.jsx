// src/components/ChecklistNFSe.jsx
//
// Checklist visual do que falta pro tenant emitir NFS-e. Resolve o
// problema 3 do diagnostico UX: o usuario nao sabe que precisa
// completar varias coisas antes de emitir, e o empty state da lista
// de emissoes nao ajudava (so dizia "nenhuma emissao").
//
// Renderizado em 2 lugares:
//  1. EmissoesNFSeList — quando lista esta vazia, mostra o que falta.
//  2. ConfigNFSeForm — no topo, como indicador de progresso (1/4, 2/4...).
//
// Props:
//   variant: "completo" (com titulos, descricoes, acoes) — usado no
//            empty state da aba Emissoes.
//            "compacto" — barra de progresso fina pro topo do form.
//   onChangeTab: callback opcional pra trocar pra aba Configuracao.
import React, { useEffect, useState } from 'react'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/solid'
import { getConfigNFSe } from '../api/nfse.js'

function ChecklistNFSe({ variant = 'completo', onChangeTab }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    getConfigNFSe()
      .then((data) => {
        if (!cancelado) setConfig(data)
      })
      .catch((err) => {
        console.warn('ChecklistNFSe: erro ao carregar config', err)
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  if (loading) {
    return (
      <div className="text-center text-muted py-4 small">
        <span className="spinner-border spinner-border-sm me-2" /> Verificando
        configuração...
      </div>
    )
  }

  const ehMock = (config?.gateway_tipo || 'mock') === 'mock'

  // Cada item: {key, label, descricao, feito, acaoLabel?, acaoOnClick?}
  const itens = [
    {
      key: 'tipo_documento',
      label: 'Tipo de pessoa do emissor (PF ou PJ) + documento',
      descricao:
        'CPF para advogado autônomo, CNPJ para escritório. Define qual cert você precisa.',
      feito: Boolean(
        config?.tipo_pessoa_emissor && config?.documento_emissor
      ),
    },
    {
      key: 'codigo_servico',
      label: 'Código de serviço municipal',
      descricao:
        'Comum para advocacia: 17.06 (consultoria) ou 17.14 (advocacia).',
      feito: Boolean(config?.codigo_servico),
    },
    {
      key: 'codigo_ibge',
      label: 'Código IBGE do município (Portal Nacional)',
      descricao:
        'Identifica em qual prefeitura a NFS-e é registrada. Consulte no site do IBGE.',
      feito: Boolean(config?.codigo_municipio_ibge),
      so_portal_nacional: true,
    },
    {
      key: 'certificado',
      label: 'Certificado A1 ICP-Brasil (e-CPF ou e-CNPJ)',
      descricao:
        'Exigido pelo Portal Nacional para assinatura digital da DPS. Custa ~R$ 150-250/ano.',
      feito: Boolean(config?.tem_certificado),
      so_portal_nacional: true,
    },
  ]

  // Em modo mock, esconde itens que não se aplicam (cert, IBGE).
  const itensVisiveis = itens.filter((i) => !i.so_portal_nacional || !ehMock)
  const feitos = itensVisiveis.filter((i) => i.feito).length
  const total = itensVisiveis.length
  const tudoFeito = feitos === total

  // === Variante COMPACTA — barra de progresso pro topo do form ===
  if (variant === 'compacto') {
    const pct = (feitos / total) * 100
    return (
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <span className="small text-muted fw-bold">
            Configuração da NFS-e {ehMock && '(modo mock)'}
          </span>
          <span className={`small fw-bold ${tudoFeito ? 'text-success' : 'text-muted'}`}>
            {feitos}/{total} {tudoFeito ? '✓ pronto' : 'concluídos'}
          </span>
        </div>
        <div
          className="progress"
          style={{ height: 6, borderRadius: 3 }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={tudoFeito ? 'progress-bar bg-success' : 'progress-bar bg-info'}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  // === Variante COMPLETA — empty state guiado na aba Emissões ===
  return (
    <div className="py-3">
      <div className="text-center mb-4">
        <h5 className="fw-bold text-dark mb-1">Nenhuma NFS-e emitida ainda</h5>
        <p className="text-muted small mb-0">
          {tudoFeito
            ? 'Tudo configurado. Para emitir, vá ao histórico de pagamentos recebidos e clique em "Emitir NFS-e" em algum recebimento pago.'
            : `Antes da primeira emissão, complete os ${total - feitos} item(ns) abaixo:`}
        </p>
      </div>

      <div className="row justify-content-center">
        <div className="col-md-10 col-lg-8">
          <ul className="list-group list-group-flush">
            {itensVisiveis.map((item) => (
              <li
                key={item.key}
                className="list-group-item d-flex align-items-start py-3"
                style={{ background: 'transparent' }}
              >
                <div className="me-3 flex-shrink-0">
                  {item.feito ? (
                    <CheckCircleIcon
                      style={{ width: 28, height: 28, color: '#198754' }}
                    />
                  ) : (
                    <ExclamationCircleIcon
                      style={{ width: 28, height: 28, color: '#d97706' }}
                    />
                  )}
                </div>
                <div className="flex-grow-1">
                  <div
                    className={`fw-semibold ${item.feito ? 'text-success' : 'text-dark'}`}
                  >
                    {item.label}
                  </div>
                  <div className="small text-muted">{item.descricao}</div>
                </div>
              </li>
            ))}
          </ul>

          {!tudoFeito && (
            <div className="text-center mt-4">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onChangeTab?.('configuracao')}
              >
                Ir para Configuração
                <ArrowRightIcon style={{ width: 14, height: 14 }} className="ms-1" />
              </button>
            </div>
          )}

          {tudoFeito && (
            <div className="alert alert-success small mt-4 mb-0">
              ✅ Tudo pronto. Vá em <strong>Recebimentos → Histórico</strong> e
              clique em <strong>"Emitir NFS-e"</strong> em algum pagamento recebido.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChecklistNFSe
