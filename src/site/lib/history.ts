import { createStore } from './store'

/**
 * What someone searched for and where they went, so the search palette can
 * open on something useful instead of an empty list. Both are short and
 * local-only; neither is sent anywhere.
 */
const MAX_SEARCHES = 6
const MAX_VISITS = 8

const stringList = (raw: unknown) =>
  Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : undefined

export const recentSearches = createStore<string[]>('recent-searches', [], { parse: stringList })

/** Pathnames, newest first. Resolved to titles by the search index. */
export const recentVisits = createStore<string[]>('recent-visits', [], { parse: stringList })

export function rememberSearch(query: string) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return
  recentSearches.set((list) =>
    [trimmed, ...list.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_SEARCHES),
  )
}

export function forgetSearches() {
  recentSearches.set([])
}

export function rememberVisit(pathname: string) {
  recentVisits.set((list) =>
    list[0] === pathname ? list : [pathname, ...list.filter((entry) => entry !== pathname)].slice(0, MAX_VISITS),
  )
}
