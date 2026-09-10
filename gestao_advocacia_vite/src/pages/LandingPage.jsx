/**
 * LandingPage — pagina publica do Patronus (redesign Stitch, set/2026).
 *
 * REGRA DE CONTEUDO (nao afrouxar em refator futuro): esta pagina nao exibe
 * metrica de resultado, depoimento, logo de cliente, selo, premio, preco nem
 * plano. Nada disso existe no produto. Toda afirmacao aqui e' rastreavel a
 * codigo da main — a origem de cada bloco esta comentada acima dele.
 *
 * Chamada para acao: "solicitar acesso". O cadastro publico e' fechado
 * (config.py REGISTRATION_MODE default "closed"; routes/auth.py devolve 403
 * em /register e so aceita /register-invite), entao nao ha teste gratis.
 *
 * Visual: tokens globais de index.css + Bootstrap 5 utilitarios + estilos
 * proprios em LandingPage.css (prefixo lp-). Sem Tailwind. Icones Heroicons.
 */

import React from 'react'
import { Link } from 'react-router'
import {
  ArrowRightIcon,
  BanknotesIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardDocumentCheckIcon,
  FolderOpenIcon,
  InboxArrowDownIcon,
  KeyIcon,
  ShieldCheckIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline'
import PatronusLogo from '../components/brand/PatronusLogo.jsx'
import JanelaIntimacoes from '../components/landing/JanelaIntimacoes.jsx'
import './LandingPage.css'

const ANO = new Date().getFullYear()

// Navegacao interna — so ancoras que existem nesta pagina.
const MENU = [
  { href: '#como-funciona', texto: 'Como funciona' },
  { href: '#recursos', texto: 'Recursos' },
  { href: '#seguranca', texto: 'Segurança' },
  { href: '#perguntas', texto: 'Perguntas' },
]

// Fonte de cada passo:
//  1. models/djen.py (DjenOabMonitoramento) + routes/djen.py (/oabs, /tribunais)
//  2. djen_service.py (comunicaapi.pje.jus.br) + djen_tasks.py (job_monitorar_djen)
//     + app_runtime.py (cron SincronizarDJENJob) + App.jsx (/djen/sync/diario)
//  3. djen_classifier.py (relevante x rotina) + djen_triagem.py (auto-vinculo CNJ)
//  4. djen_prazo_calculator.py + djen_tasks.py (executar_auto_criacao_tarefas)
const PASSOS = [
  {
    titulo: 'Você cadastra as OABs',
    texto:
      'Número, UF e as siglas dos tribunais que quer acompanhar. Dá para monitorar várias OABs no mesmo escritório.',
  },
  {
    titulo: 'O Patronus busca no DJEN',
    texto:
      'A consulta ao Diário de Justiça Eletrônico Nacional roda uma vez por dia, e você também pode disparar na hora pelo botão de sincronizar.',
  },
  {
    titulo: 'Cada publicação é separada e vinculada',
    texto:
      'O que é rotina fica de lado; o que exige providência vai para a caixa. O vínculo ao processo é feito pelo número CNJ, e o que sobra você resolve na triagem assistida.',
  },
  {
    titulo: 'Vira prazo na agenda',
    texto:
      'A publicação relevante já vinculada a um caso gera um item na agenda com data sugerida — que você confere e valida antes de contar com ela.',
  },
]

// Cada item abaixo aponta para o arquivo que o sustenta.
const GRUPOS = [
  {
    icone: InboxArrowDownIcon,
    titulo: 'Intimações e prazos',
    resumo: 'A fila de trabalho do dia, com o que ainda não foi tratado sempre visível.',
    itens: [
      'Caixa organizada por tratamento: não tratadas, sem processo, tratadas e descartadas', // components/djen/CategoriasPublicacoes.jsx
      'Filtro por tribunal, OAB, período e busca por número do processo ou nome da parte', // pages/DjenPage.jsx
      'Triagem assistida que agrupa as publicações sem vínculo e pede sua confirmação', // pages/TriagemAssistidaPage.jsx
      'Prazo sugerido em dias corridos, deliberadamente conservador, para você validar no card', // djen_prazo_calculator.py + routes/itens_agenda.py (/validar-prazo)
      'Agenda unificada em quatro visões: hoje, calendário, kanban e lista', // pages/AgendaUnificadaPage.jsx
      'Aviso no sino e por e-mail quando o prazo entra em 7 e em 3 dias', // alertas_tasks.py + routes/notificacoes.py
    ],
  },
  {
    icone: FolderOpenIcon,
    titulo: 'Casos, clientes e documentos',
    resumo: 'O cadastro que alimenta o vínculo automático — e os textos que saem dele.',
    itens: [
      'Cadastro de clientes e casos, com histórico de alterações', // routes/clientes.py + routes/casos.py
      'Busca do processo no DataJud do CNJ para preencher classe, assunto, órgão e movimentos', // cnj_service.py + routes/casos_busca.py
      'Conferência de listas de números CNJ antes de criar os casos, até 40 por vez', // routes/casos_busca.py + pages/ImportarCnjsPage.jsx
      'Documentos anexados ao caso, guardados em volume próprio do servidor', // routes/documentos.py
      'Modelos de peça com os campos do cliente e do caso já preenchidos', // routes/modelos_documento.py (Jinja2)
      'Leitura de procuração em PDF ou DOCX para abrir o caso a partir dela', // routes/procuracoes.py + procuracao_service.py
    ],
  },
  {
    icone: BanknotesIcon,
    titulo: 'Financeiro do escritório',
    resumo: 'Honorários, custos e nota — no mesmo lugar do caso que os gerou.',
    itens: [
      'Recebimentos, despesas e contratos de honorários com geração das parcelas', // routes/recebimentos.py, despesas.py, contratos.py
      'Aviso diário do que vence, no sino e por e-mail', // notificacoes_tasks.py
      'Relatórios de contas a receber, contas a pagar, fluxo de caixa e casos por status', // routes/relatorios.py
      'Exportação das listas em PDF respeitando os filtros da tela', // src/utils/pdfGenerator.js
      'Emissão de NFS-e pelo Portal Nacional (gov.br) com certificado A1 — enquanto o certificado não é configurado, o emissor fica em modo de simulação', // nfse/portal_nacional/gateway.py + nfse/gateway.py (MockGateway default)
    ],
  },
]

// Fonte: helpers/tenant.py + migrations rls_*, routes/auth.py, models/auditoria.py,
// models/conta.py (ConsentimentoUsuario), nfse/portal_nacional/signer.py.
const SEGURANCA = [
  {
    icone: Square3Stack3DIcon,
    titulo: 'Isolamento por linha no banco',
    texto:
      'Cada registro carrega o identificador do escritório e o Postgres aplica política de row level security na própria transação, além do filtro por escritório na aplicação. São duas camadas para a mesma pergunta: este dado é seu?',
  },
  {
    icone: KeyIcon,
    titulo: 'Autenticação com JWT',
    texto:
      'Sessão por token assinado, política de senha, limite de tentativas de login e registro de cada acesso.',
  },
  {
    icone: ClipboardDocumentCheckIcon,
    titulo: 'Trilha de auditoria',
    texto:
      'Criação, alteração e exclusão em casos, clientes, intimações e itens de agenda ficam registradas com autor, data e o registro afetado. É trilha de quem mexeu e quando, não uma cópia do valor anterior de cada campo.',
  },
  {
    icone: ShieldCheckIcon,
    titulo: 'Consentimento versionado',
    texto:
      'O aceite dos termos e do aviso de privacidade guarda a versão do documento e o hash do texto aceito, então dá para provar depois o que estava escrito. Os dados do caso ficam legíveis no banco: a proteção é o isolamento e o controle de acesso, não criptografia campo a campo. O certificado digital da nota é a exceção — esse é guardado cifrado.',
  },
]

const PERGUNTAS = [
  {
    q: 'O Patronus substitui o PJe, o PROJUDI ou o e-SAJ?',
    // Direção do produto: camada acima dos tribunais. Nenhuma rota peticiona.
    a: 'Não, e não tenta. Ele é uma camada acima dos tribunais: junta o que está espalhado, organiza a fila e ajuda a preparar a resposta. O peticionamento continua sendo feito no sistema do tribunal.',
  },
  {
    q: 'De onde vêm as publicações?',
    // djen_service.py (DJEN_BASE_URL) + models/djen.py + app_runtime.py + App.jsx
    a: 'Da API pública do Diário de Justiça Eletrônico Nacional, consultada pelas OABs que você cadastra. A sigla do tribunal é configurável por OAB, então dá para acompanhar mais de um. A busca roda uma vez por dia e também pode ser disparada manualmente.',
  },
  {
    q: 'O prazo que aparece no card é o prazo oficial?',
    // djen_prazo_calculator.py — dias corridos, sem feriados, prazo_validado
    a: 'Não. É uma sugestão calculada em dias corridos a partir da data de disponibilização, por uma tabela de regras por tipo de publicação. Ela não considera dias úteis, suspensão forense nem feriados, e erra sempre para o lado curto de propósito. Por isso o card pede que você valide a data antes de tratá-la como prazo.',
  },
  {
    q: 'Preciso de certificado digital ou da minha senha do tribunal?',
    // DJEN e DataJud são públicos; certificado só na NFS-e; PROJUDI usa agente local
    a: 'Para o DJEN e para a busca de processos no DataJud, não: são bases públicas e o Patronus não guarda senha de tribunal. Certificado A1 só é necessário para emitir NFS-e. A integração com o PROJUDI é um caso à parte: ela depende de um agente que roda na máquina do escritório e hoje cobre o TJ-PR.',
  },
  {
    q: 'A busca de processo cobre todos os tribunais?',
    // cnj_service.py (~90 aliases) + routes/casos_busca.py (503 sem chave, cobertura 2ª inst.)
    a: 'A consulta usa o DataJud do CNJ, que expõe cerca de noventa tribunais entre superiores, federais, estaduais, trabalhistas, eleitorais e militares. A cobertura vem do próprio CNJ e é reconhecidamente irregular em segunda instância. O recurso também depende de uma chave de acesso ao DataJud configurada no ambiente.',
  },
  {
    q: 'Quanto custa?',
    // Não há gateway, modelo de plano, assinatura ou fatura no código.
    a: 'Não há plano nem cobrança definidos. O produto não tem meio de pagamento integrado, e por isso o acesso hoje é concedido caso a caso, por solicitação.',
  },
  {
    q: 'Como consigo acesso?',
    // routes/auth.py (/auth/access-request, resposta em até 48h) + admin.py
    a: 'Pelo formulário de solicitação. Ele registra seu contato, OAB e escritório, e a resposta é enviada por e-mail em até 48 horas. Aprovada a solicitação, você recebe um convite individual para criar a conta — o cadastro aberto está desligado.',
  },
  {
    q: 'Os dados de um escritório podem aparecer para outro?',
    // helpers/tenant.py + migrations RLS restritivo
    a: 'Não. Cada escritório é um inquilino separado: a consulta é filtrada na aplicação e o banco tem política que rejeita leitura e escrita fora do escritório da sessão.',
  },
]

export default function LandingPage() {
  return (
    <div className="lp-root">
      {/* ─── Cabeçalho fixo: marca + um único botão primário ─────────────── */}
      <header className="lp-topbar">
        <div className="lp-shell lp-topbar__inner">
          <Link to="/" aria-label="Patronus — página inicial" className="text-decoration-none">
            <PatronusLogo tone="dark" size={34} />
          </Link>

          <nav className="lp-topbar__nav" aria-label="Seções da página">
            {MENU.map((item) => (
              <a key={item.href} href={item.href} className="lp-topbar__link">
                {item.texto}
              </a>
            ))}
          </nav>

          <div className="lp-topbar__acoes">
            <Link to="/login" className="lp-topbar__link">
              Entrar
            </Link>
            <Link to="/solicitar-acesso" className="lp-btn lp-btn--primary lp-btn--sm">
              Solicitar acesso
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ─── Herói ─────────────────────────────────────────────────────── */}
        <section className="lp-hero">
          <div className="lp-shell lp-hero__grid">
            <div>
              <span className="lp-eyebrow">
                <ShieldCheckIcon className="lp-eyebrow__icone" aria-hidden="true" />
                Acesso por convite
              </span>

              <h1 className="lp-h1">
                As intimações de todos os seus tribunais numa <em>fila só</em>.
              </h1>

              <p className="lp-lead">
                O Patronus consulta o DJEN pelas OABs que você monitora, liga cada publicação ao
                processo pelo número CNJ e sugere o prazo. Você decide o que fazer com ela e leva a
                peça ao tribunal.
              </p>

              <ul className="lp-hero__pontos">
                <li className="lp-hero__ponto">
                  <CheckIcon aria-hidden="true" />
                  Busca diária no DJEN
                </li>
                <li className="lp-hero__ponto">
                  <CheckIcon aria-hidden="true" />
                  Vínculo pelo número CNJ
                </li>
                <li className="lp-hero__ponto">
                  <CheckIcon aria-hidden="true" />
                  Prazo sugerido para validar
                </li>
              </ul>

              <div className="lp-hero__acoes">
                <Link to="/solicitar-acesso" className="lp-btn lp-btn--primary">
                  Solicitar acesso
                  <ArrowRightIcon className="lp-btn__icone" aria-hidden="true" />
                </Link>
                <a href="#como-funciona" className="lp-btn lp-btn--ghost">
                  Ver como funciona
                </a>
              </div>

              <p className="lp-hero__nota">
                O cadastro aberto está desligado. O acesso é liberado por convite depois da análise
                da solicitação, com resposta por e-mail em até 48 horas.
              </p>
            </div>

            <figure className="lp-figura">
              <JanelaIntimacoes />
              <figcaption className="lp-figura__legenda">
                Reprodução estática da tela de Intimações: as abas, as categorias e os campos são os
                mesmos do produto. As faixas cinzas marcam onde entram as publicações do seu
                escritório — esta página não exibe dados de processo de ninguém.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ─── Como funciona ─────────────────────────────────────────────── */}
        <section id="como-funciona" className="lp-secao lp-secao--soft">
          <div className="lp-shell">
            <div className="lp-secao__cabeca">
              <p className="lp-kicker">Como funciona</p>
              <h2 className="lp-h2">Da publicação no diário ao prazo na sua agenda.</h2>
              <p className="lp-sub">
                O caminho é sempre o mesmo, e nenhuma etapa tira você da decisão: o sistema separa,
                vincula e sugere; quem confirma é o advogado.
              </p>
            </div>

            <ol className="lp-fluxo list-unstyled mb-0">
              {PASSOS.map((passo, i) => (
                <li key={passo.titulo} className="lp-passo">
                  <span className="lp-passo__num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3 className="lp-h3">{passo.titulo}</h3>
                  <p>{passo.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── Recursos ──────────────────────────────────────────────────── */}
        <section id="recursos" className="lp-secao">
          <div className="lp-shell">
            <div className="lp-secao__cabeca">
              <p className="lp-kicker">Recursos</p>
              <h2 className="lp-h2">O que existe hoje no Patronus.</h2>
              <p className="lp-sub">
                Esta lista é o produto que está no ar, não um roteiro. O que ainda não foi
                construído não aparece aqui.
              </p>
            </div>

            <div className="lp-grupos">
              {GRUPOS.map((grupo) => {
                const Icone = grupo.icone
                return (
                  <article key={grupo.titulo} className="lp-grupo">
                    <span className="lp-grupo__icone">
                      <Icone aria-hidden="true" />
                    </span>
                    <h3 className="lp-h3">{grupo.titulo}</h3>
                    <p className="lp-sub" style={{ marginTop: 8 }}>
                      {grupo.resumo}
                    </p>
                    <ul className="lp-grupo__lista">
                      {grupo.itens.map((item) => (
                        <li key={item}>
                          <CheckIcon aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── Segurança e isolamento ────────────────────────────────────── */}
        <section id="seguranca" className="lp-secao lp-secao--soft">
          <div className="lp-shell lp-seg">
            <div>
              <p className="lp-kicker">Segurança</p>
              <h2 className="lp-h2">O que o sistema faz para separar o seu do alheio.</h2>
              <p className="lp-sub">
                Descrito como está implementado — inclusive onde a proteção termina. Um sistema
                jurídico que exagera a própria segurança é um risco a mais para o escritório.
              </p>
            </div>

            <div className="lp-seg__itens">
              {SEGURANCA.map((item) => {
                const Icone = item.icone
                return (
                  <article key={item.titulo} className="lp-seg__item">
                    <Icone aria-hidden="true" />
                    <div>
                      <h3 className="lp-h3">{item.titulo}</h3>
                      <p>{item.texto}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── Perguntas ─────────────────────────────────────────────────── */}
        <section id="perguntas" className="lp-secao">
          <div className="lp-shell">
            <div className="lp-secao__cabeca">
              <p className="lp-kicker">Perguntas</p>
              <h2 className="lp-h2">O que costuma ser perguntado antes de pedir acesso.</h2>
            </div>

            <div className="lp-faq">
              {PERGUNTAS.map((item) => (
                <details key={item.q} className="lp-faq__item">
                  <summary>
                    {item.q}
                    <ChevronDownIcon className="lp-faq__sinal" aria-hidden="true" />
                  </summary>
                  <p className="lp-faq__resposta">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Chamada final ─────────────────────────────────────────────── */}
        <section className="lp-secao" style={{ paddingTop: 0 }}>
          <div className="lp-shell">
            <div className="lp-cta">
              <h2 className="lp-h2">Peça acesso ao Patronus.</h2>
              <p className="lp-cta__texto">
                Conte quem é você, sua OAB e o escritório. A solicitação é analisada uma a uma e a
                resposta vai por e-mail em até 48 horas.
              </p>
              <div className="lp-cta__acoes">
                <Link to="/solicitar-acesso" className="lp-btn lp-btn--inverse">
                  Solicitar acesso
                  <ArrowRightIcon className="lp-btn__icone" aria-hidden="true" />
                </Link>
              </div>
              <p className="lp-cta__nota">
                Já tem conta? <Link to="/login">Entrar</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Rodapé ──────────────────────────────────────────────────────── */}
      <footer className="lp-rodape">
        <div className="lp-shell lp-rodape__inner">
          <span>&copy; {ANO} Patronus — Sistema Jurídico</span>
          <div className="lp-rodape__links">
            <Link to="/termos">Termos e privacidade</Link>
            <Link to="/solicitar-acesso">Solicitar acesso</Link>
            <Link to="/login">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
