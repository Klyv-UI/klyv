'use client'

import { useMemo, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'

export type WaveformTone = 'accent' | 'ink' | 'success' | 'danger'

const TONES: Record<WaveformTone, string> = {
  accent: 'bg-accent-strong',
  ink: 'bg-ink',
  success: 'bg-success',
  danger: 'bg-danger',
}

export interface WaveformProps {
  /** Accessible description — what the bars represent. */
  label: string
  /** Bar count. Ignored when `values` is given. */
  bars?: number
  /** Fixed heights, 0–1. Supply these to draw a real signal. */
  values?: number[]
  /** Animate the bars. With `values`, the bars breathe around their height. */
  playing?: boolean
  /** Fraction already played, 0–1. Bars behind it stay lit. */
  progress?: number
  /** Bar colour. */
  tone?: WaveformTone
  /** Overall height in pixels. */
  height?: number
  /** Width of one bar in pixels. */
  barWidth?: number
  /** Space between bars in pixels. */
  gap?: number
  /** Mirror the bars around the centre line, as an editor waveform does. */
  mirrored?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The bar visualiser: a row of bars that rise and fall while something plays.
 *
 * Given `values` it draws a real signal; given none it generates a stable
 * pseudo-random envelope from the bar index, so the shape is deterministic
 * across renders and does not reshuffle every time the parent re-renders.
 *
 * Movement is one `scaleY` keyframe per bar with a staggered delay and a
 * per-bar duration, rather than a frame loop writing heights. That keeps the
 * whole thing on the compositor, so a paused visualiser costs nothing and a
 * playing one costs a transform.
 *
 * `progress` is what makes it a player rather than a decoration: bars behind
 * the playhead stay at full opacity, bars ahead of it dim.
 */
export function Waveform({
  label,
  bars = 32,
  values,
  playing = false,
  progress,
  tone = 'accent',
  height = 44,
  barWidth = 3,
  gap = 3,
  mirrored = false,
  className,
}: WaveformProps) {
  const heights = useMemo(() => {
    if (values && values.length > 0) return values.map((value) => Math.min(1, Math.max(0.06, value)))
    // A cheap deterministic hash of the index — two sines at co-prime rates
    // read as random but produce the same envelope every render.
    return Array.from({ length: bars }, (_, index) => {
      const wave = Math.sin(index * 1.37) * 0.5 + Math.sin(index * 0.53) * 0.35
      return 0.24 + Math.abs(wave) * 0.72
    })
  }, [bars, values])

  const played = typeof progress === 'number' ? Math.round(heights.length * progress) : null

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('flex items-center', mirrored ? 'items-center' : 'items-end', className)}
      style={{ gap, height }}
    >
      {heights.map((value, index) => {
        const ahead = played !== null && index >= played
        return (
          <span
            key={index}
            className={cn(
              'motion-safe-only block shrink-0 rounded-full transition-opacity duration-[var(--duration-slow)]',
              TONES[tone],
              mirrored ? 'origin-center' : 'origin-bottom',
              ahead ? 'opacity-25' : 'opacity-100',
            )}
            style={
              {
                width: barWidth,
                height: `${value * 100}%`,
                '--bar-high': 1,
                '--bar-low': Math.max(0.18, value * 0.42),
                animation: playing
                  ? `waveform-pulse ${0.7 + (index % 5) * 0.13}s ease-in-out infinite`
                  : undefined,
                animationDelay: playing ? `${(index % 7) * 0.08}s` : undefined,
                transform: playing ? undefined : 'scaleY(1)',
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
