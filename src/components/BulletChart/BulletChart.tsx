'use client'

import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
import { Text } from '../Text'
import { DRAW_IN_CLASS, niceScale, useDrawIn } from '../internal/plot'

export interface BulletChartRow {
  id: string
  /** What is measured — "Revenue", "NPS". */
  label: string
  /** Unit or period under the label — "USD, Q3". */
  sublabel?: string
  /** The actual figure, drawn as the dark bar. */
  value: number
  /** The goal, drawn as the cross line. */
  target?: number
  /**
   * Upper bounds of the qualitative ranges, ascending — for example poor,
   * satisfactory, good. The last one ends the scale unless the value or target
   * runs past it.
   */
  ranges: number[]
  /** Start of the scale. Defaults to 0. */
  min?: number
}

export interface BulletChartProps {
  /** One row per measure, stacked on a shared layout. */
  rows: BulletChartRow[]
  /** Accessible name for the group of measures. */
  label: string
  /** Names of the qualitative ranges, lowest first. Used in each row’s spoken summary. */
  rangeLabels?: string[]
  /** Format the value, target and axis ticks. */
  format?: (value: number) => string
  /** Print the axis under each bar. */
  showAxis?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/** Darker is worse, as in Few’s specification — readable in greyscale and to anyone who cannot tell hues apart. */
const BAND_OPACITY = [0.26, 0.17, 0.1, 0.06, 0.03]

/**
 * Stephen Few’s bullet graph: one measure, its target, and whether it is poor,
 * fine or good, in the space of a single line of text.
 *
 * It replaces the dashboard gauge, which spends a dial’s worth of area to show
 * one number and no context. The ranges are shades of ink rather than traffic
 * light colours, darkest for the worst range, so the graph survives greyscale
 * printing and colour-blindness, and nothing about the graph depends on hue.
 * The figure and target are printed as text beside the bar — the bar is for
 * comparing rows at a glance, the text for reading one.
 */
export function BulletChart({
  rows,
  label,
  rangeLabels = ['Poor', 'Satisfactory', 'Good'],
  format = formatTick,
  showAxis = true,
  className,
}: BulletChartProps) {
  const drawn = useDrawIn()

  return (
    <ul aria-label={label} className={cn('flex w-full list-none flex-col gap-4', className)}>
      {rows.map((row) => {
        const min = row.min ?? 0
        const ranges = [...row.ranges].sort((a, b) => a - b)
        const max = Math.max(ranges[ranges.length - 1] ?? 1, row.value, row.target ?? -Infinity)
        const span = max - min || 1
        const pct = (value: number) => Math.min(100, Math.max(0, ((value - min) / span) * 100))
        const ticks = niceScale(min, max, 4).ticks.filter((tick) => tick >= min && tick <= max)
        const bandIndex = ranges.findIndex((bound) => row.value <= bound)
        const bandName = rangeLabels[bandIndex === -1 ? ranges.length - 1 : bandIndex]
        const summary = [
          `${row.label}: ${format(row.value)}`,
          row.target !== undefined ? `target ${format(row.target)}` : null,
          bandName ? `in the ${bandName.toLowerCase()} range` : null,
        ]
          .filter(Boolean)
          .join(', ')

        return (
          <li key={row.id} className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] sm:items-start">
            <div className="flex min-w-0 flex-col gap-0.5 sm:items-end sm:text-right">
              <Text size="label" weight="bold" truncate className="max-w-full">
                {row.label}
              </Text>
              {row.sublabel && (
                <Text size="micro" weight="medium" tone="faint" truncate className="max-w-full">
                  {row.sublabel}
                </Text>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <svg role="img" aria-label={summary} viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full overflow-visible">
                {ranges.map((bound, index) => {
                  const from = index === 0 ? min : ranges[index - 1]
                  return (
                    <rect
                      key={bound}
                      x={pct(from)}
                      y={0}
                      width={Math.max(0, pct(bound) - pct(from))}
                      height={24}
                      fill="var(--color-ink)"
                      fillOpacity={BAND_OPACITY[Math.min(index, BAND_OPACITY.length - 1)]}
                    />
                  )
                })}
                <rect
                  x={0}
                  y={8}
                  width={pct(row.value)}
                  height={8}
                  className={cn('fill-ink transition-transform', DRAW_IN_CLASS)}
                  style={{ transformBox: 'fill-box', transformOrigin: 'left', transform: drawn ? 'scaleX(1)' : 'scaleX(0)' }}
                />
                {row.target !== undefined && (
                  <line
                    x1={pct(row.target)}
                    x2={pct(row.target)}
                    y1={3}
                    y2={21}
                    className="stroke-ink"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              {showAxis && (
                <div aria-hidden="true" className="relative h-3">
                  {ticks.map((tick) => (
                    <span
                      key={tick}
                      className="absolute top-0 text-[9px] font-medium leading-none text-ink-faint tabular-nums"
                      style={{
                        left: `${pct(tick)}%`,
                        transform: pct(tick) === 0 ? 'none' : pct(tick) === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                      }}
                    >
                      {format(tick)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div aria-hidden="true" className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0.5">
              <Text size="stat" tabular>
                {format(row.value)}
              </Text>
              {row.target !== undefined && (
                <Text size="micro" weight="medium" tone="faint" tabular>
                  Target {format(row.target)}
                </Text>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
