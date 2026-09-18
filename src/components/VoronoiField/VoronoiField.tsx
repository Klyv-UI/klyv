'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface VoronoiFieldProps {
  /** Number of seeds, and so of cells. The clipping is O(n²), so a few dozen is the sweet spot. */
  count?: number
  /** Drift speed in pixels per frame at 60fps. */
  speed?: number
  /** How strongly seeds lean towards the pointer, 0 to turn it off. */
  attraction?: number
  /** Radius around the pointer, in pixels, inside which seeds are pulled. */
  reach?: number
  /** Colour the cells are tinted from — a token such as `var(--color-accent)`, or any CSS colour. */
  color?: string
  /** Colour of the cell edges. */
  edgeColor?: string
  /** Draw a dot at each seed. */
  showSeeds?: boolean
  /** Seed for the layout, so the same field comes back on every visit. */
  seed?: number
  /** Merged last, so it wins. Give the component a size here. */
  className?: string
}

type VoronoiFieldPoint = [number, number]

interface VoronoiFieldSite {
  x: number
  y: number
  vx: number
  vy: number
  /** Fixed per-cell tint strength, so the pattern is stable while the shapes move. */
  shade: number
}

/**
 * Clip a convex polygon to the half-plane of points closer to `a` than to `b` — one Sutherland–Hodgman pass against
 * the perpendicular bisector of a and b.
 */
function clipToBisector(polygon: VoronoiFieldPoint[], a: VoronoiFieldSite, b: VoronoiFieldSite): VoronoiFieldPoint[] {
  const nx = b.x - a.x
  const ny = b.y - a.y
  // A point p is on a’s side when (p − midpoint) · (b − a) < 0.
  const c = (nx * (a.x + b.x) + ny * (a.y + b.y)) / 2
  const side = (point: VoronoiFieldPoint) => nx * point[0] + ny * point[1] - c
  const output: VoronoiFieldPoint[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!
    const next = polygon[(index + 1) % polygon.length]!
    const sc = side(current)
    const sn = side(next)
    if (sc <= 0) output.push(current)
    if ((sc <= 0) !== (sn <= 0)) {
      const t = sc / (sc - sn)
      output.push([current[0] + (next[0] - current[0]) * t, current[1] + (next[1] - current[1]) * t])
    }
  }
  return output
}

/** Every site’s Voronoi cell inside a width × height box, by half-plane intersection. */
function voronoiCells(sites: VoronoiFieldSite[], width: number, height: number): VoronoiFieldPoint[][] {
  return sites.map((site) => {
    let cell: VoronoiFieldPoint[] = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ]
    for (const other of sites) {
      if (other === site || cell.length === 0) continue
      cell = clipToBisector(cell, site, other)
    }
    return cell
  })
}

/**
 * A Voronoi diagram of slowly drifting seeds: every point of the canvas belongs to the cell of its nearest seed, and
 * the cells reshape as the seeds move.
 *
 * Each cell is computed exactly, by starting from the whole canvas and clipping it against the perpendicular bisector
 * with every other seed. That is O(n²) clips, which at forty seeds is a few thousand cheap operations a frame — less
 * code and fewer failure modes than a Delaunay triangulation, and the cells come out as ready-to-fill polygons.
 *
 * Cells are tinted from the accent at a fixed per-cell strength, so the pattern stays calm while the shapes move, and
 * the colours are re-read when the theme or accent changes because a canvas cannot resolve a CSS variable. Seeds lean
 * gently towards the pointer. The loop stops off screen and in a hidden tab; under reduced motion one still frame is
 * drawn. The canvas is decorative and hidden from assistive technology.
 */
export function VoronoiField({
  count = 36,
  speed = 0.25,
  attraction = 0.6,
  reach = 180,
  color = 'var(--color-accent)',
  edgeColor = 'var(--color-line-strong)',
  showSeeds = true,
  seed = 11,
  className,
}: VoronoiFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let state = seed >>> 0 || 1
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    }

    let width = 0
    let height = 0
    let sites: VoronoiFieldSite[] = []
    let fill = ''
    let edge = ''
    let frame = 0
    let visible = true
    const pointer = { x: 0, y: 0, active: false }

    const resolve = (value: string) => {
      canvas.style.color = value
      const resolved = getComputedStyle(canvas).color
      canvas.style.color = ''
      return resolved
    }
    const resolveColours = () => {
      fill = resolve(color)
      edge = resolve(edgeColor)
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const nextWidth = Math.max(1, rect.width)
      const nextHeight = Math.max(1, rect.height)
      // Keep seeds where they were, relative to the box, so a resize reshapes rather than reshuffles.
      if (sites.length && width && height) {
        for (const site of sites) {
          site.x = (site.x / width) * nextWidth
          site.y = (site.y / height) * nextHeight
        }
      }
      width = nextWidth
      height = nextHeight
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      if (sites.length !== count) {
        sites = Array.from({ length: count }, () => {
          const angle = random() * Math.PI * 2
          return {
            x: random() * width,
            y: random() * height,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            shade: 0.06 + random() * 0.34,
          }
        })
      }
    }

    const step = () => {
      for (const site of sites) {
        if (pointer.active && attraction > 0) {
          const dx = pointer.x - site.x
          const dy = pointer.y - site.y
          const distance = Math.hypot(dx, dy)
          if (distance < reach && distance > 1) {
            const pull = (1 - distance / reach) * attraction * 0.05
            site.vx += (dx / distance) * pull
            site.vy += (dy / distance) * pull
          }
        }
        // Ease back towards cruising speed so the pull never runs away.
        const velocity = Math.hypot(site.vx, site.vy) || 1
        const target = speed + (pointer.active ? attraction * 0.4 : 0)
        const scale = 1 + (target / velocity - 1) * 0.04
        site.vx *= scale
        site.vy *= scale
        site.x += site.vx
        site.y += site.vy
        if (site.x < 0 || site.x > width) {
          site.vx *= -1
          site.x = Math.min(width, Math.max(0, site.x))
        }
        if (site.y < 0 || site.y > height) {
          site.vy *= -1
          site.y = Math.min(height, Math.max(0, site.y))
        }
      }
    }

    const draw = () => {
      context.clearRect(0, 0, width, height)
      const cells = voronoiCells(sites, width, height)
      context.lineJoin = 'round'
      context.lineWidth = 1
      cells.forEach((cell, index) => {
        if (cell.length < 3) return
        context.beginPath()
        context.moveTo(cell[0]![0], cell[0]![1])
        for (let point = 1; point < cell.length; point += 1) context.lineTo(cell[point]![0], cell[point]![1])
        context.closePath()
        context.globalAlpha = sites[index]!.shade
        context.fillStyle = fill
        context.fill()
        context.globalAlpha = 1
        context.strokeStyle = edge
        context.stroke()
      })
      if (showSeeds) {
        context.fillStyle = edge
        for (const site of sites) {
          context.beginPath()
          context.arc(site.x, site.y, 1.6, 0, Math.PI * 2)
          context.fill()
        }
      }
    }

    const loop = () => {
      step()
      draw()
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      if (reducedMotion) draw()
      else if (visible && !document.hidden) frame = requestAnimationFrame(loop)
    }

    resolveColours()
    resize()
    draw()
    start()

    const resizeObserver = new ResizeObserver(() => {
      resize()
      draw()
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

    // The pointer is read from the window, because the canvas usually sits behind content that takes the events.
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
      pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height
    }
    const onPointerLeave = () => {
      pointer.active = false
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)

    const themeObserver = new MutationObserver(() => {
      resolveColours()
      draw()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersection?.disconnect()
      themeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [count, speed, attraction, reach, color, edgeColor, showSeeds, seed, reducedMotion])

  return <canvas ref={canvasRef} aria-hidden="true" className={cn('block size-full', className)} />
}
