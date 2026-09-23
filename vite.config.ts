import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { fileURLToPath, URL } from 'node:url'
import { directImports, registerComponents } from './vite.klyv'

/**
 * Source maps, for the deploy only.
 *
 * A stack trace off a minified bundle names `index-Bk-PA1rn.js:14:2201`, which
 * is no use to anyone. With a token, the build makes maps, hands them to
 * Sentry, and deletes them again: they are what turns that line into a file
 * and a function, and they do not need to be served to every visitor to do it.
 *
 * Without SENTRY_AUTH_TOKEN — every local build, every fork, every pull
 * request — none of this runs and nothing changes.
 */
const sentryToken = process.env.SENTRY_AUTH_TOKEN
const uploadMaps = Boolean(sentryToken && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)

export default defineConfig({
  plugins: [
    registerComponents(),
    directImports(),
    react(),
    tailwindcss(),
    ...(uploadMaps
      ? [
          sentryVitePlugin({
            authToken: sentryToken,
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            // The org is in the EU region, so the upload goes to de.sentry.io.
            // Left to its default it would talk to the US host, where the org
            // does not exist, and the build would fail for a reason that reads
            // like a bad token.
            url: process.env.SENTRY_URL,
            // The same release the site reports errors against (lib/report.ts),
            // so Sentry can pair a trace with the maps for that build.
            release: { name: process.env.VITE_RELEASE },
            sourcemaps: { filesToDeleteAfterUpload: ['dist-site/**/*.map'] },
            telemetry: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The docs site imports the library by its package name, exactly as a
      // consumer would - so every snippet on the site is copy-pasteable.
      klyvui: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  // The package owns dist/; the site builds beside it.
  build: {
    outDir: 'dist-site',
    // Only when they are going to Sentry: otherwise they would be 9 MB of
    // files nothing reads, uploaded to the host on every deploy.
    sourcemap: uploadMaps,
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
