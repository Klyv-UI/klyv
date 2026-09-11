'use client'

import { useRef, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface HoloCardProps {
  /** The card contents. */
  children: ReactNode
  /** Maximum tilt in degrees. */
  tilt?: number
  /** Strength of the rainbow foil, 0 to 1. */
  foil?: number
  /** Sparkle grain over the foil. */
  sparkle?: boolean
  /** Any CSS length. Match the surface it sits on. */
  radius?: string
  /** Lift towards the viewer on hover, in pixels. */
  lift?: number
  /** Merged last, so it wins. */
  className?: string
  contentClassName?: string
}

/**
 * A trading-card foil: tilt it and a rainbow moves across the surface.
 *
 * The tilt is the easy half. What makes it read as *foil* rather than as a
 * tilted rectangle is that the rainbow moves the opposite way to the card — a
 * real holographic sheet reflects a fixed light source, so as the card turns
 * one way the highlight sweeps the other. A gradient that tracks the pointer
 * directly looks like a spotlight, not a hologram.
 *
 * Two layers do it: a repeating conic rainbow in `color-dodge`, and a fine
 * noise grain in `overlay` that only shows where the rainbow is bright. The
 * grain is what stops the foil looking like a smooth plastic gradient — real
 * foil is a scatter of tiny facets.
 *
 * Every value is written to a CSS custom property on the element inside one
 * pointer handler, so a card being turned costs no React renders at all.
 */
export function HoloCard({
  children,
  tilt = 14,
  foil = 0.55,
  sparkle = true,
  radius = 'var(--radius-card)',
  lift = 14,
  className,
  contentClassName,
}: HoloCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current
    if (!node) return
    const box = node.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height

    node.style.setProperty('--holo-rx', `${(0.5 - y) * tilt * 2}deg`)
    node.style.setProperty('--holo-ry', `${(x - 0.5) * tilt * 2}deg`)
    node.style.setProperty('--holo-lift', `${lift}px`)
    // Inverted on purpose: foil reflects a fixed light, so the sheen runs
    // against the turn. Tracking the pointer directly reads as a spotlight.
    node.style.setProperty('--holo-x', `${(1 - x) * 100}%`)
    node.style.setProperty('--holo-y', `${(1 - y) * 100}%`)
    node.style.setProperty('--holo-on', '1')
  }

  const reset = () => {
    const node = ref.current
    if (!node) return
    node.style.setProperty('--holo-rx', '0deg')
    node.style.setProperty('--holo-ry', '0deg')
    node.style.setProperty('--holo-lift', '0px')
    node.style.setProperty('--holo-on', '0')
  }

  return (
    <div className={cn('[perspective:900px]', className)}>
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        className="motion-safe-only relative isolate h-full overflow-hidden transition-transform duration-[var(--duration-slow)] ease-out will-change-transform"
        style={{
          borderRadius: radius,
          transform:
            'rotateX(var(--holo-rx, 0deg)) rotateY(var(--holo-ry, 0deg)) translateZ(var(--holo-lift, 0px))',
          transformStyle: 'preserve-3d',
          boxShadow: '0 18px 44px -18px rgba(20, 27, 15, 0.45)',
        }}
      >
        {/* Both layers fill the card, so a height given to it reaches the content
            and the foil covers the whole face, not just the part with text. */}
        <div className={cn('relative z-10 h-full', contentClassName)}>{children}</div>

        {/* The rainbow. color-dodge is what makes it look lit rather than painted. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 mix-blend-color-dodge transition-opacity duration-[var(--duration-slow)]"
          style={{
            borderRadius: radius,
            opacity: `calc(var(--holo-on, 0) * ${foil})`,
            background:
              'repeating-conic-gradient(from var(--holo-x, 50%) at var(--holo-x, 50%) var(--holo-y, 50%), #ff5f6d 0deg 12deg, #ffc371 12deg 24deg, #47e6b1 24deg 36deg, #4facfe 36deg 48deg, #b06ab3 48deg 60deg, #ff5f6d 60deg 72deg)',
          }}
        />

        {/* Facets. Without this the foil is a smooth plastic gradient. */}
        {sparkle && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 mix-blend-overlay transition-opacity duration-[var(--duration-slow)]"
            style={{
              borderRadius: radius,
              opacity: 'calc(var(--holo-on, 0) * 0.5)',
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
              backgroundSize: '120px 120px',
            }}
          />
        )}

        {/* A hard glare band, so the card has a direction of light. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-[var(--duration-slow)]"
          style={{
            borderRadius: radius,
            opacity: 'calc(var(--holo-on, 0) * 0.35)',
            background:
              'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.85) 48%, transparent 62%)',
            backgroundPosition: 'var(--holo-x, 50%) 0',
            backgroundSize: '220% 100%',
          }}
        />
      </div>
    </div>
  )
}
