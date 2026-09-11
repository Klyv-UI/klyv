'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'

export interface RowAction {
  id: string
  label: string
  icon: IconComponent
  onSelect: () => void
  tone?: 'neutral' | 'accent' | 'danger'
}

const TONES: Record<NonNullable<RowAction['tone']>, string> = {
  neutral: 'bg-surface-muted text-ink',
  accent: 'bg-accent text-accent-ink',
  danger: 'bg-danger text-white',
}

export interface SwipeRowProps {
  children: ReactNode
  /** Revealed by swiping right, i.e. sitting on the left edge. */
  leading?: RowAction[]
  /** Revealed by swiping left. The destructive one belongs here. */
  trailing?: RowAction[]
  /** Width of one action button, in pixels. */
  actionWidth?: number
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A list row that slides aside to reveal its actions.
 *
 * The actions are laid under the row rather than inside it, so the row itself
 * is one opaque surface on a single `translateX` — no clipping, no measuring,
 * and the actions do not reflow as it moves. Past a third of their width the
 * row snaps fully open; short of that it snaps shut, which is what makes the
 * gesture feel decided rather than approximate.
 *
 * The actions are real buttons in the DOM at all times, so Tab reaches them
 * whether or not anyone has swiped — and focusing one opens the row, so the
 * keyboard path shows exactly what the gesture would have shown. Hiding the
 * actions until a pointer drag is what usually makes this pattern unreachable.
 */
export function SwipeRow({
  children,
  leading = [],
  trailing = [],
  actionWidth = 76,
  disabled = false,
  className,
}: SwipeRowProps) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; offset: number } | null>(null)

  const leadingWidth = leading.length * actionWidth
  const trailingWidth = trailing.length * actionWidth

  const close = () => setOffset(0)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || (leading.length === 0 && trailing.length === 0)) return
    start.current = { x: event.clientX, offset }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    const next = start.current.offset + (event.clientX - start.current.x)
    setOffset(Math.max(-trailingWidth, Math.min(leadingWidth, next)))
  }

  const onPointerUp = () => {
    if (!start.current) return
    start.current = null
    setDragging(false)
    // A third of the way is enough to commit; anything less snaps back.
    if (offset > leadingWidth / 3) setOffset(leadingWidth)
    else if (offset < -trailingWidth / 3) setOffset(-trailingWidth)
    else setOffset(0)
  }

  const actionList = (actions: RowAction[], side: 'left' | 'right') => (
    <div className={cn('absolute inset-y-0 flex', side === 'left' ? 'left-0' : 'right-0')}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => {
            action.onSelect()
            close()
          }}
          // Focusing an action opens the row, so the keyboard sees what the
          // gesture would have revealed.
          onFocus={() => setOffset(side === 'left' ? leadingWidth : -trailingWidth)}
          onBlur={(event) => {
            if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) close()
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors',
            TONES[action.tone ?? 'neutral'],
          )}
          style={{ width: actionWidth }}
        >
          <action.icon size={16} strokeWidth={2.25} aria-hidden="true" />
          {action.label}
        </button>
      ))}
    </div>
  )

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-muted',
        className,
      )}
    >
      {leading.length > 0 && actionList(leading, 'left')}
      {trailing.length > 0 && actionList(trailing, 'right')}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'relative z-10 bg-surface',
          !disabled && 'touch-pan-y',
          // The drag follows the pointer exactly; only the snap is eased.
          !dragging &&
            'motion-safe-only transition-transform duration-[var(--duration-slow)] ease-[cubic-bezier(0.32,0.72,0,1)]',
        )}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
      >
        {children}
      </div>
    </div>
  )
}
