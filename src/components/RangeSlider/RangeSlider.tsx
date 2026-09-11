'use client'

import { cn } from '../../lib/cn'

export interface RangeSliderProps {
  /** Current range, low then high. */
  value: [number, number]
  onValueChange: (value: [number, number]) => void
  min?: number
  max?: number
  step?: number
  /** Accessible names for the two thumbs. */
  labels?: [string, string]
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Two thumbs sharing one track. Implemented as two overlaid native range
 * inputs, so each thumb keeps full keyboard support and reports its own value
 * with the correct bounds — a single custom-drawn control would give up both.
 *
 * The thumbs cannot cross: each one clamps against the other.
 */
export function RangeSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  labels = ['Minimum', 'Maximum'],
  disabled = false,
  className,
}: RangeSliderProps) {
  const [low, high] = value
  const span = max - min || 1
  const lowPercent = ((low - min) / span) * 100
  const highPercent = ((high - min) / span) * 100

  const thumb = cn(
    'pointer-events-none absolute inset-x-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent',
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4',
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
    '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[var(--shadow-float)]',
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4',
    '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0',
    '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[var(--shadow-float)]',
    'disabled:pointer-events-none',
  )

  return (
    <div className={cn('relative h-4 w-full', disabled && 'opacity-40', className)}>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line-strong"
      />
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent-strong"
        style={{ left: `${lowPercent}%`, width: `${Math.max(0, highPercent - lowPercent)}%` }}
      />
      <input
        type="range"
        aria-label={labels[0]}
        value={low}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onValueChange([Math.min(Number(event.target.value), high), high])}
        className={thumb}
      />
      <input
        type="range"
        aria-label={labels[1]}
        value={high}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onValueChange([low, Math.max(Number(event.target.value), low)])}
        className={thumb}
      />
    </div>
  )
}
