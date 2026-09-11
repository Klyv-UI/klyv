import { Children, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Reveal, type RevealDirection } from '../Reveal'

export interface StaggerProps {
  /** Items revealed one after another. */
  children: ReactNode
  /** Milliseconds between each child. */
  interval?: number
  /** Passed to each Reveal. */
  direction?: RevealDirection
  /** Passed to each Reveal. */
  duration?: number
  /** Cap the total delay so a long list does not take seconds to finish. */
  maxDelay?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Sequences Reveal across a list, so items arrive one after another.
 *
 * The delay is capped: without it, a fifty-item list would still be animating
 * in several seconds after it appeared, and the last rows would feel broken.
 */
export function Stagger({
  children,
  interval = 60,
  direction = 'up',
  duration = 450,
  maxDelay = 400,
  className,
}: StaggerProps) {
  return (
    <div className={cn('contents', className)}>
      {Children.map(children, (child, index) => (
        <Reveal
          direction={direction}
          duration={duration}
          delay={Math.min(index * interval, maxDelay)}
        >
          {child}
        </Reveal>
      ))}
    </div>
  )
}
