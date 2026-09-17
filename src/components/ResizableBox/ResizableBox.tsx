'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ResizableBoxSize {
  width: number
  height: number
}

export type ResizableBoxHandle = 'right' | 'bottom' | 'corner'

export interface ResizableBoxProps {
  children?: ReactNode
  /** Controlled size, in pixels. */
  size?: ResizableBoxSize
  /** Starting size when uncontrolled, in pixels. */
  defaultSize?: ResizableBoxSize
  /** Called on every drag movement and key press. */
  onResize?: (size: ResizableBoxSize) => void
  /** Called once when a drag ends, and after each key press. */
  onResizeEnd?: (size: ResizableBoxSize) => void
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  /** Which edges can be dragged. */
  handles?: ResizableBoxHandle[]
  /** Always keep the starting proportions. Holding Shift does this for one resize. */
  lockAspectRatio?: boolean
  /** Pixels per arrow-key press. */
  step?: number
  /** What the box is, for the handles' names — "Preview" gives "Resize preview width". */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A box the reader can make bigger or smaller — a preview frame, a notes
 * panel, a chart they want to see at a size of their choosing.
 *
 * Each handle is a focusable separator carrying the dimension it changes, so
 * it is announced as "Resize preview width, 320" and moves with the arrow
 * keys; Home and End go to the limits. The corner changes both at once.
 *
 * Shift keeps the proportions the box had when the resize began, on the
 * pointer and on the keyboard alike, because that is the modifier every
 * design tool uses and the one hands already reach for.
 */
export function ResizableBox({
  children,
  size,
  defaultSize = { width: 320, height: 200 },
  onResize,
  onResizeEnd,
  minWidth = 80,
  minHeight = 60,
  maxWidth = 1200,
  maxHeight = 800,
  handles = ['right', 'bottom', 'corner'],
  lockAspectRatio = false,
  step = 10,
  label = 'box',
  className,
}: ResizableBoxProps) {
  const [own, setOwn] = useState(defaultSize)
  const current = size ?? own
  const drag = useRef<{ x: number; y: number; start: ResizableBoxSize; last: ResizableBoxSize } | null>(null)

  /** Clamps a size, keeping `ratio` (width / height) when one is given. */
  const fit = (next: ResizableBoxSize, ratio: number | null, lead: 'width' | 'height'): ResizableBoxSize => {
    if (!ratio) {
      return {
        width: Math.round(Math.min(maxWidth, Math.max(minWidth, next.width))),
        height: Math.round(Math.min(maxHeight, Math.max(minHeight, next.height))),
      }
    }
    const low = Math.max(minWidth, minHeight * ratio)
    const high = Math.min(maxWidth, maxHeight * ratio)
    const width = Math.min(high, Math.max(low, lead === 'width' ? next.width : next.height * ratio))
    return { width: Math.round(width), height: Math.round(width / ratio) }
  }

  const apply = (next: ResizableBoxSize) => {
    if (size === undefined) setOwn(next)
    onResize?.(next)
    return next
  }

  const resized = (handle: ResizableBoxHandle, from: ResizableBoxSize, dx: number, dy: number, keepRatio: boolean) => {
    const ratio = keepRatio || lockAspectRatio ? from.width / from.height : null
    const raw = {
      width: handle === 'bottom' ? from.width : from.width + dx,
      height: handle === 'right' ? from.height : from.height + dy,
    }
    const lead = handle === 'bottom' || (handle === 'corner' && Math.abs(dy) > Math.abs(dx)) ? 'height' : 'width'
    return fit(raw, ratio, lead)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.currentTarget.focus()
    drag.current = { x: event.clientX, y: event.clientY, start: current, last: current }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>, handle: ResizableBoxHandle) => {
    const state = drag.current
    if (!state) return
    const next = resized(handle, state.start, event.clientX - state.x, event.clientY - state.y, event.shiftKey)
    if (next.width === state.last.width && next.height === state.last.height) return
    state.last = apply(next)
  }

  const onPointerUp = () => {
    if (!drag.current) return
    onResizeEnd?.(drag.current.last)
    drag.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, handle: ResizableBoxHandle) => {
    const horizontal = handle !== 'bottom'
    const vertical = handle !== 'right'
    let dx = 0
    let dy = 0
    if (horizontal && event.key === 'ArrowRight') dx = step
    else if (horizontal && event.key === 'ArrowLeft') dx = -step
    else if (vertical && event.key === 'ArrowDown') dy = step
    else if (vertical && event.key === 'ArrowUp') dy = -step
    else if (event.key === 'Home') {
      dx = -Infinity
      dy = -Infinity
    } else if (event.key === 'End') {
      dx = Infinity
      dy = Infinity
    } else return
    event.preventDefault()
    const next = apply(resized(handle, current, dx, dy, event.shiftKey))
    onResizeEnd?.(next)
  }

  const common = (handle: ResizableBoxHandle) => ({
    role: 'separator',
    tabIndex: 0,
    onPointerDown,
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => onPointerMove(event, handle),
    onPointerUp,
    onPointerCancel: onPointerUp,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => onKeyDown(event, handle),
  })

  const grip = 'rounded-full bg-line-strong transition-colors group-hover:bg-accent-strong group-focus-visible:bg-accent-strong'

  return (
    <div
      className={cn('relative shrink-0 rounded-[var(--radius-tile)] border border-line bg-surface', className)}
      style={{ width: current.width, height: current.height }}
    >
      <div className="size-full overflow-auto rounded-[inherit]">{children}</div>

      {handles.includes('right') && (
        <div
          {...common('right')}
          aria-label={`Resize ${label} width`}
          aria-orientation="vertical"
          aria-valuenow={current.width}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          aria-valuetext={`${current.width} pixels wide`}
          className="group absolute -right-2 bottom-4 top-4 flex w-4 cursor-ew-resize touch-none items-center justify-center rounded-full focus-visible:outline-offset-0"
        >
          <span aria-hidden="true" className={cn(grip, 'h-8 w-1')} />
        </div>
      )}
      {handles.includes('bottom') && (
        <div
          {...common('bottom')}
          aria-label={`Resize ${label} height`}
          aria-orientation="horizontal"
          aria-valuenow={current.height}
          aria-valuemin={minHeight}
          aria-valuemax={maxHeight}
          aria-valuetext={`${current.height} pixels tall`}
          className="group absolute -bottom-2 left-4 right-4 flex h-4 cursor-ns-resize touch-none items-center justify-center rounded-full focus-visible:outline-offset-0"
        >
          <span aria-hidden="true" className={cn(grip, 'h-1 w-8')} />
        </div>
      )}
      {handles.includes('corner') && (
        <div
          {...common('corner')}
          aria-label={`Resize ${label}`}
          aria-valuenow={current.width}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          aria-valuetext={`${current.width} by ${current.height} pixels`}
          className="group absolute -bottom-2 -right-2 flex size-5 cursor-nwse-resize touch-none items-center justify-center rounded-full focus-visible:outline-offset-0"
        >
          <svg viewBox="0 0 10 10" width={10} height={10} aria-hidden="true" className="text-line-strong transition-colors group-hover:text-accent-strong group-focus-visible:text-accent-strong">
            <path d="M9 3L3 9M9 6.5L6.5 9" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  )
}
