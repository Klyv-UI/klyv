import { createStore, useStore, useStoreValue } from './store'

/**
 * Favourites and collections.
 *
 * Both store library item ids (`component:data-table`, `block:login`), never
 * copies of the items, so a saved entry always shows the item as it is now.
 * An id whose item has since been removed from the library is kept and shown
 * as missing rather than silently dropped — the person saved it, so the
 * person decides.
 *
 * The state is one document with a version, which is the shape a server would
 * store per user; swapping the adapter in `createStore` is the whole migration.
 */
export interface Collection {
  id: string
  name: string
  /** Item ids, in the order they were added. */
  items: string[]
  createdAt: number
}

export interface SavedState {
  version: 1
  /** Newest first. */
  favorites: string[]
  collections: Collection[]
}

const EMPTY: SavedState = { version: 1, favorites: [], collections: [] }

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

function parse(raw: unknown): SavedState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<SavedState>
  const favorites = isStringArray(value.favorites) ? value.favorites : []
  const collections = Array.isArray(value.collections)
    ? value.collections.filter(
        (entry): entry is Collection =>
          Boolean(entry) &&
          typeof entry.id === 'string' &&
          typeof entry.name === 'string' &&
          isStringArray(entry.items),
      )
    : []
  return { version: 1, favorites, collections }
}

export const savedStore = createStore<SavedState>('saved', EMPTY, { parse })

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const without = (list: string[], id: string) => list.filter((entry) => entry !== id)

const updateCollection = (id: string, change: (collection: Collection) => Collection) =>
  savedStore.set((state) => ({
    ...state,
    collections: state.collections.map((collection) => (collection.id === id ? change(collection) : collection)),
  }))

export const saved = {
  toggleFavorite(itemId: string) {
    savedStore.set((state) => ({
      ...state,
      favorites: state.favorites.includes(itemId)
        ? without(state.favorites, itemId)
        : [itemId, ...state.favorites],
    }))
  },

  removeFavorite(itemId: string) {
    savedStore.set((state) => ({ ...state, favorites: without(state.favorites, itemId) }))
  },

  /** Returns the new collection's id. */
  createCollection(name: string, items: string[] = []): string {
    const id = newId()
    savedStore.set((state) => ({
      ...state,
      collections: [...state.collections, { id, name: name.trim() || 'Untitled', items, createdAt: Date.now() }],
    }))
    return id
  },

  renameCollection(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    updateCollection(id, (collection) => ({ ...collection, name: trimmed }))
  },

  deleteCollection(id: string) {
    savedStore.set((state) => ({
      ...state,
      collections: state.collections.filter((collection) => collection.id !== id),
    }))
  },

  addToCollection(collectionId: string, itemId: string) {
    updateCollection(collectionId, (collection) =>
      collection.items.includes(itemId) ? collection : { ...collection, items: [...collection.items, itemId] },
    )
  },

  removeFromCollection(collectionId: string, itemId: string) {
    updateCollection(collectionId, (collection) => ({ ...collection, items: without(collection.items, itemId) }))
  },

  moveItem(itemId: string, fromId: string, toId: string) {
    if (fromId === toId) return
    savedStore.set((state) => ({
      ...state,
      collections: state.collections.map((collection) => {
        if (collection.id === fromId) return { ...collection, items: without(collection.items, itemId) }
        if (collection.id === toId && !collection.items.includes(itemId)) {
          return { ...collection, items: [...collection.items, itemId] }
        }
        return collection
      }),
    }))
  },
}

export function useSaved(): SavedState {
  return useStore(savedStore)
}

/** A boolean, so a favourite button re-renders only when its own item changes. */
export function useIsFavorite(itemId: string): boolean {
  return useStoreValue(savedStore, (state) => state.favorites.includes(itemId))
}

/** A number, for the sidebar count. */
export function useSavedCount(): number {
  return useStoreValue(savedStore, (state) => state.favorites.length)
}
