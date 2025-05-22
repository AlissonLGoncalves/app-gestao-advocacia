// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Adicione aqui outras configurações do Vite, se necessário.
  // Por exemplo, se você precisar de um proxy para a sua API Flask:
  /*
  server: {
    proxy: {
      // Exemplo: Redireciona requisições de /api do frontend para o backend Flask
      '/api': {
        target: 'http://127.0.0.1:5000', // A URL do seu servidor Flask
        changeOrigin: true,
        // Não é necessário rewrite se o prefixo /api já existe no backend
        // rewrite: (path) => path.replace(/^\/api/, '') 
      }
    }
  }
  */
});
