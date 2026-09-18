'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatTick, SERIES_COLORS } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PlotAnnouncer, PlotTip, useChartCursor, useDrawIn } from '../internal/plot'

export interface ChordDiagramProps {
  /** One name per group, in matrix order. */
  labels: string[]
  /**
   * Square flow matrix: `matrix[i][j]` is what flows from group i to group j.
   * Row totals set each group’s arc; the diagonal is flow a group keeps.
   */
  matrix: number[][]
  /** Accessible name for the chart. */
  label: string
  /** Largest rendered size in pixels. The chart shrinks with its container. */
  size?: number
  /** Gap between group arcs, in radians. */
  padAngle?: number
  /** One CSS colour per group. Defaults walk SERIES_COLORS. */
  colors?: string[]
  /** Format flows in the tooltip and the hidden table. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

interface ChordDiagramGroupLayout {
  index: number
  a0: number
  a1: number
  out: number
  into: number
}

interface ChordDiagramRibbonLayout {
  source: number
  target: number
  s0: number
  s1: number
  t0: number
  t1: number
  value: number
  back: number
}

const VIEW = 420
const C = VIEW / 2
const OUTER = 150
const INNER = 138
const TAU = Math.PI * 2

const at = (radius: number, angle: number) => [C + radius * Math.sin(angle), C - radius * Math.cos(angle)] as const
const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)

/**
 * Lays the matrix out the way d3-chord does: each group gets an arc as long as
 * its row total, each arc is split into one subgroup per destination, and a
 * ribbon joins subgroup (i, j) to subgroup (j, i). Kept as a plain function so
 * the geometry can be tested without rendering.
 */
export function chordDiagramLayout(matrix: number[][], padAngle: number) {
  const n = matrix.length
  const rows = matrix.map((row) => Array.from({ length: n }, (_, j) => clean(row[j])))
  const totals = rows.map((row) => row.reduce((sum, value) => sum + value, 0))
  const grand = totals.reduce((sum, value) => sum + value, 0)
  const pad = grand > 0 ? Math.min(padAngle, TAU / Math.max(1, n) / 2) : 0
  const k = grand > 0 ? Math.max(0, TAU - pad * n) / grand : 0

  const groups: ChordDiagramGroupLayout[] = []
  const sub: [number, number][][] = rows.map(() => [])
  let angle = 0
  rows.forEach((row, i) => {
    const start = angle
    row.forEach((value, j) => {
      sub[i][j] = [angle, angle + value * k]
      angle += value * k
    })
    groups.push({ index: i, a0: start, a1: angle, out: totals[i], into: rows.reduce((sum, r) => sum + r[i], 0) })
    angle += pad
  })

  const ribbons: ChordDiagramRibbonLayout[] = []
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      if (rows[i][j] + rows[j][i] <= 0) continue
      // The ribbon takes the colour of whichever side sends more, as d3 does.
      const [source, target] = rows[i][j] >= rows[j][i] ? [i, j] : [j, i]
      ribbons.push({
        source,
        target,
        s0: sub[source][target][0],
        s1: sub[source][target][1],
        t0: sub[target][source][0],
        t1: sub[target][source][1],
        value: rows[source][target],
        back: source === target ? 0 : rows[target][source],
      })
    }
  }
  return { groups, ribbons, grand }
}

function arcBand(a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = at(OUTER, a0)
  const [x1, y1] = at(OUTER, a1)
  const [x2, y2] = at(INNER, a1)
  const [x3, y3] = at(INNER, a0)
  return `M${x0} ${y0}A${OUTER} ${OUTER} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${INNER} ${INNER} 0 ${large} 0 ${x3} ${y3}Z`
}

function ribbonPath({ s0, s1, t0, t1 }: ChordDiagramRibbonLayout) {
  const r = INNER - 1
  const [sx0, sy0] = at(r, s0)
  const [sx1, sy1] = at(r, s1)
  const [tx0, ty0] = at(r, t0)
  const [tx1, ty1] = at(r, t1)
  const sLarge = s1 - s0 > Math.PI ? 1 : 0
  const tLarge = t1 - t0 > Math.PI ? 1 : 0
  // Arc along the source, quadratic through the centre to the target, arc
  // along the target, and back through the centre: the classic chord ribbon.
  return (
    `M${sx0} ${sy0}A${r} ${r} 0 ${sLarge} 1 ${sx1} ${sy1}Q${C} ${C} ${tx0} ${ty0}` +
    `A${r} ${r} 0 ${tLarge} 1 ${tx1} ${ty1}Q${C} ${C} ${sx0} ${sy0}Z`
  )
}

/**
 * Flows between a handful of groups, in both directions, as one circle.
 *
 * A Sankey reads left to right, so it cannot show that engineering hands work
 * to design and design hands it back. A chord diagram can: each group is an arc
 * as long as everything it sends, and each ribbon is as wide at either end as
 * what that end sends to the other. The layout is computed here, not
 * approximated — group angles from row totals, subgroup angles from each cell,
 * quadratic ribbons through the centre.
 *
 * Hovering a group, or arrowing to it, fades every ribbon it is not part of,
 * which is the only way to read a busy chord. The matrix is in a hidden table.
 */
export function ChordDiagram({
  labels,
  matrix,
  label,
  size = 420,
  padAngle = 0.045,
  colors,
  format = formatTick,
  className,
}: ChordDiagramProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const n = Math.min(labels.length, matrix.length)
  const square = matrix.slice(0, n).map((row) => row.slice(0, n))
  const { groups, ribbons, grand } = chordDiagramLayout(square, padAngle)
  const colorOf = (index: number) => colors?.[index] ?? SERIES_COLORS[index % SERIES_COLORS.length]
  const { active, setActive, keyProps } = useChartCursor(n)

  const group = active === null ? null : groups[active]
  const mid = group ? (group.a0 + group.a1) / 2 : 0
  const [tipX, tipY] = at(OUTER + 8, mid)
  const partners = group
    ? square[group.index]
        .map((value, j) => ({ j, value, back: clean(square[j][group.index]) }))
        .filter((entry) => entry.value > 0 || entry.back > 0)
        .sort((a, b) => b.value + b.back - (a.value + a.back))
        .slice(0, 3)
    : []

  const describe = (g: ChordDiagramGroupLayout) =>
    `${labels[g.index]}: sends ${format(g.out)}, receives ${format(g.into)}` +
    (grand ? `, ${Math.round((g.out / grand) * 100)}% of all flow` : '')

  return (
    <div className={cn('flex w-full flex-col items-center gap-3', className)}>
      <div className="relative w-full" style={{ maxWidth: size }}>
        <svg
          role="img"
          aria-label={`${label}. ${n} groups; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="w-full rounded-[var(--radius-glyph)] outline-offset-2"
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          <g>
            {ribbons.map((ribbon) => {
              const lit = active === null || ribbon.source === active || ribbon.target === active
              return (
                <path
                  key={`${ribbon.source}-${ribbon.target}`}
                  d={ribbonPath(ribbon)}
                  fill={colorOf(ribbon.source)}
                  stroke="var(--color-surface)"
                  strokeWidth="0.75"
                  opacity={drawn ? (lit ? 0.72 : 0.08) : 0}
                  className={cn('transition-opacity', DRAW_IN_CLASS)}
                  onPointerEnter={() => setActive(ribbon.source)}
                />
              )
            })}
          </g>
          {groups.map((g) => {
            const middle = (g.a0 + g.a1) / 2
            const [lx, ly] = at(OUTER + 12, middle)
            const right = Math.sin(middle) >= 0
            const long = g.a1 - g.a0 > 0.12
            return (
              <g key={g.index} onPointerEnter={() => setActive(g.index)}>
                {g.a1 > g.a0 && (
                  <path
                    d={arcBand(g.a0, g.a1)}
                    fill={colorOf(g.index)}
                    stroke={active === g.index ? 'var(--color-ink)' : 'none'}
                    strokeWidth="1.5"
                  />
                )}
                {long && (
                  <text
                    x={lx}
                    y={ly}
                    textAnchor={right ? 'start' : 'end'}
                    dominantBaseline="middle"
                    className={cn('text-[11px] font-semibold', active === g.index ? 'fill-ink' : 'fill-ink-soft')}
                  >
                    {labels[g.index]}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {group && (
          <PlotTip x={tipX} y={tipY} width={VIEW} height={VIEW}>
            <ChartTooltip
              title={labels[group.index]}
              rows={[
                { label: 'Sends', value: format(group.out), color: colorOf(group.index) },
                { label: 'Receives', value: format(group.into) },
                ...partners.map(({ j, value, back }) => ({
                  label: j === group.index ? 'Kept' : `⇄ ${labels[j]}`,
                  value: j === group.index ? format(value) : `${format(value)} / ${format(back)}`,
                })),
              ]}
            />
          </PlotTip>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{`${label}. Rows send to columns.`}</caption>
          <thead>
            <tr>
              <th scope="col">From</th>
              {labels.slice(0, n).map((name) => (
                <th key={name} scope="col">{`To ${name}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {square.map((row, i) => (
              <tr key={labels[i]}>
                <th scope="row">{labels[i]}</th>
                {row.map((value, j) => (
                  <td key={labels[j]}>{format(clean(value))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      <PlotAnnouncer message={group ? describe(group) : ''} />
    </div>
  )
}
