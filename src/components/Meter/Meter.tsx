import { cn } from '../../lib/cn'

/** `segments` is the instalment bar; `dots` is the cashback pip row. */
export type MeterVariant = 'segments' | 'dots'

export interface MeterProps {
  /** Number of filled units. */
  value: number
  /** Total units. Each one is rendered, so keep this a countable quantity. */
  total: number
  /** Accessible name — what the meter is measuring. */
  label: string
  variant?: MeterVariant
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Discrete progress. The dashboard never uses a continuous bar: progress is
 * always a count of instalments or rewards, and the meter shows every unit.
 */
export function Meter({ value, total, label, variant = 'segments', className }: MeterProps) {
  const dots = variant === 'dots'

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      className={cn('flex items-center', dots ? 'gap-[5px]' : 'gap-1', className)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'rounded-full',
            dots ? 'aspect-square min-w-0 max-w-[13px] flex-1' : 'h-[3px] flex-1',
            index < value ? 'bg-accent-strong' : dots ? 'bg-track' : 'bg-line-strong',
          )}
        />
      ))}
    </div>
  )
}
