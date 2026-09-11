'use client'

import { useId } from 'react'
import { CartesianChart, type CartesianChartProps } from '../CartesianChart'

export type AreaChartProps = Omit<CartesianChartProps, 'children'> & {
  /** Stack the series instead of overlaying them. */
  stacked?: boolean
}

/**
 * A line chart with the area under each series filled.
 *
 * Overlaid areas are translucent so a series behind another stays visible;
 * stacked mode is for part-to-whole, where the top edge is the total. Use
 * stacked only when the sum is meaningful — otherwise the upper bands are hard
 * to read, since they no longer start at the axis.
 */
export function AreaChart({ stacked = false, ...props }: AreaChartProps) {
  const gradientId = useId()

  return (
    <CartesianChart {...props}>
      {({ scale, series }) => {
        const running = new Array(props.categories.length).fill(0)

        return (
          <>
            <defs>
              {series.map((entry, index) => (
                <linearGradient key={entry.id} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={entry.color} stopOpacity="0.02" />
                </linearGradient>
              ))}
            </defs>
            {series.map((entry, seriesIndex) => {
              const tops = entry.values.map((value, index) => {
                const top = stacked ? running[index] + value : value
                if (stacked) running[index] = top
                return [scale.toX(index, entry.values.length), scale.toY(top)] as [number, number]
              })
              const line = tops.map(([x, y]) => `${x},${y}`).join(' ')
              const baseline = scale.toY(scale.min)

              return (
                <g key={entry.id}>
                  <polygon
                    points={`${scale.plot.x},${baseline} ${line} ${scale.plot.x + scale.plot.width},${baseline}`}
                    fill={`url(#${gradientId}-${seriesIndex})`}
                  />
                  <polyline
                    points={line}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )
            })}
          </>
        )
      }}
    </CartesianChart>
  )
}
