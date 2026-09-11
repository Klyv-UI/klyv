'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface CubeCarouselProps {
  /** Four faces. Fewer are padded; more are ignored. */
  faces: ReactNode[]
  /** Accessible name. */
  label: string
  /** Face index. Omit for uncontrolled. */
  index?: number
  onIndexChange?: (index: number) => void
  /** Cube size in pixels. */
  size?: number
  /** Turn on its own, every N milliseconds. 0 is off. */
  autoRotate?: number
  /** Rotate about the X axis instead — a rolling cube rather than a spinning one. */
  axis?: 'y' | 'x'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Four panels on the sides of a cube that turns to show the one you ask for.
 *
 * The faces are pushed out from the centre by half the cube's width and then
 * the *whole cube* is rotated — the faces never move relative to each other.
 * Rotating each face independently is the obvious approach and it produces a
 * shape that visibly comes apart at the corners.
 *
 * Turn direction is chosen by shortest path and the rotation accumulates rather
 * than wrapping to zero. Without that, going from face four to face one snaps
 * backwards through all three; with it, the cube keeps turning the way it was
 * already going.
 *
 * Only the front face is in the tab order and the rest are inert, because three
 * screens of content facing away from the reader should not be reachable by
 * Tab. Arrow keys turn it.
 */
export function CubeCarousel({
  faces,
  label,
  index,
  onIndexChange,
  size = 260,
  autoRotate = 0,
  axis = 'y',
  className,
}: CubeCarouselProps) {
  const [uncontrolled, setUncontrolled] = useState(0)
  // Accumulated turns, so 4 → 1 keeps going forwards instead of unwinding.
  const turns = useRef(0)
  const previous = useRef(0)

  const current = ((index ?? uncontrolled) % 4 + 4) % 4

  const select = (next: number) => {
    const wrapped = ((next % 4) + 4) % 4
    if (index === undefined) setUncontrolled(wrapped)
    onIndexChange?.(wrapped)
  }

  useEffect(() => {
    if (autoRotate <= 0) return
    const timer = window.setInterval(() => select(current + 1), autoRotate)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotate, current])

  // Shortest path, then accumulate.
  let delta = current - previous.current
  if (delta > 2) delta -= 4
  if (delta < -2) delta += 4
  turns.current += delta
  previous.current = current

  const angle = turns.current * -90
  const panels = [0, 1, 2, 3].map((position) => faces[position] ?? null)

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault()
            select(current + 1)
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault()
            select(current - 1)
          }
        }}
        className="grid place-items-center rounded-[var(--radius-card)]"
        style={{ width: size, height: size, perspective: size * 3.2 }}
      >
        <div
          className="motion-safe-only relative transition-transform duration-[700ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: size,
            height: size,
            transformStyle: 'preserve-3d',
            transform:
              axis === 'y'
                ? `translateZ(${-size / 2}px) rotateY(${angle}deg)`
                : `translateZ(${-size / 2}px) rotateX(${-angle}deg)`,
          }}
        >
          {panels.map((face, position) => (
            <div
              key={position}
              aria-hidden={position !== current}
              // Content facing away should not be reachable by Tab.
              {...(position !== current ? { inert: '' as unknown as boolean } : {})}
              className="absolute inset-0 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]"
              style={{
                // Pushed out from a shared centre — the faces never move
                // relative to one another, so the corners stay closed.
                transform:
                  axis === 'y'
                    ? `rotateY(${position * 90}deg) translateZ(${size / 2}px)`
                    : `rotateX(${-position * 90}deg) translateZ(${size / 2}px)`,
                backfaceVisibility: 'hidden',
              }}
            >
              {face}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {panels.map((_, position) => (
          <button
            key={position}
            type="button"
            aria-label={`Face ${position + 1}`}
            aria-current={position === current}
            onClick={() => select(position)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-[var(--duration-slow)]',
              position === current ? 'w-6 bg-ink' : 'w-1.5 bg-line-strong hover:bg-ink-faint',
            )}
          />
        ))}
      </div>
    </div>
  )
}
