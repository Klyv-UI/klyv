'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface StarFieldProps {
  /** How many stars. */
  count?: number
  /** Travel speed. Negative flies backwards. */
  speed?: number
  /** Stretch stars into streaks past this speed — the jump to lightspeed. */
  warpAt?: number
  /** Any CSS colour for the stars. */
  color?: string
  /** Steer towards the pointer. */
  steer?: boolean
  /** Merged last, so it wins. */
  className?: string
}

interface Star {
  x: number
  y: number
  z: number
  pz: number
}

/**
 * Flying through stars, with a warp when you go fast enough.
 *
 * Each star is a point in three dimensions and the screen position is
 * `x / z` — a perspective divide, one multiply per star per frame. That single
 * division is what produces the whole effect: stars near the centre have large
 * z and barely move, stars at the edge have small z and tear past, and nothing
 * needs a 3D library to say so.
 *
 * The streaks are drawn between each star's position now and its position on
 * the *previous* frame, which is why every star stores its own `pz`. Drawing a
 * fixed-length line in the direction of travel is the usual shortcut and it
 * gets the geometry wrong at the edges, where the streak should be longest.
 *
 * Stars recycle by being thrown back to the far plane at a new random x and y,
 * so the field never thins out and never repeats.
 */
export function StarField({
  count = 420,
  speed = 6,
  warpAt = 14,
  color = '#ffffff',
  steer = true,
  className,
}: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const speedRef = useRef(speed)
  const reducedMotion = usePrefersReducedMotion()

  speedRef.current = speed

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let width = 0
    let height = 0
    let stars: Star[] = []
    let frame = 0
    const centre = { x: 0, y: 0 }

    const seed = () => {
      stars = Array.from({ length: count }, () => {
        const z = Math.random() * width
        return {
          x: (Math.random() - 0.5) * width * 2,
          y: (Math.random() - 0.5) * height * 2,
          z,
          pz: z,
        }
      })
    }

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = box.width
      height = box.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      centre.x = width / 2
      centre.y = height / 2
      seed()
    }

    const draw = () => {
      context.fillStyle = '#05070c'
      context.fillRect(0, 0, width, height)
      context.strokeStyle = color
      context.fillStyle = color

      const warping = Math.abs(speedRef.current) > warpAt

      for (const star of stars) {
        star.pz = star.z
        star.z -= speedRef.current
        if (star.z <= 1) {
          star.z = width
          star.pz = width
          star.x = (Math.random() - 0.5) * width * 2
          star.y = (Math.random() - 0.5) * height * 2
        }
        if (star.z >= width) {
          star.z = 1
          star.pz = 1
        }

        // The perspective divide. This one line is the whole effect.
        const x = centre.x + (star.x / star.z) * centre.x
        const y = centre.y + (star.y / star.z) * centre.y
        const size = Math.max(0.4, (1 - star.z / width) * 2.6)

        if (warping) {
          // Between now and where it was, so edge streaks are longest.
          const px = centre.x + (star.x / star.pz) * centre.x
          const py = centre.y + (star.y / star.pz) * centre.y
          context.globalAlpha = Math.min(1, 1 - star.z / width + 0.15)
          context.lineWidth = size
          context.beginPath()
          context.moveTo(px, py)
          context.lineTo(x, y)
          context.stroke()
        } else {
          context.globalAlpha = Math.min(1, 1 - star.z / width + 0.2)
          context.beginPath()
          context.arc(x, y, size, 0, Math.PI * 2)
          context.fill()
        }
      }
      context.globalAlpha = 1
    }

    const step = () => {
      draw()
      frame = requestAnimationFrame(step)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!steer) return
      const box = canvas.getBoundingClientRect()
      // Eased, so the vanishing point drifts rather than snapping.
      centre.x += (event.clientX - box.left - centre.x) * 0.08
      centre.y += (event.clientY - box.top - centre.y) * 0.08
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    if (reducedMotion) {
      draw()
    } else {
      frame = requestAnimationFrame(step)
      canvas.parentElement?.addEventListener('pointermove', onPointerMove)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.parentElement?.removeEventListener('pointermove', onPointerMove)
    }
  }, [color, count, reducedMotion, steer, warpAt])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('block h-full w-full', className)}
      style={{ background: '#05070c' }}
    />
  )
}
