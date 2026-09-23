/**
 * Where a crash in someone else's browser goes.
 *
 * The site is static and has no server to log to, so a component that throws
 * on a machine that is not this one leaves no trace at all. This reports those
 * to Sentry — but only when there is something to report: the SDK is a dynamic
 * import, so it is a chunk of its own that the first error downloads and a
 * visit that goes well never touches.
 *
 * Without VITE_SENTRY_DSN every function here is a no-op, which is the case in
 * development, in a fork, and in any build that does not set it. Reporting is
 * something the deployed site opts into, never a thing that breaks a build.
 */
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

type Sentry = typeof import('@sentry/react')

let sentry: Promise<Sentry | null> | undefined

/** Loads and initialises the SDK once, on the first error. */
function load(): Promise<Sentry | null> {
  sentry ??= import('@sentry/react')
    .then((module) => {
      module.init({
        dsn: DSN,
        // The commit the site was built from, so an error points at a diff.
        release: import.meta.env.VITE_RELEASE as string | undefined,
        environment: import.meta.env.MODE,
        // Errors only. Performance and session replay are a different budget
        // and a different privacy question; neither is answered yet.
        tracesSampleRate: 0,
        // Personal data is off by default in the SDK, and the docs site asks
        // for none anyway — no names, no emails, no addresses. Left at the
        // default rather than set, so an SDK upgrade cannot quietly widen it
        // behind an option this file no longer passes.
      })
      return module
    })
    .catch(() => null)
  return sentry
}

/** Reports one error. Safe to call when reporting is off. */
export async function report(error: unknown, context?: Record<string, unknown>) {
  if (!DSN) {
    if (import.meta.env.DEV) console.error('[report]', error, context)
    return
  }
  const module = await load()
  module?.captureException(error, context ? { extra: context } : undefined)
}

/**
 * Catches what no boundary can: a throw outside React, and a promise nobody
 * handled. Installed once, from the app's root.
 */
export function installReporting() {
  if (!DSN) return
  window.addEventListener('error', (event) => {
    report(event.error ?? event.message, { source: 'window.onerror', file: event.filename })
  })
  window.addEventListener('unhandledrejection', (event) => {
    report(event.reason, { source: 'unhandledrejection' })
  })
}
