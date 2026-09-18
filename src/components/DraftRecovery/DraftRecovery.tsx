'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { relativeTime, useRelativeClock } from '../../lib/time'
import { Button } from '../Button'

/* ------------------------------------------------ a small IndexedDB wrapper */

interface DraftStore {
  kind: 'indexeddb' | 'memory'
  get: (key: string) => Promise<unknown>
  put: (key: string, value: unknown) => Promise<void>
  remove: (key: string) => Promise<void>
}

const memory = new Map<string, unknown>()
const memoryStore: DraftStore = {
  kind: 'memory',
  get: async (key) => memory.get(key),
  put: async (key, value) => void memory.set(key, value),
  remove: async (key) => void memory.delete(key),
}

const settle = <T,>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

let opening: Promise<DraftStore> | null = null
function openStore(): Promise<DraftStore> {
  if (opening) return opening
  opening = new Promise<DraftStore>((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(memoryStore)
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open('klyv-drafts', 1)
    } catch {
      return resolve(memoryStore)
    }
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    // Private windows in some browsers refuse IndexedDB outright; the drafts
    // then live for the life of the page, which is still better than nothing.
    request.onerror = () => resolve(memoryStore)
    request.onblocked = () => resolve(memoryStore)
    request.onsuccess = () => {
      const db = request.result
      const run = <T,>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) =>
        settle(work(db.transaction('drafts', mode).objectStore('drafts')))
      resolve({
        kind: 'indexeddb',
        get: (key) => run('readonly', (store) => store.get(key)),
        put: async (key, value) => void (await run('readwrite', (store) => store.put(value, key))),
        remove: async (key) => void (await run('readwrite', (store) => store.delete(key))),
      })
    }
  })
  return opening
}

/* ------------------------------------------------------------------ hook */

interface Stored {
  version: number
  savedAt: number
  value: unknown
}

export interface DraftRecoveryOptions<T> {
  /** One draft per key — include the record id, "issue-42-edit". */
  storageKey: string
  /** The current form or editor state. Saved as it changes. */
  value: T
  /** When the value the form started from was last saved for real. A draft older than this is stale and dropped. */
  savedAt?: number
  /** Bump when the shape of `value` changes. Older drafts go through `migrate`. */
  version?: number
  /** Turn an older draft into the current shape, or return undefined to discard it. */
  migrate?: (value: unknown, fromVersion: number) => T | undefined
  /** At most one write per this many milliseconds. */
  throttle?: number
  /** Called with the draft when the reader chooses to restore it. */
  onRestore: (value: T) => void
}

export interface DraftRecoveryControls<T> {
  /** A newer draft than the form’s value, waiting for a decision. */
  offer: { value: T; savedAt: number } | null
  /** The value the form had when the offer was found — for a summary of what differs. */
  current: T
  restore: () => void
  discard: () => void
  /** Remove the draft — call after a successful submit. */
  clear: () => Promise<void>
  /** When the last draft was written, if any this session. */
  lastSaved: number | null
  /** Where drafts are going. `memory` means they will not survive a reload. */
  storage: 'indexeddb' | 'memory' | 'pending'
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Autosave a form’s state to IndexedDB and offer it back after a crash, a
 * closed tab or a reload. Writes are throttled and skipped while the value is
 * still the one the form started with; nothing is saved while an offer is
 * waiting, so a restore is never overwritten by the empty form it would fill.
 */
export function useDraftRecovery<T>({
  storageKey,
  value,
  savedAt = 0,
  version = 1,
  migrate,
  throttle = 1000,
  onRestore,
}: DraftRecoveryOptions<T>): DraftRecoveryControls<T> {
  const [offer, setOffer] = useState<{ value: T; savedAt: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [storage, setStorage] = useState<DraftRecoveryControls<T>['storage']>('pending')
  // What counts as "nothing to save": the value the form opened with, and the
  // value it was last submitted or discarded at.
  const initial = useRef(value)
  const baseline = useRef(value)
  const latest = useRef({ value, onRestore, migrate })
  latest.current = { value, onRestore, migrate }

  useEffect(() => {
    let live = true
    baseline.current = latest.current.value
    setReady(false)
    setOffer(null)
    openStore().then(async (store) => {
      if (!live) return
      setStorage(store.kind)
      const found = (await store.get(storageKey).catch(() => undefined)) as Stored | undefined
      if (!live) return
      let draft: T | undefined
      if (found && found.savedAt > savedAt) {
        draft = found.version === version ? (found.value as T) : latest.current.migrate?.(found.value, found.version)
      }
      if (draft !== undefined && !same(draft, latest.current.value)) setOffer({ value: draft, savedAt: found!.savedAt })
      else if (found) await store.remove(storageKey).catch(() => {})
      if (live) setReady(true)
    })
    return () => {
      live = false
    }
  }, [storageKey, savedAt, version])

  // Throttled autosave: the first change writes at once, later ones at most
  // once per window, and the last change in a window is never lost.
  const lastWrite = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const write = useCallback(() => {
    timer.current = undefined
    lastWrite.current = Date.now()
    const record: Stored = { version, savedAt: Date.now(), value: latest.current.value }
    openStore()
      .then((store) => store.put(storageKey, record))
      .then(() => setLastSaved(record.savedAt))
      .catch(() => {})
  }, [storageKey, version])

  const serialised = JSON.stringify(value)
  useEffect(() => {
    const { value: now } = latest.current
    if (!ready || offer || same(now, baseline.current) || same(now, initial.current)) return
    if (timer.current) return
    const wait = Math.max(0, lastWrite.current + throttle - Date.now())
    timer.current = setTimeout(write, wait)
  }, [serialised, ready, offer, throttle, write])

  // Leaving the form with a write still waiting: write it now rather than lose it.
  useEffect(
    () => () => {
      if (!timer.current) return
      clearTimeout(timer.current)
      write()
    },
    [write],
  )

  const clear = useCallback(async () => {
    clearTimeout(timer.current)
    timer.current = undefined
    baseline.current = latest.current.value
    setOffer(null)
    setLastSaved(null)
    const store = await openStore()
    await store.remove(storageKey).catch(() => {})
  }, [storageKey])

  return {
    offer,
    current: value,
    restore: () => {
      if (!offer) return
      latest.current.onRestore(offer.value)
      setOffer(null)
    },
    discard: () => {
      setOffer(null)
      void clear()
    },
    clear,
    lastSaved,
    storage,
  }
}

/* ------------------------------------------------------------- component */

export interface DraftRecoveryProps<T> {
  /** The controls from `useDraftRecovery`. */
  recovery: DraftRecoveryControls<T>
  /** What the draft changes, shown under the question. Defaults to a list of the fields that differ. */
  summarize?: (draft: T, current: T) => ReactNode
  /** Name of the thing being edited, for the prompt — "issue", "post". */
  noun?: string
  /** Merged last, so it wins. */
  className?: string
}

function preview(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty'
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'none'
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return text.length > 48 ? `${text.slice(0, 47)}…` : text
}

function defaultSummary(draft: unknown, current: unknown): ReactNode {
  if (typeof draft !== 'object' || draft === null || typeof current !== 'object' || current === null) {
    return <p className="text-[12px] font-medium text-ink-soft">Draft: “{preview(draft)}”</p>
  }
  const keys = [...new Set([...Object.keys(draft), ...Object.keys(current)])].filter(
    (key) => !same((draft as Record<string, unknown>)[key], (current as Record<string, unknown>)[key]),
  )
  return (
    <ul className="flex flex-col gap-1">
      {keys.map((key) => (
        <li key={key} className="flex min-w-0 gap-2 text-[12px]">
          <span className="shrink-0 font-bold capitalize text-ink">{key}</span>
          <span className="min-w-0 truncate font-medium text-ink-faint line-through">{preview((current as Record<string, unknown>)[key])}</span>
          <span aria-hidden="true" className="text-ink-faint">→</span>
          <span className="sr-only">becomes</span>
          <span className="min-w-0 truncate font-semibold text-ink">{preview((draft as Record<string, unknown>)[key])}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The "restore your draft?" prompt, and the quiet line that says drafts are
 * being kept.
 *
 * Losing a long reply to a closed tab is the kind of failure people remember.
 * The prompt appears only when a draft is newer than what was last saved and
 * actually differs from it, says how old it is and what it would change, and
 * lets the reader restore it or throw it away — never restores silently, since
 * the saved version may be the one they want.
 */
export function DraftRecovery<T>({ recovery, summarize, noun = 'draft', className }: DraftRecoveryProps<T>) {
  const { offer, current, restore, discard, lastSaved, storage } = recovery
  const stamp = offer?.savedAt ?? lastSaved
  const since = useMemo(() => (stamp ? new Date(stamp) : undefined), [stamp])
  const clock = useRelativeClock(since)
  // The clock ticks every ten seconds; a save that just happened is newer than its last tick.
  const now = new Date(Math.max(clock.getTime(), stamp ?? 0))

  if (offer) {
    return (
      <div role="region" aria-label="Unsaved draft found" className={cn('flex flex-col gap-3 rounded-[var(--radius-tile)] border border-accent-strong bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))] p-3.5', className)}>
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-bold text-ink">Restore your {noun} from {relativeTime(new Date(offer.savedAt), now)}?</p>
          <p className="text-[12px] font-medium text-ink-soft">It was never submitted, and differs from what is saved:</p>
        </div>
        {(summarize ?? defaultSummary)(offer.value, current)}
        <div className="flex gap-2">
          <Button size="sm" onClick={restore}>
            Restore draft
          </Button>
          <Button size="sm" variant="ghost" onClick={discard}>
            Discard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <p className={cn('text-[12px] font-medium text-ink-faint', className)}>
      {lastSaved ? `Draft saved ${relativeTime(new Date(lastSaved), now)}.` : 'Changes are saved as a draft while you type.'}
      {storage === 'memory' && ' Without IndexedDB here, drafts last only until this page closes.'}
    </p>
  )
}
