'use client'

import { useId, useMemo, useState } from 'react'
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
  svgId,
  useChartCursor,
  useDrawIn,
} from '../internal/plot'

export interface ContourPlotPoint {
  x: number
  y: number
}

export interface ContourPlotProps {
  points: ContourPlotPoint[]
  /** Accessible name for the chart. */
  label: string
  /** Number of density bands. Band k holds the densest (k − ½) ÷ levels share of points, counted from the core outwards. */
  levels?: number
  /** Multiplier on Scott's rule bandwidth. Below 1 shows more structure, above 1 smooths it away. */
  bandwidth?: number
  /** Density grid resolution per axis. Finer is smoother and slower. */
  gridSize?: number
  /** Draw the observations over the bands. */
  showPoints?: boolean
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

const PAD = { top: 12, right: 14, bottom: 26 }

function std(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, values.length - 1))
}

/**
 * Gaussian KDE on a grid. The kernel is separable, so each point contributes an
 * outer product of two 1-D weight rows — no exp() per grid cell — and only
 * within four bandwidths, where the rest rounds to zero anyway.
 */
function densityGrid(points: ContourPlotPoint[], x0: number, x1: number, y0: number, y1: number, g: number, hx: number, hy: number) {
  const grid = new Float64Array(g * g)
  const dx = (x1 - x0) / (g - 1)
  const dy = (y1 - y0) / (g - 1)
  const wx = new Float64Array(g)
  const wy = new Float64Array(g)
  for (const p of points) {
    const i0 = Math.max(0, Math.floor((p.x - 4 * hx - x0) / dx))
    const i1 = Math.min(g - 1, Math.ceil((p.x + 4 * hx - x0) / dx))
    const j0 = Math.max(0, Math.floor((p.y - 4 * hy - y0) / dy))
    const j1 = Math.min(g - 1, Math.ceil((p.y + 4 * hy - y0) / dy))
    for (let i = i0; i <= i1; i += 1) wx[i] = Math.exp(-0.5 * ((x0 + i * dx - p.x) / hx) ** 2)
    for (let j = j0; j <= j1; j += 1) wy[j] = Math.exp(-0.5 * ((y0 + j * dy - p.y) / hy) ** 2)
    for (let j = j0; j <= j1; j += 1) {
      const row = j * g
      for (let i = i0; i <= i1; i += 1) grid[row + i] += wx[i] * wy[j]
    }
  }
  const norm = 1 / (points.length * 2 * Math.PI * hx * hy)
  for (let k = 0; k < grid.length; k += 1) grid[k] *= norm
  const sample = (x: number, y: number) => {
    const fx = Math.min(g - 1.0001, Math.max(0, (x - x0) / dx))
    const fy = Math.min(g - 1.0001, Math.max(0, (y - y0) / dy))
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const tx = fx - i
    const ty = fy - j
    const at = (a: number, b: number) => grid[b * g + a]
    return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty
  }
  return { grid, sample }
}

// Edges of a cell: 0 bottom (c0–c1), 1 right (c1–c2), 2 top (c3–c2), 3 left (c0–c3).
const CASES: Record<number, [number, number][]> = {
  1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]],
  9: [[0, 2]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
}

/**
 * Marching squares at one threshold, with the grid surrounded by a ring of
 * zeros so every isoline closes into a ring. Saddles (cases 5 and 10) are
 * resolved by the cell's centre value, the average of its corners. Segments are
 * stitched into rings through shared edge ids rather than by matching floating
 * point coordinates, which never quite agree.
 */
function isolines(grid: Float64Array, g: number, t: number) {
  const w = g + 2
  const v = (i: number, j: number) => (i === 0 || j === 0 || i === w - 1 || j === w - 1 ? 0 : grid[(j - 1) * g + (i - 1)])
  const edgeId = (i: number, j: number, e: number) =>
    e === 0 ? (j * w + i) * 2 : e === 2 ? ((j + 1) * w + i) * 2 : e === 3 ? (j * w + i) * 2 + 1 : (j * w + i + 1) * 2 + 1
  const cross = new Map<number, [number, number]>()
  const point = (i: number, j: number, e: number): number => {
    const id = edgeId(i, j, e)
    if (!cross.has(id)) {
      const [a, b] = e === 0 ? [[i, j], [i + 1, j]] : e === 1 ? [[i + 1, j], [i + 1, j + 1]] : e === 2 ? [[i, j + 1], [i + 1, j + 1]] : [[i, j], [i, j + 1]]
      const va = v(a[0], a[1])
      const vb = v(b[0], b[1])
      const f = va === vb ? 0.5 : (t - va) / (vb - va)
      cross.set(id, [a[0] + (b[0] - a[0]) * f - 1, a[1] + (b[1] - a[1]) * f - 1])
    }
    return id
  }
  const segments: [number, number][] = []
  for (let j = 0; j < w - 1; j += 1)
    for (let i = 0; i < w - 1; i += 1) {
      const c0 = v(i, j)
      const c1 = v(i + 1, j)
      const c2 = v(i + 1, j + 1)
      const c3 = v(i, j + 1)
      const code = (c0 >= t ? 1 : 0) | (c1 >= t ? 2 : 0) | (c2 >= t ? 4 : 0) | (c3 >= t ? 8 : 0)
      if (code === 0 || code === 15) continue
      let pairs = CASES[code]
      if (code === 5 || code === 10) {
        const centreIn = (c0 + c1 + c2 + c3) / 4 >= t
        pairs = (code === 5) === centreIn ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]]
      }
      for (const [a, b] of pairs) segments.push([point(i, j, a), point(i, j, b)])
    }
  const byEdge = new Map<number, number[]>()
  segments.forEach(([a, b], index) => {
    byEdge.set(a, [...(byEdge.get(a) ?? []), index])
    byEdge.set(b, [...(byEdge.get(b) ?? []), index])
  })
  const used = new Uint8Array(segments.length)
  const rings: [number, number][][] = []
  for (let s = 0; s < segments.length; s += 1) {
    if (used[s]) continue
    used[s] = 1
    const start = segments[s][0]
    let at = segments[s][1]
    const ring = [cross.get(start)!, cross.get(at)!]
    while (at !== start) {
      const next = (byEdge.get(at) ?? []).find((index) => !used[index])
      if (next === undefined) break
      used[next] = 1
      at = segments[next][0] === at ? segments[next][1] : segments[next][0]
      ring.push(cross.get(at)!)
    }
    rings.push(ring)
  }
  return rings
}

/**
 * Where a cloud of points is dense, drawn as nested bands rather than as the
 * cloud itself.
 *
 * Past a few hundred points a scatter plot turns into a blot, and the one thing
 * it was for — where most of the observations sit — is exactly what overplotting
 * hides. This estimates the density with a Gaussian kernel (bandwidth by Scott's
 * rule) and traces its isolines with marching squares. The levels are chosen by
 * quantiles of the points' own densities, so each band is named by the share
 * of observations it holds — "the densest 50%" — rather than by a density value
 * nobody can interpret.
 */
export function ContourPlot({
  points,
  label,
  levels = 5,
  bandwidth = 1,
  gridSize = 64,
  showPoints = true,
  xLabel,
  yLabel,
  formatX = formatTick,
  formatY = formatTick,
  height = 300,
  className,
}: ContourPlotProps) {
  const summaryId = useId()
  const clipId = svgId(`${summaryId}clip`)
  const drawn = useDrawIn()
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const clean = useMemo(() => points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), [points])

  const model = useMemo(() => {
    if (clean.length < 3) return null
    const xsOf = clean.map((p) => p.x)
    const ysOf = clean.map((p) => p.y)
    const factor = bandwidth * clean.length ** (-1 / 6)
    const hx = Math.max(1e-9, std(xsOf) * factor)
    const hy = Math.max(1e-9, std(ysOf) * factor)
    // The grid hugs the data plus a bandwidth and a half. Rounding it out to nice
    // ticks wasted a third of the plot on empty margin; the zero ring added in
    // marching squares closes any band the edge cuts.
    const xs = { min: Math.min(...xsOf) - 1.5 * hx, max: Math.max(...xsOf) + 1.5 * hx }
    const ys = { min: Math.min(...ysOf) - 1.5 * hy, max: Math.max(...ysOf) + 1.5 * hy }
    const g = Math.max(8, Math.round(gridSize))
    const { grid, sample } = densityGrid(clean, xs.min, xs.max, ys.min, ys.max, g, hx, hy)
    const at = clean.map((p) => sample(p.x, p.y)).sort((a, b) => a - b)
    let peak = 0
    for (const value of grid) if (value > peak) peak = value
    const bands = Array.from({ length: levels }, (_, k) => {
      const share = 1 - (k + 0.5) / levels
      const threshold = at[Math.min(at.length - 1, Math.floor((1 - share) * at.length))]
      const inside = at.filter((value) => value >= threshold).length / at.length
      return { share: inside, threshold, rings: isolines(grid, g, threshold) }
    })
    return { xs, ys, g, bands, sample, peak, hx, hy }
  }, [clean, levels, bandwidth, gridSize])

  const { active, setActive, keyProps } = useChartCursor(model?.bands.length ?? 0)

  const xs = model?.xs ?? { min: 0, max: 1 }
  const ys = model?.ys ?? { min: 0, max: 1 }
  const xTicks = niceScale(xs.min, xs.max, 5).ticks.filter((tick) => tick >= xs.min && tick <= xs.max)
  const yTicks = niceScale(ys.min, ys.max, 4).ticks.filter((tick) => tick >= ys.min && tick <= ys.max)
  const left = gutterFor(yTicks, formatY) + (yLabel ? 14 : 0)
  const bottom = PAD.bottom + (xLabel ? 14 : 0)
  const plot = { x: left, y: PAD.top, width: PLOT_WIDTH - left - PAD.right, height: height - PAD.top - bottom }
  const toX = linear(xs.min, xs.max, plot.x, plot.x + plot.width)
  const toY = linear(ys.min, ys.max, plot.y + plot.height, plot.y)
  const fromView = (x: number, y: number) => ({
    x: linear(plot.x, plot.x + plot.width, xs.min, xs.max)(x),
    y: linear(plot.y + plot.height, plot.y, ys.min, ys.max)(y),
  })
  const g = model?.g ?? 2
  const gridX = linear(0, g - 1, plot.x, plot.x + plot.width)
  const gridY = linear(0, g - 1, plot.y + plot.height, plot.y)
  const ringPath = (rings: [number, number][][]) =>
    rings.map((ring) => `M${ring.map(([i, j]) => `${gridX(i).toFixed(1)} ${gridY(j).toFixed(1)}`).join('L')}Z`).join('')
  // Surface into the accent, then the accent into ink: the core reads darkest in both themes.
  const fillOf = (k: number) => {
    const t = (k + 1) / (model?.bands.length || 1)
    return t <= 0.6
      ? `color-mix(in oklab, var(--color-accent-strong) ${Math.round(20 + (80 * t) / 0.6)}%, var(--color-surface))`
      : `color-mix(in oklab, var(--color-ink) ${Math.round((55 * (t - 0.6)) / 0.4)}%, var(--color-accent-strong))`
  }
  const pctOf = (share: number) => `${Math.round(share * 100)}%`

  const levelAt = (x: number, y: number) => {
    if (!model) return -1
    const density = model.sample(x, y)
    let level = -1
    model.bands.forEach((band, k) => density >= band.threshold && (level = k))
    return level
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const view = pointerToView(event, PLOT_WIDTH, height)
    if (view.x < plot.x || view.x > plot.x + plot.width || view.y < plot.y || view.y > plot.y + plot.height) {
      setHover(null)
      return
    }
    setActive(null)
    setHover(fromView(view.x, view.y))
  }

  const anchorOf = (k: number) => {
    const ring = model?.bands[k].rings.reduce((a, b) => (b.length > a.length ? b : a), [] as [number, number][])
    const top = ring?.reduce((a, b) => (b[1] > a[1] ? b : a), ring[0])
    return top ? { x: gridX(top[0]), y: gridY(top[1]) } : { x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 }
  }

  const hoverLevel = hover ? levelAt(hover.x, hover.y) : -1
  const tip =
    active !== null && model
      ? {
          at: anchorOf(active),
          title: `Band ${active + 1} of ${model.bands.length}`,
          rows: [{ label: 'Holds', value: `${pctOf(model.bands[active].share)} of points`, color: fillOf(active) }],
        }
      : hover && model
        ? {
            at: { x: toX(hover.x), y: toY(hover.y) },
            title: `${xLabel ?? 'x'} ${formatX(hover.x)}, ${yLabel ?? 'y'} ${formatY(hover.y)}`,
            rows: [
              {
                label: 'Region',
                value: hoverLevel < 0 ? 'Outside every band' : `Densest ${pctOf(model.bands[hoverLevel].share)}`,
                ...(hoverLevel >= 0 ? { color: fillOf(hoverLevel) } : {}),
              },
              { label: 'Density', value: `${Math.round((model.sample(hover.x, hover.y) / (model.peak || 1)) * 100)}% of peak` },
            ],
          }
        : null

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${clean.length} points in ${model?.bands.length ?? 0} density bands; use arrow keys to step through the bands.`}
          aria-describedby={summaryId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          {...keyProps}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={plot.x} y={plot.y} width={plot.width} height={plot.height} />
            </clipPath>
          </defs>
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line x1={plot.x} x2={plot.x + plot.width} y1={toY(tick)} y2={toY(tick)} className="stroke-line" strokeWidth="1" />
              <text x={plot.x - 8} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className={TICK_CLASS}>
                {formatY(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
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
          <g clipPath={`url(#${clipId})`}>
            {model?.bands.map((band, k) => (
              <path
                key={k}
                d={ringPath(band.rings)}
                fill={fillOf(k)}
                fillRule="evenodd"
                stroke={active === k ? 'var(--color-ink)' : 'var(--color-accent-strong)'}
                strokeWidth={active === k ? 2 : 0.75}
                className={cn('transition-opacity', DRAW_IN_CLASS)}
                opacity={drawn ? 1 : 0}
                style={{ transitionDelay: drawn ? `${k * 60}ms` : '0ms' }}
              />
            ))}
            {showPoints &&
              clean.map((p, index) => <circle key={index} cx={toX(p.x)} cy={toY(p.y)} r="1.6" className="fill-ink" opacity="0.45" />)}
          </g>
        </svg>
        {tip && (
          <PlotTip x={tip.at.x} y={tip.at.y} width={PLOT_WIDTH} height={height}>
            <ChartTooltip title={tip.title} rows={tip.rows} />
          </PlotTip>
        )}
      </div>
      {model && (
        <Legend
          label={`${label} density bands`}
          series={model.bands.map((band, k) => ({ label: `Densest ${pctOf(band.share)}`, color: fillOf(k) }))}
        />
      )}
      <VisuallyHidden>
        <p id={summaryId}>
          {model
            ? `${clean.length} observations. Gaussian kernel density, bandwidth ${formatX(model.hx)} by ${formatY(model.hy)} (Scott's rule${bandwidth === 1 ? '' : ` × ${bandwidth}`}). ${model.bands
                .map((band, k) => `Band ${k + 1} holds the densest ${pctOf(band.share)} of points.`)
                .join(' ')}`
            : 'Too few points to estimate a density.'}
        </p>
      </VisuallyHidden>
      <PlotAnnouncer message={tip && active !== null ? `${tip.title}: ${tip.rows[0].value}` : ''} />
    </div>
  )
}
