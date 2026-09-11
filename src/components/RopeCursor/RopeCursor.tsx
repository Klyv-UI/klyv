'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface RopeCursorProps {
  /** Points in the rope. More is heavier and smoother. */
  segments?: number
  /** Distance between points, in pixels. */
  length?: number
  /** Downward pull per frame. 0 makes it a weightless ribbon. */
  gravity?: number
  /** Velocity kept each frame. Lower is more damped. */
  damping?: number
  /** Constraint passes. More is stiffer and less stretchy. */
  stiffness?: number
  /** Any CSS colour for the rope. */
  color?: string
  /** Thickest at the pointer, tapering to nothing at the tail. */
  taper?: boolean
  /** Merged last, so it wins. */
  className?: string
}

interface Point {
  x: number
  y: number
  px: number
  py: number
}

/**
 * A rope that trails the pointer and swings under its own weight.
 *
 * This is Verlet integration: each point stores where it is and where it *was*,
 * and its velocity is the difference between the two. Nothing stores velocity
 * explicitly, which is what makes the constraint step so simple — moving a
 * point to satisfy a distance also changes its velocity, automatically and
 * correctly, because velocity is implied by position.
 *
 * The constraint pass runs several times per frame. One pass fixes each link
 * but breaks the one before it, so a single iteration gives a visibly stretchy
 * rope; four or five converge on something that behaves like rope.
 *
 * The head is pinned to the pointer rather than steered towards it. A rope
 * whose end drifts towards your cursor reads as a fish; one whose end *is* the
 * cursor reads as something you are holding.
 */
export function RopeCursor({
  segments = 26,
  length = 9,
  gravity = 0.55,
  damping = 0.96,
  stiffness = 5,
  color = 'var(--color-accent-strong)',
  taper = true,
  className,
}: RopeCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || reducedMotion) return

    const resolved = color.startsWith('var(')
      ? getComputedStyle(canvas).getPropertyValue(color.slice(4, -1)).trim() || '#b9e93a'
      : color

    let width = 0
    let height = 0
    let frame = 0
    const head = { x: -9999, y: -9999 }
    let rope: Point[] = []

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = box.width
      height = box.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      rope = Array.from({ length: segments }, () => ({
        x: width / 2,
        y: height / 2,
        px: width / 2,
        py: height / 2,
      }))
    }

    const step = () => {
      context.clearRect(0, 0, width, height)
      if (head.x < -9000) {
        frame = requestAnimationFrame(step)
        return
      }

      // Verlet: velocity is implied by the gap between now and last frame.
      for (const point of rope) {
        const vx = (point.x - point.px) * damping
        const vy = (point.y - point.py) * damping
        point.px = point.x
        point.py = point.y
        point.x += vx
        point.y += vy + gravity
      }

      // Several passes: one fixes each link and breaks the one before it.
      for (let pass = 0; pass < stiffness; pass += 1) {
        rope[0].x = head.x
        rope[0].y = head.y
        for (let i = 0; i < rope.length - 1; i += 1) {
          const a = rope[i]
          const b = rope[i + 1]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const distance = Math.hypot(dx, dy) || 0.0001
          const shift = (distance - length) / distance / 2
          const ox = dx * shift
          const oy = dy * shift
          if (i > 0) {
            a.x += ox
            a.y += oy
          }
          b.x -= ox
          b.y -= oy
        }
      }

      context.strokeStyle = resolved
      context.lineCap = 'round'
      context.lineJoin = 'round'
      for (let i = 0; i < rope.length - 1; i += 1) {
        context.lineWidth = taper ? Math.max(0.5, 7 * (1 - i / rope.length)) : 3
        context.globalAlpha = taper ? 1 - (i / rope.length) * 0.65 : 1
        context.beginPath()
        context.moveTo(rope[i].x, rope[i].y)
        context.lineTo(rope[i + 1].x, rope[i + 1].y)
        context.stroke()
      }
      context.globalAlpha = 1

      frame = requestAnimationFrame(step)
    }

    const onPointerMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect()
      head.x = event.clientX - box.left
      head.y = event.clientY - box.top
    }
    const onPointerLeave = () => {
      head.x = -9999
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    frame = requestAnimationFrame(step)

    const parent = canvas.parentElement
    parent?.addEventListener('pointermove', onPointerMove)
    parent?.addEventListener('pointerleave', onPointerLeave)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      parent?.removeEventListener('pointermove', onPointerMove)
      parent?.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [color, damping, gravity, length, reducedMotion, segments, stiffness, taper])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}
