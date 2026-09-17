import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { directImports, registerComponents } from './vite.klyv'

export default defineConfig({
  plugins: [registerComponents(), directImports(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The docs site imports the library by its package name, exactly as a
      // consumer would - so every snippet on the site is copy-pasteable.
      klyv: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  // The package owns dist/; the site builds beside it.
  build: { outDir: 'dist-site' },
  server: { port: Number(process.env.PORT) || 5173 },
})
