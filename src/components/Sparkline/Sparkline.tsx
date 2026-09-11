'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'

export type SparklineTone = 'accent' | 'success' | 'danger' | 'neutral'

const STROKE: Record<SparklineTone, string> = {
  accent: 'var(--color-accent-strong)',
  success: 'var(--color-success)',
  danger: 'var(--color-danger)',
  neutral: 'var(--color-ink-faint)',
}

export interface SparklineProps {
  /** Series values, oldest first. Needs at least two points. */
  values: number[]
  /** Accessible summary of the trend. */
  label: string
  /** Intrinsic width in pixels. */
  width?: number
  /** Intrinsic height in pixels. */
  height?: number
  tone?: SparklineTone
  /** Fill the area under the line. */
  area?: boolean
  /** Mark the most recent point. */
  showLast?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * An inline trend line: no axes, no gridlines, no chart runtime. It shows the
 * shape of a series next to the figure it belongs to, and leaves precision to
 * that figure.
 */
export function Sparkline({
  values,
  label,
  width = 96,
  height = 28,
  tone = 'accent',
  area = false,
  showLast = false,
  className,
}: SparklineProps) {
  const gradientId = useId()

  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 2

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - pad * 2) + pad
    const y = height - pad - ((value - min) / span) * (height - pad * 2)
    return [x, y] as const
  })

  const line = points.map(([x, y]) => `${x},${y}`).join(' ')
  const last = points[points.length - 1]

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('shrink-0 overflow-visible', className)}
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STROKE[tone]} stopOpacity="0.28" />
              <stop offset="100%" stopColor={STROKE[tone]} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`${pad},${height} ${line} ${width - pad},${height}`}
            fill={`url(#${gradientId})`}
          />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLast && <circle cx={last[0]} cy={last[1]} r="2.5" fill={STROKE[tone]} />}
    </svg>
  )
}
