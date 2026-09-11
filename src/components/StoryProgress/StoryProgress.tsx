'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface StoryProgressProps {
  /** How many segments. */
  count: number
  /** Which segment is running, zero-based. */
  index: number
  onIndexChange: (index: number) => void
  /** Accessible name — what the sequence is. */
  label: string
  /** Milliseconds per segment. */
  duration?: number
  /** Advance on its own. Turn it off to drive it entirely by hand. */
  playing?: boolean
  /** Called instead of advancing past the last segment. */
  onComplete?: () => void
  /** Pause while hovered or focused, so a reader can stop to look. */
  pauseOnHover?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The segmented bar above a story: one segment per step, the current one
 * filling as its time runs out.
 *
 * The fill is a CSS animation rather than a timer writing widths, so it costs
 * nothing per frame and pauses by flipping `animation-play-state`. Its `key` is
 * the index, which is what makes re-entering the same segment restart the
 * animation — otherwise it would sit at 100% and never run again, and that is
 * the bug every hand-rolled version of this ships with.
 *
 * The advance is a separate timeout that banks its remaining time on pause and
 * restarts from that, so the deadline and the bar always agree. Sharing one
 * `duration` is what keeps them from drifting apart.
 *
 * Auto-advancing content is a WCAG failure unless it can be stopped, so
 * `pauseOnHover` covers pointer *and* keyboard focus, and `playing={false}`
 * hands the whole sequence over to the caller.
 */
export function StoryProgress({
  count,
  index,
  onIndexChange,
  label,
  duration = 5000,
  playing = true,
  onComplete,
  pauseOnHover = true,
  className,
}: StoryProgressProps) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(duration)
  const reducedMotion = usePrefersReducedMotion()

  // A new segment gets the full time back.
  useEffect(() => {
    remaining.current = duration
  }, [duration, index])

  useEffect(() => {
    if (!playing || paused) return

    const startedAt = performance.now()
    const timer = window.setTimeout(() => {
      if (index + 1 >= count) onComplete?.()
      else onIndexChange(index + 1)
    }, remaining.current)

    return () => {
      window.clearTimeout(timer)
      // Bank what was left, so resuming continues rather than restarting.
      remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt))
    }
  }, [count, index, onComplete, onIndexChange, paused, playing])

  const hold = (value: boolean) => {
    if (pauseOnHover) setPaused(value)
  }

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
      aria-valuetext={`Step ${index + 1} of ${count}`}
      onPointerEnter={() => hold(true)}
      onPointerLeave={() => hold(false)}
      onFocusCapture={() => hold(true)}
      onBlurCapture={() => hold(false)}
      className={cn('flex w-full items-center gap-1.5', className)}
    >
      {Array.from({ length: count }, (_, position) => {
        const done = position < index
        const active = position === index
        const running = active && playing && !reducedMotion

        return (
          <span key={position} className="h-1 flex-1 overflow-hidden rounded-full bg-line-strong">
            <span
              // Re-keyed on the index, so re-entering a segment restarts it.
              key={active ? `run-${index}` : 'idle'}
              className={cn('motion-safe-only block h-full w-full origin-left rounded-full bg-ink')}
              style={
                {
                  transform: done || (active && reducedMotion) ? 'scaleX(1)' : 'scaleX(0)',
                  animation: running ? `story-fill ${duration}ms linear forwards` : undefined,
                  animationPlayState: paused ? 'paused' : 'running',
                } as CSSProperties
              }
            />
          </span>
        )
      })}
    </div>
  )
}
