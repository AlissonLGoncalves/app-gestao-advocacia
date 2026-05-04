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
      // Mede todo src/ (antes era whitelist de 4 arquivos — ineficaz como gate).
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/setupTests.js',
        'src/main.jsx',
        '**/*.test.{js,jsx}',
        '**/__tests__/**',
        'src/api/**',
      ],
      // Threshold inicial baixo (medido: 15% lines / 11.5% functions / 15.2% branches).
      // Trava regressao sem forcar maratona retroativa. Sobe ~3pp por trimestre
      // conforme adicionamos teste em paginas novas (PortalPage, IntegracoesPage,
      // PrazosPage, RelatoriosPage atuais com 0%).
      thresholds: {
        lines: 12,
        statements: 12,
        functions: 10,
        branches: 12,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
