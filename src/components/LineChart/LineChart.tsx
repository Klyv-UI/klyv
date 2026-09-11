import { CartesianChart, type CartesianChartProps } from '../CartesianChart'

export type LineChartProps = Omit<CartesianChartProps, 'children'> & {
  /** Mark every data point, not only the hovered one. */
  showPoints?: boolean
  /** Round the corners between points. */
  smooth?: boolean
}

function path(points: [number, number][], smooth: boolean): string {
  if (points.length === 0) return ''
  if (!smooth || points.length < 3) {
    return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  }
  return points.reduce((accumulator, [x, y], index, all) => {
    if (index === 0) return `M${x},${y}`
    const [previousX, previousY] = all[index - 1]
    const controlX = (previousX + x) / 2
    return `${accumulator} C${controlX},${previousY} ${controlX},${y} ${x},${y}`
  }, '')
}

/**
 * A line chart over the shared cartesian scaffolding — axes, gridlines, hover
 * tracking, legend and the accessible data table all come from there.
 *
 * Series colours default along a ramp that stays distinguishable in greyscale,
 * and every series is named in the legend, so the lines are never told apart by
 * colour alone.
 */
export function LineChart({ showPoints = false, smooth = false, ...props }: LineChartProps) {
  return (
    <CartesianChart {...props}>
      {({ scale, series, active }) => (
        <>
          {series.map((entry) => {
            const points = entry.values.map(
              (value, index) => [scale.toX(index, entry.values.length), scale.toY(value)] as [number, number],
            )
            return (
              <g key={entry.id}>
                <path
                  d={path(points, smooth)}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map(([x, y], index) =>
                  showPoints || active === index ? (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={active === index ? 4 : 2.5}
                      fill="var(--color-surface)"
                      stroke={entry.color}
                      strokeWidth="2"
                    />
                  ) : null,
                )}
              </g>
            )
          })}
        </>
      )}
    </CartesianChart>
  )
}
