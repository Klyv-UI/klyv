import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface BentoGridProps {
  /** The cells. Each one spans whatever it asks for. */
  children: ReactNode
  /** Columns at the widest breakpoint. Narrower widths step down automatically. */
  columns?: 2 | 3 | 4
  /** Gap between cells. The dashboard uses 16px. */
  gap?: 'sm' | 'md'
  /** Merged last, so it wins. */
  className?: string
}

const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
} as const

const GAPS = { sm: 'gap-3', md: 'gap-4' } as const

/**
 * The mixed-span card grid. Cells default to one column and one row; BentoCell
 * widens or heightens the ones that need it.
 *
 * Spans only apply from the sm breakpoint up, so a bento layout collapses to a
 * single readable column on a phone rather than producing a squashed mosaic.
 */
export function BentoGrid({ children, columns = 3, gap = 'md', className }: BentoGridProps) {
  return (
    <div className={cn('grid grid-cols-1', COLUMNS[columns], GAPS[gap], className)}>{children}</div>
  )
}

export interface BentoCellProps {
  children: ReactNode
  /** Columns to span from sm up. */
  colSpan?: 1 | 2 | 3 | 4
  /** Rows to span from sm up. */
  rowSpan?: 1 | 2
  className?: string
}

const COL_SPANS = {
  1: '',
  2: 'sm:col-span-2',
  3: 'sm:col-span-2 xl:col-span-3',
  4: 'sm:col-span-2 xl:col-span-4',
} as const

const ROW_SPANS = { 1: '', 2: 'sm:row-span-2' } as const

export function BentoCell({ children, colSpan = 1, rowSpan = 1, className }: BentoCellProps) {
  return (
    <div className={cn('min-w-0', COL_SPANS[colSpan], ROW_SPANS[rowSpan], className)}>{children}</div>
  )
}
