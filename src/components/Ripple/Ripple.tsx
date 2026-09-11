'use client'

import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface RippleInstance {
  id: number
  x: number
  y: number
  size: number
}

export interface RippleProps {
  /** Content the ripple plays over. */
  children: ReactNode
  /** Any CSS colour. Defaults to a translucent ink wash. */
  color?: string
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Spawns a circle at the pointer and expands it. Purely decorative feedback —
 * it wraps content rather than replacing a control, so the button underneath
 * keeps its own semantics and focus ring.
 */
export function Ripple({ children, color, disabled = false, className }: RippleProps) {
  const [ripples, setRipples] = useState<RippleInstance[]>([])
  const nextId = useRef(0)

  const spawn = useCallback(
    (event: MouseEvent<HTMLSpanElement>) => {
      if (disabled) return
      const rect = event.currentTarget.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2
      const id = nextId.current++
      setRipples((previous) => [
        ...previous,
        { id, size, x: event.clientX - rect.left - size / 2, y: event.clientY - rect.top - size / 2 },
      ])
      setTimeout(() => setRipples((previous) => previous.filter((item) => item.id !== id)), 600)
    },
    [disabled],
  )

  return (
    <span
      onMouseDown={spawn}
      className={cn('relative inline-flex overflow-hidden isolate', className)}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          aria-hidden="true"
          className="motion-safe-only pointer-events-none absolute -z-10 animate-[ripple_600ms_ease-out] rounded-full"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            background: color ?? 'rgba(23, 25, 28, 0.12)',
          }}
        />
      ))}
    </span>
  )
}
