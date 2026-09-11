'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type SwipeDirection = 'left' | 'right'

export interface SwipeDeckProps<T> {
  /** The deck, top card first. */
  items: T[]
  /** Stable key for an item. */
  itemId: (item: T) => string
  /** The face of one card. */
  renderItem: (item: T, index: number) => ReactNode
  /** Accessible name for the deck. */
  label: string
  /** Cards visible behind the top one. */
  depth?: number
  /** Pixels dragged before a release counts as a swipe. */
  threshold?: number
  onSwipe?: (item: T, direction: SwipeDirection) => void
  /** Called when the last card leaves. */
  onEmpty?: () => void
  /** Badges shown as the card is dragged past the threshold. */
  hints?: { left: ReactNode; right: ReactNode }
  /** Rendered once the deck runs out. */
  empty?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A stack of cards where the top one is dragged away to the left or right.
 *
 * The drag is pointer events with pointer capture, not a drag-and-drop library:
 * capture is what keeps the gesture alive when the pointer leaves the card,
 * which is exactly what happens on every real throw.
 *
 * While dragging, the card's transform is written straight to the node and only
 * the release commits to React state. A pointer move fires more often than a
 * frame, so putting the offset in state would re-render the whole deck dozens
 * of times per gesture for a value only the compositor needs.
 *
 * The gesture has a keyboard equivalent: the top card is focusable, and the
 * arrow keys swipe it. Without that the deck would be unusable to anyone not
 * holding a pointer — which is the usual reason this pattern fails review.
 */
export function SwipeDeck<T>({
  items,
  itemId,
  renderItem,
  label,
  depth = 3,
  threshold = 96,
  onSwipe,
  onEmpty,
  hints,
  empty,
  className,
}: SwipeDeckProps<T>) {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [dragX, setDragX] = useState(0)

  const remaining = items.slice(index, index + depth)
  const top = remaining[0]

  const paint = (offset: number) => {
    const node = cardRef.current
    if (!node) return
    node.style.transform = `translate3d(${offset}px, ${Math.abs(offset) * 0.06}px, 0) rotate(${offset * 0.05}deg)`
  }

  const commit = (direction: SwipeDirection) => {
    if (!top) return
    setLeaving(direction)
    const node = cardRef.current
    if (node) {
      node.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 260ms linear'
      node.style.transform = `translate3d(${direction === 'right' ? 620 : -620}px, 40px, 0) rotate(${direction === 'right' ? 22 : -22}deg)`
      node.style.opacity = '0'
    }
    onSwipe?.(top, direction)
    window.setTimeout(() => {
      setLeaving(null)
      setDragX(0)
      setIndex((value) => {
        const next = value + 1
        if (next >= items.length) onEmpty?.()
        return next
      })
    }, 240)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (leaving) return
    start.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    const node = cardRef.current
    if (node) node.style.transition = 'none'
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || leaving) return
    const offset = event.clientX - start.current.x
    paint(offset)
    // State carries only which side the drag has crossed to — -1, 0 or 1 —
    // so a gesture re-renders three times at most instead of once a pixel.
    const crossed = Math.abs(offset) > threshold ? Math.sign(offset) : 0
    setDragX((previous) => (previous === crossed ? previous : crossed))
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || leaving) return
    const offset = event.clientX - start.current.x
    start.current = null
    setDragX(0)

    if (Math.abs(offset) > threshold) {
      commit(offset > 0 ? 'right' : 'left')
      return
    }
    const node = cardRef.current
    if (node) {
      node.style.transition = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)'
      node.style.transform = 'translate3d(0, 0, 0) rotate(0deg)'
    }
  }

  if (!top) {
    return <div className={cn('flex items-center justify-center', className)}>{empty}</div>
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('relative select-none', className)}
      style={{ touchAction: 'pan-y' }}
    >
      {remaining
        .map((item, position) => ({ item, position }))
        .reverse()
        .map(({ item, position }) => {
          const isTop = position === 0
          return (
            <div
              key={itemId(item)}
              ref={isTop ? cardRef : undefined}
              tabIndex={isTop ? 0 : -1}
              aria-hidden={isTop ? undefined : true}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
              onKeyDown={
                isTop
                  ? (event) => {
                      if (event.key === 'ArrowLeft') commit('left')
                      if (event.key === 'ArrowRight') commit('right')
                    }
                  : undefined
              }
              className={cn(
                // motion-safe-only also overrides the inline transition the
                // throw sets, so a reduced-motion swipe resolves instantly.
                'motion-safe-only rounded-[var(--radius-card)]',
                isTop ? 'relative cursor-grab active:cursor-grabbing' : 'absolute inset-0',
              )}
              style={{
                transform: isTop
                  ? undefined
                  : `translate3d(0, ${position * 14}px, 0) scale(${1 - position * 0.05})`,
                transition: isTop ? undefined : 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
                zIndex: depth - position,
                opacity: isTop ? 1 : 1 - position * 0.12,
              }}
            >
              {renderItem(item, index + position)}

              {isTop && hints && (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute left-4 top-4 transition-opacity duration-[var(--duration-fast)]',
                      dragX < 0 ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    {hints.left}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute right-4 top-4 transition-opacity duration-[var(--duration-fast)]',
                      dragX > 0 ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    {hints.right}
                  </span>
                </>
              )}
            </div>
          )
        })}
    </div>
  )
}
