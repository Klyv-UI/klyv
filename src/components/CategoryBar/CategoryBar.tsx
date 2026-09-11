import { SERIES_COLORS } from '../../lib/chart'
import { cn } from '../../lib/cn'
import { Legend } from '../Legend'
import { Text } from '../Text'

export interface CategoryBarSegment {
  id: string
  label: string
  value: number
  /** Any CSS colour. Defaults take the series ramp in order. */
  color?: string
}

export interface CategoryBarProps {
  segments: CategoryBarSegment[]
  /** Accessible name — what is being split. */
  label: string
  /** The whole. Defaults to the sum; set it higher to show unused capacity. */
  total?: number
  /** Turns a value into its printed figure. */
  format?: (value: number) => string
  /** A line across the bar — a quota, a target, a limit. */
  marker?: { value: number; label: string }
  showLegend?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const plain = (value: number) => value.toLocaleString()

/**
 * One bar split into its parts — storage by type, budget by team, time by task.
 *
 * Where a donut asks the eye to compare angles, this asks it to compare lengths
 * along one axis, which it does far better. Parts are separated by a two-pixel
 * gap rather than a border, so neighbouring colours never bleed; unused
 * capacity is its own quiet track; and the bar carries a text alternative that
 * reads every part with its figure. Colours take the series ramp in a fixed
 * order and are never recycled — past the ramp, pass a colour.
 */
export function CategoryBar({
  segments,
  label,
  total,
  format = plain,
  marker,
  showLegend = true,
  className,
}: CategoryBarProps) {
  const sum = segments.reduce((running, segment) => running + segment.value, 0)
  const whole = Math.max(total ?? sum, 1)
  const coloured = segments.map((segment, index) => ({
    ...segment,
    color: segment.color ?? SERIES_COLORS[index] ?? 'var(--color-line-strong)',
  }))

  const summary = [
    `${label}:`,
    coloured.map((segment) => `${segment.label} ${format(segment.value)}`).join(', '),
    total !== undefined ? `of ${format(total)}` : '',
    marker ? `— ${marker.label} at ${format(marker.value)}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative py-1">
        <div
          role="img"
          aria-label={summary}
          className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-surface-muted"
        >
          {coloured
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.id}
                className="h-full shrink-0"
                style={{ width: `${(segment.value / whole) * 100}%`, background: segment.color }}
              />
            ))}
        </div>

        {marker && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-ink"
            style={{ left: `${Math.min(100, (marker.value / whole) * 100)}%` }}
          />
        )}
      </div>

      {(showLegend || marker) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {showLegend && (
            <Legend
              series={coloured.map((segment) => ({
                label: segment.label,
                color: segment.color,
                value: format(segment.value),
              }))}
            />
          )}
          {marker && (
            <Text as="span" size="micro" weight="semibold" tone="faint" tabular aria-hidden="true">
              {marker.label} · {format(marker.value)}
            </Text>
          )}
        </div>
      )}
    </div>
  )
}
