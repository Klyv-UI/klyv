'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { ChartTooltip } from '../ChartTooltip'
import { Legend } from '../Legend'
import { chartScale, formatTick, SERIES_COLORS, type ChartSeries } from '../../lib/chart'

export type { ChartSeries }

export interface CartesianChartProps {
  /** One entry per line or band, each with its own values. */
  series: ChartSeries[]
  /** One label per point, used for the x axis and the tooltip title. */
  categories: string[]
  /** Accessible name for the chart. */
  label: string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Show the series key under the plot. */
  showLegend?: boolean
  /** Show horizontal gridlines and the y axis. */
  showGrid?: boolean
  /** Format values in the tooltip and on the axis. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
  /** Drawn inside the plot area, given the resolved scale. */
  children: (context: {
    scale: ReturnType<typeof chartScale>
    series: (ChartSeries & { color: string })[]
    active: number | null
  }) => ReactNode
}

const WIDTH = 640
const BASE_PADDING = { top: 12, right: 12, bottom: 26 }

/**
 * The scaffolding every cartesian chart shares: scale, gridlines, axes, hover
 * tracking, legend, and an accessible data table behind the picture.
 *
 * That table is the important part. A chart is an image to a screen reader, so
 * each of these charts also renders its values as a real table — the picture is
 * the accelerator, not the only representation.
 */
export function CartesianChart({
  series,
  categories,
  label,
  height = 220,
  showLegend = true,
  showGrid = true,
  format = formatTick,
  className,
  children,
}: CartesianChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const tableId = useId()

  const resolved = series.map((entry, index) => ({
    ...entry,
    color: entry.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
  }))

  // The left gutter has to fit the widest tick label, or the axis clips.
  const probe = chartScale(series, {
    width: WIDTH,
    height,
    padding: { ...BASE_PADDING, left: 40 },
  })
  const widestTick = Math.max(...probe.ticks.map((tick) => format(tick).length))
  const padding = { ...BASE_PADDING, left: Math.max(32, widestTick * 6.2 + 12) }

  const scale = chartScale(series, { width: WIDTH, height, padding })

  const trackPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH
    const ratio = (x - scale.plot.x) / scale.plot.width
    const index = Math.round(ratio * (categories.length - 1))
    setActive(index >= 0 && index < categories.length ? index : null)
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={label}
          aria-describedby={tableId}
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="w-full"
          onPointerMove={trackPointer}
          onPointerLeave={() => setActive(null)}
        >
          {showGrid &&
            scale.ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={scale.plot.x}
                  x2={scale.plot.x + scale.plot.width}
                  y1={scale.toY(tick)}
                  y2={scale.toY(tick)}
                  className="stroke-line"
                  strokeWidth="1"
                />
                <text
                  x={scale.plot.x - 8}
                  y={scale.toY(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-ink-faint text-[9px] font-medium"
                >
                  {format(tick)}
                </text>
              </g>
            ))}

          {children({ scale, series: resolved, active })}

          {active !== null && (
            <line
              x1={scale.toX(active, categories.length)}
              x2={scale.toX(active, categories.length)}
              y1={scale.plot.y}
              y2={scale.plot.y + scale.plot.height}
              className="stroke-line-strong"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {categories.map((category, index) => {
            const step = Math.ceil(categories.length / 8)
            if (index % step !== 0 && index !== categories.length - 1) return null
            return (
              <text
                key={category}
                x={scale.toX(index, categories.length)}
                y={height - 8}
                textAnchor="middle"
                className="fill-ink-faint text-[9px] font-medium"
              >
                {category}
              </text>
            )
          })}
        </svg>

        {active !== null && (
          <div
            className="pointer-events-none absolute top-2"
            style={{
              left: `${(scale.toX(active, categories.length) / WIDTH) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <ChartTooltip
              title={categories[active]}
              rows={resolved.map((entry) => ({
                label: entry.label,
                value: format(entry.values[active] ?? 0),
                color: entry.color,
              }))}
            />
          </div>
        )}
      </div>

      {showLegend && resolved.length > 1 && (
        <Legend
          label={`${label} series`}
          series={resolved.map((entry) => ({ label: entry.label, color: entry.color }))}
        />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              {resolved.map((entry) => (
                <th key={entry.id} scope="col">
                  {entry.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={category}>
                <th scope="row">{category}</th>
                {resolved.map((entry) => (
                  <td key={entry.id}>{format(entry.values[index] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      {active !== null && (
        <Text size="caption" tone="faint" role="status" aria-live="polite" className="sr-only">
          {categories[active]}:{' '}
          {resolved.map((entry) => `${entry.label} ${format(entry.values[active] ?? 0)}`).join(', ')}
        </Text>
      )}
    </div>
  )
}
