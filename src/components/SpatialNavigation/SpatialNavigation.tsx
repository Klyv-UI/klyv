'use client'

import { useRef, type ElementType, type KeyboardEvent, type ReactNode } from 'react'

export type SpatialNavigationDirection = 'up' | 'down' | 'left' | 'right'

export interface SpatialNavigationProps {
  /** Anything with focusable elements in it — cards, tiles, a toolbar of odd shapes. */
  children: ReactNode
  /** Accessible name. When set, the container is a labelled group. */
  label?: string
  /** Home and End jump to the first and last focusable element. */
  homeEnd?: boolean
  /**
   * Half-angle of the search cone, in degrees. Narrower keeps a move in its lane;
   * wider reaches diagonal neighbours when nothing is straight ahead.
   */
  coneAngle?: number
  /** Extra selector for elements that keep the arrow keys for themselves. */
  ignore?: string
  /** Called after focus moves. */
  onNavigate?: (element: HTMLElement, direction: SpatialNavigationDirection) => void
  /** Element to render. */
  as?: ElementType
  /** Merged onto the container. */
  className?: string
}

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]'

// Controls whose arrow keys already mean something: moving a caret, a slider, an option.
const OWNS_ARROWS = [
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="tablist"]',
  '[role="radiogroup"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[data-spatial-ignore]',
].join(', ')

const KEYS: Record<string, SpatialNavigationDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function candidates(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[inert], [hidden], [aria-hidden="true"]')) {
      return false
    }
    const box = element.getBoundingClientRect()
    return box.width > 0 || box.height > 0
  })
}

/**
 * The nearest candidate in a direction, by on-screen geometry.
 *
 * Distance along the direction is measured edge to edge; sideways offset is
 * zero when the two boxes overlap across the axis and the edge gap otherwise,
 * and it costs twice as much as forward distance, so the tile straight ahead
 * beats a closer one diagonally. Anything outside the cone is not a candidate.
 */
export function findSpatialNeighbour(
  from: DOMRect,
  options: { element: HTMLElement; box: DOMRect }[],
  direction: SpatialNavigationDirection,
  coneAngle = 60,
) {
  const slope = Math.tan((Math.min(89, Math.max(1, coneAngle)) * Math.PI) / 180)
  const horizontal = direction === 'left' || direction === 'right'
  const sign = direction === 'right' || direction === 'down' ? 1 : -1
  const centre = (box: DOMRect) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
  const origin = centre(from)

  let best: HTMLElement | null = null
  let bestScore = Infinity
  for (const { element, box } of options) {
    const point = centre(box)
    const along = (horizontal ? point.x - origin.x : point.y - origin.y) * sign
    if (along <= 0.5) continue
    const edge = horizontal
      ? sign > 0 ? box.left - from.right : from.left - box.right
      : sign > 0 ? box.top - from.bottom : from.top - box.bottom
    const [aStart, aEnd, bStart, bEnd] = horizontal
      ? [from.top, from.bottom, box.top, box.bottom]
      : [from.left, from.right, box.left, box.right]
    const sideways = Math.max(0, bStart - aEnd, aStart - bEnd)
    const offset = Math.abs(horizontal ? point.y - origin.y : point.x - origin.x)
    if (sideways > 0 && offset > along * slope) continue
    const score = Math.max(0, edge) + sideways * 2 + offset * 0.05
    if (score < bestScore) {
      bestScore = score
      best = element
    }
  }
  return best
}

/**
 * Arrow-key focus movement by what is on screen, for layouts that are not a list.
 *
 * Roving focus works when items form a row or a grid with known columns. A
 * dashboard of mixed-size cards, a TV-style shelf or a canvas of tiles has
 * neither, and Tab through it zigzags in source order. Here the arrow keys
 * move focus to the nearest focusable element in that direction, judged by
 * bounding boxes: a cone rules out things behind or far to the side, and
 * sideways distance is weighted above forward distance so a move stays in its
 * lane. Tab still works as before.
 *
 * Inputs, sliders, listboxes and anything else that uses the arrow keys itself
 * are left alone, as is any element marked `data-spatial-ignore`, and a key a
 * child already handled is not taken again.
 */
export function SpatialNavigation({
  children,
  label,
  homeEnd = true,
  coneAngle = 60,
  ignore,
  onNavigate,
  as: Tag = 'div',
  className,
}: SpatialNavigationProps) {
  const ref = useRef<HTMLElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const root = ref.current
    const target = event.target as HTMLElement
    if (!root || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const direction = KEYS[event.key]
    const edge = homeEnd && (event.key === 'Home' || event.key === 'End')
    if (!direction && !edge) return
    const owner = target.closest(ignore ? `${OWNS_ARROWS}, ${ignore}` : OWNS_ARROWS)
    if (owner && root.contains(owner)) return

    const list = candidates(root)
    let next: HTMLElement | null = null
    if (edge) {
      next = event.key === 'Home' ? list[0] ?? null : list[list.length - 1] ?? null
    } else if (direction) {
      const from = list.includes(target) ? target : null
      if (!from) return
      next = findSpatialNeighbour(
        from.getBoundingClientRect(),
        list.filter((element) => element !== from).map((element) => ({ element, box: element.getBoundingClientRect() })),
        direction,
        coneAngle,
      )
    }
    if (!next || next === target) return
    event.preventDefault()
    next.focus()
    next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    if (direction) onNavigate?.(next, direction)
  }

  return (
    <Tag
      ref={ref}
      role={label ? 'group' : undefined}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={className}
    >
      {children}
    </Tag>
  )
}
