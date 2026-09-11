import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/** Builds the standalone stylesheet, for consumers who do not run Tailwind. */
export default defineConfig({
  plugins: [tailwindcss()],
  // Nothing from public/ belongs in the package.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    cssMinify: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/styles/package.css', import.meta.url)),
      output: { assetFileNames: 'citrine.css' },
    },
  },
})
