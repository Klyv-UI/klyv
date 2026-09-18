'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface FlowFieldProps {
  /** Particles per 10,000 square pixels. 3 is about 150 in a wide hero. */
  density?: number
  /** Pixels a particle travels per frame at 60fps. */
  speed?: number
  /** How zoomed-in the noise is. Smaller values give broader, calmer currents. */
  scale?: number
  /** How quickly trails fade, from 0 (never) to 1 (no trail at all). */
  fade?: number
  /** Stroke width of each trail in pixels. */
  lineWidth?: number
  /** Colours the particles are drawn in — tokens such as `var(--color-accent)`, or any CSS colour. */
  colors?: string[]
  /** Seed for the noise, so the same field comes back on every visit. */
  seed?: number
  /** Describe the image for assistive tech. Without it the canvas is decorative and hidden. */
  label?: string
  /** Merged last, so it wins. Give the component a size here. */
  className?: string
}

/** A small seeded value-noise: hash lattice corners, blend with a smoothstep. */
function createNoise(seed: number) {
  const permutation = Array.from({ length: 256 }, (_, index) => index)
  let state = seed >>> 0 || 1
  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
  for (let index = 255; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[permutation[index], permutation[swap]] = [permutation[swap]!, permutation[index]!]
  }
  const values = permutation.map(() => random())
  const hash = (index: number) => permutation[index & 255]!
  const lattice = (x: number, y: number, z: number) => values[hash(hash(hash(x) + y) + z)]!
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const mix = (a: number, b: number, t: number) => a + (b - a) * t

  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const u = smooth(x - xi)
    const v = smooth(y - yi)
    const w = smooth(z - zi)
    const plane = (k: number) =>
      mix(mix(lattice(xi, yi, k), lattice(xi + 1, yi, k), u), mix(lattice(xi, yi + 1, k), lattice(xi + 1, yi + 1, k), u), v)
    return mix(plane(zi), plane(zi + 1), w)
  }
}

interface FlowParticle {
  x: number
  y: number
  life: number
  colour: number
}

/**
 * Particles drifting along a smooth, slowly changing current, leaving trails.
 *
 * The current is a small seeded value-noise read as an angle, sampled at each
 * particle’s position — about thirty lines instead of a noise dependency. The
 * third noise axis is time, so the currents bend gradually rather than jumping.
 * Trails come from fading the previous frame with `destination-out` instead of
 * painting a background over it, so the canvas stays transparent and sits on
 * any surface in either theme.
 *
 * The colours are read from the design tokens when drawing starts, and again
 * when the theme changes, because a canvas cannot resolve a CSS variable. The
 * loop stops whenever the canvas is off screen or the tab is hidden. Under
 * reduced motion it runs a few hundred steps in one go and shows the result as
 * a still image: the texture stays, the motion does not.
 */
export function FlowField({
  density = 3,
  speed = 1.2,
  scale = 0.0035,
  fade = 0.06,
  lineWidth = 1.2,
  colors = ['var(--color-accent-strong)', 'var(--color-accent)', 'var(--color-ink-faint)'],
  seed = 7,
  label,
  className,
}: FlowFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const colourKey = colors.join('|')

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const noise = createNoise(seed)
    let palette: string[] = []
    let width = 0
    let height = 0
    let particles: FlowParticle[] = []
    let time = 0
    let frame = 0
    let visible = true

    const resolveColours = () => {
      // Assigning the value to `color` and reading it back resolves tokens to a colour the canvas accepts.
      palette = colourKey.split('|').map((value) => {
        canvas.style.color = value
        return getComputedStyle(canvas).color
      })
      canvas.style.color = ''
    }

    const spawn = (): FlowParticle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      life: 60 + Math.random() * 240,
      colour: Math.floor(Math.random() * palette.length),
    })

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      particles = Array.from({ length: Math.max(20, Math.round((width * height) / 10000 * density)) }, spawn)
    }

    const advance = (withFade: boolean) => {
      if (withFade) {
        context.globalCompositeOperation = 'destination-out'
        context.fillStyle = `rgba(0, 0, 0, ${fade})`
        context.fillRect(0, 0, width, height)
        context.globalCompositeOperation = 'source-over'
      }
      context.lineWidth = lineWidth
      context.lineCap = 'round'
      context.globalAlpha = 0.7
      time += 0.0025
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index]!
        const angle = noise(particle.x * scale, particle.y * scale, time) * Math.PI * 4
        const nextX = particle.x + Math.cos(angle) * speed
        const nextY = particle.y + Math.sin(angle) * speed
        context.strokeStyle = palette[particle.colour] ?? palette[0] ?? 'currentColor'
        context.beginPath()
        context.moveTo(particle.x, particle.y)
        context.lineTo(nextX, nextY)
        context.stroke()
        particle.x = nextX
        particle.y = nextY
        particle.life -= 1
        if (particle.life <= 0 || nextX < -10 || nextX > width + 10 || nextY < -10 || nextY > height + 10) {
          particles[index] = spawn()
        }
      }
      context.globalAlpha = 1
    }

    const paintStill = () => {
      context.clearRect(0, 0, width, height)
      for (let step = 0; step < 220; step += 1) advance(step % 4 === 0)
    }

    const loop = () => {
      advance(true)
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      if (reducedMotion) paintStill()
      else if (visible && !document.hidden) frame = requestAnimationFrame(loop)
    }

    resolveColours()
    resize()
    start()

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (reducedMotion) paintStill()
    })
    resizeObserver.observe(canvas)

    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting)
            if (visible) start()
            else cancelAnimationFrame(frame)
          })
    intersection?.observe(canvas)

    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start())
    document.addEventListener('visibilitychange', onVisibility)

    // The theme is a class or attribute on the root; follow it so the trails change colour with the page.
    const themeObserver = new MutationObserver(() => {
      resolveColours()
      if (reducedMotion) paintStill()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersection?.disconnect()
      themeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [density, speed, scale, fade, lineWidth, colourKey, seed, reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('block size-full', className)}
    />
  )
}
