'use client'

import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface SpotlightProps {
  /** Content the spotlight tracks across. */
  children: ReactNode
  /** Radius of the highlight in pixels. */
  radius?: number
  /** Any CSS colour. Defaults to a soft accent wash. */
  color?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A soft highlight that follows the pointer across a surface.
 *
 * It is purely decorative and pointer-only, so it is aria-hidden and adds no
 * behaviour: nothing about the content changes, which is what keeps it safe on
 * a card that is also a link.
 */
export function Spotlight({ children, radius = 220, color, className }: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const reduced = usePrefersReducedMotion()

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onPointerMove={reduced ? undefined : track}
      onPointerLeave={() => setPoint(null)}
      className={cn('relative isolate overflow-hidden', className)}
    >
      {point && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -z-10 transition-opacity"
          style={{
            left: point.x - radius,
            top: point.y - radius,
            width: radius * 2,
            height: radius * 2,
            background: `radial-gradient(circle, ${color ?? 'rgba(200, 242, 78, 0.35)'} 0%, transparent 70%)`,
          }}
        />
      )}
      {children}
    </div>
  )
}
