'use client'

import { useEffect, useRef, useState, type ReactNode, type UIEvent } from 'react'
import { cn } from '../../lib/cn'

export interface VirtualListProps<T> {
  /** Every row's data. Only the visible slice is rendered. */
  items: T[]
  /** Every row's height in pixels. Fixed heights are what keep this constant-time. */
  itemHeight: number
  /** The list's visible height in pixels. */
  height: number
  /** Draws one row, inside a box exactly `itemHeight` tall. */
  renderItem: (item: T, index: number) => ReactNode
  /** Stable identity per row. Defaults to the index. */
  getKey?: (item: T, index: number) => string | number
  /** Rows rendered past each edge, so a fast scroll does not flash blank. */
  overscan?: number
  /** Accessible name for the list. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A list that renders only the rows in view, for tens of thousands of items.
 *
 * Rows keep aria-setsize and aria-posinset, so a screen reader still hears
 * "4,812 of 10,000" although only a few dozen rows exist in the DOM. Scroll
 * position is read inside one animation frame, and React only re-renders when
 * the first visible row changes — not on every pixel of scroll.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  getKey,
  overscan = 6,
  label,
  className,
}: VirtualListProps<T>) {
  const [first, setFirst] = useState(0)
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      setFirst(Math.floor(node.scrollTop / itemHeight))
    })
  }

  const visible = Math.ceil(height / itemHeight)
  const from = Math.max(0, first - overscan)
  const to = Math.min(items.length, first + visible + overscan)

  return (
    <div
      role="list"
      aria-label={label}
      // Focusable, so the list can be scrolled from the keyboard.
      tabIndex={0}
      onScroll={onScroll}
      style={{ height }}
      className={cn('relative overflow-y-auto', className)}
    >
      <div role="presentation" className="relative" style={{ height: items.length * itemHeight }}>
        {items.slice(from, to).map((item, offset) => {
          const index = from + offset
          return (
            <div
              key={getKey ? getKey(item, index) : index}
              role="listitem"
              aria-setsize={items.length}
              aria-posinset={index + 1}
              className="absolute inset-x-0"
              style={{ top: index * itemHeight, height: itemHeight }}
            >
              {renderItem(item, index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
