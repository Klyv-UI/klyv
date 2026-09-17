'use client'

import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatTick, SERIES_COLORS } from '../../lib/chart'
import { ChartTooltip } from '../ChartTooltip'
import { Legend } from '../Legend'
import { VisuallyHidden } from '../VisuallyHidden'
import { DRAW_IN_CLASS, PlotAnnouncer, PlotTip, pointerToView, useChartCursor, useDrawIn } from '../internal/plot'

export interface RadialBarChartItem {
  id: string
  label: string
  value: number
  /** This ring's full circle. Defaults to the chart's `max`. */
  max?: number
  /** Any CSS colour. Defaults walk SERIES_COLORS. */
  color?: string
}

export interface RadialBarChartProps {
  /** One ring per item, outermost first. */
  items: RadialBarChartItem[]
  /** Accessible name for the chart. */
  label: string
  /** Value of a full ring. Defaults to the largest value. */
  max?: number
  /** Degrees of arc a full ring covers. 270 leaves room for the labels. */
  sweep?: number
  /** Print the sum of values in the centre. */
  showTotal?: boolean
  /** Caption under the centre figure. */
  totalLabel?: string
  /** Print each ring’s label at its start. */
  showLabels?: boolean
  /** Show the key under the chart. */
  showLegend?: boolean
  /** Rendered size in pixels. The chart is square and shrinks with its container. */
  size?: number
  /** Format values in the centre, tooltip and legend. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

const VIEW = 260
const CENTRE = VIEW / 2
const OUTER = 118
const INNER = 46

function polar(radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180
  return { x: CENTRE + radius * Math.cos(radians), y: CENTRE + radius * Math.sin(radians) }
}

function arc(radius: number, degrees: number) {
  const clamped = Math.min(359.99, Math.max(0.01, degrees))
  const start = polar(radius, 0)
  const end = polar(radius, clamped)
  return `M${start.x} ${start.y}A${radius} ${radius} 0 ${clamped > 180 ? 1 : 0} 1 ${end.x} ${end.y}`
}

/**
 * Several values against their own targets as concentric rings, with the total
 * in the middle — goals by team, quota by rep, storage by type.
 *
 * Rings are read by how far round they reach, not by their length: the outer
 * ring is longer at the same share, so every ring starts at twelve o’clock and
 * the eye compares end angles. The sweep stops short of a full circle so the
 * labels have somewhere to sit at the start of each ring, where the reader’s
 * eye already is. When the rings measure different things, give each its own
 * `max` and the chart becomes progress per item rather than a comparison.
 */
export function RadialBarChart({
  items,
  label,
  max: maxProp,
  sweep = 270,
  showTotal = true,
  totalLabel = 'Total',
  showLabels = true,
  showLegend = true,
  size = 320,
  format = formatTick,
  className,
}: RadialBarChartProps) {
  const tableId = useId()
  const drawn = useDrawIn()
  const { active, setActive, keyProps } = useChartCursor(items.length)

  const largest = Math.max(1, ...items.map((item) => (Number.isFinite(item.value) ? item.value : 0)))
  const rings = items.map((item, index) => ({
    ...item,
    color: item.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
    ceiling: item.max ?? maxProp ?? largest,
  }))
  const band = (OUTER - INNER) / Math.max(1, rings.length)
  const thickness = Math.max(4, Math.min(16, band * 0.7))
  const radiusOf = (index: number) => OUTER - band * index - band / 2
  const share = (ring: (typeof rings)[number]) =>
    Math.min(1, Math.max(0, (Number.isFinite(ring.value) ? ring.value : 0) / (ring.ceiling || 1)))
  const total = rings.reduce((sum, ring) => sum + (Number.isFinite(ring.value) ? ring.value : 0), 0)
  const current = active === null ? null : rings[active]
  const describe = (ring: (typeof rings)[number]) =>
    `${ring.label}: ${format(ring.value)} of ${format(ring.ceiling)}, ${Math.round(share(ring) * 100)}%`

  return (
    <div className={cn('flex w-full flex-col items-center gap-3', className)}>
      <div className="relative w-full" style={{ maxWidth: size }}>
        <svg
          role="img"
          aria-label={`${label}. ${rings.length} rings; use arrow keys to step through them.`}
          aria-describedby={tableId}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="w-full rounded-full outline-offset-2"
          onPointerMove={(event) => {
            const point = pointerToView(event, VIEW, VIEW)
            const distance = Math.hypot(point.x - CENTRE, point.y - CENTRE)
            const index = Math.floor((OUTER - distance) / band)
            setActive(distance <= OUTER && index >= 0 && index < rings.length ? index : null)
          }}
          onPointerLeave={() => setActive(null)}
          {...keyProps}
        >
          {rings.map((ring, index) => {
            const radius = radiusOf(index)
            const dim = active !== null && active !== index
            return (
              <g key={ring.id} opacity={dim ? 0.4 : 1}>
                <path
                  d={arc(radius, sweep)}
                  fill="none"
                  className="stroke-track"
                  strokeWidth={thickness}
                  strokeLinecap="round"
                />
                <path
                  d={arc(radius, sweep)}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="100 100"
                  strokeDashoffset={drawn ? 100 - share(ring) * 100 : 100}
                  opacity={share(ring) === 0 ? 0 : 1}
                  className={cn('transition-[stroke-dashoffset]', DRAW_IN_CLASS)}
                  style={{ transitionDelay: drawn ? `${index * 70}ms` : '0ms' }}
                />
                {showLabels && sweep <= 300 && (
                  <text
                    x={CENTRE - 8}
                    y={CENTRE - radius}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className={cn('text-[9px] font-semibold', active === index ? 'fill-ink' : 'fill-ink-soft')}
                  >
                    {ring.label}
                  </text>
                )}
              </g>
            )
          })}
          {showTotal && (
            <g aria-hidden="true">
              <text
                x={CENTRE}
                y={CENTRE - 2}
                textAnchor="middle"
                className="fill-ink text-[20px] font-extrabold tracking-tight"
              >
                {current ? format(current.value) : format(total)}
              </text>
              <text x={CENTRE} y={CENTRE + 14} textAnchor="middle" className="fill-ink-faint text-[8px] font-semibold">
                {current ? current.label : totalLabel}
              </text>
            </g>
          )}
        </svg>

        {current && active !== null && (
          <PlotTip {...polar(radiusOf(active), sweep * share(current))} width={VIEW} height={VIEW}>
            <ChartTooltip
              title={current.label}
              rows={[
                { label: 'Value', value: format(current.value), color: current.color },
                { label: 'Of', value: format(current.ceiling) },
                { label: 'Share', value: `${Math.round(share(current) * 100)}%` },
              ]}
            />
          </PlotTip>
        )}
      </div>

      {showLegend && (
        <Legend
          label={`${label} key`}
          className="justify-center"
          series={rings.map((ring) => ({ label: ring.label, color: ring.color, value: format(ring.value) }))}
        />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <thead>
            <tr>
              {['Item', 'Value', 'Of', 'Share'].map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rings.map((ring) => (
              <tr key={ring.id}>
                <th scope="row">{ring.label}</th>
                <td>{format(ring.value)}</td>
                <td>{format(ring.ceiling)}</td>
                <td>{`${Math.round(share(ring) * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {showTotal && <span>{`${totalLabel}: ${format(total)}.`}</span>}
      </VisuallyHidden>

      <PlotAnnouncer message={current ? describe(current) : ''} />
    </div>
  )
}
