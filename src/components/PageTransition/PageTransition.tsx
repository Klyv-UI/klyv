'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface PageTransitionProps {
  /** The route currently being shown. */
  children: ReactNode
  /** Changing this replays the transition — pass the route key. */
  transitionKey: string
  duration?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Fades and lifts a route in when it changes.
 *
 * It transitions in only. An exit transition would mean holding the previous
 * route on screen after navigation, which delays the new content and makes the
 * application feel slower rather than smoother.
 */
export function PageTransition({
  children,
  transitionKey,
  duration = 260,
  className,
}: PageTransitionProps) {
  const reduced = usePrefersReducedMotion()
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    setEntered(false)
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [transitionKey])

  if (reduced) return <div className={className}>{children}</div>

  return (
    <div
      style={{ transitionDuration: `${duration}ms` }}
      className={cn(
        'transition-all ease-out',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
