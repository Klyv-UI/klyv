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
  options: { zeroBased?: boolean; tickCount?: number } = {},
): ChartScale {
  const { zeroBased = true, tickCount = 4 } = options
  const { width, height, padding } = geometry

  const all = series.flatMap((entry) => entry.values)
  const rawMin = all.length ? Math.min(...all) : 0
  const rawMax = all.length ? Math.max(...all) : 1

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
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value * 10) / 10)
}
