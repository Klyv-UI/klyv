'use client'

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { PlotAnnouncer } from '../internal/plot'

export interface SnapGuidesItem {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

/** A line drawn while dragging: an alignment guide, a distance to a neighbour, or one of a run of equal gaps. */
export interface SnapGuidesMark {
  kind: 'align' | 'distance' | 'equal'
  axis: 'x' | 'y'
  /** For align: the guide's position. For distance and equal: the gap's start and end along the axis. */
  from: number
  to: number
  /** Position on the other axis, where the line is drawn. For align, the extent it spans. */
  at: number
  atEnd?: number
}

export interface SnapGuidesProps {
  /** Controlled items. */
  items?: SnapGuidesItem[]
  /** Items when uncontrolled. */
  defaultItems?: SnapGuidesItem[]
  /** Called on every move, during a drag and on each key press. */
  onItemsChange?: (items: SnapGuidesItem[]) => void
  /** Accessible name for the canvas. */
  label: string
  /** Canvas width in pixels. */
  width?: number
  /** Canvas height in pixels. */
  height?: number
  /** How close, in pixels, an edge has to come before it snaps. */
  threshold?: number
  /** Also snap to the canvas edges and centre lines. */
  snapToContainer?: boolean
  /** Draws an item. Defaults to a labelled card. */
  renderItem?: (item: SnapGuidesItem, dragging: boolean) => ReactNode
  /** Merged last, so it wins. */
  className?: string
}

type Box = Pick<SnapGuidesItem, 'x' | 'y' | 'width' | 'height'>
const KEYS = { x: ['x', 'width', 'y', 'height'], y: ['y', 'height', 'x', 'width'] } as const

/**
 * Snaps one box against its siblings on one axis and reports what lined up.
 * Edge and centre alignment, the container's edges and centre, and equal
 * spacing — the moving box repeating a gap that already exists in its row, or
 * sitting exactly halfway between its two neighbours — all compete, and the
 * nearest within the threshold wins.
 */
export function snapAxis(moving: Box, others: Box[], axis: 'x' | 'y', size: number, threshold: number, container = true) {
  const [p, s, q, t] = KEYS[axis]
  const lines = (box: Box) => [box[p], box[p] + box[s] / 2, box[p] + box[s]]
  const targets = others.flatMap(lines)
  if (container) targets.push(0, size / 2, size)
  const row = others.filter((box) => box[q] < moving[q] + moving[t] && moving[q] < box[q] + box[t]).sort((a, b) => a[p] - b[p])
  const gaps: number[] = []
  for (let i = 1; i < row.length; i += 1) {
    const gap = row[i][p] - (row[i - 1][p] + row[i - 1][s])
    if (gap > 0) gaps.push(gap)
  }
  const middle = moving[p] + moving[s] / 2
  const before = row.filter((box) => box[p] + box[s] <= middle).sort((a, b) => b[p] + b[s] - (a[p] + a[s]))[0]
  const after = row.filter((box) => box[p] >= middle).sort((a, b) => a[p] - b[p])[0]
  const candidates: number[] = []
  for (const line of lines(moving)) for (const target of targets) candidates.push(target - line)
  for (const gap of gaps) {
    if (before) candidates.push(before[p] + before[s] + gap - moving[p])
    if (after) candidates.push(after[p] - gap - moving[s] - moving[p])
  }
  if (before && after) candidates.push((before[p] + before[s] + after[p] - moving[s]) / 2 - moving[p])
  let offset = 0
  let best = threshold + 1e-9
  for (const candidate of candidates)
    if (Math.abs(candidate) < best) {
      best = Math.abs(candidate)
      offset = candidate
    }
  const snapped = { ...moving, [p]: moving[p] + offset } as Box

  const marks: SnapGuidesMark[] = []
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5
  for (const box of [...others, ...(container ? [{ [p]: 0, [s]: size, [q]: -1e6, [t]: 2e6 } as unknown as Box] : [])]) {
    for (const line of lines(snapped)) {
      const hit = lines(box).find((other) => near(other, line))
      if (hit === undefined || marks.some((mark) => mark.kind === 'align' && near(mark.from, hit))) continue
      const isContainer = box[t] === 2e6
      const lo = isContainer ? 0 : Math.min(box[q], snapped[q])
      const hi = isContainer ? Number.POSITIVE_INFINITY : Math.max(box[q] + box[t], snapped[q] + snapped[t])
      marks.push({ kind: 'align', axis, from: hit, to: hit, at: lo, atEnd: hi })
    }
  }
  const across = snapped[q] + snapped[t] / 2
  const left = before ? snapped[p] - (before[p] + before[s]) : null
  const right = after ? after[p] - (snapped[p] + snapped[s]) : null
  const equal = [left, right].filter((gap): gap is number => gap !== null && gap > 0).find((gap) => gaps.some((other) => near(other, gap)) || (left !== null && right !== null && near(left, right)))
  if (before && left !== null && left > 0) marks.push({ kind: equal !== undefined && near(left, equal) ? 'equal' : 'distance', axis, from: before[p] + before[s], to: snapped[p], at: across })
  if (after && right !== null && right > 0) marks.push({ kind: equal !== undefined && near(right, equal) ? 'equal' : 'distance', axis, from: snapped[p] + snapped[s], to: after[p], at: across })
  if (equal !== undefined)
    for (let i = 1; i < row.length; i += 1) {
      const [a, b] = [row[i - 1], row[i]]
      if (near(b[p] - (a[p] + a[s]), equal))
        marks.push({ kind: 'equal', axis, from: a[p] + a[s], to: b[p], at: (Math.max(a[q], b[q]) + Math.min(a[q] + a[t], b[q] + b[t])) / 2 })
    }
  return { value: snapped[p], marks }
}

/**
 * A canvas of boxes that line up while you drag them, the way design tools do:
 * red guides for shared edges and centres, measured gaps to the nearest
 * neighbours, and equal-spacing marks when a gap repeats one already in the row.
 *
 * Pixel-nudging things into alignment is slow and never quite right, and a
 * grid forces every layout onto the same pitch. Snapping to what is already on
 * the canvas gets alignment for free and keeps the layout's own rhythm. Hold
 * Alt to place freely. Each box is a button: arrows move it by 1px, Shift by
 * 10, and the guides show what it lines up with at its new position.
 */
export function SnapGuides({
  items: itemsProp,
  defaultItems = [],
  onItemsChange,
  label,
  width = 640,
  height = 380,
  threshold = 6,
  snapToContainer = true,
  renderItem,
  className,
}: SnapGuidesProps) {
  const hintId = useId()
  const [state, setState] = useState(defaultItems)
  const items = itemsProp ?? state
  const [marks, setMarks] = useState<SnapGuidesMark[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const drag = useRef<{ id: string; x: number; y: number; px: number; py: number } | null>(null)

  const place = (id: string, x: number, y: number, snap: boolean) => {
    const item = items.find((entry) => entry.id === id)!
    const others = items.filter((entry) => entry.id !== id)
    const clamped = { ...item, x: Math.min(width - item.width, Math.max(0, x)), y: Math.min(height - item.height, Math.max(0, y)) }
    const limit = snap ? threshold : 0
    const sx = snapAxis(clamped, others, 'x', width, limit, snapToContainer)
    const sy = snapAxis({ ...clamped, x: sx.value }, others, 'y', height, limit, snapToContainer)
    const next = { ...clamped, x: sx.value, y: sy.value }
    const again = snapAxis(next, others, 'x', width, 0, snapToContainer)
    setMarks([...again.marks, ...sy.marks])
    const all = items.map((entry) => (entry.id === id ? next : entry))
    if (itemsProp === undefined) setState(all)
    onItemsChange?.(all)
    return next
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, item: SnapGuidesItem) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { id: item.id, x: item.x, y: item.y, px: event.clientX, py: event.clientY }
    setDragging(item.id)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current) return
    place(current.id, current.x + event.clientX - current.px, current.y + event.clientY - current.py, !event.altKey)
  }
  const onPointerUp = () => {
    const current = drag.current
    drag.current = null
    setDragging(null)
    setMarks([])
    const item = current && items.find((entry) => entry.id === current.id)
    if (item) setMessage(`${item.label} at ${Math.round(item.x)}, ${Math.round(item.y)}.`)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, item: SnapGuidesItem) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const move = moves[event.key]
    if (!move) {
      if (event.key === 'Escape') setMarks([])
      return
    }
    event.preventDefault()
    const step = event.shiftKey ? 10 : 1
    const next = place(item.id, item.x + move[0] * step, item.y + move[1] * step, false)
    setMessage(`${item.label} at ${Math.round(next.x)}, ${Math.round(next.y)}.`)
  }

  const labelFor = (mark: SnapGuidesMark) => `${Math.round(Math.abs(mark.to - mark.from))}`

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div
        role="group"
        aria-label={label}
        aria-describedby={hintId}
        className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface bg-[radial-gradient(var(--color-line-strong)_1px,transparent_1px)] [background-size:16px_16px]"
        style={{ width, height }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={`${item.label}, ${Math.round(item.x)}, ${Math.round(item.y)}`}
            aria-describedby={hintId}
            onPointerDown={(event) => onPointerDown(event, item)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(event) => onKeyDown(event, item)}
            onBlur={() => !drag.current && setMarks([])}
            className={cn(
              'absolute touch-none select-none text-left',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              dragging === item.id ? 'z-10 cursor-grabbing' : 'cursor-grab',
            )}
            style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
          >
            {renderItem ? (
              renderItem(item, dragging === item.id)
            ) : (
              <span
                className={cn(
                  'flex size-full items-center justify-center rounded-[var(--radius-10)] border text-[12px] font-semibold',
                  dragging === item.id ? 'border-accent-strong bg-accent text-accent-ink shadow-[var(--shadow-float)]' : 'border-line-strong bg-surface-muted text-ink',
                )}
              >
                {item.label}
              </span>
            )}
          </button>
        ))}
        <svg aria-hidden="true" width={width} height={height} className="pointer-events-none absolute inset-0 z-20 overflow-visible">
          {marks.map((mark, index) => {
            const horizontal = mark.axis === 'x'
            if (mark.kind === 'align') {
              const lo = Math.max(0, mark.at)
              const hi = Math.min(horizontal ? height : width, mark.atEnd ?? 0)
              return horizontal ? (
                <line key={index} x1={mark.from} x2={mark.from} y1={lo} y2={hi} strokeWidth={1} className="stroke-danger" />
              ) : (
                <line key={index} y1={mark.from} y2={mark.from} x1={lo} x2={hi} strokeWidth={1} className="stroke-danger" />
              )
            }
            const mid = (mark.from + mark.to) / 2
            const [x1, y1, x2, y2] = horizontal ? [mark.from, mark.at, mark.to, mark.at] : [mark.at, mark.from, mark.at, mark.to]
            const [lx, ly] = horizontal ? [mid, mark.at - 9] : [mark.at + 14, mid + 3]
            const equal = mark.kind === 'equal'
            return (
              <g key={index}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1} strokeDasharray={equal ? undefined : '3 2'} className={equal ? 'stroke-danger' : 'stroke-ink-soft'} />
                <rect x={lx - 13} y={ly - 9} width={26} height={13} rx="3" className={equal ? 'fill-danger' : 'fill-ink'} />
                <text x={lx} y={ly} textAnchor="middle" className="fill-ink-inverse text-[9px] font-bold">
                  {labelFor(mark)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p id={hintId} className="mt-2 text-[11px] font-medium text-ink-faint">
        Drag to move; guides snap within {threshold}px. Hold Alt to place freely. Arrow keys nudge by 1px, Shift by 10.
      </p>
      <PlotAnnouncer message={message} />
    </div>
  )
}
