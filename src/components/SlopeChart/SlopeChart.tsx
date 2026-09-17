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
  linear,
  pointerToView,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface SlopeChartItem {
  id: string
  label: string
  /** Value at the first time point. */
  start: number
  /** Value at the second time point. */
  end: number
  /** Any CSS colour. Overrides the direction tone. */
  color?: string
}

export interface SlopeChartProps {
  items: SlopeChartItem[]
  /** Accessible name for the chart. */
  label: string
  /** Heading over the left column — “2025”, “Before”. */
  startLabel: string
  /** Heading over the right column. */
  endLabel: string
  /**
   * `direction` colours rises success and falls danger; `series` walks
   * SERIES_COLORS. Flat lines are faint either way in `direction`.
   */
  tone?: 'direction' | 'series'
  /** Whether a higher value is good. Flips the direction tone for costs, churn, latency. */
  higherIsBetter?: boolean
  /** Chart height in pixels. The width fills the container. */
  height?: number
  /** Format values on the labels and in the tooltip. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

const TOP = 30
const BOTTOM = 12
const GAP = 12

/**
 * Pushes label positions apart until none are closer than `gap`, keeping them
 * inside the plot. Two sweeps — down, then back up from the bottom edge — settle
 * any pile-up without iterating to convergence.
 */
function spread(positions: number[], gap: number, low: number, high: number) {
  const order = positions.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y)
  for (let i = 0; i < order.length; i += 1) {
    order[i].y = Math.max(order[i].y, i === 0 ? low : order[i - 1].y + gap)
  }
  for (let i = order.length - 1; i >= 0; i -= 1) {
    order[i].y = Math.min(order[i].y, i === order.length - 1 ? high : order[i + 1].y - gap)
  }
  const result = [...positions]
  for (const entry of order) result[entry.index] = entry.y
  return result
}

/**
 * Change between two moments for many items at once: one line per item from
 * its value then to its value now.
 *
 * Two grouped bars per item make the reader subtract; a slope makes the change
 * the thing drawn, so steep, flat and crossing lines are seen before anything is
 * read. Labels sit at both ends and are nudged apart when values are close,
 * with a thin leader back to the true position, so no label ever lies about
 * where its line is. Hover or arrow to an item and everything else fades.
 */
export function SlopeChart({
  items,
  label,
  startLabel,
  endLabel,
  tone = 'direction',
  higherIsBetter = true,
  height = 300,
  format = formatTick,
  className,
}: SlopeChartProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const { active, setActive, keyProps } = useChartCursor(items.length)

  const valid = items.map((item) => ({
    ...item,
    start: Number.isFinite(item.start) ? item.start : 0,
    end: Number.isFinite(item.end) ? item.end : 0,
  }))
  const all = valid.flatMap((item) => [item.start, item.end])
  const low = Math.min(...(all.length ? all : [0]))
  const high = Math.max(...(all.length ? all : [1]))

  const longest = (side: 'start' | 'end') =>
    Math.max(0, ...valid.map((item) => `${item.label} ${format(item[side])}`.length))
  const left = Math.min(200, longest('start') * 5.4 + 20)
  const right = PLOT_WIDTH - Math.min(200, longest('end') * 5.4 + 20)
  const toY = linear(low, high === low ? low + 1 : high, height - BOTTOM, TOP)

  const startYs = spread(
    valid.map((item) => toY(item.start)),
    GAP,
    TOP,
    height - BOTTOM,
  )
  const endYs = spread(
    valid.map((item) => toY(item.end)),
    GAP,
    TOP,
    height - BOTTOM,
  )

  const colorOf = (item: (typeof valid)[number], index: number) => {
    if (item.color) return item.color
    if (tone === 'series') return SERIES_COLORS[index % SERIES_COLORS.length]
    if (item.end === item.start) return 'var(--color-ink-faint)'
    return item.end > item.start === higherIsBetter ? 'var(--color-success)' : 'var(--color-danger)'
  }
  const change = (item: (typeof valid)[number]) => {
    const delta = item.end - item.start
    const percent = item.start === 0 ? null : (delta / Math.abs(item.start)) * 100
    return `${delta >= 0 ? '+' : '−'}${format(Math.abs(delta))}${percent === null ? '' : ` (${delta >= 0 ? '+' : '−'}${Math.abs(percent).toFixed(1)}%)`}`
  }
  const current = active === null ? null : valid[active]

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${valid.length} items from ${startLabel} to ${endLabel}; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={(event) => {
            const point = pointerToView(event, PLOT_WIDTH, height)
            const t = Math.min(1, Math.max(0, (point.x - left) / (right - left)))
            let best: number | null = null
            let bestDistance = 14
            valid.forEach((item, index) => {
              const y = toY(item.start) + (toY(item.end) - toY(item.start)) * t
              const distance = Math.abs(y - point.y)
              if (distance < bestDistance) {
                bestDistance = distance
                best = index
              }
            })
            setActive(best)
          }}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {[
            { x: left, text: startLabel, anchor: 'end' as const },
            { x: right, text: endLabel, anchor: 'start' as const },
          ].map((column) => (
            <g key={column.anchor}>
              <line
                x1={column.x}
                x2={column.x}
                y1={TOP - 8}
                y2={height - BOTTOM + 4}
                className="stroke-line-strong"
                strokeWidth="1"
              />
              <text
                x={column.x}
                y={12}
                textAnchor="middle"
                className="fill-ink-soft text-[10px] font-bold uppercase tracking-wider"
              >
                {column.text}
              </text>
            </g>
          ))}

          {valid.map((item, index) => {
            const color = colorOf(item, index)
            const dim = active !== null && active !== index
            const y1 = toY(item.start)
            const y2 = toY(item.end)
            return (
              <g
                key={item.id}
                opacity={dim ? 0.2 : 1}
                className="transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none"
              >
                <line
                  x1={left}
                  y1={y1}
                  x2={right}
                  y2={y2}
                  stroke={color}
                  strokeWidth={active === index ? 3 : 2}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={drawn ? 0 : 1}
                  className={cn('transition-[stroke-dashoffset]', DRAW_IN_CLASS)}
                  style={{ transitionDelay: drawn ? `${Math.min(index * 40, 400)}ms` : '0ms' }}
                />
                <circle cx={left} cy={y1} r={3.5} fill={color} />
                <circle
                  cx={right}
                  cy={y2}
                  r={3.5}
                  fill={color}
                  opacity={drawn ? 1 : 0}
                  className={cn('transition-opacity', DRAW_IN_CLASS)}
                  style={{ transitionDelay: drawn ? `${Math.min(index * 40, 400) + 300}ms` : '0ms' }}
                />
                {[
                  { x: left - 8, y: startYs[index], mark: y1, anchor: 'end' as const, value: item.start },
                  { x: right + 8, y: endYs[index], mark: y2, anchor: 'start' as const, value: item.end },
                ].map((end) => (
                  <g key={end.anchor}>
                    {Math.abs(end.y - end.mark) > 2 && (
                      <line
                        x1={end.anchor === 'end' ? left - 1 : right + 1}
                        y1={end.mark}
                        x2={end.anchor === 'end' ? left - 6 : right + 6}
                        y2={end.y}
                        className="stroke-line-strong"
                        strokeWidth="1"
                      />
                    )}
                    <text
                      x={end.x}
                      y={end.y}
                      textAnchor={end.anchor}
                      dominantBaseline="middle"
                      className={cn(TICK_CLASS, active === index && 'fill-ink font-bold')}
                    >
                      {end.anchor === 'end'
                        ? `${item.label} ${format(end.value)}`
                        : `${format(end.value)} ${item.label}`}
                    </text>
                  </g>
                ))}
              </g>
            )
          })}
        </svg>

        {current && active !== null && (
          <PlotTip
            x={(left + right) / 2}
            y={(toY(current.start) + toY(current.end)) / 2}
            width={PLOT_WIDTH}
            height={height}
          >
            <ChartTooltip
              title={current.label}
              rows={[
                { label: startLabel, value: format(current.start) },
                { label: endLabel, value: format(current.end), color: colorOf(current, active) },
                { label: 'Change', value: change(current) },
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
              <th scope="col">Item</th>
              <th scope="col">{startLabel}</th>
              <th scope="col">{endLabel}</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {valid.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.label}</th>
                <td>{format(item.start)}</td>
                <td>{format(item.end)}</td>
                <td>{change(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer
        message={
          current
            ? `${current.label}: ${startLabel} ${format(current.start)}, ${endLabel} ${format(current.end)}, ${change(current)}`
            : ''
        }
      />
    </div>
  )
}
