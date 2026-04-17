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
  const [ultimasPublicacoesDjen, setUltimasPublicacoesDjen] = useState([]);
  const [loadingUltimasPublicacoesDjen, setLoadingUltimasPublicacoesDjen] = useState(false);
  const [triagemItems, setTriagemItems] = useState([]);
  const [triagemTotal, setTriagemTotal] = useState(0);
  const [loadingTriagem, setLoadingTriagem] = useState(false);
  const [triagemSelecionadas, setTriagemSelecionadas] = useState([]);
  const [processandoLoteTriagem, setProcessandoLoteTriagem] = useState(false);

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

  // ── Últimas publicações DJEN para aba OABs ────────────────────────────────
  const carregarUltimasPublicacoesDjen = useCallback(async () => {
    setLoadingUltimasPublicacoesDjen(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '8');
      params.set('offset', '0');

      const res = await fetch(`${API_URL}/djen/publicacoes?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUltimasPublicacoesDjen(data.items || []);
      } else {
        setUltimasPublicacoesDjen([]);
      }
    } catch {
      setUltimasPublicacoesDjen([]);
    } finally {
      setLoadingUltimasPublicacoesDjen(false);
    }
  }, []);

  // ── Carregar fila de triagem ───────────────────────────────────────────────
  const carregarTriagem = useCallback(async () => {
    setLoadingTriagem(true);
    try {
      const res = await fetch(`${API_URL}/djen/triagem?limit=30&somente_pendentes=true`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTriagemItems(data.items || []);
        setTriagemTotal(data.total || 0);
        setTriagemSelecionadas([]);
      } else {
        toast.error('Erro ao carregar fila de triagem DJEN.');
      }
    } catch {
      toast.error('Erro de conexão na triagem DJEN.');
    } finally {
      setLoadingTriagem(false);
    }
  }, []);

  useEffect(() => {
    carregarPublicacoes(0);
    carregarOabs();
    carregarCasos();
    carregarTriagem();
    carregarUltimasPublicacoesDjen();
  }, [carregarPublicacoes, carregarOabs, carregarCasos, carregarTriagem, carregarUltimasPublicacoesDjen]);

  // ── Sincronizar ─────────────────────────────────────────────────────────────
  const sincronizar = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/djen/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: 30 }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        const resumo = payload?.resumo || {};
        const salvas = resumo.publicacoes_salvas ?? 0;
        const encontrados = resumo.itens_encontrados ?? 0;
        const oabsProc = resumo.oabs_processadas ?? 0;
        const casosProc = resumo.casos_processados ?? 0;
        toast.success(
          `Sync DJEN concluído: ${salvas} nova(s), ${encontrados} encontrada(s), OABs ${oabsProc}, casos ${casosProc}.`
        );
        setOffset(0);
        await carregarPublicacoes(0);
        await carregarOabs();
        await carregarTriagem();
        await carregarUltimasPublicacoesDjen();
      } else {
        toast.error(payload.message || 'Erro ao sincronizar.');
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
        setTriagemItems(prev => prev.filter(i => i.publicacao.id !== pub.id));
        setTriagemTotal(prev => Math.max(0, prev - 1));
        if (pubSelecionada?.id === pub.id) setPubSelecionada(updated);
        toast.success('Vínculo atualizado.');
      }
    } catch {
      toast.error('Erro ao vincular.');
    }
  };

  const mesclarTriagemCaso = async (pub, casoId) => {
    try {
      const res = await fetch(`${API_URL}/djen/triagem/${pub.id}/mesclar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caso_id: casoId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.message || 'Erro ao mesclar publicação.');
        return;
      }

      setTriagemItems(prev => prev.filter(i => i.publicacao.id !== pub.id));
      setTriagemTotal(prev => Math.max(0, prev - 1));
      await carregarPublicacoes(0);
      await carregarUltimasPublicacoesDjen();
      toast.success('Publicação mesclada ao caso com sucesso.');
    } catch {
      toast.error('Erro de conexão ao mesclar publicação.');
    }
  };

  const ignorarTriagem = async (pub) => {
    try {
      const res = await fetch(`${API_URL}/djen/triagem/${pub.id}/ignorar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Sem ação necessária' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.message || 'Erro ao ignorar publicação.');
        return;
      }

      setTriagemItems(prev => prev.filter(i => i.publicacao.id !== pub.id));
      setTriagemTotal(prev => Math.max(0, prev - 1));
      await carregarPublicacoes(0);
      await carregarUltimasPublicacoesDjen();
      toast.success('Publicação ignorada na triagem.');
    } catch {
      toast.error('Erro de conexão ao ignorar publicação.');
    }
  };

  // ── Criar cliente + caso via triagem ──────────────────────────────────────
  const criarClienteECasoTriagem = async (pub) => {
    try {
      const res = await fetch(`${API_URL}/djen/triagem/${pub.id}/criar-cliente-caso`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.message || 'Erro ao criar cliente/caso pela triagem.');
        return;
      }

      setTriagemItems(prev => prev.filter(i => i.publicacao.id !== pub.id));
      setTriagemTotal(prev => Math.max(0, prev - 1));
      await carregarPublicacoes(0);
      await carregarCasos();
      await carregarUltimasPublicacoesDjen();

      const clienteNome = payload?.cliente?.nome_razao_social || 'Cliente';
      const casoNumero = payload?.caso?.numero_processo || payload?.caso?.titulo || `#${payload?.caso?.id}`;
      toast.success(`Cliente/Caso processados: ${clienteNome} · ${casoNumero}`);
    } catch {
      toast.error('Erro de conexão ao criar cliente/caso.');
    }
  };

  const toggleSelecaoTriagem = (pubId) => {
    setTriagemSelecionadas(prev => (
      prev.includes(pubId) ? prev.filter(id => id !== pubId) : [...prev, pubId]
    ));
  };

  const selecionarTodasTriagem = () => {
    const ids = triagemItems.map(i => i.publicacao.id);
    setTriagemSelecionadas(ids);
  };

  const limparSelecaoTriagem = () => {
    setTriagemSelecionadas([]);
  };

  const processarLoteTriagem = async () => {
    if (triagemSelecionadas.length === 0) {
      toast.info('Selecione ao menos uma publicação na triagem.');
      return;
    }

    setProcessandoLoteTriagem(true);
    try {
      const res = await fetch(`${API_URL}/djen/triagem/processar-lote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pub_ids: triagemSelecionadas }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.message || 'Erro ao processar lote da triagem.');
        return;
      }

      const processadas = payload.processadas ?? 0;
      const erros = payload.erros ?? 0;
      toast.success(`Lote concluído: ${processadas} processada(s), ${erros} erro(s).`);

      await carregarTriagem();
      await carregarPublicacoes(0);
      await carregarCasos();
      await carregarUltimasPublicacoesDjen();
    } catch {
      toast.error('Erro de conexão no processamento em lote.');
    } finally {
      setProcessandoLoteTriagem(false);
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
            onClick={() => { setAba('oabs'); carregarOabs(); carregarUltimasPublicacoesDjen(); }}
          >
            <i className="bi bi-person-badge me-1" />
            Monitorar OABs
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${aba === 'triagem' ? 'active fw-semibold' : ''}`}
            onClick={() => { setAba('triagem'); carregarTriagem(); }}
          >
            <i className="bi bi-magic me-1" />
            Triagem IA
            {triagemTotal > 0 && <span className="badge bg-warning text-dark ms-2">{triagemTotal}</span>}
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
                      {pubSelecionada.nome_juiz && (
                        <tr><td className="text-muted small fw-semibold">Magistrado</td>
                          <td className="small">{pubSelecionada.nome_juiz}</td></tr>
                      )}
                      {pubSelecionada.polo_ativo && (
                        <tr><td className="text-muted small fw-semibold">Polo Ativo</td>
                          <td className="small">{pubSelecionada.polo_ativo}</td></tr>
                      )}
                      {pubSelecionada.polo_passivo && (
                        <tr><td className="text-muted small fw-semibold">Polo Passivo</td>
                          <td className="small">{pubSelecionada.polo_passivo}</td></tr>
                      )}
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
                  O job automático roda diariamente às 04:00 e considera os últimos 30 dias.
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

            <div className="card shadow-sm border-0 mt-3">
              <div className="card-header bg-white fw-semibold d-flex justify-content-between align-items-center">
                <span><i className="bi bi-journal-text me-2" />Últimas publicações capturadas</span>
                <button className="btn btn-outline-primary btn-sm" onClick={carregarUltimasPublicacoesDjen}>
                  <i className="bi bi-arrow-repeat me-1" />Atualizar
                </button>
              </div>
              <div className="card-body p-0">
                {loadingUltimasPublicacoesDjen ? (
                  <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
                ) : ultimasPublicacoesDjen.length === 0 ? (
                  <div className="p-3 text-muted small">
                    Nenhuma publicação foi capturada ainda. Clique em <strong>Sincronizar agora</strong> para buscar no DJEN.
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {ultimasPublicacoesDjen.map((pub) => (
                      <button
                        key={pub.id}
                        type="button"
                        className="list-group-item list-group-item-action"
                        onClick={() => { setAba('publicacoes'); setPubSelecionada(pub); }}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="small" style={{ minWidth: 0 }}>
                            <div className="fw-semibold text-truncate">
                              {pub.numero_processo_mascara || pub.numero_processo || 'Sem número de processo'}
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
      )}

      {/* ── Aba Triagem ───────────────────────────────────────────────────── */}
      {aba === 'triagem' && (
        <div className="row g-3">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="small text-muted">
                {triagemTotal} publicação(ões) pendente(s) de triagem inteligente
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={selecionarTodasTriagem}>
                  Selecionar todas
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={limparSelecaoTriagem}>
                  Limpar seleção
                </button>
                <button className="btn btn-outline-primary btn-sm" onClick={carregarTriagem}>
                  <i className="bi bi-arrow-repeat me-1" />Atualizar triagem
                </button>
                <button
                  className="btn btn-success btn-sm"
                  onClick={processarLoteTriagem}
                  disabled={processandoLoteTriagem || triagemSelecionadas.length === 0}
                >
                  {processandoLoteTriagem ? 'Processando lote...' : `Processar selecionadas (${triagemSelecionadas.length})`}
                </button>
              </div>
            </div>
          </div>

          {loadingTriagem ? (
            <div className="col-12 text-center py-5"><div className="spinner-border text-primary" /></div>
          ) : triagemItems.length === 0 ? (
            <div className="col-12">
              <div className="alert alert-success mb-0">
                Nenhuma pendência na fila de triagem. As publicações novas aparecerão aqui após a sincronização.
              </div>
            </div>
          ) : (
            triagemItems.map(item => {
              const pub = item.publicacao;
              const analise = item.analise || {};
              const sugestoes = item.sugestoes || {};
              return (
                <div className="col-12" key={pub.id}>
                  <div className="card border-0 shadow-sm">
                    <div className="card-body">
                      <div className="form-check mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`triagem-check-${pub.id}`}
                          checked={triagemSelecionadas.includes(pub.id)}
                          onChange={() => toggleSelecaoTriagem(pub.id)}
                        />
                        <label className="form-check-label small" htmlFor={`triagem-check-${pub.id}`}>
                          Selecionar para processamento em lote
                        </label>
                      </div>

                      <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                        <div>
                          <div className="fw-semibold">
                            {pub.numero_processo_mascara || pub.numero_processo || 'Sem número de processo'}
                          </div>
                          <div className="small text-muted">
                            {(analise.tribunal || pub.sigla_tribunal || '—')} · confiança da análise: {Math.round((analise.confianca || 0) * 100)}%
                          </div>
                          {analise.revisao_manual_recomendada && (
                            <div className="small text-warning-emphasis mt-1">
                              Revisão manual recomendada para esta publicação.
                            </div>
                          )}
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => marcarLida(pub, true)}
                          >
                            Marcar lida
                          </button>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => criarClienteECasoTriagem(pub)}
                          >
                            Criar cliente e caso
                          </button>
                          {sugestoes?.casos?.[0] && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => mesclarTriagemCaso(pub, sugestoes.casos[0].id)}
                            >
                              Mesclar com caso sugerido
                            </button>
                          )}
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => ignorarTriagem(pub)}
                          >
                            Ignorar
                          </button>
                        </div>
                      </div>

                      <hr />

                      <div className="row g-3 small">
                        <div className="col-md-4">
                          <div className="text-muted fw-semibold mb-1">Partes autoras</div>
                          {(analise.partes_autoras || []).length > 0
                            ? analise.partes_autoras.map((p, idx) => <div key={`a-${idx}`}>{p}</div>)
                            : <div className="text-muted">—</div>}
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted fw-semibold mb-1">Partes rés</div>
                          {(analise.partes_reus || []).length > 0
                            ? analise.partes_reus.map((p, idx) => <div key={`r-${idx}`}>{p}</div>)
                            : <div className="text-muted">—</div>}
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted fw-semibold mb-1">Representantes</div>
                          {(analise.representantes || []).length > 0
                            ? analise.representantes.map((p, idx) => <div key={`rep-${idx}`}>{p}</div>)
                            : <div className="text-muted">—</div>}
                        </div>
                      </div>

                      <div className="row g-3 small mt-1">
                        <div className="col-md-6">
                          <div className="text-muted fw-semibold mb-1">Documentos (CPF/CNPJ)</div>
                          {(analise.documentos_extraidos || []).length > 0 ? (
                            analise.documentos_extraidos.map((d, idx) => <div key={`doc-${idx}`}>{d}</div>)
                          ) : <div className="text-muted">Nenhum documento explícito encontrado.</div>}
                        </div>
                        <div className="col-md-6">
                          <div className="text-muted fw-semibold mb-1">Sugestões de casos</div>
                          {(sugestoes.casos || []).length > 0 ? (
                            sugestoes.casos.map((s) => (
                              <div key={`caso-${s.id}`} className="mb-1">
                                <button
                                  className="btn btn-link btn-sm p-0 text-start"
                                  onClick={() => mesclarTriagemCaso(pub, s.id)}
                                >
                                  #{s.id} {s.numero_processo || s.titulo} ({Math.round((s.score || 0) * 100)}%)
                                </button>
                              </div>
                            ))
                          ) : <div className="text-muted">Nenhuma sugestão de caso.</div>}
                        </div>
                        <div className="col-md-6">
                          <div className="text-muted fw-semibold mb-1">Sugestões de clientes</div>
                          {(sugestoes.clientes || []).length > 0 ? (
                            sugestoes.clientes.map((s) => (
                              <div key={`cli-${s.id}`} className="mb-1">
                                {s.nome_razao_social} ({Math.round((s.score || 0) * 100)}%)
                              </div>
                            ))
                          ) : <div className="text-muted">Nenhuma sugestão de cliente.</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
