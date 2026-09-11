'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface CropRect {
  /** All four are fractions of the frame, 0 to 1. */
  x: number
  y: number
  width: number
  height: number
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'

export interface CropperProps {
  /** What is being cropped — an image, a chart, a screenshot. */
  children: ReactNode
  /** Accessible name for the crop frame. */
  label: string
  value?: CropRect
  onChange?: (rect: CropRect) => void
  /** Lock the ratio, as width ÷ height. Omit to crop freely. */
  aspect?: number
  /** Smallest crop, as a fraction of the frame. */
  minSize?: number
  /** Draw thirds inside the crop. */
  guides?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const HANDLES: { id: Handle; className: string; cursor: string }[] = [
  { id: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { id: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
  { id: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { id: 'e', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { id: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
  { id: 's', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
  { id: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
  { id: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
]

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * A crop frame over any content, with eight handles and a keyboard.
 *
 * Everything is stored as fractions of the frame rather than pixels, so a crop
 * survives the container being resized, the image loading at a different size,
 * and the whole thing being re-rendered at another breakpoint. Pixels would
 * have to be re-derived on every one of those, and the usual result is a crop
 * that silently drifts off its subject.
 *
 * The area outside the crop is dimmed by one enormous `box-shadow` on the crop
 * itself rather than by four positioned panes. One element, no seams where the
 * panes meet, and nothing to keep in sync as the rectangle moves.
 *
 * With `aspect` set, a corner drag adjusts width and derives height, so the
 * ratio can never drift by a rounding error. Every handle is focusable and
 * moves on the arrow keys, which is the only way this is usable without a
 * pointer — and Shift makes the steps coarse.
 */
export function Cropper({
  children,
  label,
  value,
  onChange,
  aspect,
  minSize = 0.08,
  guides = true,
  className,
}: CropperProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; x: number; y: number; rect: CropRect } | null>(null)
  const [uncontrolled, setUncontrolled] = useState<CropRect>({
    x: 0.12,
    y: 0.12,
    width: 0.76,
    height: aspect ? 0.76 / aspect : 0.76,
  })

  const rect = value ?? uncontrolled

  const apply = (next: CropRect) => {
    if (value === undefined) setUncontrolled(next)
    onChange?.(next)
  }

  /** Resize or move, in fractions, then put the result back inside the frame. */
  const resolve = (handle: Handle, base: CropRect, dx: number, dy: number): CropRect => {
    if (handle === 'move') {
      return {
        ...base,
        x: clamp01(Math.min(base.x + dx, 1 - base.width)),
        y: clamp01(Math.min(base.y + dy, 1 - base.height)),
      }
    }

    let { x, y, width, height } = base
    if (handle.includes('w')) {
      const right = x + width
      x = Math.min(clamp01(x + dx), right - minSize)
      width = right - x
    }
    if (handle.includes('e')) width = Math.min(clamp01(width + dx), 1 - x)
    if (handle.includes('n')) {
      const bottom = y + height
      y = Math.min(clamp01(y + dy), bottom - minSize)
      height = bottom - y
    }
    if (handle.includes('s')) height = Math.min(clamp01(height + dy), 1 - y)

    width = Math.max(minSize, width)
    height = Math.max(minSize, height)

    if (aspect) {
      // Width leads; height is derived, so the ratio cannot drift.
      height = Math.min(width / aspect, 1 - y)
      width = height * aspect
      if (x + width > 1) {
        width = 1 - x
        height = width / aspect
      }
    }

    return { x, y, width, height }
  }

  const start = (event: React.PointerEvent, handle: Handle) => {
    event.stopPropagation()
    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return
    drag.current = { handle, x: event.clientX, y: event.clientY, rect }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const move = (event: React.PointerEvent) => {
    const box = frameRef.current?.getBoundingClientRect()
    if (!drag.current || !box) return
    apply(
      resolve(
        drag.current.handle,
        drag.current.rect,
        (event.clientX - drag.current.x) / box.width,
        (event.clientY - drag.current.y) / box.height,
      ),
    )
  }

  const end = () => {
    drag.current = null
  }

  const onKeyDown = (event: React.KeyboardEvent, handle: Handle) => {
    const step = event.shiftKey ? 0.05 : 0.01
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const delta = map[event.key]
    if (!delta) return
    event.preventDefault()
    event.stopPropagation()
    apply(resolve(handle, rect, delta[0], delta[1]))
  }

  const percent = (value: number) => `${value * 100}%`

  return (
    <div
      ref={frameRef}
      className={cn('relative select-none overflow-hidden rounded-[var(--radius-card)]', className)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}

      <div
        role="group"
        aria-label={label}
        tabIndex={0}
        onPointerDown={(event) => start(event, 'move')}
        onKeyDown={(event) => onKeyDown(event, 'move')}
        className="absolute cursor-move touch-none outline-offset-2"
        style={{
          left: percent(rect.x),
          top: percent(rect.y),
          width: percent(rect.width),
          height: percent(rect.height),
          // One shadow dims everything outside. Four panes would leave seams.
          boxShadow: '0 0 0 9999px rgba(23, 25, 28, 0.55)',
        }}
      >
        <div aria-hidden="true" className="absolute inset-0 border border-white/80" />

        {guides && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
          </div>
        )}

        {HANDLES.map((handle) => (
          <button
            key={handle.id}
            type="button"
            aria-label={`Resize ${handle.id.toUpperCase()}`}
            onPointerDown={(event) => start(event, handle.id)}
            onKeyDown={(event) => onKeyDown(event, handle.id)}
            className={cn(
              'absolute h-3 w-3 touch-none rounded-[2px] border border-ink/20 bg-white shadow-[var(--shadow-tile)]',
              handle.className,
            )}
            style={{ cursor: handle.cursor }}
          />
        ))}
      </div>
    </div>
  )
}
