import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { api } from '../api/client.js'
import { getPublicacao, baixarCertidao as baixarCertidaoApi } from '../api/djen.js'
import {
  ScaleIcon,
  NewspaperIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ArrowTopRightOnSquareIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'

const CONFIG_POR_TIPO = {
  movimentacao_cnj: {
    label: 'Movimentação CNJ',
    cor: '#2563eb',
    icone: ScaleIcon,
  },
  publicacao_djen: {
    label: 'Publicação DJEN',
    cor: '#dc2626',
    icone: NewspaperIcon,
  },
  documento: {
    label: 'Documento',
    cor: '#16a34a',
    icone: DocumentTextIcon,
  },
  tarefa: {
    label: 'Prazo / Tarefa',
    cor: '#f59e0b',
    icone: ClipboardDocumentListIcon,
  },
}

const formatarData = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * Bloco expansivel para itens publicacao_djen — mostra texto truncado por
 * default, e ao clicar em "Ver completo" busca o texto inteiro via API
 * (POST /djen/publicacoes/<id>) e expande inline. Botoes "Ver original"
 * (link externo do tribunal) e "Baixar certidão" (PDF blob) replicam o
 * comportamento do painel "Detalhe da Publicação" da DjenPage.
 */
function PublicacaoDjenItem({ item }) {
  const [expandido, setExpandido] = useState(false)
  const [textoCompleto, setTextoCompleto] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [baixando, setBaixando] = useState(false)

  const meta = item.metadata || {}
  const temMaisTexto = meta.tem_texto_completo === true
  const temLinkOriginal = !!meta.link
  const temCertidao = !!meta.hash_comunicacao

  const toggleExpandir = async () => {
    if (expandido) {
      setExpandido(false)
      return
    }
    setExpandido(true)
    if (textoCompleto !== null || !temMaisTexto) return
    setCarregando(true)
    try {
      const pub = await getPublicacao(item.id)
      setTextoCompleto(pub?.texto || item.descricao || '')
    } catch (e) {
      toast.error(e?.message || 'Falha ao carregar texto completo.')
      setExpandido(false)
    } finally {
      setCarregando(false)
    }
  }

  const baixarCertidao = async () => {
    if (!temCertidao) {
      toast.warning('Esta publicação não possui certidão disponível.')
      return
    }
    setBaixando(true)
    try {
      const blob = await baixarCertidaoApi(item.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certidao_djen_${item.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e?.message || 'Falha ao baixar certidão.')
    } finally {
      setBaixando(false)
    }
  }

  // Texto exibido: o que veio de "descricao" (truncado a 500), ou o completo se carregado
  const texto = expandido && textoCompleto !== null ? textoCompleto : item.descricao || ''

  return (
    <>
      {item.descricao && (
        <p
          className="text-muted small mb-1"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {carregando ? 'Carregando texto completo...' : texto}
          {!expandido && temMaisTexto && <span className="text-muted fst-italic"> (...)</span>}
        </p>
      )}

      {meta.sigla_tribunal && (
        <p className="text-muted mb-2 mt-1" style={{ fontSize: '0.72rem' }}>
          {meta.sigla_tribunal}
          {meta.nome_orgao ? ` · ${meta.nome_orgao}` : ''}
          {meta.lida === false ? ' · não lida' : ''}
        </p>
      )}

      <div className="d-flex flex-wrap gap-1 mt-1">
        {temMaisTexto && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={toggleExpandir}
            disabled={carregando}
            style={{ fontSize: '0.75rem' }}
          >
            {expandido ? (
              <>
                <ChevronUpIcon style={{ width: 14, height: 14 }} /> Recolher
              </>
            ) : (
              <>
                <ChevronDownIcon style={{ width: 14, height: 14 }} /> Ver completo
              </>
            )}
          </button>
        )}
        {temLinkOriginal && (
          <a
            href={meta.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-primary"
            style={{ fontSize: '0.75rem' }}
          >
            <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} /> Ver original
          </a>
        )}
        {temCertidao && (
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            onClick={baixarCertidao}
            disabled={baixando}
            style={{ fontSize: '0.75rem' }}
          >
            <DocumentArrowDownIcon style={{ width: 14, height: 14 }} />{' '}
            {baixando ? 'Baixando...' : 'Baixar certidão'}
          </button>
        )}
      </div>
    </>
  )
}

export default function CasoTimeline({ casoId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .get(`/casos/${casoId}/timeline`)
      .then((data) => {
        if (active) setItems(data?.items ?? [])
      })
      .catch((e) => {
        if (active) setError(e?.message || 'Falha ao carregar a linha do tempo.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [casoId])

  if (loading) {
    return <p className="text-muted text-center py-3 small mb-0">Carregando linha do tempo...</p>
  }

  if (error) {
    return <p className="text-danger text-center py-3 small mb-0">{error}</p>
  }

  if (items.length === 0) {
    return (
      <p className="text-muted fst-italic text-center py-3 small mb-0">
        Sem eventos registrados para este caso ainda. Movimentações CNJ, publicações DJEN,
        documentos anexados e tarefas aparecerão aqui em ordem cronológica.
      </p>
    )
  }

  return (
    <ul className="list-unstyled mb-0" style={{ position: 'relative' }}>
      {items.map((item, idx) => {
        const config = CONFIG_POR_TIPO[item.tipo] || {
          label: item.tipo,
          cor: '#6b7280',
          icone: DocumentTextIcon,
        }
        const Icone = config.icone
        const ehUltimo = idx === items.length - 1

        return (
          <li
            key={`${item.tipo}-${item.id}`}
            className="d-flex gap-3 pb-3"
            style={{ position: 'relative' }}
          >
            <div className="d-flex flex-column align-items-center" style={{ flexShrink: 0 }}>
              <span
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: `${config.cor}15`,
                  border: `2px solid ${config.cor}`,
                }}
                title={config.label}
              >
                <Icone style={{ width: 18, height: 18, color: config.cor }} />
              </span>
              {!ehUltimo && (
                <span
                  style={{
                    flex: 1,
                    width: 2,
                    backgroundColor: '#e5e7eb',
                    marginTop: 4,
                    minHeight: 20,
                  }}
                />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span
                  className="badge"
                  style={{
                    backgroundColor: `${config.cor}15`,
                    color: config.cor,
                    fontWeight: 600,
                    fontSize: '0.7rem',
                  }}
                >
                  {config.label}
                </span>
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {formatarData(item.data)}
                </small>
              </div>
              <h6 className="fw-semibold mb-1 text-dark" style={{ fontSize: '0.9rem' }}>
                {item.titulo}
              </h6>
              {item.tipo === 'publicacao_djen' ? (
                <PublicacaoDjenItem item={item} />
              ) : (
                <>
                  {item.descricao && (
                    <p
                      className="text-muted small mb-0"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.descricao}
                    </p>
                  )}
                  {item.tipo === 'tarefa' && item.metadata?.status && (
                    <p className="text-muted mb-0 mt-1" style={{ fontSize: '0.72rem' }}>
                      {item.metadata.tipo_tarefa} · {item.metadata.status} · prioridade{' '}
                      {item.metadata.prioridade}
                    </p>
                  )}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
