import React from 'react';
import { ShieldCheckIcon, DocumentTextIcon, CheckBadgeIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

function TermsPage() {
  return (
    <div className="container-fluid bg-light min-vh-100 py-5">
      <div className="container bg-white shadow-sm rounded-4 p-4 p-md-5" style={{ maxWidth: '1000px' }}>
        
        <div className="text-center mb-5 border-bottom pb-4">
          <ScaleIcon className="text-primary mb-3" style={{ width: '70px' }} />
          <h1 className="fw-bolder">Termos de Uso e Acordo de Licenciamento (EULA)</h1>
          <p className="text-muted mb-0">Plataforma Patronus Cloud SaaS</p>
          <small className="text-secondary">Última atualização: {new Date().toLocaleDateString()} - Revisão v.2.4</small>
        </div>

        <div className="text-justify" style={{ lineHeight: '1.8', color: '#374151' }}>
          
          <h4 className="fw-bold mb-3 text-dark border-bottom pb-2">1. ACEITAÇÃO DOS TERMOS E CONDIÇÕES</h4>
          <p>
            Ao criar uma conta, utilizar os softwares, acessar as APIs ou usufruir de qualquer serviço disponibilizado por este <strong>Software as a Service (SaaS)</strong>, doravante denominado <strong>Patronus</strong>, o USUÁRIO (Advogado, Sociedade de Advogados ou preposto autorizado) declara sua concordância plena, expressa, incondicional e irrevogável com os presentes Termos de Uso e Contrato de Licenciamento de Usuário Final (EULA), bem como com a Política de Privacidade e Tratamento de Dados (LGPD). Caso não concorde com qualquer disposição enumerada, o USUÁRIO deverá abster-se imediatamente de utilizar a plataforma.
          </p>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">2. OBJETO E LICENCIAMENTO DO SOFTWARE</h4>
          <p>
            O Patronus consiste em uma solução de computação em nuvem destinada à gestão de atividades inerentes ao exercício da advocacia (controle processual, financeiro, captura OCR de documentos e agenda). A PLATAFORMA concede ao USUÁRIO, de forma não exclusiva, intransferível, temporária e onerosa (mediante planos de assinatura mensal/anual), o direito de uso remoto das funcionalidades sistêmicas. Fica terminantemente vedado, sob pena de infrações puníveis pela Lei nº 9.609/98:
          </p>
          <ul className="mb-4">
            <li>Proceder com qualquer modalidade de engenharia reversa, descompilação ou desestruturação sintática do código-fonte e algoritmos proprietários embutidos na infraestrutura.</li>
            <li>Comercializar, sublicenciar, ceder, transferir, alugar ou exibir dados mediante a técnica de *web scraping* não autorizada em massa.</li>
            <li>A Plataforma emprega a arquitetura <strong>Multi-Tenant isolada</strong>. É vedado ao Usuário fornecer suas chaves criptográficas de autenticação a corporações estranhas ao Tenant cadastrado.</li>
          </ul>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">3. ANS, SLA DE DISPONIBILIDADE E RESPONSABILIDADES</h4>
          <p>
            A Plataforma assume o compromisso empresarial de envidar seus melhores e maiores esforços práticos para manter a disponibilidade ininterrupta das conexões provisionadas (SLA global de 99,8% de *Uptime*), blindando os arquivos contra ataques cibernéticos rotineiros (via instâncias Vercel Firewall e Render Private Networks). Contudo, imperfeições na conectividade intrínseca mundial isentam o Patronus do instituto de falha da prestação civil em panes gerais de provedores.
          </p>
          <div className="bg-light p-4 rounded-3 border border-danger mb-4 shadow-sm">
            <h6 className="fw-bold text-danger">3.1 Cláusula de Isenção Transacional (Safe Harbor) - Perda de Prazos</h4>
            <p className="mb-0 text-dark" style={{fontSize: '0.9rem', lineHeight: '1.6'}}>
              Em virtude do software operar algoritmos reativos aos Diários e tribunais externos, bem como disparar ações de notificação via serviços vitais de terceiros (SMTP E-mails), o software possui limites técnicos. <strong>Em hipótese alguma a Plataforma, seus idealizadores patrimoniais, diretores executivos ou consultores de arquitetura Cloud poderão ser responsabilizados cível, criminal, moral ou materialmente por eventuais lides perdedoras, danos operacionais de escritórios e perdas de prazos (incluindo preclusões, revelias e sentenças desfavoráveis). Falhas de Cronograma que impeçam a chegada dos e-mails temporais não constituem descumprimento material de serviço. A verificação manual incansável dos andamentos cartorários permanece obrigação primária do causídico signatário.</strong>
            </p>
          </div>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">4. COMPLIANCE LGPD E SEGURANÇA DA INFORMAÇÃO</h4>
          <p>
            O tratamento eletrônico executado dentro dos limites sistêmicos da plataforma subsiste em rígida anuência às orientações propostas pelo ordenamento sancionado na LGPD Brasileira. A simetria processual se assenta na separação basilar a respeito das competências vigentes:
          </p>
          <ul className="mb-4">
            <li className="mb-2"><strong>Papel dos Atores:</strong> O Escritório Contratante responde como o Único e Absoluto <strong>Controlador do Banco de Dados Primário</strong> sob custódia, atestando ter base jurídica consolidada que autorize atar a submissão dos dados pessoais sensíveis de partes, testemunhas e litigantes nas interfaces virtuais do sistema.</li>
            <li className="mb-2"><strong>Limitações do Operador:</strong> O Patronus é unicamente definido como <strong>Operador Digital</strong> de repositório, isentando-se de averiguar a veracidade dos dados sensíveis informados, possuindo como incumbência puramente atuar no acautelamento com Hash Criptográfico das senhas e garantir o isolamento arquitetônico dos nós do banco SQL.</li>
            <li className="mb-2"><strong>Direito Autônomo ao Esquecimento:</strong> Caso o Controlador (Escritório) seja notificado judicial ou extra-judicialmente pelo titular para obliteração de memórias, cabe a ele manusear os botões de eliminação dispostos nas telas do administrador para zerar o dossiê daquele cliente em trâmite na nuvem, finalizando irreversivelmente suas referências ativas (Art. 18, Lei 13.709).</li>
          </ul>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">5. PROPRIEDADE MESTRA E ASSINATURAS FINANCEIRAS</h4>
          <p>
            Toda a engenharia de dados, *front-end*, interface visual, logos e arranjos vetoriais hospedados neste código não são vendidas, mas apenas locadas. Alterações drásticas no sistema podem exigir readequação contratual ou alteração dos cronogramas preexistentes dos planos de subscrição mensal ou anual. Inadimplementos de faturas prolongados geram a automática reversão do acesso, mantido por 30 (trinta) dias de margem um portal provisório de salvamento das memórias (CSV Files) por parte do caloteiro ou remanescente financeiro temporário, após o qual o banco entra em modo de Reciclagem Periódica.
          </p>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">6. ESTATUTO DECISÓRIO (FORO)</h4>
          <p>
            O texto encontra repouso nas diretrizes ordenadas pelos Tribunais Judiciários do Brasil. Ocasional animosidade oriunda destas linhas, uma vez transcorrida em branco a tentativa de aproximação negociada entre as Partes, se compromete a eleger a circunscrição cível da cidade-sede dos desenvolvedores proprietários do sistema para a instauração processual impeditiva, excluindo quaisquer demais por maior proximidade do Cliente.
          </p>
        </div>

        <div className="text-center mt-5 pt-4 border-top">
           <Link to="/register" className="btn btn-primary px-5 py-3 fw-bold shadow">
              Li, Compreendi e Concordo Plenamente
           </Link>
           <p className="text-muted small mt-3">A assinatura destes termos é firmada digitalmente através da trilha de IP e Timestamp na Base de Dados Patronus no momento do Registro.</p>
        </div>

      </div>
    </div>
  );
}

export default TermsPage;
