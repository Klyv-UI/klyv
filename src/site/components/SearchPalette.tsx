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
  X,
} from 'lucide-react'
import { CommandPalette, type Command, type IconComponent } from 'citrine'
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
 * pages when the field is empty. This module and the index behind it both
 * load the first time someone reaches for search, so they cost the first page
 * nothing; the shortcut and the header button live in SearchTrigger.
 */
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
