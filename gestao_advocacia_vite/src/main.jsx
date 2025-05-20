// Arquivo: src/main.js (ou src/main.jsx se o Vite o criou com essa extensão)
// Este é o ponto de entrada da sua aplicação React no Vite.
// Atualizado para importar App.jsx

// 1. Importa o CSS principal do Bootstrap.
import 'bootstrap/dist/css/bootstrap.min.css';

// 2. (Opcional) Importa o JavaScript do Bootstrap.
// import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// 3. Importa as bibliotecas React.
import React from 'react';
import ReactDOM from 'react-dom/client';

// 4. Importa o seu componente principal da aplicação.
// ATUALIZADO para importar App.jsx
import App from './App.jsx'; 

// 5. Importa o seu arquivo CSS global personalizado.
import './index.css';

// 6. Renderiza o componente App na div com id="root" do seu index.html.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
