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
  build: {
    outDir: 'dist-site',
    rollupOptions: {
      output: {
        // Libraries in chunks of their own: they change far less often than the
        // site, so a deploy leaves them cached, and the entry chunk stays small.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (/node_modules\/(react-router|react-router-dom|@remix-run\/router)\//.test(id)) return 'router'
          if (/node_modules\/(tailwind-merge|clsx)\//.test(id)) return 'tailwind-merge'
        },
      },
    },
  },
  // X-ray names the component under the pointer from the rendered function's
  // own name, so the build has to keep those names rather than mangling them.
  esbuild: { keepNames: true },
  server: { port: Number(process.env.PORT) || 5173 },
})
