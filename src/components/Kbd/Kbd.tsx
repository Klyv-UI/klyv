import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface KbdProps {
  children: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/** A single keyboard key, for shortcut hints. */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[6px] border border-line-strong bg-surface px-1.5',
        'font-mono text-[10px] font-semibold leading-none text-ink-soft shadow-[var(--shadow-tile)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
