'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { relativeTime, useRelativeClock } from '../../lib/time'
import { CrossIcon } from '../internal/icons'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export type RecentItemsKind = 'doc' | 'file' | 'project'

export interface RecentItemsItem {
  id: string
  title: string
  /** Where the row goes. Without one, the row is a button that calls `onOpen`. */
  href?: string
  /** Picks the built-in glyph. Ignored when `icon` is given. */
  kind?: RecentItemsKind
  /** A glyph of your own — a file-type icon, an emoji, a project avatar. */
  icon?: ReactNode
  /** Secondary text — the folder, the workspace. */
  meta?: string
  /** When it was last opened. A Date, or anything `new Date()` reads. */
  viewedAt: Date | string | number
  pinned?: boolean
}

export interface RecentItemsProps {
  /** Controlled list. */
  items?: RecentItemsItem[]
  /** Starting list when uncontrolled. */
  defaultItems?: RecentItemsItem[]
  /** Called with the whole list after a pin, removal or clear. */
  onItemsChange?: (items: RecentItemsItem[]) => void
  /** Called when a row is opened. */
  onOpen?: (item: RecentItemsItem) => void
  /** Uncontrolled only: keep the list in localStorage under this key, so pins and removals survive a reload. */
  storageKey?: string
  /** Most unpinned rows shown. Pinned rows are always shown. */
  max?: number
  /** The heading. */
  title?: string
  /** Heading level, so the list fits the page outline. */
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** Shown when there is nothing to list. */
  emptyMessage?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

const ICON_PATHS: Record<RecentItemsKind, ReactNode> = {
  doc: <path d="M4 1.75h5.25L12.5 5v9.25H4zM9 1.75V5.25h3.5M6.25 8.25h4M6.25 11h4" />,
  file: <path d="M4 1.75h5.25L12.5 5v9.25H4zM9 1.75V5.25h3.5" />,
  project: <path d="M1.75 4.25a1 1 0 011-1H6l1.5 1.5h5.75a1 1 0 011 1v6.75a1 1 0 01-1 1H2.75a1 1 0 01-1-1z" />,
}

const PinGlyph = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 16 16" width={14} height={14} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true">
    <path d="M6 1.75h4l-.5 4 2.5 2.5v1.25H4V8.25l2.5-2.5zM8 9.5v4.75" />
  </svg>
)

function readStored(key: string): RecentItemsItem[] | null {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? (parsed as RecentItemsItem[]) : null
  } catch {
    return null
  }
}

/** Runs once the list has re-rendered, so focus can land on the row where it now is. */
const afterRender = (run: () => void) => requestAnimationFrame(run)

const time = (value: RecentItemsItem['viewedAt']) => new Date(value).getTime() || 0

/**
 * What the reader had open lately, with a way to keep and a way to forget.
 *
 * Most "recent" lists are a log the reader cannot touch, so the one document
 * they return to every morning drifts down and off the end while one-off
 * lookups crowd it out. Pinning lifts a row above the time-ordered part and
 * keeps it there; removing a row, or clearing the unpinned ones, is the
 * privacy answer for a shared screen. Clear all leaves pins alone, because
 * losing a hand-curated set to one click is worse than a second click.
 *
 * The row opens the item; pin and remove are separate, named buttons after
 * it, so each is its own tab stop with its own label rather than a hidden
 * hover menu. Focus moves to the next row when one is removed, and the change
 * is announced. With `storageKey` the list persists in localStorage, guarded,
 * so a private window or blocked storage simply starts empty.
 */
export function RecentItems({
  items: controlledItems,
  defaultItems = [],
  onItemsChange,
  onOpen,
  storageKey,
  max = 8,
  title = 'Recent',
  headingLevel = 'h3',
  emptyMessage = 'Nothing opened yet. Items you view will show up here.',
  className,
}: RecentItemsProps) {
  const [ownItems, setOwnItems] = useState(defaultItems)
  const [message, setMessage] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [hydrated, setHydrated] = useState(false)
  const headingId = useId()
  const items = controlledItems ?? ownItems
  const Heading = headingLevel

  // Storage is read after mount so server and client render the same first
  // frame, and written only once that read has happened.
  useEffect(() => {
    if (storageKey && controlledItems === undefined) {
      const stored = readStored(storageKey)
      if (stored) setOwnItems(stored)
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || controlledItems !== undefined || !hydrated) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(ownItems))
    } catch {
      // Full or blocked storage: the list still works for this visit.
    }
  }, [storageKey, controlledItems, ownItems, hydrated])

  const newest = items.reduce<Date | undefined>((latest, item) => {
    const at = new Date(item.viewedAt)
    return !latest || at > latest ? at : latest
  }, undefined)
  const now = useRelativeClock(newest)

  const update = (next: RecentItemsItem[], announce: string) => {
    if (controlledItems === undefined) setOwnItems(next)
    onItemsChange?.(next)
    setMessage(announce)
  }

  const pinned = items.filter((item) => item.pinned).sort((a, b) => time(b.viewedAt) - time(a.viewedAt))
  const recent = items
    .filter((item) => !item.pinned)
    .sort((a, b) => time(b.viewedAt) - time(a.viewedAt))
    .slice(0, max)
  const rows = [...pinned, ...recent]

  const findIn = (key: 'recentPin' | 'recentOpen', id: string) =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('button, a') ?? []).find((node) => node.dataset[key] === id)

  const togglePin = (item: RecentItemsItem) => {
    const next = !item.pinned
    update(
      items.map((entry) => (entry.id === item.id ? { ...entry, pinned: next } : entry)),
      `${item.title} ${next ? 'pinned' : 'unpinned'}`,
    )
    // The row changes place; keep focus on its pin button wherever it lands.
    afterRender(() => findIn('recentPin', item.id)?.focus())
  }

  const remove = (item: RecentItemsItem) => {
    const at = rows.findIndex((row) => row.id === item.id)
    const neighbour = rows[at + 1] ?? rows[at - 1]
    update(
      items.filter((entry) => entry.id !== item.id),
      `${item.title} removed from ${title.toLowerCase()}`,
    )
    afterRender(() => {
      const target = neighbour && findIn('recentOpen', neighbour.id)
      ;(target || headingRef.current)?.focus()
    })
  }

  const clear = () => {
    update(items.filter((item) => item.pinned), pinned.length ? 'Cleared everything except pinned items' : 'Cleared')
    headingRef.current?.focus()
  }

  return (
    <section aria-labelledby={headingId} className={cn('flex w-full flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <Heading id={headingId} ref={headingRef} tabIndex={-1} className="text-[12px] font-bold uppercase tracking-wider text-ink-faint outline-none">
          {title}
        </Heading>
        {recent.length > 0 && (
          <button type="button" onClick={clear} className="rounded-full px-2 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink">
            {pinned.length ? 'Clear unpinned' : 'Clear all'}
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <Text size="label" tone="faint" leading="normal" className="px-1 py-2">
          {emptyMessage}
        </Text>
      ) : (
        <ul ref={listRef} className="flex flex-col">
          {rows.map((item) => {
            const at = new Date(item.viewedAt)
            const primary = 'flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-10)] px-2 py-2 text-left transition-colors hover:bg-surface-muted'
            const body = (
              <>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-10)] bg-surface-muted text-ink-soft">
                  {item.icon ?? (
                    <svg viewBox="0 0 16 16" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                      {ICON_PATHS[item.kind ?? 'doc']}
                    </svg>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-semibold text-ink">{item.title}</span>
                  <span className="truncate text-[11px] font-medium text-ink-faint">
                    {item.meta && <>{item.meta} · </>}
                    <time dateTime={at.toISOString()}>{relativeTime(at, now)}</time>
                  </span>
                </span>
              </>
            )
            return (
              <li key={item.id} className="group flex items-center gap-1">
                {item.href ? (
                  <a href={item.href} data-recent-open={item.id} onClick={() => onOpen?.(item)} className={primary}>
                    {body}
                  </a>
                ) : (
                  <button type="button" data-recent-open={item.id} onClick={() => onOpen?.(item)} className={primary}>
                    {body}
                  </button>
                )}
                <button
                  type="button"
                  data-recent-pin={item.id}
                  aria-pressed={Boolean(item.pinned)}
                  aria-label={`Pin ${item.title}`}
                  title={item.pinned ? 'Unpin' : 'Pin'}
                  onClick={() => togglePin(item)}
                  className={cn(
                    'inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface-muted',
                    item.pinned ? 'text-accent' : 'text-ink-faint hover:text-ink',
                  )}
                >
                  <PinGlyph filled={Boolean(item.pinned)} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item.title}`}
                  title="Remove"
                  onClick={() => remove(item)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  <CrossIcon size={13} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {message}
        </span>
      </VisuallyHidden>
    </section>
  )
}
