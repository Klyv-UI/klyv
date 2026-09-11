'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface ParticleFieldProps {
  /** Particles per 10,000 square pixels of surface. 6 is roughly 90 in a wide panel. */
  density?: number
  /** Pixels per second, before the per-particle jitter. */
  speed?: number
  /** Dot colour. Any CSS colour. */
  color?: string
  /** Draw a line between particles that are close to each other. */
  linked?: boolean
  /** Radius in which the pointer pulls particles towards it. 0 turns it off. */
  pull?: number
  /** Dot radius in pixels. */
  dotSize?: number
  /** Merged last, so it wins. */
  className?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

const LINK_DISTANCE = 118

/**
 * A drifting constellation on a canvas, optionally linked and pointer-reactive.
 *
 * Canvas rather than DOM because the link pass is O(n²) over positions: at 90
 * particles that is 4,000 distance checks a frame, which is nothing for a
 * typed array and impossible for 90 absolutely positioned divs.
 *
 * Two details make it safe to leave running behind real UI. The canvas is
 * backing-store scaled to `devicePixelRatio` and re-scaled by a ResizeObserver,
 * so it stays sharp through a window resize or a sidebar opening. And under
 * `prefers-reduced-motion` it paints exactly one frame and stops — the texture
 * survives, the movement does not.
 */
export function ParticleField({
  density = 6,
  speed = 14,
  color = 'var(--color-accent-strong)',
  linked = true,
  pull = 110,
  dotSize = 1.9,
  className,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    // Resolve the token once — canvas cannot read a CSS variable itself.
    const resolved = color.startsWith('var(')
      ? getComputedStyle(canvas).getPropertyValue(color.slice(4, -1)).trim() || '#b9e93a'
      : color

    let width = 0
    let height = 0
    let particles: Particle[] = []
    let frame = 0
    let last = performance.now()
    const pointer = { x: -9999, y: -9999 }

    const seed = () => {
      const target = Math.round((width * height) / 10000 * density)
      particles = Array.from({ length: Math.max(8, target) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        r: dotSize * (0.6 + Math.random() * 0.8),
      }))
    }

    const draw = () => {
      context.clearRect(0, 0, width, height)

      if (linked) {
        for (let i = 0; i < particles.length; i += 1) {
          for (let j = i + 1; j < particles.length; j += 1) {
            const dx = particles[i].x - particles[j].x
            const dy = particles[i].y - particles[j].y
            const distance = Math.hypot(dx, dy)
            if (distance > LINK_DISTANCE) continue
            context.globalAlpha = (1 - distance / LINK_DISTANCE) * 0.28
            context.strokeStyle = resolved
            context.lineWidth = 1
            context.beginPath()
            context.moveTo(particles[i].x, particles[i].y)
            context.lineTo(particles[j].x, particles[j].y)
            context.stroke()
          }
        }
      }

      context.globalAlpha = 0.75
      context.fillStyle = resolved
      for (const particle of particles) {
        context.beginPath()
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
    }

    const step = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05)
      last = now

      for (const particle of particles) {
        particle.x += particle.vx * speed * delta
        particle.y += particle.vy * speed * delta

        if (pull > 0) {
          const dx = pointer.x - particle.x
          const dy = pointer.y - particle.y
          const distance = Math.hypot(dx, dy)
          if (distance < pull && distance > 1) {
            const force = (1 - distance / pull) * 26 * delta
            particle.x += (dx / distance) * force
            particle.y += (dy / distance) * force
          }
        }

        // Wrap rather than bounce: a bounce makes the edges visibly denser.
        if (particle.x < -20) particle.x = width + 20
        if (particle.x > width + 20) particle.x = -20
        if (particle.y < -20) particle.y = height + 20
        if (particle.y > height + 20) particle.y = -20
      }

      draw()
      frame = requestAnimationFrame(step)
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      seed()
      if (reducedMotion) draw()
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
    }
    const onPointerLeave = () => {
      pointer.x = -9999
      pointer.y = -9999
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    if (!reducedMotion) {
      frame = requestAnimationFrame(step)
      if (pull > 0) {
        canvas.parentElement?.addEventListener('pointermove', onPointerMove)
        canvas.parentElement?.addEventListener('pointerleave', onPointerLeave)
      }
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.parentElement?.removeEventListener('pointermove', onPointerMove)
      canvas.parentElement?.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [color, density, dotSize, linked, pull, reducedMotion, speed])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}
