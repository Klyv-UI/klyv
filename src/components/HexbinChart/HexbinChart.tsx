'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatTick } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { Legend } from '../Legend'
import { Slider } from '../Slider'
import { Text } from '../Text'
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
  svgId,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface HexbinChartPoint {
  x: number
  y: number
}

export type HexbinChartScale = 'linear' | 'sqrt' | 'log'

export interface HexbinChartProps {
  /** Tens of thousands is fine: points are counted, not drawn. */
  points: HexbinChartPoint[]
  /** Accessible name for the chart. */
  label: string
  /** Controlled hexagon radius, in viewBox pixels. */
  radius?: number
  /** Hexagon radius when uncontrolled. */
  defaultRadius?: number
  onRadiusChange?: (radius: number) => void
  /** Show the radius slider above the chart. */
  showRadiusControl?: boolean
  /** How counts map to colour. Square root and log keep a few dense bins from washing out the rest. */
  colorScale?: HexbinChartScale
  /** Number of colour steps. */
  steps?: number
  /** Name of the horizontal measure, printed under the axis. */
  xLabel?: string
  /** Name of the vertical measure, printed beside the axis. */
  yLabel?: string
  /** Format x values on the axis and in the tooltip. */
  formatX?: (value: number) => string
  /** Format y values on the axis and in the tooltip. */
  formatY?: (value: number) => string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

const SQRT3 = Math.sqrt(3)
const OFFSET = 4096
const key = (q: number, r: number) => (q + OFFSET) * 8192 + (r + OFFSET)

/** Pixel to axial hex coordinates, pointy-top, rounded through cube coordinates so every pixel lands in exactly one hexagon. */
function axial(px: number, py: number, size: number) {
  const fq = ((SQRT3 / 3) * px - py / 3) / size
  const fr = ((2 / 3) * py) / size
  const fs = -fq - fr
  let q = Math.round(fq)
  let r = Math.round(fr)
  const s = Math.round(fs)
  const dq = Math.abs(q - fq)
  const dr = Math.abs(r - fr)
  const ds = Math.abs(s - fs)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q, r }
}

const centreOf = (q: number, r: number, size: number) => ({ x: size * SQRT3 * (q + r / 2), y: size * 1.5 * r })

/**
 * A scatter plot for when there are too many points to see: the plane is cut
 * into hexagons and each is coloured by how many points fell in it.
 *
 * Past a few thousand points a scatter plot is a solid shape, and adding
 * transparency only moves the problem. Counting is honest at any size, and
 * hexagons rather than squares because every neighbour of a hexagon is the same
 * distance away, so the bins do not draw a grid into the data. Binning happens
 * in screen space, so the radius slider is a real resolution control; 50,000
 * points are counted in a few milliseconds and only the non-empty bins are drawn.
 */
export function HexbinChart({
  points,
  label,
  radius: radiusProp,
  defaultRadius = 10,
  onRadiusChange,
  showRadiusControl = true,
  colorScale = 'sqrt',
  steps = 7,
  xLabel,
  yLabel,
  formatX = formatTick,
  formatY = formatTick,
  height = 320,
  className,
}: HexbinChartProps) {
  const summaryId = useId()
  const sliderId = useId()
  const clipId = svgId(`${summaryId}clip`)
  const drawn = useDrawIn()
  const [radiusState, setRadiusState] = useState(defaultRadius)
  const size = Math.max(3, radiusProp ?? radiusState)
  const setRadius = (next: number) => {
    if (radiusProp === undefined) setRadiusState(next)
    onRadiusChange?.(next)
  }

  const extent = useMemo(() => {
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    let count = 0
    for (const p of points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      count += 1
      if (p.x < x0) x0 = p.x
      if (p.x > x1) x1 = p.x
      if (p.y < y0) y0 = p.y
      if (p.y > y1) y1 = p.y
    }
    return { xs: niceScale(x0, x1, 5), ys: niceScale(y0, y1, 4), count }
  }, [points])

  const { xs, ys } = extent
  const left = gutterFor(ys.ticks, formatY) + (yLabel ? 14 : 0)
  const bottom = 26 + (xLabel ? 14 : 0)
  const plot = { x: left, y: 12, width: PLOT_WIDTH - left - 14, height: height - 12 - bottom }
  const toX = linear(xs.min, xs.max, plot.x, plot.x + plot.width)
  const toY = linear(ys.min, ys.max, plot.y + plot.height, plot.y)
  const fromX = linear(plot.x, plot.x + plot.width, xs.min, xs.max)
  const fromY = linear(plot.y + plot.height, plot.y, ys.min, ys.max)

  const bins = useMemo(() => {
    const counts = new Map<number, { q: number; r: number; count: number }>()
    for (const p of points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      const { q, r } = axial(toX(p.x) - plot.x, toY(p.y) - plot.y, size)
      const k = key(q, r)
      const bin = counts.get(k)
      if (bin) bin.count += 1
      else counts.set(k, { q, r, count: 1 })
    }
    return [...counts.values()]
      .map((bin) => ({ ...bin, ...centreOf(bin.q, bin.r, size) }))
      .sort((a, b) => a.y - b.y || a.x - b.x)
    // toX/toY follow from the extent and the plot size listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, size, extent, plot.width, plot.height, plot.x])
  const lookup = useMemo(() => new Map(bins.map((bin, index) => [key(bin.q, bin.r), index])), [bins])
  const { active, setActive, keyProps } = useChartCursor(bins.length)

  const max = bins.reduce((m, bin) => Math.max(m, bin.count), 0) || 1
  const f = colorScale === 'log' ? (v: number) => Math.log1p(v) : colorScale === 'sqrt' ? Math.sqrt : (v: number) => v
  const inverse = colorScale === 'log' ? (v: number) => Math.expm1(v) : colorScale === 'sqrt' ? (v: number) => v * v : (v: number) => v
  const stepOf = (count: number) => Math.max(0, Math.min(steps - 1, Math.ceil((f(count) / f(max)) * steps) - 1))
  // One luminance ramp across the theme: surface into the accent, then the accent into ink, so the
  // densest bins read as the strongest in light and dark alike rather than stopping at a pale lime.
  const fillOf = (step: number) => {
    const t = (step + 1) / steps
    return t <= 0.6
      ? `color-mix(in oklab, var(--color-accent-strong) ${Math.round(18 + (82 * t) / 0.6)}%, var(--color-surface))`
      : `color-mix(in oklab, var(--color-ink) ${Math.round((60 * (t - 0.6)) / 0.4)}%, var(--color-accent-strong))`
  }
  const stepRange = (step: number) => {
    const low = step === 0 ? 1 : Math.floor(inverse((step / steps) * f(max))) + 1
    const high = step === steps - 1 ? max : Math.floor(inverse(((step + 1) / steps) * f(max)) + 1e-9)
    return low >= high ? String(high) : `${low}–${high}`
  }
  const hex = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30)
    return `${(size * Math.cos(angle)).toFixed(2)} ${(size * Math.sin(angle)).toFixed(2)}`
  })
  const hexPath = `M${hex.join('L')}Z`

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const view = pointerToView(event, PLOT_WIDTH, height)
    const { q, r } = axial(view.x - plot.x, view.y - plot.y, size)
    setActive(lookup.get(key(q, r)) ?? null)
  }

  const bin = active === null ? null : bins[active]
  const cx = bin ? plot.x + bin.x : 0
  const cy = bin ? plot.y + bin.y : 0
  const densest = bins.reduce<(typeof bins)[number] | null>((best, b) => (!best || b.count > best.count ? b : best), null)
  const describe = (b: (typeof bins)[number]) =>
    `${b.count.toLocaleString()} points (${((b.count / (extent.count || 1)) * 100).toFixed(2)}%) around ${xLabel ?? 'x'} ${formatX(fromX(plot.x + b.x))}, ${yLabel ?? 'y'} ${formatY(fromY(plot.y + b.y))}`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {showRadiusControl && (
        <div className="flex items-center gap-3 self-end">
          <label htmlFor={sliderId}>
            <Text as="span" size="caption" weight="semibold" tone="soft">
              Bin radius
            </Text>
          </label>
          <Slider
            id={sliderId}
            min={4}
            max={28}
            step={1}
            value={size}
            aria-valuetext={`${size} pixels, ${bins.length} bins`}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-36"
          />
          <Text as="span" size="caption" weight="bold" tabular className="w-10">
            {`${size}px`}
          </Text>
        </div>
      )}
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${extent.count.toLocaleString()} points in ${bins.length} hexagonal bins; use arrow keys to step through the bins.`}
          aria-describedby={summaryId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={plot.x} y={plot.y} width={plot.width} height={plot.height} />
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
          {xs.ticks.map((tick) => (
            <text key={`x${tick}`} x={toX(tick)} y={plot.y + plot.height + 16} textAnchor="middle" className={TICK_CLASS}>
              {formatX(tick)}
            </text>
          ))}
          {xLabel && (
            <text x={plot.x + plot.width / 2} y={height - 4} textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text transform={`translate(10 ${plot.y + plot.height / 2}) rotate(-90)`} textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold">
              {yLabel}
            </text>
          )}
          <g clipPath={`url(#${clipId})`} className={cn('transition-opacity', DRAW_IN_CLASS)} opacity={drawn ? 1 : 0}>
            {bins.map((b) => (
              <path
                key={key(b.q, b.r)}
                d={hexPath}
                transform={`translate(${(plot.x + b.x).toFixed(2)} ${(plot.y + b.y).toFixed(2)})`}
                fill={fillOf(stepOf(b.count))}
                className="stroke-surface"
                strokeWidth="0.6"
              />
            ))}
          </g>
          {bin && (
            <path d={hexPath} transform={`translate(${cx} ${cy})`} fill="none" className="pointer-events-none stroke-ink" strokeWidth="2" />
          )}
        </svg>
        {bin && (
          <PlotTip x={cx} y={cy} width={PLOT_WIDTH} height={height}>
            <ChartTooltip
              title={`${bin.count.toLocaleString()} ${bin.count === 1 ? 'point' : 'points'}`}
              rows={[
                { label: 'Share', value: `${((bin.count / (extent.count || 1)) * 100).toFixed(2)}%`, color: fillOf(stepOf(bin.count)) },
                { label: xLabel ?? 'x', value: `${formatX(fromX(cx - size))} – ${formatX(fromX(cx + size))}` },
                { label: yLabel ?? 'y', value: `${formatY(fromY(cy + size))} – ${formatY(fromY(cy - size))}` },
              ]}
            />
          </PlotTip>
        )}
      </div>
      <Legend
        label={`${label} count scale`}
        series={Array.from({ length: steps }, (_, step) => ({ label: stepRange(step), color: fillOf(step) })).filter(
          (entry, index, all) => all.findIndex((other) => other.label === entry.label) === index,
        )}
      />
      <VisuallyHidden>
        <p id={summaryId}>
          {`${extent.count.toLocaleString()} points counted into ${bins.length} hexagons of radius ${size}. ${
            densest ? `The densest bin holds ${describe(densest)}.` : ''
          } Colour follows the ${colorScale === 'linear' ? '' : `${colorScale === 'sqrt' ? 'square root' : 'logarithm'} of the `}count.`}
        </p>
      </VisuallyHidden>
      <PlotAnnouncer message={bin ? describe(bin) : ''} />
    </div>
  )
}
