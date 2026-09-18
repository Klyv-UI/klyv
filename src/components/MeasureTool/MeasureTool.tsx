'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Field } from '../Field'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { SegmentedControl } from '../SegmentedControl'
import { Select } from '../Select'
import { CrossIcon } from '../internal/icons'

/** A point in the image’s own pixels. */
export interface MeasureToolPoint {
  x: number
  y: number
}

export type MeasureToolKind = 'distance' | 'area' | 'angle'

export interface MeasureToolMeasurement {
  id: string
  kind: MeasureToolKind
  /** Distance: a polyline. Area: a polygon’s corners. Angle: three points, the vertex in the middle. */
  points: MeasureToolPoint[]
}

/** How many real units one image pixel spans, from a line of known length. */
export interface MeasureToolCalibration {
  points: [MeasureToolPoint, MeasureToolPoint]
  length: number
  unit: string
}

export interface MeasureToolProps {
  /** The image to measure on. */
  src: string
  /** Alt text for the image. */
  alt: string
  /** Measurements, controlled. */
  value?: MeasureToolMeasurement[]
  /** Measurements to start with, uncontrolled. */
  defaultValue?: MeasureToolMeasurement[]
  /** Called whenever a measurement is added, edited or removed. */
  onValueChange?: (value: MeasureToolMeasurement[]) => void
  /** Scale to start with. Without one, lengths are in pixels. */
  defaultCalibration?: MeasureToolCalibration
  /** Called when the scale is set. */
  onCalibrationChange?: (calibration: MeasureToolCalibration) => void
  /** Units offered when calibrating. */
  units?: string[]
  /** Merged last, so it wins. */
  className?: string
}

type Tool = 'calibrate' | MeasureToolKind

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'calibrate', label: 'Set scale' },
  { value: 'distance', label: 'Distance' },
  { value: 'area', label: 'Area' },
  { value: 'angle', label: 'Angle' },
]
const NEEDS: Record<Tool, number> = { calibrate: 2, distance: 2, area: 3, angle: 3 }
const NAMES: Record<MeasureToolKind, string> = { distance: 'Distance', area: 'Area', angle: 'Angle' }

const span = (a: MeasureToolPoint, b: MeasureToolPoint) => Math.hypot(b.x - a.x, b.y - a.y)
const pathLength = (points: MeasureToolPoint[]) => points.slice(1).reduce((sum, point, index) => sum + span(points[index], point), 0)
/** The shoelace formula: half the absolute sum of the cross products of consecutive corners. */
const shoelace = (points: MeasureToolPoint[]) =>
  Math.abs(points.reduce((sum, point, index) => sum + point.x * points[(index + 1) % points.length].y - points[(index + 1) % points.length].x * point.y, 0)) / 2
const angleAt = ([a, vertex, b]: MeasureToolPoint[]) => {
  const first = Math.atan2(a.y - vertex.y, a.x - vertex.x)
  const second = Math.atan2(b.y - vertex.y, b.x - vertex.x)
  const degrees = Math.abs(((second - first) * 180) / Math.PI) % 360
  return degrees > 180 ? 360 - degrees : degrees
}
const round = (value: number) => (value >= 100 ? value.toFixed(1) : value >= 10 ? value.toFixed(2) : value.toFixed(3))

/**
 * Measure real distances, areas and angles on a photo or plan.
 *
 * Set the scale first by drawing along something of known length — a scale
 * bar, a door, a ruler in the shot — and every measurement after it is in
 * real units; before that, they are in pixels and say so. Distances are
 * polylines, areas are polygons measured with the shoelace formula, and
 * angles are three points with the vertex in the middle. Every point stays
 * draggable, and changing the scale re-states every value at once.
 *
 * It works without a pointer: focus the image and a crosshair appears; arrows
 * move it (Shift for larger steps), Enter places a point, F finishes a
 * distance or area, Backspace takes back the last point and Escape cancels.
 */
export function MeasureTool({
  src,
  alt,
  value,
  defaultValue = [],
  onValueChange,
  defaultCalibration,
  onCalibrationChange,
  units = ['mm', 'cm', 'm', 'in', 'ft'],
  className,
}: MeasureToolProps) {
  const [inner, setInner] = useState(defaultValue)
  const measurements = value ?? inner
  const [calibration, setCalibration] = useState(defaultCalibration)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [tool, setTool] = useState<Tool>(defaultCalibration ? 'distance' : 'calibrate')
  const [draft, setDraft] = useState<MeasureToolPoint[]>([])
  const [pending, setPending] = useState<[MeasureToolPoint, MeasureToolPoint] | null>(null)
  const [length, setLength] = useState('')
  const [unit, setUnit] = useState(defaultCalibration?.unit ?? units[0])
  const [cursor, setCursor] = useState<MeasureToolPoint | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; index: number } | null>(null)
  const counter = useRef(measurements.length)

  useEffect(() => {
    if (!src) return
    let cancelled = false
    const image = new Image()
    image.onload = () => !cancelled && setSize({ width: image.naturalWidth || 800, height: image.naturalHeight || 600 })
    image.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  const W = size?.width ?? 800
  const H = size?.height ?? 600
  const perPixel = calibration ? calibration.length / span(...calibration.points) : null
  const unitLabel = calibration?.unit ?? 'px'

  const commit = (next: MeasureToolMeasurement[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const describe = (measurement: { kind: MeasureToolKind; points: MeasureToolPoint[] }) => {
    const { kind, points } = measurement
    if (kind === 'angle') return points.length === 3 ? `${angleAt(points).toFixed(1)}°` : '—'
    if (kind === 'area') {
      const pixels = shoelace(points)
      return perPixel ? `${round(pixels * perPixel * perPixel)} ${unitLabel}²` : `${Math.round(pixels)} px²`
    }
    const pixels = pathLength(points)
    return perPixel ? `${round(pixels * perPixel)} ${unitLabel}` : `${Math.round(pixels)} px`
  }

  const finish = (placed = draft) => {
    // A double-click lands two clicks on one spot first; drop the repeats.
    const points = placed.filter((point, index) => index === 0 || span(placed[index - 1], point) > 0.5)
    if (tool === 'calibrate' || points.length < NEEDS[tool]) return
    counter.current += 1
    const measurement = { id: `m${counter.current}`, kind: tool, points }
    commit([...measurements, measurement])
    setDraft([])
    setSelected(measurement.id)
    setMessage(`${NAMES[tool]} added: ${describe(measurement)}.`)
  }

  const place = (point: MeasureToolPoint) => {
    const next = [...draft, { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 }]
    if (tool === 'calibrate' && next.length === 2) {
      setPending([next[0], next[1]])
      setDraft([])
      setMessage('Enter the real length of the line you drew.')
      return
    }
    if (tool === 'angle' && next.length === 3) return finish(next)
    // Clicking the first corner again closes an area.
    if (tool === 'area' && next.length > 3 && span(next[0], point) < W / 60) return finish(draft)
    setDraft(next)
    setMessage(`Point ${next.length} placed.`)
  }

  const toImage = (event: { clientX: number; clientY: number }): MeasureToolPoint => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: Math.min(W, Math.max(0, point.x)), y: Math.min(H, Math.max(0, point.y)) }
  }

  const movePoint = (id: string, index: number, to: MeasureToolPoint) =>
    commit(measurements.map((item) => (item.id === id ? { ...item, points: item.points.map((point, at) => (at === index ? to : point)) } : item)))

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const target = event.target as SVGElement
    if (target.dataset.id) {
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { id: target.dataset.id, index: Number(target.dataset.index) }
      setSelected(target.dataset.id)
      return
    }
    place(toImage(event))
  }

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if ((event.target as SVGElement).dataset.id) return
    const step = event.shiftKey ? W / 20 : W / 200
    const at = cursor ?? { x: W / 2, y: H / 2 }
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) setCursor({ x: Math.min(W, Math.max(0, at.x + moves[event.key][0])), y: Math.min(H, Math.max(0, at.y + moves[event.key][1])) })
    else if (event.key === 'Enter' || event.key === ' ') place(at)
    else if (event.key === 'f' || event.key === 'F') finish()
    else if (event.key === 'Backspace') setDraft(draft.slice(0, -1))
    else if (event.key === 'Escape') setDraft([])
    else return
    event.preventDefault()
  }

  const onPointKey = (event: KeyboardEvent<SVGElement>, measurement: MeasureToolMeasurement, index: number) => {
    const step = event.shiftKey ? W / 50 : 1
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const point = measurement.points[index]
    movePoint(measurement.id, index, { x: Math.min(W, Math.max(0, point.x + move[0])), y: Math.min(H, Math.max(0, point.y + move[1])) })
  }

  const applyScale = () => {
    const known = Number(length)
    if (!pending || !(known > 0)) return
    const next = { points: pending, length: known, unit }
    setCalibration(next)
    onCalibrationChange?.(next)
    setPending(null)
    setLength('')
    setTool('distance')
    setMessage(`Scale set: ${round(known / span(...pending))} ${unit} per pixel.`)
  }

  const stroke = Math.max(W, H) / 400
  const radius = Math.max(W, H) / 110
  const font = Math.max(W, H) / 45
  const label = (text: string, at: MeasureToolPoint) => (
    <text x={at.x} y={at.y - radius * 1.8} textAnchor="middle" fontSize={font} className="pointer-events-none fill-ink font-sans font-bold [paint-order:stroke] stroke-surface" strokeWidth={font / 4}>
      {text}
    </text>
  )
  const centroid = (points: MeasureToolPoint[]) => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length })
  const shape = (kind: Tool, points: MeasureToolPoint[], faint = false) => {
    const d = points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join('') + (kind === 'area' && points.length > 2 && !faint ? 'Z' : '')
    return (
      <path
        d={d}
        fill={kind === 'area' ? undefined : 'none'}
        className={cn(kind === 'area' ? 'fill-[color-mix(in_oklab,var(--color-accent)_24%,transparent)]' : '', kind === 'calibrate' ? 'stroke-ink' : 'stroke-accent-strong', 'pointer-events-none')}
        strokeWidth={stroke}
        strokeDasharray={faint || kind === 'calibrate' ? `${stroke * 3} ${stroke * 2}` : undefined}
        strokeLinejoin="round"
      />
    )
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Tool"
          size="sm"
          value={tool}
          onValueChange={(next) => {
            setTool(next)
            setDraft([])
          }}
          options={TOOLS}
        />
        {(tool === 'distance' || tool === 'area') && (
          <Button size="sm" variant="outline" disabled={draft.length < NEEDS[tool]} onClick={() => finish()}>
            Finish {tool}
          </Button>
        )}
        <span className="ml-auto text-[12px] font-semibold text-ink-faint">
          {calibration ? `Scale: ${calibration.length} ${calibration.unit} line` : 'No scale yet — values in pixels'}
        </span>
      </div>

      {pending && (
        <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-glyph)] bg-surface-sunken p-3">
          <Field label="Known length" className="w-32">
            <Input type="number" inputSize="sm" min="0" step="any" value={length} onChange={(event) => setLength(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyScale()} autoFocus />
          </Field>
          <Select label="Unit" size="sm" value={unit} onValueChange={setUnit} options={units.map((option) => ({ value: option, label: option }))} />
          <Button size="sm" variant="accent" disabled={!(Number(length) > 0)} onClick={applyScale}>
            Set scale
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
            Cancel
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="application"
          aria-roledescription="measuring canvas"
          aria-label={`${alt}. ${TOOLS.find((option) => option.value === tool)!.label} tool. Arrows move the crosshair, Enter places a point, F finishes, Backspace undoes, Escape cancels.`}
          tabIndex={0}
          className="block h-auto w-full cursor-crosshair touch-none select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
          onPointerDown={onPointerDown}
          onPointerMove={(event) => drag.current && movePoint(drag.current.id, drag.current.index, toImage(event))}
          onPointerUp={() => (drag.current = null)}
          onDoubleClick={() => finish()}
          onKeyDown={onKeyDown}
          onFocus={() => setCursor((current) => current ?? { x: W / 2, y: H / 2 })}
          onBlur={() => setCursor(null)}
        >
          {src && <image href={src} width={W} height={H} preserveAspectRatio="none" />}
          {calibration && (
            <g opacity="0.6">
              {shape('calibrate', calibration.points)}
              {label(`${calibration.length} ${calibration.unit}`, centroid(calibration.points))}
            </g>
          )}
          {pending && shape('calibrate', pending)}
          {measurements.map((measurement, measurementIndex) => {
            const active = selected === measurement.id
            return (
              <g key={measurement.id}>
                {shape(measurement.kind, measurement.points)}
                {label(describe(measurement), measurement.kind === 'angle' ? measurement.points[1] : measurement.kind === 'area' ? centroid(measurement.points) : measurement.points[measurement.points.length - 1])}
                {measurement.points.map((point, index) => (
                  <circle
                    key={index}
                    data-id={measurement.id}
                    data-index={index}
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    role="button"
                    tabIndex={active ? 0 : -1}
                    aria-label={`${NAMES[measurement.kind]} ${measurementIndex + 1}, point ${index + 1}. Arrows move it.`}
                    onKeyDown={(event) => onPointKey(event, measurement, index)}
                    className={cn('cursor-move stroke-accent-strong outline-none focus-visible:fill-accent', active ? 'fill-surface' : 'fill-[color-mix(in_oklab,var(--color-surface)_70%,transparent)]')}
                    strokeWidth={stroke}
                  />
                ))}
              </g>
            )
          })}
          {draft.length > 0 && shape(tool, cursor ? [...draft, cursor] : draft, true)}
          {draft.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={radius * 0.8} className="pointer-events-none fill-accent stroke-ink" strokeWidth={stroke / 2} />
          ))}
          {cursor && (
            <g className="pointer-events-none stroke-ink" strokeWidth={stroke}>
              <line x1={cursor.x - radius * 2} y1={cursor.y} x2={cursor.x + radius * 2} y2={cursor.y} />
              <line x1={cursor.x} y1={cursor.y - radius * 2} x2={cursor.x} y2={cursor.y + radius * 2} />
            </g>
          )}
        </svg>
      </div>

      {measurements.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Measurements">
          {measurements.map((measurement, index) => (
            <li
              key={measurement.id}
              className={cn('flex items-center gap-2 rounded-[var(--radius-8)] px-2 py-1', selected === measurement.id && 'bg-surface-muted')}
            >
              <button
                type="button"
                aria-pressed={selected === measurement.id}
                onClick={() => setSelected(measurement.id)}
                className="flex min-w-0 flex-1 items-baseline gap-2 rounded-[var(--radius-6)] text-left outline-none focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span className="text-[12px] font-semibold text-ink-soft">
                  {NAMES[measurement.kind]} {index + 1}
                </span>
                <span className="text-[13px] font-bold text-ink tabular">{describe(measurement)}</span>
              </button>
              <IconButton
                icon={CrossIcon}
                size="xs"
                tone="bare"
                label={`Delete ${NAMES[measurement.kind].toLowerCase()} ${index + 1}`}
                onClick={() => {
                  commit(measurements.filter((item) => item.id !== measurement.id))
                  setMessage(`${NAMES[measurement.kind]} ${index + 1} deleted.`)
                }}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-[12px] font-medium text-ink-faint">
          {tool === 'calibrate' ? 'Draw a line along something of known length to set the scale.' : 'Click on the image to start measuring.'}
        </p>
      )}

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
