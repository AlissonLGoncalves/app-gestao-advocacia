// src/pages/RelatoriosPage.jsx
import React, { useState } from 'react';
// Ajuste estes caminhos se ContasAReceberReport.jsx e ContasAPagarReport.jsx estiverem em outro local
// Por exemplo, se estiverem em src/components/reports/
import ContasAReceberReport from '../ContasAReceberReport.jsx';
import ContasAPagarReport from '../ContasAPagarReport.jsx';

console.log("RelatoriosPage.jsx está a ser carregado.");

const TIPOS_RELATORIO = {
  NENHUM: 'NENHUM',
  CONTAS_A_RECEBER: 'CONTAS_A_RECEBER',
  CONTAS_A_PAGAR: 'CONTAS_A_PAGAR',
};

function RelatoriosPage() {
  const [relatorioAtivo, setRelatorioAtivo] = useState(TIPOS_RELATORIO.NENHUM);
  console.log("Componente RelatoriosPage está a ser renderizado. Relatório ativo:", relatorioAtivo);

  const renderRelatorioSelecionado = () => {
    console.log("RelatoriosPage: renderRelatorioSelecionado chamado com:", relatorioAtivo);
    switch (relatorioAtivo) {
      case TIPOS_RELATORIO.CONTAS_A_RECEBER:
        return <ContasAReceberReport />;
      case TIPOS_RELATORIO.CONTAS_A_PAGAR:
        return <ContasAPagarReport />;
      default:
        return <p className="text-center text-muted">Selecione um tipo de relatório para visualizar.</p>;
    }
  };

  return (
    <div className="container-fluid mt-3">
      <div className="card shadow-sm">
        <div className="card-header bg-light">
          <h5 className="mb-0">Central de Relatórios</h5>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <label htmlFor="selectRelatorio" className="form-label form-label-sm">Selecione o Relatório:</label>
            <select
              id="selectRelatorio"
              className="form-select form-select-sm"
              value={relatorioAtivo}
              onChange={(e) => {
                console.log("RelatoriosPage: Novo relatório selecionado:", e.target.value);
                setRelatorioAtivo(e.target.value);
              }}
            >
              <option value={TIPOS_RELATORIO.NENHUM}>-- Escolha um Relatório --</option>
              <option value={TIPOS_RELATORIO.CONTAS_A_RECEBER}>Contas a Receber</option>
              <option value={TIPOS_RELATORIO.CONTAS_A_PAGAR}>Contas a Pagar</option>
            </select>
          </div>
          <hr />
          <div className="mt-4">
            {renderRelatorioSelecionado()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RelatoriosPage;
