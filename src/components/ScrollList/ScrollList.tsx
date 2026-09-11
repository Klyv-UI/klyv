import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ScrollListProps {
  /** The rows, usually List or ListItem. */
  children: ReactNode
  /** Fade the last row out instead of clipping it, as both list cards do. */
  fade?: boolean
  /** Any CSS length. Omit inside a flex parent that already bounds the height. */
  maxHeight?: number | string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Scrolling container for a List. The fade is the detail that makes a cut-off
 * list read as continuing rather than as ending on a half-drawn row.
 */
export function ScrollList({ children, fade = true, maxHeight, className }: ScrollListProps) {
  return (
    <div
      style={{ maxHeight }}
      className={cn(
        'no-scrollbar -mx-2.5 min-h-0 flex-1 overflow-y-auto',
        fade && 'list-fade',
        className,
      )}
    >
      {children}
    </div>
  )
}
