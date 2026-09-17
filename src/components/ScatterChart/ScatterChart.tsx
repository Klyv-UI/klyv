'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatTick, SERIES_COLORS } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { Legend } from '../Legend'
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
  svgId,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface ScatterChartPoint {
  x: number
  y: number
  /** Bubble size in your own units. The circle's area, not its radius, scales with it. */
  size?: number
  /** Names the point in the tooltip and the data table — a customer, a country, a build. */
  label?: string
}

export interface ScatterChartSeries {
  id: string
  label: string
  points: ScatterChartPoint[]
  /** Any CSS colour. Defaults walk SERIES_COLORS. */
  color?: string
}

export interface ScatterChartProps {
  /** One entry per group of points. */
  series: ScatterChartSeries[]
  /** Accessible name for the chart. */
  label: string
  /** Name of the horizontal measure, printed under the axis. */
  xLabel?: string
  /** Name of the vertical measure, printed beside the axis. */
  yLabel?: string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Draw a least-squares line through each series. */
  trendLine?: boolean
  /** Smallest and largest bubble radius, in viewBox pixels. */
  radius?: [number, number]
  /** Format x values on the axis and in the tooltip. */
  formatX?: (value: number) => string
  /** Format y values on the axis and in the tooltip. */
  formatY?: (value: number) => string
  /** Format bubble sizes in the tooltip. */
  formatSize?: (value: number) => string
  /** Show the series key under the plot when there is more than one series. */
  showLegend?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const PAD = { top: 12, right: 14, bottom: 26 }

function leastSquares(points: ScatterChartPoint[]) {
  const n = points.length
  if (n < 2) return null
  let sx = 0
  let sy = 0
  let sxy = 0
  let sxx = 0
  for (const { x, y } of points) {
    sx += x
    sy += y
    sxy += x * y
    sxx += x * x
  }
  const denominator = n * sxx - sx * sx
  if (denominator === 0) return null
  const slope = (n * sxy - sx * sy) / denominator
  return { slope, intercept: (sy - slope * sx) / n }
}

/**
 * Two measures against each other, one dot per observation, with an optional
 * third measure as bubble size.
 *
 * Neither axis starts at zero: position, not length, carries the value, so the
 * range hugs the data. Bubble area rather than radius follows the size, because
 * the eye reads area — doubling a radius looks like four times the value.
 *
 * The trend line is ordinary least squares, drawn only across the x range the
 * series actually covers; extrapolating past the data is a claim the chart has
 * not earned. The whole chart is one tab stop — arrows step through points in x
 * order — and every point is also in the hidden table.
 */
export function ScatterChart({
  series,
  label,
  xLabel,
  yLabel,
  height = 260,
  trendLine = false,
  radius = [3.5, 16],
  formatX = formatTick,
  formatY = formatTick,
  formatSize = formatTick,
  showLegend = true,
  className,
}: ScatterChartProps) {
  const tableId = useId()
  const clipId = svgId(`${tableId}clip`)
  const drawn = useDrawIn()

  const resolved = series.map((entry, index) => ({
    ...entry,
    color: entry.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
    points: entry.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  }))
  const flat = resolved
    .flatMap((entry) => entry.points.map((point) => ({ ...point, series: entry })))
    .sort((a, b) => a.x - b.x || a.y - b.y)

  const { active, setActive, keyProps } = useChartCursor(flat.length)

  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  let sMin = Infinity
  let sMax = -Infinity
  for (const point of flat) {
    xMin = Math.min(xMin, point.x)
    xMax = Math.max(xMax, point.x)
    yMin = Math.min(yMin, point.y)
    yMax = Math.max(yMax, point.y)
    if (point.size !== undefined && Number.isFinite(point.size)) {
      sMin = Math.min(sMin, point.size)
      sMax = Math.max(sMax, point.size)
    }
  }
  const hasSize = Number.isFinite(sMin)

  const xs = niceScale(xMin, xMax, 5)
  const ys = niceScale(yMin, yMax, 4)
  const left = gutterFor(ys.ticks, formatY) + (yLabel ? 14 : 0)
  const bottom = PAD.bottom + (xLabel ? 14 : 0)
  const plot = {
    x: left,
    y: PAD.top,
    width: Math.max(1, PLOT_WIDTH - left - PAD.right),
    height: Math.max(1, height - PAD.top - bottom),
  }
  const toX = linear(xs.min, xs.max, plot.x, plot.x + plot.width)
  const toY = linear(ys.min, ys.max, plot.y + plot.height, plot.y)
  const toR = (size?: number) => {
    if (!hasSize || size === undefined || sMax === sMin) return hasSize ? (radius[0] + radius[1]) / 2 : radius[0]
    const t = (Math.sqrt(Math.max(0, size - sMin)) / Math.sqrt(sMax - sMin))
    return radius[0] + t * (radius[1] - radius[0])
  }

  const trends = trendLine
    ? resolved.map((entry) => {
        const fit = leastSquares(entry.points)
        if (!fit) return null
        const xsOf = entry.points.map((point) => point.x)
        const from = Math.min(...xsOf)
        const to = Math.max(...xsOf)
        return { entry, fit, from, to }
      })
    : []

  const point = active === null ? null : flat[active]

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = pointerToView(event, PLOT_WIDTH, height)
    let best: number | null = null
    let bestDistance = 24
    flat.forEach((candidate, index) => {
      const distance = Math.hypot(toX(candidate.x) - x, toY(candidate.y) - y) - toR(candidate.size)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })
    setActive(best)
  }

  const describe = (entry: (typeof flat)[number]) =>
    [
      entry.label ?? entry.series.label,
      `${xLabel ?? 'x'} ${formatX(entry.x)}`,
      `${yLabel ?? 'y'} ${formatY(entry.y)}`,
      hasSize && entry.size !== undefined ? `size ${formatSize(entry.size)}` : null,
    ]
      .filter(Boolean)
      .join(', ')

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${flat.length} points; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={plot.x} y={plot.y} width={plot.width} height={plot.height} />
            </clipPath>
          </defs>

          {ys.ticks.map((tick) => (
            <g key={`y${tick}`}>
              <line x1={plot.x} x2={plot.x + plot.width} y1={toY(tick)} y2={toY(tick)} className="stroke-line" strokeWidth="1" />
              <text x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {formatY(tick)}
              </text>
            </g>
          ))}
          {xs.ticks.map((tick) => (
            <g key={`x${tick}`}>
              <line x1={toX(tick)} x2={toX(tick)} y1={plot.y} y2={plot.y + plot.height} className="stroke-line" strokeWidth="1" strokeDasharray="2 3" />
              <text x={toX(tick)} y={plot.y + plot.height + 16} textAnchor="middle" className={TICK_CLASS}>
                {formatX(tick)}
              </text>
            </g>
          ))}
          {xLabel && (
            <text x={plot.x + plot.width / 2} y={height - 4} textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text
              transform={`translate(10 ${plot.y + plot.height / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-ink-soft text-[10px] font-semibold"
            >
              {yLabel}
            </text>
          )}

          <g clipPath={`url(#${clipId})`}>
            {flat.map((entry, index) => {
              const isActive = active === index
              return (
                <circle
                  key={`${entry.series.id}-${index}`}
                  cx={toX(entry.x)}
                  cy={toY(entry.y)}
                  r={toR(entry.size)}
                  fill={entry.series.color}
                  fillOpacity={isActive ? 1 : hasSize ? 0.55 : 0.8}
                  stroke={isActive ? 'var(--color-ink)' : hasSize ? entry.series.color : 'none'}
                  strokeWidth={isActive ? 2 : 1}
                  className={cn('transition-transform', DRAW_IN_CLASS)}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: drawn ? 'scale(1)' : 'scale(0)',
                    transitionDelay: drawn ? `${Math.min(index * 6, 360)}ms` : '0ms',
                  }}
                />
              )
            })}

            {trends.map(
              (trend) =>
                trend && (
                  <line
                    key={`trend-${trend.entry.id}`}
                    x1={toX(trend.from)}
                    x2={toX(trend.to)}
                    y1={toY(trend.fit.intercept + trend.fit.slope * trend.from)}
                    y2={toY(trend.fit.intercept + trend.fit.slope * trend.to)}
                    stroke={trend.entry.color}
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    className={cn('transition-opacity', DRAW_IN_CLASS)}
                    opacity={drawn ? 1 : 0}
                  />
                ),
            )}
          </g>
        </svg>

        {point && (
          <PlotTip x={toX(point.x)} y={toY(point.y)} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={point.label ?? point.series.label}
              rows={[
                ...(point.label ? [{ label: 'Series', value: point.series.label, color: point.series.color }] : []),
                { label: xLabel ?? 'x', value: formatX(point.x) },
                { label: yLabel ?? 'y', value: formatY(point.y) },
                ...(hasSize && point.size !== undefined ? [{ label: 'Size', value: formatSize(point.size) }] : []),
              ]}
            />
          </PlotTip>
        )}
      </div>

      {showLegend && resolved.length > 1 && (
        <Legend label={`${label} series`} series={resolved.map((entry) => ({ label: entry.label, color: entry.color }))} />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Point</th>
              <th scope="col">Series</th>
              <th scope="col">{xLabel ?? 'x'}</th>
              <th scope="col">{yLabel ?? 'y'}</th>
              {hasSize && <th scope="col">Size</th>}
            </tr>
          </thead>
          <tbody>
            {flat.map((entry, index) => (
              <tr key={`${entry.series.id}-${index}`}>
                <th scope="row">{entry.label ?? `${entry.series.label} ${index + 1}`}</th>
                <td>{entry.series.label}</td>
                <td>{formatX(entry.x)}</td>
                <td>{formatY(entry.y)}</td>
                {hasSize && <td>{entry.size === undefined ? '' : formatSize(entry.size)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {trends.map(
          (trend) =>
            trend && (
              <span key={`trend-note-${trend.entry.id}`}>
                {`${trend.entry.label} trend: ${yLabel ?? 'y'} ${trend.fit.slope >= 0 ? 'rises' : 'falls'} by ${formatY(Math.abs(trend.fit.slope))} per unit of ${xLabel ?? 'x'}. `}
              </span>
            ),
        )}
      </VisuallyHidden>

      <PlotAnnouncer message={point ? describe(point) : ''} />
    </div>
  )
}
