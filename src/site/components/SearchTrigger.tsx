import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Kbd, Text } from 'klyvui'

/**
 * The palette itself — the library's CommandPalette and everything it brings —
 * is its own chunk, fetched the first time someone reaches for search. This
 * module is what the header needs before then: the shortcut and the button.
 */
export const loadSearchPalette = () => import('./SearchPalette')

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
      // Reaching for the button is intent enough to start fetching the palette.
      onPointerEnter={loadSearchPalette}
      onFocus={loadSearchPalette}
      aria-label="Search the library"
      aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      // Below sm the label and the shortcut are dropped for a square glyph:
      // the header runs out of room before the reader runs out of patience,
      // and a keyboard hint is not much use on a device without one.
      className="group flex h-9 items-center justify-center gap-2 rounded-full border border-line bg-surface transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-sm:w-9 sm:justify-start sm:pl-3 sm:pr-1.5 xl:w-[210px]"
    >
      <Search size={15} aria-hidden className="shrink-0 text-ink-faint group-hover:text-ink-soft" />
      <Text
        size="caption"
        weight="medium"
        tone="faint"
        className="hidden flex-1 text-left group-hover:text-ink-soft sm:block"
      >
        <span className="xl:hidden">Search</span>
        <span className="hidden xl:inline">Search docs…</span>
      </Text>
      <span className="hidden items-center gap-0.5 sm:flex">
        <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}
