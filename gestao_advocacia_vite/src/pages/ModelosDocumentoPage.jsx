/**
 * ModelosDocumentoPage — Epic #9 (#183).
 *
 * Lista os modelos editáveis (4 padrões + customizados do tenant) e permite
 * editar via textarea HTML simples com placeholders Jinja2-like
 * ({{cliente.nome_razao_social}}, {{caso.numero_processo}}, etc.).
 *
 * WYSIWYG e renderização PDF server-side ficam pra fase 2 — esse PR foca
 * em entregar o CRUD funcional + render HTML pra preview/impressão.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import {
  PencilSquareIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { listModelos, createModelo, updateModelo, deleteModelo } from '../api/modelos.js'
import { useConfirm } from '../hooks/useConfirm.jsx'

const TIPOS = [
  { value: 'procuracao_pf', label: 'Procuração — PF' },
  { value: 'procuracao_pj', label: 'Procuração — PJ' },
  { value: 'contrato_pf', label: 'Contrato — PF' },
  { value: 'contrato_pj', label: 'Contrato — PJ' },
  { value: 'peticao', label: 'Petição' },
  { value: 'outro', label: 'Outro' },
]

export default function ModelosDocumentoPage() {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [modelos, setModelos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // modelo em edição (ou null)
  const [salvando, setSalvando] = useState(false)
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listModelos()
      setModelos(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err?.message || 'Falha ao carregar modelos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abrirNovo = () => {
    setEditando({
      id: null,
      titulo: '',
      tipo: 'outro',
      descricao: '',
      conteudo_html: '',
      variaveis_disponiveis: [],
      padrao: false,
    })
    setCriando(true)
  }

  const abrirEdicao = (modelo) => {
    setEditando({ ...modelo })
    setCriando(false)
  }

  const cancelarEdicao = () => {
    setEditando(null)
    setCriando(false)
  }

  const salvar = async () => {
    if (!editando.titulo.trim() || !editando.conteudo_html.trim()) {
      toast.warning('Preencha título e conteúdo.')
      return
    }
    setSalvando(true)
    try {
      const payload = {
        titulo: editando.titulo,
        tipo: editando.tipo,
        descricao: editando.descricao || null,
        conteudo_html: editando.conteudo_html,
      }
      if (criando) {
        const novo = await createModelo(payload)
        toast.success('Modelo criado.')
        setModelos((prev) => [novo, ...prev])
      } else {
        const atualizado = await updateModelo(editando.id, payload)
        if (atualizado.id !== editando.id) {
          // Clone-on-edit: backend criou cópia tenant-scoped do modelo padrão
          toast.success('Cópia personalizada criada (modelo padrão preservado).')
          setModelos((prev) => [atualizado, ...prev])
        } else {
          toast.success('Modelo atualizado.')
          setModelos((prev) => prev.map((m) => (m.id === atualizado.id ? atualizado : m)))
        }
      }
      cancelarEdicao()
    } catch (err) {
      toast.error(err?.message || 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (modelo) => {
    if (modelo.padrao) {
      toast.info('Modelos padrão não podem ser excluídos. Edite para criar uma cópia.')
      return
    }
    const ok = await confirm(
      `Excluir o modelo "${modelo.titulo}"? Esta ação não pode ser desfeita.`,
      'Excluir modelo'
    )
    if (!ok) return
    try {
      await deleteModelo(modelo.id)
      toast.success('Modelo excluído.')
      setModelos((prev) => prev.filter((m) => m.id !== modelo.id))
    } catch (err) {
      toast.error(err?.message || 'Falha ao excluir.')
    }
  }

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1200 }}>
      {ConfirmDialog}
      <div className="d-flex align-items-center mb-3">
        <button
          className="btn btn-sm btn-outline-secondary me-3"
          onClick={() => navigate(-1)}
          title="Voltar"
        >
          <ArrowLeftIcon style={{ width: 14, height: 14 }} />
        </button>
        <div className="flex-grow-1">
          <h3 className="fw-bold mb-1">Modelos de Documento</h3>
          <p className="text-muted small mb-0">
            Templates editáveis de procurações, contratos e petições. Use placeholders como{' '}
            <code>{'{{cliente.nome_razao_social}}'}</code> que serão substituídos pelos dados ao
            gerar o documento.
          </p>
        </div>
        {!editando && (
          <button className="btn btn-primary" onClick={abrirNovo} data-testid="btn-novo-modelo">
            <PlusIcon style={{ width: 16, height: 16 }} className="me-1" />
            Novo modelo
          </button>
        )}
      </div>

      {editando ? (
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h5 className="mb-3">
              {criando ? 'Novo modelo' : `Editar: ${editando.titulo || '(sem título)'}`}
            </h5>

            {!criando && editando.padrao && editando.tenant_id === null && (
              <div className="alert alert-warning small">
                Você está editando um <strong>modelo padrão</strong>. Ao salvar, criamos uma{' '}
                <strong>cópia personalizada</strong> pro seu escritório — o original fica
                preservado.
              </div>
            )}

            <div className="row g-3 mb-3">
              <div className="col-md-8">
                <label className="form-label small fw-semibold">Título</label>
                <input
                  type="text"
                  className="form-control"
                  value={editando.titulo}
                  maxLength={200}
                  onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                  data-testid="input-titulo-modelo"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Tipo</label>
                <select
                  className="form-select"
                  value={editando.tipo}
                  onChange={(e) => setEditando({ ...editando, tipo: e.target.value })}
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Descrição</label>
                <input
                  type="text"
                  className="form-control"
                  value={editando.descricao || ''}
                  onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">
                  Conteúdo HTML (com placeholders Jinja2)
                </label>
                <textarea
                  className="form-control font-monospace"
                  rows={20}
                  value={editando.conteudo_html}
                  onChange={(e) => setEditando({ ...editando, conteudo_html: e.target.value })}
                  spellCheck={false}
                  data-testid="textarea-conteudo-modelo"
                />
                <div className="form-text small">
                  Use <code>{'{{cliente.nome_razao_social}}'}</code>,{' '}
                  <code>{'{{cliente.cpf_cnpj}}'}</code>, <code>{'{{caso.numero_processo}}'}</code>,{' '}
                  <code>{'{{advogado.nome}}'}</code>, <code>{'{{data_atual}}'}</code>,{' '}
                  <code>{'{{cidade_local}}'}</code>.
                </div>
                {Array.isArray(editando.variaveis_disponiveis) &&
                  editando.variaveis_disponiveis.length > 0 && (
                    <div className="mt-2">
                      <small className="text-muted">Variáveis aceitas neste modelo:</small>
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {editando.variaveis_disponiveis.map((v) => (
                          <code
                            key={v}
                            className="badge bg-light text-dark border"
                            style={{ fontSize: '0.7rem' }}
                          >
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary" onClick={cancelarEdicao}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={salvar}
                disabled={salvando}
                data-testid="btn-salvar-modelo"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm border-0">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary spinner-border-sm" />
              </div>
            ) : modelos.length === 0 ? (
              <div className="text-center py-5 text-muted">Nenhum modelo cadastrado.</div>
            ) : (
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Título</th>
                    <th>Tipo</th>
                    <th>Origem</th>
                    <th style={{ width: 200 }} className="text-end">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody data-testid="tabela-modelos">
                  {modelos.map((m) => (
                    <tr key={m.id} data-testid={`linha-modelo-${m.id}`}>
                      <td>
                        <strong>{m.titulo}</strong>
                        {m.descricao && <div className="text-muted small">{m.descricao}</div>}
                      </td>
                      <td>
                        <span className="badge bg-secondary">{m.tipo}</span>
                      </td>
                      <td>
                        {m.padrao ? (
                          <span className="badge bg-info text-dark">Padrão</span>
                        ) : (
                          <span className="badge bg-success">Customizado</span>
                        )}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => abrirEdicao(m)}
                          title="Editar"
                          data-testid={`btn-editar-${m.id}`}
                        >
                          <PencilSquareIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary me-1"
                          onClick={() =>
                            navigate(`/clientes`, {
                              state: { gerarDocumentoModelo: m },
                            })
                          }
                          title="Gerar a partir de um cliente"
                        >
                          <EyeIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => remover(m)}
                          disabled={m.padrao}
                          title={m.padrao ? 'Modelo padrão (não pode ser excluído)' : 'Excluir'}
                        >
                          <TrashIcon style={{ width: 14, height: 14 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
