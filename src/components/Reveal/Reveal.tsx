'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useInView, usePrefersReducedMotion } from '../../lib/motion'

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none'

const HIDDEN: Record<RevealDirection, string> = {
  up: 'translate-y-4',
  down: '-translate-y-4',
  left: 'translate-x-4',
  right: '-translate-x-4',
  none: '',
}

export interface RevealProps {
  /** Content that fades in once it is on screen. */
  children: ReactNode
  direction?: RevealDirection
  /** Milliseconds to wait after entering the viewport. */
  delay?: number
  /** Milliseconds the fade takes. */
  duration?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Fades and slides content in as it scrolls into view, once.
 *
 * Under prefers-reduced-motion the content is simply present from the start —
 * not merely faster, but absent of movement, which is the whole point of the
 * preference. Content is never hidden from assistive tech while waiting.
 */
export function Reveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 500,
  className,
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const reduced = usePrefersReducedMotion()
  const shown = inView || reduced

  return (
    <div
      ref={ref}
      style={
        reduced ? undefined : { transitionDuration: `${duration}ms`, transitionDelay: `${delay}ms` }
      }
      className={cn(
        'transition-all ease-out',
        shown ? 'translate-x-0 translate-y-0 opacity-100' : cn('opacity-0', HIDDEN[direction]),
        className,
      )}
    >
      {children}
    </div>
  )
}
