'use client'

import { useId, useMemo } from 'react'
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

export interface ViolinPlotGroup {
  id: string
  label: string
  values: number[]
  /** Any CSS colour. Defaults walk SERIES_COLORS. */
  color?: string
}

export type ViolinPlotOrientation = 'vertical' | 'horizontal'

export interface ViolinPlotProps {
  /** One violin per group. */
  groups: ViolinPlotGroup[]
  /** Accessible name for the chart. */
  label: string
  /** Vertical violins stand on a category axis; horizontal ones lie along a value axis, which suits long group names. */
  orientation?: ViolinPlotOrientation
  /** Draw a slim box plot inside each violin. */
  showBox?: boolean
  /** Scatter the observations inside each violin, jittered within its width. */
  showPoints?: boolean
  /** Multiplier on Silverman's bandwidth. Below 1 shows more bumps, above 1 smooths them. */
  bandwidth?: number
  /** Name of the measure, printed beside the value axis. */
  valueLabel?: string
  /** Format values on the axis and in the tooltip. */
  formatValue?: (value: number) => string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

const SAMPLES = 72

function jitter(index: number) {
  const s = Math.sin(index * 12.9898 + 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

/**
 * Silverman's rule of thumb, 0.9 · min(σ, IQR ÷ 1.34) · n^(−1/5): the IQR term
 * keeps one outlier from smoothing a bimodal group into a single hump.
 */
function describe(values: number[], multiplier: number) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((a, b) => a + b, 0) / (n || 1)
  const sd = Math.sqrt(sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, n - 1))
  const q1 = quantile(sorted, 0.25)
  const median = quantile(sorted, 0.5)
  const q3 = quantile(sorted, 0.75)
  const spread = Math.min(sd, (q3 - q1) / 1.34) || sd || Math.abs(mean) * 0.1 || 1
  const h = 0.9 * spread * n ** -0.2 * multiplier
  const lo = sorted[0] - 2 * h
  const hi = sorted[n - 1] + 2 * h
  const k = 1 / (n * h * Math.sqrt(2 * Math.PI))
  const density = (v: number) => {
    let sum = 0
    for (const x of sorted) {
      const u = (v - x) / h
      if (u > -5 && u < 5) sum += Math.exp(-0.5 * u * u)
    }
    return sum * k
  }
  const curve = Array.from({ length: SAMPLES }, (_, i) => {
    const v = lo + ((hi - lo) * i) / (SAMPLES - 1)
    return { v, d: density(v) }
  })
  const peak = Math.max(...curve.map((c) => c.d)) || 1
  const fence = 1.5 * (q3 - q1)
  const whiskerLow = sorted.find((v) => v >= q1 - fence) ?? sorted[0]
  const whiskerHigh = [...sorted].reverse().find((v) => v <= q3 + fence) ?? sorted[n - 1]
  return { sorted, n, mean, q1, median, q3, h, lo, hi, curve, peak, density, whiskerLow, whiskerHigh }
}

/**
 * The shape of a distribution per group: a kernel density estimate mirrored
 * into a violin, with the median and quartiles marked inside.
 *
 * A box plot reduces each group to five numbers, and two groups with the same
 * five numbers can look nothing alike — one bimodal, one a single peak. The
 * violin draws the density itself (Gaussian kernel, Silverman's bandwidth), so
 * a second mode or a long tail is visible, and keeps the quartiles so the
 * summary a box plot gives is still there to read. Each violin is scaled to its
 * own widest point: compare shapes across groups, and counts in the tooltip.
 */
export function ViolinPlot({
  groups,
  label,
  orientation = 'vertical',
  showBox = false,
  showPoints = false,
  bandwidth = 1,
  valueLabel,
  formatValue = formatTick,
  height = 280,
  className,
}: ViolinPlotProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const vertical = orientation === 'vertical'
  const stats = useMemo(
    () =>
      groups
        .filter((group) => group.values.some(Number.isFinite))
        .map((group, index) => ({ group, color: group.color ?? SERIES_COLORS[index % SERIES_COLORS.length], ...describe(group.values, bandwidth) })),
    [groups, bandwidth],
  )
  const { active, setActive, keyProps } = useChartCursor(stats.length)

  const scale = niceScale(Math.min(...stats.map((s) => s.lo)), Math.max(...stats.map((s) => s.hi)), 5)
  const valueGutter = gutterFor(scale.ticks, formatValue)
  const labelGutter = vertical ? 0 : Math.min(120, Math.max(48, ...stats.map((s) => s.group.label.length * 6 + 12)))
  const left = vertical ? valueGutter + (valueLabel ? 14 : 0) : labelGutter
  const bottom = vertical ? 26 : 26 + (valueLabel ? 14 : 0)
  const plot = { x: left, y: 12, width: PLOT_WIDTH - left - 14, height: height - 12 - bottom }
  const catLength = vertical ? plot.width : plot.height
  const band = catLength / Math.max(1, stats.length)
  const half = band * 0.42
  const toValue = vertical ? linear(scale.min, scale.max, plot.y + plot.height, plot.y) : linear(scale.min, scale.max, plot.x, plot.x + plot.width)
  const centre = (index: number) => (vertical ? plot.x : plot.y) + band * (index + 0.5)
  const pt = (c: number, v: number) => (vertical ? `${c.toFixed(1)} ${toValue(v).toFixed(1)}` : `${toValue(v).toFixed(1)} ${c.toFixed(1)}`)
  const xy = (c: number, v: number) => (vertical ? { x: c, y: toValue(v) } : { x: toValue(v), y: c })
  const segment = (c: number, w: number, v: number) => `M${pt(c - w, v)}L${pt(c + w, v)}`

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const view = pointerToView(event, PLOT_WIDTH, height)
    const along = vertical ? view.x - plot.x : view.y - plot.y
    const index = Math.floor(along / band)
    setActive(index >= 0 && index < stats.length ? index : null)
  }

  const current = active === null ? null : stats[active]
  const rowsOf = (s: (typeof stats)[number]) => [
    { label: 'Observations', value: String(s.n) },
    { label: 'Median', value: formatValue(s.median), color: s.color },
    { label: 'Quartiles', value: `${formatValue(s.q1)} – ${formatValue(s.q3)}` },
    { label: 'Range', value: `${formatValue(s.sorted[0])} – ${formatValue(s.sorted[s.n - 1])}` },
    { label: 'Bandwidth', value: formatValue(s.h) },
  ]

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${stats.length} groups; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {scale.ticks.map((tick) => {
            const at = toValue(tick)
            return (
              <g key={tick}>
                {vertical ? (
                  <line x1={plot.x} x2={plot.x + plot.width} y1={at} y2={at} className="stroke-line" strokeWidth="1" />
                ) : (
                  <line x1={at} x2={at} y1={plot.y} y2={plot.y + plot.height} className="stroke-line" strokeWidth="1" />
                )}
                <text
                  x={vertical ? plot.x - 8 : at}
                  y={vertical ? at : plot.y + plot.height + 16}
                  textAnchor={vertical ? 'end' : 'middle'}
                  dominantBaseline={vertical ? 'middle' : undefined}
                  className={TICK_CLASS}
                >
                  {formatValue(tick)}
                </text>
              </g>
            )
          })}
          {valueLabel &&
            (vertical ? (
              <text transform={`translate(10 ${plot.y + plot.height / 2}) rotate(-90)`} textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold">
                {valueLabel}
              </text>
            ) : (
              <text x={plot.x + plot.width / 2} y={height - 4} textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold">
                {valueLabel}
              </text>
            ))}
          {stats.map((s, index) => {
            const c = centre(index)
            const w = (v: number) => (s.density(v) / s.peak) * half
            const outline =
              `M${s.curve.map(({ v, d }) => pt(c + (d / s.peak) * half, v)).join('L')}` +
              `L${[...s.curve].reverse().map(({ v, d }) => pt(c - (d / s.peak) * half, v)).join('L')}Z`
            const dim = active !== null && active !== index
            return (
              <g key={s.group.id} opacity={dim ? 0.5 : 1} className="transition-opacity">
                {active === index && (
                  <rect
                    x={vertical ? c - band / 2 : plot.x}
                    y={vertical ? plot.y : c - band / 2}
                    width={vertical ? band : plot.width}
                    height={vertical ? plot.height : band}
                    className="fill-surface-sunken"
                  />
                )}
                <g
                  className={cn('transition-transform', DRAW_IN_CLASS)}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: drawn ? 'scale(1)' : vertical ? 'scaleX(0)' : 'scaleY(0)',
                    transitionDelay: drawn ? `${index * 50}ms` : '0ms',
                  }}
                >
                  <path d={outline} fill={s.color} fillOpacity="0.32" stroke={s.color} strokeWidth="1.5" strokeLinejoin="round" />
                  {showPoints &&
                    s.sorted.map((v, i) => {
                      const p = xy(c + jitter(i + index * 997) * w(v) * 0.8, v)
                      return <circle key={i} cx={p.x} cy={p.y} r="1.5" className="fill-ink" opacity="0.5" />
                    })}
                  {showBox && (
                    <>
                      <path d={`M${pt(c, s.whiskerLow)}L${pt(c, s.whiskerHigh)}`} className="stroke-ink" strokeWidth="1.25" />
                      <path
                        d={`M${pt(c - 4, s.q1)}L${pt(c + 4, s.q1)}L${pt(c + 4, s.q3)}L${pt(c - 4, s.q3)}Z`}
                        className="fill-ink stroke-ink"
                        strokeWidth="1"
                      />
                    </>
                  )}
                  <path d={segment(c, w(s.q1), s.q1)} className="stroke-ink-soft" strokeWidth="1" strokeDasharray="3 2" />
                  <path d={segment(c, w(s.q3), s.q3)} className="stroke-ink-soft" strokeWidth="1" strokeDasharray="3 2" />
                  {!showBox && <path d={segment(c, w(s.median), s.median)} className="stroke-surface" strokeWidth="4.5" strokeLinecap="round" />}
                  <path d={segment(c, showBox ? 6 : w(s.median), s.median)} className={showBox ? 'stroke-surface' : 'stroke-ink'} strokeWidth="2.25" strokeLinecap="round" />
                </g>
                <text
                  x={vertical ? c : plot.x - 8}
                  y={vertical ? plot.y + plot.height + 16 : c}
                  textAnchor={vertical ? 'middle' : 'end'}
                  dominantBaseline={vertical ? undefined : 'middle'}
                  className="fill-ink-soft text-[10px] font-semibold"
                >
                  {s.group.label}
                </text>
              </g>
            )
          })}
        </svg>
        {current && active !== null && (
          <PlotTip {...xy(centre(active), current.median)} width={PLOT_WIDTH} height={height}>
            <ChartTooltip title={current.group.label} rows={rowsOf(current)} />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{`${label}. Gaussian kernel density per group, Silverman bandwidth${bandwidth === 1 ? '' : ` × ${bandwidth}`}.`}</caption>
          <thead>
            <tr>
              {['Group', 'Observations', 'Minimum', 'First quartile', 'Median', 'Third quartile', 'Maximum'].map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.group.id}>
                <th scope="row">{s.group.label}</th>
                <td>{s.n}</td>
                <td>{formatValue(s.sorted[0])}</td>
                <td>{formatValue(s.q1)}</td>
                <td>{formatValue(s.median)}</td>
                <td>{formatValue(s.q3)}</td>
                <td>{formatValue(s.sorted[s.n - 1])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
      <PlotAnnouncer
        message={current ? `${current.group.label}: ${rowsOf(current).map((row) => `${row.label} ${row.value}`).join(', ')}` : ''}
      />
    </div>
  )
}
