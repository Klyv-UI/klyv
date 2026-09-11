'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export interface SortableListProps<T> {
  /** The sequence to render. */
  items: T[]
  /** Stable key for an entry. Index keys break as soon as the order changes. */
  itemId: (item: T) => string
  /** Renders one row. */
  renderItem: (item: T, state: { dragging: boolean; grabbed: boolean }) => ReactNode
  /** Called with the whole reordered array. */
  onReorder: (items: T[]) => void
  /** Accessible name for the list. */
  label: string
  /** Vertical gap between rows, in pixels. */
  gap?: number
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice()
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}

/**
 * A list whose rows are dragged into a new order, with the rows they displace
 * sliding out of the way.
 *
 * Row geometry is measured once, on grab, and never during the drag. Reading
 * `getBoundingClientRect` per pointer move would measure rows that are already
 * mid-transition and the target index would flicker between two values along
 * every boundary. From that one snapshot, the target is whichever row's centre
 * the pointer has passed, and every row between source and target shifts by the
 * dragged row's height — so the animation is one `transform` per row, all of it
 * on the compositor.
 *
 * The keyboard path is the ARIA grab pattern rather than a bolted-on pair of
 * buttons: Space picks a row up, the arrows move it, Space drops it and Escape
 * puts it back. Each of those announces what happened through a live region,
 * because a reorder that is only visible is not a reorder anyone can verify.
 */
export function SortableList<T>({
  items,
  itemId,
  renderItem,
  onReorder,
  label,
  gap = 8,
  disabled = false,
  className,
}: SortableListProps<T>) {
  const rowsRef = useRef<(HTMLLIElement | null)[]>([])
  const geometry = useRef<{ tops: number[]; heights: number[] } | null>(null)
  const origin = useRef(0)

  /** Pointer drag. */
  const [drag, setDrag] = useState<{ from: number; to: number; offset: number } | null>(null)
  /** Keyboard grab. */
  const [grabbed, setGrabbed] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const measure = () => {
    const tops: number[] = []
    const heights: number[] = []
    for (const row of rowsRef.current) {
      const box = row?.getBoundingClientRect()
      tops.push(box?.top ?? 0)
      heights.push(box?.height ?? 0)
    }
    geometry.current = { tops, heights }
  }

  const targetFor = (from: number, pointerY: number) => {
    const snapshot = geometry.current
    if (!snapshot) return from
    let target = from
    for (let index = 0; index < snapshot.tops.length; index += 1) {
      const centre = snapshot.tops[index] + snapshot.heights[index] / 2
      if (index < from && pointerY < centre) return index
      if (index > from && pointerY > centre) target = index
    }
    return target
  }

  const onPointerDown = (event: React.PointerEvent<HTMLLIElement>, index: number) => {
    if (disabled || event.button !== 0) return
    measure()
    origin.current = event.clientY
    setDrag({ from: index, to: index, offset: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLLIElement>) => {
    if (!drag) return
    const offset = event.clientY - origin.current
    setDrag({ ...drag, offset, to: targetFor(drag.from, event.clientY) })
  }

  const onPointerUp = () => {
    if (!drag) return
    if (drag.to !== drag.from) onReorder(move(items, drag.from, drag.to))
    setDrag(null)
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (disabled) return

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (grabbed === null) {
        setGrabbed(index)
        setAnnouncement(`Grabbed row ${index + 1} of ${items.length}. Use the arrow keys to move it.`)
      } else {
        setGrabbed(null)
        setAnnouncement(`Dropped at position ${index + 1} of ${items.length}.`)
      }
      return
    }

    if (event.key === 'Escape' && grabbed !== null) {
      event.preventDefault()
      setGrabbed(null)
      setAnnouncement('Reorder cancelled.')
      return
    }

    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = Math.min(items.length - 1, Math.max(0, index + step))
    if (next === index) return

    if (grabbed === null) {
      rowsRef.current[next]?.focus()
      return
    }

    onReorder(move(items, index, next))
    setGrabbed(next)
    setAnnouncement(`Moved to position ${next + 1} of ${items.length}.`)
    // The row keeps focus through the reorder, so it moves with the item.
    requestAnimationFrame(() => rowsRef.current[next]?.focus())
  }

  /** How far a row shifts to make room for the one being dragged. */
  const shiftFor = (index: number) => {
    if (!drag || !geometry.current || drag.to === drag.from) return 0
    const height = geometry.current.heights[drag.from] + gap
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -height
    if (drag.from > drag.to && index < drag.from && index >= drag.to) return height
    return 0
  }

  return (
    <>
      <ul
        aria-label={label}
        className={cn('flex flex-col', className)}
        style={{ gap }}
      >
        {items.map((item, index) => {
          const dragging = drag?.from === index
          const isGrabbed = grabbed === index
          const shift = dragging ? drag.offset : shiftFor(index)

          return (
            <li
              key={itemId(item)}
              ref={(node) => {
                rowsRef.current[index] = node
              }}
              tabIndex={disabled ? -1 : 0}
              aria-grabbed={isGrabbed || undefined}
              aria-roledescription="Sortable row"
              onPointerDown={(event) => onPointerDown(event, index)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'rounded-[var(--radius-tile)] outline-none',
                !disabled && 'cursor-grab touch-none',
                dragging && 'cursor-grabbing',
                // Only the rows making room animate; the dragged one follows
                // the pointer and must not lag behind it.
                !dragging && 'motion-safe-only transition-transform duration-[var(--duration-slow)] ease-[cubic-bezier(0.32,0.72,0,1)]',
                (dragging || isGrabbed) && 'relative z-10 shadow-[var(--shadow-window)]',
              )}
              style={{
                transform: `translate3d(0, ${shift}px, 0)${dragging || isGrabbed ? ' scale(1.015)' : ''}`,
              }}
            >
              {renderItem(item, { dragging, grabbed: isGrabbed })}
            </li>
          )
        })}
      </ul>

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {announcement}
        </p>
      </VisuallyHidden>
    </>
  )
}
