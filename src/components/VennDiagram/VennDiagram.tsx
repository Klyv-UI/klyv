'use client'

import { useId, useMemo } from 'react'
import { cn } from '../../lib/cn'
import { formatTick, SERIES_COLORS } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PLOT_WIDTH, PlotAnnouncer, PlotTip, pointerToView, svgId, useChartCursor, useDrawIn } from '../internal/plot'

export interface VennDiagramSet {
  id: string
  label: string
  /** Everything in the set, overlaps included. */
  size: number
  /** Any CSS colour. Defaults walk SERIES_COLORS. */
  color?: string
}

export interface VennDiagramIntersection {
  /** Two or three set ids. */
  sets: string[]
  /** Everything in all of those sets — inclusive, so A∩B counts A∩B∩C too. */
  size: number
}

export interface VennDiagramProps {
  /** Two or three sets. Extra sets are ignored. */
  sets: VennDiagramSet[]
  /** Overlap sizes. A missing pair means those sets do not overlap. */
  intersections: VennDiagramIntersection[]
  /** Accessible name for the diagram. */
  label: string
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Format counts in regions, the tooltip and the table. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

/** Area shared by two circles whose centres are `d` apart. */
export function vennDiagramOverlap(r1: number, r2: number, d: number) {
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1))
  const b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2))
  const c = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2))
  return a + b - c
}

/** The centre distance giving `overlap`, found by bisection: overlap only shrinks as the circles part. */
function distanceFor(r1: number, r2: number, overlap: number) {
  if (overlap <= 0) return (r1 + r2) * 1.04
  if (overlap >= Math.PI * Math.min(r1, r2) ** 2 - 1e-9) return Math.abs(r1 - r2)
  let low = Math.abs(r1 - r2)
  let high = r1 + r2
  for (let step = 0; step < 60; step += 1) {
    const mid = (low + high) / 2
    if (vennDiagramOverlap(r1, r2, mid) > overlap) low = mid
    else high = mid
  }
  return (low + high) / 2
}

const bitsOf = (mask: number) => [0, 1, 2].filter((bit) => mask & (1 << bit))

/**
 * Two or three sets and how they overlap, with circle areas that mean something.
 *
 * Most Venn diagrams are three equal circles with numbers typed in, which says
 * nothing a table would not. Here each circle’s area is its set’s size, and each
 * pair sits exactly as far apart as it needs for the lens between them to have
 * the overlap’s area — solved numerically, since the lens area has no inverse.
 * With three sets the pairwise overlaps are exact and the centre region is as
 * close as circles allow; its printed count is always exact.
 *
 * Every region is labelled with its exclusive count, placed at the point
 * furthest from any edge. Hover a region, or arrow through them, to highlight it.
 */
export function VennDiagram({ sets: allSets, intersections, label, height = 300, format = formatTick, className }: VennDiagramProps) {
  const tableId = useId()
  const base = svgId(tableId)
  const drawn = useDrawIn()
  const sets = allSets.slice(0, 3)
  const n = sets.length
  const colorOf = (index: number) => sets[index].color ?? SERIES_COLORS[index % SERIES_COLORS.length]

  const layout = useMemo(() => {
    const inclusive = (mask: number) => {
      const ids = bitsOf(mask).map((bit) => sets[bit]?.id)
      if (ids.length === 1) return Math.max(0, sets[bitsOf(mask)[0]].size)
      const match = intersections.find((entry) => entry.sets.length === ids.length && ids.every((id) => entry.sets.includes(id)))
      return Math.max(0, match?.size ?? 0)
    }
    const full = (1 << n) - 1
    // Inclusion–exclusion turns inclusive overlaps into what only that region holds.
    const regions = []
    for (let mask = 1; mask <= full; mask += 1) {
      let exact = 0
      for (let superset = mask; superset <= full; superset += 1) {
        if ((superset & mask) !== mask) continue
        const extra = bitsOf(superset).length - bitsOf(mask).length
        exact += (extra % 2 ? -1 : 1) * inclusive(superset)
      }
      regions.push({ mask, count: Math.max(0, exact) })
    }
    regions.sort((a, b) => bitsOf(a.mask).length - bitsOf(b.mask).length || a.mask - b.mask)

    const radii = sets.map((set) => Math.sqrt(Math.max(1e-9, set.size) / Math.PI))
    const d = (i: number, j: number) => distanceFor(radii[i], radii[j], inclusive((1 << i) | (1 << j)))
    const centres: [number, number][] = [[0, 0]]
    if (n > 1) centres.push([d(0, 1), 0])
    if (n > 2) {
      const ab = centres[1][0] || 1e-9
      const ac = d(0, 2)
      const bc = d(1, 2)
      const x = (ac * ac - bc * bc + ab * ab) / (2 * ab)
      centres.push([x, Math.sqrt(Math.max(0, ac * ac - x * x))])
    }
    const minX = Math.min(...centres.map(([x], i) => x - radii[i]))
    const maxX = Math.max(...centres.map(([x], i) => x + radii[i]))
    const minY = Math.min(...centres.map(([, y], i) => y - radii[i]))
    const maxY = Math.max(...centres.map(([, y], i) => y + radii[i]))
    const scale = Math.min((PLOT_WIDTH - 200) / (maxX - minX || 1), (height - 60) / (maxY - minY || 1))
    const ox = (PLOT_WIDTH - (maxX - minX) * scale) / 2 - minX * scale
    const oy = (height - (maxY - minY) * scale) / 2 - minY * scale
    const circles = centres.map(([x, y], i) => ({ x: ox + x * scale, y: oy + y * scale, r: radii[i] * scale }))

    // Sample the plot and keep, per region, the point furthest from every edge.
    const anchors = new Map<number, { x: number; y: number; margin: number }>()
    for (let gx = 0; gx <= 160; gx += 1) {
      for (let gy = 0; gy <= 80; gy += 1) {
        const x = (gx / 160) * PLOT_WIDTH
        const y = (gy / 80) * height
        let mask = 0
        let margin = Infinity
        circles.forEach((circle, i) => {
          const distance = Math.hypot(x - circle.x, y - circle.y)
          if (distance <= circle.r) mask |= 1 << i
          margin = Math.min(margin, Math.abs(distance - circle.r))
        })
        if (mask && margin > (anchors.get(mask)?.margin ?? -1)) anchors.set(mask, { x, y, margin })
      }
    }
    return { regions, circles, anchors, union: regions.reduce((sum, region) => sum + region.count, 0) }
  }, [allSets, intersections, height])

  const { regions, circles, anchors, union } = layout
  const { active, setActive, keyProps } = useChartCursor(regions.length)
  const region = active === null ? null : regions[active]
  const nameOf = (mask: number) => {
    const inside = bitsOf(mask).map((bit) => sets[bit].label)
    if (inside.length === 2 && n === 2) return `Both ${inside[0]} and ${inside[1]}`
    return inside.length === 3 ? 'All three' : inside.length === 1 ? `Only ${inside[0]}` : `${inside.join(' and ')} only`
  }
  const centreX = circles.reduce((sum, c) => sum + c.x, 0) / Math.max(1, n)
  const centreY = circles.reduce((sum, c) => sum + c.y, 0) / Math.max(1, n)
  const share = (count: number) => (union ? `${Math.round((count / union) * 100)}%` : '0%')

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = pointerToView(event, PLOT_WIDTH, height)
    let mask = 0
    circles.forEach((circle, i) => {
      if (Math.hypot(x - circle.x, y - circle.y) <= circle.r) mask |= 1 << i
    })
    const index = regions.findIndex((entry) => entry.mask === mask)
    setActive(index >= 0 ? index : null)
  }

  const anchor = region ? anchors.get(region.mask) : null

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={`${label}. ${regions.length} regions; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          <defs>
            {circles.map((circle, i) => (
              <clipPath key={i} id={`${base}c${i}`}>
                <circle cx={circle.x} cy={circle.y} r={circle.r} />
              </clipPath>
            ))}
            {region && (
              <mask id={`${base}m`}>
                <rect width={PLOT_WIDTH} height={height} fill="white" />
                {circles.map((circle, i) =>
                  region.mask & (1 << i) ? null : <circle key={i} cx={circle.x} cy={circle.y} r={circle.r} fill="black" />,
                )}
              </mask>
            )}
          </defs>
          {circles.map((circle, i) => (
            <circle
              key={sets[i].id}
              cx={circle.x}
              cy={circle.y}
              r={circle.r}
              fill={`color-mix(in oklab, ${colorOf(i)} 24%, transparent)`}
              stroke={colorOf(i)}
              strokeWidth="2"
              className={cn('transition-transform', DRAW_IN_CLASS)}
              style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: drawn ? 'scale(1)' : 'scale(0.6)' }}
            />
          ))}
          {region && (
            <g mask={`url(#${base}m)`}>
              {bitsOf(region.mask).reduce(
                (inner, bit) => (
                  <g clipPath={`url(#${base}c${bit})`}>{inner}</g>
                ),
                <rect width={PLOT_WIDTH} height={height} fill="var(--color-ink)" opacity="0.2" />,
              )}
            </g>
          )}
          {regions.map((entry) => {
            const point = anchors.get(entry.mask)
            if (!point || point.margin < 6) return null
            return (
              <text key={entry.mask} x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central" className="fill-ink text-[13px] font-extrabold tabular-nums">
                {format(entry.count)}
              </text>
            )
          })}
          {circles.map((circle, i) => {
            const dx = circle.x - centreX
            const dy = circle.y - centreY
            const length = Math.hypot(dx, dy) || 1
            const ux = n === 1 ? 0 : dx / length
            const uy = n === 1 ? -1 : dy / length
            return (
              <text
                key={sets[i].id}
                x={circle.x + ux * (circle.r + 14)}
                y={circle.y + uy * (circle.r + 14)}
                textAnchor={ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle'}
                dominantBaseline="central"
                className="fill-ink-soft text-[12px] font-bold"
              >
                {`${sets[i].label} · ${format(sets[i].size)}`}
              </text>
            )
          })}
        </svg>
        {region && anchor && (
          <PlotTip x={anchor.x} y={anchor.y} width={PLOT_WIDTH} height={height}>
            <ChartTooltip title={nameOf(region.mask)} rows={[{ label: 'Count', value: format(region.count) }, { label: 'Of everything', value: share(region.count) }]} />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{`${label}. Each region counts only what is in exactly those sets.`}</caption>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Count</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((entry) => (
              <tr key={entry.mask}>
                <th scope="row">{nameOf(entry.mask)}</th>
                <td>{format(entry.count)}</td>
                <td>{share(entry.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={region ? `${nameOf(region.mask)}: ${format(region.count)}, ${share(region.count)} of everything` : ''} />
    </div>
  )
}
