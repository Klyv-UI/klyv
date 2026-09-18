'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { CopyButton } from '../CopyButton'
import { Input } from '../Input'

/** The four numbers of `cubic-bezier(x1, y1, x2, y2)`. */
export type EasingEditorValue = [number, number, number, number]

export interface EasingEditorPreset {
  label: string
  value: EasingEditorValue
}

export interface EasingEditorProps {
  /** Controlled curve. */
  value?: EasingEditorValue
  /** Starting curve when uncontrolled. */
  defaultValue?: EasingEditorValue
  /** Called with the curve on every drag step, key press, typed number or preset. */
  onValueChange?: (value: EasingEditorValue) => void
  /** Offered as one-click starting points. */
  presets?: EasingEditorPreset[]
  /** Names the editor and prefixes its handle names. */
  label?: string
  /** Length of one preview run, in milliseconds. */
  duration?: number
  /** Merged last, so it wins. */
  className?: string
}

const DEFAULT_PRESETS: EasingEditorPreset[] = [
  { label: 'linear', value: [0, 0, 1, 1] },
  { label: 'ease', value: [0.25, 0.1, 0.25, 1] },
  { label: 'ease-in', value: [0.42, 0, 1, 1] },
  { label: 'ease-out', value: [0, 0, 0.58, 1] },
  { label: 'ease-in-out', value: [0.42, 0, 0.58, 1] },
  { label: 'back-in', value: [0.36, 0, 0.66, -0.56] },
  { label: 'back-out', value: [0.34, 1.56, 0.64, 1] },
  { label: 'back-in-out', value: [0.68, -0.6, 0.32, 1.6] },
]

const Y_MIN = -0.6
const Y_MAX = 1.6
const W = 180
const PAD = 14
const VB_W = W + PAD * 2
const VB_H = W * (Y_MAX - Y_MIN) + PAD * 2
const px = (x: number) => PAD + x * W
const py = (y: number) => PAD + (Y_MAX - y) * W
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number) => Math.round(v * 100) / 100

/** The eased progress at time `x`: solve the curve's x(t) = x, return y(t). */
export function easingEditorSolve([x1, y1, x2, y2]: EasingEditorValue, x: number): number {
  const bez = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3
  const slope = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * a + 6 * (1 - t) * t * (b - a) + 3 * t ** 2 * (1 - b)
  let t = x
  for (let i = 0; i < 8; i++) {
    const error = bez(t, x1, x2) - x
    const d = slope(t, x1, x2)
    if (Math.abs(error) < 1e-6) return bez(t, y1, y2)
    if (Math.abs(d) < 1e-6) break
    t -= error / d
  }
  // Newton stalls on flat stretches; bisection always converges.
  let lo = 0
  let hi = 1
  t = x
  for (let i = 0; i < 30; i++) {
    const v = bez(t, x1, x2)
    if (Math.abs(v - x) < 1e-6) break
    if (v < x) lo = t
    else hi = t
    t = (lo + hi) / 2
  }
  return bez(t, y1, y2)
}

/** `cubic-bezier(0.25, 0.1, 0.25, 1)` */
export const easingEditorCss = (value: EasingEditorValue) => `cubic-bezier(${value.map(round).join(', ')})`

/**
 * A cubic-bezier curve you can shape by hand, for the moment when none of the
 * named easings feels right and typing four numbers blind is guesswork.
 *
 * Both control handles drag with a pointer and move with the arrow keys —
 * Shift for bigger steps — and the numbers beside the graph take typed values.
 * The y values may leave 0–1, which is what gives a curve its overshoot. A dot
 * runs the curve on a loop so you judge the motion rather than the shape; under
 * reduced motion it stands still and a row of dots shows where the ease puts
 * an object at equal steps of time instead.
 */
export function EasingEditor({
  value,
  defaultValue = [0.25, 0.1, 0.25, 1],
  onValueChange,
  presets = DEFAULT_PRESETS,
  label = 'Easing',
  duration = 1400,
  className,
}: EasingEditorProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState<EasingEditorValue>(defaultValue)
  const curve = value ?? uncontrolled
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<0 | 1 | null>(null)
  const graphDot = useRef<SVGCircleElement>(null)
  const trackDot = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()
  const curveRef = useRef(curve)
  curveRef.current = curve

  const set = (next: EasingEditorValue) => {
    const clean = [clamp(next[0], 0, 1), clamp(next[1], Y_MIN, Y_MAX), clamp(next[2], 0, 1), clamp(next[3], Y_MIN, Y_MAX)].map(round) as EasingEditorValue
    if (value === undefined) setUncontrolled(clean)
    onValueChange?.(clean)
  }
  const moveHandle = (handle: 0 | 1, x: number, y: number) => {
    const next = [...curve] as EasingEditorValue
    next[handle * 2] = x
    next[handle * 2 + 1] = y
    set(next)
  }

  useEffect(() => {
    if (reduced) return
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const cycle = duration + 500
      const x = clamp(((now - started) % cycle) / duration, 0, 1)
      const y = easingEditorSolve(curveRef.current, x)
      graphDot.current?.setAttribute('cx', String(px(x)))
      graphDot.current?.setAttribute('cy', String(py(y)))
      if (trackDot.current) trackDot.current.style.left = `${y * 100}%`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduced, duration])

  const fromPointer = (event: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    const vx = ((event.clientX - box.left) / box.width) * VB_W
    const vy = ((event.clientY - box.top) / box.height) * VB_H
    return { x: (vx - PAD) / W, y: Y_MAX - (vy - PAD) / W }
  }

  const onKeyDown = (handle: 0 | 1) => (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.01
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key]
    if (!delta) return
    event.preventDefault()
    moveHandle(handle, curve[handle * 2] + delta[0], curve[handle * 2 + 1] + delta[1])
  }

  const names = ['Start handle', 'End handle']
  const css = easingEditorCss(curve)
  const samples = Array.from({ length: 9 }, (_, i) => easingEditorSolve(curve, i / 8))

  return (
    <div role="group" aria-label={label} className={cn('flex w-full flex-col gap-4 sm:flex-row sm:items-start', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full max-w-[200px] shrink-0 touch-none select-none self-center rounded-[var(--radius-tile)] border border-line bg-surface-sunken"
        onPointerMove={(event) => {
          if (dragging.current === null) return
          const { x, y } = fromPointer(event)
          moveHandle(dragging.current, x, y)
        }}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <rect x={px(0)} y={py(1)} width={W} height={W} className="fill-surface stroke-line" />
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t} className="stroke-line">
            <line x1={px(t)} x2={px(t)} y1={py(0)} y2={py(1)} />
            <line x1={px(0)} x2={px(1)} y1={py(t)} y2={py(t)} />
          </g>
        ))}
        <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} className="stroke-line-strong" strokeDasharray="3 3" />
        <line x1={px(0)} y1={py(0)} x2={px(curve[0])} y2={py(curve[1])} className="stroke-ink-faint" strokeWidth={1.5} />
        <line x1={px(1)} y1={py(1)} x2={px(curve[2])} y2={py(curve[3])} className="stroke-ink-faint" strokeWidth={1.5} />
        <path d={`M${px(0)} ${py(0)} C${px(curve[0])} ${py(curve[1])} ${px(curve[2])} ${py(curve[3])} ${px(1)} ${py(1)}`} fill="none" className="stroke-ink" strokeWidth={3} strokeLinecap="round" />
        {reduced ? (
          samples.map((y, i) => <circle key={i} cx={px(i / 8)} cy={py(y)} r={3} className="fill-accent-strong stroke-ink" strokeWidth={1} />)
        ) : (
          <circle ref={graphDot} cx={px(0)} cy={py(0)} r={5} className="fill-accent stroke-ink" strokeWidth={1.5} />
        )}
        {([0, 1] as const).map((handle) => {
          const x = curve[handle * 2]
          const y = curve[handle * 2 + 1]
          return (
            <g
              key={handle}
              role="slider"
              tabIndex={0}
              aria-label={`${label} ${names[handle].toLowerCase()}`}
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={x}
              aria-valuetext={`x ${x.toFixed(2)}, y ${y.toFixed(2)}. Arrow keys move it, Shift for bigger steps.`}
              onKeyDown={onKeyDown(handle)}
              onPointerDown={(event) => {
                event.preventDefault()
                ;(event.currentTarget as SVGGElement).focus()
                svgRef.current?.setPointerCapture?.(event.pointerId)
                dragging.current = handle
              }}
              className="group cursor-grab outline-none active:cursor-grabbing"
            >
              <circle cx={px(x)} cy={py(y)} r={14} className="fill-transparent" />
              <circle cx={px(x)} cy={py(y)} r={11} className="fill-none stroke-focus opacity-0 group-focus-visible:opacity-100" strokeWidth={2} />
              <circle cx={px(x)} cy={py(y)} r={7} className="fill-shell stroke-ink" strokeWidth={2.5} />
            </g>
          )
        })}
      </svg>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {['x1', 'y1', 'x2', 'y2'].map((name, index) => (
            <label key={name} htmlFor={`${uid}-${name}`} className="flex flex-col gap-1 text-[12px] font-bold text-ink-soft">
              {name}
              <Input
                id={`${uid}-${name}`}
                type="number"
                inputSize="sm"
                step={0.01}
                min={index % 2 === 0 ? 0 : Y_MIN}
                max={index % 2 === 0 ? 1 : Y_MAX}
                value={curve[index]}
                onChange={(event) => {
                  const n = Number(event.target.value)
                  if (event.target.value === '' || Number.isNaN(n)) return
                  const next = [...curve] as EasingEditorValue
                  next[index] = n
                  set(next)
                }}
                className="tabular-nums"
              />
            </label>
          ))}
        </div>

        <div role="group" aria-label="Presets" className="flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const on = preset.value.every((v, i) => round(v) === curve[i])
            const p = preset.value
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={on}
                onClick={() => set(p)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors',
                  on ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                <svg viewBox="-2 -8 20 32" width={10} height={16} aria-hidden="true">
                  <path d={`M0 16 C${p[0] * 16} ${16 - p[1] * 16} ${p[2] * 16} ${16 - p[3] * 16} 16 0`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
                </svg>
                {preset.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-ink-soft">Preview</span>
          <div className="relative mx-3 h-8">
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-track" />
            {reduced ? (
              samples.map((y, i) => <span key={i} aria-hidden="true" style={{ left: `${y * 100}%` }} className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink bg-accent-strong" />)
            ) : (
              <span ref={trackDot} aria-hidden="true" className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-accent" />
            )}
          </div>
          {reduced && <span className="text-[12px] font-medium text-ink-faint">Motion is reduced: each dot is where the ease puts an object at an equal step of time.</span>}
        </div>

        <div className="flex items-center gap-2 rounded-[var(--radius-glyph)] bg-surface-muted py-1.5 pl-3 pr-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold text-ink">{css}</code>
          <CopyButton value={css} label={`Copy ${css}`} iconOnly size="sm" />
        </div>
      </div>
    </div>
  )
}
