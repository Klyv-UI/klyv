'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export type TickerDirection = 'up' | 'down' | 'flat'

export interface TickerProps {
  /** Current value. Changing it flashes the direction of travel. */
  value: number
  format?: (value: number) => string
  /** Accessible name for the figure. */
  label: string
  /** How long the directional flash lasts. */
  flashDuration?: number
  /** Merged last, so it wins. */
  className?: string
}

const TONES: Record<TickerDirection, string> = {
  up: 'text-success',
  down: 'text-danger',
  flat: 'text-ink',
}

const ARROWS: Record<TickerDirection, string> = { up: '▲', down: '▼', flat: '' }

/**
 * A live value that flashes green or red in the direction it moved. The colour
 * is transient and the arrow is decorative, so the change is also announced
 * through a polite live region rather than by colour alone.
 */
export function Ticker({
  value,
  format = (next) => next.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  label,
  flashDuration = 900,
  className,
}: TickerProps) {
  const previous = useRef(value)
  const [direction, setDirection] = useState<TickerDirection>('flat')

  useEffect(() => {
    if (value === previous.current) return
    setDirection(value > previous.current ? 'up' : 'down')
    previous.current = value
    const timer = setTimeout(() => setDirection('flat'), flashDuration)
    return () => clearTimeout(timer)
  }, [value, flashDuration])

  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1 font-bold transition-colors',
        TONES[direction],
        className,
      )}
    >
      <span aria-hidden="true">{format(value)}</span>
      {direction !== 'flat' && (
        <span aria-hidden="true" className="text-[0.7em]">
          {ARROWS[direction]}
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {label}: {format(value)}
        {direction !== 'flat' ? `, ${direction}` : ''}
      </span>
    </span>
  )
}
