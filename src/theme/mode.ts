'use client'

import { applyAccent, currentAccent } from './accent'

export type ThemeMode = 'light' | 'dark' | 'system'

/** What the page is actually rendering, once `system` has been resolved. */
export type ResolvedMode = 'light' | 'dark'

const STORAGE_KEY = 'klyv:mode'
const MODE_EVENT = 'klyv:modechange'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Theme switching, in three states rather than two.
 *
 * `system` is a real choice and not the absence of one: a reader whose machine
 * flips to dark at sunset expects the page to follow, and a two-state toggle
 * quietly opts them out of that the first time they touch it.
 */
export function systemMode(): ResolvedMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function resolveMode(mode: ThemeMode): ResolvedMode {
  return mode === 'system' ? systemMode() : mode
}

/**
 * Puts a mode on the document.
 *
 * `system` removes the attribute rather than writing a value, so the media
 * query in the stylesheet takes over — which means the page keeps following
 * the machine for the rest of the session with no listener at all.
 *
 * The accent is re-applied afterwards because one of its four derived values,
 * the soft wash, is different on a dark page.
 */
export function applyMode(mode: ThemeMode): ResolvedMode {
  const resolved = resolveMode(mode)
  if (typeof document === 'undefined') return resolved

  const root = document.documentElement
  if (mode === 'system') delete root.dataset.theme
  else root.dataset.theme = mode

  applyAccent(currentAccent())
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }))
  return resolved
}

/**
 * Calls back whenever a mode is applied, from anywhere on the page. Returns the
 * unsubscribe function.
 */
export function onModeChange(listener: (mode: ThemeMode) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => listener((event as CustomEvent<ThemeMode>).detail)
  window.addEventListener(MODE_EVENT, handler)
  return () => window.removeEventListener(MODE_EVENT, handler)
}

export function saveMode(mode: ThemeMode): void {
  try {
    if (mode === 'system') window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Storage can be denied outright. A theme that does not persist is a far
    // smaller problem than a page that throws on load.
  }
}

export function savedMode(): ThemeMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/** The mode in force right now, read back off the document. */
export function currentMode(): ThemeMode {
  if (typeof document === 'undefined') return 'system'
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : 'system'
}

/**
 * Restores the remembered mode.
 *
 * Call before the first paint. The inline script in `index.html` does the same
 * thing earlier still — this one exists for apps that mount without it, and is
 * harmless when the attribute is already correct.
 */
export function restoreMode(): ThemeMode {
  const mode = savedMode()
  applyMode(mode)
  return mode
}

/**
 * Calls back when the system preference changes while following it.
 *
 * Nothing in the stylesheet needs this — the media query already reacts. It is
 * here so a toggle can re-render, and so the accent's wash gets re-derived at
 * the moment the page flips underneath it.
 */
export function watchSystemMode(onChange: (resolved: ResolvedMode) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}

  const query = window.matchMedia(DARK_QUERY)
  const handler = () => {
    if (currentMode() !== 'system') return
    applyAccent(currentAccent())
    onChange(systemMode())
  }
  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}
