'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { svgId } from '../internal/plot'

export type AnimatedGridVariant = 'lines' | 'dots'

export interface AnimatedGridProps {
  /** Grid lines, or a dot at every intersection. */
  variant?: AnimatedGridVariant
  /** Size of one cell in pixels. */
  cellSize?: number
  /** Cells lit at any moment. */
  lit?: number
  /** Milliseconds between changes. Each change swaps a few cells, not all of them. */
  interval?: number
  /** Fade the grid out towards the edges, so it sits behind a heading rather than boxing it in. */
  fade?: boolean
  /** Freeze the pattern. */
  paused?: boolean
  /** Merged last, so it wins. Place the layer inside a positioned container. */
  className?: string
}

interface Slot {
  column: number
  row: number
  on: boolean
}

const noise = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

/**
 * A quiet grid behind content, with a few cells softly lighting up in the
 * accent and fading out again.
 *
 * The grid itself is one SVG pattern, however many cells it covers; only the
 * lit cells are real elements, a fixed pool of them. On each beat a few of the
 * pool fade out and a few fade back in somewhere new — a CSS opacity
 * transition does the fading, so the only JavaScript is a timer choosing
 * cells. The edges fade through a radial mask rather than a colour overlay, so
 * the layer works on any surface in either theme.
 *
 * The timer stops while the layer is off screen or the tab is hidden. Under
 * reduced motion the same cells are lit and nothing changes. It is
 * `aria-hidden` and ignores the pointer.
 */
export function AnimatedGrid({
  variant = 'lines',
  cellSize = 36,
  lit = 10,
  interval = 1400,
  fade = true,
  paused = false,
  className,
}: AnimatedGridProps) {
  const patternId = svgId(`${useId()}grid`)
  const layerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [size, setSize] = useState({ columns: 24, rows: 12 })
  const [visible, setVisible] = useState(true)
  const [slots, setSlots] = useState<Slot[]>([])
  const beat = useRef(0)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const measure = () => {
      const box = layer.getBoundingClientRect()
      if (!box.width || !box.height) return
      setSize({ columns: Math.ceil(box.width / cellSize), rows: Math.ceil(box.height / cellSize) })
    }
    measure()
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resize?.observe(layer)
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer?.observe(layer)
    return () => {
      resize?.disconnect()
      observer?.disconnect()
    }
  }, [cellSize])

  // A seeded starting pattern, so the server and the first client render agree.
  useEffect(() => {
    setSlots(
      Array.from({ length: Math.max(0, lit) }, (_, index) => ({
        column: Math.floor(noise(index, 1) * size.columns),
        row: Math.floor(noise(index, 2) * size.rows),
        on: true,
      })),
    )
  }, [lit, size.columns, size.rows])

  useEffect(() => {
    if (reducedMotion || paused || !visible) return
    const timer = window.setInterval(() => {
      if (document.hidden) return
      beat.current += 1
      setSlots((current) =>
        current.map((slot, index) => {
          // About a third of the pool changes per beat.
          if (noise(index, beat.current * 3.1) > 0.34) return slot
          if (slot.on) return { ...slot, on: false }
          return {
            column: Math.floor(noise(index, beat.current + 7) * size.columns),
            row: Math.floor(noise(index, beat.current + 11) * size.rows),
            on: true,
          }
        }),
      )
    }, interval)
    return () => window.clearInterval(timer)
  }, [reducedMotion, paused, visible, interval, size.columns, size.rows])

  const mask = fade ? 'radial-gradient(ellipse at center, black 25%, transparent 72%)' : undefined

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <svg className="absolute inset-0 size-full">
        <defs>
          <pattern id={patternId} width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
            {variant === 'lines' ? (
              <path d={`M${cellSize} 0V${cellSize}H0`} fill="none" className="stroke-line-strong" strokeWidth="1" />
            ) : (
              <circle cx={cellSize} cy={cellSize} r="1.25" className="fill-ink-faint" opacity="0.45" />
            )}
          </pattern>
        </defs>
        {slots.map((slot, index) => (
          <rect
            key={index}
            x={slot.column * cellSize + (variant === 'lines' ? 0.5 : cellSize * 0.2)}
            y={slot.row * cellSize + (variant === 'lines' ? 0.5 : cellSize * 0.2)}
            width={variant === 'lines' ? cellSize - 1 : cellSize * 0.6}
            height={variant === 'lines' ? cellSize - 1 : cellSize * 0.6}
            rx={variant === 'lines' ? 0 : cellSize * 0.15}
            className="fill-accent transition-opacity duration-1000 ease-in-out motion-reduce:transition-none"
            opacity={slot.on ? 0.3 : 0}
          />
        ))}
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  )
}
