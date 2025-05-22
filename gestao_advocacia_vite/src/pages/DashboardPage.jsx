// src/pages/DashboardPage.jsx
import React from 'react';
import Dashboard from '../Dashboard.jsx'; // Certifique-se que o caminho para Dashboard.jsx está correto
import { useNavigate } from 'react-router-dom';

// Mapeamento das ANTIGAS constantes de SECOES para os NOVOS caminhos de rota
// O componente Dashboard.jsx ainda pode estar passando as strings como 'CLIENTES', 'CASOS', etc.
const SECAO_ANTIGA_PARA_ROTA = {
  CLIENTES: '/clientes',
  CASOS: '/casos',
  RECEBIMENTOS: '/recebimentos',
  DESPESAS: '/despesas',
  AGENDA: '/agenda',
  DOCUMENTOS: '/documentos',
  RELATORIOS: '/relatorios',
  DASHBOARD: '/dashboard'
  // Adicione outras seções que o Dashboard.jsx possa tentar navegar
};

function DashboardPage() {
  const navigate = useNavigate();

  // Esta função será passada para o componente Dashboard.jsx
  // Ela precisa traduzir o valor antigo (string como 'CLIENTES') para um caminho de rota.
  const handleMudarSecao = (secaoAntigaConstante) => {
    // Verifica se o valor recebido é uma chave no nosso mapeamento
    const targetPath = SECAO_ANTIGA_PARA_ROTA[secaoAntigaConstante] || '/dashboard'; // '/dashboard' como fallback
    navigate(targetPath);
  };

  // O componente Dashboard.jsx não deve mais importar SECOES do App.jsx
  // Ele receberá a função handleMudarSecao e a usará.
  return <Dashboard mudarSecao={handleMudarSecao} />;
}

export default DashboardPage;
