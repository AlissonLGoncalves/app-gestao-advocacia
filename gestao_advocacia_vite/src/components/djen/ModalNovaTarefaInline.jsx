/**
 * ModalNovaTarefaInline — Epic #3 (#177).
 *
 * Modal de criação rápida de tarefa a partir de uma publicação DJEN.
 * Pré-preenche título e descrição com base na pub. Quando salva:
 * - POST /tarefas com publicacao_djen_id (backend marca a pub como lida)
 * - chama onCriada(tarefa) pro caller atualizar a UI
 *
 * Inspirado no fluxo Astrea: clique em andamento → modal "Adicionar tarefa"
 * → form inline → vínculo automático ao caso.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { api } from '../../api/client.js'
import { extrairTextoPlano } from '../../utils/htmlTribunal.js'

// Sugestão de título com base no tipo de comunicação. Funciona como hint
// mas o user pode editar antes de salvar.
function sugerirTitulo(pub) {
  if (!pub) return ''
  const tipo = (pub.tipo_comunicacao || '').toLowerCase()
  const cnj = pub.numero_processo_mascara || pub.numero_processo || ''
  if (tipo.includes('intimação') || tipo.includes('intimacao')) {
    return `Cumprir intimação${cnj ? ` — ${cnj}` : ''}`
  }
  if (tipo.includes('sentença') || tipo.includes('sentenca')) {
    return `Analisar sentença${cnj ? ` — ${cnj}` : ''}`
  }
  if (tipo.includes('decisão') || tipo.includes('decisao')) {
    return `Analisar decisão${cnj ? ` — ${cnj}` : ''}`
  }
  if (tipo.includes('despacho')) {
    return `Atender despacho${cnj ? ` — ${cnj}` : ''}`
  }
  if (tipo.includes('audiência') || tipo.includes('audiencia')) {
    return `Preparar audiência${cnj ? ` — ${cnj}` : ''}`
  }
  return `Tarefa${cnj ? ` — ${cnj}` : ''} (${pub.tipo_comunicacao || 'DJEN'})`
}

// Calcula data sugerida de vencimento: 5 dias úteis a partir de hoje
// (heurística simples — Astrea faz parecido). Não substitui análise jurídica;
// é só sugestão pro user revisar.
function sugerirDataVencimento() {
  const hoje = new Date()
  const v = new Date(hoje)
  // 5 dias corridos como aproximação grosseira de 5 dias úteis
  v.setDate(v.getDate() + 7)
  return v.toISOString().split('T')[0]
}

export default function ModalNovaTarefaInline({ pub, casos = [], onClose, onCriada }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [prioridade, setPrioridade] = useState('Normal')
  const [tipoTarefa, setTipoTarefa] = useState('Prazo')
  const [casoId, setCasoId] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Pré-preenchimento ao abrir / quando pub muda
  useEffect(() => {
    if (!pub) return
    setTitulo(sugerirTitulo(pub))
    const textoPlano = extrairTextoPlano(pub.texto || '')
    setDescricao(textoPlano.slice(0, 500))
    setDataVencimento(sugerirDataVencimento())
    setPrioridade(pub.importante ? 'Alta' : 'Normal')
    setCasoId(pub.caso_id ? String(pub.caso_id) : '')
  }, [pub])

  const casoOptions = useMemo(
    () =>
      [{ id: '', label: '— Sem caso vinculado —' }].concat(
        (casos || []).map((c) => ({
          id: c.id,
          label: `${c.numero_processo_mascara || c.numero_processo || `#${c.id}`}${
            c.titulo ? ` (${c.titulo})` : ''
          }`,
        }))
      ),
    [casos]
  )

  const aberto = !!pub
  if (!aberto) return null

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!titulo.trim()) {
      toast.warning('Informe um título.')
      return
    }
    setSalvando(true)
    try {
      // PR D4.2 — usa /v1/itens-agenda em vez de /tarefas
      // categoria (vocab novo) substitui tipo_tarefa; status default
      // 'Pendente' equivale ao antigo 'A Fazer'.
      const payload = {
        tipo: 'tarefa',
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_vencimento: dataVencimento ? `${dataVencimento}T23:59:00` : null,
        prioridade,
        categoria: tipoTarefa,
        publicacao_djen_id: pub.id,
        caso_id: casoId ? Number(casoId) : null,
      }
      const tarefa = await api.post('/itens-agenda/', payload)
      toast.success('Tarefa criada e publicação marcada como tratada.')
      if (onCriada) onCriada(tarefa)
      onClose?.()
    } catch (err) {
      toast.error(err?.message || 'Falha ao criar tarefa.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1050 }}
        onClick={onClose}
        data-testid="tarefa-inline-backdrop"
      />
      <div
        className="modal fade show d-block"
        style={{ zIndex: 1055 }}
        role="dialog"
        aria-modal="true"
        data-testid="tarefa-inline-modal"
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <form className="modal-content" onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-plus-circle me-2" />
                Criar tarefa a partir desta publicação
              </h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>

            <div className="modal-body">
              <div className="alert alert-light border small mb-3">
                <strong>Vinculada a:</strong> {pub.tipo_comunicacao || 'Publicação'} ·{' '}
                {pub.sigla_tribunal || '—'}
                {pub.numero_processo_mascara || pub.numero_processo ? (
                  <span className="ms-1 fw-semibold">
                    · {pub.numero_processo_mascara || pub.numero_processo}
                  </span>
                ) : null}
                {pub.importante === true && (
                  <span className="badge bg-danger ms-2" style={{ fontSize: '0.65rem' }}>
                    ⭐ Importante (IA)
                  </span>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Título</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={250}
                  required
                  data-testid="tarefa-inline-titulo"
                />
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Vencimento</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    data-testid="tarefa-inline-data"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Prioridade</label>
                  <select
                    className="form-select form-select-sm"
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value)}
                  >
                    <option>Baixa</option>
                    <option>Normal</option>
                    <option>Alta</option>
                    <option>Urgente</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Tipo</label>
                  <select
                    className="form-select form-select-sm"
                    value={tipoTarefa}
                    onChange={(e) => setTipoTarefa(e.target.value)}
                  >
                    <option>Prazo</option>
                    <option>Peticionamento</option>
                    <option>Reunião</option>
                    <option>Ligação</option>
                    <option>Outros</option>
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Caso vinculado</label>
                <select
                  className="form-select form-select-sm"
                  value={casoId}
                  onChange={(e) => setCasoId(e.target.value)}
                  data-testid="tarefa-inline-caso"
                >
                  {casoOptions.map((c) => (
                    <option key={String(c.id)} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {pub.caso_id && (
                  <div className="form-text small">
                    Pré-preenchido com o caso vinculado à publicação.
                  </div>
                )}
              </div>

              <div className="mb-1">
                <label className="form-label small fw-semibold">Descrição</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={2000}
                />
                <div className="form-text small">
                  Pré-preenchida com o texto da publicação. Edite à vontade.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={salvando || !titulo.trim()}
                data-testid="tarefa-inline-salvar"
              >
                {salvando ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Criando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2 me-1" />
                    Criar tarefa e marcar como tratada
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
