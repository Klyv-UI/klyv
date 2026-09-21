import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { directImports, registerComponents } from './vite.klyv'

/**
 * The accessibility suite. Same aliases as the docs site, so every component
 * page renders exactly as it does in the browser — minus layout, which jsdom
 * does not do. That is why colour contrast is audited in the browser instead.
 */
export default defineConfig({
  plugins: [registerComponents(), directImports(), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      klyv: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // Joins the a11y shards' reports into test/a11y-report.json after a run.
    globalSetup: ['./test/a11y/merge.ts'],
    include: ['test/**/*.test.tsx'],
    testTimeout: 60_000,
  },
})
