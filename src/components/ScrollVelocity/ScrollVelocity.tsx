'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface ScrollVelocityProps {
  /** Content that skews with the scroll speed. */
  children: ReactNode
  /** Degrees of skew at full speed. */
  skew?: number
  /** Pixels of horizontal drift at full speed. */
  drift?: number
  /** Vertical squash at full speed, as a scale delta. */
  squash?: number
  /** Scroll speed, in pixels per frame, that counts as full. */
  ceiling?: number
  /** Drift and skew the other way — pair two rows for a shear effect. */
  reverse?: boolean
  /** Scroll container. Defaults to the window. */
  scrollRef?: RefObject<HTMLElement | null>
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Content that leans, skews and stretches with how fast you are scrolling.
 *
 * Velocity is smoothed towards the raw measurement rather than used directly.
 * A wheel produces bursts of large deltas separated by nothing at all, so
 * mapping it straight to a transform makes the row snap and stop; easing
 * towards it — and easing back to zero when scrolling stops — is what gives the
 * whole thing weight.
 *
 * Everything is written straight to the node inside one animation frame. Scroll
 * fires more often than the screen repaints and the transform changes every
 * frame regardless, so putting velocity in React state would re-render the
 * subtree sixty times a second to move one element.
 *
 * The loop parks itself when the row has been still for a moment, so an idle
 * page is not holding a frame callback open for nothing.
 */
export function ScrollVelocity({
  children,
  skew = 6,
  drift = 40,
  squash = 0.06,
  ceiling = 45,
  reverse = false,
  scrollRef,
  className,
}: ScrollVelocityProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node || reducedMotion) return

    const container = scrollRef?.current
    const read = () => (container ? container.scrollTop : window.scrollY)

    let last = read()
    let velocity = 0
    let frame = 0
    let idle = 0

    const step = () => {
      const now = read()
      const raw = now - last
      last = now

      // Eased towards the measurement, and back to zero when it stops.
      velocity += (raw - velocity) * 0.18

      const amount = Math.max(-1, Math.min(1, velocity / ceiling)) * (reverse ? -1 : 1)
      node.style.transform = `translateX(${amount * drift}px) skewY(${amount * skew}deg) scaleY(${1 - Math.abs(amount) * squash})`

      // Park the loop once it has settled; a still page should cost nothing.
      idle = Math.abs(velocity) < 0.05 && Math.abs(raw) < 0.05 ? idle + 1 : 0
      if (idle > 30) {
        node.style.transform = 'translateX(0) skewY(0deg) scaleY(1)'
        frame = 0
        return
      }
      frame = requestAnimationFrame(step)
    }

    const wake = () => {
      if (!frame) {
        idle = 0
        frame = requestAnimationFrame(step)
      }
    }

    const source: HTMLElement | Window = container ?? window
    source.addEventListener('scroll', wake, { passive: true })
    wake()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      source.removeEventListener('scroll', wake)
    }
  }, [ceiling, drift, reducedMotion, reverse, scrollRef, skew, squash])

  return (
    <div
      ref={ref}
      className={cn('will-change-transform', className)}
      style={{ transformOrigin: 'center' }}
    >
      {children}
    </div>
  )
}
