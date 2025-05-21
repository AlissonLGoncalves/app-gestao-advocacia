// Arquivo: src/main.jsx
// Ponto de entrada da aplicação React no Vite.

// 1. Importa o CSS principal do Bootstrap.
import 'bootstrap/dist/css/bootstrap.min.css';

// 2. (Opcional) Importa o JavaScript do Bootstrap.
// import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// 3. Importa as bibliotecas React.
import React from 'react'; // Esta deve ser a ÚNICA importação do 'React'
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Importa BrowserRouter

// 4. Importa o seu componente principal da aplicação.
import App from './App.jsx';

// 5. Importa o seu arquivo CSS global personalizado.
import './index.css'; // Se você tiver estilos globais aqui

// 6. Renderiza o componente App na div com id="root" do seu index.html.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* Envolve o App com BrowserRouter */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
