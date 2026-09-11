'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export interface GravityTag {
  id: string
  label: string
  /** Any CSS colour. */
  color?: string
}

export interface GravityTagsProps {
  tags: GravityTag[]
  /** Accessible name for the pile. */
  label: string
  height?: number
  /** Downward acceleration, in pixels per frame squared. */
  gravity?: number
  /** How much of the speed survives a collision, 0 to 1. */
  bounce?: number
  /** Pointer pushes the pile around. */
  interactive?: boolean
  /** Merged last, so it wins. */
  className?: string
}

interface Body {
  el: HTMLElement
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  angle: number
  spin: number
}

/**
 * Tags that fall, collide, and pile up at the bottom.
 *
 * Bodies are axis-aligned rectangles resolved by overlap: on a collision the
 * pair is pushed apart along whichever axis they overlap *least*, and only that
 * axis exchanges velocity. Separating along the larger overlap is the classic
 * bug — boxes shove each other sideways when they should be stacking, and the
 * pile slides apart.
 *
 * Positions are written to `transform` on real DOM elements rather than drawn
 * on a canvas, so every tag stays real text: selectable, searchable, and
 * present in the accessibility tree. A canvas would be simpler and would turn
 * a list of words into a picture of one.
 *
 * The loop parks itself once everything has settled and wakes on interaction,
 * because a pile at rest should not be costing a frame.
 */
export function GravityTags({
  tags,
  label,
  height = 320,
  gravity = 0.42,
  bounce = 0.35,
  interactive = true,
  className,
}: GravityTagsProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bodiesRef = useRef<Body[]>([])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const elements = [...root.querySelectorAll<HTMLElement>('[data-gravity]')]
    const width = root.clientWidth

    bodiesRef.current = elements.map((el, index) => ({
      el,
      x: 20 + Math.random() * Math.max(1, width - 140),
      // Staggered across the top of the box rather than far above it, so the
      // pile is visible from the first paint and not only once it lands.
      y: -20 - index * 34,
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      w: el.offsetWidth,
      h: el.offsetHeight,
      angle: (Math.random() - 0.5) * 24,
      spin: (Math.random() - 0.5) * 1.6,
    }))

    // Written once, synchronously: without it the tags sit at 0,0 until the
    // first animation frame lands.
    for (const body of bodiesRef.current) {
      body.el.style.transform = `translate3d(${body.x}px, ${body.y}px, 0) rotate(${body.angle}deg)`
    }

    let frame = 0
    let idle = 0
    const pointer = { x: -9999, y: -9999, active: false }

    const step = () => {
      const bodies = bodiesRef.current
      let moving = false

      for (const body of bodies) {
        body.vy += gravity
        body.x += body.vx
        body.y += body.vy
        body.angle += body.spin
        body.spin *= 0.98

        if (interactive && pointer.active) {
          const dx = body.x + body.w / 2 - pointer.x
          const dy = body.y + body.h / 2 - pointer.y
          const distance = Math.hypot(dx, dy)
          if (distance < 90 && distance > 0.5) {
            const push = (1 - distance / 90) * 3.2
            body.vx += (dx / distance) * push
            body.vy += (dy / distance) * push
            body.spin += (dx / distance) * 0.5
          }
        }

        // Walls and floor.
        if (body.x < 0) {
          body.x = 0
          body.vx = -body.vx * bounce
        }
        if (body.x + body.w > width) {
          body.x = width - body.w
          body.vx = -body.vx * bounce
        }
        if (body.y + body.h > height) {
          body.y = height - body.h
          body.vy = -body.vy * bounce
          body.vx *= 0.86
          body.spin *= 0.7
        }
      }

      // Pairwise, separated along the *smaller* overlap.
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const a = bodies[i]
          const b = bodies[j]
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
          if (overlapX <= 0 || overlapY <= 0) continue

          if (overlapX < overlapY) {
            const shift = (overlapX / 2) * (a.x < b.x ? -1 : 1)
            a.x += shift
            b.x -= shift
            const swap = a.vx
            a.vx = b.vx * bounce
            b.vx = swap * bounce
          } else {
            const shift = (overlapY / 2) * (a.y < b.y ? -1 : 1)
            a.y += shift
            b.y -= shift
            const swap = a.vy
            a.vy = b.vy * bounce
            b.vy = swap * bounce
            a.spin *= 0.8
            b.spin *= 0.8
          }
        }
      }

      for (const body of bodies) {
        body.el.style.transform = `translate3d(${body.x}px, ${body.y}px, 0) rotate(${body.angle}deg)`
        if (Math.abs(body.vx) > 0.12 || Math.abs(body.vy) > 0.12) moving = true
      }

      // A pile at rest should not cost a frame.
      idle = moving || pointer.active ? 0 : idle + 1
      if (idle > 40) {
        frame = 0
        return
      }
      frame = requestAnimationFrame(step)
    }

    const wake = () => {
      if (!frame) {
        idle = 0
        frame = requestAnimationFrame(step)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!interactive) return
      const box = root.getBoundingClientRect()
      pointer.x = event.clientX - box.left
      pointer.y = event.clientY - box.top
      pointer.active = true
      wake()
    }
    const onPointerLeave = () => {
      pointer.active = false
    }

    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerleave', onPointerLeave)
    wake()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [bounce, gravity, height, interactive, tags])

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-app',
        className,
      )}
      style={{ height }}
    >
      {/* Real elements, so every tag is still text. */}
      {tags.map((tag) => (
        <span
          key={tag.id}
          data-gravity=""
          className="absolute left-0 top-0 inline-flex select-none items-center rounded-full px-3.5 py-2 text-[13px] font-bold will-change-transform"
          style={{
            background: tag.color ?? 'var(--color-accent)',
            color: tag.color ? '#ffffff' : 'var(--color-accent-ink)',
          }}
        >
          {tag.label}
        </span>
      ))}

      <VisuallyHidden>
        <p>{label}</p>
        <ul>
          {tags.map((tag) => (
            <li key={tag.id}>{tag.label}</li>
          ))}
        </ul>
      </VisuallyHidden>
    </div>
  )
}
