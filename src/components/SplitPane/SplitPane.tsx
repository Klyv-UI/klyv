'use client'

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'

export interface SplitPaneProps {
  /** The first pane — left, or top when vertical. */
  start: ReactNode
  /** The second pane. It takes whatever the first does not. */
  end: ReactNode
  /** horizontal sets the panes side by side; vertical stacks them. */
  orientation?: 'horizontal' | 'vertical'
  /** Size of the first pane, as a percentage. Pass it to control the split. */
  size?: number
  /** Starting size when the component owns the split. */
  defaultSize?: number
  /** Fires on each keyboard step, and once when a drag ends. */
  onSizeChange?: (size: number) => void
  /** Smallest the first pane may be, as a percentage. */
  min?: number
  /** Largest the first pane may be, as a percentage. */
  max?: number
  /** Accessible name for the divider — say what it resizes. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Two panes with a divider between them, moved by pointer or keyboard.
 *
 * The divider is a focusable separator with a value, so it is announced with
 * its position and moves with the arrow keys — Shift for bigger steps, Home and
 * End for the limits. While dragging, the size is written to a custom property
 * on the container rather than through React state, so a drag is not a render
 * per pointer event; the value is committed once, when the drag ends.
 */
export function SplitPane({
  start,
  end,
  orientation = 'horizontal',
  size,
  defaultSize = 50,
  onSizeChange,
  min = 15,
  max = 85,
  label,
  className,
}: SplitPaneProps) {
  const container = useRef<HTMLDivElement>(null)
  const divider = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const [own, setOwn] = useState(defaultSize)
  const current = size ?? own
  const horizontal = orientation === 'horizontal'

  const clamp = (value: number) => Math.min(max, Math.max(min, value))

  const commit = (value: number) => {
    const next = clamp(value)
    if (size === undefined) setOwn(next)
    onSizeChange?.(next)
  }

  /** The drag-time path: style and ARIA written straight to the nodes. */
  const paint = (value: number) => {
    container.current?.style.setProperty('--split', `${value}%`)
    divider.current?.setAttribute('aria-valuenow', String(Math.round(value)))
  }

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = container.current?.getBoundingClientRect()
    if (!rect) return current
    const ratio = horizontal
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height
    return clamp(ratio * 100)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = current
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current === null) return
    dragging.current = fromPointer(event)
    paint(dragging.current)
  }

  const onPointerUp = () => {
    if (dragging.current === null) return
    commit(dragging.current)
    dragging.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2
    const back = horizontal ? 'ArrowLeft' : 'ArrowUp'
    const forward = horizontal ? 'ArrowRight' : 'ArrowDown'

    let next: number | null = null
    if (event.key === back) next = current - step
    else if (event.key === forward) next = current + step
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    if (next === null) return

    event.preventDefault()
    commit(next)
  }

  return (
    <div
      ref={container}
      style={{ '--split': `${current}%` } as CSSProperties}
      className={cn(
        'flex min-h-0 min-w-0 overflow-hidden',
        horizontal ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      <div className="min-h-0 min-w-0 overflow-auto" style={{ flex: '0 0 var(--split)' }}>
        {start}
      </div>

      <div
        ref={divider}
        role="separator"
        tabIndex={0}
        aria-label={label}
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(current)}
        aria-valuemin={min}
        aria-valuemax={max}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          'group relative flex shrink-0 touch-none items-center justify-center focus-visible:outline-none',
          horizontal ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'rounded-full bg-line-strong transition-colors group-hover:bg-accent group-focus-visible:bg-accent',
            horizontal ? 'h-10 w-1' : 'h-1 w-10',
          )}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{end}</div>
    </div>
  )
}
