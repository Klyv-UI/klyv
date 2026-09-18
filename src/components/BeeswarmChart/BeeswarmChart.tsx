'use client'

import { useId, useState } from 'react'
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
  linear,
  niceScale,
  pointerToView,
  quantile,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface BeeswarmChartPoint {
  id: string
  value: number
  /** Row the point belongs to. Points without one share a single unnamed row. */
  group?: string
  /** Names the point in the tooltip and the hidden table — an account, a request, a person. */
  label?: string
}

export interface BeeswarmChartProps {
  points: BeeswarmChartPoint[]
  /** Accessible name for the chart. */
  label: string
  /** Row order, top to bottom. Defaults to the order groups first appear. */
  groups?: string[]
  /** Name of the measure, printed under the axis. */
  valueLabel?: string
  /** Format values on the axis and in the tooltip. */
  format?: (value: number) => string
  /** Dot radius in viewBox pixels. */
  radius?: number
  /** Height of each row in viewBox pixels. */
  rowHeight?: number
  /** Mark each row’s median with a short line. */
  showMedian?: boolean
  /** Id of the highlighted point. Omit to let the chart track it. */
  selected?: string | null
  /** Called when a point is clicked or chosen with Enter; null when the selection is cleared. */
  onSelect?: (id: string | null) => void
  /** Merged last, so it wins. */
  className?: string
}

const PAD = { top: 8, right: 16, bottom: 26 }

/**
 * Every observation as its own dot along one axis, nudged sideways just enough
 * that no two overlap — so the shape of the distribution appears without
 * binning it away.
 *
 * Dots are placed in value order, each at the smallest offset from the row’s
 * centre line that clears the dots already placed. The swarm is therefore
 * widest where values are densest, which is the histogram’s message, while
 * every outlier stays a dot you can hover and name. Rows share one axis, so
 * groups compare by position.
 *
 * Selecting a point rings it and keeps it lit — useful for “where does this
 * account sit” — and it stays selected while the cursor moves on. The chart is
 * one tab stop; arrow keys step through points in row then value order and
 * Enter selects.
 */
export function BeeswarmChart({
  points,
  label,
  groups: groupsProp,
  valueLabel,
  format = formatTick,
  radius = 4,
  rowHeight = 64,
  showMedian = true,
  selected: selectedProp,
  onSelect,
  className,
}: BeeswarmChartProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const [ownSelected, setOwnSelected] = useState<string | null>(null)
  const selected = selectedProp === undefined ? ownSelected : selectedProp

  const clean = points.filter((point) => Number.isFinite(point.value))
  const groups = groupsProp ?? [...new Set(clean.map((point) => point.group ?? ''))]
  const rows = groups.map((group) => clean.filter((point) => (point.group ?? '') === group).sort((a, b) => a.value - b.value))

  let low = Infinity
  let high = -Infinity
  for (const point of clean) {
    low = Math.min(low, point.value)
    high = Math.max(high, point.value)
  }
  const scale = niceScale(low, high, 5)
  const named = groups.some(Boolean)
  const left = named ? Math.min(160, Math.max(40, Math.max(...groups.map((group) => group.length)) * 5.6 + 16)) : 12
  const bottom = PAD.bottom + (valueLabel ? 14 : 0)
  const height = PAD.top + rows.length * rowHeight + bottom
  const plot = { x: left, width: PLOT_WIDTH - left - PAD.right }
  const toX = linear(scale.min, scale.max, plot.x, plot.x + plot.width)

  const flat = rows.flatMap((row, rowIndex) => {
    const centre = PAD.top + rowHeight * (rowIndex + 0.5)
    const limit = rowHeight / 2 - radius
    const placed: { x: number; y: number }[] = []
    const gap = radius * 2 + 0.8
    return row.map((point) => {
      const x = toX(point.value)
      // Try offsets outward from the centre line, alternating sides. A row too dense to
      // hold its swarm takes the least-crowded spot inside the row rather than spilling
      // into the next one.
      let y = centre
      let roomiest = -1
      for (let k = 0; ; k += 1) {
        const offset = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (gap / 2.2)
        if (Math.abs(offset) > limit) break
        const candidate = centre + offset
        let nearest = Infinity
        for (const other of placed) {
          if (Math.abs(other.x - x) < gap) nearest = Math.min(nearest, Math.hypot(other.x - x, other.y - candidate))
        }
        if (nearest >= gap) {
          y = candidate
          break
        }
        if (nearest > roomiest) {
          roomiest = nearest
          y = candidate
        }
      }
      placed.push({ x, y })
      return { point, x, y, row: rowIndex }
    })
  })

  const { active, setActive, keyProps } = useChartCursor(flat.length)
  const hovered = active === null ? null : flat[active]

  const choose = (id: string | null) => {
    setOwnSelected(id)
    onSelect?.(id)
  }

  const describe = (entry: (typeof flat)[number]) =>
    [entry.point.label ?? entry.point.id, groups[entry.row] || null, `${valueLabel ?? 'value'} ${format(entry.point.value)}`]
      .filter(Boolean)
      .join(', ')

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${flat.length} points in ${rows.length} rows; arrow keys step through them, Enter selects.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          {...keyProps}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && hovered) {
              event.preventDefault()
              choose(selected === hovered.point.id ? null : hovered.point.id)
              return
            }
            keyProps.onKeyDown(event)
          }}
          onPointerMove={(event) => {
            const { x, y } = pointerToView(event, PLOT_WIDTH, height)
            let best: number | null = null
            let bestDistance = radius + 6
            flat.forEach((entry, index) => {
              const distance = Math.hypot(entry.x - x, entry.y - y)
              if (distance < bestDistance) {
                bestDistance = distance
                best = index
              }
            })
            setActive(best)
          }}
          onPointerLeave={() => setActive(null)}
          onClick={() => hovered && choose(selected === hovered.point.id ? null : hovered.point.id)}
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={toX(tick)}
                x2={toX(tick)}
                y1={PAD.top}
                y2={height - bottom}
                className="stroke-line"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text x={toX(tick)} y={height - bottom + 16} textAnchor="middle" className={TICK_CLASS}>
                {format(tick)}
              </text>
            </g>
          ))}
          {valueLabel && (
            <text
              x={plot.x + plot.width / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-ink-soft text-[10px] font-semibold"
            >
              {valueLabel}
            </text>
          )}
          {rows.map((row, rowIndex) => {
            const centre = PAD.top + rowHeight * (rowIndex + 0.5)
            const values = row.map((point) => point.value)
            return (
              <g key={groups[rowIndex] || rowIndex}>
                {rowIndex > 0 && (
                  <line
                    x1={plot.x}
                    x2={plot.x + plot.width}
                    y1={PAD.top + rowHeight * rowIndex}
                    y2={PAD.top + rowHeight * rowIndex}
                    className="stroke-line"
                  />
                )}
                {named && (
                  <text x={left - 10} y={centre} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                    {groups[rowIndex]}
                  </text>
                )}
                {showMedian && values.length > 0 && (
                  <line
                    x1={toX(quantile(values, 0.5))}
                    x2={toX(quantile(values, 0.5))}
                    y1={centre - rowHeight / 2 + 4}
                    y2={centre + rowHeight / 2 - 4}
                    className="stroke-ink-faint"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            )
          })}
          {flat.map((entry, index) => {
            const isSelected = entry.point.id === selected
            const isActive = index === active
            return (
              <circle
                key={entry.point.id}
                cx={entry.x}
                cy={entry.y}
                r={isSelected ? radius + 1.5 : radius}
                className={cn(
                  'transition-[transform,opacity]',
                  DRAW_IN_CLASS,
                  isSelected ? 'fill-ink' : 'fill-[var(--color-accent-strong)]',
                  isActive || isSelected ? 'stroke-ink' : 'stroke-surface',
                )}
                strokeWidth={isActive ? 2 : 1}
                fillOpacity={selected && !isSelected && !isActive ? 0.45 : 0.9}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  transform: drawn ? 'scale(1)' : 'scale(0)',
                  transitionDelay: drawn ? `${Math.min(index * 4, 300)}ms` : '0ms',
                }}
              />
            )
          })}
        </svg>

        {hovered && (
          <PlotTip x={hovered.x} y={hovered.y} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={hovered.point.label ?? hovered.point.id}
              rows={[
                ...(groups[hovered.row] ? [{ label: 'Group', value: groups[hovered.row] }] : []),
                { label: valueLabel ?? 'Value', value: format(hovered.point.value) },
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
              <th scope="col">Point</th>
              {named && <th scope="col">Group</th>}
              <th scope="col">{valueLabel ?? 'Value'}</th>
            </tr>
          </thead>
          <tbody>
            {flat.map((entry) => (
              <tr key={entry.point.id}>
                <th scope="row">{`${entry.point.label ?? entry.point.id}${entry.point.id === selected ? ' (selected)' : ''}`}</th>
                {named && <td>{groups[entry.row]}</td>}
                <td>{format(entry.point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
      <PlotAnnouncer message={hovered ? `${describe(hovered)}${hovered.point.id === selected ? ', selected' : ''}` : ''} />
    </div>
  )
}
