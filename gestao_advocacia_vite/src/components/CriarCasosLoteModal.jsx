// Issue #320 — "Criar todos" do importar CNJs em lote.
//
// Em vez de um job assíncrono no servidor (40 consultas DataJud num
// request = timeout), o LOTE RODA NO CLIENTE: um CNJ por vez —
// busca no tribunal → cria o caso preenchido — com barra de progresso,
// botão de cancelar e relatório por linha. Cada iteração reusa os
// mesmos endpoints da busca unitária (zero backend novo); o caso criado
// já auto-vincula as intimações DJEN pendentes (#290).
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { buscarProcessoOnDemand, createCaso } from '../api/casos.js'
import { listClientes, createCliente } from '../api/clientes.js'
import { parseValorCausa } from '../utils/valores.js'

function CriarCasosLoteModal({ cnjs, onItemConcluido, onFinalizado, onClose }) {
  const [clientes, setClientes] = useState([])
  const [modoCliente, setModoCliente] = useState('polo') // 'polo' | id existente
  const [papel, setPapel] = useState('autor') // autor | reu
  const [rodando, setRodando] = useState(false)
  const [progresso, setProgresso] = useState(null) // {atual, total, cnj}
  const [resumo, setResumo] = useState(null) // {criados, pulados, erros}
  const canceladoRef = useRef(false)

  useEffect(() => {
    listClientes({ sort_by: 'nome_razao_social', order: 'asc' })
      .then((data) => setClientes(Array.isArray(data) ? data : data?.clientes || []))
      .catch(() => setClientes([]))
  }, [])

  const executar = async () => {
    setRodando(true)
    canceladoRef.current = false
    const stats = { criados: 0, pulados: 0, erros: 0 }
    // dedup de clientes criados pelo nome do polo nesta execução
    const clientesCriados = new Map()

    for (let i = 0; i < cnjs.length; i++) {
      if (canceladoRef.current) break
      const cnj = cnjs[i]
      setProgresso({ atual: i + 1, total: cnjs.length, cnj })
      try {
        const resposta = await buscarProcessoOnDemand(cnj)
        if (resposta?.ja_cadastrado?.caso_id) {
          stats.pulados += 1
          onItemConcluido?.(cnj, {
            situacao: 'pulado',
            caso_id: resposta.ja_cadastrado.caso_id,
            msg: 'já cadastrado',
          })
          continue
        }
        const r = resposta?.resultado
        if (!r?.sucesso) {
          throw new Error(r?.erro || 'Processo não encontrado no tribunal.')
        }
        const poloAtivo = (r.polo_ativo || [])[0]?.nome || ''
        const poloPassivo = (r.polo_passivo || [])[0]?.nome || ''
        const nomeCliente = papel === 'autor' ? poloAtivo : poloPassivo
        const parteContraria = papel === 'autor' ? poloPassivo : poloAtivo

        // resolve cliente: existente fixo OU criado a partir do polo
        let clienteId = modoCliente
        if (modoCliente === 'polo') {
          if (!nomeCliente.trim()) {
            throw new Error('Tribunal não retornou o nome da parte — escolha um cliente fixo.')
          }
          const chave = nomeCliente.trim().toLowerCase()
          if (clientesCriados.has(chave)) {
            clienteId = clientesCriados.get(chave)
          } else {
            const novo = await createCliente({
              nome_razao_social: nomeCliente.trim(),
              tipo_pessoa: 'PF',
            })
            clientesCriados.set(chave, novo.id)
            clienteId = novo.id
          }
        }

        const caso = await createCaso({
          titulo: r.titulo_sugerido || `Processo ${r.cnj_normalizado || cnj}`,
          cliente_id: parseInt(clienteId, 10),
          numero_processo: r.cnj_normalizado || cnj,
          tipo_acao: r.classe_acao || null,
          vara_juizo: r.vara_juizo || null,
          instancia: r.instancia || null,
          data_distribuicao: r.data_distribuicao || null,
          valor_causa: parseValorCausa(r.valor_causa),
          parte_contraria: parteContraria || null,
          status: 'Ativo',
        })
        stats.criados += 1
        onItemConcluido?.(cnj, { situacao: 'criado', caso_id: caso.id })
      } catch (err) {
        stats.erros += 1
        onItemConcluido?.(cnj, { situacao: 'erro', msg: err?.message || 'falha' })
      }
    }

    setRodando(false)
    setProgresso(null)
    setResumo(stats)
    onFinalizado?.(stats)
    if (stats.criados > 0) {
      toast.success(
        `${stats.criados} caso(s) criados${stats.pulados ? `, ${stats.pulados} já existiam` : ''}${
          stats.erros ? `, ${stats.erros} com erro` : ''
        }.`
      )
    } else if (stats.erros > 0) {
      toast.error(`Nenhum caso criado — ${stats.erros} erro(s). Veja o detalhe por linha.`)
    }
  }

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      style={{ background: 'rgba(0,0,0,0.5)' }}
      data-testid="criar-lote-modal"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Criar {cnjs.length} caso(s) do lote</h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Fechar"
              onClick={onClose}
              disabled={rodando}
            />
          </div>
          <div className="modal-body">
            {!rodando && !resumo && (
              <>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Meu cliente é o:</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      type="button"
                      className={`btn btn-sm ${papel === 'autor' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setPapel('autor')}
                    >
                      Autor (polo ativo)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${papel === 'reu' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setPapel('reu')}
                    >
                      Réu (polo passivo)
                    </button>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-semibold">Cliente dos casos</label>
                  <select
                    className="form-select form-select-sm"
                    value={modoCliente}
                    onChange={(e) => setModoCliente(e.target.value)}
                    data-testid="lote-cliente-select"
                  >
                    <option value="polo">
                      Criar a partir do nome da parte (um cliente por processo)
                    </option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        Fixo: {c.nome_razao_social}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">
                    Cada caso é buscado no tribunal e criado já preenchido (classe, vara, valor,
                    parte contrária). Intimações pendentes do processo são vinculadas na hora.
                  </small>
                </div>
              </>
            )}

            {rodando && progresso && (
              <div data-testid="lote-progresso">
                <div className="d-flex justify-content-between small mb-1">
                  <span>
                    Processando {progresso.atual} de {progresso.total}
                  </span>
                  <code style={{ fontSize: '0.75rem' }}>{progresso.cnj}</code>
                </div>
                <div className="progress" style={{ height: 10 }}>
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated"
                    style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}
                  />
                </div>
                <small className="text-muted">
                  Consultando o tribunal — pode levar alguns segundos por processo.
                </small>
              </div>
            )}

            {resumo && (
              <div className="alert alert-light border mb-0 small" data-testid="lote-resumo">
                ✓ <strong>{resumo.criados}</strong> criados · <strong>{resumo.pulados}</strong> já
                existiam · <strong>{resumo.erros}</strong> com erro — detalhe linha a linha na
                tabela.
              </div>
            )}
          </div>
          <div className="modal-footer">
            {rodando ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => {
                  canceladoRef.current = true
                }}
              >
                Cancelar restante
              </button>
            ) : resumo ? (
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Fechar
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-light" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={executar}
                  data-testid="btn-executar-lote"
                >
                  Buscar e criar {cnjs.length} caso(s)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CriarCasosLoteModal
