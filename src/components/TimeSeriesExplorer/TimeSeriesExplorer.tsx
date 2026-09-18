'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { formatTick, SERIES_COLORS } from '../../lib/chart'
import { Button } from '../Button'
import { ChartTooltip } from '../ChartTooltip'
import { IconButton } from '../IconButton'
import { Legend } from '../Legend'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { MinusIcon, PlusIcon } from '../internal/icons'
import { DRAW_IN_CLASS, PlotAnnouncer, PlotTip, TICK_CLASS, gutterFor, linear, niceScale, svgId, useDrawIn } from '../internal/plot'

export interface TimeSeriesExplorerSeries {
  id: string
  label: string
  /** Sample positions, ascending — usually epoch milliseconds. A Float64Array is fine and cheaper. */
  x: ArrayLike<number>
  /** One value per position. */
  y: ArrayLike<number>
  /** Any CSS colour. Defaults walk SERIES_COLORS. */
  color?: string
}

/** A span of the x axis, low end first. */
export type TimeSeriesExplorerRange = [number, number]

export interface TimeSeriesExplorerProps {
  /** One entry per line. Every series may have its own sample positions. */
  series: TimeSeriesExplorerSeries[]
  /** Accessible name for the chart. */
  label: string
  /** Controlled visible range of the detail view. */
  range?: TimeSeriesExplorerRange
  /** Visible range when uncontrolled. Defaults to everything. */
  defaultRange?: TimeSeriesExplorerRange
  /** Called on every brush, zoom or pan. */
  onRangeChange?: (range: TimeSeriesExplorerRange) => void
  /** Detail plot height in pixels. */
  height?: number
  /** Overview strip height in pixels. */
  overviewHeight?: number
  /** Format x positions on the axis and in the tooltip. */
  formatX?: (value: number) => string
  /** Format values on the axis and in the tooltip. */
  formatY?: (value: number) => string
  /** Show the series key when there is more than one series. */
  showLegend?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const PAD = { top: 10, right: 12, bottom: 24 }

function lowerBound(xs: ArrayLike<number>, value: number) {
  let lo = 0
  let hi = xs.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (xs[mid] < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Index of the raw sample closest to `value`. */
function nearest(xs: ArrayLike<number>, value: number) {
  const index = lowerBound(xs, value)
  if (index <= 0) return 0
  if (index >= xs.length) return xs.length - 1
  return value - xs[index - 1] <= xs[index] - value ? index - 1 : index
}

/**
 * Largest-Triangle-Three-Buckets (Steinarsson, 2013). Keeps the first and last
 * sample, splits the rest into `threshold - 2` buckets, and from each keeps the
 * sample forming the largest triangle with the previously kept one and the next
 * bucket's average. Peaks survive, which a stride or a bucket mean would erase.
 */
function lttb(xs: ArrayLike<number>, ys: ArrayLike<number>, start: number, end: number, threshold: number) {
  const count = end - start
  const out: number[] = []
  if (count <= 0) return out
  if (threshold >= count || threshold < 3) {
    for (let index = start; index < end; index += 1) if (Number.isFinite(ys[index])) out.push(index)
    return out
  }
  const every = (count - 2) / (threshold - 2)
  let a = start
  out.push(a)
  for (let bucket = 0; bucket < threshold - 2; bucket += 1) {
    const avgStart = start + Math.floor((bucket + 1) * every) + 1
    const avgEnd = Math.min(start + Math.floor((bucket + 2) * every) + 1, end)
    let avgX = 0
    let avgY = 0
    let seen = 0
    for (let index = avgStart; index < avgEnd; index += 1) {
      if (!Number.isFinite(ys[index])) continue
      avgX += xs[index]
      avgY += ys[index]
      seen += 1
    }
    if (seen === 0) {
      avgX = xs[Math.min(avgStart, end - 1)]
      avgY = ys[a]
    } else {
      avgX /= seen
      avgY /= seen
    }
    const from = start + Math.floor(bucket * every) + 1
    const to = Math.min(start + Math.floor((bucket + 1) * every) + 1, end)
    let best = -1
    let bestArea = -1
    for (let index = from; index < to; index += 1) {
      const area = Math.abs((xs[a] - avgX) * (ys[index] - ys[a]) - (xs[a] - xs[index]) * (avgY - ys[a]))
      if (area > bestArea) {
        bestArea = area
        best = index
      }
    }
    if (best >= 0) {
      out.push(best)
      a = best
    }
  }
  out.push(end - 1)
  return out
}

function pathOf(xs: ArrayLike<number>, ys: ArrayLike<number>, indices: number[], toX: (v: number) => number, toY: (v: number) => number) {
  let d = ''
  let pen = false
  for (const index of indices) {
    const value = ys[index]
    if (!Number.isFinite(value)) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${toX(xs[index]).toFixed(1)} ${toY(value).toFixed(1)}`
    pen = true
  }
  return d
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => node.clientWidth > 0 && setWidth(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

/**
 * A long time series you can actually read: a detail view drawn at the pixel
 * width, an overview of the whole span with a brush that sets what the detail
 * shows, and zoom, pan and reset.
 *
 * Neither view draws every sample. Each is downsampled with LTTB to one point
 * per pixel column of its own width, so 100,000 samples cost the same to draw as
 * 600 and the spikes that matter are the points LTTB keeps. The tooltip does not
 * trust the downsampled line: it binary-searches the raw samples for the one
 * nearest the cursor, so the value you read is a value that was recorded.
 */
export function TimeSeriesExplorer({
  series,
  label,
  range: rangeProp,
  defaultRange,
  onRangeChange,
  height = 240,
  overviewHeight = 56,
  formatX = formatTick,
  formatY = formatTick,
  showLegend = true,
  className,
}: TimeSeriesExplorerProps) {
  const summaryId = useId()
  const clipId = svgId(`${summaryId}clip`)
  const drawn = useDrawIn()
  const { ref: frameRef, width } = useWidth<HTMLDivElement>(640)
  const detailRef = useRef<SVGSVGElement>(null)

  const resolved = series.map((entry, index) => ({
    ...entry,
    color: entry.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
  }))

  let fullMin = Infinity
  let fullMax = -Infinity
  for (const entry of resolved) {
    if (entry.x.length === 0) continue
    fullMin = Math.min(fullMin, entry.x[0])
    fullMax = Math.max(fullMax, entry.x[entry.x.length - 1])
  }
  if (!Number.isFinite(fullMin)) {
    fullMin = 0
    fullMax = 1
  }
  if (fullMax === fullMin) fullMax = fullMin + 1
  const fullSpan = fullMax - fullMin
  const minSpan = fullSpan / 5000

  const clamp = ([a, b]: TimeSeriesExplorerRange): TimeSeriesExplorerRange => {
    let low = Math.min(a, b)
    let high = Math.max(a, b)
    let span = Math.min(fullSpan, Math.max(minSpan, high - low))
    if (high - low !== span) {
      const mid = (low + high) / 2
      low = mid - span / 2
      high = mid + span / 2
    }
    span = high - low
    if (low < fullMin) [low, high] = [fullMin, fullMin + span]
    if (high > fullMax) [low, high] = [fullMax - span, fullMax]
    return [Math.max(fullMin, low), Math.min(fullMax, high)]
  }

  const [rangeState, setRangeState] = useState<TimeSeriesExplorerRange | undefined>(defaultRange)
  const range = clamp(rangeProp ?? rangeState ?? [fullMin, fullMax])
  const span = range[1] - range[0]
  const setRange = (next: TimeSeriesExplorerRange) => {
    const value = clamp(next)
    if (rangeProp === undefined) setRangeState(value)
    onRangeChange?.(value)
  }
  const zoom = (factor: number, centre = (range[0] + range[1]) / 2) => {
    const next = Math.min(fullSpan, Math.max(minSpan, span * factor))
    const ratio = (centre - range[0]) / span
    setRange([centre - ratio * next, centre - ratio * next + next])
  }

  /* ---------------------------------------------------------- detail view */

  const visible = useMemo(() => {
    let low = Infinity
    let high = -Infinity
    const lines = series.map((entry) => {
      const start = Math.max(0, lowerBound(entry.x, range[0]) - 1)
      const end = Math.min(entry.x.length, lowerBound(entry.x, range[1]) + 1)
      for (let index = start; index < end; index += 1) {
        const value = entry.y[index]
        if (value < low) low = value
        if (value > high) high = value
      }
      return { start, end, count: Math.max(0, end - start) }
    })
    return { lines, low, high }
  }, [series, range[0], range[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  const ys = niceScale(visible.low, visible.high, 4)
  const left = gutterFor(ys.ticks, formatY)
  const plot = { x: left, y: PAD.top, width: Math.max(1, width - left - PAD.right), height: Math.max(1, height - PAD.top - PAD.bottom) }
  const toX = linear(range[0], range[1], plot.x, plot.x + plot.width)
  const toY = linear(ys.min, ys.max, plot.y + plot.height, plot.y)
  const fromX = linear(plot.x, plot.x + plot.width, range[0], range[1])
  const tickCount = Math.max(2, Math.floor(plot.width / 110))
  const xTicks = Array.from({ length: tickCount + 1 }, (_, index) => range[0] + (span * index) / tickCount)

  const detailPaths = useMemo(
    () =>
      resolved.map((entry, index) => {
        const { start, end } = visible.lines[index]
        const kept = lttb(entry.x, entry.y, start, end, Math.round(plot.width))
        return { entry, d: pathOf(entry.x, entry.y, kept, toX, toY), kept: kept.length }
      }),
    // toX/toY are derived from the values listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, visible, plot.width, plot.x, ys.min, ys.max, height],
  )

  /* -------------------------------------------------------- overview strip */

  const overview = useMemo(() => {
    let low = Infinity
    let high = -Infinity
    for (const entry of series) for (let index = 0; index < entry.y.length; index += 1) {
      const value = entry.y[index]
      if (value < low) low = value
      if (value > high) high = value
    }
    const oy = linear(Number.isFinite(low) ? low : 0, Number.isFinite(high) ? high : 1, overviewHeight - 4, 4)
    const ox = linear(fullMin, fullMax, 0, width)
    return series.map((entry) => pathOf(entry.x, entry.y, lttb(entry.x, entry.y, 0, entry.x.length, Math.round(width)), ox, oy))
  }, [series, width, overviewHeight, fullMin, fullMax])

  const brushLeft = ((range[0] - fullMin) / fullSpan) * 100
  const brushWidth = (span / fullSpan) * 100
  const drag = useRef<{ mode: 'start' | 'end' | 'move' | 'new' | 'pan'; x0: number; from: TimeSeriesExplorerRange } | null>(null)

  const onOverviewDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const value = fullMin + (px / (rect.width || 1)) * fullSpan
    const a = ((range[0] - fullMin) / fullSpan) * rect.width
    const b = ((range[1] - fullMin) / fullSpan) * rect.width
    const mode = Math.abs(px - a) <= 7 ? 'start' : Math.abs(px - b) <= 7 ? 'end' : px > a && px < b ? 'move' : 'new'
    drag.current = { mode, x0: value, from: range }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onOverviewMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    const rect = event.currentTarget.getBoundingClientRect()
    const value = fullMin + ((event.clientX - rect.left) / (rect.width || 1)) * fullSpan
    const [a, b] = state.from
    if (state.mode === 'start') setRange([Math.min(value, b - minSpan), b])
    else if (state.mode === 'end') setRange([a, Math.max(value, a + minSpan)])
    else if (state.mode === 'move') setRange([a + value - state.x0, b + value - state.x0])
    else if (Math.abs(value - state.x0) > minSpan) setRange([state.x0, value])
  }

  const onDetailDown = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    drag.current = { mode: 'pan', x0: event.clientX - rect.left, from: range }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const [cursor, setCursor] = useState<number | null>(null)
  const onDetailMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = width / (rect.width || 1)
    const px = (event.clientX - rect.left) * scale
    const state = drag.current
    if (state?.mode === 'pan') {
      const shift = ((px - state.x0 * scale) / plot.width) * (state.from[1] - state.from[0])
      setRange([state.from[0] - shift, state.from[1] - shift])
      return
    }
    setCursor(px >= plot.x && px <= plot.x + plot.width ? fromX(px) : null)
  }

  // Wheel zoom needs a non-passive listener, or the page scrolls as well.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const geometryRef = useRef({ fromX, width })
  geometryRef.current = { fromX, width }
  useEffect(() => {
    const node = detailRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      const px = ((event.clientX - rect.left) / (rect.width || 1)) * geometryRef.current.width
      zoomRef.current(event.deltaY > 0 ? 1.25 : 0.8, geometryRef.current.fromX(px))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  const onDetailKey = (event: KeyboardEvent<SVGSVGElement>) => {
    const step = span / 60
    const at = cursor ?? (range[0] + range[1]) / 2
    const move = (next: number) => {
      if (next < range[0]) setRange([next, next + span])
      else if (next > range[1]) setRange([next - span, next])
      setCursor(Math.min(fullMax, Math.max(fullMin, next)))
    }
    switch (event.key) {
      case 'ArrowRight':
        move(at + step * (event.shiftKey ? 10 : 1))
        break
      case 'ArrowLeft':
        move(at - step * (event.shiftKey ? 10 : 1))
        break
      case 'PageDown':
        setRange([range[0] + span / 2, range[1] + span / 2])
        break
      case 'PageUp':
        setRange([range[0] - span / 2, range[1] - span / 2])
        break
      case 'Home':
        setCursor(range[0])
        break
      case 'End':
        setCursor(range[1])
        break
      case '+':
      case '=':
        zoom(0.5, at)
        break
      case '-':
      case '_':
        zoom(2, at)
        break
      case '0':
        setRange([fullMin, fullMax])
        break
      case 'Escape':
        if (cursor === null) return
        setCursor(null)
        break
      default:
        return
    }
    event.preventDefault()
  }

  const brushKey = (part: 'start' | 'end' | 'move') => (event: KeyboardEvent<HTMLDivElement>) => {
    const unit = (part === 'move' ? span / 10 : fullSpan / 100) * (event.shiftKey ? 10 : 1)
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? unit : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -unit : 0
    let next: TimeSeriesExplorerRange | null = null
    if (delta !== 0) {
      if (part === 'start') next = [Math.min(range[0] + delta, range[1] - minSpan), range[1]]
      else if (part === 'end') next = [range[0], Math.max(range[1] + delta, range[0] + minSpan)]
      else next = [range[0] + delta, range[1] + delta]
    } else if (event.key === 'Home') next = part === 'end' ? [range[0], range[0] + minSpan] : [fullMin, part === 'move' ? fullMin + span : range[1]]
    else if (event.key === 'End') next = part === 'start' ? [range[1] - minSpan, range[1]] : [part === 'move' ? fullMax - span : range[0], fullMax]
    if (!next) return
    event.preventDefault()
    setRange(next)
  }

  const hits =
    cursor === null
      ? []
      : resolved
          .filter((entry) => entry.x.length > 0)
          .map((entry) => {
            const index = nearest(entry.x, cursor)
            return { entry, x: entry.x[index], y: entry.y[index] }
          })
  const tipX = cursor === null ? 0 : toX(cursor)
  const tipY = hits.length ? Math.min(...hits.map((hit) => toY(hit.y))) : 0
  const total = series.reduce((sum, entry) => sum + entry.x.length, 0)
  const rangeText = `${formatX(range[0])} to ${formatX(range[1])}`
  const sliderBase = { role: 'slider', 'aria-valuemin': fullMin, 'aria-valuemax': fullMax } as const
  const handle =
    'absolute top-0 h-full w-3 -translate-x-1/2 cursor-ew-resize outline-offset-0 before:absolute before:inset-y-2 before:left-1/2 before:w-1 before:-translate-x-1/2 before:rounded-full before:bg-ink-soft'

  return (
    <div ref={frameRef} className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text size="caption" weight="semibold" tone="soft" tabular>
          {rangeText}
        </Text>
        <div className="flex items-center gap-1">
          <IconButton icon={PlusIcon} label="Zoom in" size="xs" tone="muted" onClick={() => zoom(0.5)} disabled={span <= minSpan * 1.01} />
          <IconButton icon={MinusIcon} label="Zoom out" size="xs" tone="muted" onClick={() => zoom(2)} disabled={span >= fullSpan * 0.999} />
          <Button size="sm" variant="ghost" onClick={() => setRange([fullMin, fullMax])} disabled={span >= fullSpan * 0.999}>
            Reset
          </Button>
        </div>
      </div>

      <div className="relative w-full">
        <svg
          ref={detailRef}
          role="img"
          aria-label={`${label}. Showing ${rangeText}. Arrow keys move the cursor, plus and minus zoom, Page Up and Page Down pan, 0 resets.`}
          aria-describedby={summaryId}
          viewBox={`0 0 ${width} ${height}`}
          tabIndex={0}
          className="w-full cursor-grab touch-none select-none rounded-[var(--radius-glyph)] outline-offset-2 active:cursor-grabbing"
          onPointerDown={onDetailDown}
          onPointerMove={onDetailMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onPointerLeave={() => !drag.current && setCursor(null)}
          onKeyDown={onDetailKey}
          onBlur={() => setCursor(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={plot.x} y={plot.y - 2} width={plot.width} height={plot.height + 4} />
            </clipPath>
          </defs>
          {ys.ticks.map((tick) => (
            <g key={`y${tick}`}>
              <line x1={plot.x} x2={plot.x + plot.width} y1={toY(tick)} y2={toY(tick)} className="stroke-line" strokeWidth="1" />
              <text x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {formatY(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick, index) => (
            <text
              key={`x${index}`}
              x={toX(tick)}
              y={plot.y + plot.height + 16}
              textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}
              className={TICK_CLASS}
            >
              {formatX(tick)}
            </text>
          ))}
          <g clipPath={`url(#${clipId})`}>
            {detailPaths.map(({ entry, d }) => (
              <path
                key={entry.id}
                d={d}
                fill="none"
                stroke={entry.color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                className={cn('transition-opacity', DRAW_IN_CLASS)}
                opacity={drawn ? 1 : 0}
              />
            ))}
          </g>
          {cursor !== null && (
            <g pointerEvents="none">
              <line x1={tipX} x2={tipX} y1={plot.y} y2={plot.y + plot.height} className="stroke-ink-faint" strokeWidth="1" />
              {hits.map((hit) => (
                <circle key={hit.entry.id} cx={toX(hit.x)} cy={toY(hit.y)} r="3.5" fill={hit.entry.color} className="stroke-surface" strokeWidth="1.5" />
              ))}
            </g>
          )}
        </svg>
        {cursor !== null && hits.length > 0 && (
          <PlotTip x={tipX} y={tipY} width={width} height={height}>
            <ChartTooltip
              title={formatX(hits[0].x)}
              rows={hits.map((hit) => ({ label: hit.entry.label, value: formatY(hit.y), color: hit.entry.color }))}
            />
          </PlotTip>
        )}
      </div>

      <div
        className="relative w-full touch-none select-none overflow-hidden rounded-[var(--radius-glyph)] border border-line bg-surface-sunken"
        style={{ height: overviewHeight }}
        onPointerDown={onOverviewDown}
        onPointerMove={onOverviewMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <svg aria-hidden="true" viewBox={`0 0 ${width} ${overviewHeight}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
          {overview.map((d, index) => (
            <path key={resolved[index].id} d={d} fill="none" stroke={resolved[index].color} strokeWidth="1" opacity="0.7" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 bg-surface/70" style={{ width: `${brushLeft}%` }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 bg-surface/70" style={{ width: `${100 - brushLeft - brushWidth}%` }} />
        <div
          {...sliderBase}
          tabIndex={0}
          aria-label="Visible window"
          aria-valuenow={(range[0] + range[1]) / 2}
          aria-valuetext={rangeText}
          className="absolute inset-y-0 cursor-grab border-x border-ink-soft bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] outline-offset-[-2px]"
          style={{ left: `${brushLeft}%`, width: `${brushWidth}%` }}
          onKeyDown={brushKey('move')}
        />
        <div {...sliderBase} tabIndex={0} aria-label="Range start" aria-valuenow={range[0]} aria-valuetext={formatX(range[0])} className={handle} style={{ left: `${brushLeft}%` }} onKeyDown={brushKey('start')} />
        <div {...sliderBase} tabIndex={0} aria-label="Range end" aria-valuenow={range[1]} aria-valuetext={formatX(range[1])} className={handle} style={{ left: `${brushLeft + brushWidth}%` }} onKeyDown={brushKey('end')} />
      </div>

      {showLegend && resolved.length > 1 && (
        <Legend label={`${label} series`} series={resolved.map((entry) => ({ label: entry.label, color: entry.color }))} />
      )}

      <VisuallyHidden>
        <p id={summaryId}>
          {`${total.toLocaleString()} samples across ${series.length} series from ${formatX(fullMin)} to ${formatX(fullMax)}, drawn at one point per pixel. `}
          {detailPaths.map(({ entry }, index) => {
            const { start, end, count } = visible.lines[index]
            let low = Infinity
            let high = -Infinity
            for (let i = start; i < end; i += 1) {
              if (entry.y[i] < low) low = entry.y[i]
              if (entry.y[i] > high) high = entry.y[i]
            }
            return count > 0 ? `${entry.label}: ${count.toLocaleString()} samples in view, low ${formatY(low)}, high ${formatY(high)}. ` : `${entry.label}: no samples in view. `
          })}
        </p>
      </VisuallyHidden>
      <PlotAnnouncer message={hits.length ? `${formatX(hits[0].x)}: ${hits.map((hit) => `${hit.entry.label} ${formatY(hit.y)}`).join(', ')}` : ''} />
    </div>
  )
}
