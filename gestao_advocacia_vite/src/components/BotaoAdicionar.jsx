// src/components/BotaoAdicionar.jsx
import React from 'react';

const BotaoAdicionar = ({ onClick, texto }) => (
  <button
    onClick={onClick}
    className="btn btn-primary mb-3 d-flex align-items-center"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="me-2" width="18" height="18">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
    {texto}
  </button>
);

export default BotaoAdicionar;
