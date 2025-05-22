// src/pages/NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

console.log("NotFoundPage.jsx está a ser carregado.");

function NotFoundPage() {
  console.log("Componente NotFoundPage está a ser renderizado.");
  return (
    <div className="container text-center mt-5">
      <div className="py-5">
        <h1 className="display-1 fw-bold text-primary">404</h1>
        <h2 className="mb-3">Página Não Encontrada</h2>
        <p className="lead mb-4">
          Lamentamos, mas a página que você está a tentar aceder não existe ou foi movida.
        </p>
        <Link to="/dashboard" className="btn btn-primary btn-lg">
          Voltar para o Dashboard
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
