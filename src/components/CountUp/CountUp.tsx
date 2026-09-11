'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatedNumber } from '../AnimatedNumber'

export interface CountUpProps {
  /** Final value. */
  value: number
  /** Starting value. */
  from?: number
  duration?: number
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * AnimatedNumber that waits until it is actually on screen before counting.
 * A figure that has already animated off-screen is a figure the reader missed.
 */
export function CountUp({ value, from = 0, duration = 900, format, className }: CountUpProps) {
  const [target, setTarget] = useState(from)
  const ref = useRef<HTMLSpanElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node || doneRef.current) return

    // Already on screen, or nothing to observe with: count now. Waiting for a
    // callback that may never arrive is how a headline figure ends up reading
    // its starting value forever.
    const box = node.getBoundingClientRect()
    const visible = box.top < window.innerHeight && box.bottom > 0
    if (visible || typeof IntersectionObserver === 'undefined') {
      doneRef.current = true
      setTarget(value)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          doneRef.current = true
          setTarget(value)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [value])

  return (
    <span ref={ref} className={className}>
      <AnimatedNumber value={target} duration={duration} format={format} />
    </span>
  )
}
