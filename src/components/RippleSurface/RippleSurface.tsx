'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface RippleSurfaceProps {
  /** Content the ripple plays over. */
  children: ReactNode
  /** Rings per drop. More reads as heavier water. */
  rings?: number
  /** Seconds a ring takes to fade out. */
  duration?: number
  /** Ring colour. */
  color?: string
  /** Drop on hover as well as on press. */
  onHover?: boolean
  /** Random drops every N milliseconds, as if it were raining. 0 is off. */
  rain?: number
  /** Merged last, so it wins. */
  className?: string
}

interface Drop {
  x: number
  y: number
  born: number
}

/**
 * Water: press anywhere and rings spread out from the point.
 *
 * Every drop is drawn from the same clock, so rings from different presses stay
 * in phase with their own origin instead of being restarted by the next one.
 * Implementations that keep a single animation and move it can only ever show
 * one ripple; keeping a list of drops with birth timestamps is what lets six
 * overlap correctly.
 *
 * Each ring's opacity falls off with the *square* of its age rather than
 * linearly, because a linear fade reads as a shrinking circle rather than as
 * energy dissipating. The line also thins as it expands, which is the other
 * half of that impression.
 *
 * Dead drops are pruned each frame, so a surface pressed a hundred times costs
 * exactly as much as one pressed twice.
 */
export function RippleSurface({
  children,
  rings = 3,
  duration = 1.8,
  color = 'rgba(255,255,255,0.8)',
  onHover = false,
  rain = 0,
  className,
}: RippleSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drops = useRef<Drop[]>([])
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || reducedMotion) return

    let width = 0
    let height = 0
    let frame = 0

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = box.width
      height = box.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const step = (now: number) => {
      context.clearRect(0, 0, width, height)
      // Prune first: a hundred presses cost the same as two.
      drops.current = drops.current.filter((drop) => now - drop.born < duration * 1000)

      const reach = Math.hypot(width, height) * 0.6
      for (const drop of drops.current) {
        const age = (now - drop.born) / (duration * 1000)
        for (let ring = 0; ring < rings; ring += 1) {
          const offset = ring * 0.14
          const life = age - offset
          if (life <= 0 || life >= 1) continue
          // Squared falloff: energy dissipating, not a circle shrinking.
          context.globalAlpha = (1 - life) * (1 - life) * (1 - ring * 0.22)
          context.strokeStyle = color
          context.lineWidth = Math.max(0.4, 2.4 * (1 - life))
          context.beginPath()
          context.arc(drop.x, drop.y, life * reach, 0, Math.PI * 2)
          context.stroke()
        }
      }
      context.globalAlpha = 1
      frame = requestAnimationFrame(step)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    frame = requestAnimationFrame(step)

    let rainTimer = 0
    if (rain > 0) {
      rainTimer = window.setInterval(() => {
        drops.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          born: performance.now(),
        })
      }, rain)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      if (rainTimer) window.clearInterval(rainTimer)
    }
  }, [color, duration, rain, reducedMotion, rings])

  const drop = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = canvasRef.current?.getBoundingClientRect()
    if (!box) return
    drops.current.push({
      x: event.clientX - box.left,
      y: event.clientY - box.top,
      born: performance.now(),
    })
  }

  return (
    <div
      onPointerDown={drop}
      onPointerMove={onHover ? drop : undefined}
      className={cn('relative isolate overflow-hidden', className)}
    >
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  )
}
