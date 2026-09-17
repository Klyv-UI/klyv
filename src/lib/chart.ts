export interface ChartSeries {
  id: string
  label: string
  values: number[]
  /** Any CSS colour. Defaults walk the accent ramp. */
  color?: string
}

export const SERIES_COLORS = [
  'var(--color-accent-strong)',
  'var(--color-ink)',
  'var(--color-success)',
  'var(--color-ink-faint)',
  'var(--color-warning)',
]

export interface ChartGeometry {
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
}

export interface ChartScale {
  /** Plot area, inside the axis gutters. */
  plot: { x: number; y: number; width: number; height: number }
  min: number
  max: number
  /** Value to y pixel. */
  toY: (value: number) => number
  /** Category index to x pixel, centred in its band. */
  toX: (index: number, count: number) => number
  /** Evenly spaced tick values across the range. */
  ticks: number[]
}

/**
 * Shared scaling for the chart family, so every chart puts its axes, gridlines
 * and points in the same place. Kept as a plain function rather than a hook:
 * it has no state, and charts call it during render.
 */
export function chartScale(
  series: ChartSeries[],
  geometry: ChartGeometry,
  options: { zeroBased?: boolean; tickCount?: number; stacked?: boolean } = {},
): ChartScale {
  const { zeroBased = true, tickCount = 4, stacked = false } = options
  const { width, height, padding } = geometry

  // A loop rather than Math.min(...values): spreading a large series into
  // arguments throws (200k points was enough), and one NaN turned every tick
  // and every point into NaN. Values that are not finite are left out of the
  // range, so the chart draws around a gap instead of drawing nothing.
  let rawMin = Number.POSITIVE_INFINITY
  let rawMax = Number.NEGATIVE_INFINITY
  const include = (value: number) => {
    if (!Number.isFinite(value)) return
    if (value < rawMin) rawMin = value
    if (value > rawMax) rawMax = value
  }

  if (stacked) {
    // Stacked charts draw running totals, so the range has to be the range of
    // those totals. Scaling to the raw values put the top of every stack above
    // the plot and printed an axis that understated the total.
    const categories = Math.max(0, ...series.map((entry) => entry.values.length))
    for (let index = 0; index < categories; index += 1) {
      let running = 0
      for (const entry of series) {
        const value = entry.values[index]
        if (!Number.isFinite(value)) continue
        running += value
        include(running)
      }
    }
  } else {
    for (const entry of series) for (const value of entry.values) include(value)
  }

  if (rawMin === Number.POSITIVE_INFINITY) {
    rawMin = 0
    rawMax = 1
  }

  const min = zeroBased ? Math.min(0, rawMin) : rawMin
  const max = rawMax === min ? min + 1 : rawMax
  const span = max - min

  const plot = {
    x: padding.left,
    y: padding.top,
    width: Math.max(1, width - padding.left - padding.right),
    height: Math.max(1, height - padding.top - padding.bottom),
  }

  return {
    plot,
    min,
    max,
    toY: (value) => plot.y + plot.height - ((value - min) / span) * plot.height,
    toX: (index, count) =>
      count <= 1 ? plot.x + plot.width / 2 : plot.x + (index / (count - 1)) * plot.width,
    ticks: Array.from({ length: tickCount + 1 }, (_, index) => min + (span * index) / tickCount),
  }
}

/** Compact axis formatting: 12.4k rather than 12,400. */
export function formatTick(value: number): string {
  const absolute = Math.abs(value)
  // Each threshold sits where one decimal would round up into the next unit,
  // so 999,999 reads "1.0m" rather than "1000.0k".
  if (absolute >= 999_950_000) return `${(value / 1_000_000_000).toFixed(1)}b`
  if (absolute >= 999_950) return `${(value / 1_000_000).toFixed(1)}m`
  if (absolute >= 999.95) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value * 10) / 10)
}
