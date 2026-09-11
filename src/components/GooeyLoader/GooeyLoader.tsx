'use client'

import { useId, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export interface GooeyLoaderProps {
  /** What is loading. Announced; the blobs are decorative. */
  label: string
  /** Overall size in pixels. */
  size?: number
  /** How many blobs orbit. Three or four reads best. */
  count?: number
  /** Any CSS colour for the blobs. */
  color?: string
  /** Seconds for one orbit. */
  duration?: number
  /** How much the blobs merge. Higher fuses them into one mass. */
  goo?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Blobs that orbit, merge into one mass, and separate again.
 *
 * The merging is the metaball trick: blur the whole group heavily, then push
 * the alpha channel through a steep contrast curve. Blurred edges that overlap
 * sum to a higher alpha than either alone, so the contrast step snaps them into
 * a single connected shape — and where they do not overlap, the same step
 * sharpens each blob's own edge back to a clean circle.
 *
 * That is why the filter has to wrap the *group*. Applied per blob it does
 * nothing at all, which is the mistake that makes people conclude the effect
 * does not work.
 *
 * The `feColorMatrix` row is `0 0 0 18 -7`: multiply alpha by 18, subtract 7.
 * Steeper fuses earlier and blows out the edges; shallower never quite joins.
 */
export function GooeyLoader({
  label,
  size = 96,
  count = 4,
  color = 'var(--color-accent-strong)',
  duration = 2.6,
  goo = 18,
  className,
}: GooeyLoaderProps) {
  const id = `goo-${useId().replace(/:/g, '')}`
  const blob = size * 0.3
  const orbit = size * 0.26

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <filter id={id}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.06} result="blur" />
          {/* Multiply alpha, then subtract: a steep step that snaps overlapping
              blurred edges into one shape and re-sharpens the lone ones. */}
          <feColorMatrix
            in="blur"
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${goo} -${Math.round(goo * 0.39)}`}
          />
        </filter>
      </svg>

      {/* The filter has to wrap the group. Per blob it does nothing. */}
      <div className="absolute inset-0" style={{ filter: `url(#${id})` }}>
        {Array.from({ length: count }, (_, index) => {
          const angle = (Math.PI * 2 * index) / count
          return (
            <span
              key={index}
              className="motion-safe-only absolute left-1/2 top-1/2 rounded-full"
              style={
                {
                  width: blob,
                  height: blob,
                  marginLeft: -blob / 2,
                  marginTop: -blob / 2,
                  background: color,
                  '--goo-x': `${Math.cos(angle) * orbit}px`,
                  '--goo-y': `${Math.sin(angle) * orbit}px`,
                  animation: `goo-drift ${duration}s ease-in-out infinite`,
                  animationDelay: `${(index / count) * -duration}s`,
                } as CSSProperties
              }
            />
          )
        })}
      </div>

      <VisuallyHidden>{label}</VisuallyHidden>
    </div>
  )
}
