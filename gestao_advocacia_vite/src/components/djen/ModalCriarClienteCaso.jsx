import React, { useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { criarClienteCasoTriagem, vincularDecisao } from '../../api/djen.js'

const AI_BADGE = (
  <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle ms-2">
    <i className="bi bi-magic me-1" />
    extraido automaticamente
  </span>
)

function parseValorCausa(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return valor
  const txt = String(valor).replace('R$', '').trim()
  if (!txt) return null
  const normalizado = txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt
  const num = Number(normalizado)
  return Number.isFinite(num) ? num : null
}

export default function ModalCriarClienteCaso({ publicacao, onClose, onSuccess }) {
  const pub = publicacao?.publicacao || {}
  const analise = publicacao?.analise || {}
  const sugestoes = publicacao?.sugestoes_vinculo || publicacao?.sugestoes || {}

  const autorPadrao = (analise.partes_autoras || [])[0] || ''
  const reuPadrao = (analise.partes_reus || [])[0] || ''
  const papelInicial = autorPadrao ? 'autor' : 'reu'

  const [papelCliente, setPapelCliente] = useState(papelInicial)
  const [clienteSelecionado, setClienteSelecionado] = useState(
    sugestoes?.clientes?.[0]?.id ? String(sugestoes.clientes[0].id) : 'novo'
  )
  const [carregando, setCarregando] = useState(false)
  const [erroDuplicata, setErroDuplicata] = useState(null)

  const [formCliente, setFormCliente] = useState({
    nome_razao_social: papelInicial === 'autor' ? autorPadrao : reuPadrao,
    tipo_pessoa: 'PF',
    cpf_cnpj: '',
    email: '',
  })

  const parteContrariaDefault = useMemo(() => {
    if (papelCliente === 'autor') return (analise.partes_reus || [])[0] || ''
    return (analise.partes_autoras || [])[0] || ''
  }, [analise.partes_autoras, analise.partes_reus, papelCliente])

  const [formCaso, setFormCaso] = useState({
    titulo: analise.numero_processo
      ? `Processo ${analise.numero_processo}`
      : `Caso DJEN #${pub.id || ''}`,
    numero_processo: analise.numero_processo || pub.numero_processo || '',
    tipo_acao: analise.classe_processual || '',
    vara_juizo: pub.nome_orgao || analise.vara || '',
    comarca: analise.comarca || '',
    valor_causa: parseValorCausa(analise.valor_causa),
    parte_contraria: parteContrariaDefault,
    notas_caso: '',
  })

  const [aiEdited, setAiEdited] = useState({
    nome_razao_social: false,
    titulo: false,
    numero_processo: false,
    tipo_acao: false,
    vara_juizo: false,
    comarca: false,
    valor_causa: false,
    parte_contraria: false,
  })

  const casoSugestaoPorNumero = useMemo(() => {
    const numero = (formCaso.numero_processo || '').trim()
    if (!numero) return null
    return (sugestoes.casos || []).find((c) => (c.numero_processo || '').trim() === numero) || null
  }, [formCaso.numero_processo, sugestoes.casos])

  const setCampoCliente = (campo, valor, marcouEdicao = false) => {
    setFormCliente((prev) => ({ ...prev, [campo]: valor }))
    if (marcouEdicao) setAiEdited((prev) => ({ ...prev, [campo]: true }))
  }

  const setCampoCaso = (campo, valor, marcouEdicao = false) => {
    setFormCaso((prev) => ({ ...prev, [campo]: valor }))
    if (marcouEdicao) setAiEdited((prev) => ({ ...prev, [campo]: true }))
  }

  const trocarPapelCliente = (novoPapel) => {
    setPapelCliente(novoPapel)
    if (clienteSelecionado === 'novo' && !aiEdited.nome_razao_social) {
      setFormCliente((prev) => ({
        ...prev,
        nome_razao_social: novoPapel === 'autor' ? autorPadrao : reuPadrao,
      }))
    }
    if (!aiEdited.parte_contraria) {
      setFormCaso((prev) => ({
        ...prev,
        parte_contraria: novoPapel === 'autor' ? reuPadrao : autorPadrao,
      }))
    }
  }

  const montarPayloadCriacao = () => {
    const clienteIdNum = clienteSelecionado !== 'novo' ? Number(clienteSelecionado) : null
    return {
      cliente_id: clienteIdNum,
      cliente_payload:
        clienteSelecionado === 'novo'
          ? {
              nome_razao_social: formCliente.nome_razao_social,
              tipo_pessoa: formCliente.tipo_pessoa,
              cpf_cnpj: formCliente.cpf_cnpj || null,
              email: formCliente.email || null,
            }
          : null,
      papel_cliente: papelCliente,
      caso_payload: {
        titulo: formCaso.titulo,
        numero_processo: formCaso.numero_processo || null,
        tipo_acao: formCaso.tipo_acao || null,
        vara_juizo: formCaso.vara_juizo || null,
        comarca: formCaso.comarca || null,
        valor_causa: formCaso.valor_causa === '' ? null : formCaso.valor_causa,
        parte_contraria: formCaso.parte_contraria || null,
        notas_caso: formCaso.notas_caso || null,
      },
    }
  }

  const vincularCasoExistente = async (casoId) => {
    if (!casoId) return
    setCarregando(true)
    try {
      await vincularDecisao(pub.id, casoId)
      toast.success('Publicação vinculada ao caso existente.')
      onSuccess?.()
    } catch {
      toast.error('Erro de conexão ao vincular caso existente.')
    } finally {
      setCarregando(false)
    }
  }

  const onConfirmar = async () => {
    setCarregando(true)
    setErroDuplicata(null)
    try {
      const payload = await criarClienteCasoTriagem(pub.id, montarPayloadCriacao())

      if (payload?.caso_existente) {
        setErroDuplicata(payload)
        toast.warn(payload.mensagem || 'Já existe um caso com este número de processo.')
        return
      }

      toast.success('Cliente e caso criados com sucesso.')
      onSuccess?.()
    } catch {
      toast.error('Erro de conexão ao criar cliente/caso.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Criar cliente e caso</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
          </div>

          <div className="modal-body">
            {casoSugestaoPorNumero && (
              <div className="alert alert-warning d-flex justify-content-between align-items-center">
                <span>
                  Já existe caso com este número:{' '}
                  <strong>{casoSugestaoPorNumero.numero_processo}</strong>
                </span>
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => vincularCasoExistente(casoSugestaoPorNumero.id)}
                  disabled={carregando}
                >
                  Vincular a este caso
                </button>
              </div>
            )}

            {erroDuplicata?.caso_existente && (
              <div className="alert alert-danger d-flex justify-content-between align-items-center">
                <span>{erroDuplicata.mensagem || 'Caso já existente encontrado.'}</span>
                <button
                  className="btn btn-sm btn-outline-dark"
                  onClick={() => vincularCasoExistente(erroDuplicata.caso_existente.id)}
                  disabled={carregando}
                >
                  Vincular em vez de criar
                </button>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label fw-semibold">O cliente é o:</label>
              <div className="d-flex gap-3">
                <div className="form-check">
                  <input
                    id="papel-autor"
                    type="radio"
                    className="form-check-input"
                    checked={papelCliente === 'autor'}
                    onChange={() => trocarPapelCliente('autor')}
                  />
                  <label htmlFor="papel-autor" className="form-check-label">
                    Autor
                  </label>
                </div>
                <div className="form-check">
                  <input
                    id="papel-reu"
                    type="radio"
                    className="form-check-input"
                    checked={papelCliente === 'reu'}
                    onChange={() => trocarPapelCliente('reu')}
                  />
                  <label htmlFor="papel-reu" className="form-check-label">
                    Reu
                  </label>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="cliente-select">
                Cliente
              </label>
              <select
                id="cliente-select"
                className="form-select"
                value={clienteSelecionado}
                onChange={(e) => setClienteSelecionado(e.target.value)}
              >
                {(sugestoes.clientes || []).map((cli) => (
                  <option key={cli.id} value={String(cli.id)}>
                    {cli.nome_razao_social} ({Math.round((cli.score || 0) * 100)}%)
                  </option>
                ))}
                <option value="novo">+ Criar novo cliente</option>
              </select>
            </div>

            {clienteSelecionado === 'novo' && (
              <div className="border rounded p-3 mb-3" data-testid="novo-cliente-form">
                <h6 className="mb-3">Novo cliente</h6>
                <div className="mb-2">
                  <label className="form-label" htmlFor="nome-razao-social">
                    Nome/Razão Social
                    {!aiEdited.nome_razao_social && AI_BADGE}
                  </label>
                  <input
                    id="nome-razao-social"
                    className="form-control"
                    value={formCliente.nome_razao_social}
                    onChange={(e) => setCampoCliente('nome_razao_social', e.target.value, true)}
                  />
                </div>
                <div className="row g-2">
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="tipo-pessoa">
                      Tipo pessoa
                    </label>
                    <select
                      id="tipo-pessoa"
                      className="form-select"
                      value={formCliente.tipo_pessoa}
                      onChange={(e) => setCampoCliente('tipo_pessoa', e.target.value)}
                    >
                      <option value="PF">PF</option>
                      <option value="PJ">PJ</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="cpf-cnpj">
                      CPF/CNPJ
                    </label>
                    <input
                      id="cpf-cnpj"
                      className="form-control"
                      value={formCliente.cpf_cnpj}
                      onChange={(e) => setCampoCliente('cpf_cnpj', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="email-cliente">
                      E-mail
                    </label>
                    <input
                      id="email-cliente"
                      className="form-control"
                      value={formCliente.email}
                      onChange={(e) => setCampoCliente('email', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="border rounded p-3">
              <h6 className="mb-3">Dados do caso</h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="caso-titulo">
                    Título
                    {!aiEdited.titulo && AI_BADGE}
                  </label>
                  <input
                    id="caso-titulo"
                    className="form-control"
                    value={formCaso.titulo}
                    onChange={(e) => setCampoCaso('titulo', e.target.value, true)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="caso-numero">
                    Número do processo
                    {!aiEdited.numero_processo && AI_BADGE}
                  </label>
                  <input
                    id="caso-numero"
                    className="form-control"
                    value={formCaso.numero_processo}
                    onChange={(e) => setCampoCaso('numero_processo', e.target.value, true)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="caso-tipo-acao">
                    Tipo da ação
                    {!aiEdited.tipo_acao && AI_BADGE}
                  </label>
                  <input
                    id="caso-tipo-acao"
                    className="form-control"
                    value={formCaso.tipo_acao}
                    onChange={(e) => setCampoCaso('tipo_acao', e.target.value, true)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="caso-vara">
                    Vara/Juízo
                    {!aiEdited.vara_juizo && AI_BADGE}
                  </label>
                  <input
                    id="caso-vara"
                    className="form-control"
                    value={formCaso.vara_juizo}
                    onChange={(e) => setCampoCaso('vara_juizo', e.target.value, true)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="caso-comarca">
                    Comarca
                    {!aiEdited.comarca && AI_BADGE}
                  </label>
                  <input
                    id="caso-comarca"
                    className="form-control"
                    value={formCaso.comarca}
                    onChange={(e) => setCampoCaso('comarca', e.target.value, true)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="caso-valor-causa">
                    Valor da causa
                    {!aiEdited.valor_causa && AI_BADGE}
                  </label>
                  <input
                    id="caso-valor-causa"
                    type="number"
                    className="form-control"
                    value={formCaso.valor_causa ?? ''}
                    onChange={(e) => setCampoCaso('valor_causa', e.target.value, true)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="caso-parte-contraria">
                    Parte contrária
                    {!aiEdited.parte_contraria && AI_BADGE}
                  </label>
                  <input
                    id="caso-parte-contraria"
                    className="form-control"
                    value={formCaso.parte_contraria}
                    onChange={(e) => setCampoCaso('parte_contraria', e.target.value, true)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="caso-notas">
                    Notas
                  </label>
                  <textarea
                    id="caso-notas"
                    className="form-control"
                    rows={2}
                    value={formCaso.notas_caso}
                    onChange={(e) => setCampoCaso('notas_caso', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onConfirmar}
              disabled={carregando}
            >
              {carregando ? 'Processando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
