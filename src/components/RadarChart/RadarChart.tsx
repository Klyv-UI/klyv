'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { Legend } from '../Legend'
import { SERIES_COLORS } from '../../lib/chart'
import { useInView } from '../../lib/motion'

export interface RadarAxis {
  key: string
  label: string
  /** Top of this axis. Defaults to the largest value across every series. */
  max?: number
}

export interface RadarSeries {
  id: string
  label: string
  /** One value per axis, keyed by `RadarAxis.key`. */
  values: Record<string, number>
  color?: string
}

export interface RadarChartProps {
  axes: RadarAxis[]
  series: RadarSeries[]
  /** Accessible name for the chart. */
  label: string
  /** Chart size in pixels, before the label padding. */
  size?: number
  /** Rings drawn behind the shapes. */
  rings?: number
  showLegend?: boolean
  /** Grow the shapes from the centre when the chart first comes into view. */
  animate?: boolean
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Several measures of the same thing at once, as a shape rather than a row of
 * bars.
 *
 * A radar is the right chart for exactly one question — is this profile
 * balanced — and the wrong one for almost everything else, because comparing
 * two areas is far harder than comparing two lengths. It earns its place here
 * because the library had no way to show *shape*, and a bar chart with six
 * categories does not answer that question at any glance.
 *
 * Each axis carries its own maximum, so measures on different units can share
 * one shape without the largest of them flattening the rest against the rim.
 * Series are drawn as translucent fills so the overlap stays readable, which is
 * what stops a second series from simply hiding the first.
 *
 * The entrance is one `transform: scale` on a group, triggered when the chart
 * enters the viewport, so it draws once and does not re-run on every re-render.
 * The numbers are also in a hidden table: the shape is a summary, never the
 * only copy of the data.
 */
export function RadarChart({
  axes,
  series,
  label,
  size = 260,
  rings = 4,
  showLegend = true,
  animate = true,
  format = (value) => String(value),
  className,
}: RadarChartProps) {
  const tableId = useId()
  const [active, setActive] = useState<string | null>(null)
  const { ref, inView } = useInView<HTMLDivElement>(0.3)

  const centre = size / 2
  const radius = centre - 34
  // Axis labels sit outside the outer ring, so the box is widened rather than
  // the chart shrunk — a long label like "Subscriptions" would otherwise be
  // clipped by the viewBox at exactly the size where the chart is readable.
  const pad = 64

  const maxFor = (axis: RadarAxis) =>
    axis.max ?? Math.max(...series.map((entry) => entry.values[axis.key] ?? 0), 1)

  const point = (index: number, ratio: number) => {
    // Start at the top and go clockwise, which is how these are always read.
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2
    return [centre + Math.cos(angle) * radius * ratio, centre + Math.sin(angle) * radius * ratio]
  }

  const resolved = series.map((entry, index) => ({
    ...entry,
    color: entry.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
  }))

  return (
    <div ref={ref} className={cn('flex flex-wrap items-center gap-5', className)}>
      <svg
        width={size + pad * 2}
        height={size}
        viewBox={`${-pad} 0 ${size + pad * 2} ${size}`}
        role="img"
        aria-label={label}
        aria-describedby={tableId}
      >
        {Array.from({ length: rings }, (_, ring) => {
          const ratio = (ring + 1) / rings
          return (
            <polygon
              key={ring}
              points={axes.map((_, index) => point(index, ratio).join(',')).join(' ')}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth={1}
            />
          )
        })}

        {axes.map((axis, index) => {
          const [x, y] = point(index, 1)
          const [labelX, labelY] = point(index, 1.16)
          return (
            <g key={axis.key}>
              <line x1={centre} y1={centre} x2={x} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text
                x={labelX}
                y={labelY}
                textAnchor={labelX > centre + 4 ? 'start' : labelX < centre - 4 ? 'end' : 'middle'}
                dominantBaseline="middle"
                className="fill-ink-faint text-[10px] font-bold"
              >
                {axis.label}
              </text>
            </g>
          )
        })}

        <g
          className="motion-safe-only origin-center transition-transform duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ transform: `scale(${!animate || inView ? 1 : 0})` }}
        >
          {resolved.map((entry) => {
            const dimmed = active !== null && active !== entry.id
            const points = axes
              .map((axis, index) =>
                point(index, Math.min(1, (entry.values[axis.key] ?? 0) / maxFor(axis))).join(','),
              )
              .join(' ')
            return (
              <g
                key={entry.id}
                onPointerEnter={() => setActive(entry.id)}
                onPointerLeave={() => setActive(null)}
                className="transition-opacity duration-[var(--duration-fast)]"
                style={{ opacity: dimmed ? 0.2 : 1 }}
              >
                <polygon points={points} fill={entry.color} fillOpacity={0.18} stroke={entry.color} strokeWidth={2} strokeLinejoin="round" />
                {axes.map((axis, index) => {
                  const [x, y] = point(index, Math.min(1, (entry.values[axis.key] ?? 0) / maxFor(axis)))
                  return <circle key={axis.key} cx={x} cy={y} r={2.75} fill={entry.color} />
                })}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="flex min-w-0 flex-col gap-3">
        {showLegend && (
          <Legend
            label={`${label} series`}
            orientation="vertical"
            series={resolved.map((entry) => ({ label: entry.label, color: entry.color }))}
          />
        )}
        {active && (
          <div className="flex flex-col gap-1">
            {axes.map((axis) => {
              const entry = resolved.find((candidate) => candidate.id === active)
              return (
                <Text key={axis.key} size="caption" tone="soft" tabular>
                  {axis.label} · {format(entry?.values[axis.key] ?? 0)}
                </Text>
              )
            })}
          </div>
        )}
      </div>

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Series</th>
              {axes.map((axis) => (
                <th key={axis.key} scope="col">
                  {axis.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resolved.map((entry) => (
              <tr key={entry.id}>
                <th scope="row">{entry.label}</th>
                {axes.map((axis) => (
                  <td key={axis.key}>{format(entry.values[axis.key] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  )
}
