import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config.js';
import { toast } from 'react-toastify';
import { PlusIcon, ClockIcon, ExclamationCircleIcon, CheckCircleIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

export default function PrazosPage() {
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [casos, setCasos] = useState([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: '', descricao: '', status: 'A Fazer', prioridade: 'Normal', tipo_tarefa: 'Prazo', data_vencimento: '', caso_id: ''
  });

  const carregarTarefas = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/tarefas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(res.ok) {
        const data = await res.json();
        setTarefas(data);
      } else {
        toast.error("Erro ao carregar prazos.");
      }
    } catch (e) {
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarCasos = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/casos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(res.ok) {
        const data = await res.json();
        setCasos(data);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    carregarTarefas();
    carregarCasos();
  }, [carregarTarefas, carregarCasos]);

  const handleSalvarTarefa = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = { ...novaTarefa };
      if (!payload.caso_id) delete payload.caso_id;
      
      const res = await fetch(`${API_URL}/tarefas`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if(res.ok) {
        toast.success("Prazo criado com sucesso!");
        setShowModal(false);
        setNovaTarefa({ titulo: '', descricao: '', status: 'A Fazer', prioridade: 'Normal', tipo_tarefa: 'Prazo', data_vencimento: '', caso_id: '' });
        carregarTarefas();
      } else {
        const err = await res.json();
        toast.error(err.message || "Erro ao salvar.");
      }
    } catch (e) {
        toast.error("Erro na comunicação com servidor.");
    }
  };

  const handleMoverTarefa = async (id, novoStatus) => {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/tarefas/${id}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: novoStatus })
        });
        if(res.ok) {
            carregarTarefas();
        }
    } catch (e) {
        toast.error("Falha ao atualizar tarefa.");
    }
  };

  const [arrastandoId, setArrastandoId] = useState(null);

  const handleDragStart = (e, id) => {
    setArrastandoId(id);
    e.dataTransfer.setData('tarefaId', id);
  };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, statusDestino) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData('tarefaId');
    if(idStr) {
        handleMoverTarefa(parseInt(idStr), statusDestino);
    }
    setArrastandoId(null);
  };

  const getCorPrioridade = (prior) => {
      switch(prior) {
          case 'Urgente': return 'danger';
          case 'Alta': return 'warning';
          case 'Baixa': return 'info';
          default: return 'primary';
      }
  };

  const renderColuna = (titulo, statusNome, cor) => {
      const tarefasColuna = tarefas.filter(t => t.status === statusNome);
      return (
          <div 
             className={`col-md-4 d-flex flex-column`}
             style={{ minHeight: '600px' }}
             onDragOver={handleDragOver}
             onDrop={(e) => handleDrop(e, statusNome)}
          >
              <div className={`card shadow-sm h-100 border-top-0 border-start-0 border-end-0 border-bottom border-3 border-${cor} bg-light`}>
                  <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                      <h6 className="mb-0 fw-bold">{titulo}</h6>
                      <span className="badge bg-secondary rounded-pill">{tarefasColuna.length}</span>
                  </div>
                  <div className="card-body overflow-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                      {tarefasColuna.map(t => (
                          <div 
                             key={t.id} 
                             draggable 
                             onDragStart={(e) => handleDragStart(e, t.id)}
                             className={`card mb-3 shadow-none border hover-shadow cursor-grab ${arrastandoId === t.id ? 'opacity-50' : ''}`}
                             style={{ cursor: 'grab' }}
                          >
                              <div className="card-body p-3">
                                  <div className="d-flex justify-content-between mb-2">
                                      <span className={`badge bg-${getCorPrioridade(t.prioridade)}-subtle text-${getCorPrioridade(t.prioridade)}`}>{t.prioridade}</span>
                                      <span className="small text-muted" title="Tipo">
                                          {t.tipo_tarefa === 'Prazo' && <ExclamationCircleIcon className="text-danger" style={{width: 14}} />}
                                          <span> {t.tipo_tarefa}</span>
                                      </span>
                                  </div>
                                  <h6 className="card-title fw-semibold text-dark mb-1">{t.titulo}</h6>
                                  {t.caso_id && (() => {
                                      const casoVinculado = casos.find(c => c.id === t.caso_id);
                                      return (
                                         <p className="small text-muted mb-2 text-truncate" style={{fontSize: '0.75rem'}} title={casoVinculado ? `${casoVinculado.titulo} (${casoVinculado.numero_processo})` : `Caso ID: ${t.caso_id}`}>
                                            <BriefcaseIcon style={{width: 12, marginRight: 4, display: 'inline', marginTop: '-2px'}} />
                                            {casoVinculado ? `${casoVinculado.titulo} (${casoVinculado.numero_processo})` : `Caso ID: ${t.caso_id}`}
                                         </p>
                                      );
                                  })()}
                                  {t.data_vencimento && (
                                      <div className="d-flex align-items-center mt-3 pt-2 border-top">
                                          <ClockIcon className="text-muted me-1" style={{ width: 14 }} />
                                          <span className="small text-muted">
                                              {new Date(t.data_vencimento).toLocaleDateString('pt-BR')}
                                          </span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                      {tarefasColuna.length === 0 && (
                          <div className="text-center py-4 text-muted small border border-dashed rounded bg-white">
                              Arraste tarefas para cá
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: '#f4f7f6', minHeight: '100%' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h4 className="mb-0 fw-bold">Kanban de Prazos e Tarefas</h4>
                <p className="text-muted small mb-0">Gerencie o trabalho do escritório visualmente.</p>
            </div>
            <button className="btn btn-primary shadow-sm" onClick={() => setShowModal(true)}>
                <PlusIcon style={{width: 20, marginRight: 5}} className="mb-1"/>
                Novo Prazo/Tarefa
            </button>
        </div>

        {loading ? (
           <div className="text-center py-5"><span className="spinner-border text-primary"/></div>
        ) : (
           <div className="row g-4">
               {renderColuna('A Fazer', 'A Fazer', 'danger')}
               {renderColuna('Em Andamento', 'Fazendo', 'warning')}
               {renderColuna('Concluído', 'Concluído', 'success')}
           </div>
        )}

        {/* Modal Simples */}
        {showModal && (
            <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content shadow-lg border-0">
                        <form onSubmit={handleSalvarTarefa}>
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold">Nova Tarefa / Prazo</h5>
                                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">Título</label>
                                    <input required type="text" className="form-control" value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})} placeholder="Peticionar resposta..."/>
                                </div>
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label small fw-semibold">Data de Vencimento</label>
                                        <input type="date" className="form-control" value={novaTarefa.data_vencimento} onChange={e => setNovaTarefa({...novaTarefa, data_vencimento: e.target.value})} />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label small fw-semibold">Prioridade</label>
                                        <select className="form-select" value={novaTarefa.prioridade} onChange={e => setNovaTarefa({...novaTarefa, prioridade: e.target.value})}>
                                            <option>Baixa</option><option>Normal</option><option>Alta</option><option>Urgente</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">Vincular a um Caso processual</label>
                                    <select className="form-select" value={novaTarefa.caso_id} onChange={e => setNovaTarefa({...novaTarefa, caso_id: e.target.value})}>
                                        <option value="">Nenhum</option>
                                        {casos.map(c => <option key={c.id} value={c.id}>{c.titulo} ({c.numero_processo})</option>)}
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">Tipo</label>
                                    <select className="form-select" value={novaTarefa.tipo_tarefa} onChange={e => setNovaTarefa({...novaTarefa, tipo_tarefa: e.target.value})}>
                                        <option>Prazo</option><option>Peticionamento</option><option>Reunião</option><option>Intimação (Leitura)</option><option>Outros</option>
                                    </select>
                                </div>
                                <div className="mb-1">
                                    <label className="form-label small fw-semibold">Descrição (Opcional)</label>
                                    <textarea className="form-control" rows="2" value={novaTarefa.descricao} onChange={e => setNovaTarefa({...novaTarefa, descricao: e.target.value})}></textarea>
                                </div>
                            </div>
                            <div className="modal-footer border-top-0 pt-0">
                                <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary px-4 fw-semibold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
