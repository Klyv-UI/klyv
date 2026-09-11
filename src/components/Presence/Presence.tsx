'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type PresenceAnimation = 'fade' | 'scale' | 'slide-up' | 'slide-right'

const ENTER: Record<PresenceAnimation, string> = {
  fade: 'opacity-100',
  scale: 'opacity-100 scale-100',
  'slide-up': 'opacity-100 translate-y-0',
  'slide-right': 'opacity-100 translate-x-0',
}

const EXIT: Record<PresenceAnimation, string> = {
  fade: 'opacity-0',
  scale: 'opacity-0 scale-95',
  'slide-up': 'opacity-0 translate-y-2',
  'slide-right': 'opacity-0 -translate-x-2',
}

export interface PresenceProps {
  /** Whether the content should be shown. */
  present: boolean
  /** Content kept mounted long enough to animate out. */
  children: ReactNode
  animation?: PresenceAnimation
  /** Must match the transition duration so the unmount is not cut short. */
  duration?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Keeps children mounted long enough to animate out. Without it, setting a
 * flag to false removes the node instantly and the exit transition never runs.
 */
export function Presence({
  present,
  children,
  animation = 'fade',
  duration = 150,
  className,
}: PresenceProps) {
  const [mounted, setMounted] = useState(present)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (present) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(frame)
    }
    setEntered(false)
    const timer = setTimeout(() => setMounted(false), duration)
    return () => clearTimeout(timer)
  }, [present, duration])

  if (!mounted) return null

  return (
    <div
      className={cn('transition-all ease-out', entered ? ENTER[animation] : EXIT[animation], className)}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  )
}
