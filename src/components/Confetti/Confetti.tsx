'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface ConfettiProps {
  /** Set true to fire a burst. */
  active: boolean
  /** Number of pieces. Keep it modest — this renders real elements. */
  count?: number
  /** Milliseconds before the burst clears itself. */
  duration?: number
  /** Any CSS colours. Defaults to the accent ramp. */
  colors?: string[]
  /** Merged last, so it wins. */
  className?: string
}

const DEFAULT_COLORS = [
  'var(--color-accent)',
  'var(--color-accent-strong)',
  'var(--color-accent-soft)',
  'var(--color-success)',
]

/**
 * A one-off celebration burst, positioned over its container.
 *
 * It is aria-hidden and never blocks pointer events, because it carries no
 * information — the confirmation itself must be in the copy. It renders nothing
 * at all under prefers-reduced-motion.
 */
export function Confetti({
  active,
  count = 40,
  duration = 2200,
  colors = DEFAULT_COLORS,
  className,
}: ConfettiProps) {
  const reduced = usePrefersReducedMotion()
  const [firing, setFiring] = useState(false)

  useEffect(() => {
    if (!active || reduced) return
    setFiring(true)
    const timer = setTimeout(() => setFiring(false), duration)
    return () => clearTimeout(timer)
  }, [active, duration, reduced])

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 220,
        drift: (Math.random() - 0.5) * 120,
        rotation: Math.random() * 720 - 360,
        color: colors[index % colors.length],
        size: 5 + Math.random() * 5,
        round: Math.random() > 0.6,
      })),
    [count, colors, firing],
  )

  if (!firing || reduced) return null

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 block"
          style={
            {
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size * (piece.round ? 1 : 1.6),
              background: piece.color,
              borderRadius: piece.round ? '50%' : '1px',
              animation: `confetti-fall ${duration}ms cubic-bezier(0.2, 0.6, 0.4, 1) ${piece.delay}ms forwards`,
              '--confetti-drift': `${piece.drift}px`,
              '--confetti-rotation': `${piece.rotation}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
