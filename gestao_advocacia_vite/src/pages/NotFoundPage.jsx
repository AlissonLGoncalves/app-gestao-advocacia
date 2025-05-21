// src/pages/NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="container text-center mt-5">
      <h1 className="display-1">404</h1>
      <h2>Página Não Encontrada</h2>
      <p className="lead">
        Desculpe, a página que você está procurando não existe ou foi movida.
      </p>
      <Link to="/dashboard" className="btn btn-primary mt-3">
        Voltar para o Dashboard
      </Link>
    </div>
  );
}

export default NotFoundPage;
