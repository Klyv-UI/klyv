'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { VisuallyHidden } from '../VisuallyHidden'

export type JoystickMode = 'analog' | 'dpad4' | 'dpad8'

export type JoystickDirection = 'up' | 'up-right' | 'right' | 'down-right' | 'down' | 'down-left' | 'left' | 'up-left'

export interface JoystickVector {
  /** −1 (left) to 1 (right). */
  x: number
  /** −1 (down) to 1 (up) — screen y is flipped so up is positive, as a game expects. */
  y: number
  /** 0 to 1, after the dead zone has been taken out. */
  magnitude: number
  /** Degrees counter-clockwise from pointing right, 0–360. Null at rest. */
  angle: number | null
  /** The nearest of the eight compass directions. Null at rest. */
  direction: JoystickDirection | null
}

export interface JoystickProps {
  /** Accessible name, such as “Move”. */
  label: string
  /** Called with the vector whenever it changes, and every frame while held if `continuous` is on. */
  onMove?: (vector: JoystickVector) => void
  /** Called once when the stick is released and springs back. */
  onEnd?: () => void
  /** `analog` reports any angle; `dpad4` and `dpad8` snap to four or eight directions. */
  mode?: JoystickMode
  /** Fraction of the radius, 0–1, that reads as centred. Stops drift from a resting thumb. */
  deadZone?: number
  /** Report the vector every animation frame while held, not only on change — what a game loop wants. */
  continuous?: boolean
  /** Diameter of the base in pixels. */
  size?: number
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const REST: JoystickVector = { x: 0, y: 0, magnitude: 0, angle: null, direction: null }
const DIRECTIONS: JoystickDirection[] = ['right', 'up-right', 'up', 'up-left', 'left', 'down-left', 'down', 'down-right']
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, 1],
  w: [0, 1],
  ArrowDown: [0, -1],
  s: [0, -1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
}

/** Turn a raw offset (unit circle, y up) into the reported vector: dead zone, rescale, then snapping. */
function toVector(rawX: number, rawY: number, deadZone: number, mode: JoystickMode): JoystickVector {
  const length = Math.hypot(rawX, rawY)
  if (length <= deadZone || length === 0) return REST
  let angle = Math.atan2(rawY, rawX)
  // Rescale past the dead zone so the output still spans 0–1 rather than jumping from 0 to deadZone.
  let magnitude = Math.min(1, (length - deadZone) / (1 - deadZone))
  if (mode !== 'analog') {
    const step = mode === 'dpad4' ? Math.PI / 2 : Math.PI / 4
    angle = Math.round(angle / step) * step
    magnitude = 1
  }
  const degrees = ((angle * 180) / Math.PI + 360) % 360
  const round = (value: number) => Math.round(value * 1000) / 1000 || 0
  return {
    x: round(Math.cos(angle) * magnitude),
    y: round(Math.sin(angle) * magnitude),
    magnitude: round(magnitude),
    angle: Math.round(degrees * 10) / 10,
    direction: DIRECTIONS[Math.round(degrees / 45) % 8]!,
  }
}

/**
 * A virtual analogue stick: drag the knob anywhere inside the ring and read a normalised vector back.
 *
 * The maths is the whole component. The pointer offset is clamped to the ring, a dead zone is taken out and the rest
 * rescaled so the output still runs from 0 to 1 — without that, a resting thumb drifts the character and the first
 * millimetre of travel jumps straight to 12%. D-pad modes snap the angle to four or eight directions at full strength,
 * because a menu or a grid game wants “left”, not 0.93 of left.
 *
 * The keyboard is a first-class input rather than a fallback: arrows and WASD are held as a set, so Up and Right
 * together give the diagonal, and they feed the same function as the pointer. Pointer capture keeps the drag alive
 * when a thumb slides off the ring, and on release the knob springs back — instantly under reduced motion.
 */
export function Joystick({
  label,
  onMove,
  onEnd,
  mode = 'analog',
  deadZone = 0.12,
  continuous = false,
  size = 144,
  disabled = false,
  className,
}: JoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null)
  const helpId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [vector, setVector] = useState<JoystickVector>(REST)
  const [held, setHeld] = useState(false)
  const keys = useRef(new Set<string>())
  const latest = useRef(vector)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  const report = (rawX: number, rawY: number) => {
    const length = Math.hypot(rawX, rawY)
    const clampX = length > 1 ? rawX / length : rawX
    const clampY = length > 1 ? rawY / length : rawY
    const next = toVector(clampX, clampY, deadZone, mode)
    // The knob shows the snapped position in D-pad modes, so what you see is what the game gets.
    setKnob(mode === 'analog' ? { x: clampX, y: clampY } : { x: next.x, y: next.y })
    const changed = next.x !== latest.current.x || next.y !== latest.current.y
    latest.current = next
    setVector(next)
    // Changes are reported at once; in continuous mode the frame loop also repeats the latest vector.
    if (changed) onMoveRef.current?.(next)
  }

  const release = () => {
    setHeld(false)
    setKnob({ x: 0, y: 0 })
    setVector(REST)
    const wasMoving = latest.current.magnitude > 0
    latest.current = REST
    if (wasMoving || continuous) onMoveRef.current?.(REST)
    onEnd?.()
  }

  // While held, a game loop needs the vector every frame even when the thumb is still.
  useEffect(() => {
    if (!held || !continuous) return
    let frame = requestAnimationFrame(function tick() {
      onMoveRef.current?.(latest.current)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [held, continuous])

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = baseRef.current?.getBoundingClientRect()
    if (!box) return
    const radius = box.width / 2
    report((event.clientX - box.left - radius) / radius, -(event.clientY - box.top - radius) / radius)
  }

  const fromKeys = () => {
    let x = 0
    let y = 0
    for (const key of keys.current) {
      x += KEYS[key]![0]
      y += KEYS[key]![1]
    }
    if (x === 0 && y === 0) {
      if (held) release()
      return
    }
    setHeld(true)
    const length = Math.hypot(x, y)
    report(x / length, y / length)
  }

  const keyName = (event: KeyboardEvent) => (event.key.length === 1 ? event.key.toLowerCase() : event.key)

  const moving = vector.direction ? `${vector.direction}, ${Math.round(vector.magnitude * 100)}%` : 'centred'

  return (
    <div
      ref={baseRef}
      role="application"
      aria-roledescription="joystick"
      aria-label={label}
      aria-describedby={helpId}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.focus({ preventScroll: true })
        setHeld(true)
        fromPointer(event)
      }}
      onPointerMove={(event) => {
        if (held && event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event)
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) release()
      }}
      onPointerCancel={release}
      onKeyDown={(event) => {
        const key = keyName(event)
        if (disabled || !(key in KEYS)) return
        event.preventDefault()
        if (keys.current.has(key)) return
        keys.current.add(key)
        fromKeys()
      }}
      onKeyUp={(event) => {
        const key = keyName(event)
        if (!keys.current.delete(key)) return
        event.preventDefault()
        fromKeys()
      }}
      onBlur={() => {
        if (keys.current.size === 0) return
        keys.current.clear()
        release()
      }}
      style={{ width: size, height: size }}
      className={cn(
        'relative shrink-0 touch-none select-none rounded-full border border-line-strong bg-surface-muted',
        'shadow-[inset_0_2px_10px_color-mix(in_oklab,var(--color-ink)_12%,transparent)]',
        disabled ? 'cursor-not-allowed opacity-50' : held ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
    >
      {/* Direction ticks, and the dead zone drawn as the inner ring. */}
      <svg aria-hidden="true" viewBox="-50 -50 100 100" className="pointer-events-none absolute inset-0 size-full text-ink-faint">
        {(mode === 'dpad4' ? [0, 90, 180, 270] : [0, 45, 90, 135, 180, 225, 270, 315]).map((degrees) => (
          <line
            key={degrees}
            x1={0}
            y1={-44}
            x2={0}
            y2={-39}
            transform={`rotate(${degrees})`}
            stroke="currentColor"
            strokeWidth={mode !== 'analog' || degrees % 90 === 0 ? 2 : 1}
            strokeLinecap="round"
          />
        ))}
        <circle r={deadZone * 50} fill="none" stroke="currentColor" strokeDasharray="2 3" opacity={0.6} />
      </svg>
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 rounded-full border border-[color-mix(in_oklab,var(--color-accent-ink)_20%,transparent)] bg-accent',
          'shadow-[var(--shadow-float)]',
          !held && !reducedMotion && 'transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)]',
        )}
        style={{
          width: size * 0.42,
          height: size * 0.42,
          // Knob travel stops a little short of the rim so it never spills out of the base.
          transform: `translate(-50%, -50%) translate(${knob.x * size * 0.29}px, ${-knob.y * size * 0.29}px)`,
        }}
      />
      <VisuallyHidden>
        <span id={helpId}>
          Drag, or hold the arrow keys or W A S D. Currently {moving}.
        </span>
      </VisuallyHidden>
    </div>
  )
}
