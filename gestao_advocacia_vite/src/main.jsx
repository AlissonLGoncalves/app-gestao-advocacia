// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx'; // Importa o componente App principal

// Importações de CSS globais
import 'bootstrap/dist/css/bootstrap.min.css'; // CSS do Bootstrap
import './index.css'; // Seus estilos globais personalizados

// Log para indicar que o main.jsx foi carregado
console.log("Módulo main.jsx carregado e a executar.");

// Verifica se o elemento root existe no DOM
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Erro Crítico: Elemento com id 'root' não encontrado no DOM. Verifique o seu arquivo public/index.html ou index.html na raiz do projeto.");
} else {
  // Cria a raiz do React e renderiza a aplicação
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
  console.log("Aplicação React renderizada no elemento #root.");
}

// Opcional: Se você usa reportWebVitals e o arquivo existe
// import reportWebVitals from './reportWebVitals';
// if (typeof reportWebVitals === 'function') {
//   reportWebVitals(console.log); // Ou envie para um endpoint de analytics
// }
