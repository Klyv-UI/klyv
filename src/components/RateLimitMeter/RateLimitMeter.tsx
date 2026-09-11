'use client'

import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { countdown } from '../../lib/time'

export interface RateLimitMeterProps {
  /** How much of the allowance is spent. */
  used: number
  /** The ceiling. */
  limit: number
  /** When the window resets and the count returns to zero. */
  resetAt: Date
  /** What is being counted — "API calls", "exports", "transfers". */
  unit: string
  /** Fraction at which to start warning. */
  warnAt?: number
  /** Offer a way out of the limit rather than only announcing it. */
  onUpgrade?: () => void
  upgradeLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * How much of a quota is gone, and when it comes back.
 *
 * The reset time is the half that is always missing. "Rate limit exceeded" tells
 * someone they are stuck; "912 of 1,000 — resets in 14:02" tells them whether to
 * wait or to change plan, and those are the only two things they can actually
 * do about it.
 *
 * The countdown is derived from a timestamp and recomputed each tick rather than
 * decremented. A decremented counter drifts, and drifts badly in a background
 * tab where the interval is throttled — which is exactly where a long quota
 * window is sitting.
 *
 * It warns before the limit rather than at it. Being told at 100% is being told
 * too late to reorder the work.
 */
export function RateLimitMeter({
  used,
  limit,
  resetAt,
  unit,
  warnAt = 0.8,
  onUpgrade,
  upgradeLabel = 'Increase the limit',
  className,
}: RateLimitMeterProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // Recomputed from the deadline, never decremented — a throttled tab would
    // otherwise wake up believing minutes were seconds.
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const remaining = Math.max(0, (resetAt.getTime() - now) / 1000)
  const fraction = limit === 0 ? 0 : Math.min(1, used / limit)
  const exhausted = used >= limit
  const warning = fraction >= warnAt

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Text size="caption" weight="bold" tabular>
          {used.toLocaleString()} of {limit.toLocaleString()} {unit}
        </Text>
        <Text
          size="caption"
          tone={exhausted ? 'danger' : 'faint'}
          tabular
          role="status"
          aria-live="polite"
        >
          {remaining <= 0 ? 'Resetting…' : `resets in ${countdown(remaining)}`}
        </Text>
      </div>

      {/* Its own bar rather than `Progress`: the colour carries the warning,
          and a quota approaching its limit is the one case where a progress
          bar has to change tone. */}
      <div
        role="progressbar"
        aria-label={`${unit} used`}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        className="h-1.5 w-full overflow-hidden rounded-full bg-track"
      >
        <div
          className={cn(
            'h-full origin-left rounded-full transition-[transform,background-color] duration-[var(--duration-slow)]',
            exhausted ? 'bg-danger' : warning ? 'bg-warning' : 'bg-accent-strong',
          )}
          style={{ width: '100%', transform: `scaleX(${fraction})` }}
        />
      </div>

      {(warning || exhausted) && (
        <div className="flex flex-wrap items-center gap-2">
          <Text size="caption" tone={exhausted ? 'danger' : 'soft'} leading="normal">
            {exhausted
              ? `You have used every ${unit.replace(/s$/, '')} in this window.`
              : `Close to the limit — ${(limit - used).toLocaleString()} left.`}
          </Text>
          {onUpgrade && (
            <button
              type="button"
              onClick={onUpgrade}
              className="rounded-full px-1 text-[11px] font-bold text-ink underline underline-offset-2"
            >
              {upgradeLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
