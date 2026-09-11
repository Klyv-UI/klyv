import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Box,
  ChefHat,
  Clock,
  Compass,
  History,
  LayoutGrid,
  LayoutTemplate,
  Palette,
  PanelsTopLeft,
  Plug,
  Search,
  X,
} from 'lucide-react'
import { CommandPalette, Kbd, Text, type Command, type IconComponent } from 'citrine'
import { useStore } from '../lib/store'
import { forgetSearches, recentSearches, recentVisits, rememberSearch } from '../lib/history'
import type { SearchEntry, SearchGroup } from '../lib/search'

/**
 * Search, on the shortcut everyone already tries.
 *
 * Still the library's own CommandPalette — a docs site that reaches for
 * something else to build its search is quietly saying the component is not
 * good enough. What changed is the index behind it: every kind of thing on the
 * site, ranked rather than substring-filtered, with recent searches and recent
 * pages when the field is empty. The index module loads the first time the
 * palette opens, so it costs the first page nothing.
 */
export function useSearchPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
      // Chrome's own search shortcut, and Firefox's, both land on Cmd+K.
      event.preventDefault()
      setOpen((value) => !value)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { open, setOpen }
}

const GROUP_ICONS: Record<SearchGroup, IconComponent> = {
  Pages: Compass,
  Components: Box,
  Blocks: LayoutTemplate,
  Templates: PanelsTopLeft,
  Recipes: ChefHat,
  Integrations: Plug,
  Groups: LayoutGrid,
  Documentation: BookOpen,
  Tokens: Palette,
  Changelog: History,
}

type Engine = {
  search: typeof import('../lib/search').search
  index: import('../lib/search').SearchIndex
}

let engine: Promise<Engine> | undefined
const loadEngine = () =>
  (engine ??= import('../lib/search').then((module) => ({ search: module.search, index: module.buildSearchIndex() })))

/** The commands arrive ranked; the palette's own substring filter must not re-filter them. */
const asRanked = (commands: Command[]) => commands

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [ready, setReady] = useState<Engine | null>(null)
  const [query, setQuery] = useState('')
  const searches = useStore(recentSearches)
  const visits = useStore(recentVisits)

  useEffect(() => {
    if (!open || ready) return
    let live = true
    loadEngine().then((loaded) => {
      if (live) setReady(loaded)
    })
    return () => {
      live = false
    }
  }, [open, ready])

  const commands = useMemo<Command[]>(() => {
    if (!ready) return []
    const trimmed = query.trim()

    const toCommand = (entry: SearchEntry, group: string = entry.group): Command => ({
      id: `${group}:${entry.id}`,
      label: entry.title,
      description: entry.description,
      group,
      icon: GROUP_ICONS[entry.group],
      keywords: entry.keywords,
      onSelect: () => {
        if (trimmed) rememberSearch(trimmed)
        navigate(entry.to)
      },
    })

    if (trimmed) return ready.search(ready.index, trimmed).map((hit) => toCommand(hit.entry))

    // Nothing typed yet: what they searched for, where they have been, and
    // the pages — so the palette is useful before the first keystroke.
    const recent: Command[] = searches.map((text) => ({
      id: `recent:${text}`,
      label: text,
      group: 'Recent searches',
      icon: Clock,
      keepOpen: true,
      onSelect: () => setQuery(text),
    }))
    if (recent.length > 0) {
      recent.push({
        id: 'recent:clear',
        label: 'Clear recent searches',
        group: 'Recent searches',
        icon: X,
        keepOpen: true,
        onSelect: forgetSearches,
      })
    }

    const viewed = visits
      .map((path) => ready.index.byPath.get(path))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 5)
      .map((entry) => toCommand(entry, 'Recently viewed'))

    const pages = ready.index.entries.filter((entry) => entry.group === 'Pages').map((entry) => toCommand(entry, 'Go to'))

    return [...recent, ...viewed, ...pages]
  }, [ready, query, searches, visits, navigate])

  return (
    <CommandPalette
      open={open}
      onClose={onClose}
      commands={commands}
      filter={asRanked}
      query={query}
      onQueryChange={setQuery}
      loading={!ready}
      label="Search the library"
      placeholder="Search components, blocks, docs…"
      emptyMessage="Nothing matches. Try what it does rather than what it is called."
      className="max-sm:max-h-[78dvh]"
    />
  )
}

/** The header control that opens it, with the shortcut written on it. */
export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    // Read once on the client: the server has no idea what keyboard this is.
    setIsMac(/mac|iphone|ipad/i.test(window.navigator.platform || window.navigator.userAgent))
  }, [])

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search the library"
      aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      // Below sm the label and the shortcut are dropped for a square glyph:
      // the header runs out of room before the reader runs out of patience,
      // and a keyboard hint is not much use on a device without one.
      className="group flex h-9 items-center justify-center gap-2 rounded-full border border-line bg-surface transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-sm:w-9 sm:justify-start sm:pl-3 sm:pr-1.5 lg:w-[210px]"
    >
      <Search size={15} aria-hidden className="shrink-0 text-ink-faint group-hover:text-ink-soft" />
      <Text
        size="caption"
        weight="medium"
        tone="faint"
        className="hidden flex-1 text-left group-hover:text-ink-soft sm:block"
      >
        <span className="lg:hidden">Search</span>
        <span className="hidden lg:inline">Search docs…</span>
      </Text>
      <span className="hidden items-center gap-0.5 sm:flex">
        <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}
