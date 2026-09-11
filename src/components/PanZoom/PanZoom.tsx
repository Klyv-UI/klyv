'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface PanZoomView {
  /** Translation in viewport pixels, applied before the scale. */
  x: number
  y: number
  scale: number
}

export interface PanZoomProps {
  /** The surface being panned and zoomed. */
  children: ReactNode
  /** Accessible name for the viewport. */
  label: string
  /** Size of the content being framed, in its own coordinates. */
  contentWidth: number
  /** Height of what is being framed, in its own coordinates. */
  contentHeight: number
  /** Controlled view. Omit for uncontrolled. */
  view?: PanZoomView
  onViewChange?: (view: PanZoomView) => void
  /** Furthest the view can zoom out. */
  min?: number
  /** Furthest the view can zoom in. */
  max?: number
  /** Zoom on wheel. Turn it off inside a scrolling page if it fights the scroll. */
  wheelZoom?: boolean
  /** Fit the content on mount. */
  fitOnMount?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/**
 * A viewport you can pan and zoom, framing content larger than the frame.
 *
 * Zoom is anchored to the pointer, not to the centre. That is the difference
 * between a canvas that feels like a map and one that fights you: the point
 * under the cursor has to stay under the cursor, so the translation is
 * corrected by the same factor the scale changed by, every time.
 *
 * The transform is `translate` then `scale` with a `0 0` origin, in that order,
 * so the maths stays a single affine step and content coordinates convert to
 * screen coordinates by one multiply and one add — which is what makes a
 * minimap, a selection rectangle or a hit test on top of this tractable.
 *
 * The view is optionally controlled, because anything drawn *about* the
 * viewport — a minimap, a zoom readout, a "fit" button elsewhere — needs the
 * same numbers. Keyboard users get arrows to pan, plus and minus to zoom, and
 * 0 to fit.
 */
export function PanZoom({
  children,
  label,
  contentWidth,
  contentHeight,
  view,
  onViewChange,
  min = 0.25,
  max = 4,
  wheelZoom = true,
  fitOnMount = true,
  className,
}: PanZoomProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [uncontrolled, setUncontrolled] = useState<PanZoomView>({ x: 0, y: 0, scale: 1 })
  const drag = useRef<{ x: number; y: number; view: PanZoomView } | null>(null)

  const current = view ?? uncontrolled

  const apply = (next: PanZoomView) => {
    if (view === undefined) setUncontrolled(next)
    onViewChange?.(next)
  }

  const fit = () => {
    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return
    const scale = clamp(
      Math.min(box.width / contentWidth, box.height / contentHeight) * 0.92,
      min,
      max,
    )
    apply({
      scale,
      x: (box.width - contentWidth * scale) / 2,
      y: (box.height - contentHeight * scale) / 2,
    })
  }

  useEffect(() => {
    // Once, on mount. Refitting on a prop change would throw away wherever
    // the reader had navigated to.
    if (fitOnMount) fit()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Zoom about a point given in frame coordinates. */
  const zoomAt = (factor: number, pointX: number, pointY: number) => {
    const scale = clamp(current.scale * factor, min, max)
    const ratio = scale / current.scale
    apply({
      scale,
      // Keep the content point under (pointX, pointY) exactly where it was.
      x: pointX - (pointX - current.x) * ratio,
      y: pointY - (pointY - current.y) * ratio,
    })
  }

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !wheelZoom) return

    // Registered natively because React's onWheel is passive and cannot
    // preventDefault, which would let the page scroll behind the zoom.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = frame.getBoundingClientRect()
      zoomAt(
        Math.exp(-event.deltaY * 0.0015),
        event.clientX - box.left,
        event.clientY - box.top,
      )
    }

    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
    // Deliberately re-bound each render: the handler closes over the view.
  })

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 120 : 40
    const box = frameRef.current?.getBoundingClientRect()
    const centreX = (box?.width ?? 0) / 2
    const centreY = (box?.height ?? 0) / 2

    switch (event.key) {
      case 'ArrowLeft':
        apply({ ...current, x: current.x + step })
        break
      case 'ArrowRight':
        apply({ ...current, x: current.x - step })
        break
      case 'ArrowUp':
        apply({ ...current, y: current.y + step })
        break
      case 'ArrowDown':
        apply({ ...current, y: current.y - step })
        break
      case '+':
      case '=':
        zoomAt(1.2, centreX, centreY)
        break
      case '-':
        zoomAt(1 / 1.2, centreX, centreY)
        break
      case '0':
        fit()
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <div
      ref={frameRef}
      role="application"
      aria-label={label}
      aria-roledescription="Pan and zoom viewport"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, y: event.clientY, view: current }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        apply({
          ...drag.current.view,
          x: drag.current.view.x + (event.clientX - drag.current.x),
          y: drag.current.view.y + (event.clientY - drag.current.y),
        })
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      className={cn(
        'relative touch-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-app',
        drag.current ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
    >
      <div
        style={{
          width: contentWidth,
          height: contentHeight,
          transformOrigin: '0 0',
          transform: `translate(${current.x}px, ${current.y}px) scale(${current.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
