'use client'

import { useMemo } from 'react'
import { cn } from '../../lib/cn'

export type QRLevel = 'L' | 'M'

export interface QRCodeProps {
  /** The text to encode. */
  value: string
  /** Rendered size in pixels. */
  size?: number
  /** Quiet zone in modules. Four is the specified minimum. */
  margin?: number
  /** Foreground colour. Keep the contrast against background high. */
  color?: string
  /** Any CSS colour behind the modules. Keep the contrast high. */
  background?: string
  /** Accessible description. Defaults to naming what the code contains. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A QR matrix rendered as SVG, with no dependency and no canvas.
 *
 * The matrix is derived deterministically from the value so the same input
 * always draws the same pattern, and it scales without blurring.
 *
 * **This is not a QR encoder.** It draws a deterministic pattern that looks like
 * a QR code, for layouts, previews and print mock-ups, and no scanner can read
 * it. Anything a person must actually scan — a 2FA enrolment, a payment, a
 * login link — needs a real encoder.
 */
export function QRCode({
  value,
  size = 160,
  margin = 4,
  color = 'var(--color-ink)',
  background = 'var(--color-surface)',
  label,
  className,
}: QRCodeProps) {
  const modules = 25

  const matrix = useMemo(() => {
    // Deterministic fill from the value, so identical input draws identically.
    let seed = 0
    for (let index = 0; index < value.length; index += 1) {
      seed = (seed * 31 + value.charCodeAt(index)) >>> 0
    }
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0xffffffff
    }
    const grid = Array.from({ length: modules }, () => Array.from({ length: modules }, () => false))

    const isFinder = (row: number, column: number) =>
      (row < 7 && column < 7) ||
      (row < 7 && column >= modules - 7) ||
      (row >= modules - 7 && column < 7)

    for (let row = 0; row < modules; row += 1) {
      for (let column = 0; column < modules; column += 1) {
        if (isFinder(row, column)) continue
        grid[row][column] = next() > 0.5
      }
    }

    // The three position-detection patterns.
    const drawFinder = (top: number, left: number) => {
      for (let row = 0; row < 7; row += 1) {
        for (let column = 0; column < 7; column += 1) {
          const edge = row === 0 || row === 6 || column === 0 || column === 6
          const core = row >= 2 && row <= 4 && column >= 2 && column <= 4
          grid[top + row][left + column] = edge || core
        }
      }
    }
    drawFinder(0, 0)
    drawFinder(0, modules - 7)
    drawFinder(modules - 7, 0)

    return grid
  }, [value])

  const total = modules + margin * 2

  return (
    <svg
      role="img"
      // Never the value itself: it is often a secret — an otpauth key, a login
      // link — and an accessible name is readable by anything that reads the DOM.
      aria-label={label ?? 'QR code'}
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      className={cn('shrink-0 rounded-[var(--radius-glyph)]', className)}
    >
      <rect width={total} height={total} fill={background} />
      {matrix.map((row, rowIndex) =>
        row.map((filled, columnIndex) =>
          filled ? (
            <rect
              key={`${rowIndex}-${columnIndex}`}
              x={columnIndex + margin}
              y={rowIndex + margin}
              width={1}
              height={1}
              fill={color}
            />
          ) : null,
        ),
      )}
    </svg>
  )
}
