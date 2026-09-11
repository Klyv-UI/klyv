'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface StackedCardsProps<T> {
  /** The sequence to render. */
  items: T[]
  /** Stable key for an entry. Index keys break as soon as the order changes. */
  itemId: (item: T) => string
  /** Renders one card. */
  renderItem: (item: T, state: { index: number; buried: number }) => ReactNode
  /** Distance from the top of the scroll area each card sticks at, in pixels. */
  top?: number
  /** How far each card below the top of the stack is stepped down, in pixels. */
  step?: number
  /** Space each card gets before the next arrives, in pixels. */
  spacing?: number
  /** Scroll container. Defaults to the window. */
  scrollRef?: RefObject<HTMLElement | null>
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Cards that stick as you scroll and pile up behind each other.
 *
 * Sticky positioning does the stacking on its own: each card sticks a little
 * lower than the one before, so a card that has been passed stays on screen
 * with its top edge showing. What sticky cannot do is make a buried card
 * recede, so a single scroll measurement per frame supplies one number — how
 * many cards are now on top of this one — and each card scales and dims by
 * that count.
 *
 * That split matters. The layout is CSS and survives without JavaScript; only
 * the depth is scripted, and under `prefers-reduced-motion` the scripting is
 * simply skipped and the cards stack flat. Nothing disappears either way.
 */
export function StackedCards<T>({
  items,
  itemId,
  renderItem,
  top = 24,
  step = 14,
  spacing = 220,
  scrollRef,
  className,
}: StackedCardsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const [buried, setBuried] = useState<number[]>(() => items.map(() => 0))
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) {
      setBuried(items.map(() => 0))
      return
    }

    const container = scrollRef?.current
    let frame = 0

    const measure = () => {
      frame = 0
      const viewTop = container ? container.getBoundingClientRect().top : 0

      setBuried(
        cardsRef.current.map((card, index) => {
          if (!card) return 0
          // How far this card has been pushed past its sticky resting place,
          // in whole cards. Its own sticky offset is index * step.
          const resting = viewTop + top + index * step
          const passed = (resting - card.getBoundingClientRect().top) / spacing
          return Math.max(0, Math.min(items.length - 1, passed))
        }),
      )
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    const source: HTMLElement | Window = container ?? window
    source.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    measure()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      source.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [items.length, reducedMotion, scrollRef, spacing, step, top])

  return (
    <div ref={containerRef} className={cn('flex flex-col', className)}>
      {items.map((item, index) => {
        const depth = buried[index] ?? 0
        return (
          <div
            key={itemId(item)}
            ref={(node) => {
              cardsRef.current[index] = node
            }}
            className="sticky"
            style={{
              top: top + index * step,
              // Each card gets its own run of scroll before the next arrives.
              marginBottom: index === items.length - 1 ? 0 : spacing - step,
              zIndex: index + 1,
            }}
          >
            <div
              className="origin-top will-change-transform"
              style={{
                transform: `scale(${1 - Math.min(depth, 3) * 0.035})`,
                opacity: 1 - Math.min(depth, 3) * 0.12,
              }}
            >
              {renderItem(item, { index, buried: depth })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
