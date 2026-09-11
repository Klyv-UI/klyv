import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ProgressRingSize = 'sm' | 'md' | 'lg'

const SIZES: Record<ProgressRingSize, { box: number; stroke: number }> = {
  sm: { box: 36, stroke: 4 },
  md: { box: 56, stroke: 5 },
  lg: { box: 88, stroke: 7 },
}

export interface ProgressRingProps {
  value?: number
  max?: number
  /** Accessible name — what is progressing. */
  label: string
  size?: ProgressRingSize
  /** Centre content — a percentage, a figure, an icon. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The same value as `Progress`, drawn as an arc. Use it where the slot is
 * square rather than wide — a tile corner, a compact summary.
 */
export function ProgressRing({
  value = 0,
  max = 100,
  label,
  size = 'md',
  children,
  className,
}: ProgressRingProps) {
  const { box, stroke } = SIZES[size]
  const radius = (box - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percent = max === 0 ? 0 : Math.min(1, Math.max(0, value / max))

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: box, height: box }}
    >
      <svg width={box} height={box} className="-rotate-90" aria-hidden="true">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line-strong"
        />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent)}
          className="stroke-accent-strong transition-[stroke-dashoffset] duration-[var(--duration-slow)]"
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </div>
  )
}
