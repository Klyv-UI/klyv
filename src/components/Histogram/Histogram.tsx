'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
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

export interface HistogramProps {
  /** Raw observations. Values that are not finite numbers are left out. */
  values: number[]
  /** Roughly how many bins to use. Rounded so the edges land on round numbers. */
  bins?: number
  /** Exact bin width. Wins over `bins`. */
  binWidth?: number
  /** Accessible name for the chart. */
  label: string
  /** Name of the measure, printed under the axis. */
  xLabel?: string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Mark the arithmetic mean. */
  showMean?: boolean
  /** Mark the median. */
  showMedian?: boolean
  /** Format bin edges and markers. */
  format?: (value: number) => string
  /** Bar colour. Any CSS colour; prefer a token. */
  color?: string
  /** Merged last, so it wins. */
  className?: string
}

const MAX_BINS = 200

/**
 * The shape of a distribution: raw values in, counted into adjacent bins.
 *
 * It takes the raw values rather than pre-counted bins so the binning is done
 * one way everywhere. With no instruction it uses Sturges’ rule and then snaps
 * the width to a round number, because a bin from 12.37 to 18.91 is honest and
 * unreadable. Bars touch — the bins are a continuous range, not categories —
 * and each bin includes its lower edge, with the last one closed at both ends.
 *
 * Mean and median are optional markers rather than defaults: on a skewed
 * distribution the gap between them is the finding, and on a symmetric one they
 * are noise.
 */
export function Histogram({
  values,
  bins,
  binWidth,
  label,
  xLabel,
  height = 220,
  showMean = false,
  showMedian = false,
  format = formatTick,
  color = 'var(--color-accent-strong)',
  className,
}: HistogramProps) {
  const tableId = useId()
  const drawn = useDrawIn()

  const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  const min = finite[0] ?? 0
  const max = finite[finite.length - 1] ?? 1

  let width: number
  let start: number
  if (binWidth && binWidth > 0) {
    width = binWidth
    start = Math.floor(min / width) * width
  } else {
    // Round the raw width to the nearest 1, 2, 2.5 or 5 step rather than up,
    // so asking for 30 bins gives about 30, not the 15 that rounding up yields.
    const target = Math.max(1, bins ?? Math.ceil(Math.log2(Math.max(1, finite.length)) + 1))
    const raw = (max - min || 1) / target
    const magnitude = 10 ** Math.floor(Math.log10(raw))
    const norm = raw / magnitude
    width = (norm < 1.5 ? 1 : norm < 2.25 ? 2 : norm < 3.5 ? 2.5 : norm < 7.5 ? 5 : 10) * magnitude
    start = Math.floor(min / width) * width
  }
  const count = Math.min(MAX_BINS, Math.max(1, Math.ceil((max - start) / width - 1e-9)))
  const counts = new Array<number>(count).fill(0)
  for (const value of finite) {
    counts[Math.min(count - 1, Math.max(0, Math.floor((value - start) / width)))] += 1
  }
  const edge = (index: number) => Number((start + index * width).toFixed(10))
  const edges = counts.map((_, index) => [edge(index), edge(index + 1)] as const)

  const mean = finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : Number.NaN
  const median = quantile(finite, 0.5)

  const { active, setActive, keyProps } = useChartCursor(count)

  const ys = niceScale(0, Math.max(1, ...counts), 4)
  const yTicks = ys.ticks.filter((tick) => Number.isInteger(tick))
  const left = gutterFor(yTicks, String)
  const bottom = 26 + (xLabel ? 14 : 0)
  const markers = showMean || showMedian
  const plot = { x: left, y: markers ? 24 : 12, width: PLOT_WIDTH - left - 14, height: 0 }
  plot.height = Math.max(1, height - plot.y - bottom)
  const toX = linear(start, start + count * width, plot.x, plot.x + plot.width)
  const toY = linear(ys.min, ys.max, plot.y + plot.height, plot.y)
  const barPixels = plot.width / count
  const labelStep = Math.ceil((count + 1) / 8)

  const range = (index: number) => `${format(edges[index][0])} – ${format(edges[index][1])}`
  const share = (value: number) => `${finite.length ? Math.round((value / finite.length) * 1000) / 10 : 0}%`

  const marks = [
    ...(showMean && Number.isFinite(mean) ? [{ name: 'Mean', value: mean, dash: '5 3' }] : []),
    ...(showMedian && Number.isFinite(median) ? [{ name: 'Median', value: median, dash: undefined }] : []),
  ]

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${finite.length} values in ${count} bins; use arrow keys to step through the bins.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={(event) => {
            const { x } = pointerToView(event, PLOT_WIDTH, height)
            const index = Math.floor((x - plot.x) / barPixels)
            setActive(index >= 0 && index < count ? index : null)
          }}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={plot.x} x2={plot.x + plot.width} y1={toY(tick)} y2={toY(tick)} className="stroke-line" strokeWidth="1" />
              <text x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {tick}
              </text>
            </g>
          ))}

          {counts.map((value, index) => {
            const top = toY(value)
            return (
              <rect
                key={index}
                x={toX(edges[index][0]) + 0.5}
                y={top}
                width={Math.max(1, barPixels - 1)}
                height={Math.max(0, plot.y + plot.height - top)}
                rx={Math.min(2, barPixels / 4)}
                fill={color}
                opacity={active === null || active === index ? 1 : 0.5}
                className={cn('transition-transform', DRAW_IN_CLASS)}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'bottom',
                  transform: drawn ? 'scaleY(1)' : 'scaleY(0)',
                  transitionDelay: drawn ? `${Math.min(index * 20, 400)}ms` : '0ms',
                }}
              />
            )
          })}

          {edges.map(([from], index) =>
            index % labelStep === 0 ? (
              <text key={index} x={toX(from)} y={plot.y + plot.height + 16} textAnchor="middle" className={TICK_CLASS}>
                {format(from)}
              </text>
            ) : null,
          )}
          {count % labelStep === 0 && (
            <text x={toX(edges[count - 1][1])} y={plot.y + plot.height + 16} textAnchor="middle" className={TICK_CLASS}>
              {format(edges[count - 1][1])}
            </text>
          )}
          {xLabel && (
            <text x={plot.x + plot.width / 2} y={height - 4} textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold">
              {xLabel}
            </text>
          )}

          {marks.map((mark) => {
            const other = marks.find((entry) => entry !== mark)
            const anchor = other ? (mark.value >= other.value ? 'start' : 'end') : 'middle'
            const x = toX(mark.value)
            return (
              <g key={mark.name}>
                <line
                  x1={x}
                  x2={x}
                  y1={plot.y - 4}
                  y2={plot.y + plot.height}
                  className="stroke-ink"
                  strokeWidth="1.5"
                  strokeDasharray={mark.dash}
                />
                <text
                  x={anchor === 'start' ? x + 4 : anchor === 'end' ? x - 4 : x}
                  y={plot.y - 10}
                  textAnchor={anchor}
                  className="fill-ink text-[9px] font-bold"
                >
                  {mark.name} {format(mark.value)}
                </text>
              </g>
            )
          })}
        </svg>

        {active !== null && (
          <PlotTip x={toX(edges[active][0]) + barPixels / 2} y={toY(counts[active])} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={range(active)}
              rows={[
                { label: 'Count', value: String(counts[active]), color },
                { label: 'Share', value: share(counts[active]) },
              ]}
            />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>
            {label}
            {marks.map((mark) => `, ${mark.name.toLowerCase()} ${format(mark.value)}`).join('')}
          </caption>
          <thead>
            <tr>
              <th scope="col">Bin</th>
              <th scope="col">Count</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((value, index) => (
              <tr key={index}>
                <th scope="row">{range(index)}</th>
                <td>{value}</td>
                <td>{share(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={active === null ? '' : `${range(active)}: ${counts[active]} values, ${share(counts[active])}`} />
    </div>
  )
}
