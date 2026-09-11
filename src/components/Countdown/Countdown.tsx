'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds'

export interface CountdownProps {
  /** When it ends — a Date, a timestamp in milliseconds, or an ISO string. */
  to: Date | number | string
  /** Accessible name — what is ending. */
  label: string
  /** Which units to show. The smallest absorbs the remainder. */
  units?: CountdownUnit[]
  /** Called once, on reaching zero. */
  onComplete?: () => void
  size?: 'sm' | 'md'
  /** Merged last, so it wins. */
  className?: string
}

const SECONDS: Record<CountdownUnit, number> = { days: 86_400, hours: 3_600, minutes: 60, seconds: 1 }

const WORDS: Record<CountdownUnit, [string, string]> = {
  days: ['day', 'days'],
  hours: ['hour', 'hours'],
  minutes: ['minute', 'minutes'],
  seconds: ['second', 'seconds'],
}

/**
 * Time remaining until a moment, in tiles.
 *
 * It does not announce every second — a live region that speaks once a second
 * makes a page unusable with a screen reader. The container is a `timer`,
 * which is silent until someone reads it, and its label spells the remaining
 * time out in words for whoever does. The tick is aligned to the wall-clock
 * second, so two countdowns on one page never drift apart.
 */
export function Countdown({
  to,
  label,
  units = ['days', 'hours', 'minutes', 'seconds'],
  onComplete,
  size = 'md',
  className,
}: CountdownProps) {
  const target = new Date(to).getTime()
  const [now, setNow] = useState(() => Date.now())
  const completed = useRef(false)
  const remaining = Number.isNaN(target) ? 0 : Math.max(0, Math.floor((target - now) / 1000))

  useEffect(() => {
    if (remaining === 0) {
      if (!completed.current) {
        completed.current = true
        onComplete?.()
      }
      return
    }
    completed.current = false
    const timer = window.setTimeout(() => setNow(Date.now()), 1000 - (Date.now() % 1000))
    return () => window.clearTimeout(timer)
  }, [remaining, onComplete])

  // Largest first, whatever order they were passed in.
  const ordered = [...units].sort((a, b) => SECONDS[b] - SECONDS[a])
  let rest = remaining
  const parts = ordered.map((unit) => {
    const value = Math.floor(rest / SECONDS[unit])
    rest -= value * SECONDS[unit]
    return { unit, value }
  })

  const spoken = parts
    .filter((part, index) => part.value > 0 || index === parts.length - 1)
    .map((part) => `${part.value} ${WORDS[part.unit][part.value === 1 ? 0 : 1]}`)
    .join(', ')

  return (
    <div
      role="timer"
      aria-label={`${label}: ${remaining === 0 ? 'ended' : `${spoken} remaining`}`}
      suppressHydrationWarning
      className={cn('inline-flex items-stretch gap-1.5', className)}
    >
      {parts.map(({ unit, value }) => (
        <div
          key={unit}
          aria-hidden="true"
          className={cn(
            'flex flex-col items-center justify-center rounded-[var(--radius-tile)] bg-surface-muted',
            size === 'sm' ? 'min-w-11 px-2 py-1.5' : 'min-w-14 px-3 py-2',
          )}
        >
          <Text as="span" size={size === 'sm' ? 'subtitle' : 'amount'} tabular>
            {String(value).padStart(2, '0')}
          </Text>
          <Text as="span" size="micro" weight="bold" tone="faint" className="mt-1 uppercase tracking-[0.12em]">
            {WORDS[unit][1]}
          </Text>
        </div>
      ))}
    </div>
  )
}
