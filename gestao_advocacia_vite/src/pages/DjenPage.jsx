import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config.js';
import { toast } from 'react-toastify';

export default function DjenPage() {
  const [aba, setAba] = useState('publicacoes');
  const [publicacoes, setPublicacoes] = useState([]);
  const [total, setTotal] = useState(0);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loadingPubs, setLoadingPubs] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filtros
  const [filtros, setFiltros] = useState({
    lida: '', sigla_tribunal: '', numero_processo: '',
    data_inicio: '', data_fim: '', origem: '',
  });
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // OABs monitoradas
  const [oabs, setOabs] = useState([]);
  const [loadingOabs, setLoadingOabs] = useState(false);
  const [novaOab, setNovaOab] = useState({ numero_oab: '', uf_oab: '', nome_advogado: '' });
  const [salvandoOab, setSalvandoOab] = useState(false);

  // Detalhe
  const [pubSelecionada, setPubSelecionada] = useState(null);
  const [casos, setCasos] = useState([]);

  const token = () => localStorage.getItem('token');

  // ── Carregar publicações ────────────────────────────────────────────────────
  const carregarPublicacoes = useCallback(async (offsetParam = 0) => {
    setLoadingPubs(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', LIMIT);
      params.set('offset', offsetParam);
      if (filtros.lida !== '') params.set('lida', filtros.lida);
      if (filtros.sigla_tribunal) params.set('sigla_tribunal', filtros.sigla_tribunal);
      if (filtros.numero_processo) params.set('numero_processo', filtros.numero_processo);
      if (filtros.data_inicio) params.set('data_inicio', filtros.data_inicio);
      if (filtros.data_fim) params.set('data_fim', filtros.data_fim);
      if (filtros.origem) params.set('origem', filtros.origem);

      const res = await fetch(`${API_URL}/djen/publicacoes?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPublicacoes(data.items || []);
        setTotal(data.total || 0);
        setNaoLidas(data.nao_lidas || 0);
      } else {
        toast.error('Erro ao carregar publicações DJEN.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setLoadingPubs(false);
    }
  }, [filtros]);

  // ── Carregar OABs ───────────────────────────────────────────────────────────
  const carregarOabs = useCallback(async () => {
    setLoadingOabs(true);
    try {
      const res = await fetch(`${API_URL}/djen/oabs`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setOabs(await res.json());
    } catch { /* silencioso */ }
    finally { setLoadingOabs(false); }
  }, []);

  // ── Carregar casos para vínculo ─────────────────────────────────────────────
  const carregarCasos = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/casos`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setCasos(await res.json());
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    carregarPublicacoes(0);
    carregarOabs();
    carregarCasos();
  }, [carregarPublicacoes, carregarOabs, carregarCasos]);

  // ── Sincronizar ─────────────────────────────────────────────────────────────
  const sincronizar = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/djen/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: 1 }),
      });
      if (res.ok) {
        toast.success('Sincronização iniciada! Aguarde alguns instantes e recarregue.');
      } else {
        const err = await res.json();
        toast.error(err.message || 'Erro ao sincronizar.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Marcar publicação como lida ─────────────────────────────────────────────
  const marcarLida = async (pub, lida) => {
    try {
      const res = await fetch(`${API_URL}/djen/publicacoes/${pub.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lida }),
      });
      if (res.ok) {
        setPublicacoes(prev => prev.map(p => p.id === pub.id ? { ...p, lida } : p));
        setNaoLidas(prev => lida ? prev - 1 : prev + 1);
        if (pubSelecionada?.id === pub.id) setPubSelecionada({ ...pubSelecionada, lida });
      }
    } catch {
      toast.error('Erro ao atualizar.');
    }
  };

  // ── Vincular caso ───────────────────────────────────────────────────────────
  const vincularCaso = async (pub, caso_id) => {
    try {
      const res = await fetch(`${API_URL}/djen/publicacoes/${pub.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caso_id: caso_id || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPublicacoes(prev => prev.map(p => p.id === pub.id ? updated : p));
        if (pubSelecionada?.id === pub.id) setPubSelecionada(updated);
        toast.success('Vínculo atualizado.');
      }
    } catch {
      toast.error('Erro ao vincular.');
    }
  };

  // ── Salvar OAB ──────────────────────────────────────────────────────────────
  const salvarOab = async (e) => {
    e.preventDefault();
    setSalvandoOab(true);
    try {
      const res = await fetch(`${API_URL}/djen/oabs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(novaOab),
      });
      if (res.ok) {
        toast.success('OAB cadastrada para monitoramento!');
        setNovaOab({ numero_oab: '', uf_oab: '', nome_advogado: '' });
        carregarOabs();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Erro ao cadastrar OAB.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setSalvandoOab(false);
    }
  };

  // ── Remover OAB ─────────────────────────────────────────────────────────────
  const removerOab = async (id) => {
    if (!window.confirm('Remover esta OAB do monitoramento?')) return;
    try {
      const res = await fetch(`${API_URL}/djen/oabs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.status === 204) {
        toast.success('OAB removida.');
        setOabs(prev => prev.filter(o => o.id !== id));
      }
    } catch {
      toast.error('Erro ao remover.');
    }
  };

  // ── Baixar certidão ─────────────────────────────────────────────────────────
  const baixarCertidao = async (pub) => {
    if (!pub.hash_comunicacao) {
      toast.warning('Esta publicação não possui certidão disponível.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/djen/publicacoes/${pub.id}/certidao`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certidao_djen_${pub.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error('Erro ao baixar certidão.');
      }
    } catch {
      toast.error('Erro de conexão.');
    }
  };

  const aplicarFiltros = (e) => {
    e.preventDefault();
    setOffset(0);
    carregarPublicacoes(0);
  };

  const limparFiltros = () => {
    setFiltros({ lida: '', sigla_tribunal: '', numero_processo: '', data_inicio: '', data_fim: '', origem: '' });
    setOffset(0);
    setTimeout(() => carregarPublicacoes(0), 50);
  };

  const fmtData = (str) => {
    if (!str) return '—';
    const d = new Date(str + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="container-fluid py-4">
      {/* Cabeçalho */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0 fw-bold">
            <i className="bi bi-newspaper me-2 text-primary"></i>
            DJEN — Diário de Justiça Eletrônico
          </h2>
          <small className="text-muted">ComunicaAPI / CNJ — Resolução nº 455/2022</small>
        </div>
        <div className="d-flex align-items-center gap-3">
          {naoLidas > 0 && (
            <span className="badge bg-danger fs-6">
              {naoLidas} não lida{naoLidas !== 1 ? 's' : ''}
            </span>
          )}
          <button className="btn btn-primary" onClick={sincronizar} disabled={syncing}>
            {syncing
              ? <><span className="spinner-border spinner-border-sm me-2" />Sincronizando…</>
              : <><i className="bi bi-arrow-clockwise me-2" />Sincronizar agora</>}
          </button>
        </div>
      </div>

      {/* Abas */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${aba === 'publicacoes' ? 'active fw-semibold' : ''}`}
            onClick={() => setAba('publicacoes')}
          >
            <i className="bi bi-list-ul me-1" />
            Publicações
            {naoLidas > 0 && <span className="badge bg-danger ms-2">{naoLidas}</span>}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${aba === 'oabs' ? 'active fw-semibold' : ''}`}
            onClick={() => { setAba('oabs'); carregarOabs(); }}
          >
            <i className="bi bi-person-badge me-1" />
            Monitorar OABs
          </button>
        </li>
      </ul>

      {/* ── Aba Publicações ────────────────────────────────────────────────── */}
      {aba === 'publicacoes' && (
        <div className="row g-4">
          {/* Filtros */}
          <div className="col-12">
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <form onSubmit={aplicarFiltros} className="row g-2 align-items-end">
                  <div className="col-md-2">
                    <label className="form-label small mb-1">Leitura</label>
                    <select className="form-select form-select-sm" value={filtros.lida}
                      onChange={e => setFiltros(f => ({ ...f, lida: e.target.value }))}>
                      <option value="">Todas</option>
                      <option value="false">Não lidas</option>
                      <option value="true">Lidas</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-1">Tribunal</label>
                    <input className="form-control form-control-sm" placeholder="ex: TJPR"
                      value={filtros.sigla_tribunal}
                      onChange={e => setFiltros(f => ({ ...f, sigla_tribunal: e.target.value }))} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1">Nº processo</label>
                    <input className="form-control form-control-sm" placeholder="Parcial ou completo"
                      value={filtros.numero_processo}
                      onChange={e => setFiltros(f => ({ ...f, numero_processo: e.target.value }))} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-1">Data início</label>
                    <input type="date" className="form-control form-control-sm"
                      value={filtros.data_inicio}
                      onChange={e => setFiltros(f => ({ ...f, data_inicio: e.target.value }))} />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small mb-1">Data fim</label>
                    <input type="date" className="form-control form-control-sm"
                      value={filtros.data_fim}
                      onChange={e => setFiltros(f => ({ ...f, data_fim: e.target.value }))} />
                  </div>
                  <div className="col-md-1 d-flex gap-1">
                    <button type="submit" className="btn btn-primary btn-sm w-100">
                      <i className="bi bi-search" />
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm w-100"
                      onClick={limparFiltros} title="Limpar filtros">
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Lista + Detalhe */}
          <div className={pubSelecionada ? 'col-md-6' : 'col-12'}>
            {loadingPubs ? (
              <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
            ) : publicacoes.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox fs-1 d-block mb-2" />
                Nenhuma publicação encontrada.<br />
                <small>Cadastre suas OABs e clique em "Sincronizar agora".</small>
              </div>
            ) : (
              <>
                <div className="text-muted small mb-2">
                  {total} publicação(ões) · página {Math.floor(offset / LIMIT) + 1}
                </div>
                {publicacoes.map(pub => (
                  <div
                    key={pub.id}
                    className={`card mb-2 border-0 shadow-sm cursor-pointer ${!pub.lida ? 'border-start border-4 border-primary' : ''} ${pubSelecionada?.id === pub.id ? 'bg-light' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setPubSelecionada(pub); if (!pub.lida) marcarLida(pub, true); }}
                  >
                    <div className="card-body py-2 px-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            {!pub.lida && <span className="badge bg-primary">Nova</span>}
                            <span className="badge bg-secondary">{pub.sigla_tribunal || '—'}</span>
                            <span className="badge bg-light text-dark border">{pub.tipo_comunicacao || 'Comunicação'}</span>
                            {pub.origem_busca === 'oab' && <span className="badge bg-info text-dark">via OAB</span>}
                            {pub.origem_busca === 'processo' && <span className="badge bg-warning text-dark">via Processo</span>}
                          </div>
                          <div className="fw-semibold text-truncate small">
                            {pub.numero_processo_mascara || pub.numero_processo || 'Sem nº processo'}
                          </div>
                          <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                            {pub.nome_orgao} · {fmtData(pub.data_disponibilizacao)}
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${pub.lida ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                          title={pub.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                          onClick={e => { e.stopPropagation(); marcarLida(pub, !pub.lida); }}
                        >
                          <i className={`bi ${pub.lida ? 'bi-envelope' : 'bi-envelope-open'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Paginação */}
                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-outline-secondary btn-sm" disabled={offset === 0}
                    onClick={() => { const o = Math.max(0, offset - LIMIT); setOffset(o); carregarPublicacoes(o); }}>
                    ← Anterior
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" disabled={offset + LIMIT >= total}
                    onClick={() => { const o = offset + LIMIT; setOffset(o); carregarPublicacoes(o); }}>
                    Próxima →
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Painel de detalhe */}
          {pubSelecionada && (
            <div className="col-md-6">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                  <strong className="small">Detalhe da Publicação</strong>
                  <button className="btn-close btn-sm" onClick={() => setPubSelecionada(null)} />
                </div>
                <div className="card-body overflow-auto" style={{ maxHeight: '75vh' }}>
                  <table className="table table-sm table-borderless mb-3">
                    <tbody>
                      <tr><td className="text-muted small fw-semibold" style={{ width: 130 }}>Tribunal</td>
                        <td className="small">{pubSelecionada.sigla_tribunal} — {pubSelecionada.nome_orgao}</td></tr>
                      <tr><td className="text-muted small fw-semibold">Processo</td>
                        <td className="small">{pubSelecionada.numero_processo_mascara || pubSelecionada.numero_processo || '—'}</td></tr>
                      <tr><td className="text-muted small fw-semibold">Tipo</td>
                        <td className="small">{pubSelecionada.tipo_comunicacao} / {pubSelecionada.tipo_documento}</td></tr>
                      <tr><td className="text-muted small fw-semibold">Classe</td>
                        <td className="small">{pubSelecionada.nome_classe || '—'}</td></tr>
                      <tr><td className="text-muted small fw-semibold">Disponibilizado</td>
                        <td className="small">{fmtData(pubSelecionada.data_disponibilizacao)}</td></tr>
                      <tr><td className="text-muted small fw-semibold">Meio</td>
                        <td className="small">{pubSelecionada.meio === 'D' ? 'Diário Eletrônico' : pubSelecionada.meio === 'E' ? 'Edital' : '—'}</td></tr>
                    </tbody>
                  </table>

                  {/* Texto da publicação */}
                  <div className="mb-3">
                    <div className="text-muted small fw-semibold mb-1">Texto da Publicação</div>
                    <div className="p-2 bg-light rounded border small" style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                      {pubSelecionada.texto || 'Sem texto disponível.'}
                    </div>
                  </div>

                  {/* Vincular ao caso */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Vincular ao processo cadastrado</label>
                    <select className="form-select form-select-sm"
                      value={pubSelecionada.caso_id || ''}
                      onChange={e => vincularCaso(pubSelecionada, e.target.value ? parseInt(e.target.value) : null)}>
                      <option value="">— Nenhum —</option>
                      {casos.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.numero_processo ? `${c.numero_processo} — ` : ''}{c.titulo}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ações */}
                  <div className="d-flex gap-2 flex-wrap">
                    {pubSelecionada.link && (
                      <a href={pubSelecionada.link} target="_blank" rel="noreferrer"
                        className="btn btn-outline-primary btn-sm">
                        <i className="bi bi-box-arrow-up-right me-1" />Ver original
                      </a>
                    )}
                    <button className="btn btn-outline-secondary btn-sm"
                      onClick={() => baixarCertidao(pubSelecionada)}>
                      <i className="bi bi-file-earmark-pdf me-1" />Baixar certidão
                    </button>
                    <button
                      className={`btn btn-sm ${pubSelecionada.lida ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                      onClick={() => marcarLida(pubSelecionada, !pubSelecionada.lida)}>
                      <i className={`bi ${pubSelecionada.lida ? 'bi-envelope me-1' : 'bi-envelope-open me-1'}`} />
                      {pubSelecionada.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba OABs ──────────────────────────────────────────────────────── */}
      {aba === 'oabs' && (
        <div className="row g-4">
          <div className="col-md-5">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-plus-circle me-2 text-success" />Cadastrar OAB para monitoramento
              </div>
              <div className="card-body">
                <form onSubmit={salvarOab}>
                  <div className="mb-3">
                    <label className="form-label small">Número da OAB <span className="text-danger">*</span></label>
                    <input className="form-control" placeholder="Ex: 123456" required
                      value={novaOab.numero_oab}
                      onChange={e => setNovaOab(o => ({ ...o, numero_oab: e.target.value }))} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small">UF da OAB <span className="text-danger">*</span></label>
                    <select className="form-select" required
                      value={novaOab.uf_oab}
                      onChange={e => setNovaOab(o => ({ ...o, uf_oab: e.target.value }))}>
                      <option value="">Selecione a UF</option>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small">Nome do advogado (opcional)</label>
                    <input className="form-control" placeholder="Para identificação interna"
                      value={novaOab.nome_advogado}
                      onChange={e => setNovaOab(o => ({ ...o, nome_advogado: e.target.value }))} />
                  </div>
                  <button type="submit" className="btn btn-success w-100" disabled={salvandoOab}>
                    {salvandoOab
                      ? <><span className="spinner-border spinner-border-sm me-2" />Salvando…</>
                      : <><i className="bi bi-check-lg me-2" />Cadastrar OAB</>}
                  </button>
                </form>
                <div className="alert alert-info mt-3 small mb-0">
                  <i className="bi bi-info-circle me-1" />
                  Após cadastrar, clique em <strong>"Sincronizar agora"</strong> para buscar publicações imediatamente.
                  O job automático roda diariamente às 04:00.
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-7">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-list-check me-2" />OABs monitoradas
              </div>
              <div className="card-body p-0">
                {loadingOabs ? (
                  <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
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
                      {oabs.map(o => (
                        <tr key={o.id}>
                          <td className="fw-semibold small">{o.numero_oab}</td>
                          <td className="small"><span className="badge bg-secondary">{o.uf_oab}</span></td>
                          <td className="small text-muted">{o.nome_advogado || '—'}</td>
                          <td className="small text-muted">{o.ultima_sincronizacao ? fmtData(o.ultima_sincronizacao) : 'Nunca'}</td>
                          <td>
                            <button className="btn btn-outline-danger btn-sm"
                              onClick={() => removerOab(o.id)} title="Remover">
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
          </div>
        </div>
      )}
    </div>
  );
}
