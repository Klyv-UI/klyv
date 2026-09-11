import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ListProps {
  /** The rows, usually ListItem. */
  children: ReactNode
  /** Hairline between rows. Off by default: the dashboard separates by rhythm. */
  divided?: boolean
  /** Accessible name, when the list is not already under a heading. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/** Vertical rhythm and optional separators for a set of ListItems. */
export function List({ children, divided = false, label, className }: ListProps) {
  return (
    <ul
      aria-label={label}
      className={cn('flex flex-col', divided && 'divide-y divide-line', className)}
    >
      {children}
    </ul>
  )
}
