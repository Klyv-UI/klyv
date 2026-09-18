'use client'

import { useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { CrossIcon } from '../internal/icons'

export interface StrokeGesturesPoint {
  x: number
  y: number
}

export interface StrokeGesturesTemplate {
  /** Several templates may share a name — a circle drawn either way round. */
  name: string
  points: StrokeGesturesPoint[]
}

export interface StrokeGesturesResult {
  name: string
  /** 0 to 1, where 1 is the template exactly. */
  score: number
  /** The action mapped to this gesture, if any. */
  action?: string
}

export interface StrokeGesturesProps {
  /** Accessible name for the pad. */
  label: string
  /** The gestures it knows. Defaults to the built-in set. */
  templates?: StrokeGesturesTemplate[]
  /** Controlled user-trained templates, added to `templates`. */
  customTemplates?: StrokeGesturesTemplate[]
  /** User-trained templates when uncontrolled. */
  defaultCustomTemplates?: StrokeGesturesTemplate[]
  onCustomTemplatesChange?: (templates: StrokeGesturesTemplate[]) => void
  /** Maps a gesture name to what it does, e.g. `{ check: 'Mark done' }`. */
  actions?: Record<string, string>
  /** Called after each stroke with the match, or null if nothing scored above the threshold. */
  onGesture?: (result: StrokeGesturesResult | null) => void
  /** Lowest score accepted as a match. */
  threshold?: number
  /** Height of the pad in pixels. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/* ------------------------------------------------------------ $1 recogniser */

const N = 64
const SIZE = 250
const HALF_DIAGONAL = 0.5 * Math.sqrt(2 * SIZE * SIZE)
const RANGE = (45 * Math.PI) / 180
const PRECISION = (2 * Math.PI) / 180
const PHI = 0.5 * (Math.sqrt(5) - 1)

const dist = (a: StrokeGesturesPoint, b: StrokeGesturesPoint) => Math.hypot(b.x - a.x, b.y - a.y)
const centroid = (points: StrokeGesturesPoint[]) => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
})

function resample(input: StrokeGesturesPoint[], n: number) {
  const points = input.map((p) => ({ ...p }))
  const length = points.reduce((sum, p, i) => (i ? sum + dist(points[i - 1], p) : 0), 0)
  const interval = length / (n - 1)
  let carried = 0
  const out = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    const d = dist(points[i - 1], points[i])
    if (carried + d >= interval && d > 0) {
      const t = (interval - carried) / d
      const q = { x: points[i - 1].x + t * (points[i].x - points[i - 1].x), y: points[i - 1].y + t * (points[i].y - points[i - 1].y) }
      out.push(q)
      points.splice(i, 0, q)
      carried = 0
    } else carried += d
  }
  while (out.length < n) out.push(points[points.length - 1])
  return out.slice(0, n)
}

function rotate(points: StrokeGesturesPoint[], angle: number) {
  const c = centroid(points)
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  return points.map((p) => ({ x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x, y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y }))
}

/** Resample to 64 points, rotate the indicative angle to zero, scale to a square and centre on the origin. */
export function normaliseStroke(points: StrokeGesturesPoint[]) {
  let out = resample(points, N)
  const c = centroid(out)
  out = rotate(out, -Math.atan2(c.y - out[0].y, c.x - out[0].x))
  const xs = out.map((p) => p.x)
  const ys = out.map((p) => p.y)
  const [w, h] = [Math.max(...xs) - Math.min(...xs) || 1, Math.max(...ys) - Math.min(...ys) || 1]
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
  out = out.map((p) => ({ x: ((p.x - minX) * SIZE) / w, y: ((p.y - minY) * SIZE) / h }))
  const d = centroid(out)
  return out.map((p) => ({ x: p.x - d.x, y: p.y - d.y }))
}

const pathDistance = (a: StrokeGesturesPoint[], b: StrokeGesturesPoint[]) => a.reduce((sum, p, i) => sum + dist(p, b[i]), 0) / a.length

/** Golden-section search over ±45° for the rotation that brings the candidate closest to the template. */
function bestAngleDistance(points: StrokeGesturesPoint[], template: StrokeGesturesPoint[]) {
  let [a, b] = [-RANGE, RANGE]
  let x1 = PHI * a + (1 - PHI) * b
  let f1 = pathDistance(rotate(points, x1), template)
  let x2 = (1 - PHI) * a + PHI * b
  let f2 = pathDistance(rotate(points, x2), template)
  while (Math.abs(b - a) > PRECISION) {
    if (f1 < f2) {
      b = x2
      x2 = x1
      f2 = f1
      x1 = PHI * a + (1 - PHI) * b
      f1 = pathDistance(rotate(points, x1), template)
    } else {
      a = x1
      x1 = x2
      f1 = f2
      x2 = (1 - PHI) * a + PHI * b
      f2 = pathDistance(rotate(points, x2), template)
    }
  }
  return Math.min(f1, f2)
}

/** The $1 Unistroke recogniser: the closest template and a score from 0 to 1. */
export function recognizeStroke(points: StrokeGesturesPoint[], templates: StrokeGesturesTemplate[]) {
  if (points.length < 2 || !templates.length) return null
  const candidate = normaliseStroke(points)
  let best: { name: string; score: number } | null = null
  for (const template of templates) {
    const d = bestAngleDistance(candidate, normaliseStroke(template.points))
    const score = 1 - d / HALF_DIAGONAL
    if (!best || score > best.score) best = { name: template.name, score }
  }
  return best
}

const poly = (...corners: [number, number][]) => {
  const points: StrokeGesturesPoint[] = []
  for (let i = 1; i < corners.length; i += 1)
    for (let t = 0; t < 12; t += 1) {
      const [a, b] = [corners[i - 1], corners[i]]
      points.push({ x: a[0] + ((b[0] - a[0]) * t) / 12, y: a[1] + ((b[1] - a[1]) * t) / 12 })
    }
  const last = corners[corners.length - 1]
  points.push({ x: last[0], y: last[1] })
  return points
}
const ring = (clockwise: boolean) =>
  Array.from({ length: 49 }, (_, i) => {
    const angle = -Math.PI / 2 + ((clockwise ? 1 : -1) * i * 2 * Math.PI) / 48
    return { x: 50 + 50 * Math.cos(angle), y: 50 + 50 * Math.sin(angle) }
  })

/** The built-in gestures, each drawn in its natural direction; the circle and rectangle both ways round. */
export const STROKE_GESTURES_TEMPLATES: StrokeGesturesTemplate[] = [
  { name: 'circle', points: ring(true) },
  { name: 'circle', points: ring(false) },
  { name: 'check', points: poly([0, 55], [30, 95], [100, 0]) },
  { name: 'caret', points: poly([0, 100], [50, 0], [100, 100]) },
  { name: 'v', points: poly([0, 0], [50, 100], [100, 0]) },
  { name: 'x', points: poly([0, 0], [100, 100], [100, 0], [0, 100]) },
  { name: 'arrow', points: poly([0, 50], [100, 50], [72, 22], [100, 50], [72, 78]) },
  { name: 'rectangle', points: poly([0, 0], [100, 0], [100, 70], [0, 70], [0, 0]) },
  { name: 'rectangle', points: poly([0, 0], [0, 70], [100, 70], [100, 0], [0, 0]) },
  { name: 'triangle', points: poly([0, 100], [50, 0], [100, 100], [0, 100]) },
  { name: 'zig-zag', points: poly([0, 0], [25, 100], [50, 0], [75, 100], [100, 0]) },
]

function Thumb({ points }: { points: StrokeGesturesPoint[] }) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
  const scale = 22 / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(5 + (p.x - minX) * scale).toFixed(1)},${(5 + (p.y - minY) * scale).toFixed(1)}`).join(' ')
  return (
    <svg aria-hidden="true" width="32" height="32" className="shrink-0 rounded-[var(--radius-6)] bg-surface-muted">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={5 + (points[0].x - minX) * scale} cy={5 + (points[0].y - minY) * scale} r="2.5" className="fill-accent-strong" />
    </svg>
  )
}

/**
 * A pad that reads single-stroke gestures with the $1 Unistroke recogniser,
 * shows what it saw and how sure it is, runs the mapped action, and learns
 * new gestures from one example.
 *
 * Gesture shortcuts are fast for people with a pen or a trackpad and invisible
 * to everyone else, so every gesture here is also listed as a button that runs
 * the same action — the pad is a shortcut, never the only way in. $1 was
 * chosen because it needs no training data beyond a single drawing per
 * gesture, tolerates size, position and some rotation, and is small enough to
 * run on every stroke without a worker. Strokes below the threshold are
 * reported as not recognised rather than forced onto the nearest template.
 */
export function StrokeGestures({
  label,
  templates = STROKE_GESTURES_TEMPLATES,
  customTemplates: customProp,
  defaultCustomTemplates = [],
  onCustomTemplatesChange,
  actions = {},
  onGesture,
  threshold = 0.78,
  height = 260,
  className,
}: StrokeGesturesProps) {
  const nameId = useId()
  const [customState, setCustomState] = useState(defaultCustomTemplates)
  const custom = customProp ?? customState
  const [stroke, setStroke] = useState<StrokeGesturesPoint[]>([])
  const [result, setResult] = useState<StrokeGesturesResult | null | 'short'>(null)
  const [training, setTraining] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')
  const drawing = useRef(false)
  const all = useMemo(() => [...templates, ...custom], [templates, custom])
  const names = [...new Map(all.map((template) => [template.name, template])).values()]

  const setCustom = (next: StrokeGesturesTemplate[]) => {
    if (customProp === undefined) setCustomState(next)
    onCustomTemplatesChange?.(next)
  }

  const report = (next: StrokeGesturesResult | null) => {
    setResult(next)
    onGesture?.(next)
    setStatus(next ? `Recognised ${next.name}, ${Math.round(next.score * 100)}%${next.action ? `: ${next.action}` : ''}.` : 'Not recognised.')
  }

  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const finish = () => {
    if (!drawing.current) return
    drawing.current = false
    const xs = stroke.map((p) => p.x)
    const ys = stroke.map((p) => p.y)
    if (stroke.length < 8 || Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 24) {
      setResult('short')
      setStatus('Too short to read. Draw a larger shape in one stroke.')
      return
    }
    if (training) {
      const title = name.trim()
      setCustom([...custom, { name: title, points: stroke }])
      setTraining(false)
      setName('')
      setStatus(`Saved “${title}”. Draw it again to try it.`)
      setResult(null)
      return
    }
    const match = recognizeStroke(stroke, all)
    report(match && match.score >= threshold ? { ...match, action: actions[match.name] } : null)
  }

  const recognised = result && result !== 'short' ? result : null
  const d = stroke.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div className={cn('grid w-full gap-4 md:grid-cols-[minmax(0,1fr)_260px]', className)}>
      <div className="flex flex-col gap-2">
        <svg
          role="img"
          aria-label={`${label}. Draw a gesture with a pointer, or use the gesture buttons.`}
          className={cn(
            'w-full cursor-crosshair touch-none rounded-[var(--radius-card)] border bg-surface',
            training ? 'border-dashed border-accent-strong' : 'border-line',
          )}
          style={{ height }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            drawing.current = true
            setStroke([point(event)])
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return
            const next = point(event)
            setStroke((current) => [...current, next])
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
        >
          {!stroke.length && (
            <text x="50%" y="50%" textAnchor="middle" className="fill-ink-faint text-[12px] font-semibold">
              {training ? `Draw “${name.trim()}” once` : 'Draw here in one stroke'}
            </text>
          )}
          <path d={d} fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="stroke-ink" />
          {stroke[0] && <circle cx={stroke[0].x} cy={stroke[0].y} r="5" className="fill-accent-strong" />}
        </svg>
        <div className="flex min-h-12 items-center gap-3 rounded-[var(--radius-tile)] bg-surface-muted px-3 py-2">
          {recognised ? (
            <>
              <Thumb points={all.find((template) => template.name === recognised.name)!.points} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] font-bold capitalize text-ink">{recognised.name}</span>
                <span className="text-[11px] font-medium text-ink-soft">{recognised.action ?? 'No action mapped'}</span>
              </div>
              <span className="text-[13px] font-bold tabular-nums text-ink">{Math.round(recognised.score * 100)}%</span>
            </>
          ) : (
            <span className="text-[12px] font-medium text-ink-soft">
              {result === 'short' ? 'Too short to read' : status && !training ? status : 'Nothing drawn yet'}
            </span>
          )}
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {status}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1.5" aria-label="Known gestures">
          {names.map((template) => {
            const isCustom = custom.includes(template)
            return (
              <li key={template.name} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => report({ name: template.name, score: 1, action: actions[template.name] })}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-10)] px-1.5 py-1 text-left text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <Thumb points={template.points} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold capitalize">{template.name}</span>
                  <span className="truncate text-[11px] font-medium text-ink-faint">{actions[template.name] ?? ''}</span>
                </button>
                {isCustom && (
                  <button
                    type="button"
                    aria-label={`Forget ${template.name}`}
                    onClick={() => setCustom(custom.filter((entry) => entry.name !== template.name))}
                    className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <CrossIcon size={12} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <label htmlFor={nameId} className="text-[12px] font-semibold text-ink">
            Teach a gesture
          </label>
          <div className="flex gap-2">
            <Input id={nameId} inputSize="sm" placeholder="Name, e.g. star" value={name} onChange={(event) => setName(event.target.value)} />
            <Button
              size="sm"
              variant={training ? 'accent' : 'outline'}
              disabled={!name.trim()}
              aria-pressed={training}
              onClick={() => {
                setTraining(!training)
                setStatus(training ? 'Training cancelled.' : `Draw “${name.trim()}” on the pad.`)
              }}
            >
              {training ? 'Cancel' : 'Record'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
