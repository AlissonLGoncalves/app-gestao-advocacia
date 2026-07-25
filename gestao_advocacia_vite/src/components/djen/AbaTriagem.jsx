// Issue #300 (parte 3b) — aba "Triagem" extraída da DjenPage (1.8k linhas).
// Mesma lógica/JSX de antes, agora isolada; estado e handlers de vínculo
// continuam na página (compartilhados com a aba publicações) e entram
// como props explícitas.
import React from 'react'
import { useNavigate } from 'react-router'
import {
  decodeHtmlEntities,
  sanitizarHtmlTribunal,
  extrairTextoPlano,
} from '../../utils/htmlTribunal.js'

const TRIAGEM_LIMIT = 20

function AbaTriagem(props) {
  const navigate = useNavigate()
  const {
    triagemItems,
    triagemTotal,
    triagemOffset,
    setTriagemOffset,
    triagemBusca,
    setTriagemBusca,
    triagemExpandido,
    setTriagemExpandido,
    triagemSelecionadas,
    toggleSelecaoTriagem,
    selecionarTodasTriagem,
    limparSelecaoTriagem,
    loadingTriagem,
    carregarTriagem,
    processarLoteTriagem,
    processandoLoteTriagem,
    autoVincularPendentes,
    autoVinculandoPendentes,
    criarClienteECasoTriagem,
    ignorarTriagem,
    mesclarTriagemCaso,
    marcarLida,
  } = props
  // filtro local por busca de texto
  const triagemFiltrados = triagemBusca.trim()
    ? triagemItems.filter((item) => {
        const pub = item.publicacao
        const analise = item.analise || {}
        const textoNormalizado = extrairTextoPlano(
          sanitizarHtmlTribunal(decodeHtmlEntities(pub.texto || ''))
        )
        const haystack = [
          pub.numero_processo,
          pub.numero_processo_mascara,
          pub.nome_orgao,
          pub.sigla_tribunal,
          analise.tribunal,
          textoNormalizado,
          ...(analise.partes_autoras || []),
          ...(analise.partes_reus || []),
          ...(analise.representantes || []),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(triagemBusca.toLowerCase())
      })
    : triagemItems

  const badgeConfianca = (v) => {
    const pct = Math.round((v || 0) * 100)
    const cls = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning text-dark' : 'bg-danger'
    return (
      <span className={`badge ${cls} ms-2`} style={{ fontSize: '0.7rem' }}>
        {pct}% confiança
      </span>
    )
  }

  const toggleExpandido = (id) => setTriagemExpandido((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="row g-3">
      {/* Barra de controles */}
      <div className="col-12">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge bg-secondary fs-6 px-3 py-2">{triagemTotal} pendente(s)</span>
            <input
              type="search"
              className="form-control form-control-sm"
              style={{ width: 260 }}
              placeholder="Buscar por processo, parte, órgão..."
              value={triagemBusca}
              onChange={(e) => setTriagemBusca(e.target.value)}
            />
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button
              className="btn btn-primary btn-sm"
              title="Wizard guiado por IA para cadastrar clientes/casos das pendentes"
              onClick={() => navigate('/djen/triagem-assistida')}
              disabled={triagemTotal === 0}
            >
              <i className="bi bi-stars me-1" />
              Triagem assistida por IA
            </button>
            <button
              className="btn btn-warning btn-sm"
              title="Reprocessa as pendentes e vincula automaticamente quando o número do processo, CPF/CNPJ ou nome do cliente já estiver cadastrado"
              disabled={autoVinculandoPendentes || triagemTotal === 0}
              onClick={autoVincularPendentes}
            >
              {autoVinculandoPendentes ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  />
                  Vinculando...
                </>
              ) : (
                <>
                  <i className="bi bi-magic me-1" />
                  Vincular automaticamente ({triagemTotal})
                </>
              )}
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={selecionarTodasTriagem}>
              <i className="bi bi-check2-all me-1" />
              Selecionar todas
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={limparSelecaoTriagem}>
              Limpar seleção
            </button>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                setTriagemOffset(0)
                carregarTriagem(0)
              }}
            >
              <i className="bi bi-arrow-repeat me-1" />
              Atualizar
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={processarLoteTriagem}
              disabled={processandoLoteTriagem || triagemSelecionadas.length === 0}
            >
              <i className="bi bi-robot me-1" />
              {processandoLoteTriagem
                ? 'Processando...'
                : `Processar selecionadas (${triagemSelecionadas.length})`}
            </button>
          </div>
        </div>
      </div>

      {loadingTriagem ? (
        <div className="col-12 text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : triagemFiltrados.length === 0 ? (
        <div className="col-12">
          <div className="alert alert-success mb-0">
            {triagemBusca
              ? 'Nenhuma publicação encontrada para esse filtro.'
              : 'Nenhuma pendência na fila de triagem. As publicações novas aparecerão aqui após a sincronização.'}
          </div>
        </div>
      ) : (
        <>
          {triagemFiltrados.map((item) => {
            const pub = item.publicacao
            const analise = item.analise || {}
            const sugestoes = item.sugestoes_vinculo || item.sugestoes || {}
            const tribunal = analise.tribunal || pub.sigla_tribunal || ''
            const dataFormatada = pub.data_disponibilizacao
              ? new Date(pub.data_disponibilizacao).toLocaleDateString('pt-BR')
              : null
            const textoOriginal = (pub.texto || '').trim()
            const textoDecodificado = decodeHtmlEntities(textoOriginal)
            const textoHtmlSeguro = sanitizarHtmlTribunal(textoDecodificado)
            const textoPreview = extrairTextoPlano(textoHtmlSeguro)
            const expandido = !!triagemExpandido[pub.id]
            const temPartes =
              (analise.partes_autoras || []).length > 0 || (analise.partes_reus || []).length > 0
            const temRepresentantes = (analise.representantes || []).length > 0
            const temDocumentos = (analise.documentos_extraidos || []).length > 0
            const temSugestoesCasos = (sugestoes.casos || []).length > 0
            const temSugestoesClientes = (sugestoes.clientes || []).length > 0
            const confianca = analise.confianca || 0
            const borderColor =
              confianca >= 0.7 ? '#198754' : confianca >= 0.4 ? '#ffc107' : '#dc3545'

            return (
              <div className="col-12" key={pub.id}>
                <div className="card shadow-sm" style={{ borderLeft: `4px solid ${borderColor}` }}>
                  {/* Cabeçalho do card */}
                  <div className="card-header bg-white py-2 px-3 d-flex align-items-center gap-2 flex-wrap">
                    <input
                      className="form-check-input mt-0 flex-shrink-0"
                      type="checkbox"
                      title="Selecionar para lote"
                      id={`triagem-check-${pub.id}`}
                      checked={triagemSelecionadas.includes(pub.id)}
                      onChange={() => toggleSelecaoTriagem(pub.id)}
                    />
                    <div className="fw-semibold me-1" style={{ fontSize: '0.95rem' }}>
                      {pub.numero_processo_mascara || pub.numero_processo || (
                        <span className="text-muted fst-italic">Sem número de processo</span>
                      )}
                    </div>
                    {tribunal && (
                      <span
                        className="badge bg-primary bg-opacity-10 text-primary border border-primary"
                        style={{ fontSize: '0.72rem' }}
                      >
                        {tribunal}
                      </span>
                    )}
                    {pub.tipo_comunicacao && (
                      <span
                        className="badge bg-light text-secondary border"
                        style={{ fontSize: '0.72rem' }}
                      >
                        {pub.tipo_comunicacao}
                      </span>
                    )}
                    {dataFormatada && (
                      <span className="text-muted ms-auto small">
                        <i className="bi bi-calendar3 me-1" />
                        {dataFormatada}
                      </span>
                    )}
                    {badgeConfianca(confianca)}
                    {analise.revisao_manual_recomendada && (
                      <span
                        className="badge bg-warning text-dark ms-1"
                        style={{ fontSize: '0.7rem' }}
                      >
                        <i className="bi bi-exclamation-triangle me-1" />
                        Revisão manual
                      </span>
                    )}
                  </div>

                  <div className="card-body py-2 px-3">
                    {/* Órgão */}
                    {pub.nome_orgao && (
                      <div className="small text-muted mb-2">
                        <i className="bi bi-building me-1" />
                        {pub.nome_orgao}
                      </div>
                    )}

                    {/* Preview do texto */}
                    {textoPreview && (
                      <div className="mb-3">
                        {expandido ? (
                          <div
                            className="small text-secondary p-2 rounded"
                            style={{
                              background: '#f8f9fa',
                              borderLeft: '3px solid #dee2e6',
                              wordBreak: 'break-word',
                              overflowX: 'auto',
                            }}
                            dangerouslySetInnerHTML={{ __html: textoHtmlSeguro }}
                          />
                        ) : (
                          <div
                            className="small text-secondary p-2 rounded"
                            style={{
                              background: '#f8f9fa',
                              borderLeft: '3px solid #dee2e6',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {textoPreview.slice(0, 320) + (textoPreview.length > 320 ? '…' : '')}
                          </div>
                        )}
                        {textoPreview.length > 320 && (
                          <button
                            className="btn btn-link btn-sm p-0 mt-1"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => toggleExpandido(pub.id)}
                          >
                            {expandido ? 'Ver menos ▲' : 'Ver texto completo ▼'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Partes + Representantes */}
                    {(temPartes || temRepresentantes) && (
                      <div className="row g-2 small mb-2">
                        {(analise.partes_autoras || []).length > 0 && (
                          <div className="col-md-4">
                            <div className="text-muted fw-semibold mb-1">
                              <i className="bi bi-person me-1" />
                              Polo ativo
                            </div>
                            {analise.partes_autoras.map((p, idx) => (
                              <div key={`a-${idx}`} className="text-truncate" title={p}>
                                {p}
                              </div>
                            ))}
                          </div>
                        )}
                        {(analise.partes_reus || []).length > 0 && (
                          <div className="col-md-4">
                            <div className="text-muted fw-semibold mb-1">
                              <i className="bi bi-person-x me-1" />
                              Polo passivo
                            </div>
                            {analise.partes_reus.map((p, idx) => (
                              <div key={`r-${idx}`} className="text-truncate" title={p}>
                                {p}
                              </div>
                            ))}
                          </div>
                        )}
                        {temRepresentantes && (
                          <div className="col-md-4">
                            <div className="text-muted fw-semibold mb-1">
                              <i className="bi bi-briefcase me-1" />
                              Advogado(s)
                            </div>
                            {analise.representantes.map((p, idx) => (
                              <div key={`rep-${idx}`} className="text-truncate" title={p}>
                                {p}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Documentos + Sugestões */}
                    {(temDocumentos || temSugestoesCasos || temSugestoesClientes) && (
                      <div className="row g-2 small mb-2">
                        {temDocumentos && (
                          <div className="col-md-4">
                            <div className="text-muted fw-semibold mb-1">
                              <i className="bi bi-file-earmark-text me-1" />
                              CPF/CNPJ
                            </div>
                            {analise.documentos_extraidos.map((d, idx) => (
                              <div key={`doc-${idx}`}>{d}</div>
                            ))}
                          </div>
                        )}
                        {temSugestoesCasos && (
                          <div className="col-md-4">
                            <div className="text-muted fw-semibold mb-1">
                              <i className="bi bi-folder2-open me-1" />
                              Casos sugeridos
                            </div>
                            <div className="d-flex flex-wrap gap-1">
                              {sugestoes.casos.slice(0, 3).map((s) => (
                                <button
                                  key={`caso-${s.id}`}
                                  className="btn btn-outline-primary btn-sm py-0 px-2"
                                  style={{ fontSize: '0.72rem' }}
                                  onClick={() => mesclarTriagemCaso(pub, s.id)}
                                  title={`Mesclar com caso #${s.id}`}
                                >
                                  #{s.id} {s.numero_processo || s.titulo} ·{' '}
                                  {Math.round((s.score || 0) * 100)}%
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {temSugestoesClientes && (
                          <div className="col-md-4">
                            <div className="text-muted fw-semibold mb-1">
                              <i className="bi bi-people me-1" />
                              Clientes sugeridos
                            </div>
                            <div className="d-flex flex-wrap gap-1">
                              {sugestoes.clientes.slice(0, 3).map((s) => (
                                <span
                                  key={`cli-${s.id}`}
                                  className="badge bg-light text-dark border"
                                  style={{ fontSize: '0.72rem' }}
                                >
                                  {s.nome_razao_social} · {Math.round((s.score || 0) * 100)}%
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ações */}
                    <div className="d-flex gap-2 flex-wrap mt-2 pt-2 border-top">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => criarClienteECasoTriagem(pub)}
                      >
                        <i className="bi bi-plus-circle me-1" />
                        Criar cliente e caso
                      </button>
                      {temSugestoesCasos && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => mesclarTriagemCaso(pub, sugestoes.casos[0].id)}
                        >
                          <i className="bi bi-arrow-left-right me-1" />
                          Mesclar com #{sugestoes.casos[0].id}
                        </button>
                      )}
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => marcarLida(pub, true)}
                      >
                        <i className="bi bi-check2 me-1" />
                        Marcar lida
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm ms-auto"
                        onClick={() => ignorarTriagem(pub)}
                      >
                        <i className="bi bi-x-circle me-1" />
                        Ignorar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Paginação */}
          {triagemTotal > TRIAGEM_LIMIT && !triagemBusca && (
            <div className="col-12 d-flex justify-content-between align-items-center mt-1">
              <small className="text-muted">
                Exibindo {triagemOffset + 1}–{Math.min(triagemOffset + TRIAGEM_LIMIT, triagemTotal)}{' '}
                de {triagemTotal}
              </small>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={triagemOffset === 0}
                  onClick={() => {
                    const o = Math.max(0, triagemOffset - TRIAGEM_LIMIT)
                    setTriagemOffset(o)
                    carregarTriagem(o)
                  }}
                >
                  <i className="bi bi-chevron-left" /> Anterior
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={triagemOffset + TRIAGEM_LIMIT >= triagemTotal}
                  onClick={() => {
                    const o = triagemOffset + TRIAGEM_LIMIT
                    setTriagemOffset(o)
                    carregarTriagem(o)
                  }}
                >
                  Próxima <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AbaTriagem
