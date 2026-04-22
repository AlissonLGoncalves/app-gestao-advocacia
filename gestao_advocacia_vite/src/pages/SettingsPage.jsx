import React, { useState, useEffect, useCallback } from 'react'
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  CreditCardIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('escritorio')
  const [userRole, setUserRole] = useState('admin')
  const [escritorioInfo, setEscritorioInfo] = useState({
    nome: '',
    email: '',
  })

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('advogado')
  const [isInviting, setIsInviting] = useState(false)

  // Auditoria LGPD
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  useEffect(() => {
    // Busca informações básicas do usuário local para popular o Form
    const userString = localStorage.getItem('user')
    if (userString) {
      const user = JSON.parse(userString)
      setUserRole(user.role || 'advogado')
      setEscritorioInfo({
        nome: user.username,
        email: user.email,
      })
    }
  }, [])

  const handleSalvarEscritorio = (e) => {
    e.preventDefault()
    toast.success('Informações do Escritório salvas com sucesso!')
  }

  const fetchAuditLogs = useCallback(async () => {
    if (userRole !== 'admin') return
    setLoadingLogs(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const response = await fetch(`${apiUrl}/api/v1/auditoria/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (response.ok) {
        setAuditLogs(await response.json())
      }
    } catch (e) {
      console.error(e)
      toast.error('Erro ao puxar log de auditoria.')
    } finally {
      setLoadingLogs(false)
    }
  }, [userRole])

  useEffect(() => {
    if (activeTab === 'auditoria') {
      fetchAuditLogs()
    }
  }, [activeTab, fetchAuditLogs])

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail) return toast.error('Preencha o e-mail do convidado.')

    setIsInviting(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const response = await fetch(`${apiUrl}/api/v1/auth/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await response.json()
      if (response.ok) {
        toast.success('O Link Mágico criptografado foi disparado para o e-mail com sucesso!')
        setShowInviteForm(false)
        setInviteEmail('')
      } else {
        toast.error(data.message || 'Erro ao convidar. Verifique as permissões.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro de comunicação com o servidor.')
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <div
      className="container-fluid p-4"
      style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 70px)' }}
    >
      <div className="row g-4 max-w-7xl mx-auto" style={{ maxWidth: '1200px' }}>
        {/* SIDEBAR DE ABAS */}
        <div className="col-12 col-md-3">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="list-group list-group-flush">
              <button
                className={`list-group-item list-group-item-action py-3 px-4 fw-semibold border-bottom-0 ${activeTab === 'escritorio' ? 'bg-primary text-white' : 'text-secondary'}`}
                onClick={() => setActiveTab('escritorio')}
              >
                <BuildingOfficeIcon style={{ width: '20px' }} className="me-2 d-inline" /> Meu
                Escritório
              </button>
              <button
                className={`list-group-item list-group-item-action py-3 px-4 fw-semibold border-bottom-0 ${activeTab === 'equipe' ? 'bg-primary text-white' : 'text-secondary'}`}
                onClick={() => setActiveTab('equipe')}
              >
                <UserGroupIcon style={{ width: '20px' }} className="me-2 d-inline" /> Gerir Equipe
              </button>
              <button
                className={`list-group-item list-group-item-action py-3 px-4 fw-semibold border-bottom-0 ${activeTab === 'assinatura' ? 'bg-primary text-white' : 'text-secondary'}`}
                onClick={() => setActiveTab('assinatura')}
              >
                <CreditCardIcon style={{ width: '20px' }} className="me-2 d-inline" /> Assinatura
                SaaS
              </button>
              {userRole === 'admin' && (
                <button
                  className={`list-group-item list-group-item-action py-3 px-4 fw-semibold border-bottom-0 ${activeTab === 'auditoria' ? 'bg-danger text-white' : 'text-secondary'}`}
                  onClick={() => setActiveTab('auditoria')}
                >
                  <ClipboardDocumentListIcon style={{ width: '20px' }} className="me-2 d-inline" />{' '}
                  Auditoria (LGPD)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ÁREA PRINCIPAL DA ABA */}
        <div className="col-12 col-md-9">
          {/* ABA: MEU ESCRITÓRIO */}
          {activeTab === 'escritorio' && (
            <div className="card shadow-sm border-0 rounded-4">
              <div className="card-header bg-white border-bottom p-4">
                <h5 className="mb-0 fw-bold text-dark">Informações da Entidade (Tenant)</h5>
                <p className="text-muted small mb-0 mt-1">
                  Configure os dados matriz da sua Banca Jurídica.
                </p>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleSalvarEscritorio}>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-bold">
                        Nome do Escritório / Razão Social
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={escritorioInfo.nome}
                        onChange={(e) =>
                          setEscritorioInfo({ ...escritorioInfo, nome: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-bold">
                        ID do Tenant (Sistema)
                      </label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value="TENANT-P-9021"
                        disabled
                      />
                    </div>
                  </div>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-bold">
                        E-mail Administrativo do Cofre
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        value={escritorioInfo.email}
                        onChange={(e) =>
                          setEscritorioInfo({ ...escritorioInfo, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-bold">
                        Documento (CPF/CNPJ)
                      </label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value="•••.•••.•••-•• (Visualização Ofuscada)"
                        disabled
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end border-top pt-4">
                    <button type="submit" className="btn btn-primary px-4 fw-bold shadow-sm">
                      Salvar Alterações Globais
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ABA: EQUIPE */}
          {activeTab === 'equipe' && (
            <div className="card shadow-sm border-0 rounded-4">
              <div className="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold text-dark">Gestão de Equipe e Associados</h5>
                  <p className="text-muted small mb-0 mt-1">
                    Convide advogados para operar sob a sua assinatura.
                  </p>
                </div>
                <button
                  className="btn btn-dark fw-bold shadow-sm"
                  onClick={() => setShowInviteForm(!showInviteForm)}
                >
                  + Convidar Membro
                </button>
              </div>

              {showInviteForm && (
                <div className="bg-light p-4 border-bottom">
                  <h6 className="fw-bold text-primary mb-3">Enviar Convite Mágico (Magic Link)</h6>
                  <form onSubmit={handleInvite} className="row g-2 align-items-end">
                    <div className="col-md-5">
                      <label className="form-label small fw-bold text-secondary">
                        E-mail do Colega
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="advogado@email.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary">
                        Nível de Acesso (Papel)
                      </label>
                      <select
                        className="form-select"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                      >
                        <option value="advogado">Advogado Associado</option>
                        <option value="assistente">Assistente/Estagiário</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <button
                        type="submit"
                        className="btn btn-primary w-100 fw-bold"
                        disabled={isInviting}
                      >
                        {isInviting ? 'Gerando...' : 'Disparar E-mail'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="px-4 py-3 text-secondary small fw-bold">Usuário</th>
                        <th className="py-3 text-secondary small fw-bold">Papel (Role)</th>
                        <th className="py-3 text-secondary small fw-bold">Permissões</th>
                        <th className="pe-4 py-3 text-end text-secondary small fw-bold">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3">
                          <div className="d-flex align-items-center">
                            <div
                              className="bg-primary text-white rounded-circle d-flex justify-content-center align-items-center fw-bold me-3"
                              style={{ width: '40px', height: '40px' }}
                            >
                              {escritorioInfo.nome.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div>
                              <p className="mb-0 fw-bold">{escritorioInfo.nome}</p>
                              <span className="text-muted small">{escritorioInfo.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-dark px-3 py-2 rounded-pill">
                            Sócio (Admin)
                          </span>
                        </td>
                        <td>
                          <span className="text-success small fw-bold">
                            <ShieldCheckIcon
                              style={{ width: '16px' }}
                              className="me-1 d-inline mb-1"
                            />
                            Acesso Ilimitado
                          </span>
                        </td>
                        <td className="pe-4 text-end">
                          <button className="btn btn-sm btn-light border text-muted" disabled>
                            Inalterável
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-light text-center border-top">
                  <p className="text-muted small mb-0">
                    Atualmente você possui <strong>1 usuário</strong> conectado na sua Plataforma
                    Exclusiva.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ABA: ASSINATURA */}
          {activeTab === 'assinatura' && (
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
              {/* BANNER PREMIUM */}
              <div
                className="p-5 text-white position-relative"
                style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
              >
                <div className="d-flex justify-content-between align-items-start z-1 position-relative">
                  <div>
                    <span className="badge bg-warning text-dark px-3 py-1 fw-bold rounded-pill mb-3 shadow-sm d-inline-flex align-items-center">
                      <CheckBadgeIcon style={{ width: '16px' }} className="me-1" /> ACTIVE PREMIUM
                    </span>
                    <h3 className="fw-bolder mb-1">Plano Patronus Escritório B2B</h3>
                    <p className="text-white-50 mb-0">
                      Você tem acesso ilimitado à nuvem, isolamento LGPD e Machine Learning.
                    </p>
                  </div>
                  <div className="text-end">
                    <h2 className="fw-bolder text-white mb-0">
                      R$ 199<span className="fs-5 text-white-50 fw-normal">/mês</span>
                    </h2>
                    <small className="text-success">
                      Renovação:{' '}
                      {new Date(
                        new Date().setMonth(new Date().getMonth() + 1)
                      ).toLocaleDateString()}
                    </small>
                  </div>
                </div>

                {/* Circulos de Design */}
                <div
                  className="position-absolute rounded-circle shadow"
                  style={{
                    width: '200px',
                    height: '200px',
                    background: 'rgba(255,255,255,0.03)',
                    top: '-50px',
                    right: '-50px',
                  }}
                ></div>
                <div
                  className="position-absolute rounded-circle shadow"
                  style={{
                    width: '100px',
                    height: '100px',
                    background: 'rgba(255,255,255,0.05)',
                    bottom: '-20px',
                    left: '40%',
                  }}
                ></div>
              </div>

              {/* DETALHES FATURAMENTO */}
              <div className="card-body p-5">
                <h5 className="fw-bold text-dark border-bottom pb-3 mb-4">Método de Pagamento</h5>

                <div className="d-flex align-items-center justify-content-between p-4 border rounded-4 bg-light mb-4 shadow-sm">
                  <div className="d-flex align-items-center">
                    <div
                      className="bg-dark text-white rounded d-flex justify-content-center align-items-center me-4 shadow"
                      style={{
                        width: '60px',
                        height: '40px',
                        fontWeight: '900',
                        fontStyle: 'italic',
                      }}
                    >
                      VISA
                    </div>
                    <div>
                      <p className="mb-0 fw-bold fs-5 text-dark">•••• •••• •••• 4242</p>
                      <span className="text-secondary small">Expira em 12/28</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-outline-primary fw-bold px-4"
                    onClick={() => toast.info('Em breve: Portal de Faturamento Stripe.')}
                  >
                    Editar Cartão
                  </button>
                </div>

                <div className="row g-4 mt-2">
                  <div className="col-md-6">
                    <div
                      className="p-4 border rounded-4 bg-white border-primary shadow-sm"
                      style={{ borderWidth: '2px !important' }}
                    >
                      <h6 className="fw-bold d-flex text-primary">
                        Plano Escritório{' '}
                        <CheckBadgeIcon style={{ width: '18px' }} className="ms-2" />
                      </h6>
                      <ul className="text-muted small mb-0 ps-3 mt-3 lh-lg">
                        <li>Ambiente Multi-Tenant 100% Blindado</li>
                        <li>Casos e Armazenamento Ilimitados</li>
                        <li>Machine Learning e OCR Infinito</li>
                        <li>Usuários Ilimitados</li>
                      </ul>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="p-4 border rounded-4 bg-light" style={{ opacity: 0.6 }}>
                      <h6 className="fw-bold d-flex text-muted">
                        Plano Corporate (Em Breve){' '}
                        <ShieldCheckIcon style={{ width: '18px' }} className="ms-2" />
                      </h6>
                      <ul className="text-muted small mb-0 ps-3 mt-3 lh-lg">
                        <li>Auditoria Total (Click Tracking)</li>
                        <li>Integração Direta PJE e E-proc</li>
                        <li>Automação de WhatsApp para Clientes</li>
                        <li>White-label (Seu App Pessoal)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-center mt-5 pt-3 border-top">
                  <button
                    className="btn btn-link text-danger text-decoration-none fw-bold"
                    onClick={() => toast.warn('Cancelamentos são feitos pela Central de Ajuda.')}
                  >
                    Cancelar Assinatura
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ABA: AUDITORIA LGPD */}
          {activeTab === 'auditoria' && userRole === 'admin' && (
            <div className="card shadow-sm border-0 rounded-4">
              <div className="card-header bg-danger text-white border-bottom p-4">
                <h5 className="mb-0 fw-bold">Trilha de Auditoria Universal (Logs LGPD)</h5>
                <p className="small mb-0 mt-1" style={{ opacity: 0.9 }}>
                  Rastreamento definitivo de modificação e manipulação de informações confidenciais.
                </p>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="table table-hover align-middle mb-0 text-sm">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th className="px-4 py-3 small fw-bold">Data/Hora</th>
                        <th className="py-3 small fw-bold">Usuário Responsável</th>
                        <th className="py-3 small fw-bold">Operação</th>
                        <th className="py-3 small fw-bold">Tabela Alvo</th>
                        <th className="py-3 small fw-bold pe-4">Resumo Pormenorizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingLogs ? (
                        <tr>
                          <td colSpan="5" className="text-center py-5 text-muted">
                            Carregando logs de auditoria selados...
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-5 text-muted">
                            Nenhum rastro de auditoria indexado no seu Workspace ainda. Comece a
                            operar.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-3 small text-muted">
                              {new Date(log.data_hora).toLocaleString('pt-BR')}
                            </td>
                            <td className="fw-bold">{log.username}</td>
                            <td>
                              {log.acao === 'CREATE' && (
                                <span className="badge bg-success px-2 py-1">
                                  <i className="bi bi-plus-circle me-1"></i> CRIAÇÃO
                                </span>
                              )}
                              {log.acao === 'UPDATE' && (
                                <span className="badge bg-warning text-dark px-2 py-1">
                                  <i className="bi bi-pencil-square me-1"></i> EDIÇÃO
                                </span>
                              )}
                              {log.acao === 'DELETE' && (
                                <span className="badge bg-danger px-2 py-1">
                                  <i className="bi bi-trash3 me-1"></i> DELEÇÃO
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="badge border text-dark">{log.tabela_afetada}</span>{' '}
                              (ID {log.registro_id})
                            </td>
                            <td className="pe-4 small text-secondary">{log.detalhes}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
