'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatTick, SERIES_COLORS } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { VisuallyHidden } from '../VisuallyHidden'
import {
  DRAW_IN_CLASS,
  PLOT_WIDTH,
  PlotAnnouncer,
  PlotTip,
  TICK_CLASS,
  gutterFor,
  linear,
  niceScale,
  pointerToView,
  quantile,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export type BoxPlotOrientation = 'vertical' | 'horizontal'

/** A five-number summary, for when the raw values live somewhere else. */
export interface BoxPlotSummary {
  /** Lower whisker end. */
  min: number
  q1: number
  median: number
  q3: number
  /** Upper whisker end. */
  max: number
  /** Points beyond the whiskers. */
  outliers?: number[]
}

export interface BoxPlotGroup {
  id: string
  label: string
  /** Raw observations. Quartiles, whiskers and outliers are computed from them. */
  values?: number[]
  /** A precomputed summary. Used when `values` is not given. */
  summary?: BoxPlotSummary
  /** Box colour. Any CSS colour; defaults walk SERIES_COLORS. */
  color?: string
}

export interface BoxPlotProps {
  /** One box per category. */
  groups: BoxPlotGroup[]
  /** Accessible name for the chart. */
  label: string
  /** Boxes stand up from a category axis, or lie along it. */
  orientation?: BoxPlotOrientation
  /** Chart height in pixels. Defaults to 240 vertical, or 44 per row horizontal. */
  height?: number
  /** Format values on the axis and in the tooltip. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

/** Tukey’s box: quartiles by linear interpolation, whiskers to the last value within 1.5 IQR. */
function summarise(group: BoxPlotGroup): BoxPlotSummary | null {
  if (!group.values) return group.summary ?? null
  const sorted = group.values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const reach = (q3 - q1) * 1.5
  const inside = sorted.filter((value) => value >= q1 - reach && value <= q3 + reach)
  return {
    min: inside[0] ?? q1,
    q1,
    median: quantile(sorted, 0.5),
    q3,
    max: inside[inside.length - 1] ?? q3,
    outliers: sorted.filter((value) => value < q1 - reach || value > q3 + reach),
  }
}

/**
 * Distributions side by side: the middle half as a box, the median as a line,
 * whiskers to the furthest values within 1.5 IQR, and everything past them as
 * individual dots.
 *
 * Averages hide the thing a box plot exists to show — two groups with the same
 * mean and very different spread. Outliers are drawn one by one rather than
 * folded into the whisker, because the slow request at the tail is usually the
 * one someone is looking for. Give it raw values and it computes the summary;
 * give it a summary when the values are too many to ship to the browser.
 */
export function BoxPlot({
  groups,
  label,
  orientation = 'vertical',
  height,
  format = formatTick,
  className,
}: BoxPlotProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const horizontal = orientation === 'horizontal'
  const chartHeight = height ?? (horizontal ? groups.length * 44 + 40 : 240)

  const rows = groups.map((group, index) => ({
    ...group,
    color: group.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
    stats: summarise(group),
  }))
  const { active, setActive, keyProps } = useChartCursor(rows.length)

  let low = Infinity
  let high = -Infinity
  for (const { stats } of rows) {
    if (!stats) continue
    for (const value of [stats.min, stats.max, ...(stats.outliers ?? [])]) {
      low = Math.min(low, value)
      high = Math.max(high, value)
    }
  }
  const scale = niceScale(low, high, horizontal ? 5 : 4)

  const categoryGutter = horizontal ? Math.max(48, Math.max(...rows.map((row) => row.label.length)) * 5.6 + 12) : 0
  const left = horizontal ? categoryGutter : gutterFor(scale.ticks, format)
  const plot = { x: left, y: 12, width: PLOT_WIDTH - left - 14, height: chartHeight - 12 - 26 }
  const toValue = horizontal
    ? linear(scale.min, scale.max, plot.x, plot.x + plot.width)
    : linear(scale.min, scale.max, plot.y + plot.height, plot.y)
  const along = horizontal ? plot.height : plot.width
  const band = along / Math.max(1, rows.length)
  const centre = (index: number) => (horizontal ? plot.y : plot.x) + band * (index + 0.5)
  const thickness = Math.min(44, band * 0.5)

  /** Places a (position-along-category, value) pair in x/y. */
  const at = (across: number, value: number) =>
    horizontal ? { x: toValue(value), y: across } : { x: across, y: toValue(value) }
  const line = (a: number, v1: number, b: number, v2: number) => {
    const p = at(a, v1)
    const q = at(b, v2)
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y }
  }

  const describe = (row: (typeof rows)[number]) =>
    row.stats
      ? `${row.label}: median ${format(row.stats.median)}, quartiles ${format(row.stats.q1)} to ${format(row.stats.q3)}, whiskers ${format(row.stats.min)} to ${format(row.stats.max)}, ${row.stats.outliers?.length ?? 0} outliers`
      : `${row.label}: no data`

  const current = active === null ? null : rows[active]

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. Use arrow keys to step through the groups.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${chartHeight}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={(event) => {
            const point = pointerToView(event, PLOT_WIDTH, chartHeight)
            const offset = horizontal ? point.y - plot.y : point.x - plot.x
            const index = Math.floor(offset / band)
            setActive(index >= 0 && index < rows.length ? index : null)
          }}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {scale.ticks.map((tick) => {
            const grid = horizontal
              ? { x1: toValue(tick), x2: toValue(tick), y1: plot.y, y2: plot.y + plot.height }
              : { x1: plot.x, x2: plot.x + plot.width, y1: toValue(tick), y2: toValue(tick) }
            return (
              <g key={tick}>
                <line {...grid} className="stroke-line" strokeWidth="1" />
                <text
                  x={horizontal ? toValue(tick) : plot.x - 8}
                  y={horizontal ? plot.y + plot.height + 16 : toValue(tick)}
                  textAnchor={horizontal ? 'middle' : 'end'}
                  dominantBaseline={horizontal ? undefined : 'middle'}
                  className={TICK_CLASS}
                >
                  {format(tick)}
                </text>
              </g>
            )
          })}

          {rows.map((row, index) => {
            const c = centre(index)
            const half = thickness / 2
            const dim = active !== null && active !== index
            return (
              <g key={row.id} opacity={dim ? 0.45 : 1}>
                <text
                  x={horizontal ? plot.x - 8 : c}
                  y={horizontal ? c : chartHeight - 8}
                  textAnchor={horizontal ? 'end' : 'middle'}
                  dominantBaseline={horizontal ? 'middle' : undefined}
                  className={TICK_CLASS}
                >
                  {row.label}
                </text>
                {row.stats && (
                  <g
                    className={cn('transition-[transform,opacity]', DRAW_IN_CLASS)}
                    style={{
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                      transform: drawn ? 'scale(1)' : horizontal ? 'scaleX(0.2)' : 'scaleY(0.2)',
                      opacity: drawn ? 1 : 0,
                      transitionDelay: drawn ? `${index * 60}ms` : '0ms',
                    }}
                  >
                    <line {...line(c, row.stats.min, c, row.stats.q1)} className="stroke-ink-soft" strokeWidth="1.5" />
                    <line {...line(c, row.stats.q3, c, row.stats.max)} className="stroke-ink-soft" strokeWidth="1.5" />
                    <line {...line(c - half / 2, row.stats.min, c + half / 2, row.stats.min)} className="stroke-ink-soft" strokeWidth="1.5" />
                    <line {...line(c - half / 2, row.stats.max, c + half / 2, row.stats.max)} className="stroke-ink-soft" strokeWidth="1.5" />
                    {(() => {
                      const a = at(c - half, row.stats.q3)
                      const b = at(c + half, row.stats.q1)
                      return (
                        <rect
                          x={Math.min(a.x, b.x)}
                          y={Math.min(a.y, b.y)}
                          width={Math.max(1, Math.abs(b.x - a.x))}
                          height={Math.max(1, Math.abs(b.y - a.y))}
                          rx={3}
                          fill={row.color}
                          fillOpacity={0.4}
                          stroke={row.color}
                          strokeWidth="1.5"
                        />
                      )
                    })()}
                    <line {...line(c - half, row.stats.median, c + half, row.stats.median)} className="stroke-ink" strokeWidth="2.5" />
                    {(row.stats.outliers ?? []).map((value, outlier) => {
                      const p = at(c, value)
                      return (
                        <circle key={outlier} cx={p.x} cy={p.y} r={3} className="fill-surface stroke-ink-soft" strokeWidth="1.5" />
                      )
                    })}
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {current?.stats && active !== null && (
          <PlotTip
            {...(horizontal
              ? { x: toValue(current.stats.q3), y: centre(active) }
              : { x: centre(active), y: toValue(current.stats.max) })}
            width={PLOT_WIDTH}
            height={chartHeight}
          >
            <ChartTooltip
              title={current.label}
              rows={[
                { label: 'Max', value: format(current.stats.max) },
                { label: 'Q3', value: format(current.stats.q3) },
                { label: 'Median', value: format(current.stats.median), color: current.color },
                { label: 'Q1', value: format(current.stats.q1) },
                { label: 'Min', value: format(current.stats.min) },
                { label: 'Outliers', value: String(current.stats.outliers?.length ?? 0) },
              ]}
            />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              {['Group', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'Outliers'].map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                {row.stats ? (
                  <>
                    <td>{format(row.stats.min)}</td>
                    <td>{format(row.stats.q1)}</td>
                    <td>{format(row.stats.median)}</td>
                    <td>{format(row.stats.q3)}</td>
                    <td>{format(row.stats.max)}</td>
                    <td>{(row.stats.outliers ?? []).map(format).join(', ') || 'None'}</td>
                  </>
                ) : (
                  <td colSpan={6}>No data</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={current ? describe(current) : ''} />
    </div>
  )
}
