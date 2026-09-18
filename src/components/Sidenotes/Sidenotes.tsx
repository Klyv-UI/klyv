'use client'

import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'

export interface SidenotesProps {
  /** The text, with `Sidenote` markers inside it. */
  children: ReactNode
  /** Accessible name of the list of notes in the margin. */
  label?: string
  /** Width of the margin column, in px. */
  noteWidth?: number
  /** Space between the text and the margin, in px. */
  gap?: number
  /** Below this container width, in px, notes become inline toggles next to their markers. */
  collapseBelow?: number
  /** Merged onto the wrapper. */
  className?: string
}

export interface SidenoteProps {
  /** The note itself, shown in the margin beside this line. */
  note: ReactNode
  /** Optional text the note is about; the marker follows it. */
  children?: ReactNode
}

interface Entry {
  marker: HTMLElement | null
  note: HTMLElement | null
}

interface SidenotesContextValue {
  wide: boolean
  margin: HTMLOListElement | null
  numbers: Record<string, number>
  register: (id: string, marker: HTMLElement | null) => () => void
  setNote: (id: string, note: HTMLElement | null) => void
}

const SidenotesContext = createContext<SidenotesContextValue | null>(null)

const SPACING = 12

/**
 * Notes in the margin, beside the line they belong to — the Tufte layout.
 *
 * Footnotes make the reader jump to the bottom and back; tooltips hide the
 * note from anyone not hovering. Sidenotes keep the aside in view next to its
 * sentence. Each note is placed at its marker’s height and pushed down just
 * enough to clear the one above, so a paragraph with three notes stacks them
 * instead of overlapping; the layout is redone when the text reflows, a note
 * changes size or fonts load.
 *
 * The container, not the window, decides the mode: below `collapseBelow` the
 * margin would be too narrow to read, so each marker becomes a button that
 * opens its note inline. In both modes the marker is linked to its note —
 * described by it when wide, controlling it when narrow — so a screen reader
 * hears the note where the marker is.
 */
export function Sidenotes({
  children,
  label = 'Notes',
  noteWidth = 224,
  gap = 32,
  collapseBelow = 640,
  className,
}: SidenotesProps) {
  const root = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLDivElement>(null)
  const entries = useRef(new Map<string, Entry>())
  const [wide, setWide] = useState(true)
  const [margin, setMargin] = useState<HTMLOListElement | null>(null)
  const [numbers, setNumbers] = useState<Record<string, number>>({})
  const [version, setVersion] = useState(0)
  const layoutRef = useRef<() => void>(() => {})

  const ordered = () =>
    [...entries.current.entries()]
      .filter(([, entry]) => entry.marker)
      .sort(([, a], [, b]) =>
        a.marker!.compareDocumentPosition(b.marker!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )

  layoutRef.current = () => {
    const box = root.current
    if (!box) return
    const width = box.clientWidth
    if (width > 0) setWide(width >= collapseBelow)

    const list = ordered()
    const next: Record<string, number> = {}
    list.forEach(([id], index) => (next[id] = index + 1))
    setNumbers((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))

    if (!wide) {
      box.style.minHeight = ''
      return
    }
    const top = box.getBoundingClientRect().top
    let floor = 0
    for (const [, entry] of list) {
      if (!entry.note || !entry.marker) continue
      const at = Math.max(entry.marker.getBoundingClientRect().top - top, floor)
      entry.note.style.top = `${at}px`
      floor = at + entry.note.offsetHeight + SPACING
    }
    box.style.minHeight = floor > 0 ? `${floor - SPACING}px` : ''
  }

  useIsomorphicLayoutEffect(() => layoutRef.current())

  useIsomorphicLayoutEffect(() => {
    const run = () => layoutRef.current()
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(run)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    if (root.current) observer?.observe(root.current)
    if (main.current) observer?.observe(main.current)
    entries.current.forEach((entry) => entry.note && observer?.observe(entry.note))
    let live = true
    document.fonts?.ready.then(() => live && run())
    return () => {
      live = false
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [version, wide, margin])

  // Stable for the component's life, so markers and notes never re-register just because numbers changed.
  const [api] = useState(() => ({
    register: (id: string, marker: HTMLElement | null) => {
      const entry = entries.current.get(id) ?? { marker: null, note: null }
      entries.current.set(id, { ...entry, marker })
      setVersion((value) => value + 1)
      return () => {
        const current = entries.current.get(id)
        if (!current) return
        current.marker = null
        if (!current.note) entries.current.delete(id)
        setVersion((value) => value + 1)
      }
    },
    setNote: (id: string, note: HTMLElement | null) => {
      const entry = entries.current.get(id) ?? { marker: null, note: null }
      if (entry.note === note) return
      entry.note = note
      if (!entry.marker && !note) entries.current.delete(id)
      else entries.current.set(id, entry)
      setVersion((value) => value + 1)
    },
  }))

  const context = useMemo<SidenotesContextValue>(() => ({ wide, margin, numbers, ...api }), [wide, margin, numbers, api])

  return (
    <SidenotesContext.Provider value={context}>
      <div ref={root} className={cn('relative', className)}>
        <div ref={main} style={wide ? { marginRight: noteWidth + gap } : undefined}>
          {children}
        </div>
        {wide && (
          <ol
            ref={setMargin}
            aria-label={label}
            className="absolute right-0 top-0 m-0 list-none p-0"
            style={{ width: noteWidth }}
          />
        )}
      </div>
    </SidenotesContext.Provider>
  )
}

/** A marker in the text, with its note. Must sit inside `Sidenotes`. */
export function Sidenote({ note, children }: SidenoteProps) {
  const context = useContext(SidenotesContext)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const noteId = `sidenote-${id}`
  const marker = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(false)
  const wide = context?.wide ?? false
  const register = context?.register
  const setNote = context?.setNote

  useIsomorphicLayoutEffect(() => register?.(id, marker.current), [register, id, wide])
  const noteRef = useCallback((element: HTMLLIElement | null) => setNote?.(id, element), [setNote, id])

  const number = context?.numbers[id]
  const markerLabel = number ? `Note ${number}` : 'Note'
  const markerClass =
    'mx-0.5 inline-flex min-w-[1.25em] items-center justify-center rounded-full px-1 align-super text-[0.7em] font-bold leading-none text-accent-ink bg-[color-mix(in_oklab,var(--color-accent)_70%,transparent)] no-underline'

  if (wide && context) {
    return (
      <>
        {children}
        <a
          ref={(element) => {
            marker.current = element
          }}
          href={`#${noteId}`}
          aria-describedby={noteId}
          className={markerClass}
          onMouseEnter={() => setActive(true)}
          onMouseLeave={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
        >
          <span aria-hidden="true">{number}</span>
          <span className="sr-only">{markerLabel}</span>
        </a>
        {context.margin &&
          createPortal(
            <li
              ref={noteRef}
              id={noteId}
              tabIndex={-1}
              data-active={active ? '' : undefined}
              className={cn(
                'absolute inset-x-0 flex gap-2 rounded-[10px] p-1.5 text-[12.5px] leading-[1.5] text-ink-soft outline-none transition-colors',
                active && 'bg-[color-mix(in_oklab,var(--color-accent)_14%,transparent)] text-ink',
              )}
            >
              <span className="shrink-0 font-bold text-ink">{number}</span>
              <span className="min-w-0">{note}</span>
            </li>,
            context.margin,
          )}
      </>
    )
  }

  return (
    <>
      {children}
      <button
        ref={(element) => {
          marker.current = element
        }}
        type="button"
        aria-expanded={open}
        aria-controls={noteId}
        onClick={() => setOpen((value) => !value)}
        className={cn(markerClass, 'cursor-pointer border-0')}
      >
        <span aria-hidden="true">{number}</span>
        <span className="sr-only">{markerLabel}</span>
      </button>
      <span
        id={noteId}
        role="note"
        hidden={!open}
        className="my-2 block rounded-[10px] border border-line bg-surface-muted px-3 py-2 text-[12.5px] leading-[1.5] text-ink-soft"
      >
        {note}
      </span>
    </>
  )
}
