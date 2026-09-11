'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface BoidsFlockProps {
  /** How many. Two hundred is comfortable; the neighbour search is the cost. */
  count?: number
  /** How far a boid can see. */
  vision?: number
  /** Weights for the three classic rules. */
  separation?: number
  /** How strongly a bird matches the heading of its neighbours. */
  alignment?: number
  /** How strongly a bird steers toward the middle of its neighbours. */
  cohesion?: number
  /** Top speed, in pixels per frame. */
  speed?: number
  /** Follow the pointer, or flee it. */
  pointer?: 'attract' | 'flee' | 'ignore'
  /** Any CSS colour for the birds. */
  color?: string
  /** Merged last, so it wins. */
  className?: string
}

interface Boid {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * A flock, from three rules and nothing else.
 *
 * Separation, alignment and cohesion — steer away from anyone too close, match
 * the average heading of your neighbours, and drift towards their centre. No
 * boid knows about the flock; the flock is what the rules add up to. Reynolds
 * published this in 1986 and it is still the cheapest way to make a screen
 * look alive.
 *
 * Neighbours are found on a spatial grid rather than by comparing every pair.
 * Two hundred boids compared naively is forty thousand distance checks a
 * frame; bucketing them by vision radius and checking only the nine
 * surrounding cells brings it down to a few hundred, which is the difference
 * between this running on a phone and not.
 *
 * Boids are drawn as triangles pointed along their velocity, because a dot
 * gives away nothing about heading — and heading is the only thing the rules
 * actually produce.
 */
export function BoidsFlock({
  count = 180,
  vision = 46,
  separation = 1.5,
  alignment = 1,
  cohesion = 0.9,
  speed = 2.6,
  pointer = 'attract',
  color = 'var(--color-accent-strong)',
  className,
}: BoidsFlockProps) {
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
    let boids: Boid[] = []
    let frame = 0
    const mouse = { x: -9999, y: -9999 }

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = box.width
      height = box.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      boids = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        }
      })
    }

    const step = () => {
      // Bucket by vision radius: nine cells instead of every pair.
      const cell = vision
      const grid = new Map<string, Boid[]>()
      for (const boid of boids) {
        const key = `${Math.floor(boid.x / cell)},${Math.floor(boid.y / cell)}`
        const bucket = grid.get(key)
        if (bucket) bucket.push(boid)
        else grid.set(key, [boid])
      }

      for (const boid of boids) {
        let closeX = 0
        let closeY = 0
        let avgVx = 0
        let avgVy = 0
        let avgX = 0
        let avgY = 0
        let neighbours = 0

        const cx = Math.floor(boid.x / cell)
        const cy = Math.floor(boid.y / cell)
        for (let ox = -1; ox <= 1; ox += 1) {
          for (let oy = -1; oy <= 1; oy += 1) {
            for (const other of grid.get(`${cx + ox},${cy + oy}`) ?? []) {
              if (other === boid) continue
              const dx = boid.x - other.x
              const dy = boid.y - other.y
              const distance = Math.hypot(dx, dy)
              if (distance > vision) continue
              if (distance < vision * 0.35) {
                closeX += dx
                closeY += dy
              }
              avgVx += other.vx
              avgVy += other.vy
              avgX += other.x
              avgY += other.y
              neighbours += 1
            }
          }
        }

        if (neighbours > 0) {
          boid.vx += (avgVx / neighbours - boid.vx) * 0.05 * alignment
          boid.vy += (avgVy / neighbours - boid.vy) * 0.05 * alignment
          boid.vx += (avgX / neighbours - boid.x) * 0.0009 * cohesion
          boid.vy += (avgY / neighbours - boid.y) * 0.0009 * cohesion
        }
        boid.vx += closeX * 0.05 * separation
        boid.vy += closeY * 0.05 * separation

        if (pointer !== 'ignore' && mouse.x > -9000) {
          const dx = mouse.x - boid.x
          const dy = mouse.y - boid.y
          const distance = Math.hypot(dx, dy)
          if (distance < 220 && distance > 1) {
            const pull = (pointer === 'attract' ? 0.035 : -0.09) * (1 - distance / 220)
            boid.vx += (dx / distance) * pull * 10
            boid.vy += (dy / distance) * pull * 10
          }
        }

        const pace = Math.hypot(boid.vx, boid.vy)
        if (pace > speed) {
          boid.vx = (boid.vx / pace) * speed
          boid.vy = (boid.vy / pace) * speed
        }

        boid.x += boid.vx
        boid.y += boid.vy

        // Wrap: a bounce makes the edges visibly denser.
        if (boid.x < -10) boid.x = width + 10
        if (boid.x > width + 10) boid.x = -10
        if (boid.y < -10) boid.y = height + 10
        if (boid.y > height + 10) boid.y = -10
      }
    }

    const draw = () => {
      context.clearRect(0, 0, width, height)
      context.fillStyle = resolved
      for (const boid of boids) {
        const angle = Math.atan2(boid.vy, boid.vx)
        // A triangle, because a dot gives away nothing about heading.
        context.save()
        context.translate(boid.x, boid.y)
        context.rotate(angle)
        context.beginPath()
        context.moveTo(6, 0)
        context.lineTo(-4, 3)
        context.lineTo(-4, -3)
        context.closePath()
        context.fill()
        context.restore()
      }
    }

    const loop = () => {
      step()
      draw()
      frame = requestAnimationFrame(loop)
    }

    const onPointerMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect()
      mouse.x = event.clientX - box.left
      mouse.y = event.clientY - box.top
    }
    const onPointerLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    if (reducedMotion) {
      draw()
    } else {
      frame = requestAnimationFrame(loop)
      canvas.parentElement?.addEventListener('pointermove', onPointerMove)
      canvas.parentElement?.addEventListener('pointerleave', onPointerLeave)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.parentElement?.removeEventListener('pointermove', onPointerMove)
      canvas.parentElement?.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [alignment, cohesion, color, count, pointer, reducedMotion, separation, speed, vision])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('block h-full w-full', className)}
    />
  )
}
