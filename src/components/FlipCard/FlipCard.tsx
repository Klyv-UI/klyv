'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface FlipCardProps {
  front: ReactNode
  back: ReactNode
  /** Accessible name for the toggle, e.g. "Card details". */
  label: string
  /** Controlled flip state. */
  flipped?: boolean
  /** Called when the card turns. Pair with `flipped` to control it. */
  onFlippedChange?: (flipped: boolean) => void
  axis?: 'y' | 'x'
  /** Fixed height. A flip card needs one, since both faces are stacked. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Two faces on one card, with a flip between them.
 *
 * The trigger is a real button with aria-pressed and both faces stay in the
 * DOM, so the hidden face is marked inert to assistive tech rather than being
 * announced twice. A fixed height is required because the faces are stacked.
 */
export function FlipCard({
  front,
  back,
  label,
  flipped: controlled,
  onFlippedChange,
  axis = 'y',
  height = 200,
  className,
}: FlipCardProps) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const flipped = controlled ?? uncontrolled

  const toggle = () => {
    const next = !flipped
    if (controlled === undefined) setUncontrolled(next)
    onFlippedChange?.(next)
  }

  const rotate = axis === 'y' ? 'rotateY' : 'rotateX'

  return (
    <div style={{ perspective: 1200, height }} className={cn('relative w-full', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={flipped}
        aria-label={label}
        className="absolute inset-0 z-10 size-full rounded-[var(--radius-card)]"
      />
      <div
        className="relative size-full transition-transform duration-[400ms] ease-out [transform-style:preserve-3d]"
        style={{ transform: flipped ? `${rotate}(180deg)` : undefined }}
      >
        <div
          aria-hidden={flipped}
          className="absolute inset-0 [backface-visibility:hidden]"
        >
          {front}
        </div>
        <div
          aria-hidden={!flipped}
          className="absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: `${rotate}(180deg)` }}
        >
          {back}
        </div>
      </div>
    </div>
  )
}
