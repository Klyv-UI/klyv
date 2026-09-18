'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export interface MarqueeSelectProps {
  children: ReactNode
  /** Selected ids. Items carry theirs on `data-select-id`. */
  value: string[]
  /** Called with the selected ids. */
  onChange: (ids: string[]) => void
  /** Accessible name for the region. */
  label: string
  /** Attribute used to find and identify selectable items. */
  attribute?: string
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top

/**
 * Drag a rectangle across a region to select everything it touches.
 *
 * Items are found by attribute rather than by being passed in, so the region
 * does not have to own or re-render its contents to be selectable — a grid, a
 * canvas of absolutely positioned nodes and a list of cards all work unchanged
 * by adding one attribute to each item.
 *
 * Their positions are measured once, when the drag begins. Re-measuring on
 * every pointer move would be an O(n) layout read per frame, and worse, the
 * items are already moving under a selection style, so the second measurement
 * would not agree with the first.
 *
 * Shift and the platform modifier add to the selection instead of replacing it,
 * which is the behaviour every file manager has trained people to expect.
 * Escape clears, and Ctrl or Cmd with A selects everything, so the region is
 * fully usable without drawing a rectangle at all.
 */
export function MarqueeSelect({
  children,
  value,
  onChange,
  label,
  attribute = 'data-select-id',
  disabled = false,
  className,
}: MarqueeSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const origin = useRef<{ x: number; y: number; base: string[] } | null>(null)
  const items = useRef<{ id: string; box: Box }[]>([])
  const [marquee, setMarquee] = useState<Box | null>(null)

  const measure = () => {
    const root = rootRef.current
    if (!root) return
    const rootBox = root.getBoundingClientRect()
    items.current = [...root.querySelectorAll<HTMLElement>(`[${attribute}]`)].map((node) => {
      const box = node.getBoundingClientRect()
      return {
        id: node.getAttribute(attribute) ?? '',
        box: {
          left: box.left - rootBox.left,
          top: box.top - rootBox.top,
          width: box.width,
          height: box.height,
        },
      }
    })
  }

  const pointIn = (event: React.PointerEvent) => {
    const box = rootRef.current?.getBoundingClientRect()
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return
    // A press on an item is that item's business — only the background drags.
    if ((event.target as HTMLElement).closest(`[${attribute}]`)) return

    measure()
    const point = pointIn(event)
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    origin.current = { ...point, base: additive ? value : [] }
    setMarquee({ left: point.x, top: point.y, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!additive && value.length > 0) onChange([])
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!origin.current) return
    const point = pointIn(event)
    const box: Box = {
      left: Math.min(origin.current.x, point.x),
      top: Math.min(origin.current.y, point.y),
      width: Math.abs(point.x - origin.current.x),
      height: Math.abs(point.y - origin.current.y),
    }
    setMarquee(box)

    const hit = items.current.filter((item) => overlaps(box, item.box)).map((item) => item.id)
    const next = [...new Set([...origin.current.base, ...hit])]
    if (next.length !== value.length || next.some((id) => !value.includes(id))) onChange(next)
  }

  const end = () => {
    origin.current = null
    setMarquee(null)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && value.length > 0) {
      event.preventDefault()
      onChange([])
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      measure()
      onChange(items.current.map((item) => item.id))
    }
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn('relative select-none', className)}
    >
      {children}

      {marquee && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 rounded-[var(--radius-3)] border border-accent-strong bg-accent/20"
          style={marquee}
        />
      )}

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {value.length === 0 ? 'Nothing selected' : `${value.length} selected`}
        </p>
      </VisuallyHidden>
    </div>
  )
}
