import { useSyncExternalStore } from 'react'

/**
 * Client-side persistence, behind one seam.
 *
 * There is no account system yet, so favourites, collections, recent searches
 * and Composer drafts live in the browser. Every feature talks to a `Store`,
 * and every store talks to a `StorageAdapter` — so moving any of them to a
 * server is a new adapter, not a rewrite of the feature that uses it.
 */
export interface StorageAdapter {
  read(key: string): unknown
  write(key: string, value: unknown): void
  /** Fires when the value changes somewhere else — another tab, or a server push. */
  watch?(key: string, onChange: () => void): () => void
}

const PREFIX = 'citrine:'

/**
 * localStorage, with every failure swallowed: storage can be full, denied, or
 * missing entirely, and a favourite that does not persist is a far smaller
 * problem than a page that throws on load.
 */
export const localStorageAdapter: StorageAdapter = {
  read(key) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key)
      return raw === null ? undefined : JSON.parse(raw)
    } catch {
      return undefined
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // See above.
    }
  },
  watch(key, onChange) {
    if (typeof window === 'undefined') return () => {}
    const handler = (event: StorageEvent) => {
      if (event.key === PREFIX + key) onChange()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },
}

/** sessionStorage: for state that should outlive a navigation but not the tab. */
export const sessionStorageAdapter: StorageAdapter = {
  read(key) {
    try {
      const raw = window.sessionStorage.getItem(PREFIX + key)
      return raw === null ? undefined : JSON.parse(raw)
    } catch {
      return undefined
    }
  },
  write(key, value) {
    try {
      window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // See localStorageAdapter.
    }
  },
}

export interface Store<T> {
  get(): T
  set(next: T | ((previous: T) => T)): void
  subscribe(listener: () => void): () => void
}

interface StoreOptions<T> {
  adapter?: StorageAdapter
  /**
   * Turns whatever was stored into a valid value, or `undefined` to fall back
   * to the initial one. Stored data outlives the code that wrote it, so it is
   * never trusted to have the current shape.
   */
  parse?: (raw: unknown) => T | undefined
}

/**
 * A persisted value with subscribers. Read lazily, so importing a module that
 * declares a store costs nothing until something actually asks for it.
 */
export function createStore<T>(key: string, initial: T, options: StoreOptions<T> = {}): Store<T> {
  const adapter = options.adapter ?? localStorageAdapter
  const listeners = new Set<() => void>()
  let value: T | undefined
  let loaded = false
  let stopWatching: (() => void) | undefined

  const load = () => {
    const raw = adapter.read(key)
    value = (raw === undefined ? undefined : options.parse ? options.parse(raw) : (raw as T)) ?? initial
    loaded = true
  }

  const emit = () => {
    for (const listener of listeners) listener()
  }

  return {
    get() {
      if (!loaded) load()
      return value as T
    },
    set(next) {
      const current = this.get()
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(current) : next
      if (Object.is(resolved, current)) return
      value = resolved
      adapter.write(key, resolved)
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1 && adapter.watch) {
        stopWatching = adapter.watch(key, () => {
          load()
          emit()
        })
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          stopWatching?.()
          stopWatching = undefined
        }
      }
    },
  }
}

/** The store's value as React state. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/**
 * One derived value from a store. The selector must return something stable
 * for an unchanged store — a primitive, or a value read straight off it — or
 * React will re-render on every change anywhere in the store.
 */
export function useStoreValue<T, S>(store: Store<T>, select: (value: T) => S): S {
  const read = () => select(store.get())
  return useSyncExternalStore(store.subscribe, read, read)
}
