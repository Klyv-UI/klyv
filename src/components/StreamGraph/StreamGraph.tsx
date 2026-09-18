'use client'

import { useId, useState, type KeyboardEvent } from 'react'
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
  useDrawIn,
} from '../internal/plot'

export type StreamGraphOffset = 'wiggle' | 'silhouette'

export interface StreamGraphSeries {
  id: string
  label: string
  /** One value per category. Negative and missing values count as zero. */
  values: number[]
  /** Any CSS colour. Defaults walk SERIES_COLORS. */
  color?: string
}

export interface StreamGraphProps {
  series: StreamGraphSeries[]
  /** Labels along the x axis, one per value. */
  categories: string[]
  /** Accessible name for the chart. */
  label: string
  /** `wiggle` minimises how much the streams slope; `silhouette` centres the stack on a flat line. */
  offset?: StreamGraphOffset
  /** Plot height in viewBox pixels. The width fills the container. */
  height?: number
  /** Format values in the tooltip and the hidden table. */
  format?: (value: number) => string
  /** Series ids hidden on first render. */
  defaultHidden?: string[]
  /** Called when the legend shows or hides a series, with the ids now hidden. */
  onHiddenChange?: (hidden: string[]) => void
  /** Merged last, so it wins. */
  className?: string
}

const PAD = { top: 10, right: 12, bottom: 24, left: 12 }
const KEYS = 'left and right move along time, up and down between streams.'

/** A smooth line through points that never overshoots: each span is a cubic with flat handles at its midpoint. */
function smooth(points: [number, number][]) {
  return points
    .map(([x, y], index) => {
      if (index === 0) return `${x} ${y}`
      const [px, py] = points[index - 1]
      const mid = (px + x) / 2
      return `C${mid} ${py} ${mid} ${y} ${x} ${y}`
    })
    .join(' ')
}

/**
 * Series stacked around a moving centre line rather than on a floor — for how a
 * mix changes over time, where the total matters less than who is growing.
 *
 * The default `wiggle` baseline is the Byron–Wattenberg offset: at every step
 * it shifts the whole stack to cancel the average slope of the layers, weighted
 * by their thickness. Thick streams stay nearly level, so a change in one stream
 * is not misread as a change in every stream stacked above it, which is the
 * failure of an ordinary stacked area. `silhouette` simply centres the stack.
 *
 * There is no value axis, because the baseline has no meaning; values are read
 * from the tooltip, which lists every stream at the hovered step. Hovering a
 * stream isolates it. Legend entries are toggle buttons, and the last visible
 * stream cannot be hidden. The chart is one tab stop: left and right move
 * along time, up and down move between streams.
 */
export function StreamGraph({
  series,
  categories,
  label,
  offset = 'wiggle',
  height = 260,
  format = formatTick,
  defaultHidden = [],
  onHiddenChange,
  className,
}: StreamGraphProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const [hidden, setHidden] = useState(() => new Set(defaultHidden))
  const [cursor, setCursor] = useState<{ index: number; stream: number } | null>(null)

  const resolved = series.map((entry, index) => ({
    ...entry,
    color: entry.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
  }))
  const visible = resolved.filter((entry) => !hidden.has(entry.id))
  const count = categories.length
  const value = (entry: StreamGraphSeries, index: number) => {
    const raw = entry.values[index]
    return Number.isFinite(raw) && raw > 0 ? raw : 0
  }

  // Baseline per step, then each stream's lower and upper edge on top of it.
  const totals = Array.from({ length: count }, (_, index) => visible.reduce((sum, entry) => sum + value(entry, index), 0))
  const base: number[] = new Array(count).fill(0)
  if (offset === 'silhouette') {
    for (let index = 0; index < count; index += 1) base[index] = -totals[index] / 2
  } else if (count > 0) {
    base[0] = -totals[0] / 2
    for (let index = 1; index < count; index += 1) {
      let weighted = 0
      let below = 0
      for (const entry of visible) {
        const now = value(entry, index)
        const change = now - value(entry, index - 1)
        weighted += (below + change / 2) * now
        below += change
      }
      base[index] = base[index - 1] - (totals[index] ? weighted / totals[index] : 0)
    }
    // Wiggle drifts; recentre so the stack sits in the middle of the plot.
    const drift = base.reduce((sum, b, index) => sum + b + totals[index] / 2, 0) / count
    for (let index = 0; index < count; index += 1) base[index] -= drift
  }
  const layers = visible.map((entry) => ({ entry, lower: [] as number[], upper: [] as number[] }))
  for (let index = 0; index < count; index += 1) {
    let running = base[index]
    for (const layer of layers) {
      layer.lower.push(running)
      running += value(layer.entry, index)
      layer.upper.push(running)
    }
  }

  let low = Infinity
  let high = -Infinity
  for (let index = 0; index < count; index += 1) {
    low = Math.min(low, base[index])
    high = Math.max(high, base[index] + totals[index])
  }
  if (!Number.isFinite(low) || low === high) {
    low = -1
    high = 1
  }
  const plot = { x: PAD.left, y: PAD.top, width: PLOT_WIDTH - PAD.left - PAD.right, height: height - PAD.top - PAD.bottom }
  const toX = (index: number) => (count <= 1 ? plot.x + plot.width / 2 : plot.x + (index / (count - 1)) * plot.width)
  const toY = linear(low, high, plot.y + plot.height, plot.y)

  const active =
    cursor && cursor.index < count ? { index: cursor.index, stream: Math.min(cursor.stream, layers.length - 1) } : null
  const activeLayer = active && active.stream >= 0 ? layers[active.stream] : null
  const labelEvery = Math.max(1, Math.ceil(count / 8))

  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else if (visible.length > 1) next.add(id)
    else return
    setHidden(next)
    onHiddenChange?.([...next])
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!count || !layers.length) return
    const at = active ?? { index: 0, stream: 0 }
    const moves: Record<string, () => { index: number; stream: number } | null> = {
      ArrowRight: () => (active ? { ...at, index: Math.min(count - 1, at.index + 1) } : at),
      ArrowLeft: () => (active ? { ...at, index: Math.max(0, at.index - 1) } : at),
      ArrowUp: () => (active ? { ...at, stream: Math.min(layers.length - 1, at.stream + 1) } : at),
      ArrowDown: () => (active ? { ...at, stream: Math.max(0, at.stream - 1) } : at),
      Home: () => ({ ...at, index: 0 }),
      End: () => ({ ...at, index: count - 1 }),
      Escape: () => null,
    }
    const move = moves[event.key]
    if (!move || (event.key === 'Escape' && !active)) return
    event.preventDefault()
    setCursor(move())
  }

  const describe = (index: number, stream: number) =>
    `${categories[index]}: ${layers[stream].entry.label} ${format(value(layers[stream].entry, index))}, total ${format(totals[index])}`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${visible.length} streams across ${count} steps; ${KEYS}`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={(event) => {
            let keyboard = false
            try {
              keyboard = event.currentTarget.matches(':focus-visible')
            } catch {
              keyboard = false
            }
            if (keyboard && !cursor && count && layers.length) setCursor({ index: 0, stream: 0 })
          }}
          onBlur={() => setCursor(null)}
          onPointerMove={(event) => {
            const { x, y } = pointerToView(event, PLOT_WIDTH, height)
            const index = Math.round(count <= 1 ? 0 : ((x - plot.x) / plot.width) * (count - 1))
            if (index < 0 || index >= count) return setCursor(null)
            const stream = layers.findIndex((layer) => y <= toY(layer.lower[index]) && y >= toY(layer.upper[index]))
            setCursor({ index, stream })
          }}
          onPointerLeave={() => setCursor(null)}
        >
          {categories.map((category, index) =>
            index % labelEvery === 0 ? (
              <g key={`${category}-${index}`}>
                <line
                  x1={toX(index)}
                  x2={toX(index)}
                  y1={plot.y}
                  y2={plot.y + plot.height}
                  className="stroke-line"
                  strokeDasharray="2 3"
                />
                <text
                  x={toX(index)}
                  y={height - 6}
                  textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
                  className={TICK_CLASS}
                >
                  {category}
                </text>
              </g>
            ) : null,
          )}
          <g
            className={cn('transition-transform', DRAW_IN_CLASS)}
            style={{ transformOrigin: `0 ${plot.y + plot.height / 2}px`, transform: drawn ? 'scaleY(1)' : 'scaleY(0)' }}
          >
            {layers.map((layer, stream) => {
              const top = layer.upper.map((y, index) => [toX(index), toY(y)] as [number, number])
              const bottom = layer.lower.map((y, index) => [toX(index), toY(y)] as [number, number]).reverse()
              const isolated = activeLayer !== null && activeLayer !== layer
              return (
                <path
                  key={layer.entry.id}
                  d={count ? `M${smooth(top)} L${smooth(bottom)} Z` : ''}
                  fill={layer.entry.color}
                  className="stroke-surface transition-opacity"
                  strokeWidth="1"
                  opacity={isolated ? 0.25 : active?.stream === stream ? 1 : 0.88}
                />
              )
            })}
          </g>
          {active && (
            <line
              x1={toX(active.index)}
              x2={toX(active.index)}
              y1={plot.y}
              y2={plot.y + plot.height}
              className="stroke-ink"
              strokeWidth="1.25"
            />
          )}
        </svg>

        {active && (
          <PlotTip
            x={toX(active.index)}
            y={activeLayer ? toY(activeLayer.upper[active.index]) : plot.y + plot.height / 2}
            width={PLOT_WIDTH}
            height={height}
          >
            <ChartTooltip
              title={categories[active.index]}
              rows={[...layers]
                .reverse()
                .map((layer) => ({
                  label: layer === activeLayer ? `${layer.entry.label} ←` : layer.entry.label,
                  value: format(value(layer.entry, active.index)),
                  color: layer.entry.color,
                }))}
            />
          </PlotTip>
        )}
      </div>

      <ul aria-label={`${label} series`} className="flex list-none flex-wrap items-center gap-1.5">
        {[...resolved].reverse().map((entry) => {
          const on = !hidden.has(entry.id)
          return (
            <li key={entry.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={on && visible.length === 1}
                onClick={() => toggle(entry.id)}
                className={cn(
                  'flex h-7 items-center gap-2 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                  'disabled:cursor-not-allowed',
                  on ? 'border-line bg-surface text-ink' : 'border-dashed border-line-strong bg-transparent text-ink-faint',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('size-2.5 rounded-full', !on && 'opacity-30')}
                  style={{ background: entry.color }}
                />
                {entry.label}
              </button>
            </li>
          )
        })}
      </ul>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <td />
              {visible.map((entry) => (
                <th key={entry.id} scope="col">
                  {entry.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={`${category}-${index}`}>
                <th scope="row">{category}</th>
                {visible.map((entry) => (
                  <td key={entry.id}>{format(value(entry, index))}</td>
                ))}
                <td>{format(totals[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
      <PlotAnnouncer
        message={
          active === null
            ? ''
            : active.stream >= 0
              ? describe(active.index, active.stream)
              : `${categories[active.index]}: total ${format(totals[active.index])}`
        }
      />
    </div>
  )
}
