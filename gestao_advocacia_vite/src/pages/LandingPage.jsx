import React from 'react'
import { Link } from 'react-router-dom'
import {
  ScaleIcon,
  NewspaperIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

const FEATURES = [
  {
    icone: NewspaperIcon,
    titulo: 'DJEN automático',
    descricao:
      'Monitoramento diário das publicações do Diário de Justiça Eletrônico Nacional por OAB e número de processo, com triagem automática e vínculo ao caso correto.',
  },
  {
    icone: SparklesIcon,
    titulo: 'IA para procurações',
    descricao:
      'Upload da procuração em PDF/imagem e a IA (Google Gemini) extrai nome, OAB, CPF/CNPJ e cria cliente + caso pré-preenchidos em segundos.',
  },
  {
    icone: ScaleIcon,
    titulo: 'Integração CNJ/DataJud',
    descricao:
      'Consulta pública de processos via API oficial do CNJ. Auto-fill do cadastro do caso a partir do número CNJ — sem digitação manual.',
  },
  {
    icone: ClipboardDocumentListIcon,
    titulo: 'Kanban de prazos',
    descricao:
      'Drag & drop entre colunas A Fazer / Fazendo / Concluído, com prioridade visual de prazos vencidos e vista de timeline alternativa.',
  },
  {
    icone: BuildingOffice2Icon,
    titulo: 'Multi-tenant nativo',
    descricao:
      'Cada escritório opera num workspace isolado, com convites para advogados associados, assistentes e portal restrito para clientes.',
  },
  {
    icone: ShieldCheckIcon,
    titulo: 'LGPD e auditoria',
    descricao:
      'Trilhas auditáveis de todas as alterações, consentimentos versionados, anonimização de clientes e log estruturado por requisição.',
  },
]

const DIFERENCIAIS = [
  'Linha do tempo unificada por caso (movimentações CNJ + DJEN + documentos + tarefas)',
  'Dashboard analítico com gráficos de carteira, financeiro e publicações',
  'Filtros avançados por área, fase, vara, valor e datas em casos e clientes',
  'Wizard de onboarding pós-signup que coloca o escritório no ar em 2 minutos',
]

const PLANOS = [
  {
    nome: 'Solo',
    publico: '1 advogado',
    preco: 'em breve',
    items: ['Cadastro ilimitado de clientes e casos', 'DJEN para 1 OAB', 'Suporte por e-mail'],
    destaque: false,
  },
  {
    nome: 'Escritório',
    publico: 'até 5 advogados',
    preco: 'em breve',
    items: [
      'Tudo do plano Solo',
      'DJEN multi-OAB e multi-tribunal',
      'Portal do cliente com acesso restrito',
      'Relatórios financeiros e gerenciais',
    ],
    destaque: true,
  },
  {
    nome: 'Corporate',
    publico: 'banca grande / contratos jurídicos',
    preco: 'sob consulta',
    items: [
      'Tudo do plano Escritório',
      'SSO e provisionamento de usuários',
      'SLA dedicado',
      'Onboarding com time Patronus',
    ],
    destaque: false,
  },
]

export default function LandingPage() {
  return (
    <div style={{ background: '#fff', color: '#0f172a' }}>
      {/* Top bar */}
      <header
        className="border-bottom"
        style={{ background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}
      >
        <div className="container-fluid py-3 px-4 px-lg-5 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <ScaleIcon style={{ width: 28, height: 28, color: '#2563eb' }} />
            <span className="fw-bold fs-5" style={{ fontFamily: 'var(--font-heading)' }}>
              Patronus
            </span>
            <small className="text-muted ms-1 d-none d-md-inline">Sistema Jurídico</small>
          </div>
          <nav className="d-flex align-items-center gap-3">
            <Link to="/login" className="text-decoration-none text-secondary small">
              Entrar
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm rounded-pill px-3">
              Teste grátis 14 dias
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
        <div className="row align-items-center g-5">
          <div className="col-lg-7">
            <span
              className="badge bg-primary-subtle text-primary-emphasis mb-3"
              style={{ fontSize: '0.78rem' }}
            >
              Para escritórios de advocacia que perdem prazos no e-mail
            </span>
            <h1
              className="display-4 fw-bold mb-3"
              style={{ fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}
            >
              Cada publicação no DJEN, no caso certo. <br />
              <span style={{ color: '#2563eb' }}>Automaticamente.</span>
            </h1>
            <p className="lead text-muted mb-4" style={{ maxWidth: 620 }}>
              O Patronus monitora o Diário de Justiça Eletrônico todos os dias, vincula a publicação
              ao processo certo do seu escritório e te avisa antes do prazo vencer. Tudo num único
              workspace com cliente, caso, financeiro e agenda.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Link to="/register" className="btn btn-primary btn-lg rounded-pill px-4">
                Começar teste grátis
              </Link>
              <a href="#features" className="btn btn-outline-secondary btn-lg rounded-pill px-4">
                Ver recursos
              </a>
            </div>
            <p className="small text-muted mt-3 mb-0">
              Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>
          <div className="col-lg-5">
            <div
              className="rounded-4 shadow-sm border p-4"
              style={{
                background:
                  'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(22,163,74,0.06) 100%)',
              }}
            >
              <div className="d-flex align-items-center gap-2 mb-3">
                <ChartBarIcon style={{ width: 22, height: 22, color: '#2563eb' }} />
                <span className="fw-semibold">Operação típica de uma semana</span>
              </div>
              <ul className="list-unstyled mb-0">
                {[
                  'Publicações DJEN ingeridas: 142',
                  'Casos auto-vinculados: 87',
                  'Prazos sinalizados antes do vencimento: 19',
                  'Documentos OCR + Gemini processados: 34',
                ].map((linha) => (
                  <li
                    key={linha}
                    className="d-flex align-items-start gap-2 small mb-2"
                    style={{ color: '#0f172a' }}
                  >
                    <CheckIcon style={{ width: 16, height: 16, color: '#16a34a', marginTop: 3 }} />
                    <span>{linha}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-top" style={{ background: '#f8fafc' }}>
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="text-center mb-5">
            <h2 className="fw-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Tudo o que um escritório jurídico precisa
            </h2>
            <p className="text-muted mb-0">Construído com integrações reais, não com promessas.</p>
          </div>
          <div className="row g-4">
            {FEATURES.map((f) => {
              const Icone = f.icone
              return (
                <div key={f.titulo} className="col-md-6 col-lg-4">
                  <div className="card h-100 border-0 shadow-sm">
                    <div className="card-body p-4">
                      <span
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                        style={{
                          width: 44,
                          height: 44,
                          background: 'rgba(37,99,235,0.1)',
                        }}
                      >
                        <Icone style={{ width: 22, height: 22, color: '#2563eb' }} />
                      </span>
                      <h5 className="fw-bold mb-2">{f.titulo}</h5>
                      <p className="text-muted small mb-0">{f.descricao}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="border-top">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="row align-items-center g-5">
            <div className="col-lg-5">
              <h2 className="fw-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
                Construído por quem entende
                <br />o dia a dia de uma banca.
              </h2>
              <p className="text-muted">
                Patronus não é mais um CRM adaptado para advocacia. É um sistema desenhado desde o
                primeiro dia para o fluxo real de um escritório jurídico brasileiro.
              </p>
            </div>
            <div className="col-lg-7">
              <ul className="list-unstyled">
                {DIFERENCIAIS.map((d) => (
                  <li key={d} className="d-flex align-items-start gap-3 mb-3">
                    <CheckIcon
                      style={{
                        width: 22,
                        height: 22,
                        color: '#16a34a',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="border-top" style={{ background: '#f8fafc' }}>
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="text-center mb-5">
            <h2 className="fw-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Planos
            </h2>
            <p className="text-muted mb-0">
              Você experimenta gratuitamente por 14 dias antes de qualquer cobrança.
            </p>
          </div>
          <div className="row g-4 justify-content-center">
            {PLANOS.map((p) => (
              <div key={p.nome} className="col-md-6 col-lg-4">
                <div
                  className={`card h-100 border-0 ${p.destaque ? 'shadow-lg' : 'shadow-sm'}`}
                  style={p.destaque ? { borderTop: '4px solid #2563eb' } : {}}
                >
                  <div className="card-body p-4">
                    {p.destaque && (
                      <span className="badge bg-primary mb-3" style={{ fontSize: '0.7rem' }}>
                        Mais escolhido
                      </span>
                    )}
                    <h5 className="fw-bold">{p.nome}</h5>
                    <p className="text-muted small mb-3">{p.publico}</p>
                    <p className="fs-3 fw-bold mb-3" style={{ color: '#2563eb' }}>
                      {p.preco}
                    </p>
                    <ul className="list-unstyled small mb-4">
                      {p.items.map((it) => (
                        <li key={it} className="d-flex align-items-start gap-2 mb-2">
                          <CheckIcon
                            style={{ width: 16, height: 16, color: '#16a34a', marginTop: 2 }}
                          />
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/register"
                      className={`btn ${p.destaque ? 'btn-primary' : 'btn-outline-primary'} w-100 rounded-pill`}
                    >
                      Testar grátis
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-muted small mt-4 mb-0">
            Cobrança via Stripe será habilitada em breve. Durante o trial, todas as funcionalidades
            estão disponíveis.
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-top">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6 text-center">
          <h2 className="fw-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
            Comece agora. Sem fricção.
          </h2>
          <p className="text-muted mb-4">
            Crie sua conta, receba o convite no e-mail e configure o escritório em 2 minutos com o
            assistente integrado.
          </p>
          <Link to="/register" className="btn btn-primary btn-lg rounded-pill px-5">
            Quero testar gratuitamente
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-top text-muted small">
        <div className="container-fluid px-4 px-lg-5 py-4 d-flex flex-wrap justify-content-between gap-2">
          <span>&copy; {new Date().getFullYear()} Patronus — Sistema Jurídico</span>
          <div className="d-flex gap-3">
            <Link to="/termos" className="text-muted text-decoration-none">
              Termos de uso
            </Link>
            <Link to="/login" className="text-muted text-decoration-none">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
