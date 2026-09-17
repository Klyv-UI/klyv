'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface LiveChartProps {
  /** Newest last. Push to it on whatever interval the source ticks at. */
  values: number[]
  /** Accessible name — what is being measured. */
  label: string
  /** Samples kept on screen. Older ones scroll off the left. */
  window?: number
  /** Milliseconds between samples. Drives the scroll, so keep it honest. */
  interval?: number
  /** Plot height in pixels. The width fills the container. */
  height?: number
  /** Fixed scale. Omit and it follows the window, easing between bounds. */
  domain?: [number, number]
  /** Fill under the line. */
  area?: boolean
  /** Any CSS colour for the line. Defaults to the accent. */
  color?: string
  /** Turns a sample into its printed readout. */
  format?: (value: number) => string
  /** Highlight a threshold — a limit, a target, an alarm level. */
  threshold?: { value: number; label: string }
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A line that scrolls as new samples arrive.
 *
 * The path is redrawn only when a sample lands; the scrolling between samples
 * is one CSS transition on the group's `transform`. On each new value the group
 * jumps one step to the right without a transition and is released back to zero
 * over the sample interval — so the line glides continuously while React
 * renders once per sample rather than once per frame.
 *
 * The scale eases towards the window's bounds instead of snapping to them.
 * A y-axis that jumps the instant a new maximum arrives makes every reading
 * before it look wrong, and the shape of the series stops being comparable
 * across a few seconds. Easing keeps the picture stable while still fitting.
 *
 * The latest value is also plain text in a live region, updated politely, so
 * the number is available without watching the line — and under
 * `prefers-reduced-motion` the scroll simply stops and the chart steps.
 */
export function LiveChart({
  values,
  label,
  window: windowSize = 40,
  interval = 1000,
  height = 120,
  domain,
  area = true,
  color = 'var(--color-accent-strong)',
  format = (value) => String(Math.round(value)),
  threshold,
  className,
}: LiveChartProps) {
  const groupRef = useRef<SVGGElement>(null)
  const seen = useRef(values.length)
  const [bounds, setBounds] = useState<[number, number]>(domain ?? [0, 1])
  // The placeholder [0, 1] is not a scale to ease away from: easing a quarter
  // of the way per sample left readings in the thousands clipped off the plot
  // for the first ten or so samples. The first real window is taken as it is.
  const hasBounds = useRef(Boolean(domain))
  const reducedMotion = usePrefersReducedMotion()

  const width = 600
  const shown = values.slice(-windowSize)
  const step = width / Math.max(1, windowSize - 1)

  // Ease towards the window's range rather than snapping to it.
  useEffect(() => {
    if (domain) {
      setBounds(domain)
      return
    }
    // Only finite samples count. One NaN used to make the bounds NaN, and
    // because each new bound eases from the last one, they stayed NaN long
    // after the bad sample had scrolled away: the line was gone for good.
    const finite = shown.filter(Number.isFinite)
    if (finite.length === 0) return
    const low = Math.min(...finite, threshold?.value ?? Infinity)
    const high = Math.max(...finite, threshold?.value ?? -Infinity)
    const pad = (high - low || 1) * 0.15
    if (!hasBounds.current) {
      hasBounds.current = true
      setBounds([low - pad, high + pad])
      return
    }
    setBounds(([currentLow, currentHigh]) => [
      currentLow + (low - pad - currentLow) * 0.25,
      currentHigh + (high + pad - currentHigh) * 0.25,
    ])
  }, [domain, shown.length, values, threshold?.value])

  const y = (value: number) => {
    const [low, high] = bounds
    const span = high - low || 1
    return height - ((value - low) / span) * height
  }

  // On a new sample: jump one step right, then release back over the interval.
  useEffect(() => {
    if (values.length === seen.current) return
    seen.current = values.length
    const group = groupRef.current
    if (!group || reducedMotion) return

    group.style.transition = 'none'
    group.style.transform = `translateX(${step}px)`
    const frame = requestAnimationFrame(() => {
      group.style.transition = `transform ${interval}ms linear`
      group.style.transform = 'translateX(0)'
    })
    return () => cancelAnimationFrame(frame)
  }, [interval, reducedMotion, step, values.length])

  // A sample that is not a number is skipped rather than drawn at NaN, which
  // invalidated the whole path.
  const points = shown.flatMap((value, index) => (Number.isFinite(value) ? [[index * step, y(value)] as const] : []))
  const line = points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px},${py}`).join(' ')
  const fill =
    points.length > 1 ? `${line} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z` : ''
  const latestSample = shown[shown.length - 1]
  const latest = Number.isFinite(latestSample) ? latestSample : undefined
  const head = points[points.length - 1]

  // What is announced, and when. The readout above is ordinary text a screen
  // reader can reach whenever it likes; the live region used to repeat it on
  // every sample, once a second by default, which drowned out the rest of the
  // page. It now speaks only when the reading crosses the threshold.
  const above = threshold !== undefined && latest !== undefined && latest > threshold.value
  const [announcement, setAnnouncement] = useState('')
  const wasAbove = useRef(above)
  const describeRef = useRef('')
  describeRef.current =
    threshold && latest !== undefined
      ? `${label}: ${format(latest)}, ${above ? 'above' : 'back below'} ${threshold.label}`
      : ''
  useEffect(() => {
    if (above === wasAbove.current) return
    wasAbove.current = above
    if (describeRef.current) setAnnouncement(describeRef.current)
  }, [above])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Text size="caption" tone="faint">
          {label}
        </Text>
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span
              aria-hidden="true"
              className="motion-safe-only absolute inset-0 rounded-full"
              style={
                {
                  background: color,
                  animation: 'live-pulse 1.4s ease-out infinite',
                } as CSSProperties
              }
            />
            <span aria-hidden="true" className="relative h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          </span>
          <Text as="span" size="stat" tabular>
            {latest === undefined ? '—' : format(latest)}
          </Text>
        </span>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-glyph)] bg-surface-sunken">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {threshold && (
            <line
              x1={0}
              x2={width}
              y1={y(threshold.value)}
              y2={y(threshold.value)}
              stroke="var(--color-danger)"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          )}

          {/* One transform carries the whole series; the path itself is static
              between samples, so nothing is recomputed per frame. */}
          <g ref={groupRef}>
            {area && fill && <path d={fill} fill={color} fillOpacity={0.14} />}
            {points.length > 1 && (
              <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {head && <circle cx={head[0]} cy={head[1]} r={3} fill={color} />}
          </g>
        </svg>
      </div>

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {announcement}
        </p>
      </VisuallyHidden>
    </div>
  )
}
