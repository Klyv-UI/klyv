import { CartesianChart, type CartesianChartProps } from '../CartesianChart'

export type BarChartProps = Omit<CartesianChartProps, 'children'> & {
  /** Stack the series instead of placing them side by side. */
  stacked?: boolean
  /** Bar width as a fraction of the band, 0 to 1. */
  barRatio?: number
}

/**
 * Categorical bars over the shared cartesian scaffolding.
 *
 * The scale is zero-based, which for bars is not a preference: a bar encodes
 * value by length, so a truncated axis makes small differences look large.
 * Grouped bars sit side by side; stacked bars sum to the top edge.
 */
export function BarChart({ stacked = false, barRatio = 0.62, ...props }: BarChartProps) {
  return (
    <CartesianChart {...props}>
      {({ scale, series, active }) => {
        const count = props.categories.length
        const band = scale.plot.width / Math.max(1, count)
        const groupWidth = band * barRatio
        const barWidth = stacked ? groupWidth : groupWidth / series.length
        const running = new Array(count).fill(0)
        const baseline = scale.toY(scale.min)

        return (
          <>
            {series.map((entry, seriesIndex) =>
              entry.values.map((value, index) => {
                const centre = scale.toX(index, count)
                const left = stacked
                  ? centre - groupWidth / 2
                  : centre - groupWidth / 2 + seriesIndex * barWidth
                const top = stacked ? scale.toY(running[index] + value) : scale.toY(value)
                const bottom = stacked ? scale.toY(running[index]) : baseline
                if (stacked) running[index] += value

                return (
                  <rect
                    key={`${entry.id}-${index}`}
                    x={left}
                    y={Math.min(top, bottom)}
                    width={Math.max(1, barWidth - 2)}
                    height={Math.max(1, Math.abs(bottom - top))}
                    rx={3}
                    fill={entry.color}
                    opacity={active === null || active === index ? 1 : 0.45}
                    className="transition-opacity"
                  />
                )
              }),
            )}
          </>
        )
      }}
    </CartesianChart>
  )
}
