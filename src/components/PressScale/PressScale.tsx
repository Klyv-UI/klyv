'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface PressScaleProps {
  /** Content that scales while pressed. */
  children: ReactNode
  /** Scale applied while pressed. Keep it subtle. */
  scale?: number
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Shrinks slightly while held. Tactile feedback for touch, where there is no
 * hover state to confirm that a press landed.
 */
export function PressScale({ children, scale = 0.96, disabled = false, className }: PressScaleProps) {
  const [pressed, setPressed] = useState(false)

  const release = () => setPressed(false)

  return (
    <span
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      className={cn('inline-flex transition-transform duration-[var(--duration-fast)]', className)}
      style={{ transform: pressed && !disabled ? `scale(${scale})` : undefined }}
    >
      {children}
    </span>
  )
}
