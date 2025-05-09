// ==================================================
// Conteúdo do arquivo: src/RelatoriosPage.js
// (Sem alterações)
// ==================================================
import React, { useState } from 'react';
import ContasAReceberReport from './ContasAReceberReport';
import ContasAPagarReport from './ContasAPagarReport';
const TIPOS_RELATORIO = { CONTAS_A_RECEBER: 'contasAReceber', CONTAS_A_PAGAR: 'contasAPagar',};
function RelatoriosPage() {
    const [relatorioAtivo, setRelatorioAtivo] = useState(TIPOS_RELATORIO.CONTAS_A_RECEBER);
    const renderRelatorioSelecionado = () => { /* ... */ };
    const navButtonStyle = "px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400";
    const activeNavButtonStyle = "bg-indigo-500 text-white"; const inactiveNavButtonStyle = "bg-gray-100 text-gray-600 hover:bg-gray-200";
    return ( <div className="p-4"> {/* ... JSX da página de relatórios ... */} </div> );
}
export default RelatoriosPage;