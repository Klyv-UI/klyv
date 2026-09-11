'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { Legend } from '../Legend'
import { SERIES_COLORS } from '../../lib/chart'

export interface DonutSlice {
  id: string
  label: string
  value: number
  color?: string
}

export interface DonutChartProps {
  slices: DonutSlice[]
  /** Accessible name for the chart. */
  label: string
  /** Outer diameter in pixels. */
  size?: number
  /** Ring thickness as a fraction of the radius, 0 to 1. */
  thickness?: number
  /** Content in the middle — usually the total. */
  children?: ReactNode
  /** Show the key beside the ring. */
  showLegend?: boolean
  /** Turns a slice value into its printed label. */
  format?: (value: number) => string
  /** Merged last, so it wins. */
  className?: string
}

function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const point = (angle: number) => [
    cx + radius * Math.cos(angle - Math.PI / 2),
    cy + radius * Math.sin(angle - Math.PI / 2),
  ]
  const [x1, y1] = point(start)
  const [x2, y2] = point(end)
  const large = end - start > Math.PI ? 1 : 0
  return `M${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2}`
}

/**
 * Part-to-whole as a ring, with the total in the middle.
 *
 * Arcs are drawn as stroked paths rather than filled wedges, so the ring
 * thickness is one number and the gaps between slices stay even. Hovering a
 * slice raises it and dims the rest; the same information is in the legend and
 * in the hidden table, so nothing depends on the hover.
 */
export function DonutChart({
  slices,
  label,
  size = 200,
  thickness = 0.28,
  children,
  showLegend = true,
  format = (value) => String(value),
  className,
}: DonutChartProps) {
  const [active, setActive] = useState<string | null>(null)
  const tableId = useId()

  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1
  const radius = size / 2
  const strokeWidth = radius * thickness * 2
  const ringRadius = radius - strokeWidth / 2 - 2

  const resolved = slices.map((slice, index) => ({
    ...slice,
    color: slice.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
  }))

  let angle = 0

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          role="img"
          aria-label={label}
          aria-describedby={tableId}
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
        >
          {resolved.map((slice) => {
            const sweep = (slice.value / total) * Math.PI * 2
            const start = angle
            const end = angle + sweep - 0.02
            angle += sweep
            const raised = active === slice.id
            return (
              <path
                key={slice.id}
                d={arcPath(radius, radius, ringRadius, start, Math.max(start + 0.01, end))}
                fill="none"
                stroke={slice.color}
                strokeWidth={raised ? strokeWidth + 6 : strokeWidth}
                strokeLinecap="round"
                opacity={active === null || raised ? 1 : 0.4}
                onPointerEnter={() => setActive(slice.id)}
                onPointerLeave={() => setActive(null)}
                className="cursor-pointer transition-all duration-[var(--duration-fast)]"
              />
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {active ? (
            <>
              <Text size="stat" tabular>
                {format(resolved.find((slice) => slice.id === active)?.value ?? 0)}
              </Text>
              <Text size="caption" tone="faint">
                {resolved.find((slice) => slice.id === active)?.label}
              </Text>
            </>
          ) : (
            children
          )}
        </div>
      </div>

      {showLegend && (
        <Legend
          label={`${label} series`}
          orientation="vertical"
          series={resolved.map((slice) => ({
            label: slice.label,
            color: slice.color,
            value: format(slice.value),
          }))}
        />
      )}

      <VisuallyHidden>
        <table id={tableId}>
          <caption>{label}</caption>
          <tbody>
            {resolved.map((slice) => (
              <tr key={slice.id}>
                <th scope="row">{slice.label}</th>
                <td>{format(slice.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  )
}
