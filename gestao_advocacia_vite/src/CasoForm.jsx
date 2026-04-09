// src/CasoForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { toast } from 'react-toastify';
import { parseCNJ, formatCNJ } from './utils/cnj.js';

const initialState = {
    cliente_id: '',
    titulo: '',
    numero_processo: '',
    status: 'Ativo',
    parte_contraria: '',
    adv_parte_contraria: '',
    tipo_acao: '',
    area_direito: '',
    fase_processual: '',
    vara_juizo: '',
    comarca: '',
    instancia: '',
    valor_causa: '',
    data_distribuicao: '',
    notas_caso: ''
};

function CasoForm({ casoParaEditar, onCasoChange, onCancel, clienteIdInicial }) {
  const [formData, setFormData] = useState(initialState);
  const [clientes, setClientes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [cnjInfo, setCnjInfo] = useState(null);

  // Opção de criar evento na agenda após salvar o caso
  const [criarEvento, setCriarEvento] = useState(false);
  const [eventoData, setEventoData] = useState({ titulo: '', data_hora: '', tipo: 'Prazo', notas: '' });

  const clearValidationErrors = useCallback(() => setValidationErrors({}), []);

  const fetchClientes = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/clientes/?sort_by=nome_razao_social&sort_order=asc`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Falha ao carregar clientes');
      const data = await response.json();
      setClientes(Array.isArray(data) ? data : (data.clientes || []));
    } catch (error) {
      toast.error(`Erro ao carregar clientes: ${error.message}`);
    }
  }, []);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  useEffect(() => {
    clearValidationErrors();
    if (casoParaEditar && casoParaEditar.id) {
      const dadosEdit = { ...initialState, ...casoParaEditar };
      if (dadosEdit.data_distribuicao && typeof dadosEdit.data_distribuicao === 'string') {
        dadosEdit.data_distribuicao = dadosEdit.data_distribuicao.split('T')[0];
      } else {
        dadosEdit.data_distribuicao = '';
      }
      dadosEdit.valor_causa = (dadosEdit.valor_causa == null) ? '' : String(dadosEdit.valor_causa);
      dadosEdit.cliente_id = dadosEdit.cliente_id ? String(dadosEdit.cliente_id) : '';
      setFormData(dadosEdit);
      setIsEditing(true);
      if (dadosEdit.numero_processo) setCnjInfo(parseCNJ(dadosEdit.numero_processo));
    } else {
      const estado = { ...initialState };
      if (clienteIdInicial) estado.cliente_id = String(clienteIdInicial);
      setFormData(estado);
      setIsEditing(false);
    }
  }, [casoParaEditar, clienteIdInicial, clearValidationErrors]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (validationErrors[name]) setValidationErrors(prev => ({ ...prev, [name]: '' }));
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumeroProcessoChange = (e) => {
    const formatado = formatCNJ(e.target.value);
    if (validationErrors.numero_processo) setValidationErrors(prev => ({ ...prev, numero_processo: '' }));
    const info = parseCNJ(formatado);
    setCnjInfo(info);
    setFormData(prev => {
      const updates = { ...prev, numero_processo: formatado };
      // Auto-preenche area_direito e instancia se ainda não foram definidos manualmente
      if (info) {
        if (!prev.area_direito) updates.area_direito = info.areaSugerida;
        if (!prev.instancia)   updates.instancia    = info.instanciaSugerida;
        if (!prev.titulo)      updates.titulo       = `Processo ${formatado}`;
      }
      return updates;
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.titulo?.trim()) errors.titulo = 'Título do caso é obrigatório.';
    if (!formData.cliente_id) errors.cliente_id = 'Cliente é obrigatório.';
    if (!formData.status?.trim()) errors.status = 'Status é obrigatório.';
    if (formData.valor_causa && (isNaN(parseFloat(formData.valor_causa)) || parseFloat(formData.valor_causa) < 0)) {
      errors.valor_causa = 'Valor da causa deve ser um número positivo.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const criarEventoAgenda = async (casoId, token) => {
    if (!eventoData.titulo || !eventoData.data_hora) return;
    const cliente = clientes.find(c => String(c.id) === String(formData.cliente_id));
    const payload = {
      titulo: eventoData.titulo,
      data_hora_inicio: eventoData.data_hora,
      tipo_evento: eventoData.tipo,
      notas: eventoData.notas,
      caso_id: casoId,
      cliente_id: formData.cliente_id ? parseInt(formData.cliente_id) : null,
    };
    try {
      const resp = await fetch(`${API_URL}/agenda/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (resp.ok) toast.success('Evento criado na agenda!');
      else toast.warning('Caso salvo, mas falha ao criar evento na agenda.');
    } catch {
      toast.warning('Caso salvo, mas falha ao criar evento na agenda.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearValidationErrors();
    if (!validateForm()) { toast.error('Corrija os erros indicados.'); return; }
    setLoading(true);

    const dadosParaEnviar = {
      ...formData,
      valor_causa: formData.valor_causa ? parseFloat(formData.valor_causa) : null,
      data_distribuicao: formData.data_distribuicao || null,
      cliente_id: parseInt(formData.cliente_id, 10),
    };

    try {
      const url = isEditing ? `${API_URL}/casos/${casoParaEditar.id}` : `${API_URL}/casos`;
      const method = isEditing ? 'PUT' : 'POST';
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(dadosParaEnviar),
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.erro || `Falha ao salvar caso. Status: ${response.status}`);

      toast.success(`Caso ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);

      if (criarEvento && !isEditing) {
        await criarEventoAgenda(responseData.id, token);
      }

      if (typeof onCasoChange === 'function') onCasoChange();
    } catch (error) {
      toast.error(error.message || 'Erro desconhecido ao salvar o caso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">{isEditing ? 'Editar Caso' : 'Adicionar Novo Caso'}</h5>
      </div>
      <div className="card-body p-4">
        <form onSubmit={handleSubmit}>

          {/* Número do Processo CNJ */}
          <div className="mb-3">
            <label htmlFor="numero_processo_caso" className="form-label form-label-sm">
              Número do Processo (CNJ)
            </label>
            <input
              type="text"
              name="numero_processo"
              id="numero_processo_caso"
              className="form-control form-control-sm"
              placeholder="0000000-00.0000.0.00.0000"
              value={formData.numero_processo || ''}
              onChange={handleNumeroProcessoChange}
              maxLength={25}
            />
            {cnjInfo && (
              <div className="alert alert-info py-1 px-2 mt-1 mb-0 small d-flex gap-3 flex-wrap">
                <span><strong>Tribunal:</strong> {cnjInfo.tribunalNome}</span>
                <span><strong>Âmbito:</strong> {cnjInfo.areaSugerida}</span>
                <span><strong>Ano:</strong> {cnjInfo.ano}</span>
                <span><strong>Instância sugerida:</strong> {cnjInfo.instanciaSugerida}</span>
              </div>
            )}
          </div>

          {/* Título */}
          <div className="mb-3">
            <label htmlFor="titulo_caso" className="form-label form-label-sm">Título do Caso *</label>
            <input
              type="text" name="titulo" id="titulo_caso"
              className={`form-control form-control-sm ${validationErrors.titulo ? 'is-invalid' : ''}`}
              value={formData.titulo} onChange={handleChange}
            />
            {validationErrors.titulo && <div className="invalid-feedback d-block">{validationErrors.titulo}</div>}
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="cliente_id_caso" className="form-label form-label-sm">Cliente Associado *</label>
              <select
                name="cliente_id" id="cliente_id_caso"
                className={`form-select form-select-sm ${validationErrors.cliente_id ? 'is-invalid' : ''}`}
                value={formData.cliente_id} onChange={handleChange}
                disabled={isEditing && !!casoParaEditar?.cliente_id}
              >
                <option value="">Selecione um cliente...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_razao_social}</option>
                ))}
              </select>
              {validationErrors.cliente_id && <div className="invalid-feedback d-block">{validationErrors.cliente_id}</div>}
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="status_caso" className="form-label form-label-sm">Status *</label>
              <select name="status" id="status_caso"
                className={`form-select form-select-sm ${validationErrors.status ? 'is-invalid' : ''}`}
                value={formData.status} onChange={handleChange}>
                <option value="Ativo">Ativo</option>
                <option value="Suspenso">Suspenso</option>
                <option value="Encerrado">Encerrado</option>
                <option value="Arquivado">Arquivado</option>
              </select>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="tipo_acao_caso" className="form-label form-label-sm">Tipo de Ação</label>
              <input type="text" name="tipo_acao" id="tipo_acao_caso"
                className="form-control form-control-sm" value={formData.tipo_acao || ''} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="area_direito_caso" className="form-label form-label-sm">Área do Direito</label>
              <select name="area_direito" id="area_direito_caso"
                className="form-select form-select-sm" value={formData.area_direito || ''} onChange={handleChange}>
                <option value="">Selecione...</option>
                <option>Cível</option>
                <option>Trabalhista</option>
                <option>Criminal</option>
                <option>Família</option>
                <option>Tributário</option>
                <option>Empresarial</option>
                <option>Previdenciário</option>
                <option>Administrativo</option>
                <option>Consumidor</option>
                <option>Eleitoral</option>
                <option>Federal</option>
                <option>Constitucional</option>
                <option>Militar</option>
                <option>Ambiental</option>
                <option>Outro</option>
              </select>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="parte_contraria_caso" className="form-label form-label-sm">Parte Contrária</label>
              <input type="text" name="parte_contraria" id="parte_contraria_caso"
                className="form-control form-control-sm" value={formData.parte_contraria || ''} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="adv_parte_contraria_caso" className="form-label form-label-sm">Adv. Parte Contrária</label>
              <input type="text" name="adv_parte_contraria" id="adv_parte_contraria_caso"
                className="form-control form-control-sm" value={formData.adv_parte_contraria || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="row">
            <div className="col-md-4 mb-3">
              <label htmlFor="vara_juizo_caso" className="form-label form-label-sm">Vara/Juízo</label>
              <input type="text" name="vara_juizo" id="vara_juizo_caso"
                className="form-control form-control-sm" value={formData.vara_juizo || ''} onChange={handleChange} />
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="comarca_caso" className="form-label form-label-sm">Comarca</label>
              <input type="text" name="comarca" id="comarca_caso"
                className="form-control form-control-sm" value={formData.comarca || ''} onChange={handleChange} />
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="instancia_caso" className="form-label form-label-sm">Instância</label>
              <input type="text" name="instancia" id="instancia_caso"
                className="form-control form-control-sm" value={formData.instancia || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="fase_processual_caso" className="form-label form-label-sm">Fase Processual</label>
              <select name="fase_processual" id="fase_processual_caso"
                className="form-select form-select-sm" value={formData.fase_processual || ''} onChange={handleChange}>
                <option value="">Selecione...</option>
                <option>Inicial</option>
                <option>Citação/Intimação</option>
                <option>Contestação</option>
                <option>Instrução</option>
                <option>Julgamento</option>
                <option>Recurso</option>
                <option>Execução</option>
                <option>Cumprimento de Sentença</option>
                <option>Encerrado</option>
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="data_distribuicao_caso" className="form-label form-label-sm">Data de Distribuição</label>
              <input type="date" name="data_distribuicao" id="data_distribuicao_caso"
                className="form-control form-control-sm" value={formData.data_distribuicao} onChange={handleChange} />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="valor_causa_caso" className="form-label form-label-sm">Valor da Causa (R$)</label>
            <input type="number" name="valor_causa" id="valor_causa_caso"
              className={`form-control form-control-sm ${validationErrors.valor_causa ? 'is-invalid' : ''}`}
              value={formData.valor_causa} onChange={handleChange} step="0.01" placeholder="Ex: 1500.50" />
            {validationErrors.valor_causa && <div className="invalid-feedback d-block">{validationErrors.valor_causa}</div>}
          </div>

          <div className="mb-3">
            <label htmlFor="notas_caso_form" className="form-label form-label-sm">Notas sobre o Caso</label>
            <textarea name="notas_caso" id="notas_caso_form"
              className="form-control form-control-sm" value={formData.notas_caso || ''} onChange={handleChange} rows="3" />
          </div>

          {/* Criar evento na agenda */}
          {!isEditing && (
            <div className="card bg-light border-0 mb-3 p-3">
              <div className="form-check mb-0">
                <input className="form-check-input" type="checkbox" id="criarEventoCheck"
                  checked={criarEvento} onChange={e => setCriarEvento(e.target.checked)} />
                <label className="form-check-label fw-semibold" htmlFor="criarEventoCheck">
                  Criar evento na agenda para este caso
                </label>
              </div>
              {criarEvento && (
                <div className="mt-3 row g-2">
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Título do Evento *</label>
                    <input type="text" className="form-control form-control-sm"
                      placeholder="Ex: Prazo de contestação"
                      value={eventoData.titulo}
                      onChange={e => setEventoData(p => ({ ...p, titulo: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Data e Hora *</label>
                    <input type="datetime-local" className="form-control form-control-sm"
                      value={eventoData.data_hora}
                      onChange={e => setEventoData(p => ({ ...p, data_hora: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Tipo de Evento</label>
                    <select className="form-select form-select-sm"
                      value={eventoData.tipo}
                      onChange={e => setEventoData(p => ({ ...p, tipo: e.target.value }))}>
                      <option>Prazo</option>
                      <option>Audiência</option>
                      <option>Reunião</option>
                      <option>Perícia</option>
                      <option>Outro</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label form-label-sm">Notas do Evento</label>
                    <input type="text" className="form-control form-control-sm"
                      value={eventoData.notas}
                      onChange={e => setEventoData(p => ({ ...p, notas: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          )}

          <hr className="my-4" />
          <div className="d-flex justify-content-end">
            {typeof onCancel === 'function' && (
              <button type="button" className="btn btn-outline-secondary me-2 btn-sm" onClick={onCancel} disabled={loading}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />}
              {isEditing ? 'Atualizar Caso' : 'Adicionar Caso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CasoForm;
