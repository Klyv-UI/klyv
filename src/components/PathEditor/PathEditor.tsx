'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { CopyButton } from '../CopyButton'
import { SegmentedControl } from '../SegmentedControl'
import {
  pathEditorControls,
  pathEditorNearest,
  pathEditorParse,
  pathEditorSerialize,
  pathEditorSplit,
  type PathEditorContour,
  type PathEditorPoint,
  type PathEditorVector,
} from './path'

export type PathEditorTool = 'pen' | 'select'

export interface PathEditorProps {
  /** Path data, controlled. Anything the parser understands; it is shown back normalised. */
  value?: string
  /** Path data to start from, uncontrolled. */
  defaultValue?: string
  /** Called with normalised, absolute path data after every edit. */
  onValueChange?: (d: string) => void
  /** Width of the drawing in its own units — the viewBox width. */
  width?: number
  /** Height of the drawing in its own units. */
  height?: number
  /** Tool selected at first. */
  defaultTool?: PathEditorTool
  /** Accessible name for the drawing. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

type Drag =
  | { kind: 'anchor'; c: number; i: number; dx: number; dy: number }
  | { kind: 'handle'; c: number; i: number; side: 'in' | 'out'; breaks: boolean }
  | { kind: 'new'; c: number; i: number; origin: PathEditorVector }

const clone = (contours: PathEditorContour[]) =>
  contours.map((contour) => ({ closed: contour.closed, points: contour.points.map((point) => ({ ...point })) }))
const safeParse = (d: string) => {
  try {
    return { contours: pathEditorParse(d), error: '' }
  } catch (error) {
    return { contours: [] as PathEditorContour[], error: (error as Error).message }
  }
}
const round = (value: number) => Math.round(value * 100) / 100
const mirror = (anchor: PathEditorVector, handle: PathEditorVector, length?: number) => {
  const dx = anchor.x - handle.x
  const dy = anchor.y - handle.y
  const scale = length === undefined ? 1 : length / (Math.hypot(dx, dy) || 1)
  return { x: anchor.x + dx * scale, y: anchor.y + dy * scale }
}

/**
 * A pen tool for SVG paths — the one from every vector editor, working on real path data.
 *
 * Click places a corner anchor; press and drag places a smooth one, pulling out
 * two mirrored handles. Clicking a segment inserts an anchor by splitting the
 * curve with de Casteljau’s construction, so the shape does not move when a
 * point is added. Dragging a smooth anchor’s handle swings the other one with
 * it; hold Alt to break them apart. Double-click converts corner and smooth.
 *
 * Every anchor is a focusable button: arrows nudge it (Shift for ten), S
 * converts it, Delete removes it. Incoming data may use relative commands,
 * H/V and quadratics; what comes out is always absolute M/L/C/Z, so two paths
 * that look the same serialise the same.
 */
export function PathEditor({
  value,
  defaultValue = '',
  onValueChange,
  width = 480,
  height = 320,
  defaultTool = 'pen',
  label = 'Path editor',
  className,
}: PathEditorProps) {
  const initial = useRef(safeParse(value ?? defaultValue))
  const [contours, setContours] = useState<PathEditorContour[]>(initial.current.contours)
  const [error, setError] = useState(initial.current.error)
  const [tool, setTool] = useState<PathEditorTool>(defaultTool)
  const [selected, setSelected] = useState<{ c: number; i: number } | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const emitted = useRef(pathEditorSerialize(initial.current.contours))
  const focusNext = useRef<string | null>(null)
  const live = useRef(contours)
  live.current = contours
  const helpId = useId()
  const gridId = `grid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // Controlled: re-read the data only when it is not the echo of our own last edit.
  useEffect(() => {
    if (value === undefined || value === emitted.current) return
    const parsed = safeParse(value)
    setError(parsed.error)
    if (parsed.error) return
    setContours(parsed.contours)
    setSelected(null)
    setActive(null)
    emitted.current = pathEditorSerialize(parsed.contours)
  }, [value])

  useEffect(() => {
    if (!focusNext.current) return
    svgRef.current?.querySelector<SVGElement>(`[data-anchor="${focusNext.current}"]`)?.focus()
    focusNext.current = null
  })

  const commit = (next: PathEditorContour[]) => {
    live.current = next
    setContours(next)
    const d = pathEditorSerialize(next)
    emitted.current = d
    onValueChange?.(d)
  }

  const toLocal = (event: { clientX: number; clientY: number }): PathEditorVector => {
    const svg = svgRef.current!
    const matrix = svg.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: round(Math.min(width, Math.max(0, point.x))), y: round(Math.min(height, Math.max(0, point.y))) }
  }

  const moveAnchor = (point: PathEditorPoint, to: PathEditorVector) => {
    const dx = to.x - point.x
    const dy = to.y - point.y
    point.x = to.x
    point.y = to.y
    if (point.in) point.in = { x: point.in.x + dx, y: point.in.y + dy }
    if (point.out) point.out = { x: point.out.x + dx, y: point.out.y + dy }
  }

  const convert = (c: number, i: number) => {
    const next = clone(live.current)
    const { points, closed } = next[c]
    const point = points[i]
    if (point.smooth) {
      point.in = point.out = null
      point.smooth = false
    } else {
      // Handles along the line from the previous anchor to the next, a third of the way to each.
      const prev = points[i - 1] ?? (closed ? points[points.length - 1] : point)
      const after = points[i + 1] ?? (closed ? points[0] : point)
      const dx = after.x - prev.x
      const dy = after.y - prev.y
      const length = Math.hypot(dx, dy) || 1
      const back = Math.hypot(point.x - prev.x, point.y - prev.y) / 3 || 30
      const ahead = Math.hypot(after.x - point.x, after.y - point.y) / 3 || 30
      point.in = { x: round(point.x - (dx / length) * back), y: round(point.y - (dy / length) * back) }
      point.out = { x: round(point.x + (dx / length) * ahead), y: round(point.y + (dy / length) * ahead) }
      point.smooth = true
    }
    commit(next)
    setMessage(`Anchor ${i + 1} is now ${point.smooth ? 'smooth' : 'a corner'}.`)
  }

  const remove = (c: number, i: number) => {
    const next = clone(live.current)
    next[c].points.splice(i, 1)
    if (next[c].points.length < 3) next[c].closed = false
    if (next[c].points.length === 0) {
      next.splice(c, 1)
      setSelected(null)
      setActive(null)
    } else {
      const to = Math.min(i, next[c].points.length - 1)
      setSelected({ c, i: to })
      focusNext.current = `${c}-${to}`
    }
    commit(next)
    setMessage(`Anchor ${i + 1} deleted.`)
  }

  const closePath = (c: number) => {
    const next = clone(live.current)
    next[c].closed = true
    commit(next)
    setActive(null)
    setMessage('Path closed.')
  }

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const target = event.target as SVGElement
    const kind = target.dataset.kind
    const c = Number(target.dataset.c)
    const i = Number(target.dataset.i)
    const at = toLocal(event)
    const next = clone(live.current)
    event.currentTarget.setPointerCapture(event.pointerId)

    if (kind === 'anchor') {
      if (tool === 'pen' && active === c && i === 0 && !next[c].closed && next[c].points.length > 1) {
        closePath(c)
        return
      }
      const point = next[c].points[i]
      setSelected({ c, i })
      drag.current = { kind: 'anchor', c, i, dx: point.x - at.x, dy: point.y - at.y }
      return
    }
    if (kind === 'handle') {
      drag.current = { kind: 'handle', c, i, side: target.dataset.side as 'in' | 'out', breaks: event.altKey }
      return
    }
    if (kind === 'segment') {
      const points = next[c].points
      const to = (i + 1) % points.length
      const split = pathEditorSplit(points[i], points[to], pathEditorNearest(pathEditorControls(points[i], points[to]), at))
      if (split.fromOut) points[i].out = split.fromOut
      if (split.toIn) points[to].in = split.toIn
      points.splice(i + 1, 0, split.point)
      commit(next)
      setSelected({ c, i: i + 1 })
      drag.current = { kind: 'anchor', c, i: i + 1, dx: split.point.x - at.x, dy: split.point.y - at.y }
      setMessage(`Anchor inserted on segment ${i + 1}.`)
      return
    }
    if (tool === 'select') {
      setSelected(null)
      return
    }
    // Pen on empty canvas: continue the active open contour, or start a new one.
    let target_c = active !== null && next[active] && !next[active].closed ? active : -1
    if (target_c === -1) {
      next.push({ points: [], closed: false })
      target_c = next.length - 1
    }
    next[target_c].points.push({ ...at, in: null, out: null, smooth: false })
    const index = next[target_c].points.length - 1
    commit(next)
    setActive(target_c)
    setSelected({ c: target_c, i: index })
    drag.current = { kind: 'new', c: target_c, i: index, origin: at }
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const state = drag.current
    if (!state) return
    const at = toLocal(event)
    const next = clone(live.current)
    const point = next[state.c]?.points[state.i]
    if (!point) return
    if (state.kind === 'anchor') {
      moveAnchor(point, { x: round(at.x + state.dx), y: round(at.y + state.dy) })
    } else if (state.kind === 'new') {
      if (Math.hypot(at.x - state.origin.x, at.y - state.origin.y) < 3) return
      point.out = at
      point.in = mirror(point, at)
      point.smooth = true
    } else {
      point[state.side] = at
      const other = state.side === 'in' ? 'out' : 'in'
      if (state.breaks || event.altKey) point.smooth = false
      else if (point.smooth && point[other]) {
        const current = point[other]!
        point[other] = mirror(point, at, Math.hypot(current.x - point.x, current.y - point.y))
      }
    }
    commit(next)
  }

  const onAnchorKey = (event: KeyboardEvent<SVGElement>, c: number, i: number) => {
    const step = event.shiftKey ? 10 : 1
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (moves[event.key]) {
      event.preventDefault()
      const next = clone(live.current)
      const point = next[c].points[i]
      const [dx, dy] = moves[event.key]
      moveAnchor(point, { x: Math.min(width, Math.max(0, point.x + dx)), y: Math.min(height, Math.max(0, point.y + dy)) })
      commit(next)
      setSelected({ c, i })
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      remove(c, i)
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault()
      convert(c, i)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelected({ c, i })
    } else if (event.key === 'Escape') {
      setSelected(null)
      setActive(null)
    }
  }

  const d = pathEditorSerialize(contours)
  const point = selected ? contours[selected.c]?.points[selected.i] : undefined
  const openActive = active !== null && contours[active] && !contours[active].closed && contours[active].points.length > 2
  const handleClass = 'cursor-grab fill-surface stroke-accent-strong'

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Tool"
          size="sm"
          value={tool}
          onValueChange={(next) => {
            setTool(next)
            setActive(null)
          }}
          options={[
            { value: 'pen', label: 'Pen' },
            { value: 'select', label: 'Select' },
          ]}
        />
        <Button size="sm" variant="outline" disabled={!selected} onClick={() => selected && convert(selected.c, selected.i)}>
          {point?.smooth ? 'Make corner' : 'Make smooth'}
        </Button>
        <Button size="sm" variant="outline" disabled={!selected} onClick={() => selected && remove(selected.c, selected.i)}>
          Delete point
        </Button>
        <Button size="sm" variant="outline" disabled={!openActive} onClick={() => active !== null && closePath(active)}>
          Close path
        </Button>
        <Button size="sm" variant="ghost" disabled={contours.length === 0} onClick={() => (commit([]), setSelected(null), setActive(null))}>
          Clear
        </Button>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={label}
          aria-describedby={helpId}
          className={cn('block h-auto w-full touch-none select-none', tool === 'pen' ? 'cursor-crosshair' : 'cursor-default')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <defs>
            <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" className="stroke-line" strokeWidth="0.75" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill={`url(#${gridId})`} />
          <path d={d} fillRule="evenodd" className="pointer-events-none fill-[color-mix(in_oklab,var(--color-accent)_22%,transparent)] stroke-ink" strokeWidth="2" strokeLinejoin="round" />
          {contours.map((contour, c) =>
            contour.points.map((from, i) => {
              const to = contour.points[i + 1] ?? (contour.closed ? contour.points[0] : null)
              if (!to || contour.points.length < 2) return null
              const [p0, p1, p2, p3] = pathEditorControls(from, to)
              return (
                <path
                  key={`s${c}-${i}`}
                  d={`M${p0.x} ${p0.y}C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`}
                  data-kind="segment"
                  data-c={c}
                  data-i={i}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="12"
                  className="cursor-copy"
                />
              )
            }),
          )}
          {selected && point && (
            <g>
              {(['in', 'out'] as const).map((side) => {
                const handle = point[side]
                if (!handle) return null
                return (
                  <g key={side}>
                    <line x1={point.x} y1={point.y} x2={handle.x} y2={handle.y} className="pointer-events-none stroke-accent-strong" strokeWidth="1.25" />
                    <circle cx={handle.x} cy={handle.y} r="5" data-kind="handle" data-c={selected.c} data-i={selected.i} data-side={side} className={handleClass} strokeWidth="1.5" />
                  </g>
                )
              })}
            </g>
          )}
          {contours.map((contour, c) =>
            contour.points.map((anchor, i) => {
              const isSelected = selected?.c === c && selected.i === i
              const closer = tool === 'pen' && active === c && i === 0 && !contour.closed && contour.points.length > 1
              return (
                <rect
                  key={`a${c}-${i}`}
                  data-kind="anchor"
                  data-anchor={`${c}-${i}`}
                  data-c={c}
                  data-i={i}
                  x={anchor.x - 5}
                  y={anchor.y - 5}
                  width="10"
                  height="10"
                  rx={anchor.smooth ? 5 : 1}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Anchor ${i + 1}${contours.length > 1 ? ` of shape ${c + 1}` : ''}, ${anchor.smooth ? 'smooth' : 'corner'}, at ${round(anchor.x)}, ${round(anchor.y)}${closer ? '. Click to close the path' : ''}`}
                  onKeyDown={(event) => onAnchorKey(event, c, i)}
                  onFocus={() => setSelected({ c, i })}
                  onDoubleClick={() => convert(c, i)}
                  className={cn(
                    'cursor-move outline-none focus-visible:stroke-focus focus-visible:[stroke-width:3]',
                    isSelected ? 'fill-accent stroke-ink' : 'fill-surface stroke-ink',
                    closer && 'stroke-accent-strong [stroke-width:3]',
                  )}
                  strokeWidth="1.5"
                />
              )
            }),
          )}
        </svg>
      </div>

      <p id={helpId} className="m-0 text-[12px] font-medium text-ink-faint">
        {tool === 'pen'
          ? 'Click to add a corner, drag to add a smooth point, click the first point to close. Click a segment to insert a point.'
          : 'Drag anchors and handles; Alt-drag a handle to break it. Double-click an anchor to convert it.'}{' '}
        Focused anchors: arrows nudge, S converts, Delete removes.
      </p>

      {error ? (
        <p role="alert" className="m-0 text-[12px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-start gap-2 rounded-[var(--radius-glyph)] bg-surface-sunken p-3">
        <code className="min-w-0 flex-1 break-all font-mono text-[12px] font-semibold text-ink">{d || 'Empty path'}</code>
        <CopyButton value={d} label="Copy path data" copiedLabel="Path data copied" iconOnly className="shrink-0" />
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
