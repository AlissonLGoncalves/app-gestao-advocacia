// src/pages/DashboardPage.jsx
import Dashboard from '../Dashboard.jsx'
import DashboardCharts from '../components/DashboardCharts.jsx'
import { useNavigate } from 'react-router-dom'

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
        <h5 className="fw-bold mb-3 mx-2" style={{ fontFamily: 'var(--font-heading)' }}>
          Visão analítica
        </h5>
        <DashboardCharts />
      </div>
    </>
  )
}

export default DashboardPage
