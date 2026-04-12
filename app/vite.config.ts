import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      clientPort: 5173,
      host: "app.winepooler.it",
    },
    allowedHosts: true,
  },
  plugins: [react()],
  define: {
    'process.env': process.env,
  },
})
