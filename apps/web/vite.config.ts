import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwind()],
  optimizeDeps: { exclude: ['neural-amp-modeler-wasm/engine'] },
  build: { license: { fileName: 'THIRD-PARTY-LICENSES.md' } },
  server: { port: 5173, strictPort: true },
})
