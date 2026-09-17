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
  linear,
  niceScale,
  pointerToView,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface DumbbellChartRow {
  id: string
  label: string
  /** The first value — before, or group A. */
  from: number
  /** The second value — after, or group B. */
  to: number
}

export type DumbbellChartSort = 'none' | 'gap' | 'to'

export interface DumbbellChartProps {
  rows: DumbbellChartRow[]
  /** Accessible name for the chart. */
  label: string
  /** Name of the first value — “2025”, “Free plan”. */
  fromLabel: string
  /** Name of the second value. */
  toLabel: string
  /** Keep the given order, sort by the size of the gap, or by the second value. Largest first. */
  sort?: DumbbellChartSort
  /** Start the value axis at zero rather than hugging the data. */
  zeroBased?: boolean
  /** Height of each row in viewBox pixels. */
  rowHeight?: number
  /** Format values on the axis and in the tooltip. */
  format?: (value: number) => string
  /** Show the key under the chart. */
  showLegend?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const FROM = 'var(--color-ink-faint)'
const TO = 'var(--color-accent-strong)'

/**
 * Two values per category as two dots joined by a bar — before and after, this
 * year and last, one group against another.
 *
 * It replaces a grouped bar chart when the gap is the story. Paired bars spend
 * all their ink on the distance from zero, which both values share; a dumbbell
 * spends it on the distance between them. Sorting by the gap puts the biggest
 * movers at the top, which is usually the question being asked. The axis hugs
 * the data by default, because nothing here is read as a length from zero.
 */
export function DumbbellChart({
  rows,
  label,
  fromLabel,
  toLabel,
  sort = 'none',
  zeroBased = false,
  rowHeight = 32,
  format = formatTick,
  showLegend = true,
  className,
}: DumbbellChartProps) {
  const tableId = useId()
  const drawn = useDrawIn()

  const clean = rows.filter((row) => Number.isFinite(row.from) && Number.isFinite(row.to))
  const ordered =
    sort === 'gap'
      ? [...clean].sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
      : sort === 'to'
        ? [...clean].sort((a, b) => b.to - a.to)
        : clean
  const { active, setActive, keyProps } = useChartCursor(ordered.length)

  const values = ordered.flatMap((row) => [row.from, row.to])
  const scale = niceScale(
    zeroBased ? Math.min(0, ...values) : Math.min(...(values.length ? values : [0])),
    Math.max(...(values.length ? values : [1])),
    5,
  )
  const left = Math.min(180, Math.max(48, Math.max(0, ...ordered.map((row) => row.label.length)) * 5.6 + 14))
  const top = 6
  const height = top + ordered.length * rowHeight + 26
  const plot = { x: left, y: top, width: PLOT_WIDTH - left - 18, height: ordered.length * rowHeight }
  const toX = linear(scale.min, scale.max, plot.x, plot.x + plot.width)
  const rowY = (index: number) => plot.y + rowHeight * (index + 0.5)
  const gap = (row: DumbbellChartRow) => {
    const delta = row.to - row.from
    return `${delta >= 0 ? '+' : '−'}${format(Math.abs(delta))}`
  }
  const current = active === null ? null : ordered[active]

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${ordered.length} rows comparing ${fromLabel} with ${toLabel}; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={(event) => {
            const point = pointerToView(event, PLOT_WIDTH, height)
            const index = Math.floor((point.y - plot.y) / rowHeight)
            setActive(index >= 0 && index < ordered.length ? index : null)
          }}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={toX(tick)}
                x2={toX(tick)}
                y1={plot.y}
                y2={plot.y + plot.height}
                className="stroke-line"
                strokeWidth="1"
              />
              <text x={toX(tick)} y={plot.y + plot.height + 16} textAnchor="middle" className={TICK_CLASS}>
                {format(tick)}
              </text>
            </g>
          ))}

          {ordered.map((row, index) => {
            const y = rowY(index)
            const x1 = toX(row.from)
            const x2 = toX(row.to)
            const dim = active !== null && active !== index
            return (
              <g key={row.id} opacity={dim ? 0.45 : 1}>
                {active === index && (
                  <rect
                    x={0}
                    y={plot.y + rowHeight * index}
                    width={PLOT_WIDTH}
                    height={rowHeight}
                    rx={6}
                    className="fill-surface-muted"
                  />
                )}
                <text
                  x={left - 10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className={cn(TICK_CLASS, active === index && 'fill-ink')}
                >
                  {row.label}
                </text>
                <g
                  className={cn('transition-transform', DRAW_IN_CLASS)}
                  style={{
                    transformBox: 'view-box',
                    transformOrigin: `${x1}px ${y}px`,
                    transform: drawn ? 'scaleX(1)' : 'scaleX(0)',
                    transitionDelay: drawn ? `${Math.min(index * 40, 400)}ms` : '0ms',
                  }}
                >
                  <line
                    x1={x1}
                    x2={x2}
                    y1={y}
                    y2={y}
                    className="stroke-line-strong"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </g>
                <circle cx={x1} cy={y} r={6} fill={FROM} className="stroke-surface" strokeWidth="2" />
                <circle
                  cx={x2}
                  cy={y}
                  r={6}
                  fill={TO}
                  className={cn('stroke-surface transition-opacity', DRAW_IN_CLASS)}
                  strokeWidth="2"
                  opacity={drawn ? 1 : 0}
                  style={{ transitionDelay: drawn ? `${Math.min(index * 40, 400) + 200}ms` : '0ms' }}
                />
              </g>
            )
          })}
        </svg>

        {current && active !== null && (
          <PlotTip
            x={(toX(current.from) + toX(current.to)) / 2}
            y={rowY(active) - 6}
            width={PLOT_WIDTH}
            height={height}
          >
            <ChartTooltip
              title={current.label}
              rows={[
                { label: fromLabel, value: format(current.from), color: FROM },
                { label: toLabel, value: format(current.to), color: TO },
                { label: 'Gap', value: gap(current) },
              ]}
            />
          </PlotTip>
        )}
      </div>

      {showLegend && (
        <Legend
          label={`${label} key`}
          series={[
            { label: fromLabel, color: FROM },
            { label: toLabel, color: TO },
          ]}
        />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">{fromLabel}</th>
              <th scope="col">{toLabel}</th>
              <th scope="col">Gap</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td>{format(row.from)}</td>
                <td>{format(row.to)}</td>
                <td>{gap(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer
        message={
          current
            ? `${current.label}: ${fromLabel} ${format(current.from)}, ${toLabel} ${format(current.to)}, gap ${gap(current)}`
            : ''
        }
      />
    </div>
  )
}
