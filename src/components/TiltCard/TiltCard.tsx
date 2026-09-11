'use client'

import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface TiltCardProps {
  /** The card contents. */
  children: ReactNode
  /** Maximum tilt in degrees. Keep it small or the text becomes hard to read. */
  maxTilt?: number
  /** Lift the card slightly while tilting. */
  scale?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Tilts towards the pointer in three dimensions.
 *
 * The tilt is capped low on purpose: past a few degrees the text inside starts
 * to distort and the card stops being readable while it is being pointed at,
 * which is exactly when the reader needs it.
 */
export function TiltCard({ children, maxTilt = 6, scale = 1.01, className }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)
  const reduced = usePrefersReducedMotion()

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: -y * maxTilt * 2, y: x * maxTilt * 2 })
  }

  const reset = () => {
    setActive(false)
    setTilt({ x: 0, y: 0 })
  }

  return (
    <div
      ref={ref}
      onPointerMove={reduced ? undefined : track}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={reset}
      style={{ perspective: 900 }}
      className={cn('[transform-style:preserve-3d]', className)}
    >
      <div
        style={
          reduced
            ? undefined
            : {
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${active ? scale : 1})`,
              }
        }
        className="transition-transform duration-[var(--duration-fast)] ease-out"
      >
        {children}
      </div>
    </div>
  )
}
