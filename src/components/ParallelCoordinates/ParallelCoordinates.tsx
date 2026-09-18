'use client'

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
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
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface ParallelCoordinatesDimension {
  key: string
  label: string
  /** Fix the axis range. Defaults to the data range widened to round ticks. */
  domain?: [number, number]
  /** Format ticks, brush bounds and tooltip values on this axis. */
  format?: (value: number) => string
}

export interface ParallelCoordinatesRecord {
  id: string
  /** Names the line in the tooltip and the hidden table. */
  label: string
  values: Record<string, number>
  /** Any CSS colour for the line when it is selected. */
  color?: string
}

/** Axis key to the inclusive [low, high] range kept on that axis. */
export type ParallelCoordinatesBrushes = Record<string, [number, number]>

export interface ParallelCoordinatesProps {
  dimensions: ParallelCoordinatesDimension[]
  records: ParallelCoordinatesRecord[]
  /** Accessible name for the chart. */
  label: string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Axis keys, left to right. Controlled. */
  order?: string[]
  /** Initial axis order when uncontrolled. Defaults to the dimensions’ order. */
  defaultOrder?: string[]
  /** Called with the new order after a drag or Arrow key move. */
  onOrderChange?: (order: string[]) => void
  /** Active brushes. Controlled. */
  brushes?: ParallelCoordinatesBrushes
  /** Initial brushes when uncontrolled. */
  defaultBrushes?: ParallelCoordinatesBrushes
  /** Called whenever a brush is drawn, moved or cleared. */
  onBrushesChange?: (brushes: ParallelCoordinatesBrushes) => void
  /** What a record is called in the count — “team”, “car”. */
  noun?: string
  /** Merged last, so it wins. */
  className?: string
}

const PAD = { top: 14, bottom: 22, side: 44 }

/**
 * Many measures at once, one vertical axis each, one line per record.
 *
 * Its value is the filter, so brushing is the core of it: drag along any axis
 * to keep a range, and lines outside every brush fade while the count of what
 * is left updates. Brushes on several axes combine, which is how “cheap, fast
 * and still reliable” becomes a question the chart answers.
 *
 * Axis order changes what can be seen — only neighbouring axes show their
 * correlation — so axes reorder by dragging their header, or with the arrow
 * keys on it. Up and Down move a brush on the focused axis, Shift resizes it,
 * Escape clears it. The chart itself steps through the selected lines.
 */
export function ParallelCoordinates({
  dimensions,
  records,
  label,
  height = 300,
  order: orderProp,
  defaultOrder,
  onOrderChange,
  brushes: brushesProp,
  defaultBrushes = {},
  onBrushesChange,
  noun = 'record',
  className,
}: ParallelCoordinatesProps) {
  const tableId = useId()
  const hintId = useId()
  const drawn = useDrawIn()
  const headerRef = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const [ownOrder, setOwnOrder] = useState(defaultOrder ?? dimensions.map((dimension) => dimension.key))
  const [ownBrushes, setOwnBrushes] = useState(defaultBrushes)
  const [brushing, setBrushing] = useState<{ key: string; from: number } | null>(null)
  const [dragging, setDragging] = useState<{ key: string; startX: number; dx: number; scale: number } | null>(null)
  const [pointer, setPointer] = useState<{ index: number; x: number; y: number } | null>(null)

  const byKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]))
  const raw = orderProp ?? ownOrder
  const order = [...raw.filter((key) => byKey.has(key)), ...dimensions.map((d) => d.key).filter((key) => !raw.includes(key))]
  const brushes = brushesProp ?? ownBrushes

  const setOrder = (next: string[]) => {
    if (orderProp === undefined) setOwnOrder(next)
    onOrderChange?.(next)
  }
  const setBrushes = (next: ParallelCoordinatesBrushes) => {
    if (brushesProp === undefined) setOwnBrushes(next)
    onBrushesChange?.(next)
  }

  const plotY0 = PAD.top
  const plotY1 = height - PAD.bottom
  const xOf = (index: number) =>
    order.length <= 1 ? PLOT_WIDTH / 2 : PAD.side + (index * (PLOT_WIDTH - PAD.side * 2)) / (order.length - 1)
  const scales = new Map(
    order.map((key) => {
      const dimension = byKey.get(key)!
      const values = records.map((record) => record.values[key]).filter(Number.isFinite)
      const nice = niceScale(Math.min(...values), Math.max(...values), 4)
      const [min, max] = dimension.domain ?? [nice.min, nice.max]
      const ticks = dimension.domain ? niceScale(min, max, 4).ticks.filter((t) => t >= min && t <= max) : nice.ticks
      return [key, { min, max, ticks, toY: linear(min, max, plotY1, plotY0), toValue: linear(plotY1, plotY0, min, max), format: dimension.format ?? formatTick }]
    }),
  )

  const inside = (record: ParallelCoordinatesRecord) =>
    Object.entries(brushes).every(([key, [low, high]]) => {
      if (!scales.has(key)) return true
      const value = record.values[key]
      return Number.isFinite(value) && value >= low && value <= high
    })
  const selected = records.filter(inside)
  const { active, keyProps } = useChartCursor(selected.length)
  const focus = pointer ? selected[pointer.index] : active !== null ? selected[active] : null

  const lineOf = (record: ParallelCoordinatesRecord) =>
    order
      .map((key, index) => {
        const value = record.values[key]
        return Number.isFinite(value) ? `${index === 0 ? 'M' : 'L'}${xOf(index)} ${scales.get(key)!.toY(value)}` : ''
      })
      .join('')
      .replace(/^L/, 'M')

  const moveAxis = (key: string, to: number) => {
    const next = order.filter((entry) => entry !== key)
    next.splice(Math.max(0, Math.min(order.length - 1, to)), 0, key)
    if (next.join() !== order.join()) setOrder(next)
  }

  const onHeaderKey = (event: KeyboardEvent, key: string, index: number) => {
    const scale = scales.get(key)!
    const span = scale.max - scale.min
    const brush = brushes[key]
    const clamp = (low: number, high: number): [number, number] => {
      const width = Math.max(span * 0.05, high - low)
      const lo = Math.min(Math.max(scale.min, low), scale.max - width)
      return [lo, lo + width]
    }
    let next: [number, number] | null | undefined
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      moveAxis(key, index + (event.key === 'ArrowLeft' ? -1 : 1))
      // Reordering moves the button in the DOM, which can drop focus; put it back.
      setTimeout(() => buttons.current.get(key)?.focus(), 0)
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const step = (event.key === 'ArrowUp' ? 1 : -1) * span * 0.1
      if (!brush) next = event.key === 'ArrowUp' ? [scale.max - span * 0.25, scale.max] : [scale.min, scale.min + span * 0.25]
      else if (event.shiftKey) next = [brush[0], Math.min(scale.max, Math.max(brush[0] + span * 0.05, brush[1] + step))]
      else next = clamp(brush[0] + step, brush[1] + step)
    } else if ((event.key === 'Escape' || event.key === 'Delete' || event.key === 'Backspace') && brush) next = null
    if (next === undefined) return
    event.preventDefault()
    const copy = { ...brushes }
    if (next) copy[key] = next
    else delete copy[key]
    setBrushes(copy)
  }

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const key = (event.target as Element).getAttribute('data-axis')
    if (!key) return
    const { y } = pointerToView(event, PLOT_WIDTH, height)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setBrushing({ key, from: scales.get(key)!.toValue(y) })
    setPointer(null)
  }
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const { x, y } = pointerToView(event, PLOT_WIDTH, height)
    if (brushing) {
      const scale = scales.get(brushing.key)!
      const to = Math.min(scale.max, Math.max(scale.min, scale.toValue(y)))
      const from = Math.min(scale.max, Math.max(scale.min, brushing.from))
      setBrushes({ ...brushes, [brushing.key]: [Math.min(from, to), Math.max(from, to)] })
      return
    }
    const index = selected.findIndex((record) => record.id === (event.target as Element).getAttribute('data-record'))
    setPointer(index >= 0 ? { index, x, y } : null)
  }
  const onPointerUp = () => {
    if (!brushing) return
    const brush = brushes[brushing.key]
    const scale = scales.get(brushing.key)!
    // A click without a drag clears the axis, the way every brushing tool does.
    if (!brush || brush[1] - brush[0] < (scale.max - scale.min) * 0.01) {
      const copy = { ...brushes }
      delete copy[brushing.key]
      setBrushes(copy)
    }
    setBrushing(null)
  }

  const describe = (record: ParallelCoordinatesRecord) =>
    `${record.label}: ${order.map((key) => `${byKey.get(key)!.label} ${scales.get(key)!.format(record.values[key])}`).join(', ')}`
  const tipAt = pointer ?? (focus ? { x: xOf(Math.floor(order.length / 2)), y: scales.get(order[Math.floor(order.length / 2)])!.toY(focus.values[order[Math.floor(order.length / 2)]]) } : null)
  const brushCount = Object.keys(brushes).filter((key) => scales.has(key)).length

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div ref={headerRef} role="group" aria-label={`${label} axes`} className="relative h-8 w-full">
        {order.map((key, index) => {
          const dimension = byKey.get(key)!
          const brush = brushes[key]
          const scale = scales.get(key)!
          const moving = dragging?.key === key
          return (
            <button
              key={key}
              type="button"
              ref={(node) => {
                if (node) buttons.current.set(key, node)
                else buttons.current.delete(key)
              }}
              aria-describedby={hintId}
              aria-label={`${dimension.label} axis, position ${index + 1} of ${order.length}${brush ? `, brushed ${scale.format(brush[0])} to ${scale.format(brush[1])}` : ''}`}
              onKeyDown={(event) => onHeaderKey(event, key, index)}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId)
                const width = headerRef.current?.getBoundingClientRect().width || PLOT_WIDTH
                setDragging({ key, startX: event.clientX, dx: 0, scale: PLOT_WIDTH / width })
              }}
              onPointerMove={(event) => dragging?.key === key && setDragging({ ...dragging, dx: event.clientX - dragging.startX })}
              onPointerUp={() => {
                if (dragging?.key === key && Math.abs(dragging.dx) > 4) {
                  const target = xOf(index) + dragging.dx * dragging.scale
                  let best = 0
                  order.forEach((_, slot) => {
                    if (Math.abs(xOf(slot) - target) < Math.abs(xOf(best) - target)) best = slot
                  })
                  moveAxis(key, best)
                }
                setDragging(null)
              }}
              onPointerCancel={() => setDragging(null)}
              className={cn(
                'absolute top-0 flex h-7 max-w-[120px] cursor-grab touch-none items-center gap-1 truncate rounded-full border px-2.5 text-[11px] font-bold',
                brush ? 'border-accent-strong bg-accent-soft text-ink' : 'border-line-strong bg-surface text-ink-soft',
                moving && 'z-10 cursor-grabbing shadow-[var(--shadow-float)]',
              )}
              style={{
                left: `${(xOf(index) / PLOT_WIDTH) * 100}%`,
                transform: `translateX(calc(-50% + ${moving ? dragging!.dx : 0}px))`,
              }}
            >
              <span className="truncate">{dimension.label}</span>
            </button>
          )
        })}
      </div>
      <span id={hintId} className="sr-only">
        Left and Right move the axis. Up and Down move its brush, Shift with Up or Down resizes it, Escape clears it.
      </span>

      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${selected.length} of ${records.length} lines selected; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full touch-none select-none rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setBrushing(null)}
          onPointerLeave={() => setPointer(null)}
          {...keyProps}
        >
          {records.map((record) => {
            const on = inside(record)
            const lit = focus?.id === record.id
            return (
              <path
                key={record.id}
                d={lineOf(record)}
                data-record={on ? record.id : undefined}
                fill="none"
                stroke={on ? (lit ? 'var(--color-ink)' : record.color ?? 'color-mix(in oklab, var(--color-accent-strong) 70%, var(--color-ink))') : 'var(--color-line-strong)'}
                strokeWidth={lit ? 2.75 : 1.4}
                strokeOpacity={on ? (focus && !lit ? 0.35 : 0.85) : 0.55}
                opacity={drawn ? 1 : 0}
                className={cn('transition-opacity', DRAW_IN_CLASS)}
              />
            )
          })}
          {order.map((key, index) => {
            const scale = scales.get(key)!
            const brush = brushes[key]
            const x = xOf(index)
            return (
              <g key={key}>
                <line x1={x} x2={x} y1={plotY0} y2={plotY1} className="stroke-ink-faint" strokeWidth="1" />
                {scale.ticks.map((tick) => (
                  <g key={tick}>
                    <line x1={x - 3} x2={x} y1={scale.toY(tick)} y2={scale.toY(tick)} className="stroke-ink-faint" />
                    <text x={x - 6} y={scale.toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                      {scale.format(tick)}
                    </text>
                  </g>
                ))}
                {brush && (
                  <rect
                    x={x - 7}
                    y={scale.toY(Math.min(scale.max, brush[1]))}
                    width="14"
                    height={Math.max(2, scale.toY(Math.max(scale.min, brush[0])) - scale.toY(Math.min(scale.max, brush[1])))}
                    rx="3"
                    className="fill-[color-mix(in_oklab,var(--color-accent)_45%,transparent)] stroke-accent-strong"
                  />
                )}
                <rect data-axis={key} x={x - 12} y={plotY0} width="24" height={plotY1 - plotY0} fill="transparent" className="cursor-crosshair" />
              </g>
            )
          })}
        </svg>
        {focus && tipAt && (
          <PlotTip x={tipAt.x} y={tipAt.y} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={focus.label}
              rows={order.map((key) => ({ label: byKey.get(key)!.label, value: scales.get(key)!.format(focus.values[key]) }))}
            />
          </PlotTip>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-[12px] font-semibold text-ink-soft">
          <span className="font-bold text-ink tabular-nums">{selected.length}</span> of {records.length}{' '}
          {records.length === 1 ? noun : `${noun}s`} selected
          {brushCount > 0 && ` · ${brushCount} ${brushCount === 1 ? 'brush' : 'brushes'}`}
        </p>
        {brushCount > 0 && (
          <button type="button" onClick={() => setBrushes({})} className="rounded-full px-2 py-1 text-[12px] font-bold text-ink-soft hover:bg-surface-muted hover:text-ink">
            Clear brushes
          </button>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{`${label}. Selected rows are those inside every brush.`}</caption>
          <thead>
            <tr>
              <th scope="col">{noun}</th>
              {order.map((key) => (
                <th key={key} scope="col">{byKey.get(key)!.label}</th>
              ))}
              <th scope="col">Selected</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <th scope="row">{record.label}</th>
                {order.map((key) => (
                  <td key={key}>{scales.get(key)!.format(record.values[key])}</td>
                ))}
                <td>{inside(record) ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={active !== null && selected[active] ? describe(selected[active]) : ''} />
    </div>
  )
}
