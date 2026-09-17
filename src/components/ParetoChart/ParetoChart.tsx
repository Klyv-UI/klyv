'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
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
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface ParetoChartItem {
  label: string
  value: number
}

export interface ParetoChartProps {
  /** Categories in any order. They are sorted largest first. */
  items: ParetoChartItem[]
  /** Accessible name for the chart. */
  label: string
  /** Cumulative share, 0 to 1, that marks the vital few. */
  cutoff?: number
  /** What a bar measures — “Tickets”. Used in the legend and tooltip. */
  valueLabel?: string
  /** Chart height in pixels. The width fills the container. */
  height?: number
  /** Format values on the left axis and in the tooltip. */
  format?: (value: number) => string
  /** Show the key under the chart. */
  showLegend?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const PAD = { top: 14, bottom: 30 }
const RIGHT = 40
const BAR = 'var(--color-accent-strong)'
const MUTED = 'color-mix(in oklab, var(--color-accent-strong) 30%, var(--color-surface))'

/**
 * Causes ranked by size, with a running total that shows how few of them
 * account for most of the effect — tickets by reason, defects by cause, churn
 * by stated reason.
 *
 * The bars alone say what is biggest; the cumulative line says where to stop.
 * Bars that fall after the cutoff is reached are muted rather than removed, so
 * the long tail stays visible as a tail. The line has its own 0–100% axis on the
 * right, because sharing the value axis would flatten either the bars or the
 * line into uselessness.
 */
export function ParetoChart({
  items,
  label,
  cutoff = 0.8,
  valueLabel = 'Value',
  height = 260,
  format = formatTick,
  showLegend = true,
  className,
}: ParetoChartProps) {
  const tableId = useId()
  const drawn = useDrawIn()

  const sorted = items
    .filter((item) => Number.isFinite(item.value) && item.value >= 0)
    .sort((a, b) => b.value - a.value)
  const total = sorted.reduce((sum, item) => sum + item.value, 0) || 1
  let running = 0
  const bars = sorted.map((item) => {
    const before = running / total
    running += item.value
    return { ...item, share: item.value / total, cumulative: running / total, vital: before < cutoff }
  })
  const { active, setActive, keyProps } = useChartCursor(bars.length)

  const scale = niceScale(0, bars[0]?.value ?? 1, 4)
  const left = gutterFor(scale.ticks, format)
  const plot = { x: left, y: PAD.top, width: PLOT_WIDTH - left - RIGHT, height: height - PAD.top - PAD.bottom }
  const toY = linear(scale.min, scale.max, plot.y + plot.height, plot.y)
  const toShareY = linear(0, 1, plot.y + plot.height, plot.y)
  const band = plot.width / Math.max(1, bars.length)
  const centre = (index: number) => plot.x + band * (index + 0.5)
  const barWidth = Math.min(48, band * 0.64)
  const maxChars = Math.max(3, Math.floor(band / 5.2))
  const clip = (text: string) => (text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text)
  const percent = (value: number) => `${Math.round(value * 100)}%`
  const vitalCount = bars.filter((bar) => bar.vital).length

  const current = active === null ? null : bars[active]
  const linePoints = bars.map((bar, index) => `${centre(index)},${toShareY(bar.cumulative)}`).join(' ')

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${vitalCount} of ${bars.length} categories make up ${percent(cutoff)} of the total; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={(event) => {
            const point = pointerToView(event, PLOT_WIDTH, height)
            const index = Math.floor((point.x - plot.x) / band)
            setActive(index >= 0 && index < bars.length ? index : null)
          }}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={plot.x}
                x2={plot.x + plot.width}
                y1={toY(tick)}
                y2={toY(tick)}
                className="stroke-line"
                strokeWidth="1"
              />
              <text x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {format(tick)}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <text
              key={`share${tick}`}
              x={plot.x + plot.width + 8}
              y={toShareY(tick)}
              dominantBaseline="middle"
              className={TICK_CLASS}
            >
              {percent(tick)}
            </text>
          ))}

          {bars.map((bar, index) => (
            <g key={`${bar.label}-${index}`} opacity={active !== null && active !== index ? 0.6 : 1}>
              {active === index && (
                <rect
                  x={plot.x + band * index}
                  y={plot.y}
                  width={band}
                  height={plot.height}
                  className="fill-surface-muted"
                />
              )}
              <rect
                x={centre(index) - barWidth / 2}
                y={toY(bar.value)}
                width={barWidth}
                height={Math.max(0, plot.y + plot.height - toY(bar.value))}
                rx={3}
                fill={bar.vital ? BAR : MUTED}
                className={cn('transition-transform', DRAW_IN_CLASS)}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'bottom',
                  transform: drawn ? 'scaleY(1)' : 'scaleY(0)',
                  transitionDelay: drawn ? `${Math.min(index * 40, 400)}ms` : '0ms',
                }}
              />
              <text
                x={centre(index)}
                y={height - 12}
                textAnchor="middle"
                className={cn(TICK_CLASS, active === index && 'fill-ink')}
              >
                {clip(bar.label)}
              </text>
            </g>
          ))}

          <line
            x1={plot.x}
            x2={plot.x + plot.width}
            y1={toShareY(cutoff)}
            y2={toShareY(cutoff)}
            className="stroke-ink-faint"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={plot.x + plot.width - 4}
            y={toShareY(cutoff) - 5}
            textAnchor="end"
            className="fill-ink-soft text-[9px] font-bold"
          >
            {percent(cutoff)}
          </text>

          <g opacity={drawn ? 1 : 0} className={cn('transition-opacity delay-300', DRAW_IN_CLASS)}>
            <polyline
              points={linePoints}
              fill="none"
              className="stroke-ink"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {bars.map((bar, index) => (
              <circle
                key={`dot${index}`}
                cx={centre(index)}
                cy={toShareY(bar.cumulative)}
                r={active === index ? 4.5 : 3}
                className="fill-surface stroke-ink"
                strokeWidth="2"
              />
            ))}
          </g>
        </svg>

        {current && active !== null && (
          <PlotTip x={centre(active)} y={toY(current.value)} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={current.label}
              rows={[
                { label: valueLabel, value: format(current.value), color: current.vital ? BAR : MUTED },
                { label: 'Share', value: percent(current.share) },
                { label: 'Cumulative', value: percent(current.cumulative), color: 'var(--color-ink)' },
              ]}
            />
          </PlotTip>
        )}
      </div>

      {showLegend && (
        <Legend
          label={`${label} key`}
          series={[
            { label: `${valueLabel}, within ${percent(cutoff)}`, color: BAR },
            { label: `${valueLabel}, beyond`, color: MUTED },
            { label: 'Cumulative share', color: 'var(--color-ink)' },
          ]}
        />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              {['Category', valueLabel, 'Share', 'Cumulative', `Within ${percent(cutoff)}`].map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bars.map((bar, index) => (
              <tr key={`${bar.label}-${index}`}>
                <th scope="row">{bar.label}</th>
                <td>{format(bar.value)}</td>
                <td>{percent(bar.share)}</td>
                <td>{percent(bar.cumulative)}</td>
                <td>{bar.vital ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer
        message={
          current
            ? `${current.label}: ${format(current.value)}, ${percent(current.share)} of total, ${percent(current.cumulative)} cumulative${current.vital ? '' : ', beyond the cutoff'}`
            : ''
        }
      />
    </div>
  )
}
