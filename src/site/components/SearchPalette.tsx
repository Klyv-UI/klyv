import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, LayoutGrid, Palette, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { CommandPalette, Kbd, Text, type Command } from 'citrine'
import { catalog, componentCount } from '../data/catalog'
import { groups } from '../data/groups'

/**
 * Search, on the shortcut everyone already tries.
 *
 * It is the library's own CommandPalette rather than a bespoke one — a docs
 * site that reaches for something else to build its search is quietly saying
 * the component is not good enough, and this one is.
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

const PAGES = [
  { id: 'page:overview', label: 'Overview', to: '/', icon: Sparkles },
  { id: 'page:components', label: 'All components', to: '/components', icon: LayoutGrid },
  { id: 'page:foundations', label: 'Foundations', to: '/foundations', icon: Layers },
  { id: 'page:tokens', label: 'Design Tokens', to: '/tokens', icon: Palette },
  { id: 'page:playground', label: 'Playground', to: '/playground', icon: SlidersHorizontal },
]

export function SearchPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => {
      onClose()
      navigate(to)
    }

    return [
      ...PAGES.map((page) => ({
        id: page.id,
        label: page.label,
        group: 'Go to',
        icon: page.icon,
        onSelect: go(page.to),
      })),
      ...groups.map((group) => ({
        id: `group:${group.slug}`,
        label: group.id,
        group: 'Groups',
        // So "charts" finds the group as well as the components in it.
        keywords: [group.slug, ...group.sections],
        onSelect: go(`/components?group=${group.slug}`),
      })),
      ...catalog.map((entry) => ({
        id: `component:${entry.slug}`,
        label: entry.name,
        group: entry.group,
        // The slug carries the hyphenated spelling, so "data-table" and
        // "datatable" both reach DataTable; the section adds the vocabulary
        // someone uses when they know the job but not the name.
        keywords: [entry.slug, entry.slug.replace(/-/g, ''), entry.section, entry.group],
        onSelect: go(`/components/${entry.slug}`),
      })),
    ]
  }, [navigate, onClose])

  return (
    <CommandPalette
      open={open}
      onClose={onClose}
      commands={commands}
      label="Search the library"
      placeholder={`Search ${componentCount} components…`}
      emptyMessage="Nothing matches. Try what it does rather than what it is called."
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
      // Below sm the label and the shortcut are dropped for a square glyph:
      // the header runs out of room before the reader runs out of patience,
      // and a keyboard hint is not much use on a device without one.
      className="group flex h-9 items-center justify-center gap-2 rounded-full border border-line bg-surface transition-colors hover:border-line-strong max-sm:w-9 sm:pl-3.5 sm:pr-2"
    >
      <Search size={15} aria-hidden className="text-ink-faint sm:hidden" />
      <Text
        size="caption"
        weight="medium"
        tone="faint"
        className="hidden group-hover:text-ink-soft sm:block"
      >
        Search
      </Text>
      <span className="hidden items-center gap-0.5 sm:flex">
        <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}
