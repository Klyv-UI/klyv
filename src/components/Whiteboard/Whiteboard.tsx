'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { useAnnounce } from '../LiveRegion'
import { Menu } from '../Menu'
import { VisuallyHidden } from '../VisuallyHidden'

export type WhiteboardTool = 'select' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'pen'
export type WhiteboardShapeKind = Exclude<WhiteboardTool, 'select'>
export type WhiteboardExportFormat = 'json' | 'svg'

export interface WhiteboardShape {
  id: string
  kind: WhiteboardShapeKind
  /** Top-left of the box; for an arrow, the tail. */
  x: number
  y: number
  /** Box size; for an arrow, the signed offset from tail to head. */
  width: number
  height: number
  /** Pen strokes, as points relative to the box from 0 to 1, so moving and resizing never touch them. */
  points?: [number, number][]
  /** Text shapes. */
  text?: string
}

export interface WhiteboardProps {
  /** Controlled shapes, bottom to top. */
  value?: WhiteboardShape[]
  /** Initial shapes, uncontrolled. */
  defaultValue?: WhiteboardShape[]
  /** Called with every change, including each step of a drag. Undo history is kept inside. */
  onValueChange?: (value: WhiteboardShape[]) => void
  /** Accessible name for the drawing surface. */
  label: string
  /** The tool selected at first. */
  defaultTool?: WhiteboardTool
  /** Receives an export. Without it, the export is downloaded as a file. */
  onExport?: (format: WhiteboardExportFormat, content: string) => void
  /** Merged last, so it wins. Give the component a height here. */
  className?: string
}

type WhiteboardHandle = 'nw' | 'ne' | 'sw' | 'se' | 'tail' | 'head'

type WhiteboardGesture =
  | { type: 'create'; id: string; x: number; y: number; before: WhiteboardShape[] }
  | { type: 'pen'; points: [number, number][]; before: WhiteboardShape[] }
  | { type: 'move'; x: number; y: number; originals: WhiteboardShape[]; before: WhiteboardShape[] }
  | { type: 'resize'; handle: WhiteboardHandle; original: WhiteboardShape; before: WhiteboardShape[] }
  | { type: 'marquee'; x: number; y: number; base: string[] }

const icon = (path: ReactNode): IconComponent =>
  function WhiteboardGlyph({ size = 16, className }) {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {path}
      </svg>
    )
  }

const TOOLS: { tool: WhiteboardTool; label: string; key: string; icon: IconComponent }[] = [
  { tool: 'select', label: 'Select', key: 'v', icon: icon(<path d="M3.5 2.5l9 5-4 1-1.5 4z" />) },
  { tool: 'rect', label: 'Rectangle', key: 'r', icon: icon(<rect x="2.5" y="3.5" width="11" height="9" rx="1" />) },
  { tool: 'ellipse', label: 'Ellipse', key: 'o', icon: icon(<ellipse cx="8" cy="8" rx="5.5" ry="4.5" />) },
  { tool: 'arrow', label: 'Arrow', key: 'a', icon: icon(<path d="M3 13L13 3M7 3h6v6" />) },
  { tool: 'text', label: 'Text', key: 't', icon: icon(<path d="M3.5 4V3h9v1M8 3v10M6 13h4" />) },
  { tool: 'pen', label: 'Pen', key: 'p', icon: icon(<path d="M2.5 12c2-4 3.5-6 5-6s.5 5 2.5 5 2.5-5 3.5-7" />) },
]

const Undo = icon(<path d="M5.5 3.5L2.5 6.5l3 3M2.5 6.5H10a3.5 3.5 0 0 1 0 7H7" />)
const Redo = icon(<path d="M10.5 3.5l3 3-3 3M13.5 6.5H6a3.5 3.5 0 0 0 0 7h3" />)
const Trash = icon(<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />)

let counter = 0
const newId = () => `shape-${Date.now().toString(36)}-${(counter += 1)}`

const normalise = (shape: WhiteboardShape): WhiteboardShape =>
  shape.kind === 'arrow'
    ? shape
    : {
        ...shape,
        x: Math.min(shape.x, shape.x + shape.width),
        y: Math.min(shape.y, shape.y + shape.height),
        width: Math.abs(shape.width),
        height: Math.abs(shape.height),
      }

/** Axis-aligned bounds, for arrows as well as boxes. */
function bounds(shape: WhiteboardShape) {
  const box = normalise({ ...shape, kind: 'rect' })
  return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height }
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

const penPoints = (shape: WhiteboardShape) =>
  (shape.points ?? []).map(([u, v]) => [shape.x + u * shape.width, shape.y + v * shape.height] as [number, number])

/** Whether a point touches a shape — against its geometry, not its bounding box, so an arrow is not a rectangle. */
function hits(shape: WhiteboardShape, px: number, py: number, tolerance = 6) {
  const { left, top, right, bottom } = bounds(shape)
  switch (shape.kind) {
    case 'rect':
    case 'text':
      return px >= left - tolerance && px <= right + tolerance && py >= top - tolerance && py <= bottom + tolerance
    case 'ellipse': {
      const rx = (right - left) / 2 + tolerance
      const ry = (bottom - top) / 2 + tolerance
      return ((px - (left + right) / 2) / rx) ** 2 + ((py - (top + bottom) / 2) / ry) ** 2 <= 1
    }
    case 'arrow':
      return distanceToSegment(px, py, shape.x, shape.y, shape.x + shape.width, shape.y + shape.height) <= tolerance + 2
    case 'pen': {
      const points = penPoints(shape)
      return points.some((point, index) => index > 0 && distanceToSegment(px, py, ...points[index - 1]!, ...point) <= tolerance)
    }
  }
}

const pathOf = (points: [number, number][]) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

function arrowHead(shape: WhiteboardShape) {
  const angle = Math.atan2(shape.height, shape.width)
  const tipX = shape.x + shape.width
  const tipY = shape.y + shape.height
  const wing = (offset: number) => `${(tipX - 12 * Math.cos(angle + offset)).toFixed(1)} ${(tipY - 12 * Math.sin(angle + offset)).toFixed(1)}`
  return `M${wing(0.45)} L${tipX.toFixed(1)} ${tipY.toFixed(1)} L${wing(-0.45)}`
}

const escapeXml = (text: string) => text.replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]!)

/** The geometry every renderer shares, so the canvas and the exported file cannot disagree. */
function geometry(shape: WhiteboardShape) {
  const box = normalise(shape)
  return {
    box,
    arrow: `M${shape.x} ${shape.y} L${shape.x + shape.width} ${shape.y + shape.height} ${arrowHead(shape)}`,
    pen: pathOf(penPoints(shape)),
  }
}

/** One shape as standalone SVG markup, for export. */
function shapeMarkup(shape: WhiteboardShape, stroke: string, fill: string) {
  const common = `stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
  const { box, arrow, pen } = geometry(shape)
  switch (shape.kind) {
    case 'rect':
      return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="6" fill="${fill}" fill-opacity="0.18" ${common}/>`
    case 'ellipse':
      return `<ellipse cx="${box.x + box.width / 2}" cy="${box.y + box.height / 2}" rx="${box.width / 2}" ry="${box.height / 2}" fill="${fill}" fill-opacity="0.18" ${common}/>`
    case 'arrow':
      return `<path d="${arrow}" fill="none" ${common}/>`
    case 'pen':
      return `<path d="${pen}" fill="none" ${common}/>`
    case 'text':
      return `<text x="${shape.x + 4}" y="${shape.y + shape.height / 2}" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="${stroke}">${escapeXml(shape.text ?? '')}</text>`
  }
}

/** The same shape as live SVG, drawn in the current theme. */
function ShapeView({ shape, hidden }: { shape: WhiteboardShape; hidden: boolean }) {
  const { box, arrow, pen } = geometry(shape)
  const stroke = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const fill = 'color-mix(in oklab, var(--color-accent) 18%, transparent)'
  const style = hidden ? { opacity: 0 } : undefined
  switch (shape.kind) {
    case 'rect':
      return <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={6} fill={fill} style={style} {...stroke} />
    case 'ellipse':
      return <ellipse cx={box.x + box.width / 2} cy={box.y + box.height / 2} rx={box.width / 2} ry={box.height / 2} fill={fill} style={style} {...stroke} />
    case 'arrow':
      return <path d={arrow} fill="none" style={style} {...stroke} />
    case 'pen':
      return <path d={pen} fill="none" style={style} {...stroke} />
    case 'text':
      return (
        <text x={shape.x + 4} y={shape.y + shape.height / 2} dominantBaseline="central" fill="currentColor" style={style} className="text-[16px] font-semibold">
          {shape.text}
        </text>
      )
  }
}

function toSvg(shapes: WhiteboardShape[], stroke: string, fill: string) {
  const all = shapes.map(bounds)
  const left = Math.min(0, ...all.map((box) => box.left)) - 16
  const top = Math.min(0, ...all.map((box) => box.top)) - 16
  const right = Math.max(1, ...all.map((box) => box.right)) + 16
  const bottom = Math.max(1, ...all.map((box) => box.bottom)) + 16
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${right - left} ${bottom - top}" width="${right - left}" height="${bottom - top}">`,
    ...shapes.map((shape) => shapeMarkup(shape, stroke, fill)),
    '</svg>',
  ].join('\n')
}

/**
 * A small whiteboard: rectangles, ellipses, arrows, text and a freehand pen, with selection, resizing and undo.
 *
 * Everything is a plain shape record — a box, plus points for the pen and text for labels — so the value can be
 * stored, diffed and sent over a wire as JSON. Pen points are kept relative to their box, which makes moving and
 * resizing one operation for every kind of shape. Hit-testing is done against the model rather than the DOM: an
 * ellipse is hit inside the ellipse, an arrow near its line and a stroke near its path, with a few pixels of
 * tolerance, so clicking the empty corner of an ellipse’s box selects what is behind it.
 *
 * Undo records one entry per finished gesture, not per pointer event, so a long drag undoes in one step. The canvas
 * takes the keyboard when focused: tool letters, Delete, arrow keys to nudge (Shift for ten pixels), brackets to step
 * through shapes, Enter to place a shape or edit text, and the usual undo, redo, select-all and duplicate shortcuts.
 * Export writes JSON or a standalone SVG with the theme’s colours resolved, because a file cannot read CSS variables.
 */
export function Whiteboard({ value, defaultValue = [], onValueChange, label, defaultTool = 'select', onExport, className }: WhiteboardProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const shapes = value ?? uncontrolled
  const [tool, setTool] = useState<WhiteboardTool>(defaultTool)
  const [selected, setSelected] = useState<string[]>([])
  const [history, setHistory] = useState<{ past: WhiteboardShape[][]; future: WhiteboardShape[][] }>({ past: [], future: [] })
  const [draft, setDraft] = useState<{ pen?: [number, number][]; marquee?: { x: number; y: number; width: number; height: number } }>({})
  const [editing, setEditing] = useState<{ id: string; text: string; before?: WhiteboardShape[] } | null>(null)
  const editingRef = useRef(editing)
  editingRef.current = editing
  const surfaceRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<WhiteboardGesture | null>(null)
  const helpId = useId()
  const announce = useAnnounce()

  // Pointer events can arrive faster than React re-renders; gestures read the newest shapes from here.
  const latest = useRef(shapes)
  latest.current = shapes
  const setShapes = (next: WhiteboardShape[]) => {
    latest.current = next
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }
  /** Change the shapes and record one undo step: `before` is what undo returns to. */
  const record = (next: WhiteboardShape[], before = shapes) => {
    setHistory(({ past }) => ({ past: [...past.slice(-99), before], future: [] }))
    setShapes(next)
  }

  const undo = () => {
    const previous = history.past[history.past.length - 1]
    if (!previous) return
    setHistory(({ past, future }) => ({ past: past.slice(0, -1), future: [shapes, ...future] }))
    setShapes(previous)
    setSelected((ids) => ids.filter((id) => previous.some((shape) => shape.id === id)))
    announce('Undone')
  }
  const redo = () => {
    const next = history.future[0]
    if (!next) return
    setHistory(({ past, future }) => ({ past: [...past, shapes], future: future.slice(1) }))
    setShapes(next)
    // Select what came back, so the redone thing is the thing the next key acts on.
    setSelected(next.filter((shape) => !shapes.includes(shape)).map((shape) => shape.id))
    announce('Redone')
  }
  const remove = () => {
    if (!selected.length) return
    record(shapes.filter((shape) => !selected.includes(shape.id)))
    announce(`Deleted ${selected.length} shape${selected.length === 1 ? '' : 's'}`)
    setSelected([])
  }

  const local = (event: { clientX: number; clientY: number }) => {
    const box = surfaceRef.current!.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const shapes = latest.current
    if (event.button !== 0 || editing) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const { x, y } = local(event)
    const handle = (event.target as Element).getAttribute('data-handle') as WhiteboardHandle | null

    if (tool === 'select') {
      if (handle && selected.length === 1) {
        const original = shapes.find((shape) => shape.id === selected[0])
        if (original) gesture.current = { type: 'resize', handle, original, before: shapes }
        return
      }
      const target = [...shapes].reverse().find((shape) => hits(shape, x, y))
      if (target) {
        let selection = selected
        if (event.shiftKey) selection = selected.includes(target.id) ? selected.filter((id) => id !== target.id) : [...selected, target.id]
        else if (!selected.includes(target.id)) selection = [target.id]
        setSelected(selection)
        gesture.current = { type: 'move', x, y, originals: shapes.filter((shape) => selection.includes(shape.id)), before: shapes }
      } else {
        const base = event.shiftKey ? selected : []
        setSelected(base)
        gesture.current = { type: 'marquee', x, y, base }
      }
      return
    }
    if (tool === 'pen') {
      gesture.current = { type: 'pen', points: [[x, y]], before: shapes }
      setDraft({ pen: [[x, y]] })
      return
    }
    if (tool === 'text') {
      const shape: WhiteboardShape = { id: newId(), kind: 'text', x, y: y - 14, width: 160, height: 28, text: '' }
      setShapes([...shapes, shape])
      gesture.current = null
      setSelected([shape.id])
      setEditing({ id: shape.id, text: '', before: shapes })
      return
    }
    const shape: WhiteboardShape = { id: newId(), kind: tool, x, y, width: 0, height: 0 }
    gesture.current = { type: 'create', id: shape.id, x, y, before: shapes }
    setShapes([...shapes, shape])
    setSelected([shape.id])
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!current) return
    const { x, y } = local(event)
    if (current.type === 'create') {
      setShapes(latest.current.map((shape) => (shape.id === current.id ? { ...shape, width: x - current.x, height: y - current.y } : shape)))
    } else if (current.type === 'pen') {
      current.points.push([x, y])
      setDraft({ pen: current.points.slice() })
    } else if (current.type === 'move') {
      const dx = x - current.x
      const dy = y - current.y
      setShapes(latest.current.map((shape) => {
        const original = current.originals.find((entry) => entry.id === shape.id)
        return original ? { ...shape, x: original.x + dx, y: original.y + dy } : shape
      }))
    } else if (current.type === 'resize') {
      const o = current.original
      let next: WhiteboardShape
      if (current.handle === 'tail') next = { ...o, x, y, width: o.x + o.width - x, height: o.y + o.height - y }
      else if (current.handle === 'head') next = { ...o, width: x - o.x, height: y - o.y }
      else {
        const left = current.handle.includes('w') ? x : o.x
        const right = current.handle.includes('e') ? x : o.x + o.width
        const top = current.handle.includes('n') ? y : o.y
        const bottom = current.handle.includes('s') ? y : o.y + o.height
        next = { ...o, x: left, y: top, width: right - left, height: bottom - top }
      }
      setShapes(latest.current.map((shape) => (shape.id === o.id ? next : shape)))
    } else {
      const box = { x: Math.min(x, current.x), y: Math.min(y, current.y), width: Math.abs(x - current.x), height: Math.abs(y - current.y) }
      setDraft({ marquee: box })
      const inside = latest.current
        .filter((shape) => {
          const b = bounds(shape)
          return b.left < box.x + box.width && b.right > box.x && b.top < box.y + box.height && b.bottom > box.y
        })
        .map((shape) => shape.id)
      setSelected([...new Set([...current.base, ...inside])])
    }
  }

  const onPointerUp = () => {
    const current = gesture.current
    gesture.current = null
    setDraft({})
    if (!current || current.type === 'marquee') return
    if (current.type === 'pen') {
      if (current.points.length < 2) return
      const xs = current.points.map((point) => point[0])
      const ys = current.points.map((point) => point[1])
      const left = Math.min(...xs)
      const top = Math.min(...ys)
      const width = Math.max(1, Math.max(...xs) - left)
      const height = Math.max(1, Math.max(...ys) - top)
      const shape: WhiteboardShape = {
        id: newId(),
        kind: 'pen',
        x: left,
        y: top,
        width,
        height,
        points: current.points.map(([px, py]) => [(px - left) / width, (py - top) / height]),
      }
      record([...latest.current, shape], current.before)
      setSelected([shape.id])
      return
    }
    if (current.type === 'create') {
      const created = latest.current.find((shape) => shape.id === current.id)
      // A click without a drag still makes something usable, rather than an invisible zero-size shape.
      const sized =
        created && Math.abs(created.width) < 4 && Math.abs(created.height) < 4
          ? { ...created, width: created.kind === 'arrow' ? 120 : 140, height: created.kind === 'arrow' ? 0 : 90 }
          : created
      if (sized) record(latest.current.map((shape) => (shape.id === sized.id ? normalise(sized) : shape)), current.before)
      setTool('select')
      return
    }
    if (latest.current === current.before) return
    const touched = current.type === 'move' ? current.originals.map((shape) => shape.id) : [current.original.id]
    record(latest.current.map((shape) => (touched.includes(shape.id) ? normalise(shape) : shape)), current.before)
  }

  const exportAs = (format: WhiteboardExportFormat) => {
    const probe = (token: string) => {
      const node = surfaceRef.current
      if (!node) return token
      node.style.color = `var(${token})`
      const resolved = getComputedStyle(node).color
      node.style.color = ''
      return resolved
    }
    const content = format === 'json' ? JSON.stringify(shapes, null, 2) : toSvg(shapes, probe('--color-ink'), probe('--color-accent'))
    if (onExport) return onExport(format, content)
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'image/svg+xml' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `whiteboard.${format}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const place = (kind: WhiteboardShapeKind) => {
    const box = surfaceRef.current?.getBoundingClientRect()
    const cx = (box?.width ?? 400) / 2
    const cy = (box?.height ?? 300) / 2
    const offset = (shapes.length % 6) * 12
    const shape: WhiteboardShape =
      kind === 'arrow'
        ? { id: newId(), kind, x: cx - 60 + offset, y: cy + offset, width: 120, height: 0 }
        : kind === 'pen'
          ? { id: newId(), kind, x: cx - 60 + offset, y: cy - 20 + offset, width: 120, height: 40, points: [[0, 1], [0.25, 0], [0.5, 1], [0.75, 0], [1, 1]] }
          : { id: newId(), kind, x: cx - 70 + offset, y: cy - 45 + offset, width: 140, height: kind === 'text' ? 28 : 90, text: kind === 'text' ? '' : undefined }
    if (kind === 'text') {
      setShapes([...shapes, shape])
      setEditing({ id: shape.id, text: '', before: shapes })
    } else record([...shapes, shape])
    setSelected([shape.id])
    setTool('select')
    announce(`Added ${TOOLS.find((entry) => entry.tool === kind)!.label.toLowerCase()}`)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    const nudge: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }
    if (mod && key === 'z') {
      if (event.shiftKey) redo()
      else undo()
    } else if (mod && key === 'y') redo()
    else if (mod && key === 'a') setSelected(shapes.map((shape) => shape.id))
    else if (mod && key === 'd' && selected.length) {
      const copies = shapes.filter((shape) => selected.includes(shape.id)).map((shape) => ({ ...shape, id: newId(), x: shape.x + 16, y: shape.y + 16 }))
      record([...shapes, ...copies])
      setSelected(copies.map((shape) => shape.id))
      announce(`Duplicated ${copies.length}`)
    } else if (key === 'delete' || key === 'backspace') remove()
    else if (key === 'escape') setSelected([])
    else if (nudge[key] && selected.length) {
      const [dx, dy] = nudge[key]!
      const step = event.shiftKey ? 10 : 1
      record(shapes.map((shape) => (selected.includes(shape.id) ? { ...shape, x: shape.x + dx * step, y: shape.y + dy * step } : shape)))
    } else if ((key === ']' || key === '[') && shapes.length) {
      const index = shapes.findIndex((shape) => shape.id === selected[selected.length - 1])
      const step = key === ']' ? 1 : -1
      const next = shapes[index < 0 ? (step > 0 ? 0 : shapes.length - 1) : (index + step + shapes.length) % shapes.length]!
      setSelected([next.id])
      announce(`${next.kind === 'text' ? `Text “${next.text}”` : TOOLS.find((entry) => entry.tool === next.kind)!.label} selected, ${shapes.indexOf(next) + 1} of ${shapes.length}`)
    } else if (key === 'enter') {
      if (tool !== 'select') place(tool)
      else {
        const only = shapes.find((shape) => shape.id === selected[0])
        if (only?.kind === 'text' && selected.length === 1) setEditing({ id: only.id, text: only.text ?? '' })
      }
    } else if (!mod && !event.altKey) {
      const match = TOOLS.find((entry) => entry.key === key)
      if (!match) return
      setTool(match.tool)
      announce(`${match.label} tool`)
    } else return
    event.preventDefault()
  }

  const finishEditing = (keep: boolean) => {
    // Enter moves focus back to the canvas, which blurs the field and would finish a second time.
    const current = editingRef.current
    if (!current) return
    editingRef.current = null
    const text = current.text.trim()
    const original = shapes.find((shape) => shape.id === current.id)
    setEditing(null)
    surfaceRef.current?.focus({ preventScroll: true })
    if (!original) return
    const without = shapes.filter((shape) => shape.id !== current.id)
    const before = current.before ?? shapes
    if (!keep || !text) {
      // A new label abandoned empty leaves nothing behind, and no undo step.
      if (!original.text) setShapes(without)
      else if (keep) record(without, before)
      return
    }
    record(shapes.map((shape) => (shape.id === current.id ? { ...shape, text, width: Math.max(40, text.length * 9 + 12) } : shape)), before)
  }

  // Leaving the select tool clears the selection, as every drawing app does.
  useEffect(() => {
    if (tool !== 'select') setSelected([])
  }, [tool])

  const single = selected.length === 1 ? shapes.find((shape) => shape.id === selected[0]) : undefined
  const editingShape = editing && shapes.find((shape) => shape.id === editing.id)
  const handles: [WhiteboardHandle, number, number][] = single
    ? single.kind === 'arrow'
      ? [
          ['tail', single.x, single.y],
          ['head', single.x + single.width, single.y + single.height],
        ]
      : [
          ['nw', single.x, single.y],
          ['ne', single.x + single.width, single.y],
          ['sw', single.x, single.y + single.height],
          ['se', single.x + single.width, single.y + single.height],
        ]
    : []

  return (
    <div className={cn('flex h-[440px] w-full min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      <div role="toolbar" aria-label="Whiteboard tools" className="flex flex-wrap items-center gap-1 border-b border-line p-1.5">
        {TOOLS.map((entry) => (
          <IconButton
            key={entry.tool}
            icon={entry.icon}
            label={`${entry.label} (${entry.key.toUpperCase()})`}
            size="xs"
            shape="square"
            selected={tool === entry.tool}
            aria-pressed={tool === entry.tool}
            onClick={() => setTool(entry.tool)}
          />
        ))}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
        <IconButton icon={Undo} label="Undo" size="xs" shape="square" disabled={!history.past.length} onClick={undo} />
        <IconButton icon={Redo} label="Redo" size="xs" shape="square" disabled={!history.future.length} onClick={redo} />
        <IconButton icon={Trash} label="Delete selected" size="xs" shape="square" disabled={!selected.length} onClick={remove} />
        <span className="flex-1" />
        <Menu
          label="Export"
          align="end"
          trigger={
            <Button size="sm" variant="ghost" aria-haspopup="menu">
              Export
            </Button>
          }
          items={[
            { id: 'json', label: 'Shapes as JSON', onSelect: () => exportAs('json') },
            { id: 'svg', label: 'Drawing as SVG', onSelect: () => exportAs('svg') },
          ]}
        />
      </div>
      <div
        ref={surfaceRef}
        role="application"
        aria-roledescription="whiteboard"
        aria-label={label}
        aria-describedby={helpId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          const { x, y } = local(event)
          const target = [...shapes].reverse().find((shape) => shape.kind === 'text' && hits(shape, x, y))
          if (target) setEditing({ id: target.id, text: target.text ?? '' })
        }}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden bg-app outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus)]',
          'bg-[radial-gradient(circle,var(--color-line-strong)_1px,transparent_1px)] [background-size:20px_20px]',
          tool === 'select' ? 'cursor-default' : 'cursor-crosshair',
        )}
      >
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible text-ink">
          {shapes.map((shape) => (
            <ShapeView key={shape.id} shape={shape} hidden={editing?.id === shape.id} />
          ))}
          {draft.pen && <path d={pathOf(draft.pen)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
          {selected.map((id) => {
            const shape = shapes.find((entry) => entry.id === id)
            if (!shape) return null
            const b = bounds(shape)
            return (
              <rect
                key={id}
                x={b.left - 4}
                y={b.top - 4}
                width={b.right - b.left + 8}
                height={b.bottom - b.top + 8}
                fill="none"
                stroke="var(--color-accent-strong)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )
          })}
          {handles.map(([name, hx, hy]) => (
            <rect
              key={name}
              data-handle={name}
              x={hx - 5}
              y={hy - 5}
              width={10}
              height={10}
              rx={2}
              fill="var(--color-surface)"
              stroke="var(--color-accent-strong)"
              strokeWidth={2}
              className="cursor-nwse-resize"
            />
          ))}
          {draft.marquee && (
            <rect
              {...draft.marquee}
              fill="color-mix(in oklab, var(--color-accent) 12%, transparent)"
              stroke="var(--color-accent-strong)"
              strokeDasharray="4 3"
            />
          )}
        </svg>
        {editingShape && editing && (
          <input
            autoFocus
            aria-label="Text"
            value={editing.text}
            onChange={(event) => setEditing({ ...editing, text: event.target.value })}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') finishEditing(true)
              if (event.key === 'Escape') finishEditing(false)
            }}
            onBlur={() => finishEditing(true)}
            style={{ left: editingShape.x, top: editingShape.y, width: Math.max(160, editingShape.width), height: editingShape.height }}
            className="absolute rounded-md border border-accent-strong bg-surface px-1 text-[16px] font-semibold text-ink outline-none"
          />
        )}
        {shapes.length === 0 && !draft.pen && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-medium text-ink-faint">
            Pick a tool and drag to draw, or press Enter to place one.
          </p>
        )}
      </div>
      <VisuallyHidden>
        <span id={helpId}>
          {shapes.length} shape{shapes.length === 1 ? '' : 's'}, {selected.length} selected. Tools: V select, R rectangle, O ellipse, A
          arrow, T text, P pen. Enter places a shape. Brackets step through shapes, arrows nudge, Delete removes, Control Z undoes.
        </span>
      </VisuallyHidden>
    </div>
  )
}
