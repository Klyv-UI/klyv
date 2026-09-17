'use client'

import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Column counts by the Masonry’s own width, using Tailwind’s breakpoint values. */
export interface MasonryColumns {
  /** Below 640px. */
  base?: number
  /** From 640px. */
  sm?: number
  /** From 768px. */
  md?: number
  /** From 1024px. */
  lg?: number
  /** From 1280px. */
  xl?: number
}

export interface MasonryProps {
  /** One child per tile, in reading order. */
  children: ReactNode
  /** A fixed count, or counts by container width. */
  columns?: number | MasonryColumns
  /** Space between tiles, in pixels, both ways. */
  gap?: number
  /** `ul` gives the tiles list semantics, so a screen reader announces the count. */
  as?: 'div' | 'ul'
  /** Accessible name for the list. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const BREAKPOINTS: [keyof MasonryColumns, number][] = [
  ['xl', 1280],
  ['lg', 1024],
  ['md', 768],
  ['sm', 640],
]

/** The largest breakpoint at or below `width` that was given wins. */
function columnsFor(columns: number | MasonryColumns, width: number) {
  if (typeof columns === 'number') return Math.max(1, columns)
  for (const [key, min] of BREAKPOINTS) {
    if (width >= min && columns[key] !== undefined) return Math.max(1, columns[key]!)
  }
  // Narrower than every breakpoint that was given.
  return Math.max(1, columns.base ?? 1)
}

/**
 * Tiles of different heights packed into columns without ragged gaps.
 *
 * The common shortcut, CSS `columns`, fills the first column top to bottom
 * before starting the second. The page then reads 1, 4, 7 across the top row
 * while Tab and a screen reader walk 1, 2, 3 down the left edge — sighted
 * keyboard users watch focus jump around the screen.
 *
 * This keeps the tiles in one grid, in source order, and lets the grid place
 * them row by row. Each tile is measured and told how many 1px rows to span, so
 * short tiles tuck up under their neighbours. Visual order therefore runs left
 * to right, top to bottom — the same order as the DOM, the tab sequence and the
 * reading order. Before measurement (on the server, or with scripts off) it is
 * an ordinary even grid, which is a fine fallback.
 *
 * Breakpoints are measured against the Masonry’s own width rather than the
 * viewport, so it lays out the same in a sidebar as on a full page.
 */
export function Masonry({ children, columns = { base: 1, sm: 2, lg: 3 }, gap = 16, as = 'div', label, className }: MasonryProps) {
  const ref = useRef<HTMLElement>(null)
  const [count, setCount] = useState(() => columnsFor(columns, 0))
  const [measured, setMeasured] = useState(false)
  const items = Children.toArray(children)
  const key = typeof columns === 'number' ? String(columns) : JSON.stringify(columns)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    setCount(columnsFor(columns, node.clientWidth))
    if (typeof ResizeObserver === 'undefined') return

    const place = () => {
      for (const cell of Array.from(node.children) as HTMLElement[]) {
        const inner = cell.firstElementChild as HTMLElement | null
        const height = inner?.getBoundingClientRect().height ?? 0
        if (height > 0) cell.style.gridRowEnd = `span ${Math.ceil(height + gap)}`
      }
    }

    const observer = new ResizeObserver(() => {
      setCount(columnsFor(columns, node.clientWidth))
      place()
      setMeasured(true)
    })
    observer.observe(node)
    for (const cell of Array.from(node.children)) {
      if (cell.firstElementChild) observer.observe(cell.firstElementChild)
    }
    return () => observer.disconnect()
    // `key` stands in for `columns`, which is usually a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, gap, items.length])

  const Root = as
  const Cell = as === 'ul' ? 'li' : 'div'

  return (
    <Root
      ref={ref as never}
      aria-label={label}
      className={cn('grid list-none items-start p-0', className)}
      style={{
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
        columnGap: gap,
        // Spans are counted in 1px rows, so the vertical gap is added to each
        // tile's span rather than set as a row gap.
        rowGap: measured ? 0 : gap,
        gridAutoRows: measured ? '1px' : undefined,
      }}
    >
      {items.map((item, index) => (
        <Cell key={(item as { key?: string }).key ?? index} className="min-w-0">
          <div>{item}</div>
        </Cell>
      ))}
    </Root>
  )
}
