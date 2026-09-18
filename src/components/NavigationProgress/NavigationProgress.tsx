'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface NavigationProgressProps {
  /** True from the moment navigation starts until it finishes. Going false completes the bar and fades it out. */
  active: boolean
  /** Real progress, 0–100, when the router knows it. Omit to let the bar trickle on its own. */
  value?: number
  /** Accessible name of the progress bar. */
  label?: string
  /** `fixed` pins it to the top of the viewport; `absolute` to the top of the nearest positioned ancestor. */
  position?: 'fixed' | 'absolute'
  /** Bar thickness in pixels. */
  height?: number
  /** Milliseconds before a short navigation shows the bar at all. */
  delay?: number
  /** Merged onto the bar’s track. */
  className?: string
}

type Phase = 'idle' | 'running' | 'finishing'

/**
 * The thin bar across the top of the page while a route loads.
 *
 * A route transition rarely knows how far along it is, so the bar mostly
 * trickles: each step covers a share of the distance that is left, which
 * slows it as it goes and stops it short of the end — it never claims to be
 * done before it is. When navigation finishes it runs to the end and fades,
 * so the finish reads as a finish rather than the bar vanishing mid-way.
 * A router that does know progress passes `value` and the trickle stands down.
 *
 * A navigation quicker than `delay` shows nothing, because a bar that
 * flashes for 80ms is noise, not information.
 *
 * With reduced motion there is no trickle and no growing bar: a static,
 * partly filled track stands for “loading” and is removed when done. It is
 * exposed as an indeterminate progressbar, which is the honest reading of a
 * number that was being made up anyway.
 */
export function NavigationProgress({
  active,
  value,
  label = 'Loading page',
  position = 'fixed',
  height = 3,
  delay = 120,
  className,
}: NavigationProgressProps) {
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const [trickle, setTrickle] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timers.current.forEach((timer) => clearTimeout(timer))
    timers.current = []
  }

  useEffect(() => {
    clearTimers()
    if (active) {
      timers.current.push(
        setTimeout(() => {
          setTrickle(8)
          setPhase('running')
        }, delay),
      )
    } else {
      setPhase((current) => (current === 'running' ? 'finishing' : 'idle'))
      // The finish needs time to run to the end and fade before the bar is removed.
      timers.current.push(
        setTimeout(() => {
          setPhase('idle')
          setTrickle(0)
        }, 450),
      )
    }
    return clearTimers
  }, [active, delay])

  useEffect(() => {
    if (phase !== 'running' || reduced || value !== undefined) return
    const interval = setInterval(() => {
      setTrickle((current) => Math.min(94, current + (94 - current) * (0.06 + Math.random() * 0.08)))
    }, 350)
    return () => clearInterval(interval)
  }, [phase, reduced, value])

  if (phase === 'idle') return null

  const finishing = phase === 'finishing'
  const amount = finishing ? 100 : Math.max(0, Math.min(100, value ?? trickle))
  const indeterminate = reduced && value === undefined

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(amount)}
      className={cn(
        'pointer-events-none inset-x-0 top-0 z-[var(--z-toast)] overflow-hidden',
        position === 'fixed' ? 'fixed' : 'absolute',
        className,
      )}
      style={{ height }}
    >
      {indeterminate ? (
        <div
          className={cn(
            'h-full w-full bg-[linear-gradient(90deg,var(--color-accent-strong)_0_40%,color-mix(in_oklab,var(--color-accent)_35%,transparent)_40%_100%)]',
            finishing && 'opacity-0',
          )}
        />
      ) : (
        <div
          className={cn(
            'h-full origin-left bg-accent-strong shadow-[0_0_8px_var(--color-accent)]',
            'motion-safe-only',
            finishing && 'opacity-0',
          )}
          style={{
            transform: `scaleX(${amount / 100})`,
            // Run to the end first, then fade — one after the other, so the finish is seen.
            transition: finishing ? 'transform 200ms ease-out, opacity 200ms ease-out 200ms' : 'transform 300ms ease-out',
          }}
        />
      )}
    </div>
  )
}
