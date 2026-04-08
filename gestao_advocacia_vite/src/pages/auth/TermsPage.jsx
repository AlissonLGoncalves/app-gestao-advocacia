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
          
          <h4 className="fw-bold mb-3 text-dark border-bottom pb-2">1. Das Definições e do Objeto</h4>
          <p>
            O presente instrumento jurídico ("Termos") estabelece e disciplina a relação de licenciamento de uso de software corporativo na modalidade <strong>Software as a Service (SaaS)</strong>, doravante denominado <strong>Patronus</strong>, de titularidade exclusiva de seus desenvolvedores. 
            O <strong>Usuário/Contratante</strong>, pessoa física devidamente inscrita na Ordem dos Advogados do Brasil (OAB) ou pessoa jurídica constituída sob a forma de Sociedade de Advogados, ao concluir o processo de cadastro e clique na caixa de aceite (<i>Clickwrap Agreement</i>), manifesta sua concordância tácita, inequivocável e irrevogável com todos os preceitos arrolados.
          </p>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">2. Da Licença de Uso, Escopo e Restrições</h4>
          <p>
            É concedida ao Usuário uma licença não exclusiva, temporária, revogável e intransferível de uso do Software para fins estritamente vinculados ao gerenciamento interno de sua própria carteira de clientes, acompanhamento de prazos, monitoramento processual automatizado, faturamento financeiro (Honorários) e emissão de relatórios de Business Intelligence.
          </p>
          <ul className="mb-4">
            <li>É terminantemente proibido o sublicenciamento, a venda, cessão, engenharia reversa (<i>reverse engineering</i>), descompilação ou qualquer tentativa de extração do código-fonte, algoritmos de Machine Learning e OCR acoplados ao Patronus.</li>
            <li>A Plataforma emprega a arquitetura <strong>Multi-Tenant isolada</strong>. É vedado ao Usuário fornecer suas credenciais (Tokens de Acesso JWT) a terceiros estranhos ao seu escritório, sob pena de bloqueio imediato e apuração de dolo corporativo em caso de vazamento cruzado.</li>
          </ul>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">3. Limitação de Responsabilidade e Falibilidade Técnica</h4>
          <p>
            O Patronus atua como um <strong>Facilitador Tecnológico e Repositório Digital</strong>. Não ostentamos a natureza de ferramenta fiduciária imune a falhas intercorrentes de conectividade global. A responsabilidade originária, moral e civil, por atos processuais e judiciais, pertence integralmente ao causídico (Advogado) cadastrado.
          </p>
          <div className="bg-light p-4 rounded-3 border mb-4">
            <h6 className="fw-bold text-danger">Cláusula de Isenção (Safe Harbor) - Prazos e Alertas CRON</h6>
            <p className="mb-0 small">
              O sistema possui "Cron Jobs" autônomos que realizam rotinas computacionais diárias na nuvem (AWS/Render) com a finalidade de notificar o Usuário, via E-mail, sobre audiências e prazos fatais com 7 e 3 dias de antecedência. 
              <strong> Contudo, a Plataforma declara e o Usuário consente que atrasos em filas de e-mail (SMTP), bloqueios por filtros de Spam, *downtimes* de instâncias, ou lapsos no cômputo da contagem não geram qualquer responsabilidade material ou moral para o Patronus face a eventuais perdas de Prazos Processuais. A verificação manual dos expedientes junto aos Tribunais permanece como dever intransferível da Assessoria Jurídica contratante.</strong>
            </p>
          </div>
          <p>
            Acordamos um Service Level Agreement (SLA) de 99,9% de Uptime anual das APIs operadas pela arquitetura Render e do Frontend Vercel Edge Networks, não computadas interrupções programadas para manutenção ("Janelas de Manutenção") e atos de Força Maior.
          </p>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">4. Lei Geral de Proteção de Dados (Compliance Ativo LGPD)</h4>
          <p>
            Este dispositivo encontra-se em estrita consonância com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD). Fica delineada a seguinte matriz de competências:
          </p>
          <ul className="mb-4">
            <li className="mb-2"><strong>Papel dos Atores:</strong> O Usuário/Escritório é definido, para todos os efeitos legais, como o <strong>Controlador de Dados</strong> de seus clientes ("Titulares"). O Patronus atua única e exclusivamente como <strong>Operador</strong>, processando logs, encriptando senhas e acautelando bancos de dados em nuvem.</li>
            <li className="mb-2"><strong>Base Legal e Prevenção:</strong> A inserção de dados sensíveis médicos, criminais ou familiares de terceiros pelo Usuário dentro das *Pastas Virtuais* do Patronus requer que o Advogado já possua procuração, contrato e base legal devidamente lastreadas com seu cliente (Titular).</li>
            <li className="mb-2"><strong>Logs de Auditoria e Imutabilidade:</strong> Nós utilizamos registros de sistemas (Audit Trails) rastreando o acesso aos dados sensíveis para fins de colaboração com autoridades e comprovação de higidez contra invasões.</li>
            <li className="mb-2"><strong>Direito ao Esquecimento e Inanonimização:</strong> Ao receber um pleito de eliminação previsto no Art. 18 da LGPD, o Advogado/Controlador se obriga a extinguir diretamente as informações ativas em seu painel usando a funcionalidade de "Exclusão Definitiva" ou de "Ofuscamento Parcial", momento no qual o Patronus providenciará a exclusão nos nós do Banco de Dados PostgreSQL sem possibilidade de resgate por espelhos.</li>
          </ul>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">5. Das Disposições Finais e Preços</h4>
          <p>
            Os honorários pelo licenciamento do software ocorrerão na modalidade de recorrência contínua (SaaS - Planos Mensais/Anuais), sem direito a retenção de base estrutural em caso de inadimplência, garantido o direito inalienável do Usuário de exportar sua carteira de contatos via recursos CSV/PDF oficiais antes de eventuais cancelamentos.
          </p>

          <h4 className="fw-bold mt-5 mb-3 text-dark border-bottom pb-2">6. Foro</h4>
          <p>
            Para dirimir quaisquer controvérsias decorrentes das obrigações previstas nestes Termos, ou oriundas das relações de licenciamento B2B, as partes elegem livremente o foro da Comarca na qual o Usuário possui sede principal registrada, dispensando-se câmaras de mediação preliminares, exceto quando imposto por legislação pátria suprema.
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
