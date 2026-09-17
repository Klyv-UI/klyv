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

/** `change` moves the running total; `subtotal` and `total` draw it from zero. */
export type WaterfallChartStepKind = 'change' | 'subtotal' | 'total'

export interface WaterfallChartStep {
  label: string
  /** Signed change. Ignored for subtotals and totals, which show the running total. */
  value?: number
  /** Defaults to `change`. */
  kind?: WaterfallChartStepKind
}

export interface WaterfallChartProps {
  /** The steps, in order, after the starting value. */
  steps: WaterfallChartStep[]
  /** Opening value, drawn as the first bar. Omit to start from zero with no bar. */
  start?: number
  /** Axis label for the opening bar. */
  startLabel?: string
  /** Accessible name for the chart. */
  label: string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Format values on the axis, the bars and the tooltip. */
  format?: (value: number) => string
  /** Print each bar's change or total above it. */
  showValues?: boolean
  /** Draw the dashed line carrying each level across to the next bar. */
  showConnectors?: boolean
  /** Show the increase / decrease / total key. */
  showLegend?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const TONE = {
  up: 'var(--color-accent-strong)',
  down: 'var(--color-danger)',
  total: 'var(--color-ink-soft)',
}

/**
 * How a starting figure became an ending one — revenue bridged to profit, last
 * month's MRR to this month's — as floating bars that each start where the
 * previous one ended.
 *
 * The axis is zero-based, because subtotal bars encode their value by length.
 * Increases take the accent and decreases the danger tone, but every bar also
 * prints its signed change, so the direction is never carried by colour alone.
 * Subtotals are computed rather than passed in: a subtotal typed by hand is a
 * subtotal that stops adding up the first time a step changes.
 */
export function WaterfallChart({
  steps,
  start,
  startLabel = 'Start',
  label,
  height = 240,
  format = formatTick,
  showValues = true,
  showConnectors = true,
  showLegend = true,
  className,
}: WaterfallChartProps) {
  const tableId = useId()
  const drawn = useDrawIn()

  let running = start ?? 0
  const bars = [
    ...(start === undefined
      ? []
      : [{ label: startLabel, kind: 'start' as const, from: 0, to: start, change: start }]),
    ...steps.map((step) => {
      const kind = step.kind ?? 'change'
      if (kind !== 'change') return { label: step.label, kind, from: 0, to: running, change: running }
      const value = Number.isFinite(step.value) ? (step.value as number) : 0
      const from = running
      running += value
      return { label: step.label, kind, from, to: running, change: value }
    }),
  ]

  const { active, setActive, keyProps } = useChartCursor(bars.length)

  let low = 0
  let high = 0
  for (const bar of bars) {
    low = Math.min(low, bar.from, bar.to)
    high = Math.max(high, bar.from, bar.to)
  }
  const scale = niceScale(low, high, 4)
  const left = gutterFor(scale.ticks, format)
  const plot = { x: left, y: 16, width: PLOT_WIDTH - left - 12, height: height - 16 - 26 }
  const toY = linear(scale.min, scale.max, plot.y + plot.height, plot.y)
  const band = plot.width / Math.max(1, bars.length)
  const barWidth = Math.min(56, band * 0.62)
  const centre = (index: number) => plot.x + band * (index + 0.5)

  const toneOf = (bar: (typeof bars)[number]) =>
    bar.kind !== 'change' ? TONE.total : bar.change < 0 ? TONE.down : TONE.up
  const signed = (bar: (typeof bars)[number]) =>
    bar.kind !== 'change' ? format(bar.to) : `${bar.change < 0 ? '−' : '+'}${format(Math.abs(bar.change))}`
  const kindName = (bar: (typeof bars)[number]) =>
    bar.kind !== 'change' ? (bar.kind === 'start' ? 'Start' : bar.kind === 'subtotal' ? 'Subtotal' : 'Total') : bar.change < 0 ? 'Decrease' : 'Increase'

  const current = active === null ? null : bars[active]

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. Use arrow keys to step through the bars.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={(event) => {
            const { x } = pointerToView(event, PLOT_WIDTH, height)
            const index = Math.floor((x - plot.x) / band)
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
                className={tick === 0 ? 'stroke-line-strong' : 'stroke-line'}
                strokeWidth="1"
              />
              <text x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {format(tick)}
              </text>
            </g>
          ))}

          {active !== null && (
            <rect x={plot.x + band * active} y={plot.y} width={band} height={plot.height} className="fill-surface-muted" />
          )}

          {bars.map((bar, index) => {
            const top = toY(Math.max(bar.from, bar.to))
            const bottom = toY(Math.min(bar.from, bar.to))
            const rising = bar.to >= bar.from
            const next = bars[index + 1]
            return (
              <g key={`${bar.label}-${index}`}>
                {showConnectors && next && (
                  <line
                    x1={centre(index) + barWidth / 2}
                    x2={centre(index + 1) - barWidth / 2}
                    y1={toY(bar.to)}
                    y2={toY(bar.to)}
                    className="stroke-ink-faint"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}
                <rect
                  x={centre(index) - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={Math.max(1, bottom - top)}
                  rx={3}
                  fill={toneOf(bar)}
                  opacity={active === null || active === index ? 1 : 0.55}
                  className={cn('transition-transform', DRAW_IN_CLASS)}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: rising ? 'bottom' : 'top',
                    transform: drawn ? 'scaleY(1)' : 'scaleY(0)',
                    transitionDelay: drawn ? `${index * 40}ms` : '0ms',
                  }}
                />
                {showValues && (
                  <text
                    x={centre(index)}
                    y={top - 5}
                    textAnchor="middle"
                    className="fill-ink-soft text-[9px] font-bold"
                  >
                    {signed(bar)}
                  </text>
                )}
                <text x={centre(index)} y={height - 8} textAnchor="middle" className={TICK_CLASS}>
                  {bar.label}
                </text>
              </g>
            )
          })}
        </svg>

        {current && active !== null && (
          <PlotTip x={centre(active)} y={toY(Math.max(current.from, current.to))} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={current.label}
              rows={[
                { label: kindName(current), value: signed(current), color: toneOf(current) },
                ...(current.kind === 'change' ? [{ label: 'Running total', value: format(current.to) }] : []),
              ]}
            />
          </PlotTip>
        )}
      </div>

      {showLegend && (
        <Legend
          label={`${label} key`}
          series={[
            { label: 'Increase', color: TONE.up },
            { label: 'Decrease', color: TONE.down },
            { label: 'Total', color: TONE.total },
          ]}
        />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Change</th>
              <th scope="col">Running total</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar, index) => (
              <tr key={`${bar.label}-${index}`}>
                <th scope="row">{bar.label}</th>
                <td>{bar.kind === 'change' ? signed(bar) : kindName(bar)}</td>
                <td>{format(bar.to)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer
        message={current ? `${current.label}: ${kindName(current)} ${signed(current)}, running total ${format(current.to)}` : ''}
      />
    </div>
  )
}
