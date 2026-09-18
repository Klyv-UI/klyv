'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { cn } from '../../lib/cn'

/** How a value is written into, and read back from, one query parameter. */
export interface UrlStateCodec<T> {
  /** The parameter text, or null to remove the parameter. */
  encode: (value: T) => string | null
  /** The value, or undefined when the text does not decode — the default is used then. */
  decode: (raw: string) => T | undefined
}

export type UrlStateHistory = 'push' | 'replace'

export interface UrlStateOptions {
  /** `push` makes each change a Back step; `replace` rewrites the current entry. */
  history?: UrlStateHistory
  /** Wait this long after the last change before writing — for a search field. */
  debounce?: number
}

const string: UrlStateCodec<string> = { encode: (value) => value || null, decode: (raw) => raw }
const number: UrlStateCodec<number> = {
  encode: (value) => (Number.isFinite(value) ? String(value) : null),
  decode: (raw) => (raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : undefined),
}
const boolean: UrlStateCodec<boolean> = {
  encode: (value) => (value ? '1' : '0'),
  decode: (raw) => (raw === '1' || raw === 'true' ? true : raw === '0' || raw === 'false' ? false : undefined),
}
const date: UrlStateCodec<Date | null> = {
  encode: (value) => (value && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : null),
  decode: (raw) => {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : new Date(NaN)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  },
}

/** Ready-made codecs. Anything else is an object with `encode` and `decode`. */
export const urlStateCodecs = {
  string,
  number,
  boolean,
  /** An ISO day, `2024-01-31`, read as midnight UTC. */
  date,
  /** One of a fixed set; anything else in the URL reads as the default. */
  enum: <T extends string>(values: readonly T[]): UrlStateCodec<T> => ({
    encode: (value) => value,
    decode: (raw) => (values.includes(raw as T) ? (raw as T) : undefined),
  }),
  /** A comma-separated list of another codec’s values. An empty list removes the parameter. */
  array: <T,>(item: UrlStateCodec<T>): UrlStateCodec<T[]> => ({
    encode: (values) => (values.length ? values.map((value) => item.encode(value) ?? '').join(',') : null),
    decode: (raw) => raw.split(',').map((part) => item.decode(part)).filter((value): value is T => value !== undefined),
  }),
  /** Anything JSON can hold. Readable URLs prefer the other codecs. */
  json: <T,>(): UrlStateCodec<T> => ({
    encode: (value) => JSON.stringify(value),
    decode: (raw) => {
      try {
        return JSON.parse(raw) as T
      } catch {
        return undefined
      }
    },
  }),
}

/* -------------------------------------------------------------- the store */

// Every hook on the page shares one queue, so changes made together — a
// "clear filters" that resets four keys — land as one history entry.
const pending = new Map<string, string | null>()
const listeners = new Set<() => void>()
let pendingMode: UrlStateHistory = 'replace'
let flushTimer: ReturnType<typeof setTimeout> | undefined
let version = 0

const emit = () => {
  version++
  listeners.forEach((listener) => listener())
}

function flush() {
  flushTimer = undefined
  if (pending.size === 0 || typeof window === 'undefined') return
  const url = new URL(window.location.href)
  pending.forEach((raw, key) => (raw === null ? url.searchParams.delete(key) : url.searchParams.set(key, raw)))
  pending.clear()
  const mode = pendingMode
  pendingMode = 'replace'
  if (url.href !== window.location.href) {
    // Keep the router’s own entry state, so its idea of where it is survives.
    if (mode === 'push') window.history.pushState(window.history.state, '', url)
    else window.history.replaceState(window.history.state, '', url)
  }
  emit()
}

function schedule(key: string, raw: string | null, mode: UrlStateHistory, delay: number) {
  pending.set(key, raw)
  if (mode === 'push') pendingMode = 'push'
  clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, delay)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') window.addEventListener('popstate', onPop)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('popstate', onPop)
  }
}

function onPop() {
  pending.clear()
  clearTimeout(flushTimer)
  emit()
}

const snapshot = () => `${typeof window === 'undefined' ? '' : window.location.search}#${version}`

function readRaw(key: string): string | null {
  if (pending.has(key)) return pending.get(key) ?? null
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}

/**
 * State that lives in the query string: `useState`, but shareable, bookmarkable
 * and restored by Back. The default is never written, so a clean page has a
 * clean URL. Several keys changed together are written as one history entry.
 */
export function useUrlState<T>(
  key: string,
  defaultValue: T,
  codec: UrlStateCodec<T>,
  { history = 'replace', debounce = 0 }: UrlStateOptions = {},
): [T, (next: T | ((current: T) => T)) => void] {
  useSyncExternalStore(subscribe, snapshot, () => '')
  const raw = readRaw(key)
  const decoded = raw === null ? undefined : codec.decode(raw)
  const value = decoded === undefined ? defaultValue : decoded

  const latest = useRef({ defaultValue, codec, history, debounce })
  latest.current = { defaultValue, codec, history, debounce }

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const { defaultValue: fallback, codec: using, history: mode, debounce: wait } = latest.current
      // Read through the queue, so two updates in one handler compose.
      const text = readRaw(key)
      const current = (text === null ? undefined : using.decode(text)) ?? fallback
      const resolved = typeof next === 'function' ? (next as (current: T) => T)(current) : next
      const encoded = using.encode(resolved)
      const isDefault = encoded === using.encode(fallback)
      schedule(key, isDefault ? null : encoded, mode, wait)
    },
    [key],
  )

  return [value, setValue]
}

/** The current query string as pairs, live. */
export function useUrlQuery(): [string, string][] {
  useSyncExternalStore(subscribe, snapshot, () => '')
  if (typeof window === 'undefined') return []
  return [...new URLSearchParams(window.location.search).entries()]
}

export interface UrlStateProps {
  /** Only show these parameters. Defaults to all of them. */
  keys?: string[]
  /** Heading above the readout. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The query string, shown as it changes.
 *
 * State in the URL is the right default for filters, tabs and search — it
 * survives a reload, a shared link and the Back button — but it is invisible
 * while you build it. This readout shows each parameter as it is written and
 * flashes the ones that just changed, which is the quickest way to see that
 * the push-versus-replace and debounce choices are the ones you meant.
 */
export function UrlState({ keys, label = 'Query string', className }: UrlStateProps) {
  const pairs = useUrlQuery().filter(([key]) => !keys || keys.includes(key))
  const previous = useRef<Map<string, string>>(new Map())
  const [changed, setChanged] = useState<Set<string>>(new Set())
  const signature = pairs.map(([key, value]) => `${key}=${value}`).join('&')
  const current = useRef(pairs)
  current.current = pairs

  useEffect(() => {
    const now = new Map(current.current)
    const diff = new Set([...now].filter(([key, value]) => previous.current.get(key) !== value).map(([key]) => key))
    previous.current = now
    if (diff.size === 0) return
    setChanged(diff)
    const timer = setTimeout(() => setChanged(new Set()), 900)
    return () => clearTimeout(timer)
  }, [signature])

  return (
    <figure className={cn('flex w-full min-w-0 flex-col gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3', className)}>
      <figcaption className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</figcaption>
      <code className="block overflow-x-auto whitespace-nowrap font-mono text-[12px] text-ink">
        {pairs.length ? `?${signature}` : '(empty — every value is at its default)'}
      </code>
      {pairs.length > 0 && (
        <dl className="flex flex-wrap gap-1.5">
          {pairs.map(([key, value]) => (
            <div
              key={key}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors duration-500 motion-reduce:transition-none',
                changed.has(key) ? 'border-accent-strong bg-accent-soft' : 'border-line bg-surface',
              )}
            >
              <dt className="font-bold text-ink">{key}</dt>
              <dd className="max-w-[16rem] truncate text-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </figure>
  )
}
