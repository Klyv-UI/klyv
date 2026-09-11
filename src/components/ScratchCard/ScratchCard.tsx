'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface ScratchCardProps {
  /** What is underneath. Rendered immediately; the cover hides it. */
  children: ReactNode
  /** Prompt drawn on the cover. */
  label?: string
  /** Cover colour, or any CSS gradient. */
  cover?: string
  /** Brush radius in pixels. */
  brush?: number
  /** Fraction cleared before it reveals the rest, 0–1. */
  threshold?: number
  /** Reveal it from the outside — a "reveal all" control elsewhere. */
  revealed?: boolean
  onReveal?: () => void
  /** Text for the keyboard fallback control. */
  revealLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A cover you scratch away with the pointer to reveal what is under it.
 *
 * The cover is a canvas painted opaque and erased with
 * `globalCompositeOperation = 'destination-out'`, which is the only way to cut
 * a soft-edged hole in a filled layer without compositing a second element per
 * stroke.
 *
 * Two decisions make it usable rather than a toy. Progress is sampled on a
 * coarse grid — every 12th pixel of the alpha channel — because reading every
 * pixel of a 600×300 cover on each stroke is 180,000 array accesses for a
 * number that only needs to be roughly right. And because scratching is a
 * pointer gesture with no keyboard equivalent, there is always a real button:
 * the reveal is never *only* available to someone holding a mouse.
 */
export function ScratchCard({
  children,
  label = 'Scratch to reveal',
  cover = 'linear-gradient(135deg, var(--color-line-strong) 0%, var(--color-surface-muted) 45%, var(--color-line) 100%)',
  brush = 26,
  threshold = 0.45,
  revealed,
  onReveal,
  revealLabel = 'Reveal',
  className,
}: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const [cleared, setCleared] = useState(false)

  const isOpen = revealed ?? cleared

  const paintCover = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !wrap || !context) return

    const rect = wrap.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(rect.width * ratio))
    canvas.height = Math.max(1, Math.round(rect.height * ratio))
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    context.globalCompositeOperation = 'source-over'
    if (cover.includes('gradient')) {
      // Approximate any CSS gradient with a diagonal one; the exact stops are
      // not worth a full CSS gradient parser here.
      const gradient = context.createLinearGradient(0, 0, rect.width, rect.height)
      // Read off the tokens so the foil sits in whichever theme is on.
      const styles = getComputedStyle(canvas)
      const token = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback
      gradient.addColorStop(0, token('--color-line-strong', '#d7ddd2'))
      gradient.addColorStop(0.5, token('--color-surface-muted', '#eef1ea'))
      gradient.addColorStop(1, token('--color-line', '#c9d2c2'))
      context.fillStyle = gradient
    } else {
      context.fillStyle = cover
    }
    context.fillRect(0, 0, rect.width, rect.height)
  }, [cover])

  useEffect(() => {
    paintCover()
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => {
      if (!isOpen) paintCover()
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [isOpen, paintCover])

  const measureCleared = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return 0
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = 0
    let sampled = 0
    // Every 12th pixel: enough resolution for a threshold, 12× less work.
    for (let i = 3; i < data.length; i += 4 * 12) {
      if (data[i] < 24) transparent += 1
      sampled += 1
    }
    return sampled === 0 ? 0 : transparent / sampled
  }

  const scratch = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || isOpen) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    context.globalCompositeOperation = 'destination-out'
    context.lineWidth = brush * 2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    const previous = lastPoint.current ?? { x, y }
    context.moveTo(previous.x, previous.y)
    context.lineTo(x, y)
    context.stroke()
    context.beginPath()
    context.arc(x, y, brush, 0, Math.PI * 2)
    context.fill()
    lastPoint.current = { x, y }

    if (measureCleared() >= threshold) reveal()
  }

  const reveal = () => {
    if (isOpen) return
    setCleared(true)
    onReveal?.()
  }

  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <div
        ref={wrapRef}
        className="relative isolate w-full overflow-hidden rounded-[var(--radius-card)]"
      >
        {children}
        <canvas
          ref={canvasRef}
          onPointerDown={(event) => {
            drawing.current = true
            lastPoint.current = null
            event.currentTarget.setPointerCapture(event.pointerId)
            scratch(event)
          }}
          onPointerMove={scratch}
          onPointerUp={() => {
            drawing.current = false
            lastPoint.current = null
          }}
          onPointerCancel={() => {
            drawing.current = false
          }}
          aria-hidden="true"
          className={cn(
            'absolute inset-0 h-full w-full touch-none transition-opacity duration-[var(--duration-slow)]',
            isOpen ? 'pointer-events-none opacity-0' : 'cursor-crosshair opacity-100',
          )}
        />
        {!isOpen && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Text size="label" weight="bold" tone="soft" className="uppercase tracking-[0.18em]">
              {label}
            </Text>
          </div>
        )}
      </div>

      {!isOpen && (
        <button
          type="button"
          onClick={reveal}
          className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
        >
          {revealLabel}
        </button>
      )}
    </div>
  )
}
