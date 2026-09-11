'use client'

import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface KnobProps {
  value: number
  onChange: (value: number) => void
  /** What is being turned. */
  label: string
  /** Lowest value. */
  min?: number
  /** Highest value. */
  max?: number
  /** Snap to this increment. 0 is continuous. */
  step?: number
  /** Diameter in pixels. */
  size?: number
  /** Degrees of the sweep. 270 is the studio convention. */
  sweep?: number
  /** Value the ring fills out from — 0 for a level, the middle for a pan. */
  origin?: number
  /** Shown under the knob. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A rotary control you drag, scroll or arrow.
 *
 * The drag is *vertical*, not circular. Following the pointer's angle around
 * the knob seems obvious and is much worse to use: near the centre a pixel of
 * movement is a huge angular change, and the value spikes every time the
 * pointer crosses the middle. Every hardware-emulating interface settled on
 * vertical travel for the same reason, and Shift makes it fine-grained.
 *
 * The sweep stops at 270 degrees with a gap at the bottom, which is what makes
 * the extremes *readable* — a full circle has no visual difference between
 * minimum and maximum.
 *
 * `origin` is what separates a level from a pan: a volume ring fills from the
 * bottom, a pan ring fills out from the centre in whichever direction it has
 * been pushed, and both are the same component.
 */
export function Knob({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  step = 0,
  size = 76,
  sweep = 270,
  origin,
  format,
  className,
}: KnobProps) {
  const drag = useRef<{ y: number; value: number } | null>(null)
  const [active, setActive] = useState(false)

  const span = max - min
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  const snap = (next: number) => (step > 0 ? Math.round(next / step) * step : next)
  const commit = (next: number) => onChange(clamp(snap(next)))

  const fraction = (value - min) / span
  const start = -sweep / 2
  const angle = start + fraction * sweep

  const zero = origin ?? min
  const zeroFraction = (zero - min) / span
  const from = start + zeroFraction * sweep

  const radius = size / 2 - 6
  const stroke = Math.max(3, size * 0.075)
  const circumference = 2 * Math.PI * radius
  // The arc is drawn between origin and value, whichever way round they are.
  const arcFraction = Math.abs(fraction - zeroFraction) * (sweep / 360)
  const arcStart = Math.min(angle, from)

  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format ? format(value) : undefined}
        aria-orientation="vertical"
        onPointerDown={(event) => {
          drag.current = { y: event.clientY, value }
          setActive(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          // Vertical travel: a circular drag spikes whenever the pointer
          // crosses the centre.
          const sensitivity = event.shiftKey ? 600 : 180
          commit(drag.current.value + ((drag.current.y - event.clientY) / sensitivity) * span)
        }}
        onPointerUp={() => {
          drag.current = null
          setActive(false)
        }}
        onPointerCancel={() => {
          drag.current = null
          setActive(false)
        }}
        onWheel={(event) => {
          event.preventDefault()
          commit(value - Math.sign(event.deltaY) * (step || span / 50))
        }}
        onKeyDown={(event) => {
          const amount = (event.shiftKey ? 10 : 1) * (step || span / 100)
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') commit(value + amount)
          else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') commit(value - amount)
          else if (event.key === 'Home') commit(min)
          else if (event.key === 'End') commit(max)
          else return
          event.preventDefault()
        }}
        className={cn(
          'relative grid cursor-ns-resize place-items-center rounded-full outline-offset-4',
          active && 'cursor-grabbing',
        )}
        style={{ width: size, height: size, touchAction: 'none' }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          {/* The 90-degree gap at the bottom is what makes min and max
              distinguishable at a glance. */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-track)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * (sweep / 360)} ${circumference}`}
            transform={`rotate(${start + 90} ${size / 2} ${size / 2})`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-accent-strong)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * arcFraction} ${circumference}`}
            transform={`rotate(${arcStart + 90} ${size / 2} ${size / 2})`}
          />
        </svg>

        <span
          className="absolute grid place-items-center rounded-full border border-line bg-surface shadow-[var(--shadow-tile)]"
          style={{ width: size * 0.62, height: size * 0.62 }}
        >
          {/* The pointer line. Without it the knob has no readable position. */}
          <span
            className="absolute rounded-full bg-ink"
            style={{
              width: 2,
              height: size * 0.2,
              top: size * 0.06,
              transform: `rotate(${angle}deg)`,
              transformOrigin: `center ${size * 0.25}px`,
            }}
          />
        </span>
      </div>

      <Text as="span" size="micro" tone="faint" tabular>
        {label}
      </Text>
      <Text as="span" size="caption" weight="bold" tabular>
        {format ? format(value) : Math.round(value)}
      </Text>
    </div>
  )
}
