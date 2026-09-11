import { cn } from '../../lib/cn'
import { Legend } from '../Legend'

export interface ProgressSegment {
  label: string
  value: number
  /** Any CSS colour. Defaults walk the accent ramp. */
  color?: string
}

const DEFAULT_COLORS = [
  'var(--color-accent-strong)',
  'var(--color-accent)',
  'var(--color-accent-soft)',
  'var(--color-line-strong)',
]

export interface ProgressChartProps {
  segments: ProgressSegment[]
  /** Total to measure against. Defaults to the sum of the segments. */
  total?: number
  /** Accessible name for the chart. */
  label: string
  /** Show the series key underneath. */
  showLegend?: boolean
  /** Bar thickness. */
  size?: 'sm' | 'md'
  /** Format each value in the key. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Part-to-whole as one stacked bar. Use it when the parts sum to something
 * meaningful; when they do not, a row of separate Progress bars is clearer.
 */
export function ProgressChart({
  segments,
  total,
  label,
  showLegend = true,
  size = 'md',
  format = (value) => String(value),
  className,
}: ProgressChartProps) {
  const sum = segments.reduce((accumulator, segment) => accumulator + segment.value, 0)
  const denominator = total ?? (sum || 1)
  const resolved = segments.map((segment, index) => ({
    ...segment,
    color: segment.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    percent: (segment.value / denominator) * 100,
  }))

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div
        role="img"
        aria-label={`${label}: ${resolved
          .map((segment) => `${segment.label} ${format(segment.value)}`)
          .join(', ')}`}
        className={cn(
          'flex w-full overflow-hidden rounded-full bg-line-strong',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
      >
        {resolved.map((segment) => (
          <span
            key={segment.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${segment.percent}%`, background: segment.color }}
          />
        ))}
      </div>
      {showLegend && (
        <Legend
          series={resolved.map((segment) => ({
            label: segment.label,
            color: segment.color,
            value: format(segment.value),
          }))}
        />
      )}
    </div>
  )
}
