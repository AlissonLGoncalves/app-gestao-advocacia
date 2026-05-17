// src/pages/NotasFiscaisPage.jsx
// Pagina dedicada de Notas Fiscais (NFS-e). Saiu de Configuracoes SaaS
// porque emissao de nota e fluxo financeiro, nao setup do SaaS.
// 2 abas: Emissoes (lista de notas emitidas) + Configuracao (CNPJ,
// codigo de servico, cert A1, URLs etc).
import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DocumentTextIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import EmissoesNFSeList from '../components/EmissoesNFSeList.jsx'
import ConfigNFSeForm from '../components/ConfigNFSeForm.jsx'

const ABAS = {
  EMISSOES: 'emissoes',
  CONFIG: 'configuracao',
}

function NotasFiscaisPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // Tab vem do hash da URL (#emissoes ou #configuracao) pra permitir
  // links diretos e preservar aba ao recarregar.
  const hashAtual = (location.hash || '').replace('#', '')
  const abaInicial = Object.values(ABAS).includes(hashAtual) ? hashAtual : ABAS.EMISSOES
  const [abaAtiva, setAbaAtiva] = useState(abaInicial)

  // Mantem hash da URL sincronizado com a aba selecionada.
  useEffect(() => {
    if (hashAtual !== abaAtiva) {
      navigate(`${location.pathname}#${abaAtiva}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaAtiva])

  return (
    <div className="container-fluid px-md-3 px-lg-4 py-3">
      <div className="mb-3">
        <h2 className="h4 mb-1 fw-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Notas Fiscais de Serviço
        </h2>
        <p className="text-muted small mb-0">
          Emissão, consulta e gerenciamento de NFS-e diretamente pelo app via Portal Nacional NFS-e
          (gov.br).
        </p>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${abaAtiva === ABAS.EMISSOES ? 'active' : ''}`}
            onClick={() => setAbaAtiva(ABAS.EMISSOES)}
          >
            <DocumentTextIcon
              style={{ width: 16, height: 16 }}
              className="me-1 d-inline align-text-bottom"
            />
            Emissões
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${abaAtiva === ABAS.CONFIG ? 'active' : ''}`}
            onClick={() => setAbaAtiva(ABAS.CONFIG)}
          >
            <Cog6ToothIcon
              style={{ width: 16, height: 16 }}
              className="me-1 d-inline align-text-bottom"
            />
            Configuração
          </button>
        </li>
      </ul>

      {/* Conteudo das abas */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-3 p-md-4">
          {abaAtiva === ABAS.EMISSOES && <EmissoesNFSeList onChangeTab={setAbaAtiva} />}
          {abaAtiva === ABAS.CONFIG && <ConfigNFSeForm />}
        </div>
      </div>
    </div>
  )
}

export default NotasFiscaisPage
