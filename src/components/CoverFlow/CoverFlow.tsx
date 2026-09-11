'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface CoverFlowProps<T> {
  /** The sequence to render. */
  items: T[]
  /** Stable key for an entry. Index keys break as soon as the order changes. */
  itemId: (item: T) => string
  /** Renders the face of one card. */
  renderItem: (item: T, state: { selected: boolean; distance: number }) => ReactNode
  /** Accessible name for the set. */
  label: string
  /** Selected index. Omit for uncontrolled. */
  index?: number
  onIndexChange?: (index: number) => void
  /** Card width in pixels. The track height follows the tallest card. */
  cardWidth?: number
  /** Horizontal step between neighbours, in pixels. */
  spread?: number
  /** Degrees a side card turns away from the viewer. */
  rotation?: number
  /** Perspective depth. Lower is a stronger effect. */
  perspective?: number
  /** Cards drawn either side of the selected one. */
  depth?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A carousel with depth: the selected card faces you and its neighbours turn
 * away into the distance.
 *
 * Every card is placed with one `transform` — translate, rotateY, translateZ,
 * scale — computed from its signed distance to the selection. There is no
 * per-card state and no layout animation: changing the index changes one
 * number per card, and the transition does the rest, which is why it stays
 * smooth with twenty cards on screen.
 *
 * Depth alone would leave the stacking order wrong, so `z-index` is set from
 * the *absolute* distance while the transform uses the signed one. That is the
 * detail most versions of this miss, and it is what stops a far card painting
 * over a near one.
 *
 * It is a listbox, not a row of divs: arrow keys, Home and End move the
 * selection, a side card can be clicked to bring it forward, and the whole
 * track is one tab stop.
 */
export function CoverFlow<T>({
  items,
  itemId,
  renderItem,
  label,
  index,
  onIndexChange,
  cardWidth = 200,
  spread = 116,
  rotation = 42,
  perspective = 1100,
  depth = 3,
  className,
}: CoverFlowProps<T>) {
  const [uncontrolled, setUncontrolled] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ x: number; index: number } | null>(null)

  const selected = Math.min(items.length - 1, Math.max(0, index ?? uncontrolled))

  const select = (next: number) => {
    const clamped = Math.min(items.length - 1, Math.max(0, next))
    if (index === undefined) setUncontrolled(clamped)
    onIndexChange?.(clamped)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') select(0)
    else if (event.key === 'End') select(items.length - 1)
    else select(selected + (event.key === 'ArrowRight' ? 1 : -1))
  }

  return (
    <div
      ref={trackRef}
      role="listbox"
      aria-label={label}
      aria-orientation="horizontal"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        dragStart.current = { x: event.clientX, index: selected }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!dragStart.current) return
        // One card per `spread` dragged, so the track follows the hand.
        const moved = Math.round((dragStart.current.x - event.clientX) / spread)
        if (moved !== 0) select(dragStart.current.index + moved)
      }}
      onPointerUp={() => {
        dragStart.current = null
      }}
      onPointerCancel={() => {
        dragStart.current = null
      }}
      className={cn(
        'relative w-full touch-pan-y select-none overflow-hidden rounded-[var(--radius-card)]',
        className,
      )}
      style={{ perspective }}
    >
      <div className="relative flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
        {/* Every card is absolutely placed, so one invisible copy of the
            selected card is what gives the track its height. */}
        <div aria-hidden="true" className="invisible" style={{ width: cardWidth }}>
          {items[selected] !== undefined &&
            renderItem(items[selected], { selected: true, distance: 0 })}
        </div>

        {items.map((item, position) => {
          const distance = position - selected
          const away = Math.abs(distance)
          const hidden = away > depth

          return (
            <div
              key={itemId(item)}
              role="option"
              aria-selected={position === selected}
              onClick={() => select(position)}
              className={cn(
                'motion-safe-only transition-[transform,opacity] duration-[var(--duration-slow)] ease-[cubic-bezier(0.32,0.72,0,1)]',
                position === selected ? 'cursor-default' : 'cursor-pointer',
                'absolute left-1/2 top-1/2',
              )}
              style={{
                width: cardWidth,
                // Signed distance places the card; absolute distance orders it.
                transform: `translate(-50%, -50%) translateX(${distance * spread}px) rotateY(${-distance * rotation}deg) translateZ(${-away * 60}px) scale(${1 - away * 0.06})`,
                zIndex: items.length - away,
                opacity: hidden ? 0 : 1 - away * 0.18,
                pointerEvents: hidden ? 'none' : undefined,
              }}
            >
              {renderItem(item, { selected: position === selected, distance })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
