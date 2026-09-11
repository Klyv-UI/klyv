import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'accent' | 'neutral'

const TONES: Record<BadgeTone, string> = {
  accent: 'bg-accent text-accent-ink',
  neutral: 'bg-surface-muted text-ink-soft',
}

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Compact pill for a short qualifier — the cashback rates in the dashboard.
 * Deliberately two tones: the design does not colour-code badges by status.
 */
export function Badge({ children, tone = 'accent', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-bold leading-none',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
