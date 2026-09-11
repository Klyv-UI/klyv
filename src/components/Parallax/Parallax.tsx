'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface ParallaxProps {
  /** Content that moves against the scroll. */
  children: ReactNode
  /** How far the content moves relative to the scroll, 0 to 1. Keep it small. */
  strength?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Moves content slightly slower than the page as it scrolls, to suggest depth.
 *
 * Strength is deliberately capped low. Heavy parallax detaches content from the
 * scroll and is a common trigger for motion sickness — which is also why it
 * disables entirely under prefers-reduced-motion rather than merely slowing.
 */
export function Parallax({ children, strength = 0.15, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const node = ref.current
    if (!node) return

    const onScroll = () => {
      const rect = node.getBoundingClientRect()
      const centre = rect.top + rect.height / 2 - window.innerHeight / 2
      setOffset(-centre * Math.min(0.4, Math.max(0, strength)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [strength, reduced])

  return (
    <div ref={ref} className={cn('overflow-hidden', className)}>
      <div style={reduced ? undefined : { transform: `translate3d(0, ${offset}px, 0)` }}>
        {children}
      </div>
    </div>
  )
}
