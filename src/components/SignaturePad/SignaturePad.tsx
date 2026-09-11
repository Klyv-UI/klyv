'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

interface Point {
  x: number
  y: number
  /** Milliseconds since the stroke began — used to derive speed. */
  t: number
}

export interface SignaturePadProps {
  /** Accessible name — what is being signed. */
  label: string
  /** Called after every finished stroke, with the current image. */
  onChange?: (dataUrl: string | null) => void
  /** Pad height in pixels. */
  height?: number
  /** Nominal stroke width. Speed varies it either side of this. */
  weight?: number
  /** Any CSS colour for the stroke. A `var(--token)` reference is resolved. */
  color?: string
  /** Line the signature sits on. */
  guide?: boolean
  /** Copy under the pad. */
  hint?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A pad you sign with a pointer, with the stroke thinning as the hand moves
 * faster.
 *
 * Points are joined with quadratic curves through their midpoints rather than
 * with straight segments. A polyline through raw pointer samples is visibly
 * faceted at speed — the sampling rate is not high enough to hide the corners —
 * and the midpoint trick smooths it without needing to fit a spline.
 *
 * Width comes from the distance between consecutive samples, which is speed in
 * everything but name. That is what makes it read as a pen: fast strokes go
 * thin, slow ones go thick, and a signature ends up with the weight variation a
 * fixed-width line never has.
 *
 * Strokes are kept as arrays of points, not as pixels, so undo is popping one
 * off and repainting rather than a stack of bitmaps — and a resize repaints at
 * the new size instead of stretching what was already drawn.
 */
export function SignaturePad({
  label,
  onChange,
  height = 180,
  weight = 2.4,
  color = 'var(--color-ink)',
  guide = true,
  hint = 'Sign with a finger, a stylus or the mouse.',
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Point[][]>([])
  const active = useRef<Point[] | null>(null)
  const startedAt = useRef(0)
  const [empty, setEmpty] = useState(true)

  const repaint = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const box = canvas.getBoundingClientRect()
    context.clearRect(0, 0, box.width, box.height)
    context.strokeStyle = color.startsWith('var(')
      ? getComputedStyle(canvas).getPropertyValue(color.slice(4, -1)).trim() || '#17191c'
      : color
    context.lineCap = 'round'
    context.lineJoin = 'round'

    for (const stroke of [...strokes.current, active.current].filter(Boolean) as Point[][]) {
      if (stroke.length < 2) {
        if (stroke.length === 1) {
          context.beginPath()
          context.arc(stroke[0].x, stroke[0].y, weight / 2, 0, Math.PI * 2)
          context.fillStyle = context.strokeStyle
          context.fill()
        }
        continue
      }

      for (let i = 1; i < stroke.length; i += 1) {
        const from = stroke[i - 1]
        const to = stroke[i]
        const speed = Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, to.t - from.t)
        // Faster hand, thinner line — clamped so it never disappears.
        context.lineWidth = Math.max(weight * 0.45, weight * (1.35 - Math.min(speed, 1.6) * 0.55))
        context.beginPath()
        context.moveTo(from.x, from.y)
        // Curve through the midpoint: smooth without fitting a spline.
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2
        context.quadraticCurveTo(from.x, from.y, midX, midY)
        context.lineTo(to.x, to.y)
        context.stroke()
      }
    }
  }, [color, weight])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.round(box.width * ratio)
      canvas.height = Math.round(box.height * ratio)
      canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
      // Strokes are points, not pixels, so this redraws rather than stretches.
      repaint()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return () => observer.disconnect()
  }, [repaint])

  const report = () => {
    const canvas = canvasRef.current
    const blank = strokes.current.length === 0
    setEmpty(blank)
    onChange?.(blank || !canvas ? null : canvas.toDataURL('image/png'))
  }

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - box.left,
      y: event.clientY - box.top,
      t: performance.now() - startedAt.current,
    }
  }

  const undo = () => {
    strokes.current = strokes.current.slice(0, -1)
    repaint()
    report()
  }

  const clear = () => {
    strokes.current = []
    active.current = null
    repaint()
    report()
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {guide && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 bottom-10 h-px bg-line-strong"
          />
        )}
        <canvas
          ref={canvasRef}
          aria-label={label}
          role="img"
          className="w-full touch-none"
          style={{ height }}
          onPointerDown={(event) => {
            startedAt.current = performance.now()
            active.current = [pointFrom(event)]
            event.currentTarget.setPointerCapture(event.pointerId)
            repaint()
          }}
          onPointerMove={(event) => {
            if (!active.current) return
            active.current.push(pointFrom(event))
            repaint()
          }}
          onPointerUp={() => {
            if (!active.current) return
            strokes.current = [...strokes.current, active.current]
            active.current = null
            repaint()
            report()
          }}
          onPointerCancel={() => {
            active.current = null
            repaint()
          }}
        />
        {empty && (
          <Text
            size="caption"
            tone="faint"
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-4 text-center"
          >
            {hint}
          </Text>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={undo}
          disabled={empty}
          className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-40"
        >
          Undo stroke
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={empty}
          className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-40"
        >
          Clear
        </button>
        <Text size="caption" tone="faint" role="status" aria-live="polite" className="ml-auto">
          {empty ? 'Not signed' : 'Signed'}
        </Text>
      </div>
    </div>
  )
}
