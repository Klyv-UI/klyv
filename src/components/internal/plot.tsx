'use client'

import { useEffect, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'

/**
 * Plumbing shared by the statistical charts — scatter, waterfall, histogram,
 * box plot, bullet, candlestick and uptime.
 *
 * `lib/chart.ts` scales a list of categories; these charts need continuous
 * axes with round ticks, quantiles, and a keyboard cursor over marks that are
 * not evenly spaced. Kept internal: the public surface is the charts.
 */

/** The viewBox width every chart draws in. The SVG itself fills its container. */
export const PLOT_WIDTH = 640

/** Tick label styling, identical to CartesianChart's axes. */
export const TICK_CLASS = 'fill-ink-faint text-[9px] font-medium'

/** Entrance transition classes. Reduced motion lands on the final frame at once. */
export const DRAW_IN_CLASS = 'duration-500 ease-out motion-reduce:transition-none'

/**
 * A range widened to round numbers, with evenly spaced ticks across it. Ticks at
 * 0, 25, 50 are read; ticks at 3.7, 28.9, 54.1 are only looked at.
 */
export function niceScale(min: number, max: number, count = 4) {
  let low = Number.isFinite(min) ? min : 0
  let high = Number.isFinite(max) ? max : 1
  if (low === high) {
    low -= 1
    high += 1
  }
  const raw = (high - low) / Math.max(1, count)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / magnitude
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude
  const start = Math.floor(low / step) * step
  const end = Math.ceil(high / step) * step
  const ticks: number[] = []
  for (let value = start; value <= end + step / 2; value += step) ticks.push(Number(value.toFixed(10)))
  return { min: start, max: end, step, ticks }
}

/** Maps a domain onto a pixel range. A zero-width domain maps to the range start. */
export function linear(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0)
}

/** Linear-interpolated quantile of an ascending array (the R-7 / spreadsheet method). */
export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN
  const position = (sorted.length - 1) * p
  const base = Math.floor(position)
  const rest = position - base
  const next = sorted[base + 1]
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base])
}

/** Left gutter wide enough for the widest tick label. */
export function gutterFor(ticks: number[], format: (value: number) => string) {
  return Math.max(32, Math.max(...ticks.map((tick) => format(tick).length)) * 6.2 + 12)
}

/** An id usable inside `url(#…)`, which React's `:r1:` ids are not. */
export function svgId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '')
}

/**
 * False on the first frame, true after. Marks transition from their resting
 * position to their value, so the chart draws in once rather than popping.
 */
export function useDrawIn() {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') {
      setDrawn(true)
      return
    }
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return drawn
}

/**
 * One tab stop for the whole chart, arrow keys to move between marks.
 *
 * A tab stop per point would make a 300-point scatter a 300-press detour on the
 * way to the next control. Escape clears the cursor, and only swallows the key
 * when there was a cursor to clear, so a chart inside a dialog does not stop the
 * dialog closing.
 */
export function useChartCursor(count: number) {
  const [active, setActive] = useState<number | null>(null)
  const current = active !== null && active < count ? active : null

  const onKeyDown = (event: KeyboardEvent) => {
    if (count === 0) return
    let next: number | null
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = current === null ? 0 : Math.min(count - 1, current + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = current === null ? 0 : Math.max(0, current - 1)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = count - 1
        break
      case 'Escape':
        if (current === null) return
        next = null
        break
      default:
        return
    }
    event.preventDefault()
    setActive(next)
  }

  const onFocus = (event: FocusEvent<Element>) => {
    // Keyboard focus lands on the first mark so the tooltip says what the
    // arrows will do; a click that focuses the chart leaves the pointer in charge.
    let keyboard = false
    try {
      keyboard = event.currentTarget.matches(':focus-visible')
    } catch {
      keyboard = false
    }
    if (keyboard && current === null && count > 0) setActive(0)
  }

  return {
    active: current,
    setActive,
    keyProps: { tabIndex: 0, onKeyDown, onFocus, onBlur: () => setActive(null) },
  }
}

/**
 * Places a ChartTooltip over a point given in viewBox units. It flips below the
 * point near the top edge and hugs the side near either end, so it never hangs
 * off the chart.
 */
export function PlotTip({
  x,
  y,
  width,
  height,
  children,
}: {
  x: number
  y: number
  width: number
  height: number
  children: ReactNode
}) {
  const across = x / width
  const down = y / height
  const shiftX = across < 0.18 ? '0%' : across > 0.82 ? '-100%' : '-50%'
  const shiftY = down < 0.35 ? '12px' : 'calc(-100% - 12px)'
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: `${across * 100}%`,
        top: `${down * 100}%`,
        transform: `translate(${shiftX}, ${shiftY})`,
      }}
    >
      {children}
    </div>
  )
}

/** Polite live region, always mounted so the first announcement is not lost. */
export function PlotAnnouncer({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}

/** Converts a pointer position into viewBox units. */
export function pointerToView(event: React.PointerEvent<Element>, width: number, height: number) {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / (rect.width || 1)) * width,
    y: ((event.clientY - rect.top) / (rect.height || 1)) * height,
  }
}
