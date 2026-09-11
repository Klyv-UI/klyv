'use client'

import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface MagneticButtonProps {
  /** The button label. */
  children: ReactNode
  /** How far the content drifts towards the pointer, in pixels. */
  strength?: number
  /** Radius around the element that starts the pull. */
  radius?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Pulls its content slightly towards the pointer as it approaches.
 *
 * It wraps a control rather than being one, so the button inside keeps its own
 * semantics, focus ring and hit area. The drift is capped well below the
 * control size — a target that moves away from the pointer is worse than a
 * static one, which is exactly what a strong magnetic effect produces.
 */
export function MagneticButton({
  children,
  strength = 6,
  radius = 60,
  className,
}: MagneticButtonProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const reduced = usePrefersReducedMotion()

  const track = (event: PointerEvent<HTMLSpanElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const centreX = rect.left + rect.width / 2
    const centreY = rect.top + rect.height / 2
    const dx = (event.clientX - centreX) / radius
    const dy = (event.clientY - centreY) / radius
    const clamp = (value: number) => Math.max(-1, Math.min(1, value)) * strength
    setOffset({ x: clamp(dx), y: clamp(dy) })
  }

  return (
    <span
      ref={ref}
      onPointerMove={reduced ? undefined : track}
      onPointerLeave={() => setOffset({ x: 0, y: 0 })}
      className={cn('inline-flex', className)}
    >
      <span
        style={reduced ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
        className="inline-flex transition-transform duration-[var(--duration-fast)] ease-out"
      >
        {children}
      </span>
    </span>
  )
}
