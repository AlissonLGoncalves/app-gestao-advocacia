import React from 'react'
import { Link } from 'react-router-dom'
import {
  ScaleIcon,
  NewspaperIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  CheckIcon,
  ArrowRightIcon,
  EnvelopeOpenIcon,
  TableCellsIcon,
  Squares2X2Icon,
  BoltIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import './LandingPage.css'

const TRUST_LOGOS = ['CNJ DataJud', 'DJEN', 'OAB', 'Receita Federal', 'Google Gemini']

const PAINS = [
  {
    icone: EnvelopeOpenIcon,
    titulo: 'Inbox compartilhado',
    descricao: 'Publicações lidas, mas não classificadas. Ninguém sabe quem viu o quê.',
  },
  {
    icone: TableCellsIcon,
    titulo: 'Planilha desatualizada',
    descricao: 'O Excel só serve até alguém esquecer de atualizar. Daí, serve contra você.',
  },
  {
    icone: ArrowsRightLeftIcon,
    titulo: 'Histórico fragmentado',
    descricao:
      'Documentos no Drive, prazos no Outlook, valores no WhatsApp. O caso vive em quatro lugares.',
  },
]

const FEATURES = [
  {
    icone: NewspaperIcon,
    titulo: 'Vigilância diária do DJEN',
    descricao:
      'Cada publicação cai no caso certo. Sem leitura manual, sem encaminhamento de e-mail, sem "achei que você ia ver".',
  },
  {
    icone: SparklesIcon,
    titulo: 'Cadastro em segundos, não em horas',
    descricao:
      'Suba a procuração em PDF. A IA do Gemini extrai cliente, OAB, CPF e cria o caso pré-preenchido. Você revisa e segue.',
  },
  {
    icone: ScaleIcon,
    titulo: 'Auto-fill direto do CNJ',
    descricao:
      'Digite o número do processo. O Patronus busca tudo na API oficial do CNJ DataJud: partes, classe, vara, movimentações.',
  },
  {
    icone: ClipboardDocumentListIcon,
    titulo: 'Kanban com prioridade visual',
    descricao:
      'A fazer, fazendo, concluído. Prazos vencidos em vermelho. Timeline alternativa para quem prefere lista.',
  },
  {
    icone: BuildingOffice2Icon,
    titulo: 'Workspace isolado por escritório',
    descricao:
      'Convide sócios, associados e assistentes com permissões granulares. Portal restrito para o cliente acompanhar o caso dele — só o dele.',
  },
  {
    icone: ShieldCheckIcon,
    titulo: 'LGPD por padrão',
    descricao:
      'Auditoria de toda alteração, consentimentos versionados, anonimização sob demanda. Você defende, a gente arquiva.',
  },
]

const STEPS = [
  {
    titulo: 'Conecte sua OAB',
    descricao:
      'Cadastre o número da OAB e os tribunais que atende. O monitoramento começa no mesmo dia.',
  },
  {
    titulo: 'Importe ou crie casos',
    descricao:
      'Use o auto-fill do CNJ ou suba uma procuração. Em segundos, cliente e processo aparecem cadastrados.',
  },
  {
    titulo: 'Trabalhe no fluxo, não no e-mail',
    descricao:
      'Publicações, prazos e movimentações chegam direto no caso. Você revisa, decide, executa.',
  },
]

const DIFERENCIAIS = [
  'Linha do tempo unificada por caso — CNJ, DJEN, documentos e tarefas no mesmo lugar',
  'Dashboards de carteira, financeiro e produtividade com gráficos prontos',
  'Filtros profundos: área, fase, vara, valor, datas — em casos e clientes',
  'Onboarding em 2 minutos: você sai do cadastro com o escritório operacional',
]

const PLANOS = [
  {
    nome: 'Solo',
    publico: '1 advogado autônomo',
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

const FAQ = [
  {
    q: 'Preciso migrar meus casos antigos manualmente?',
    a: 'Não. Auto-fill do CNJ, import por planilha e IA para procurações. Você sobe os documentos, o Patronus preenche os dados.',
  },
  {
    q: 'Funciona com o meu tribunal?',
    a: 'O DJEN cobre o sistema unificado nacional. Para tribunais que ainda publicam fora do DJEN, o monitoramento acontece por número de processo via API oficial do CNJ.',
  },
  {
    q: 'E se o DJEN sair do ar?',
    a: 'Nosso ingestor reprocessa automaticamente. Você não perde uma publicação por queda de API.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'A qualquer momento, com exportação completa em CSV/PDF. Seus dados são seus.',
  },
  {
    q: 'Vocês usam meus dados para treinar IA?',
    a: 'Não. Os dados do seu escritório nunca saem do seu workspace, nem alimentam modelos de terceiros.',
  },
]

const IMG_DIFERENCIAL =
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80'
const IMG_HOW =
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80'

export default function LandingPage() {
  return (
    <div className="lp-root">
      {/* ============== TOP BAR ============== */}
      <header
        className="border-bottom"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'saturate(160%) blur(8px)',
          WebkitBackdropFilter: 'saturate(160%) blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
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
            <a
              href="#features"
              className="text-decoration-none text-secondary small d-none d-md-inline"
            >
              Recursos
            </a>
            <a
              href="#planos"
              className="text-decoration-none text-secondary small d-none d-md-inline"
            >
              Planos
            </a>
            <Link to="/login" className="text-decoration-none text-secondary small">
              Entrar
            </Link>
            <Link to="/solicitar-acesso" className="btn btn-primary btn-sm rounded-pill px-3">
              Solicitar acesso
            </Link>
          </nav>
        </div>
      </header>

      {/* ============== HERO ============== */}
      <section className="lp-hero">
        <span className="lp-blob lp-blob--1" />
        <span className="lp-blob lp-blob--2" />
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="row align-items-center g-5">
            <div className="col-lg-7 lp-reveal lp-reveal-1">
              <span className="lp-eyebrow mb-4">
                <span className="lp-eyebrow__pulse" />
                Para escritórios que ainda controlam prazos no Outlook
              </span>
              <h1 className="display-3 lp-headline mb-3">
                Prazos jurídicos não deveriam depender de{' '}
                <span className="lp-grad-text">quem viu o e-mail.</span>
              </h1>
              <p className="lead text-muted mb-4" style={{ maxWidth: 640 }}>
                Patronus monitora o DJEN todos os dias, vincula cada publicação ao caso certo e
                avisa antes do prazo vencer — num único workspace com cliente, processo, financeiro
                e agenda.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link
                  to="/solicitar-acesso"
                  className="btn btn-primary btn-lg rounded-pill px-4 d-inline-flex align-items-center gap-2"
                >
                  Solicitar acesso à beta
                  <ArrowRightIcon style={{ width: 18, height: 18 }} />
                </Link>
                <a
                  href="#como-funciona"
                  className="btn btn-outline-secondary btn-lg rounded-pill px-4"
                >
                  Ver como funciona
                </a>
              </div>
              <p className="small text-muted mt-3 mb-0">
                Beta privada — selecionamos os primeiros escritórios participantes. Resposta em até
                48h.
              </p>
            </div>

            <div className="col-lg-5 lp-reveal lp-reveal-2">
              <div className="lp-mockup">
                <div className="lp-mockup__bar">
                  <span className="lp-mockup__dot" />
                  <span className="lp-mockup__dot" />
                  <span className="lp-mockup__dot" />
                </div>
                <div className="lp-mockup__body">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <p className="mb-0 small text-muted">Painel do escritório</p>
                      <p className="mb-0 fw-bold">Esta semana</p>
                    </div>
                    <Squares2X2Icon style={{ width: 22, height: 22, color: '#94a3b8' }} />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-4">
                      <div className="lp-kpi">
                        <p className="lp-kpi__label mb-1">DJEN</p>
                        <p className="lp-kpi__value mb-0">142</p>
                        <p className="lp-kpi__delta mb-0">+18%</p>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="lp-kpi">
                        <p className="lp-kpi__label mb-1">Urgentes</p>
                        <p className="lp-kpi__value mb-0">6</p>
                        <p className="lp-kpi__delta lp-kpi__delta--warn mb-0">≤ 3 dias</p>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="lp-kpi">
                        <p className="lp-kpi__label mb-1">Casos</p>
                        <p className="lp-kpi__value mb-0">318</p>
                        <p className="lp-kpi__delta mb-0">ativos</p>
                      </div>
                    </div>
                  </div>

                  <div className="lp-bars mb-2">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <span key={i} className="lp-bars__bar" style={{ height: `${h}%` }} />
                    ))}
                  </div>

                  <div className="mt-3">
                    <p className="text-muted small mb-2 fw-semibold">Próximos prazos</p>
                    <div className="lp-row">
                      <span className="lp-row__pill lp-row__pill--urgent">Hoje</span>
                      <span className="flex-grow-1 text-truncate">
                        Contestação — 0001234-56.2024
                      </span>
                    </div>
                    <div className="lp-row">
                      <span className="lp-row__pill lp-row__pill--info">2 dias</span>
                      <span className="flex-grow-1 text-truncate">Recurso — 0009876-54.2023</span>
                    </div>
                    <div className="lp-row">
                      <span className="lp-row__pill lp-row__pill--ok">5 dias</span>
                      <span className="flex-grow-1 text-truncate">
                        Manifestação — 0005555-44.2024
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== TRUST BAR ============== */}
      <section className="lp-trust">
        <div className="container-fluid px-4 px-lg-5 py-4">
          <div className="d-flex flex-wrap align-items-center justify-content-center gap-3 gap-md-4">
            <span className="lp-trust__label">Integrado com</span>
            {TRUST_LOGOS.map((logo, i) => (
              <React.Fragment key={logo}>
                <span className="lp-trust__item">{logo}</span>
                {i < TRUST_LOGOS.length - 1 && <span className="lp-trust__sep" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ============== PROBLEMA ============== */}
      <section className="lp-section-soft">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="row justify-content-center text-center mb-5">
            <div className="col-lg-8">
              <p className="lp-section-eyebrow">Por que Patronus existe</p>
              <h2 className="lp-headline mb-3" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
                O e-mail não foi desenhado para gestão de prazos.
              </h2>
              <p className="text-muted mb-0" style={{ maxWidth: 680, margin: '0 auto' }}>
                A publicação cai no inbox compartilhado às 3h da manhã. O estagiário marca como lida
                sem identificar o processo. Três dias depois, o prazo venceu. A planilha de
                controle? Ninguém atualizou.
              </p>
            </div>
          </div>
          <div className="row g-4">
            {PAINS.map((p) => {
              const Icone = p.icone
              return (
                <div key={p.titulo} className="col-md-4">
                  <div className="lp-pain">
                    <span className="lp-pain__icon">
                      <Icone style={{ width: 20, height: 20, color: '#dc2626' }} />
                    </span>
                    <h5 className="fw-bold mb-2">{p.titulo}</h5>
                    <p className="text-muted small mb-0">{p.descricao}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section id="features" className="lp-section-mesh border-top">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="row justify-content-center text-center mb-5">
            <div className="col-lg-8">
              <p className="lp-section-eyebrow">Recursos</p>
              <h2 className="lp-headline mb-3" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
                Tudo o que um escritório jurídico precisa.
              </h2>
              <p className="text-muted mb-0">
                Construído com integrações reais, não com promessas.
              </p>
            </div>
          </div>
          <div className="row g-4">
            {FEATURES.map((f) => {
              const Icone = f.icone
              return (
                <div key={f.titulo} className="col-md-6 col-lg-4">
                  <div className="lp-feature">
                    <span className="lp-feature__icon">
                      <Icone style={{ width: 24, height: 24, color: '#2563eb' }} />
                    </span>
                    <h5 className="fw-bold mb-2">{f.titulo}</h5>
                    <p className="text-muted small mb-0" style={{ lineHeight: 1.6 }}>
                      {f.descricao}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============== COMO FUNCIONA ============== */}
      <section id="como-funciona" className="border-top">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="row align-items-center g-5">
            <div className="col-lg-5">
              <p className="lp-section-eyebrow">Como funciona</p>
              <h2 className="lp-headline mb-3" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)' }}>
                Do cadastro à primeira publicação automática em poucos minutos.
              </h2>
              <p className="text-muted mb-4">
                Sem onboarding longo, sem consultor implantador, sem migração de planilha. O fluxo
                foi desenhado para você sair do cadastro com o escritório operacional.
              </p>
              <div className="lp-image-card">
                <img
                  src={IMG_HOW}
                  alt="Advogado trabalhando em escritório moderno"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="col-lg-7">
              <div className="d-flex flex-column gap-4 mt-4 mt-lg-0">
                {STEPS.map((s, i) => (
                  <div key={s.titulo} className="lp-step">
                    <span className="lp-step__num">{i + 1}</span>
                    <h5 className="fw-bold mb-2 mt-2">{s.titulo}</h5>
                    <p className="text-muted mb-0" style={{ lineHeight: 1.6 }}>
                      {s.descricao}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== DIFERENCIAIS ============== */}
      <section className="lp-section-soft border-top">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <div className="lp-image-card">
                <img
                  src={IMG_DIFERENCIAL}
                  alt="Livros de direito e ambiente jurídico"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="col-lg-6">
              <p className="lp-section-eyebrow">Diferenciais</p>
              <h2 className="lp-headline mb-3" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)' }}>
                Não é um CRM com cara de software jurídico.
              </h2>
              <p className="text-muted mb-4">
                É um sistema desenhado desde a primeira linha de código para o fluxo de um
                escritório brasileiro. Sem adaptações de Salesforce. Sem integração "em breve" com o
                CNJ. Sem cobrança extra por usuário ativo.
              </p>
              <ul className="list-unstyled mb-0">
                {DIFERENCIAIS.map((d) => (
                  <li key={d} className="d-flex align-items-start gap-3 mb-3">
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                      style={{
                        width: 24,
                        height: 24,
                        background: 'rgba(22,163,74,0.12)',
                        marginTop: 2,
                      }}
                    >
                      <CheckIcon style={{ width: 14, height: 14, color: '#16a34a' }} />
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============== PLANOS ============== */}
      <section id="planos" className="lp-section-mesh border-top">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="row justify-content-center text-center mb-5">
            <div className="col-lg-8">
              <p className="lp-section-eyebrow">Planos</p>
              <h2 className="lp-headline mb-3" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
                14 dias grátis antes de qualquer cobrança.
              </h2>
              <p className="text-muted mb-0">
                Você experimenta o produto inteiro, sem cartão e sem fricção.
              </p>
            </div>
          </div>
          <div className="row g-4 justify-content-center align-items-stretch">
            {PLANOS.map((p) => (
              <div key={p.nome} className="col-md-6 col-lg-4">
                <div className={`lp-plan ${p.destaque ? 'lp-plan--highlight' : ''}`}>
                  <h5 className="fw-bold mb-1">{p.nome}</h5>
                  <p className="text-muted small mb-3">{p.publico}</p>
                  <p className="fs-2 fw-bold mb-3" style={{ color: '#2563eb' }}>
                    {p.preco}
                  </p>
                  <ul className="list-unstyled small mb-4">
                    {p.items.map((it) => (
                      <li key={it} className="d-flex align-items-start gap-2 mb-2">
                        <CheckIcon
                          style={{
                            width: 16,
                            height: 16,
                            color: '#16a34a',
                            marginTop: 2,
                            flexShrink: 0,
                          }}
                        />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/solicitar-acesso"
                    className={`btn ${p.destaque ? 'btn-primary' : 'btn-outline-primary'} w-100 rounded-pill`}
                  >
                    Solicitar acesso
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-muted small mt-4 mb-0">
            Cobrança via Stripe será habilitada em breve. Durante a beta privada, acesso é por
            convite após análise da solicitação.
          </p>
        </div>
      </section>

      {/* ============== FAQ ============== */}
      <section className="border-top">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="text-center mb-5">
                <p className="lp-section-eyebrow">Perguntas frequentes</p>
                <h2
                  className="lp-headline mb-0"
                  style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)' }}
                >
                  Antes de você abrir um chamado.
                </h2>
              </div>
              {FAQ.map((item) => (
                <details key={item.q} className="lp-faq">
                  <summary>{item.q}</summary>
                  <div className="lp-faq__body">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============== CTA FINAL ============== */}
      <section className="lp-cta-final border-top">
        <div className="container-fluid px-4 px-lg-5 py-5 py-lg-6 text-center">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <span
                className="lp-eyebrow mb-4"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.25)',
                }}
              >
                <BoltIcon style={{ width: 14, height: 14 }} />
                Pronto em 2 minutos
              </span>
              <h2 className="lp-headline mb-3" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
                Beta privada. Acesso por convite.
              </h2>
              <p className="mb-4 fs-5" style={{ maxWidth: 640, margin: '0 auto 1.5rem' }}>
                Estamos selecionando os primeiros escritórios participantes. Solicite acesso e
                respondemos em até 48h com um convite individual.
              </p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <Link
                  to="/solicitar-acesso"
                  className="btn btn-primary btn-lg rounded-pill px-5 d-inline-flex align-items-center gap-2"
                >
                  Solicitar acesso à beta
                  <ArrowRightIcon style={{ width: 18, height: 18 }} />
                </Link>
              </div>
              <p className="small mt-3 mb-0" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Análise individual · resposta em até 48h · convite por email
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="border-top text-muted small" style={{ background: '#fff' }}>
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
