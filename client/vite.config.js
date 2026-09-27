import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6969,
    host: '0.0.0.0',
    strictPort: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
})
