'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export interface AsciiImageProps {
  /** Image to convert. Same-origin, or CORS-enabled — the canvas has to read it. */
  src: string
  /** What the picture is. The ASCII is decorative; this is the alt text. */
  alt: string
  /** Characters across. Height follows the aspect ratio. */
  columns?: number
  /** Darkest to lightest. The first character is used for black. */
  ramp?: string
  /** Invert, for light art on a dark background. */
  invert?: boolean
  /** Colour each character from the source pixel instead of one flat colour. */
  colored?: boolean
  /** Any CSS colour for the glyphs. */
  color?: string
  /** Merged last, so it wins. */
  className?: string
}

const RAMP = '@%#*+=-:. '

/**
 * An image, redrawn as characters.
 *
 * The source is painted into a tiny offscreen canvas — one pixel per output
 * character — and the browser's own image scaling does the averaging. Sampling
 * the full-size image and averaging blocks by hand is the obvious approach and
 * it is both slower and worse: the built-in downscale is filtered properly,
 * where a naive block average aliases.
 *
 * Characters are chosen by luminance against a ramp ordered dark to light.
 * The ramp matters more than anything else here — it has to be ordered by how
 * much ink each glyph actually puts on the screen, which is not the same as
 * alphabetical and is why hand-picked ramps beat generated ones.
 *
 * Cells are half as tall as they are wide in most monospace faces, so the
 * vertical sampling is halved to compensate. Skip that and every conversion
 * comes out stretched.
 */
export function AsciiImage({
  src,
  alt,
  columns = 90,
  ramp = RAMP,
  invert = false,
  colored = false,
  color = 'var(--color-accent-strong)',
  className,
}: AsciiImageProps) {
  const [rows, setRows] = useState<{ char: string; color?: string }[][]>([])
  const [failed, setFailed] = useState(false)
  const holder = useRef<HTMLPreElement>(null)

  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      if (cancelled) return
      // Monospace cells are about twice as tall as wide.
      const height = Math.max(1, Math.round((columns * image.height) / image.width / 2))
      const canvas = document.createElement('canvas')
      canvas.width = columns
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      // One source pixel per output character: the browser filters the
      // downscale properly, where a hand-rolled block average aliases.
      context.drawImage(image, 0, 0, columns, height)
      const { data } = context.getImageData(0, 0, columns, height)

      const next: { char: string; color?: string }[][] = []
      for (let y = 0; y < height; y += 1) {
        const line: { char: string; color?: string }[] = []
        for (let x = 0; x < columns; x += 1) {
          const index = (y * columns + x) * 4
          const r = data[index]
          const g = data[index + 1]
          const b = data[index + 2]
          const alpha = data[index + 3] / 255
          let luminance = ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * alpha
          if (invert) luminance = 1 - luminance
          const step = Math.min(ramp.length - 1, Math.floor(luminance * ramp.length))
          line.push({
            char: ramp[step],
            color: colored ? `rgb(${r},${g},${b})` : undefined,
          })
        }
        next.push(line)
      }
      setRows(next)
    }

    image.onerror = () => {
      if (!cancelled) setFailed(true)
    }
    image.src = src

    return () => {
      cancelled = true
    }
  }, [colored, columns, invert, ramp, src])

  if (failed) {
    return (
      <div className={cn('rounded-[var(--radius-tile)] border border-line p-4', className)}>
        <span className="text-[12px] font-bold text-ink-soft">
          Could not read {alt} — the image has to be same-origin or CORS-enabled.
        </span>
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden', className)}>
      <pre
        ref={holder}
        aria-hidden="true"
        className="w-full select-none whitespace-pre font-mono leading-[1] [font-size:min(1.6vw,9px)]"
        style={{ color: colored ? undefined : color }}
      >
        {rows.map((line, y) => (
          <span key={y} className="block">
            {colored
              ? line.map((cell, x) => (
                  <span key={x} style={{ color: cell.color }}>
                    {cell.char}
                  </span>
                ))
              : line.map((cell) => cell.char).join('')}
          </span>
        ))}
      </pre>
      <VisuallyHidden>{alt}</VisuallyHidden>
    </div>
  )
}
