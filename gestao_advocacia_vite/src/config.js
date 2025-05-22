// src/config.js
// Define a URL base da sua API Flask.
// !!! IMPORTANTE: Ajuste esta URL para o endereço correto do seu backend Flask !!!
// Se o seu backend Flask estiver a correr localmente na porta 5000, esta URL está correta.
export const API_URL = 'http://127.0.0.1:5000/api/';

// Log para verificar se o config.js foi carregado e qual a API_URL
// Este log aparecerá no console do navegador quando este módulo for importado pela primeira vez.
console.log("Módulo config.js carregado. API_URL definida como:", API_URL);
