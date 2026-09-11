'use client'

import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'
import { useInView, usePrefersReducedMotion } from '../../lib/motion'

export interface KineticTextProps {
  /** The line to animate. */
  children: string
  /** Milliseconds between characters. */
  interval?: number
  /** Animate whole words rather than characters. */
  by?: 'character' | 'word'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Reveals a headline character by character as it scrolls into view.
 *
 * The whole string is exposed once through VisuallyHidden and the animated
 * pieces are aria-hidden — otherwise a screen reader reads the line one letter
 * at a time. Reduced motion renders it plainly.
 */
export function KineticText({
  children,
  interval = 28,
  by = 'character',
  className,
}: KineticTextProps) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4)
  const reduced = usePrefersReducedMotion()

  if (reduced) return <span className={className}>{children}</span>

  const pieces = by === 'word' ? children.split(/(\s+)/) : [...children]

  return (
    <span ref={ref} className={cn('inline-block', className)}>
      <VisuallyHidden>{children}</VisuallyHidden>
      <span aria-hidden="true">
        {pieces.map((piece, index) => (
          <span
            key={index}
            className={cn(
              'inline-block transition-all duration-[420ms] ease-out',
              inView ? 'translate-y-0 opacity-100' : 'translate-y-[0.4em] opacity-0',
            )}
            style={{ transitionDelay: `${index * interval}ms` }}
          >
            {piece === ' ' ? ' ' : piece}
          </span>
        ))}
      </span>
    </span>
  )
}
