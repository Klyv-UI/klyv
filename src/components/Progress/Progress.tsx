import { cn } from '../../lib/cn'

export type ProgressSize = 'sm' | 'md'

const SIZES: Record<ProgressSize, string> = {
  sm: 'h-1',
  md: 'h-1.5',
}

export interface ProgressProps {
  /** Current value. Ignored when `indeterminate`. */
  value?: number
  max?: number
  /** Accessible name — what is progressing. */
  label: string
  size?: ProgressSize
  /** Work is happening but the proportion is unknown. */
  indeterminate?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Continuous progress, for values that really are fractional — an upload, a
 * quota. When progress is a count of things, reach for `Meter` instead: that
 * is what the dashboard itself uses.
 */
export function Progress({
  value = 0,
  max = 100,
  label,
  size = 'md',
  indeterminate = false,
  className,
}: ProgressProps) {
  const percent = max === 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : max}
      aria-valuenow={indeterminate ? undefined : value}
      className={cn('w-full overflow-hidden rounded-full bg-line-strong', SIZES[size], className)}
    >
      <div
        className={cn(
          'h-full rounded-full bg-accent-strong',
          indeterminate ? 'motion-safe-only w-1/3 animate-pulse' : 'transition-[width] duration-[var(--duration-slow)]',
        )}
        style={indeterminate ? undefined : { width: `${percent}%` }}
      />
    </div>
  )
}
