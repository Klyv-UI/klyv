import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * The publishable build.
 *
 * Separate from the docs-site config on purpose: that one bundles an app, this
 * one emits a library. Nothing under `src/site` is reachable from `src/index.ts`,
 * so the site cannot leak into the package.
 */

/**
 * Rollup drops module-level directives and warns about it, which would strip
 * every `'use client'` in the library and break the package on the App Router.
 * This records which modules carried one and puts it back on their chunk.
 */
function preserveClientDirectives(): Plugin {
  const clientModules = new Set<string>()

  return {
    name: 'citrine:preserve-use-client',
    transform(code, id) {
      if (/^\s*['"]use client['"]/.test(code)) clientModules.add(id)
      return null
    },
    renderChunk(code, chunk) {
      const needsDirective = Object.keys(chunk.modules).some((id) => clientModules.has(id))
      if (!needsDirective) return null
      return { code: `'use client'\n${code}`, map: null }
    },
  }
}

export default defineConfig({
  plugins: [react(), preserveClientDirectives()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Nothing from public/ belongs in the package.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Terser and friends would inline the component boundaries; a library is
    // minified by whoever bundles the app, not by the library.
    minify: false,
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom/client',
        'clsx',
        'tailwind-merge',
      ],
      output: {
        // One file per module rather than one bundle, so a consumer importing
        // Button does not pull in the canvas components to shake them out again.
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
})
