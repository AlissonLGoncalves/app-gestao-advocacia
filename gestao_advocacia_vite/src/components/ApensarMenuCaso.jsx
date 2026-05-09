// Epic #8 (#182): card de aapensos + alterar instancia.
// Inspirado no menu '...' do detalhe de processo no Astrea ('Apensar processo' /
// 'Alterar instancia atual'). Encapsula 3 acoes em 1 componente isolado para
// minimizar conflito com Epic #6 (Tabs no detalhe).

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  LinkIcon,
  ArrowsPointingOutIcon,
  ChevronDoubleUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  apensarCaso,
  desapensarCaso,
  listarApensosCaso,
  alterarInstanciaCaso,
  listCasos,
} from '../api/casos.js'

const INSTANCIAS_COMUNS = ['1ª Instância', '2ª Instância', 'Superior', 'Recurso']

function ApensarMenuCaso({ caso, onCasoAtualizado }) {
  const navigate = useNavigate()
  const [apensos, setApensos] = useState([])
  const [loadingApensos, setLoadingApensos] = useState(true)

  const [modalAcao, setModalAcao] = useState(null) // 'apensar' | 'instancia' | null
  const [casosDisponiveis, setCasosDisponiveis] = useState([])
  const [casoSelecionadoId, setCasoSelecionadoId] = useState('')
  const [novaInstancia, setNovaInstancia] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregarApensos = useCallback(async () => {
    if (!caso?.id) return
    setLoadingApensos(true)
    try {
      const data = await listarApensosCaso(caso.id)
      setApensos(data.apensos || [])
    } catch (err) {
      console.error('Erro ao listar apensos:', err)
      setApensos([])
    } finally {
      setLoadingApensos(false)
    }
  }, [caso?.id])

  useEffect(() => {
    carregarApensos()
  }, [carregarApensos])

  const abrirModalApensar = async () => {
    setSalvando(false)
    setCasoSelecionadoId('')
    setModalAcao('apensar')
    try {
      const data = await listCasos({ status: 'Ativo' })
      const lista = Array.isArray(data) ? data : data?.casos || []
      // Filtra: nao mostra o proprio caso, nao mostra ja-apensos a ele
      const idsApensos = new Set(apensos.map((a) => a.id))
      const filtrados = lista.filter(
        (c) => c.id !== caso.id && !idsApensos.has(c.id) && c.caso_principal_id !== caso.id
      )
      setCasosDisponiveis(filtrados)
    } catch (err) {
      toast.error('Erro ao carregar lista de casos: ' + err.message)
      setCasosDisponiveis([])
    }
  }

  const abrirModalInstancia = () => {
    setSalvando(false)
    setNovaInstancia(caso?.instancia || '')
    setModalAcao('instancia')
  }

  const fecharModal = () => {
    setModalAcao(null)
    setSalvando(false)
  }

  const handleApensar = async () => {
    if (!casoSelecionadoId) return
    setSalvando(true)
    try {
      const data = await apensarCaso(caso.id, parseInt(casoSelecionadoId, 10))
      toast.success(
        `Caso apensado a ${data.caso_principal?.titulo || data.caso_principal?.numero_processo || '#' + data.caso_principal?.id}.`
      )
      fecharModal()
      onCasoAtualizado?.(data.caso)
    } catch (err) {
      toast.error('Falha ao apensar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  const handleDesapensar = async () => {
    if (!window.confirm('Confirma desapensar este caso do principal?')) return
    setSalvando(true)
    try {
      const data = await desapensarCaso(caso.id)
      toast.success('Caso desapensado.')
      onCasoAtualizado?.(data.caso)
    } catch (err) {
      toast.error('Falha ao desapensar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  const handleAlterarInstancia = async () => {
    const trim = novaInstancia.trim()
    if (!trim) {
      toast.warn('Informe a nova instância.')
      return
    }
    setSalvando(true)
    try {
      const data = await alterarInstanciaCaso(caso.id, trim)
      toast.success(`Instância atualizada para ${data.instancia_atual}.`)
      fecharModal()
      onCasoAtualizado?.(data.caso)
    } catch (err) {
      toast.error('Falha ao alterar instância: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  if (!caso) return null

  const ehApenso = !!caso.caso_principal_id

  return (
    <>
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-light py-2 px-3 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <LinkIcon style={{ width: 16, height: 16 }} />
            Vínculos do processo
          </h6>
        </div>
        <div className="card-body p-3">
          {/* Status: este caso e apenso? */}
          {ehApenso && (
            <div className="alert alert-info py-2 px-3 small d-flex justify-content-between align-items-center">
              <span>
                Este caso é <strong>apenso</strong> ao caso #{caso.caso_principal_id}
              </span>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info"
                  onClick={() => navigate(`/casos/detalhe/${caso.caso_principal_id}`)}
                >
                  Ver principal
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleDesapensar}
                  disabled={salvando}
                >
                  Desapensar
                </button>
              </div>
            </div>
          )}

          {/* Lista de apensos deste caso */}
          {!loadingApensos && apensos.length > 0 && (
            <div className="mb-3">
              <div className="small text-muted mb-2">
                Processos apensos a este caso ({apensos.length}):
              </div>
              <ul className="list-group list-group-flush">
                {apensos.map((a) => (
                  <li
                    key={a.id}
                    className="list-group-item d-flex justify-content-between align-items-center px-2 py-1"
                  >
                    <div className="small text-truncate" style={{ minWidth: 0 }}>
                      <span className="fw-semibold">{a.titulo}</span>
                      {a.numero_processo && (
                        <span className="text-muted ms-2">{a.numero_processo}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-1"
                      onClick={() => navigate(`/casos/detalhe/${a.id}`)}
                    >
                      Abrir
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Acoes */}
          <div className="d-flex gap-2 flex-wrap">
            {!ehApenso && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                onClick={abrirModalApensar}
                disabled={salvando}
              >
                <ArrowsPointingOutIcon style={{ width: 14, height: 14 }} />
                Apensar a outro processo
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
              onClick={abrirModalInstancia}
              disabled={salvando}
            >
              <ChevronDoubleUpIcon style={{ width: 14, height: 14 }} />
              Alterar instância
            </button>
          </div>
          {caso.instancia && (
            <div className="text-muted small mt-2">
              Instância atual: <strong>{caso.instancia}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Modal: apensar */}
      {modalAcao === 'apensar' && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title">Apensar a outro processo</h6>
                <button type="button" className="btn-close" onClick={fecharModal}>
                  <XMarkIcon style={{ display: 'none' }} />
                </button>
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-2">
                  Selecione o processo principal ao qual este caso será apensado.
                </p>
                <select
                  className="form-select form-select-sm"
                  value={casoSelecionadoId}
                  onChange={(e) => setCasoSelecionadoId(e.target.value)}
                  disabled={salvando}
                >
                  <option value="">Selecione um caso...</option>
                  {casosDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo}
                      {c.numero_processo ? ` — ${c.numero_processo}` : ''}
                    </option>
                  ))}
                </select>
                {casosDisponiveis.length === 0 && (
                  <small className="text-muted d-block mt-2">
                    Não há outros casos disponíveis para apensar.
                  </small>
                )}
              </div>
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={fecharModal}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleApensar}
                  disabled={!casoSelecionadoId || salvando}
                >
                  {salvando ? 'Salvando...' : 'Apensar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: alterar instancia */}
      {modalAcao === 'instancia' && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title">Alterar instância</h6>
                <button type="button" className="btn-close" onClick={fecharModal} />
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-2">
                  Use quando o processo subir de instância (ex: 1ª → 2ª após recurso).
                </p>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={novaInstancia}
                  onChange={(e) => setNovaInstancia(e.target.value)}
                  placeholder="Ex: 2ª Instância"
                  list="instancias-comuns-list"
                  disabled={salvando}
                />
                <datalist id="instancias-comuns-list">
                  {INSTANCIAS_COMUNS.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </div>
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={fecharModal}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleAlterarInstancia}
                  disabled={!novaInstancia.trim() || salvando}
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ApensarMenuCaso
