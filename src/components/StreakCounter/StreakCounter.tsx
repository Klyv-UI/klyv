import type { CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface StreakCounterProps {
  /** Days in a row. */
  days: number
  /** Whether today is already counted. Drives the whole tone. */
  todayDone?: boolean
  /** The last seven days, oldest first. Shown as pips. */
  week?: boolean[]
  /** Next milestone worth reaching. */
  milestone?: number
  /** Streak is over — shown cold, with the number it reached. */
  broken?: boolean
  /** Flame and figure size. */
  size?: 'sm' | 'md' | 'lg'
  /** Merged last, so it wins. */
  className?: string
}

const SIZES = {
  sm: { flame: 26, number: 'text-[16px]' },
  md: { flame: 38, number: 'text-[24px]' },
  lg: { flame: 56, number: 'text-[36px]' },
} as const

/**
 * A streak, with a flame that only burns while it is alive.
 *
 * The state that matters is not the number, it is whether *today* counts yet.
 * A streak of 41 with today still open is a warning; the same 41 with today
 * done is a reward. Most implementations show one number and lose that
 * distinction entirely, which is why they stop motivating anyone.
 *
 * So an unfinished day burns low, cold and still, and the flame only flickers
 * once the day is banked. A broken streak keeps its final number in grey rather
 * than resetting to zero — the thing that was reached still happened, and
 * hiding it is how a product turns a lapse into a reason to leave.
 *
 * The week strip is seven pips rather than a second number, because the shape
 * of the last week answers "how am I doing" faster than any total.
 */
export function StreakCounter({
  days,
  todayDone = false,
  week,
  milestone,
  broken = false,
  size = 'md',
  className,
}: StreakCounterProps) {
  const { flame, number } = SIZES[size]
  const alive = !broken && todayDone
  const toGo = milestone ? Math.max(0, milestone - days) : 0

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <span className="relative inline-grid place-items-center" style={{ width: flame, height: flame }}>
        <svg
          width={flame}
          height={flame}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={cn('motion-safe-only origin-bottom')}
          style={
            alive
              ? ({ animation: 'flame-flicker 1.4s ease-in-out infinite' } as CSSProperties)
              : undefined
          }
        >
          <defs>
            <linearGradient id="streak-flame" x1="0" y1="1" x2="0" y2="0">
              {/* A lit flame is always warm; a spent or broken one is drawn on
                  the track tokens, so it recedes on a light page and on a dark
                  one rather than glaring on the second. */}
              <stop offset="0%" stopColor={alive ? '#ff8a3d' : 'var(--color-line-strong)'} />
              <stop offset="60%" stopColor={alive ? '#ffce3d' : 'var(--color-track)'} />
              <stop offset="100%" stopColor={alive ? '#fff3b0' : 'var(--color-surface-muted)'} />
            </linearGradient>
          </defs>
          <path
            d="M12 2c.6 3.2-1.4 4.6-2.9 6.1C7.4 9.8 6 11.4 6 14a6 6 0 0 0 12 0c0-2.2-.9-3.7-2-5.1-.3 1-.9 1.8-1.8 2.2.4-2.9-.8-6.4-2.2-9.1Z"
            fill="url(#streak-flame)"
          />
        </svg>
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'font-extrabold tabular-nums leading-none tracking-[-0.03em]',
              number,
              broken ? 'text-ink-faint' : 'text-ink',
            )}
          >
            {days}
          </span>
          <Text as="span" size="caption" tone={broken ? 'faint' : 'soft'}>
            {days === 1 ? 'day' : 'days'}
            {broken ? ' — streak ended' : todayDone ? '' : ' · today not counted yet'}
          </Text>
        </span>

        {week && (
          <span aria-hidden="true" className="mt-0.5 flex items-center gap-1">
            {week.map((done, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 w-4 rounded-full transition-colors',
                  done ? (broken ? 'bg-line-strong' : 'bg-accent-strong') : 'bg-track',
                )}
              />
            ))}
          </span>
        )}

        {toGo > 0 && !broken && (
          <Text as="span" size="micro" tone="faint">
            {toGo} more to {milestone}
          </Text>
        )}
      </span>

      <VisuallyHidden>
        {broken
          ? `Streak ended at ${days} days.`
          : `${days} day streak. Today is ${todayDone ? 'counted' : 'not counted yet'}.`}
      </VisuallyHidden>
    </div>
  )
}
