'use client'

import { useRef, useState, type ElementType, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { ChevronDownIcon } from '../internal/icons'
import { Popover } from '../Popover'

export interface PriorityNavItem {
  id: string
  label: string
  href: string
}

export interface PriorityNavProps {
  /** The links, in order of priority — the last ones move into More first. */
  items: PriorityNavItem[]
  /** Id of the current page. Kept in the bar whenever it fits, and marked `aria-current="page"` wherever it is. */
  currentId?: string
  /** Accessible name of the navigation landmark. */
  label: string
  /** Label of the overflow button. */
  moreLabel?: string
  /** Component that renders each link — a router `Link`. It receives `href`, or `to` when `linkProp` is `to`. */
  linkAs?: ElementType
  /** Which prop carries the destination on `linkAs`. */
  linkProp?: 'href' | 'to'
  /** Called when any link is followed, from the bar or from More. */
  onNavigate?: (item: PriorityNavItem) => void
  /** Merged onto the nav. */
  className?: string
}

const GAP = 4

/**
 * A single row of navigation links that never wraps and never scrolls: what
 * does not fit moves into a “More” menu at the end.
 *
 * Widths are read from a hidden copy of every link rather than from the bar
 * itself, because the bar only ever holds the links that fit and cannot say
 * how wide the others would be. A ResizeObserver on the nav re-runs the fit
 * whenever the space changes, including when the sidebar beside it
 * collapses; where ResizeObserver is missing, window resizes do the same.
 *
 * Links leave from the end, but the current page is kept visible when it
 * fits on its own beside More — a reader should not lose sight of where they
 * are because the window got narrower. If even that does not fit, More is
 * all that shows and the current link inside it is marked.
 *
 * More opens a list of links, not an ARIA menu: these are page destinations,
 * and a menu role would take away the link semantics a screen reader lists
 * them by. Arrow keys still move through it, and Escape returns to the button.
 */
export function PriorityNav({
  items,
  currentId,
  label,
  moreLabel = 'More',
  linkAs,
  linkProp = 'href',
  onNavigate,
  className,
}: PriorityNavProps) {
  const navRef = useRef<HTMLElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set(items.map((item) => item.id)))
  const [open, setOpen] = useState(false)

  useIsomorphicLayoutEffect(() => {
    const nav = navRef.current
    const measure = measureRef.current
    if (!nav || !measure) return

    const fit = () => {
      const available = nav.clientWidth
      const nodes = [...measure.children] as HTMLElement[]
      const widths = nodes.slice(0, items.length).map((node) => node.getBoundingClientRect().width)
      const moreWidth = nodes[items.length]?.getBoundingClientRect().width ?? 0
      const total = widths.reduce((sum, width) => sum + width + GAP, 0) - GAP

      let next: Set<string>
      if (available <= 0 || total <= available) {
        next = new Set(items.map((item) => item.id))
      } else {
        let budget = available - moreWidth - GAP
        next = new Set()
        const current = items.findIndex((item) => item.id === currentId)
        if (current !== -1 && widths[current] <= budget) {
          next.add(items[current].id)
          budget -= widths[current] + GAP
        }
        for (let index = 0; index < items.length; index += 1) {
          if (index === current) continue
          if (widths[index] > budget) break
          next.add(items[index].id)
          budget -= widths[index] + GAP
        }
      }
      setVisibleIds((previous) =>
        previous.size === next.size && [...next].every((id) => previous.has(id)) ? previous : next,
      )
    }

    fit()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit)
      return () => window.removeEventListener('resize', fit)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [items, currentId])

  const shown = items.filter((item) => visibleIds.has(item.id))
  const overflow = items.filter((item) => !visibleIds.has(item.id))
  const overflowCurrent = overflow.some((item) => item.id === currentId)
  const Link = linkAs ?? 'a'

  const linkClass = (current: boolean) =>
    cn(
      'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors',
      current ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
    )

  const renderLink = (item: PriorityNavItem, className: string, extra?: Record<string, unknown>) => (
    <Link
      {...{ [linkProp]: item.href }}
      {...extra}
      aria-current={item.id === currentId ? 'page' : undefined}
      onClick={() => {
        setOpen(false)
        onNavigate?.(item)
      }}
      className={className}
    >
      {item.label}
    </Link>
  )

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const links = [...event.currentTarget.querySelectorAll<HTMLElement>('a, [href], [data-priority-link]')]
    const index = links.indexOf(document.activeElement as HTMLElement)
    const target =
      event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1)
    links[(target + links.length) % links.length]?.focus()
  }

  return (
    <nav ref={navRef} aria-label={label} className={cn('relative flex w-full min-w-0 items-center', className)}>
      <ul className="flex min-w-0 items-center" style={{ gap: GAP }}>
        {shown.map((item) => (
          <li key={item.id}>{renderLink(item, linkClass(item.id === currentId))}</li>
        ))}
        {overflow.length > 0 && (
          <li>
            <Popover
              open={open}
              onOpenChange={setOpen}
              placement="bottom"
              align="end"
              label={moreLabel}
              initialFocus
              trigger={
                <button
                  type="button"
                  aria-expanded={open}
                  className={cn(linkClass(false), 'gap-1', overflowCurrent && 'text-ink')}
                >
                  {moreLabel}
                  {overflowCurrent && <span className="sr-only">, includes current page</span>}
                  <ChevronDownIcon size={14} />
                </button>
              }
              className="min-w-[180px] p-1"
            >
              <ul onKeyDown={onListKeyDown} className="flex flex-col">
                {overflow.map((item) => (
                  <li key={item.id}>
                    {renderLink(
                      item,
                      cn(
                        'flex w-full rounded-[10px] px-2.5 py-2 text-[13px] font-semibold transition-colors',
                        item.id === currentId
                          ? 'bg-[color-mix(in_oklab,var(--color-accent)_24%,transparent)] text-ink'
                          : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
                      ),
                      { 'data-priority-link': '' },
                    )}
                  </li>
                ))}
              </ul>
            </Popover>
          </li>
        )}
      </ul>

      {/* A copy of every link at natural width, for measuring. Plain spans: nothing in here can take focus. */}
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex h-0 overflow-hidden whitespace-nowrap">
        {items.map((item) => (
          <span key={item.id} className={linkClass(item.id === currentId)}>
            {item.label}
          </span>
        ))}
        <span className={cn(linkClass(false), 'gap-1')}>
          {moreLabel}
          <ChevronDownIcon size={14} />
        </span>
      </div>
    </nav>
  )
}
