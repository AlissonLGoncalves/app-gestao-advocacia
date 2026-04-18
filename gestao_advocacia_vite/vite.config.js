// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/ClienteForm.jsx',
        'src/CasoForm.jsx',
        'src/components/HonorariosCasoCard.jsx',
        'src/pages/auth/LoginPage.jsx',
      ],
    },
  },
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
})
