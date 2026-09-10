// Issue #300 (parte 3) — aba "OABs monitoradas" extraída da DjenPage
// (2.1k linhas). Componente de apresentação: estado e handlers ficam na
// página (que também os usa no fluxo de sync).
import React from 'react'

function AbaOabs({
  oabs,
  novaOab,
  setNovaOab,
  salvarOab,
  removerOab,
  salvandoOab,
  fmtData,
  loadingOabs,
  ultimasPublicacoesDjen,
  loadingUltimasPublicacoesDjen,
  carregarUltimasPublicacoesDjen,
  abrirDetalhePublicacao,
}) {
  return (
    <div className="row g-4" data-testid="aba-oabs">
      <div className="col-md-5">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white fw-semibold">
            <i className="bi bi-plus-circle me-2 text-success" />
            Cadastrar OAB para monitoramento
          </div>
          <div className="card-body">
            <form onSubmit={salvarOab}>
              <div className="mb-3">
                <label className="form-label small">
                  Número da OAB <span className="text-danger">*</span>
                </label>
                <input
                  className="form-control"
                  placeholder="Ex: 123456"
                  required
                  value={novaOab.numero_oab}
                  onChange={(e) => setNovaOab((o) => ({ ...o, numero_oab: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small">
                  UF da OAB <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  required
                  value={novaOab.uf_oab}
                  onChange={(e) => setNovaOab((o) => ({ ...o, uf_oab: e.target.value }))}
                >
                  <option value="">Selecione a UF</option>
                  {[
                    'AC',
                    'AL',
                    'AP',
                    'AM',
                    'BA',
                    'CE',
                    'DF',
                    'ES',
                    'GO',
                    'MA',
                    'MT',
                    'MS',
                    'MG',
                    'PA',
                    'PB',
                    'PR',
                    'PE',
                    'PI',
                    'RJ',
                    'RN',
                    'RS',
                    'RO',
                    'RR',
                    'SC',
                    'SP',
                    'SE',
                    'TO',
                  ].map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label small">
                  Tribunal (sigla){' '}
                  <span className="text-muted fw-normal">— opcional, ex: TRT9, TJPR, TST</span>
                </label>
                <input
                  className="form-control"
                  placeholder="Deixe em branco para usar a UF (ex: TJPR)"
                  value={novaOab.sigla_tribunal}
                  onChange={(e) =>
                    setNovaOab((o) => ({
                      ...o,
                      sigla_tribunal: e.target.value.toUpperCase(),
                    }))
                  }
                />
                <div className="form-text">Use quando a OAB atua em TRTs, TST, STJ, etc.</div>
              </div>
              <div className="mb-3">
                <label className="form-label small">Nome do advogado (opcional)</label>
                <input
                  className="form-control"
                  placeholder="Para identificação interna"
                  value={novaOab.nome_advogado}
                  onChange={(e) => setNovaOab((o) => ({ ...o, nome_advogado: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn btn-success w-100" disabled={salvandoOab}>
                {salvandoOab ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-2" />
                    Cadastrar OAB
                  </>
                )}
              </button>
            </form>
            <div className="alert alert-info mt-3 small mb-0">
              <i className="bi bi-info-circle me-1" />
              Após cadastrar, clique em <strong>"Sincronizar agora"</strong> para buscar publicações
              imediatamente. O job automático roda diariamente às 04:00 e considera os últimos 30
              dias.
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-7">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white fw-semibold">
            <i className="bi bi-list-check me-2" />
            OABs monitoradas
          </div>
          <div className="card-body p-0">
            {loadingOabs ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" />
              </div>
            ) : oabs.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-person-badge fs-2 d-block mb-2" />
                Nenhuma OAB cadastrada ainda.
              </div>
            ) : (
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="small">OAB</th>
                    <th className="small">UF</th>
                    <th className="small">Advogado</th>
                    <th className="small">Última sync</th>
                    <th className="small"></th>
                  </tr>
                </thead>
                <tbody>
                  {oabs.map((o) => (
                    <tr key={o.id}>
                      <td className="fw-semibold small">{o.numero_oab}</td>
                      <td className="small">
                        <span className="badge bg-secondary">{o.uf_oab || o.sigla_tribunal}</span>
                      </td>
                      <td className="small text-muted">{o.nome_advogado || '—'}</td>
                      <td className="small text-muted">
                        {o.ultima_sincronizacao
                          ? fmtData(o.ultima_sincronizacao, true)
                          : o.data_criacao
                            ? `Aguardando 1ª sync (cadastro em ${fmtData(o.data_criacao, true)})`
                            : 'Nunca'}
                      </td>
                      <td>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => removerOab(o.id)}
                          title="Remover"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card shadow-sm border-0 mt-3">
          <div className="card-header bg-white fw-semibold d-flex justify-content-between align-items-center">
            <span>
              <i className="bi bi-journal-text me-2" />
              Últimas publicações capturadas
            </span>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={carregarUltimasPublicacoesDjen}
            >
              <i className="bi bi-arrow-repeat me-1" />
              Atualizar
            </button>
          </div>
          <div className="card-body p-0">
            {loadingUltimasPublicacoesDjen ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" />
              </div>
            ) : ultimasPublicacoesDjen.length === 0 ? (
              <div className="p-3 text-muted small">
                Nenhuma publicação foi capturada ainda. Clique em <strong>Sincronizar agora</strong>{' '}
                para buscar no DJEN.
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {ultimasPublicacoesDjen.map((pub) => (
                  <button
                    key={pub.id}
                    type="button"
                    className="list-group-item list-group-item-action"
                    onClick={() => abrirDetalhePublicacao(pub)}
                  >
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="small" style={{ minWidth: 0 }}>
                        <div className="fw-semibold text-truncate">
                          {pub.numero_processo_mascara ||
                            pub.numero_processo ||
                            'Sem número de processo'}
                        </div>
                        <div className="text-muted text-truncate">
                          {pub.sigla_tribunal || '—'} · {pub.tipo_comunicacao || 'Comunicação'}
                        </div>
                      </div>
                      <span className={`badge ${pub.lida ? 'bg-secondary' : 'bg-primary'}`}>
                        {pub.lida ? 'Lida' : 'Nova'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AbaOabs
