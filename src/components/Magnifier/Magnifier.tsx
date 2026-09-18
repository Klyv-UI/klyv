'use client'

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'

export interface MagnifierProps {
  /** The image. The lens shows this same file, scaled up. */
  src: string
  /** Describes the image. */
  alt: string
  /** How many times larger the lens shows it. */
  zoom?: number
  /** Lens diameter, or side for a square lens, in pixels. */
  size?: number
  /** Lens shape. */
  shape?: 'circle' | 'square'
  /** Image aspect ratio (width / height). Reserves the space before the image loads. */
  aspectRatio?: number
  /** Merged last, so it wins. */
  className?: string
}

/** Focus from the keyboard shows the lens at once; a click's focus waits for the pointer. */
function keyboardFocus(node: Element) {
  try {
    return node.matches(':focus-visible')
  } catch {
    return false
  }
}

/**
 * A loupe that follows the pointer over an image and shows what is under it,
 * enlarged.
 *
 * The lens is the same image as a background at `zoom` times the rendered
 * size, positioned so the point under the lens centre sits in the middle. No
 * second file and no canvas: the browser already has the pixels, and at high
 * zoom it resamples the original rather than the smaller rendered copy — so a
 * large source image shows genuine detail.
 *
 * The lens stays inside the image, so it never hangs off an edge into the
 * page. With focus, the arrow keys move it (Shift for larger steps) and
 * Escape puts it away; on touch it appears under the finger while pressed.
 */
export function Magnifier({ src, alt, zoom = 2.5, size = 160, shape = 'circle', aspectRatio, className }: MagnifierProps) {
  const box = useRef<HTMLDivElement>(null)
  /** Lens centre as a fraction of the image, or null when hidden. */
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const hintId = useId()

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPoint({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (event.key === 'Escape') return setPoint(null)
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setPoint((current) => {
      const from = current ?? { x: 0.5, y: 0.5 }
      return { x: Math.max(0, Math.min(1, from.x + move[0])), y: Math.max(0, Math.min(1, from.y + move[1])) }
    })
  }

  const rect = box.current?.getBoundingClientRect()
  const width = rect?.width ?? 0
  const height = rect?.height ?? 0
  const lens = Math.min(size, width, height)
  // Clamp the lens box inside the image, then magnify around its (clamped) centre.
  const cx = point ? Math.max(lens / 2, Math.min(width - lens / 2, point.x * width)) : 0
  const cy = point ? Math.max(lens / 2, Math.min(height - lens / 2, point.y * height)) : 0

  return (
    <div
      ref={box}
      tabIndex={0}
      role="group"
      aria-roledescription="magnifier"
      aria-label="Image magnifier"
      aria-describedby={hintId}
      onPointerEnter={fromPointer}
      onPointerMove={fromPointer}
      onPointerDown={fromPointer}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setPoint(null)}
      onPointerUp={(event) => event.pointerType !== 'mouse' && setPoint(null)}
      onPointerCancel={() => setPoint(null)}
      onFocus={(event) => keyboardFocus(event.currentTarget) && setPoint((current) => current ?? { x: 0.5, y: 0.5 })}
      onBlur={() => setPoint(null)}
      onKeyDown={onKeyDown}
      className={cn('relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-[var(--radius-card)] outline-offset-2', className)}
    >
      <img src={src} alt={alt} draggable={false} style={aspectRatio ? { aspectRatio } : undefined} className="block h-auto w-full object-fill" />
      <span id={hintId} className="sr-only">
        Use the arrow keys to move the lens, Shift for bigger steps, Escape to hide it.
      </span>
      {point && lens > 0 && (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute border-2 border-shell bg-surface bg-no-repeat shadow-[var(--shadow-float)]',
            shape === 'circle' ? 'rounded-full' : 'rounded-[var(--radius-tile)]',
          )}
          style={{
            width: lens,
            height: lens,
            left: cx - lens / 2,
            top: cy - lens / 2,
            backgroundImage: `url("${src.replace(/"/g, '%22')}")`,
            backgroundSize: `${width * zoom}px ${height * zoom}px`,
            backgroundPosition: `${lens / 2 - cx * zoom}px ${lens / 2 - cy * zoom}px`,
          }}
        />
      )}
    </div>
  )
}
