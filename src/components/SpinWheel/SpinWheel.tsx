'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { Text } from '../Text'

export interface SpinWheelSegment {
  /** Identifies the segment. Falls back to the label. */
  id?: string
  /** Drawn on the wheel and announced as the result. */
  label: string
  /** Relative share of the wheel, and of the odds. Defaults to 1. */
  weight?: number
}

export interface SpinWheelProps {
  /** The prizes or choices, clockwise from the pointer. */
  segments: SpinWheelSegment[]
  /** Land on this segment (by id or label) instead of a weighted random one — for a result decided on the server. */
  winner?: string
  /** Called once the wheel has stopped, with the segment and its index. */
  onSpinEnd?: (segment: SpinWheelSegment, index: number) => void
  /** Called as a spin starts. */
  onSpinStart?: () => void
  /** Length of a spin, in milliseconds. */
  duration?: number
  /** Whole turns before it settles. */
  turns?: number
  /** Diameter in pixels. */
  size?: number
  /** Label on the spin button. */
  spinLabel?: string
  /** Blocks spinning. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

// Accent strengths, cycled so neighbours always differ. Mixed toward the surface
// rather than white, so the wheel keeps its shape on a dark page too.
const TINTS = [100, 58, 28, 78, 44]
const idOf = (segment: SpinWheelSegment) => segment.id ?? segment.label

const point = (angle: number, radius: number) => {
  const radians = ((angle - 90) * Math.PI) / 180
  return [Math.cos(radians) * radius, Math.sin(radians) * radius]
}

const pick = (segments: SpinWheelSegment[]) => {
  const total = segments.reduce((sum, segment) => sum + (segment.weight ?? 1), 0)
  let roll = Math.random() * total
  for (let index = 0; index < segments.length; index += 1) {
    roll -= segments[index].weight ?? 1
    if (roll < 0) return index
  }
  return segments.length - 1
}

/**
 * A prize or decision wheel that decelerates onto its result.
 *
 * The winner is chosen before the wheel moves — weighted by segment size, or
 * handed in by the caller — and the animation only travels there. A wheel whose
 * outcome is read off wherever the physics happened to stop cannot be weighted
 * honestly or decided on a server, and the drawn slice would be the odds in name
 * only. Here a slice’s angle is its weight, so what you see is the chance.
 *
 * The result is written out under the wheel and announced, since a stopped wheel
 * alone says nothing to a screen reader. Under reduced motion there is no spin:
 * the wheel turns straight to the winner and the result appears at once.
 */
export function SpinWheel({
  segments,
  winner,
  onSpinEnd,
  onSpinStart,
  duration = 4200,
  turns = 5,
  size = 300,
  spinLabel = 'Spin',
  disabled = false,
  className,
}: SpinWheelProps) {
  const reduced = usePrefersReducedMotion()
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const timer = useRef<number>()

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.weight ?? 1), 0) || 1
  let cursor = 0
  const arcs = segments.map((segment) => {
    const span = (Math.max(0, segment.weight ?? 1) / total) * 360
    const arc = { start: cursor, span }
    cursor += span
    return arc
  })

  const spin = () => {
    if (spinning || disabled || segments.length === 0) return
    const forced = winner === undefined ? -1 : segments.findIndex((segment) => idOf(segment) === winner)
    const index = forced >= 0 ? forced : pick(segments)
    const { start, span } = arcs[index]
    // Somewhere inside the slice, never on its edge, so the pointer is unambiguous.
    const landing = start + span / 2 + (Math.random() - 0.5) * span * 0.6
    const offset = (((-landing - rotation) % 360) + 360) % 360
    const next = rotation + (reduced ? 0 : turns * 360) + offset

    setResult(null)
    onSpinStart?.()
    setRotation(next)

    const finish = () => {
      setSpinning(false)
      setResult(index)
      onSpinEnd?.(segments[index], index)
    }
    if (reduced) {
      finish()
      return
    }
    setSpinning(true)
    timer.current = window.setTimeout(finish, duration)
  }

  const fontSize = segments.length > 10 ? 7 : 9

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative" style={{ width: size, height: size, maxWidth: '100%' }}>
        <svg
          viewBox="-100 -100 200 200"
          role="img"
          aria-label={`Wheel with ${segments.length} segments: ${segments.map((segment) => segment.label).join(', ')}`}
          className="size-full motion-reduce:transition-none"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning && !reduced ? `transform ${duration}ms cubic-bezier(0.12, 0.72, 0.08, 1)` : 'none',
          }}
        >
          <circle r="99" className="fill-surface stroke-line-strong" strokeWidth="2" />
          {segments.map((segment, index) => {
            const { start, span } = arcs[index]
            const tint = TINTS[index % TINTS.length]
            const strong = tint >= 70
            const [x1, y1] = point(start, 96)
            const [x2, y2] = point(start + span, 96)
            const [tx, ty] = point(start + span / 2, 58)
            const path =
              span >= 359.99
                ? 'M0 -96 A96 96 0 1 1 -0.01 -96 Z'
                : `M0 0 L${x1} ${y1} A96 96 0 ${span > 180 ? 1 : 0} 1 ${x2} ${y2} Z`
            const text = segment.label.length > 14 ? `${segment.label.slice(0, 13)}…` : segment.label
            return (
              <g key={idOf(segment)}>
                <path
                  d={path}
                  style={{ fill: `color-mix(in oklab, var(--color-accent) ${tint}%, var(--color-surface))` }}
                  className={cn('stroke-surface', result === index && !spinning && 'stroke-ink')}
                  strokeWidth={result === index && !spinning ? 2.5 : 1.25}
                />
                {span >= 12 && (
                  <text
                    x={tx}
                    y={ty}
                    transform={`rotate(${start + span / 2 - 90} ${tx} ${ty})`}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={fontSize}
                    fontWeight={700}
                    className={strong ? 'fill-accent-ink' : 'fill-ink'}
                  >
                    {text}
                  </text>
                )}
              </g>
            )
          })}
          <circle r="13" className="fill-surface stroke-line-strong" strokeWidth="2" />
        </svg>
        {/* The pointer stays put while the wheel turns beneath it. */}
        <svg
          viewBox="0 0 24 24"
          width={28}
          height={28}
          aria-hidden="true"
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 drop-shadow-sm"
        >
          <path d="M12 22L3 4h18z" className="fill-ink stroke-surface" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-2">
        {/* aria-disabled rather than disabled while spinning, so focus stays on the button. */}
        <Button onClick={spin} aria-disabled={spinning || undefined} disabled={disabled || segments.length === 0}>
          {spinning ? 'Spinning' : result === null ? spinLabel : 'Spin again'}
        </Button>
        <Text as="p" role="status" size="body" weight="bold" className="min-h-5 text-center">
          {spinning ? '' : result !== null ? `Result: ${segments[result]?.label}` : ''}
        </Text>
      </div>
    </div>
  )
}
