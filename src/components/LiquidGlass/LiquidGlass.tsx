'use client'

import { useId, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface LiquidGlassProps {
  /** Content seen through the glass. */
  children: ReactNode
  /** Backdrop blur in pixels. */
  blur?: number
  /** How much the edge bends what is behind it. 0 turns the refraction off. */
  refraction?: number
  /** Corner radius. */
  radius?: string
  /** Tint over the blur. Keep it very low — glass is not paint. */
  tint?: string
  /** A specular highlight that follows the pointer. */
  glint?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A pane of glass: blurred backdrop, a lit rim, and an edge that bends what is
 * behind it.
 *
 * Real glass is not a translucent rectangle. Three things sell it, and most
 * implementations ship only the first: the blur, a *specular rim* that is
 * brighter along the top-left than the bottom-right, and refraction — the way
 * the edge displaces what is behind it while the middle stays clear.
 *
 * The refraction is an SVG `feDisplacementMap` fed by a radial gradient that is
 * flat in the centre and steep at the border, applied through
 * `backdrop-filter`. That is what makes content near the edge visibly bend, and
 * it is the whole difference between glass and frosting.
 *
 * The pointer glint is written to CSS custom properties rather than state,
 * because a pointer move fires far more often than a frame and none of this
 * needs React to know about it.
 */
export function LiquidGlass({
  children,
  blur = 14,
  refraction = 24,
  radius = 'var(--radius-card)',
  tint = 'rgba(255,255,255,0.16)',
  glint = true,
  className,
}: LiquidGlassProps) {
  const id = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!glint) return
    const node = ref.current
    if (!node) return
    const box = node.getBoundingClientRect()
    node.style.setProperty('--glass-x', `${((event.clientX - box.left) / box.width) * 100}%`)
    node.style.setProperty('--glass-y', `${((event.clientY - box.top) / box.height) * 100}%`)
    node.style.setProperty('--glass-glint', '1')
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={() => ref.current?.style.setProperty('--glass-glint', '0')}
      className={cn('relative isolate overflow-hidden', className)}
      style={{ borderRadius: radius }}
    >
      {refraction > 0 && (
        <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
          <filter id={`glass-${id}`}>
            {/* Flat in the middle, steep at the rim — so only the edge bends. */}
            <feImage
              href={`data:image/svg+xml;utf8,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="55%" stop-color="#808080"/><stop offset="100%" stop-color="#ffffff"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>`,
              )}`}
              result="map"
              preserveAspectRatio="none"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={refraction}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
      )}

      {/* The glass itself: blur, bend, tint. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={
          {
            borderRadius: radius,
            background: tint,
            backdropFilter: `blur(${blur}px) saturate(1.6)${refraction > 0 ? ` url(#glass-${id})` : ''}`,
            WebkitBackdropFilter: `blur(${blur}px) saturate(1.6)`,
          } as CSSProperties
        }
      />

      {/* Specular rim — brighter top-left, darker bottom-right. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          borderRadius: radius,
          boxShadow:
            'inset 1px 1px 0 rgba(255,255,255,0.75), inset -1px -1px 0 rgba(255,255,255,0.18), inset 0 0 22px rgba(255,255,255,0.22), 0 12px 36px -12px rgba(20,27,15,0.35)',
        }}
      />

      {glint && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[var(--glass-glint,0)] transition-opacity duration-[var(--duration-slow)]"
          style={{
            borderRadius: radius,
            background:
              'radial-gradient(160px circle at var(--glass-x,50%) var(--glass-y,0%), rgba(255,255,255,0.55), transparent 65%)',
          }}
        />
      )}

      {children}
    </div>
  )
}
