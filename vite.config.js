import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    // 🔗 ENLACE AL BACKEND: Redirecciona todas las peticiones /api al puerto 3000
    proxy: {
      '/api': {
        target: 'https://redesigned-garbanzo-q75qxq4xjp7jh9xq-3000.app.github.dev',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    include: ['react-apexcharts', 'apexcharts']
  }
})