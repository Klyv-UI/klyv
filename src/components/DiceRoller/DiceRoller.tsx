'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface DiceRollerProps {
  /** How many dice. */
  count?: number
  /** Die size in pixels. */
  size?: number
  /** Called with the faces once they land. */
  onRoll?: (values: number[]) => void
  /** Milliseconds of tumbling. */
  duration?: number
  /** Merged last, so it wins. */
  className?: string
}

/** Rotations that bring each face to the front, in degrees. */
const FACE: Record<number, [number, number]> = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [0, 180],
}

/** Pip layout per face, as a 3×3 grid of filled cells. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

const FACES: { value: number; transform: string }[] = [
  { value: 1, transform: 'translateZ(var(--half))' },
  { value: 6, transform: 'rotateY(180deg) translateZ(var(--half))' },
  { value: 2, transform: 'rotateY(90deg) translateZ(var(--half))' },
  { value: 5, transform: 'rotateY(-90deg) translateZ(var(--half))' },
  { value: 3, transform: 'rotateX(90deg) translateZ(var(--half))' },
  { value: 4, transform: 'rotateX(-90deg) translateZ(var(--half))' },
]

/**
 * Dice that tumble and land on a value.
 *
 * The result is decided before the animation starts, and the animation is
 * arranged to arrive at it — several whole turns plus exactly the rotation
 * that brings the chosen face forward. Rolling first and reading the transform
 * afterwards is the other way round, and it makes the outcome a function of
 * frame timing, which is both unfair and untestable.
 *
 * Whole extra turns are added on top so the die visibly tumbles rather than
 * rotating a few degrees to its answer. Because they are multiples of 360 they
 * cost nothing in accuracy — it lands exactly where it was always going to.
 *
 * The faces are six absolutely positioned squares pushed out from a shared
 * centre, which is the only arrangement where the corners stay closed at
 * every angle.
 */
export function DiceRoller({
  count = 2,
  size = 72,
  onRoll,
  duration = 1100,
  className,
}: DiceRollerProps) {
  const [values, setValues] = useState<number[]>(() => Array.from({ length: count }, () => 1))
  const [spins, setSpins] = useState<number[]>(() => Array.from({ length: count }, () => 0))
  const [rolling, setRolling] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setValues(Array.from({ length: count }, () => 1))
    setSpins(Array.from({ length: count }, () => 0))
  }, [count])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const roll = () => {
    if (rolling) return
    // Decided first. The animation is arranged to arrive at it.
    const next = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6))
    setValues(next)
    setSpins((current) => current.map((turns) => turns + 2 + Math.floor(Math.random() * 3)))
    setRolling(true)

    timer.current = window.setTimeout(() => {
      setRolling(false)
      onRoll?.(next)
    }, duration)
  }

  const total = values.reduce((sum, value) => sum + value, 0)

  return (
    <div className={cn('flex flex-col items-start gap-4', className)}>
      <div className="flex flex-wrap items-center gap-5" style={{ perspective: 900 }}>
        {values.map((value, index) => {
          const [rx, ry] = FACE[value]
          const turns = spins[index] ?? 0
          return (
            <div
              key={index}
              className="motion-safe-only relative"
              style={{
                width: size,
                height: size,
                transformStyle: 'preserve-3d',
                // Whole turns on top: multiples of 360 cost nothing in accuracy.
                transform: `rotateX(${rx + turns * 360}deg) rotateY(${ry + turns * 360}deg)`,
                transition: `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
                ['--half' as string]: `${size / 2}px`,
              }}
            >
              {FACES.map((face) => (
                <span
                  key={face.value}
                  className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 rounded-[var(--radius-tile)] border border-line bg-shell p-2 shadow-[var(--shadow-tile)]"
                  style={{ transform: face.transform, backfaceVisibility: 'hidden' }}
                >
                  {Array.from({ length: 9 }, (_, cell) => (
                    <span
                      key={cell}
                      className={cn(
                        'rounded-full',
                        PIPS[face.value].includes(cell) ? 'bg-ink' : 'bg-transparent',
                      )}
                    />
                  ))}
                </span>
              ))}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={roll}
          disabled={rolling}
          className="rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {rolling ? 'Rolling…' : 'Roll'}
        </button>
        <Text as="span" size="body" tabular>
          {rolling ? '—' : `${values.join(' + ')} = ${total}`}
        </Text>
      </div>

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {rolling ? 'Rolling' : `Rolled ${values.join(', ')}. Total ${total}.`}
        </p>
      </VisuallyHidden>
    </div>
  )
}
