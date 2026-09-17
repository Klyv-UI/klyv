'use client'

import { useId, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import {
  DRAW_IN_CLASS,
  PLOT_WIDTH,
  PlotAnnouncer,
  PlotTip,
  TICK_CLASS,
  pointerToView,
  useDrawIn,
} from '../internal/plot'

export interface MatrixHeatmapProps {
  /** Row labels, top to bottom. */
  rows: string[]
  /** Column labels, left to right. */
  columns: string[]
  /** One array per row, one value per column. `null` marks a cell with no data. */
  values: (number | null)[][]
  /** Accessible name for the chart. */
  label: string
  /** Number of colour steps between the lowest and highest value. */
  steps?: number
  /** Lower end of the scale. Defaults to the smallest value. */
  min?: number
  /** Upper end of the scale. Defaults to the largest value. */
  max?: number
  /** Print each value inside its cell. */
  showValues?: boolean
  /** Height of each row in viewBox pixels. */
  cellHeight?: number
  /** Format values in cells, the legend and the tooltip. */
  format?: (value: number) => string
  /** What a value measures, for the tooltip and the legend — “Retention”. */
  valueLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

const TOP_FLAT = 26
const TOP_ANGLED = 58

/** The accent mixed into the surface: step 0 is a faint tint, the last step is the accent itself. */
function stepFill(step: number, steps: number) {
  const share = Math.round(10 + (90 * step) / Math.max(1, steps - 1))
  return `color-mix(in oklab, var(--color-accent-strong) ${share}%, var(--color-surface))`
}

/**
 * A grid of values coloured on one sequential scale — cohorts by week, hours
 * by weekday, features by plan.
 *
 * The scale is stepped rather than continuous. Nobody can tell 62% accent from
 * 66% accent, so a smooth ramp implies a precision the eye cannot read back;
 * five or six steps, each shown in the legend with its range, can be. Steps are
 * mixed from the accent into the surface with `color-mix`, so the ramp follows
 * the theme and the preset without a palette of its own.
 *
 * Printed values switch ink by step: dark accent-ink on the strong end, where the
 * accent is, and ordinary ink on the pale end, where the surface is. The grid is
 * one tab stop, and the arrow keys move a cell cursor in two dimensions.
 */
export function MatrixHeatmap({
  rows,
  columns,
  values,
  label,
  steps = 5,
  min: minProp,
  max: maxProp,
  showValues = false,
  cellHeight = 30,
  format = formatTick,
  valueLabel = 'Value',
  className,
}: MatrixHeatmapProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const [cursor, setCursor] = useState<{ row: number; column: number } | null>(null)

  let low = Infinity
  let high = -Infinity
  for (const row of values)
    for (const value of row) {
      if (value === null || !Number.isFinite(value)) continue
      low = Math.min(low, value)
      high = Math.max(high, value)
    }
  const min = minProp ?? (Number.isFinite(low) ? low : 0)
  const max = maxProp ?? (Number.isFinite(high) ? high : 1)
  const stepOf = (value: number) =>
    Math.min(steps - 1, Math.max(0, Math.floor(((value - min) / (max - min || 1)) * steps)))
  const bounds = Array.from({ length: steps }, (_, step) => min + ((max - min) * step) / steps)

  const left = Math.min(180, Math.max(40, Math.max(0, ...rows.map((row) => row.length)) * 5.6 + 14))
  const plotWidth = PLOT_WIDTH - left - 4
  const cellWidth = plotWidth / Math.max(1, columns.length)
  const angled = columns.some((column) => column.length * 5.4 > cellWidth - 4)
  const top = angled ? TOP_ANGLED : TOP_FLAT
  const height = top + rows.length * cellHeight + 2

  const move = (event: KeyboardEvent) => {
    if (rows.length === 0 || columns.length === 0) return
    const at = cursor ?? { row: 0, column: 0 }
    const last = { row: rows.length - 1, column: columns.length - 1 }
    const moves: Record<string, () => { row: number; column: number } | null> = {
      ArrowRight: () => (cursor ? { ...at, column: Math.min(last.column, at.column + 1) } : at),
      ArrowLeft: () => (cursor ? { ...at, column: Math.max(0, at.column - 1) } : at),
      ArrowDown: () => (cursor ? { ...at, row: Math.min(last.row, at.row + 1) } : at),
      ArrowUp: () => (cursor ? { ...at, row: Math.max(0, at.row - 1) } : at),
      Home: () => (event.ctrlKey ? { row: 0, column: 0 } : { ...at, column: 0 }),
      End: () => (event.ctrlKey ? last : { ...at, column: last.column }),
      Escape: () => null,
    }
    const handler = moves[event.key]
    if (!handler || (event.key === 'Escape' && !cursor)) return
    event.preventDefault()
    setCursor(handler())
  }

  const valueAt = (row: number, column: number) => values[row]?.[column] ?? null
  const describe = ({ row, column }: { row: number; column: number }) => {
    const value = valueAt(row, column)
    return `${rows[row]}, ${columns[column]}: ${value === null ? 'no data' : format(value)}`
  }
  const active = cursor && cursor.row < rows.length && cursor.column < columns.length ? cursor : null
  const activeValue = active ? valueAt(active.row, active.column) : undefined

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${rows.length} rows by ${columns.length} columns; use arrow keys to move between cells.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          tabIndex={0}
          onKeyDown={move}
          onFocus={(event) => {
            let keyboard = false
            try {
              keyboard = event.currentTarget.matches(':focus-visible')
            } catch {
              keyboard = false
            }
            if (keyboard && !cursor && rows.length && columns.length) setCursor({ row: 0, column: 0 })
          }}
          onBlur={() => setCursor(null)}
          onPointerMove={(event) => {
            const point = pointerToView(event, PLOT_WIDTH, height)
            const row = Math.floor((point.y - top) / cellHeight)
            const column = Math.floor((point.x - left) / cellWidth)
            setCursor(row >= 0 && row < rows.length && column >= 0 && column < columns.length ? { row, column } : null)
          }}
          onPointerLeave={() => setCursor(null)}
        >
          {columns.map((column, index) => {
            const x = left + cellWidth * (index + 0.5)
            return angled ? (
              <text
                key={`c${index}`}
                transform={`translate(${x} ${top - 6}) rotate(-40)`}
                className={cn(TICK_CLASS, active?.column === index && 'fill-ink')}
              >
                {column}
              </text>
            ) : (
              <text
                key={`c${index}`}
                x={x}
                y={top - 9}
                textAnchor="middle"
                className={cn(TICK_CLASS, active?.column === index && 'fill-ink')}
              >
                {column}
              </text>
            )
          })}
          {rows.map((row, rowIndex) => (
            <g key={`r${rowIndex}`}>
              <text
                x={left - 8}
                y={top + cellHeight * (rowIndex + 0.5)}
                textAnchor="end"
                dominantBaseline="middle"
                className={cn(TICK_CLASS, active?.row === rowIndex && 'fill-ink')}
              >
                {row}
              </text>
              {columns.map((_, column) => {
                const value = valueAt(rowIndex, column)
                const step = value === null ? -1 : stepOf(value)
                const x = left + cellWidth * column
                const y = top + cellHeight * rowIndex
                const strong = step >= Math.ceil(steps / 2)
                return (
                  <g
                    key={column}
                    className={cn('transition-opacity', DRAW_IN_CLASS)}
                    style={{
                      opacity: drawn ? 1 : 0,
                      transitionDelay: drawn ? `${Math.min((rowIndex + column) * 12, 360)}ms` : '0ms',
                    }}
                  >
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={Math.max(0, cellWidth - 2)}
                      height={cellHeight - 2}
                      rx={4}
                      fill={value === null ? 'var(--color-surface-muted)' : stepFill(step, steps)}
                    />
                    {showValues && value !== null && cellWidth > 22 && (
                      <text
                        x={x + cellWidth / 2}
                        y={y + cellHeight / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={cn('text-[9px] font-semibold', strong ? 'fill-accent-ink' : 'fill-ink')}
                      >
                        {format(value)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          ))}
          {active && (
            <rect
              x={left + cellWidth * active.column + 0.5}
              y={top + cellHeight * active.row + 0.5}
              width={Math.max(0, cellWidth - 1)}
              height={cellHeight - 1}
              rx={5}
              fill="none"
              className="stroke-ink"
              strokeWidth="2"
            />
          )}
        </svg>

        {active && activeValue !== undefined && (
          <PlotTip
            x={left + cellWidth * (active.column + 0.5)}
            y={top + cellHeight * active.row}
            width={PLOT_WIDTH}
            height={height}
          >
            <ChartTooltip
              title={`${rows[active.row]} · ${columns[active.column]}`}
              rows={[
                {
                  label: valueLabel,
                  value: activeValue === null ? 'No data' : format(activeValue),
                  color: activeValue === null ? undefined : stepFill(stepOf(activeValue), steps),
                },
              ]}
            />
          </PlotTip>
        )}
      </div>

      <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
        <Text as="span" size="caption" weight="semibold" tone="faint">
          {valueLabel}
        </Text>
        <Text as="span" size="caption" weight="medium" tone="soft" tabular>
          {format(min)}
        </Text>
        <span className="flex overflow-hidden rounded-full">
          {bounds.map((bound, step) => (
            <span
              key={step}
              title={`${format(bound)} to ${format(bounds[step + 1] ?? max)}`}
              className="h-2.5 w-6"
              style={{ background: stepFill(step, steps) }}
            />
          ))}
        </span>
        <Text as="span" size="caption" weight="medium" tone="soft" tabular>
          {format(max)}
        </Text>
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <td />
              {columns.map((column, index) => (
                <th key={index} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">{row}</th>
                {columns.map((_, column) => {
                  const value = valueAt(rowIndex, column)
                  return <td key={column}>{value === null ? 'No data' : format(value)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={active ? describe(active) : ''} />
    </div>
  )
}
