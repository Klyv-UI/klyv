'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface MatrixRainProps {
  /** Glyphs to fall. Katakana by default, because that is the look. */
  glyphs?: string
  /** Font size in pixels. Column width follows it. */
  size?: number
  /** Rows advanced per second. */
  speed?: number
  /** Any CSS colour for the trailing glyphs. */
  color?: string
  /** The leading glyph of each column, brighter than the tail. */
  headColor?: string
  /** How long a tail persists, 0 to 1. Higher is longer. */
  trail?: number
  /** Merged last, so it wins. */
  className?: string
}

const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789'

/**
 * Glyphs falling in columns, brightest at the leading edge.
 *
 * The tail is not drawn. Each frame paints a translucent black rectangle over
 * the whole canvas before writing the new glyphs, so everything already there
 * fades by a fixed fraction — the trail is the *accumulated* residue of
 * previous frames rather than a list of characters anyone is tracking. That is
 * the entire trick, and it means a hundred columns cost one fill and one glyph
 * each.
 *
 * Columns fall at their own rates and reset at random heights, so the field
 * never develops a visible horizontal band. Resetting them all at the bottom
 * is the mistake that makes this read as a loop.
 *
 * The whole thing is `aria-hidden`: it is texture, and there is no reading of
 * it that helps anybody.
 */
export function MatrixRain({
  glyphs = KATAKANA,
  size = 16,
  speed = 14,
  color = 'var(--color-accent-strong)',
  headColor = '#ffffff',
  trail = 0.92,
  className,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const resolved = color.startsWith('var(')
      ? getComputedStyle(canvas).getPropertyValue(color.slice(4, -1)).trim() || '#b9e93a'
      : color

    let width = 0
    let height = 0
    let columns: number[] = []
    let frame = 0
    let last = performance.now()

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = box.width
      height = box.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.font = `${size}px ui-monospace, monospace`
      context.textBaseline = 'top'
      // Random start heights: reset every column at the bottom and the field
      // develops a visible band.
      columns = Array.from({ length: Math.ceil(width / size) }, () =>
        Math.floor((Math.random() * -height) / size),
      )
      context.fillStyle = '#000'
      context.fillRect(0, 0, width, height)
    }

    const draw = () => {
      // The trail is residue, not a list of characters.
      context.fillStyle = `rgba(0, 0, 0, ${1 - trail})`
      context.fillRect(0, 0, width, height)

      for (let i = 0; i < columns.length; i += 1) {
        const glyph = glyphs[Math.floor(Math.random() * glyphs.length)]
        const x = i * size
        const y = columns[i] * size

        context.fillStyle = headColor
        context.fillText(glyph, x, y)
        context.fillStyle = resolved
        context.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], x, y - size)

        columns[i] += 1
        if (y > height && Math.random() > 0.975) columns[i] = 0
      }
    }

    const step = (now: number) => {
      if (now - last >= 1000 / speed) {
        last = now
        draw()
      }
      frame = requestAnimationFrame(step)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    if (reducedMotion) {
      // A few passes, then stop: the texture without the movement.
      for (let i = 0; i < 24; i += 1) draw()
    } else {
      frame = requestAnimationFrame(step)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [color, glyphs, headColor, reducedMotion, size, speed, trail])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('block h-full w-full bg-black', className)}
    />
  )
}
