'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface XPBarProps {
  /** Current level. */
  level: number
  /** Points into this level. */
  xp: number
  /** Points needed to finish it. */
  needed: number
  /** Name for the thing being levelled. */
  label?: string
  /** Fired when a change carries the bar past the end. */
  onLevelUp?: (level: number) => void
  /** Sparks on a level-up. */
  celebrate?: boolean
  size?: 'sm' | 'md'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A level, a bar, and the moment it fills.
 *
 * The interesting state is the overflow. When a gain crosses the end of a
 * level the bar has to run to full, empty, and continue — three phases, not
 * one — because a bar that simply jumps to its new fraction throws away the
 * only satisfying frame in the whole component.
 *
 * So a level change is detected and sequenced: fill to 100%, hold for a beat,
 * snap to zero with the transition off, then animate to the remainder. Snapping
 * with the transition still on is what produces the backwards sweep everyone
 * has seen in a game menu.
 *
 * The number is announced politely once the sequence settles, rather than on
 * every frame of the fill — a live region narrating a progress bar is unusable.
 */
export function XPBar({
  level,
  xp,
  needed,
  label = 'Level',
  onLevelUp,
  celebrate = true,
  size = 'md',
  className,
}: XPBarProps) {
  const [fill, setFill] = useState(() => Math.min(1, xp / Math.max(1, needed)))
  const [eased, setEased] = useState(true)
  const [popped, setPopped] = useState(false)
  const previousLevel = useRef(level)

  const target = Math.min(1, xp / Math.max(1, needed))

  useEffect(() => {
    if (level === previousLevel.current) {
      setEased(true)
      setFill(target)
      return
    }

    const gained = level
    previousLevel.current = level

    // Three phases. A single jump throws away the only good frame here.
    setEased(true)
    setFill(1)
    const toZero = window.setTimeout(() => {
      setEased(false)
      setFill(0)
      setPopped(celebrate)
    }, 420)
    const toRest = window.setTimeout(() => {
      setEased(true)
      setFill(target)
      onLevelUp?.(gained)
    }, 480)
    const settle = window.setTimeout(() => setPopped(false), 1400)

    return () => {
      window.clearTimeout(toZero)
      window.clearTimeout(toRest)
      window.clearTimeout(settle)
    }
  }, [celebrate, level, onLevelUp, target])

  const height = size === 'sm' ? 8 : 12

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="relative inline-flex items-center gap-2">
          <span
            className={cn(
              'motion-safe-only inline-grid place-items-center rounded-full bg-ink text-ink-inverse',
              size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-7 w-7 text-[12px]',
            )}
            style={popped ? ({ animation: 'badge-pop 600ms ease-out' } as CSSProperties) : undefined}
          >
            <span className="font-extrabold tabular-nums">{level}</span>
          </span>
          <Text as="span" size="caption" weight="bold">
            {label} {level}
          </Text>

          {popped && (
            <>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="motion-safe-only pointer-events-none absolute left-3 top-3 text-[10px]"
                  style={
                    {
                      '--burst-drift': `${(index - 2.5) * 16}px`,
                      animation: `reaction-float 900ms ease-out ${index * 40}ms forwards`,
                      opacity: 0,
                    } as CSSProperties
                  }
                >
                  ✦
                </span>
              ))}
            </>
          )}
        </span>

        <Text as="span" size="caption" tone="faint" tabular>
          {xp} / {needed} XP
        </Text>
      </div>

      <div
        role="progressbar"
        aria-label={`${label} ${level} progress`}
        aria-valuenow={xp}
        aria-valuemin={0}
        aria-valuemax={needed}
        className="w-full overflow-hidden rounded-full bg-track"
        style={{ height }}
      >
        <div
          className={cn(
            'h-full origin-left rounded-full',
            // Off during the snap back to zero, or the bar sweeps backwards.
            eased && 'motion-safe-only transition-transform duration-[var(--duration-slow)] ease-out',
          )}
          style={{
            width: '100%',
            transform: `scaleX(${fill})`,
            background: 'linear-gradient(90deg, var(--color-accent-strong), #7fd4ff)',
          }}
        />
      </div>

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {label} {level}, {xp} of {needed} XP
        </p>
      </VisuallyHidden>
    </div>
  )
}
