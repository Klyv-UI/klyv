'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { MinusIcon, PlusIcon } from '../internal/icons'
import { useAnnounce } from '../LiveRegion'

export type DashboardGridSpan = 1 | 2 | 3 | 4

export interface DashboardGridItem {
  /** Stable id of the widget. */
  id: string
  /** Columns it spans on the four-column grid. */
  span: DashboardGridSpan
}

export interface DashboardGridProps {
  /** Controlled layout: widget ids in reading order, with their spans. */
  value?: DashboardGridItem[]
  /** Starting layout when uncontrolled. */
  defaultValue?: DashboardGridItem[]
  /** Called with the whole new layout after every move or resize. */
  onValueChange?: (layout: DashboardGridItem[]) => void
  /** The widget’s name — its heading, and what move and resize announcements call it. */
  widgetTitle: (item: DashboardGridItem) => string
  /** The widget’s body. */
  renderWidget: (item: DashboardGridItem) => ReactNode
  /** Accessible name for the grid. */
  label: string
  /** Hide the move handles and size buttons — a read-only view of the same layout. */
  locked?: boolean
  /** Merged onto the grid. */
  className?: string
}

// Written out in full so Tailwind builds them. Below `md` the grid has two
// columns and a span of 3 or 4 fills the row.
const SPANS: Record<DashboardGridSpan, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-2 md:col-span-3',
  4: 'col-span-2 md:col-span-4',
}

function move(layout: DashboardGridItem[], from: number, to: number) {
  const next = layout.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * A dashboard the reader arranges: widgets move by a handle and grow or
 * shrink a column at a time.
 *
 * Moving is the ARIA grab pattern, as in SortableList, because a layout that
 * only rearranges under a mouse is not a layout everyone can own. Space on a
 * handle picks the widget up, the arrow keys carry it through reading order,
 * Space drops it and Escape puts everything back where it was when it was
 * picked up. Each step is announced with position and count. With a pointer,
 * the widget moves live as it passes over another, so what lands is what was
 * seen.
 *
 * The grid is one ordered list with spans rather than x/y coordinates. That
 * gives up gaps and free placement, and in exchange the layout reflows
 * cleanly on a narrow screen, reading order always matches visual order, and
 * the keyboard has one obvious direction to move in.
 *
 * Size buttons at their limit are marked `aria-disabled` rather than
 * disabled, so pressing “wider” until it stops does not drop focus.
 */
export function DashboardGrid({
  value,
  defaultValue = [],
  onValueChange,
  widgetTitle,
  renderWidget,
  label,
  locked = false,
  className,
}: DashboardGridProps) {
  const [inner, setInner] = useState(defaultValue)
  const layout = value ?? inner
  const [grabbed, setGrabbed] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const snapshot = useRef<DashboardGridItem[]>([])
  const lastOver = useRef<string | null>(null)
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const announce = useAnnounce()
  const baseId = useId()

  const commit = (next: DashboardGridItem[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  // A reorder moves the focused handle's DOM node, which blurs it in some browsers. Put focus back.
  useEffect(() => {
    if (grabbed && document.activeElement !== handles.current.get(grabbed)) handles.current.get(grabbed)?.focus()
  }, [layout, grabbed])

  const name = (id: string) => {
    const item = layout.find((entry) => entry.id === id)
    return item ? widgetTitle(item) : id
  }

  const onHandleKeyDown = (event: KeyboardEvent, id: string) => {
    const index = layout.findIndex((item) => item.id === id)
    const title = name(id)

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (grabbed === id) {
        setGrabbed(null)
        announce(`${title} dropped at position ${index + 1} of ${layout.length}.`)
      } else {
        snapshot.current = layout
        setGrabbed(id)
        announce(`${title} picked up, position ${index + 1} of ${layout.length}. Arrow keys move it, Space drops it, Escape cancels.`)
      }
      return
    }

    if (grabbed !== id) return
    if (event.key === 'Escape') {
      event.preventDefault()
      commit(snapshot.current)
      setGrabbed(null)
      announce(`Move cancelled. ${title} is back at position ${snapshot.current.findIndex((item) => item.id === id) + 1}.`)
      return
    }

    const targets: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      Home: 0,
      End: layout.length - 1,
    }
    if (!(event.key in targets)) return
    event.preventDefault()
    const to = Math.max(0, Math.min(layout.length - 1, targets[event.key]))
    if (to === index) return
    commit(move(layout, index, to))
    announce(`${title} moved to position ${to + 1} of ${layout.length}.`)
  }

  const resize = (id: string, step: 1 | -1) => {
    const item = layout.find((entry) => entry.id === id)
    if (!item) return
    const span = Math.max(1, Math.min(4, item.span + step)) as DashboardGridSpan
    if (span === item.span) return
    commit(layout.map((entry) => (entry.id === id ? { ...entry, span } : entry)))
    announce(`${widgetTitle(item)} now spans ${span} of 4 columns.`)
  }

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return
    snapshot.current = layout
    lastOver.current = id
    setDragging(id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return
    const over = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-dashboard-widget]')
      ?.getAttribute('data-dashboard-widget')
    // Only a newly entered widget triggers a move; otherwise two widgets of different sizes swap back and forth under a still pointer.
    if (!over || over === lastOver.current) return
    lastOver.current = over
    if (over === dragging) return
    const from = layout.findIndex((item) => item.id === dragging)
    const to = layout.findIndex((item) => item.id === over)
    if (from !== -1 && to !== -1) commit(move(layout, from, to))
  }

  const endDrag = (cancelled: boolean) => {
    if (!dragging) return
    const index = layout.findIndex((item) => item.id === dragging)
    if (cancelled) commit(snapshot.current)
    else if (index !== snapshot.current.findIndex((item) => item.id === dragging)) {
      announce(`${name(dragging)} moved to position ${index + 1} of ${layout.length}.`)
    }
    setDragging(null)
  }

  return (
    <>
      <p id={`${baseId}-help`} className="sr-only">
        Press Space to pick up a widget, the arrow keys to move it, Space to drop it and Escape to cancel.
      </p>
      <ul aria-label={label} className={cn('grid grid-cols-2 gap-3 md:grid-cols-4', className)}>
        {layout.map((item) => {
          const title = widgetTitle(item)
          const active = grabbed === item.id || dragging === item.id
          return (
            <li
              key={item.id}
              data-dashboard-widget={item.id}
              className={cn(
                'flex min-w-0 flex-col rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]',
                'motion-safe-only transition-[box-shadow,opacity] duration-[var(--duration-fast)]',
                SPANS[item.span],
                active && 'relative z-10 border-line-strong shadow-[var(--shadow-window)]',
                dragging === item.id && 'opacity-80',
              )}
            >
              <div className="flex items-center gap-1.5 border-b border-line py-1.5 pl-1.5 pr-2">
                {!locked && (
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) handles.current.set(item.id, node)
                      else handles.current.delete(item.id)
                    }}
                    aria-label={`Move ${title}`}
                    aria-describedby={`${baseId}-help`}
                    aria-pressed={grabbed === item.id}
                    onKeyDown={(event) => onHandleKeyDown(event, item.id)}
                    onBlur={(event) => {
                      // Tabbing away drops the widget where it is. A blur with no new target is the reorder moving the node.
                      if (grabbed === item.id && event.relatedTarget) setGrabbed(null)
                    }}
                    onPointerDown={(event) => onPointerDown(event, item.id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={() => endDrag(false)}
                    onPointerCancel={() => endDrag(true)}
                    className={cn(
                      'grid size-7 shrink-0 touch-none place-items-center rounded-[8px] text-ink-faint transition-colors',
                      'cursor-grab hover:bg-surface-muted hover:text-ink aria-pressed:bg-accent aria-pressed:text-accent-ink',
                      dragging === item.id && 'cursor-grabbing',
                    )}
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                      {[4, 8, 12].flatMap((y) => [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.25" />))}
                    </svg>
                  </button>
                )}
                <h3 id={`${baseId}-${item.id}`} className="min-w-0 flex-1 truncate px-1 text-[13px] font-bold text-ink">
                  {title}
                </h3>
                {!locked && (
                  <div className="flex items-center gap-0.5" role="group" aria-label={`${title} width`}>
                    <IconButton
                      icon={MinusIcon}
                      size="xs"
                      label={`Make ${title} narrower`}
                      aria-disabled={item.span === 1 || undefined}
                      onClick={() => resize(item.id, -1)}
                      className="aria-disabled:opacity-40"
                    />
                    <span className="w-7 text-center text-[11px] font-semibold tabular-nums text-ink-faint" aria-hidden="true">
                      {item.span}/4
                    </span>
                    <IconButton
                      icon={PlusIcon}
                      size="xs"
                      label={`Make ${title} wider`}
                      aria-disabled={item.span === 4 || undefined}
                      onClick={() => resize(item.id, 1)}
                      className="aria-disabled:opacity-40"
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 p-4">{renderWidget(item)}</div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
