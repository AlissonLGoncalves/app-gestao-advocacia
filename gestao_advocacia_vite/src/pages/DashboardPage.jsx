// src/pages/DashboardPage.jsx
import React, { lazy, Suspense } from 'react'
import Dashboard from '../components/Dashboard.jsx'
import { useNavigate } from 'react-router-dom'

// App leve: os gráficos (recharts, ~300 KB) saem do caminho crítico do Início.
// A parte acionável ("Meu dia", prazos, intimações) pinta imediatamente e a
// visão analítica carrega logo depois, sem travar a primeira renderização.
const DashboardCharts = lazy(() => import('../components/DashboardCharts.jsx'))

const SECAO_ANTIGA_PARA_ROTA = {
  CLIENTES: '/clientes',
  CASOS: '/casos',
  RECEBIMENTOS: '/recebimentos',
  DESPESAS: '/despesas',
  AGENDA: '/agenda',
  DOCUMENTOS: '/documentos',
  RELATORIOS: '/relatorios',
  DASHBOARD: '/dashboard',
}

function DashboardPage() {
  const navigate = useNavigate()

  const handleMudarSecao = (secaoAntigaConstante) => {
    const targetPath = SECAO_ANTIGA_PARA_ROTA[secaoAntigaConstante] || '/dashboard'
    navigate(targetPath)
  }

  return (
    <>
      <Dashboard mudarSecao={handleMudarSecao} />
      <div className="container-fluid px-md-4 px-lg-5 mt-4 mb-5">
        <div className="d-flex justify-content-between align-items-center mb-3 mx-2">
          <h5 className="fw-bold mb-0" style={{ fontFamily: 'var(--font-heading)' }}>
            Visão analítica
          </h5>
          {/* Relatórios saiu da sidebar (menu enxuto) — atalho fica aqui no
              Início e no Ctrl+K. */}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => navigate('/relatorios')}
          >
            Relatórios completos →
          </button>
        </div>
        <Suspense
          fallback={<div className="text-muted small px-2 py-4">Carregando visão analítica...</div>}
        >
          <DashboardCharts />
        </Suspense>
      </div>
    </>
  )
}

export default DashboardPage
