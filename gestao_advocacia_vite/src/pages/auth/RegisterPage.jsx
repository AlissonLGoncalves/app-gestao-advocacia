import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../../config';
import { toast } from 'react-toastify';
import { LockClosedIcon, UserIcon, EnvelopeIcon, BuildingOfficeIcon, IdentificationIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

function RegisterPage() {
  const [tipoPessoa, setTipoPessoa] = useState('PF');
  const [documento, setDocumento] = useState('');
  const [nomeOuRazao, setNomeOuRazao] = useState('');
  const [oab, setOab] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Gatekeepers LGPD
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  
  // Gatekeeper de Scroll Obrigatório (Termos)
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // Algoritmo que detecta quando a barra de rolagem atinge o fundo
  const handleScrollTerms = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Se a barra estiver a 10px ou menos do fim, libera.
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      setScrolledToBottom(true);
    }
  };

  const aceitarNoModal = () => {
    setAceiteTermos(true);
    setShowTermsModal(false);
  };

  const [loading, setLoading] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const navigate = useNavigate();

  // Função para aplicar máscara dinâmica no CPF ou CNPJ
  const handleDocumentChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); // Remove não números
    if (tipoPessoa === 'PF') {
      if (val.length > 11) val = val.slice(0, 11);
      val = val.replace(/(\d{3})(\d)/, '$1.$2');
      val = val.replace(/(\d{3})(\d)/, '$1.$2');
      val = val.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      if (val.length > 14) val = val.slice(0, 14);
      val = val.replace(/^(\d{2})(\d)/, '$1.$2');
      val = val.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      val = val.replace(/\.(\d{3})(\d)/, '.$1/$2');
      val = val.replace(/(\d{4})(\d)/, '$1-$2');
    }
    setDocumento(val);
    
    // Se for CNPJ e estiver completo, busca na API!
    if (tipoPessoa === 'PJ' && val.replace(/\D/g, '').length === 14) {
      buscarCNPJ(val.replace(/\D/g, ''));
    }
  };

  const buscarCNPJ = async (cnpjLimpo) => {
    setBuscandoCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (response.ok) {
        const data = await response.json();
        setNomeOuRazao(data.razao_social || data.nome_fantasia || '');
        toast.success("Empresa localizada pela Receita Federal!");
      } else {
        toast.warning("CNPJ não encontrado. Preencha manualmente.");
      }
    } catch (e) {
      console.error(e);
      toast.warning("Falha ao consultar CNPJ.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    toast.dismiss(); 

    if (!nomeOuRazao || !email || !password || !documento) {
        toast.error("Por favor, preencha todos os campos obrigatórios.");
        setLoading(false);
        return;
    }

    if (!aceiteTermos || !aceiteLgpd) {
        toast.error("Para prosseguir, você deve aceitar os Termos de Serviço e as Políticas de LGPD.");
        setLoading(false);
        return;
    }

    if (password.length < 6) {
        toast.error("A senha deve ter no mínimo 6 caracteres.");
        setLoading(false);
        return;
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
          oab: oab || null
        })
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Conta Criada! Seu Escritório Mestre foi gerado.");
        navigate('/login'); 
      } else {
        toast.error(data.message || "Falha no registro. Verifique os dados.");
      }
    } catch (error) {
      console.error("Erro ao tentar registrar SaaS:", error);
      toast.error("Erro de rede. Nosso servidor pode estar indisponível.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid d-flex align-items-center justify-content-center min-vh-100 py-5" style={{ backgroundColor: '#0f172a' }}>
      <div className="card shadow-lg border-0" style={{ width: '100%', maxWidth: '800px', overflow: 'hidden' }}>
        <div className="row g-0">
          
          {/* Painel Esquerdo: Marketing / SaaS Message */}
          <div className="col-md-5 text-white p-5 d-flex flex-column justify-content-between" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
            <div>
              <img src="/logo.png" alt="Patronus Logo" className="mb-4 shadow-sm" style={{ width: '80px', borderRadius: '14px' }} />
              <h2 className="fw-bolder mb-3">Patronus</h2>
              <p className="lead fw-normal text-white-50">Sua Advocacia sem Fronteiras.</p>
              
              <ul className="list-unstyled mt-5">
                <li className="mb-3 d-flex align-items-center"><CheckCircleIcon className="me-2" style={{width: '24px', opacity: 0.8}}/> 100% de Controle B2B</li>
                <li className="mb-3 d-flex align-items-center"><CheckCircleIcon className="me-2" style={{width: '24px', opacity: 0.8}}/> Captura Inteligente OCR</li>
                <li className="mb-3 d-flex align-items-center"><CheckCircleIcon className="me-2" style={{width: '24px', opacity: 0.8}}/> Compliance Total LGPD</li>
                <li className="d-flex align-items-center"><CheckCircleIcon className="me-2" style={{width: '24px', opacity: 0.8}}/> Multi-Usuários Ilimitados</li>
              </ul>
            </div>
            <div className="mt-5">
              <small className="text-white-50">Ambiente Seguro & Encriptado.</small>
            </div>
          </div>

          {/* Painel Direito: Formulário de Onboarding */}
          <div className="col-md-7 p-4 p-md-5 bg-white">
            <h4 className="fw-bold mb-1 text-dark">Cadastrar Escritório</h4>
            <p className="text-muted small mb-4">Selecione o tipo de registro institucional.</p>
            
            <form onSubmit={handleRegister}>
              
              {/* Type Toggle */}
              <div className="d-flex gap-2 mb-4 bg-light p-1 rounded-3 border">
                <button 
                  type="button" 
                  className={`btn p-2 w-50 fw-semibold rounded-2 border-0 ${tipoPessoa === 'PF' ? 'btn-primary' : 'btn-light text-muted'}`}
                  onClick={() => { setTipoPessoa('PF'); setDocumento(''); setNomeOuRazao(''); setOab(''); }}
                >
                  <UserIcon className="d-inline-block me-2 mb-1" style={{ width: '18px'}} />
                  Pessoa Física
                </button>
                <button 
                  type="button" 
                  className={`btn p-2 w-50 fw-semibold rounded-2 border-0 ${tipoPessoa === 'PJ' ? 'btn-primary' : 'btn-light text-muted'}`}
                  onClick={() => { setTipoPessoa('PJ'); setDocumento(''); setNomeOuRazao(''); setOab(''); }}
                >
                  <BuildingOfficeIcon className="d-inline-block me-2 mb-1" style={{ width: '18px'}} />
                  Pessoa Jurídica
                </button>
              </div>

              {/* Documento & OAB */}
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
                    required
                    disabled={loading || buscandoCnpj}
                  />
                  {buscandoCnpj && <small className="text-primary d-block mt-1">Consultando Receita Federal...</small>}
                </div>
                {tipoPessoa === 'PF' && (
                  <div className="col-md-4">
                    <label className="form-label mb-1 text-secondary small fw-bold">OAB (Opcional)</label>
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

              {/* Main Auth Form */}
              <div className="mb-3">
                <label className="form-label mb-1 text-secondary small fw-bold">
                  {tipoPessoa === 'PF' ? 'Nome Completo do Advogado' : 'Razão Social do Escritório'}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={nomeOuRazao}
                  onChange={(e) => setNomeOuRazao(e.target.value)}
                  placeholder={tipoPessoa === 'PF' ? 'Dr. João Silva' : 'Escritório Silva & Associados'}
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-3">
                <label className="form-label mb-1 text-secondary small fw-bold">Email de Acesso (Administrador)</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-4">
                <label className="form-label mb-1 text-secondary small fw-bold">Senha Mestre</label>
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
              <div className="bg-light p-3 rounded mb-4 border" style={{fontSize: '0.85rem'}}>
                <div className="form-check mb-3">
                  <input 
                    className="form-check-input mt-1" 
                    type="checkbox" 
                    id="termsBox" 
                    checked={aceiteTermos} 
                    disabled={!scrolledToBottom} 
                    onChange={(e)=>setAceiteTermos(e.target.checked)} 
                    style={{cursor: !scrolledToBottom ? 'not-allowed' : 'pointer', width: '18px', height: '18px'}}
                  />
                  <label className="form-check-label text-dark ms-2" htmlFor="termsBox">
                    Eu li, compreendo e aceito os <b className="text-primary text-decoration-underline" style={{cursor: 'pointer'}} onClick={() => setShowTermsModal(true)}>Termos de Serviço</b> estruturais da Plataforma.
                    {!scrolledToBottom && <span className="d-block text-danger mt-1" style={{fontSize: '0.75rem'}}>* Você deve abrir e ler os Termos até o final para destravar o aceite.</span>}
                  </label>
                </div>
                <div className="form-check">
                  <input className="form-check-input mt-1" type="checkbox" id="lgpdBox" checked={aceiteLgpd} onChange={(e)=>setAceiteLgpd(e.target.checked)} style={{width: '18px', height: '18px'}} />
                  <label className="form-check-label text-dark ms-2" htmlFor="lgpdBox">
                    Eu autorizo o Tratamento de Dados Pessoais sob custódia e declaro total Compliance com a nova <b>Lei Geral de Proteção de Dados (LGPD)</b>.
                  </label>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-100 fw-bold py-2 shadow-sm" disabled={loading || buscandoCnpj}>
                {loading ? 'Preparando Espaço de Trabalho...' : 'Criar Conta de Escritório'}
              </button>

              <div className="text-center mt-4 pt-2 border-top">
                <p className="text-muted small">
                  Já é Assinante? <Link to="/login" className="fw-bold text-decoration-none text-primary">Acesse seu Painel</Link>
                </p>
              </div>
              
            </form>
          </div>
        </div>
      </div>

      {/* MODAL DE TERMOS OVERLAY (NATIVO) */}
      {showTermsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, 
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px'
        }}>
          <div className="bg-white shadow-lg" style={{
            width: '100%', maxWidth: '750px', height: '85vh', 
            borderRadius: '16px', display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div className="p-4 border-bottom bg-light d-flex justify-content-between align-items-center">
               <h5 className="mb-0 fw-bolder text-dark">📜 Termos de Serviço e EULA</h5>
               <button className="btn-close" onClick={() => setShowTermsModal(false)}></button>
            </div>
            
            {/* CORPO DE TEXTO ROLÁVEL */}
            <div className="p-4" style={{overflowY: 'auto', flex: 1, backgroundColor: '#fcfcfc'}} onScroll={handleScrollTerms}>
              <h4 className="fw-bold mb-3 text-dark border-bottom pb-2">1. Das Definições e do Objeto</h4>
              <p className="text-secondary" style={{lineHeight: '1.7'}}>O presente instrumento jurídico estabelece e disciplina a relação de licenciamento de uso de software corporativo na modalidade <strong>Software as a Service (SaaS)</strong>, doravante denominado <strong>Patronus</strong>. O Usuário/Contratante, pessoa física devidamente inscrita na Ordem dos Advogados do Brasil (OAB) ou pessoa jurídica constituída sob a forma de Sociedade de Advogados, ao concluir o processo de cadastro e clique na caixa de aceite, manifesta sua concordância tácita, inequivocável e irrevogável com todos os preceitos arrolados.</p>

              <h4 className="fw-bold mt-4 mb-3 text-dark border-bottom pb-2">2. Da Licença de Uso e Restrições</h4>
              <p className="text-secondary" style={{lineHeight: '1.7'}}>É concedida ao Usuário uma licença não exclusiva, temporária, revogável e intransferível de uso do Software para fins estritamente vinculados ao gerenciamento interno de sua própria carteira de clientes, acompanhamento de prazos, monitoramento processual automatizado, faturamento financeiro e emissão de relatórios.</p>
              <ul className="text-secondary" style={{lineHeight: '1.7'}}>
                <li>É terminantemente proibido o sublicenciamento, a venda, cessão, engenharia reversa (<i>reverse engineering</i>), descompilação ou qualquer tentativa de extração do código-fonte.</li>
                <li>A Plataforma emprega a arquitetura <strong>Multi-Tenant isolada</strong>. É vedado ao Usuário fornecer suas credenciais a terceiros estranhos ao seu escritório, sob pena de bloqueio imediato.</li>
              </ul>

              <h4 className="fw-bold mt-4 mb-3 text-dark border-bottom pb-2">3. Limitação de Falibilidade Técnica</h4>
              <p className="text-secondary" style={{lineHeight: '1.7'}}>O Patronus atua como um <strong>Facilitador Tecnológico</strong>. A responsabilidade originária, moral e civil, por atos processuais pertence integralmente ao advogado cadastrado.</p>
              <div className="bg-white p-3 rounded border border-danger mb-4 shadow-sm">
                <h6 className="fw-bold text-danger">Cláusula de Isenção (Safe Harbor) - Alertas CRON</h6>
                <p className="mb-0 text-dark small" style={{lineHeight: '1.5'}}>
                  O sistema possui rotinas computacionais ativas na nuvem (AWS/Render) para notificar o Usuário sobre prazos com 7 e 3 dias de antecedência. Contudo, <strong>atrasos em filas de e-mail (SMTP), bloqueios por filtros de Spam, *downtimes* de servidores ou lapsos no cômputo da contagem não geram qualquer responsabilidade material ou moral para o Patronus face a eventuais perdas de Prazos. A verificação manual dos expedientes permanece como dever intransferível do Escritório.</strong>
                </p>
              </div>

              <h4 className="fw-bold mt-4 mb-3 text-dark border-bottom pb-2">4. Lei Geral de Proteção de Dados (LGPD)</h4>
              <ul className="text-secondary" style={{lineHeight: '1.7'}}>
                <li>O Usuário/Escritório é definido como o <strong>Controlador de Dados</strong>. O Patronus atua única e exclusivamente como <strong>Operador</strong>, encriptando senhas e acautelando bancos de dados.</li>
                <li>A inserção de dados sensíveis médicos, criminais ou processuais requer que o Advogado já possua procuração e consentimento de seu cliente.</li>
                <li>Ao receber um pleito de eliminação previsto no Art. 18 da LGPD, o Advogado Controlador se obriga a extinguir diretamente as informações ativas em seu painel usando as ferramentas de eliminação do Patronus.</li>
              </ul>

              <br/><br/><br/>
            </div>
            
            <div className="p-3 border-top d-flex justify-content-between align-items-center bg-white">
               <span className="text-muted small fw-semibold">
                  {!scrolledToBottom ? '🛑 Role até o final para confirmar a leitura ↓' : '✅ Leitura confirmada!'}
               </span>
               <button 
                 type="button" 
                 className={`btn fw-bold px-4 ${scrolledToBottom ? 'btn-primary' : 'btn-secondary'}`} 
                 disabled={!scrolledToBottom} 
                 onClick={aceitarNoModal}
               >
                 Aceitar e Concordar
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default RegisterPage;
