'use client'

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Switch } from '../Switch'
import { ChartTooltip } from '../ChartTooltip'
import { DRAW_IN_CLASS, PlotAnnouncer, PlotTip, useChartCursor, useDrawIn } from '../internal/plot'

export interface ClickHeatmapPoint {
  /** Position in the coordinate space set by `width` and `height` — usually page pixels. */
  x: number
  y: number
  /** Counts as this many clicks. Defaults to 1. */
  weight?: number
}

export interface ClickHeatmapProps {
  points: ClickHeatmapPoint[]
  /** Width of the coordinate space the points were recorded in. */
  width: number
  /** Height of the coordinate space. The heat map keeps this aspect ratio. */
  height: number
  /** Accessible name — say which page and which period. */
  label: string
  /** What was clicked: a screenshot, a wireframe, the real component. Drawn beneath the heat. */
  children?: ReactNode
  /** Kernel radius (one standard deviation) in coordinate units. Larger blends clicks into regions. */
  radius?: number
  /** Multiplies the heat before it is coloured; above 1, quieter areas show sooner. */
  intensity?: number
  /** Draw each click as a dot. Controlled. */
  showPoints?: boolean
  /** Initial dot visibility when uncontrolled. */
  defaultShowPoints?: boolean
  onShowPointsChange?: (show: boolean) => void
  /** How many hotspots to name in the summary. */
  hotspots?: number
  /** Merged last, so it wins. */
  className?: string
}

/** The ramp, coolest to hottest, as token names and the alpha each stop is drawn at. */
const RAMP: [number, string, number][] = [
  [0, '--color-success', 0],
  [0.3, '--color-success', 0.5],
  [0.55, '--color-accent-strong', 0.68],
  [0.78, '--color-warning', 0.8],
  [1, '--color-danger', 0.88],
]

/**
 * Sums a Gaussian kernel per click into a grid `cols` wide. Each kernel is cut
 * off at three standard deviations, past which it adds under 1% — that cut is
 * what keeps a few thousand clicks fast enough to redraw on resize.
 */
export function clickHeatmapDensity(points: ClickHeatmapPoint[], cols: number, rows: number, width: number, height: number, radius: number) {
  const buffer = new Float32Array(cols * rows)
  const sx = cols / width
  const sy = rows / height
  const sigma = Math.max(0.5, radius * sx)
  const reach = Math.ceil(sigma * 3)
  const denominator = 2 * sigma * sigma
  let max = 0
  for (const point of points) {
    const weight = point.weight ?? 1
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !(weight > 0)) continue
    const cx = point.x * sx
    const cy = point.y * sy
    for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(rows - 1, Math.ceil(cy + reach)); y += 1) {
      for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(cols - 1, Math.ceil(cx + reach)); x += 1) {
        const index = y * cols + x
        buffer[index] += weight * Math.exp(-((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / denominator)
        if (buffer[index] > max) max = buffer[index]
      }
    }
  }
  return { buffer, max }
}

/** Resolves every ramp stop to RGBA and interpolates a 256-entry lookup table. */
function rampTable(element: Element) {
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!probe) return null
  const styles = getComputedStyle(element)
  const stops = RAMP.map(([at, token, alpha]) => {
    probe.clearRect(0, 0, 1, 1)
    probe.fillStyle = styles.getPropertyValue(token).trim() || 'currentColor'
    probe.fillRect(0, 0, 1, 1)
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
    return { at, rgb: [r, g, b], alpha }
  })
  const table = new Uint8ClampedArray(256 * 4)
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255
    const upper = stops.findIndex((stop) => stop.at >= t)
    const b = stops[Math.max(0, upper)]
    const a = stops[Math.max(0, upper - 1)]
    const f = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at)
    for (let c = 0; c < 3; c += 1) table[i * 4 + c] = a.rgb[c] + (b.rgb[c] - a.rgb[c]) * f
    table[i * 4 + 3] = (a.alpha + (b.alpha - a.alpha) * f) * 255
  }
  return table
}

const place = (fx: number, fy: number) =>
  `${fy < 1 / 3 ? 'top' : fy < 2 / 3 ? 'middle' : 'bottom'} ${fx < 1 / 3 ? 'left' : fx < 2 / 3 ? 'centre' : 'right'}`.replace('middle centre', 'centre')

/**
 * Where people click, as heat over the thing they clicked on.
 *
 * Dots stop being readable past a few hundred clicks — they pile up into one
 * blot and the densest area looks no darker than a busy one. So every click
 * adds a Gaussian kernel to an intensity buffer, the buffer is normalised to
 * its peak, and each value is mapped through a ramp built from the status
 * tokens and drawn on a canvas. The ramp is read from the theme on every draw,
 * so the heat follows light and dark and the accent.
 *
 * The dots can be switched back on, and the hottest spots are named in words —
 * where they are and what share of clicks landed near them — because the
 * picture alone says nothing to someone who cannot see it.
 */
export function ClickHeatmap({
  points,
  width,
  height,
  label,
  children,
  radius = 36,
  intensity = 1,
  showPoints: showProp,
  defaultShowPoints = false,
  onShowPointsChange,
  hotspots: hotspotCount = 3,
  className,
}: ClickHeatmapProps) {
  const listId = useId()
  const drawn = useDrawIn()
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ownShow, setOwnShow] = useState(defaultShowPoints)
  const [unsupported, setUnsupported] = useState(false)
  const [frameWidth, setFrameWidth] = useState(0)
  const [theme, setTheme] = useState(0)
  const show = showProp ?? ownShow

  const total = points.reduce((sum, point) => sum + (point.weight ?? 1), 0)

  // Hotspots come from a coarse grid computed here rather than from the canvas,
  // so the summary exists even where the canvas does not.
  const spots = useMemo(() => {
    const cols = 96
    const rows = Math.max(1, Math.round((cols * height) / width))
    const { buffer, max } = clickHeatmapDensity(points, cols, rows, width, height, radius)
    const order = Array.from(buffer.keys()).sort((a, b) => buffer[b] - buffer[a])
    const found: { x: number; y: number; share: number }[] = []
    for (const index of order) {
      if (found.length >= hotspotCount || buffer[index] < max * 0.2) break
      const x = ((index % cols) + 0.5) * (width / cols)
      const y = (Math.floor(index / cols) + 0.5) * (height / rows)
      if (found.some((spot) => Math.hypot(spot.x - x, spot.y - y) < radius * 3)) continue
      const near = points.reduce((sum, p) => sum + (Math.hypot(p.x - x, p.y - y) <= radius * 2 ? p.weight ?? 1 : 0), 0)
      found.push({ x, y, share: total ? near / total : 0 })
    }
    return found
  }, [points, width, height, radius, hotspotCount, total])

  const { active, setActive, keyProps } = useChartCursor(spots.length)
  const spot = active === null ? null : spots[active]

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setFrameWidth(Math.round(entry.contentRect.width)))
    observer.observe(frame)
    setFrameWidth(Math.round(frame.getBoundingClientRect().width))
    return () => observer.disconnect()
  }, [])

  // The ramp comes from tokens, so redraw when the theme or accent changes.
  useEffect(() => {
    const bump = () => setTheme((value) => value + 1)
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(bump)
    observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    query?.addEventListener?.('change', bump)
    return () => {
      observer?.disconnect()
      query?.removeEventListener?.('change', bump)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    const table = context ? rampTable(canvas) : null
    if (!context || !table) {
      setUnsupported(true)
      return
    }
    const cols = Math.max(32, Math.min(480, frameWidth || 320))
    const rows = Math.max(1, Math.round((cols * height) / width))
    canvas.width = cols
    canvas.height = rows
    const { buffer, max } = clickHeatmapDensity(points, cols, rows, width, height, radius)
    const image = context.createImageData(cols, rows)
    const scale = max > 0 ? intensity / max : 0
    for (let i = 0; i < buffer.length; i += 1) {
      const level = Math.min(255, Math.round(buffer[i] * scale * 255)) * 4
      image.data[i * 4] = table[level]
      image.data[i * 4 + 1] = table[level + 1]
      image.data[i * 4 + 2] = table[level + 2]
      image.data[i * 4 + 3] = table[level + 3]
    }
    context.putImageData(image, 0, 0)
  }, [points, width, height, radius, intensity, frameWidth, theme])

  const setShow = (next: boolean) => {
    if (showProp === undefined) setOwnShow(next)
    onShowPointsChange?.(next)
  }
  const dots = show || unsupported
  const sentence = (entry: (typeof spots)[number], rank: number) =>
    `${rank === 0 ? 'Hottest' : `Hotspot ${rank + 1}`}: ${place(entry.x / width, entry.y / height)}, ${Math.round((entry.share || 0) * 100)}% of clicks nearby`
  const ramp = `linear-gradient(to right, ${RAMP.map(([at, token, alpha]) => `color-mix(in oklab, var(${token}) ${Math.round(alpha * 100)}%, transparent) ${at * 100}%`).join(', ')})`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-[var(--radius-glyph)] border border-line bg-surface-sunken"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <div className="absolute inset-0">{children}</div>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={cn('pointer-events-none absolute inset-0 size-full transition-opacity', DRAW_IN_CLASS, drawn ? 'opacity-100' : 'opacity-0')}
        />
        <svg
          role="img"
          aria-label={`${label}. ${total} clicks; use arrow keys to step through the hotspots.`}
          aria-describedby={listId}
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 size-full outline-offset-[-2px]"
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {dots &&
            points.map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r={Math.max(2, width / 320)} className="fill-ink stroke-surface" strokeWidth={width / 900} opacity="0.7" />
            ))}
          {spots.map((entry, index) => (
            <circle
              key={`${entry.x}-${entry.y}`}
              cx={entry.x}
              cy={entry.y}
              r={radius * 2}
              fill="transparent"
              className={active === index ? 'stroke-ink' : 'stroke-transparent'}
              strokeWidth={width / 300}
              strokeDasharray={`${width / 120} ${width / 180}`}
              onPointerEnter={() => setActive(index)}
            />
          ))}
        </svg>
        {spot && active !== null && (
          <PlotTip x={spot.x} y={spot.y - radius * 2} width={width} height={height}>
            <ChartTooltip title={active === 0 ? 'Hottest spot' : `Hotspot ${active + 1}`} rows={[{ label: 'Where', value: place(spot.x / width, spot.y / height) }, { label: 'Clicks nearby', value: `${Math.round(spot.share * 100)}%` }]} />
          </PlotTip>
        )}
        {unsupported && (
          <p className="absolute inset-x-3 bottom-3 rounded-[var(--radius-glyph)] bg-surface px-3 py-2 text-[12px] font-medium text-ink-soft shadow-[var(--shadow-tile)]">
            This browser cannot draw the heat layer, so each click is shown as a dot instead.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={dots} disabled={unsupported} onChange={(event) => setShow(event.target.checked)} />
          Show each click
        </label>
        <div className="flex items-center gap-2 text-[11px] font-medium text-ink-faint" aria-hidden="true">
          Fewer
          <span className="h-2 w-28 rounded-full border border-line" style={{ background: ramp }} />
          More clicks
        </div>
      </div>

      <ol id={listId} className="flex flex-col gap-0.5 text-[12px] font-medium text-ink-soft">
        {spots.length === 0 && <li>No clicks recorded yet.</li>}
        {spots.map((entry, index) => (
          <li key={`${entry.x}-${entry.y}`}>{sentence(entry, index)}</li>
        ))}
      </ol>
      <PlotAnnouncer message={spot && active !== null ? sentence(spot, active) : ''} />
    </div>
  )
}
