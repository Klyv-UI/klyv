import { matchRoutes, type RouteObject } from 'react-router-dom'
import type { RouteHandle } from '../layouts/SiteLayout'

/**
 * Prefetch on intent: start loading a page the moment a reader is about to
 * open it, so the click usually lands on code that has already arrived.
 *
 * "About to" means a pointer resting on a link for a moment, keyboard focus
 * reaching one, or a finger touching one. Paths are resolved against the
 * router's own route table — the same `lazy` loaders the router calls — so
 * there is no second list of pages to keep in step. A route can also warm
 * what its page loads after mounting, through `handle.prefetch`.
 *
 * Each path is warmed once. Nothing is warmed when the browser says data is
 * scarce, and a failed warm-up is forgotten, so the real navigation retries.
 */

/** Long enough that a pointer crossing the sidebar does not fetch every page it passes over. */
const INTENT_MS = 65

const warmed = new Set<string>()

type Connection = { saveData?: boolean; effectiveType?: string }

function dataIsScarce(): boolean {
  const connection = (navigator as Navigator & { connection?: Connection }).connection
  return Boolean(connection?.saveData || connection?.effectiveType?.includes('2g'))
}

/** The in-app path a link leads to, or null for anything that is not a same-site page change. */
function linkPath(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const anchor = target.closest<HTMLAnchorElement>('a[href]')
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return null
  const url = new URL(anchor.href, window.location.href)
  if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return null
  return url.pathname
}

export function prefetchPath(routes: RouteObject[], pathname: string): void {
  if (warmed.has(pathname)) return
  warmed.add(pathname)
  const forget = () => warmed.delete(pathname)

  for (const { route, params } of matchRoutes(routes, pathname) ?? []) {
    // The router clears `lazy` once it has loaded a route, so a page that is
    // already here is not fetched again.
    if (typeof route.lazy === 'function') route.lazy().catch(forget)
    const extra = (route.handle as RouteHandle | undefined)?.prefetch?.(params)
    extra?.catch(forget)
  }
}

/** Listens for intent anywhere on the page. Returns the function that stops it. */
export function installPrefetch(routes: RouteObject[]): () => void {
  if (typeof document === 'undefined' || dataIsScarce()) return () => {}

  let timer: number | undefined

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    window.clearTimeout(timer)
    const path = linkPath(event.target)
    if (path) timer = window.setTimeout(() => prefetchPath(routes, path), INTENT_MS)
  }
  const onPointerOut = () => window.clearTimeout(timer)
  // Keyboard focus and touch are deliberate on their own; no delay needed.
  const onIntent = (event: Event) => {
    const path = linkPath(event.target)
    if (path) prefetchPath(routes, path)
  }

  document.addEventListener('pointerover', onPointerOver)
  document.addEventListener('pointerout', onPointerOut)
  document.addEventListener('focusin', onIntent)
  document.addEventListener('touchstart', onIntent, { passive: true })

  return () => {
    window.clearTimeout(timer)
    document.removeEventListener('pointerover', onPointerOver)
    document.removeEventListener('pointerout', onPointerOut)
    document.removeEventListener('focusin', onIntent)
    document.removeEventListener('touchstart', onIntent)
  }
}
