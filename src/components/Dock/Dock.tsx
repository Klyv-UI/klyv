'use client'

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import type { IconComponent } from '../../lib/types'

export interface DockItem {
  id: string
  label: string
  icon: IconComponent
  onSelect?: () => void
  /** Small count on the corner of the tile. */
  badge?: number
  /** A dot under the tile, for "this one is running". */
  active?: boolean
  disabled?: boolean
}

export interface DockProps {
  items: DockItem[]
  /** Accessible name for the bar. */
  label: string
  /** Resting tile size in pixels. */
  size?: number
  /** How much the tile under the pointer grows, as a multiplier. */
  magnification?: number
  /** How far either side the magnification reaches, in pixels. */
  reach?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A bar of tiles that swell towards the pointer.
 *
 * The magnification is a distance falloff, not a hover state: every tile is
 * scaled by how near the pointer is to its centre, so the bar deforms as one
 * curve instead of one tile popping while its neighbours sit still. That
 * continuity is the whole effect — a per-tile `:hover` scale looks like a
 * different, worse component.
 *
 * A pointer move fires far more often than a frame, and re-rendering ten tiles
 * on each one would be waste, so the scale is written straight to each item's
 * CSS custom property inside a single `requestAnimationFrame`. React renders
 * the dock once and never again while the pointer travels.
 *
 * The distance is measured from the *wrapper*, which never scales, rather than
 * from the tile, which does — measuring the scaled node feeds its own growth
 * back into the next frame and the bar wobbles.
 *
 * Growth is anchored to the bottom edge, so tiles rise out of the bar instead
 * of pushing it apart. Keyboard users get the same bar without the
 * magnification: it is a toolbar with arrow-key navigation and real buttons.
 */
export function Dock({
  items,
  label,
  size = 44,
  magnification = 1.75,
  reach = 110,
  className,
}: DockProps) {
  const wrapsRef = useRef<(HTMLDivElement | null)[]>([])
  const tilesRef = useRef<(HTMLButtonElement | null)[]>([])
  const frame = useRef(0)
  const pointerX = useRef<number | null>(null)

  const paint = () => {
    frame.current = 0
    for (const wrap of wrapsRef.current) {
      if (!wrap) continue
      let scale = 1
      if (pointerX.current !== null) {
        const box = wrap.getBoundingClientRect()
        const distance = Math.abs(pointerX.current - (box.left + box.width / 2))
        if (distance < reach) {
          // Cosine falloff: 1 at the pointer, easing to 0 at the edge of reach.
          const falloff = (Math.cos((distance / reach) * Math.PI) + 1) / 2
          scale = 1 + (magnification - 1) * falloff
        }
      }
      // Set on the wrapper so the tile and its label both inherit.
      wrap.style.setProperty('--dock-scale', scale.toFixed(3))
      wrap.style.setProperty('--dock-label', scale > 1 + (magnification - 1) * 0.75 ? '1' : '0')
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerX.current = event.clientX
    if (frame.current) return
    frame.current = requestAnimationFrame(paint)
  }

  const onPointerLeave = () => {
    pointerX.current = null
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(paint)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const current = tilesRef.current.findIndex((tile) => tile === document.activeElement)
    const last = items.length - 1
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    tilesRef.current[next]?.focus()
  }

  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-end gap-2 rounded-[var(--radius-banner)] border border-line bg-surface/80 px-3 pb-2.5 pt-2 shadow-[var(--shadow-float)] backdrop-blur-md',
        className,
      )}
      style={{ height: size * magnification + 22 }}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          ref={(node) => {
            wrapsRef.current[index] = node
          }}
          className="relative flex flex-col items-center justify-end"
          style={{ width: size }}
        >
          <Text
            as="span"
            size="micro"
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-full bg-ink px-2 py-1 text-ink-inverse transition-opacity duration-[var(--duration-fast)]"
            style={{ opacity: 'var(--dock-label, 0)' } as CSSProperties}
          >
            {item.label}
          </Text>

          <button
            ref={(node) => {
              tilesRef.current[index] = node
            }}
            type="button"
            aria-label={item.label}
            tabIndex={index === 0 ? 0 : -1}
            disabled={item.disabled}
            onClick={item.onSelect}
            className={cn(
              'motion-safe-only relative grid origin-bottom shrink-0 place-items-center rounded-[var(--radius-glyph)] border border-line bg-surface text-ink shadow-[var(--shadow-tile)]',
              'transition-[transform,border-color] duration-[var(--duration-fast)] ease-out',
              'hover:border-line-strong disabled:pointer-events-none disabled:opacity-40',
            )}
            style={{
              width: size,
              height: size,
              transform: 'scale(var(--dock-scale, 1))',
            }}
          >
            <item.icon size={Math.round(size * 0.44)} strokeWidth={2} aria-hidden="true" />
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-ink">
                {item.badge}
              </span>
            )}
          </button>

          <span
            aria-hidden="true"
            className={cn(
              'mt-1.5 h-1 w-1 shrink-0 rounded-full transition-colors',
              item.active ? 'bg-ink-faint' : 'bg-transparent',
            )}
          />
        </div>
      ))}
    </div>
  )
}
