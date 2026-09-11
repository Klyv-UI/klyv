'use client'

import { useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface MiniMapRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MiniMapProps {
  /** Size of the whole thing being surveyed, in content coordinates. */
  contentWidth: number
  /** Height of the whole surface, in its own coordinates. */
  contentHeight: number
  /** The part currently on screen, in the same coordinates. */
  viewport: MiniMapRect
  /** Called with the content point the reader wants centred. */
  onNavigate: (point: { x: number; y: number }) => void
  /** Accessible name. */
  label: string
  /** Width of the map itself, in pixels. The height follows the aspect ratio. */
  width?: number
  /** A cheap likeness of the content — blocks, not the real thing. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A scaled-down survey of a large surface, with the on-screen part outlined
 * and draggable.
 *
 * It takes the viewport as a rectangle in *content* coordinates and reports
 * back a content point to centre. That keeps it ignorant of transforms,
 * scroll offsets and zoom, so the same component works over a pan-and-zoom
 * canvas, a long document or a wide timeline — anything that can say where it
 * is looking and be told where to look instead.
 *
 * Dragging moves the outline under the pointer rather than by a delta, because
 * a minimap is a positional control: the point you press is the point you want
 * to be looking at, and a delta-based drag drifts out of alignment the moment
 * the zoom changes.
 *
 * The children are a likeness, not a copy. Rendering the real content at 1/12
 * scale costs the same as rendering it once more; a handful of blocks in the
 * right places conveys the same thing for nothing.
 */
export function MiniMap({
  contentWidth,
  contentHeight,
  viewport,
  onNavigate,
  label,
  width = 168,
  children,
  className,
}: MiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const scale = width / contentWidth
  const height = contentHeight * scale

  const navigate = (clientX: number, clientY: number) => {
    const box = mapRef.current?.getBoundingClientRect()
    if (!box) return
    onNavigate({
      x: (clientX - box.left) / scale,
      y: (clientY - box.top) / scale,
    })
  }

  const outline = {
    left: viewport.x * scale,
    top: viewport.y * scale,
    width: viewport.width * scale,
    height: viewport.height * scale,
  }

  return (
    <div
      ref={mapRef}
      role="group"
      aria-label={label}
      onPointerDown={(event) => {
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        navigate(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (dragging.current) navigate(event.clientX, event.clientY)
      }}
      onPointerUp={() => {
        dragging.current = false
      }}
      onPointerCancel={() => {
        dragging.current = false
      }}
      className={cn(
        'relative cursor-pointer touch-none overflow-hidden rounded-[var(--radius-glyph)] border border-line bg-surface-muted',
        className,
      )}
      style={{ width, height }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{ width: contentWidth, height: contentHeight, transform: `scale(${scale})` }}
      >
        {children}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-[3px] border-2 border-accent-strong bg-accent/15"
        style={{
          left: Math.max(0, outline.left),
          top: Math.max(0, outline.top),
          width: Math.min(width, outline.width),
          height: Math.min(height, outline.height),
        }}
      />
    </div>
  )
}
