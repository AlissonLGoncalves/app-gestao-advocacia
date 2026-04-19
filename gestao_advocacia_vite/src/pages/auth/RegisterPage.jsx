import React, { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { API_URL } from '../../config'
import { LGPD_VERSION, TERMS_VERSION } from '../../constants/legal'
import { toast } from 'react-toastify'
import {
  LockClosedIcon,
  UserIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  IdentificationIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

function RegisterPage() {
  const [tipoPessoa, setTipoPessoa] = useState('PF')
  const [documento, setDocumento] = useState('')
  const [nomeOuRazao, setNomeOuRazao] = useState('')
  const [oab, setOab] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Gatekeepers LGPD
  const [aceiteTermos, setAceiteTermos] = useState(false)
  const [aceiteLgpd, setAceiteLgpd] = useState(false)

  // Gatekeeper de Scroll Obrigatório (Termos)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  // Algoritmo que detecta quando a barra de rolagem atinge o fundo
  const handleScrollTerms = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    // Se a barra estiver a 10px ou menos do fim, libera.
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      setScrolledToBottom(true)
    }
  }

  const aceitarNoModal = () => {
    setAceiteTermos(true)
    setShowTermsModal(false)
  }

  const [loading, setLoading] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite_token')

  // Função para aplicar máscara dinâmica no CPF ou CNPJ
  const handleDocumentChange = (e) => {
    let val = e.target.value.replace(/\D/g, '') // Remove não números
    if (tipoPessoa === 'PF') {
      if (val.length > 11) val = val.slice(0, 11)
      val = val.replace(/(\d{3})(\d)/, '$1.$2')
      val = val.replace(/(\d{3})(\d)/, '$1.$2')
      val = val.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    } else {
      if (val.length > 14) val = val.slice(0, 14)
      val = val.replace(/^(\d{2})(\d)/, '$1.$2')
      val = val.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      val = val.replace(/\.(\d{3})(\d)/, '.$1/$2')
      val = val.replace(/(\d{4})(\d)/, '$1-$2')
    }
    setDocumento(val)

    // Se for CNPJ e estiver completo, busca na API!
    if (tipoPessoa === 'PJ' && val.replace(/\D/g, '').length === 14) {
      buscarCNPJ(val.replace(/\D/g, ''))
    }
  }

  const buscarCNPJ = async (cnpjLimpo) => {
    setBuscandoCnpj(true)
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      if (response.ok) {
        const data = await response.json()
        setNomeOuRazao(data.razao_social || data.nome_fantasia || '')
        toast.success('Empresa localizada pela Receita Federal!')
      } else {
        toast.warning('CNPJ não encontrado. Preencha manualmente.')
      }
    } catch (e) {
      console.error(e)
      toast.warning('Falha ao consultar CNPJ.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    toast.dismiss()

    if (!aceiteTermos || !aceiteLgpd) {
      toast.error('Para prosseguir, você deve aceitar os Termos de Serviço e as Políticas de LGPD.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.')
      setLoading(false)
      return
    }

    // Fluxo 1: Convite Mágico (Associado)
    if (inviteToken) {
      if (!nomeOuRazao || !password) {
        toast.error('Por favor, preencha seu nome e escolha uma senha.')
        setLoading(false)
        return
      }
      try {
        const response = await fetch(`${API_URL}/auth/register-invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invite_token: inviteToken,
            username: nomeOuRazao,
            password,
            aceite_termos: true,
            aceite_lgpd: true,
            versao_termos: TERMS_VERSION,
            versao_lgpd: LGPD_VERSION,
          }),
        })
        const data = await response.json()
        if (response.ok) {
          toast.success(data.message || 'Conta ativada com sucesso no ambiente corporativo!')
          navigate('/login')
        } else {
          toast.error(data.message || 'Link de Convite expirado ou inválido.')
        }
      } catch (error) {
        toast.error('Erro de rede ao processar o link mágico.')
      } finally {
        setLoading(false)
      }
      return
    }

    // Fluxo 2: Criação de Novo Tenant (Admin / Dono)
    if (!nomeOuRazao || !email || !password || !documento) {
      toast.error('Por favor, preencha todos os campos obrigatórios.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.')
      setLoading(false)
      return
    }

    try {
      // Por enquanto, envia "nomeOuRazao" como "username", pois o Backend ainda não foi atualizado
      // para isolar as colunas Tenant/Escritorio. Esta porta frontal já fica preparada.
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: nomeOuRazao,
          email,
          password,
          role: 'admin', // Quem cria o escritório é o Admin do escritório dele
          documento_identificacao: documento,
          tipo_pessoa: tipoPessoa,
          oab: oab || null,
          aceite_termos: true,
          aceite_lgpd: true,
          versao_termos: TERMS_VERSION,
          versao_lgpd: LGPD_VERSION,
        }),
      })
      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Conta Criada! Seu Escritório Mestre foi gerado.')
        navigate('/login')
      } else {
        toast.error(data.message || 'Falha no registro. Verifique os dados.')
      }
    } catch (error) {
      console.error('Erro ao tentar registrar SaaS:', error)
      toast.error('Erro de rede. Nosso servidor pode estar indisponível.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="container-fluid d-flex align-items-center justify-content-center min-vh-100 py-5"
      style={{ backgroundColor: '#0f172a' }}
    >
      <div
        className="card shadow-lg border-0"
        style={{ width: '100%', maxWidth: '800px', overflow: 'hidden' }}
      >
        <div className="row g-0">
          {/* Painel Esquerdo: Marketing / SaaS Message */}
          <div
            className="col-md-5 text-white p-5 d-flex flex-column justify-content-between"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
          >
            <div>
              <img
                src="/logo.png"
                alt="Patronus Logo"
                className="mb-4 shadow-sm"
                style={{ width: '80px', borderRadius: '14px' }}
              />
              <h2 className="fw-bolder mb-3">Patronus</h2>
              <p className="lead fw-normal text-white-50">Sua Advocacia sem Fronteiras.</p>

              <ul className="list-unstyled mt-5">
                <li className="mb-3 d-flex align-items-center">
                  <CheckCircleIcon className="me-2" style={{ width: '24px', opacity: 0.8 }} /> 100%
                  de Controle B2B
                </li>
                <li className="mb-3 d-flex align-items-center">
                  <CheckCircleIcon className="me-2" style={{ width: '24px', opacity: 0.8 }} />{' '}
                  Captura Inteligente OCR
                </li>
                <li className="mb-3 d-flex align-items-center">
                  <CheckCircleIcon className="me-2" style={{ width: '24px', opacity: 0.8 }} />{' '}
                  Compliance Total LGPD
                </li>
                <li className="d-flex align-items-center">
                  <CheckCircleIcon className="me-2" style={{ width: '24px', opacity: 0.8 }} />{' '}
                  Multi-Usuários Ilimitados
                </li>
              </ul>
            </div>
            <div className="mt-5">
              <small className="text-white-50">Ambiente Seguro & Encriptado.</small>
            </div>
          </div>

          {/* Painel Direito: Formulário de Onboarding */}
          <div className="col-md-7 p-4 p-md-5 bg-white">
            <h4 className="fw-bold mb-1 text-dark">
              {inviteToken ? 'Aceite Seu Convite Mágico' : 'Cadastrar Escritório'}
            </h4>
            <p className="text-muted small mb-4">
              {inviteToken
                ? 'Você foi convidado para operar no sistema. Preencha seus dados para finalizar.'
                : 'Selecione o tipo de registro institucional.'}
            </p>

            <form onSubmit={handleRegister}>
              {/* Type Toggle & Documents - OCULTO SE FOR CONVITE */}
              {!inviteToken && (
                <>
                  <div className="d-flex gap-2 mb-4 bg-light p-1 rounded-3 border">
                    <button
                      type="button"
                      className={`btn p-2 w-50 fw-semibold rounded-2 border-0 ${tipoPessoa === 'PF' ? 'btn-primary' : 'btn-light text-muted'}`}
                      onClick={() => {
                        setTipoPessoa('PF')
                        setDocumento('')
                        setNomeOuRazao('')
                        setOab('')
                      }}
                    >
                      <UserIcon className="d-inline-block me-2 mb-1" style={{ width: '18px' }} />
                      Pessoa Física
                    </button>
                    <button
                      type="button"
                      className={`btn p-2 w-50 fw-semibold rounded-2 border-0 ${tipoPessoa === 'PJ' ? 'btn-primary' : 'btn-light text-muted'}`}
                      onClick={() => {
                        setTipoPessoa('PJ')
                        setDocumento('')
                        setNomeOuRazao('')
                        setOab('')
                      }}
                    >
                      <BuildingOfficeIcon
                        className="d-inline-block me-2 mb-1"
                        style={{ width: '18px' }}
                      />
                      Pessoa Jurídica
                    </button>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-8">
                      <label className="form-label mb-1 text-secondary small fw-bold">
                        {tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                        value={documento}
                        onChange={handleDocumentChange}
                        required={!inviteToken}
                        disabled={loading || buscandoCnpj}
                      />
                      {buscandoCnpj && (
                        <small className="text-primary d-block mt-1">
                          Consultando Receita Federal...
                        </small>
                      )}
                    </div>
                    {tipoPessoa === 'PF' && (
                      <div className="col-md-4">
                        <label className="form-label mb-1 text-secondary small fw-bold">
                          OAB (Opcional)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="UF000000"
                          value={oab}
                          onChange={(e) => setOab(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Main Auth Form */}
              <div className="mb-3">
                <label className="form-label mb-1 text-secondary small fw-bold">
                  {inviteToken
                    ? 'Qual seu Nome Completo?'
                    : tipoPessoa === 'PF'
                      ? 'Nome Completo do Advogado'
                      : 'Razão Social do Escritório'}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={nomeOuRazao}
                  onChange={(e) => setNomeOuRazao(e.target.value)}
                  placeholder={
                    inviteToken
                      ? 'Nome Sobrenome'
                      : tipoPessoa === 'PF'
                        ? 'Dr. João Silva'
                        : 'Escritório Silva & Associados'
                  }
                  required
                  disabled={loading}
                />
              </div>

              {!inviteToken && (
                <div className="mb-3">
                  <label className="form-label mb-1 text-secondary small fw-bold">
                    Email de Acesso (Administrador)
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required={!inviteToken}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="form-label mb-1 text-secondary small fw-bold">
                  {inviteToken ? 'Escolha sua Senha de Acesso' : 'Senha Mestre'}
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength="6"
                />
              </div>

              {/* LGPD Gatekeepers */}
              <div className="bg-light p-3 rounded mb-4 border" style={{ fontSize: '0.85rem' }}>
                <div className="form-check mb-3">
                  <input
                    className="form-check-input mt-1"
                    type="checkbox"
                    id="termsBox"
                    checked={aceiteTermos}
                    onChange={(e) => setAceiteTermos(e.target.checked)}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <label className="form-check-label text-dark ms-2" htmlFor="termsBox">
                    Eu li, compreendo e aceito os{' '}
                    <b
                      className="text-primary text-decoration-underline"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setShowTermsModal(true)}
                    >
                      Termos de Serviço
                    </b>{' '}
                    estruturais da Plataforma.
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input mt-1"
                    type="checkbox"
                    id="lgpdBox"
                    checked={aceiteLgpd}
                    onChange={(e) => setAceiteLgpd(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label className="form-check-label text-dark ms-2" htmlFor="lgpdBox">
                    Eu autorizo o Tratamento de Dados Pessoais sob custódia e declaro total
                    Compliance com a nova <b>Lei Geral de Proteção de Dados (LGPD)</b>.
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 fw-bold py-2 shadow-sm"
                disabled={loading || buscandoCnpj || !aceiteTermos || !aceiteLgpd}
              >
                {loading
                  ? 'Processando Informações...'
                  : inviteToken
                    ? 'Aceitar e Entrar no Escritório'
                    : 'Criar Conta de Escritório'}
              </button>

              <div className="text-center mt-4 pt-2 border-top">
                <p className="text-muted small">
                  Já é Assinante?{' '}
                  <Link to="/login" className="fw-bold text-decoration-none text-primary">
                    Acesse seu Painel
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL DE TERMOS OVERLAY (NATIVO) */}
      {showTermsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '15px',
          }}
        >
          <div
            className="bg-white shadow-lg"
            style={{
              width: '100%',
              maxWidth: '750px',
              height: '85vh',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div className="p-4 border-bottom bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bolder text-dark">📜 Termos de Serviço e EULA</h5>
              <button className="btn-close" onClick={() => setShowTermsModal(false)}></button>
            </div>

            {/* CORPO DE TEXTO ROLÁVEL */}
            <div
              className="p-4"
              style={{
                overflowY: 'auto',
                flex: 1,
                backgroundColor: '#fcfcfc',
                textAlign: 'justify',
              }}
              onScroll={handleScrollTerms}
            >
              <h5 className="fw-bold mb-3 text-dark border-bottom pb-2">
                1. ACEITAÇÃO DOS TERMOS E CONDIÇÕES
              </h5>
              <p className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                Ao criar uma conta, utilizar os softwares, acessar as APIs ou usufruir de qualquer
                serviço disponibilizado por este <strong>Software as a Service (SaaS)</strong>,
                doravante denominado <strong>Patronus</strong>, o USUÁRIO (Advogado, Sociedade de
                Advogados ou preposto autorizado) declara sua concordância plena, expressa,
                incondicional e irrevogável com os presentes Termos de Uso e Contrato de
                Licenciamento de Usuário Final (EULA), bem como com a Política de Privacidade e
                Tratamento de Dados (LGPD). Caso não concorde com qualquer disposição enumerada, o
                USUÁRIO deverá abster-se imediatamente de utilizar a plataforma.
              </p>

              <h5 className="fw-bold mt-4 mb-3 text-dark border-bottom pb-2">
                2. OBJETO E LICENCIAMENTO DO SOFTWARE
              </h5>
              <p className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                O Patronus consiste em uma solução de computação em nuvem destinada à gestão de
                atividades inerentes ao exercício da advocacia (controle processual, financeiro,
                captura OCR de documentos e agenda). A PLATAFORMA concede ao USUÁRIO, de forma não
                exclusiva, intransferível, temporária e onerosa (mediante planos de assinatura), o
                direito de uso remoto das funcionalidades sistêmicas. Fica terminantemente vedado,
                sob pena de infração à Lei nº 9.609/98 (Proteção da Propriedade Intelectual de
                Softwares):
              </p>
              <ul className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                <li>
                  Proceder com qualquer modalidade de engenharia reversa, descompilação ou
                  desestruturação do código-fonte e algoritmos (Machine Learning e OCR) embarcados
                  na infraestrutura.
                </li>
                <li>
                  Comercializar, sublicenciar, ceder, transferir, alugar ou compartilhar as
                  credenciais de acesso com terceiros estranhos ao Escritório (Tenant) cadastrado.
                </li>
              </ul>

              <h5 className="fw-bold mt-4 mb-3 text-dark border-bottom pb-2">
                3. ANS, SLA DE DISPONIBILIDADE E RESPONSABILIDADES
              </h5>
              <p className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                A Plataforma assume o compromisso de envidar seus melhores esforços para manter a
                disponibilidade transacional através da infraestrutura distribuída na AWS/Render,
                visando um Acordo de Nível de Serviço (SLA) de 99,8% de "Uptime" mensal,
                excetuando-se as janelas de manutenção programadas previamente comunicadas. Contudo,
                em virtude da complexidade intrínseca da infraestrutura mundial de internet:
              </p>
              <div className="bg-white p-3 rounded border border-danger mb-4 shadow-sm">
                <h6 className="fw-bold text-danger">
                  3.1 Cláusula de Isenção (Safe Harbor) - Perda de Prazos
                </h6>
                <p className="mb-0 text-dark" style={{ lineHeight: '1.6', fontSize: '0.85rem' }}>
                  O Patronus opera de forma a prover avisos automatizados através de tarefas ativas
                  na nuvem ("Cron Jobs") para notificar o USUÁRIO sobre prazos e audiências
                  processuais.{' '}
                  <strong>
                    Em hipótese alguma a Plataforma, seus diretores, programadores ou sócios poderão
                    ser responsabilizados cível, moral ou materialmente por eventuais intempéries
                    judiciais, incluindo perda de prazos cabais (preclusão). Eventual atraso no
                    envio do email SMTP por latência, bloqueios de antispam das provedoras globais
                    (Google/Microsoft), quedas de instâncias virtuais ou lapsos de sincronicidade
                    não constituem falha de prestação de serviço garantidor. A verificação
                    rotineira, manual e fidedigna dos autos junto aos Diários de Justiça Eletrônicos
                    (DJe) e Tribunais permanece como encargo único, inalienável e soberano do
                    Advogado constituído.
                  </strong>
                </p>
              </div>

              <h5 className="fw-bold mt-4 mb-3 text-dark border-bottom pb-2">
                4. COMPLIANCE LGPD E SEGURANÇA DA INFORMAÇÃO
              </h5>
              <p className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                As Partes declaram conformidade perene com as diretrizes e determinações da Lei nº
                13.709/2018 (Lei Geral de Proteção de Dados Pessoais). Para tal, os papéis
                processuais enquadram-se na seguinte tipificação rigorosa:
              </p>
              <ul className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                <li>
                  O USUÁRIO (Escritório) figura de maneira explícita como{' '}
                  <strong>Controlador dos Dados</strong> dos seus respectivos clientes e partes
                  processuais, determinando as bases legais de processamento e assegurando possuir
                  os consentimentos ou procurações necessárias para a inserção de dados estritamente
                  confidenciais nos bancos do software.
                </li>
                <li>
                  O Patronus atua única e exclusivamente sob a égide jurídica de{' '}
                  <strong>Operador dos Dados</strong>, restringindo-se à guarda de backups
                  imutáveis, provisão de túneis encriptados (SSL/TLS v1.3), hash de senhas de acesso
                  e custódia segura do banco de dados (PostgreSQL isolado por arquitetura
                  Multi-Tenant).
                </li>
                <li>
                  Em caso de solicitação de "Eliminação dos Dados" (Direito ao Esquecimento) por
                  parte do jurisdicionado, o Controlador (USUÁRIO) obriga-se a operacionalizar o
                  protocolo sistêmico de Exclusão Definitiva no Painel de Adminstração, de forma
                  autônoma e imediata.
                </li>
              </ul>

              <h5 className="fw-bold mt-4 mb-3 text-dark border-bottom pb-2">
                5. PROPRIEDADE INTELECTUAL E VIGÊNCIA
              </h5>
              <p className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                Os códigos, layouts estruturais, bancos de dados integrados, domínios, arquitetura
                UX/UI, logomarca oficial e sistemas operantes permanecem de plena e única
                propriedade intelectual da operadora original do sistema Patrimônio Tecnológico
                Patronus, sem que o acesso irrestrito fornecido configure aquisição de ações
                corporativas.
              </p>
              <p className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                Este instrumento surtirá efeitos imediatos e ostentará validade sistêmica duradoura,
                ressalvado o direito do Patronus de atualizar, retificar ou encorpar ditames
                judiciais neste EULA, com notificação prévia de 05 (cinco) dias úteis por via de
                comunicação massiva no balcão de avisos do painel.
              </p>

              <h5 className="fw-bold mt-4 mb-3 text-dark border-bottom pb-2">
                6. FORO E LEGISLAÇÃO APLICÁVEL
              </h5>
              <p className="text-secondary" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                O Contrato será regido e parametrizado pelas normas vigentes no ordenamento jurídico
                da República Federativa do Brasil, elegendo-se o foro da Comarca na qual o
                Desenvolvedor Primário mantêm as operações societárias como único competente para
                pacificar embargos ou controvérsias originárias, renunciando aos patronos outras
                instâncias territoriais mais acessíveis.
              </p>

              <br />
              <br />
            </div>

            <div className="p-3 border-top d-flex justify-content-between align-items-center bg-white">
              <span className="text-muted small fw-semibold">Obrigado por ler os termos.</span>
              <button
                type="button"
                className={`btn fw-bold px-4 btn-primary`}
                onClick={aceitarNoModal}
              >
                Aceitar e Concordar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RegisterPage
