// src/pages/DashboardPage.jsx
import React from 'react';
import Dashboard from '../Dashboard.jsx'; // Ajuste o caminho se Dashboard.jsx não estiver na raiz de src
import { useNavigate } from 'react-router-dom';

function DashboardPage() {
  const navigate = useNavigate();

  // A função mudarSecao original passada para o Dashboard agora usará navigate
  const handleMudarSecao = (caminhoDaSecao) => {
    // O Dashboard enviava constantes como SECOES.CLIENTES.
    // Precisamos mapear isso para caminhos de rota.
    // Exemplo simples, pode precisar de um mapeamento mais robusto.
    let targetPath = '/dashboard'; // Padrão
    if (caminhoDaSecao === 'CLIENTES') targetPath = '/clientes';
    else if (caminhoDaSecao === 'CASOS') targetPath = '/casos';
    else if (caminhoDaSecao === 'RECEBIMENTOS') targetPath = '/recebimentos';
    else if (caminhoDaSecao === 'DESPESAS') targetPath = '/despesas';
    else if (caminhoDaSecao === 'AGENDA') targetPath = '/agenda';
    // Adicione outros mapeamentos conforme necessário

    navigate(targetPath);
  };

  return <Dashboard mudarSecao={handleMudarSecao} />;
}

export default DashboardPage;
