'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export interface AnimatedNumberProps {
  /** Target value. Changing it tweens from the current display value. */
  value: number
  /** Tween length in milliseconds. */
  duration?: number
  /** Turn the animated value into display text. Defaults to a rounded integer. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Tweens between two numbers with an animation frame loop. Always render it
 * with tabular figures so the text does not jitter as digits change width.
 */
export function AnimatedNumber({
  value,
  duration = 600,
  format = (next) => Math.round(next).toLocaleString('en-US'),
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const delta = value - from
    if (delta === 0) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || duration <= 0) {
      fromRef.current = value
      setDisplay(value)
      return
    }

    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const next = from + delta * easeOut(progress)
      setDisplay(next)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = value
      }
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return (
    <span className={cn('tabular', className)}>
      {format(display)}
    </span>
  )
}
