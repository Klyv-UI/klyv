'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface StickerPeelProps {
  /** The sticker contents. */
  children: ReactNode
  /** How far the corner lifts on hover, in pixels. */
  peek?: number
  /** How far it can be dragged before it comes off. */
  threshold?: number
  /** Which corner peels. */
  corner?: 'tr' | 'tl' | 'br' | 'bl'
  /** Fires once it is fully peeled off. */
  onPeel?: () => void
  /** Put it back. Controlled — omit for uncontrolled. */
  peeled?: boolean
  /** Any CSS length. Match the surface it sits on. */
  radius?: string
  /** Merged last, so it wins. */
  className?: string
}

const ORIGIN: Record<NonNullable<StickerPeelProps['corner']>, string> = {
  tr: 'bottom left',
  tl: 'bottom right',
  br: 'top left',
  bl: 'top right',
}

/**
 * A sticker whose corner lifts when you touch it, and comes off if you pull.
 *
 * The curl is one triangle of the sticker rotated about the fold line, plus a
 * shadow cast onto the part still stuck down. That shadow is the whole trick:
 * without it the lifted corner reads as a flat shape that has changed colour,
 * and with it the eye immediately sees a sheet peeling away from a surface.
 *
 * Pulling past the threshold takes it off. Below it, the corner springs back —
 * which is the difference between a sticker and a button that happens to
 * animate. The gesture is pointer-captured, so the pull survives leaving the
 * sticker, exactly as a real one would.
 *
 * The back of the curl is drawn lighter and desaturated, because the underside
 * of a printed sticker is not the printed side.
 */
export function StickerPeel({
  children,
  peek = 26,
  threshold = 90,
  corner = 'tr',
  onPeel,
  peeled,
  radius = 'var(--radius-tile)',
  className,
}: StickerPeelProps) {
  const [pull, setPull] = useState(0)
  const [uncontrolled, setUncontrolled] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const gone = peeled ?? uncontrolled

  const commit = () => {
    if (peeled === undefined) setUncontrolled(true)
    onPeel?.()
  }

  if (gone) {
    return (
      <div
        className={cn('relative grid place-items-center opacity-40', className)}
        style={{ borderRadius: radius, border: '1px dashed var(--color-line-strong)' }}
      >
        <span className="p-4 text-[11px] font-bold text-ink-faint">Peeled off</span>
      </div>
    )
  }

  const lift = Math.max(peek * 0.001, pull)
  const angle = Math.min(180, (lift / threshold) * 150)
  const flipX = corner === 'tl' || corner === 'bl' ? -1 : 1
  const flipY = corner === 'bl' || corner === 'br' ? -1 : 1

  return (
    <div
      className={cn('group/sticker relative select-none', className)}
      style={{ perspective: 900 }}
      onPointerDown={(event) => {
        start.current = { x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!start.current) return
        // Distance along the diagonal away from the anchored corner.
        const dx = (event.clientX - start.current.x) * flipX
        const dy = (event.clientY - start.current.y) * -flipY
        setPull(Math.max(0, (dx + dy) / 2))
      }}
      onPointerUp={() => {
        start.current = null
        if (pull > threshold) commit()
        else setPull(0)
      }}
      onPointerCancel={() => {
        start.current = null
        setPull(0)
      }}
    >
      <div
        className="motion-safe-only relative overflow-hidden transition-transform duration-[var(--duration-slow)]"
        style={{
          borderRadius: radius,
          // The sheet itself lifts slightly as the corner comes up.
          transform: `translate(${pull * 0.12 * flipX}px, ${pull * -0.12 * flipY}px)`,
        }}
      >
        {children}

        {/* Shadow the curl casts back onto the stuck-down sheet. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-[42%] w-[42%] transition-opacity duration-[var(--duration-fast)] group-hover/sticker:opacity-100"
          style={{
            top: corner.startsWith('t') ? 0 : undefined,
            bottom: corner.startsWith('b') ? 0 : undefined,
            right: corner.endsWith('r') ? 0 : undefined,
            left: corner.endsWith('l') ? 0 : undefined,
            opacity: pull > 0 ? 1 : 0,
            background: `radial-gradient(circle at ${corner.endsWith('r') ? '100%' : '0%'} ${corner.startsWith('t') ? '0%' : '100%'}, rgba(20,27,15,0.35), transparent 70%)`,
          }}
        />
      </div>

      {/* The curl: one corner rotated about the fold line. */}
      <span
        aria-hidden="true"
        className={cn(
          'motion-safe-only pointer-events-none absolute h-[38%] w-[38%] transition-transform duration-[var(--duration-slow)] ease-out',
          pull === 0 && 'group-hover/sticker:[transform:rotate3d(1,-1,0,34deg)]',
        )}
        style={{
          top: corner.startsWith('t') ? 0 : undefined,
          bottom: corner.startsWith('b') ? 0 : undefined,
          right: corner.endsWith('r') ? 0 : undefined,
          left: corner.endsWith('l') ? 0 : undefined,
          transformOrigin: ORIGIN[corner],
          transform: pull > 0 ? `rotate3d(1, -1, 0, ${angle}deg)` : undefined,
          // The underside of a printed sticker is not the printed side.
          background:
            'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-muted) 55%, var(--color-line-strong) 100%)',
          borderTopRightRadius: corner === 'tr' ? radius : undefined,
          borderTopLeftRadius: corner === 'tl' ? radius : undefined,
          borderBottomRightRadius: corner === 'br' ? radius : undefined,
          borderBottomLeftRadius: corner === 'bl' ? radius : undefined,
          clipPath:
            corner === 'tr'
              ? 'polygon(100% 0, 0 0, 100% 100%)'
              : corner === 'tl'
                ? 'polygon(0 0, 100% 0, 0 100%)'
                : corner === 'br'
                  ? 'polygon(100% 100%, 100% 0, 0 100%)'
                  : 'polygon(0 100%, 0 0, 100% 100%)',
          boxShadow: '0 6px 14px -6px rgba(20,27,15,0.5)',
        }}
      />
    </div>
  )
}
