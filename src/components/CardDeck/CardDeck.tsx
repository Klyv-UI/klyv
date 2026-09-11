import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface CardDeckProps {
  /** The cards. Each becomes one cell of the row. */
  children: ReactNode
  /** Cards per row from xl up. */
  columns?: 2 | 3 | 4
  /** Fixed row height. The dashboard band is 306px. */
  height?: number
  /** Space between cards. */
  gap?: 'sm' | 'md'
  /** Merged last, so it wins. */
  className?: string
}

const COLUMNS = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 xl:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
} as const

const GAPS = { sm: 'gap-3', md: 'gap-4' } as const

/**
 * A row of equal-height cards. Unlike BentoGrid every cell is the same size,
 * which is what lets a band of cards share one baseline and one footer line.
 *
 * The fixed height applies only from xl up. Below that the cards size to their
 * content, because forcing a height on a narrow screen just clips things.
 */
export function CardDeck({ children, columns = 3, height, gap = 'md', className }: CardDeckProps) {
  return (
    <div
      style={height ? ({ '--deck-height': `${height}px` } as React.CSSProperties) : undefined}
      className={cn(
        'grid grid-cols-1',
        COLUMNS[columns],
        GAPS[gap],
        height && 'xl:h-[var(--deck-height)]',
        '[&>*]:min-w-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
