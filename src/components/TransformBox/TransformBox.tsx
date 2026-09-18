'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { PlotAnnouncer } from '../internal/plot'

export interface TransformBoxValue {
  /** Left edge of the unrotated box, in the parent's pixels. */
  x: number
  /** Top edge of the unrotated box. */
  y: number
  width: number
  height: number
  /** Degrees clockwise about the centre. */
  rotation: number
}

export interface TransformBoxProps {
  /** Controlled geometry. */
  value?: TransformBoxValue
  /** Geometry when uncontrolled. */
  defaultValue?: TransformBoxValue
  /** Called on every change during a drag and on every key press. */
  onValueChange?: (value: TransformBoxValue) => void
  /** What is being transformed, for the accessible name — "Logo", "Photo". */
  label: string
  /** The content inside the frame. It is stretched to the frame. */
  children?: ReactNode
  /** Smallest width a resize can reach. */
  minWidth?: number
  /** Smallest height a resize can reach. */
  minHeight?: number
  /** Always keep the aspect ratio, as if Shift were held. */
  lockAspectRatio?: boolean
  /** Hide the handles and ignore input. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

type Handle = [-1 | 0 | 1, -1 | 0 | 1]
const HANDLES: Handle[] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']
const rad = (deg: number) => (deg * Math.PI) / 180
const normalise = (deg: number) => {
  const turned = ((deg % 360) + 360) % 360
  return turned > 180 ? turned - 360 : turned
}

/**
 * Resize in the box's own frame. `dx`/`dy` are already rotated into local
 * axes; the handle says which edges move. Without `fromCenter` the opposite
 * edge or corner is the anchor and stays put in the parent's coordinates.
 */
export function resizeTransformBox(
  start: TransformBoxValue,
  [sx, sy]: Handle,
  dx: number,
  dy: number,
  options: { keepAspect?: boolean; fromCenter?: boolean; minWidth?: number; minHeight?: number } = {},
): TransformBoxValue {
  const { keepAspect = false, fromCenter = false, minWidth = 8, minHeight = 8 } = options
  const factor = fromCenter ? 2 : 1
  let width = sx ? start.width + sx * dx * factor : start.width
  let height = sy ? start.height + sy * dy * factor : start.height
  if (keepAspect) {
    const ratio = start.width / start.height
    let scale = sx && sy ? (Math.abs(width / start.width - 1) > Math.abs(height / start.height - 1) ? width / start.width : height / start.height) : sx ? width / start.width : height / start.height
    scale = Math.max(scale, minWidth / start.width, minHeight / start.height)
    width = start.width * scale
    height = width / ratio
  } else {
    width = Math.max(minWidth, width)
    height = Math.max(minHeight, height)
  }
  // Centre shift in local axes, then rotated back into the parent's axes.
  const lx = fromCenter ? 0 : (sx * (width - start.width)) / 2
  const ly = fromCenter ? 0 : (sy * (height - start.height)) / 2
  const t = rad(start.rotation)
  const cx = start.x + start.width / 2 + lx * Math.cos(t) - ly * Math.sin(t)
  const cy = start.y + start.height / 2 + lx * Math.sin(t) + ly * Math.cos(t)
  return { ...start, x: cx - width / 2, y: cy - height / 2, width, height }
}

type Gesture =
  | { kind: 'move'; start: TransformBoxValue; px: number; py: number }
  | { kind: 'resize'; start: TransformBoxValue; px: number; py: number; handle: Handle }
  | { kind: 'rotate'; start: TransformBoxValue; cx: number; cy: number; offset: number }

/**
 * A move, resize and rotate frame around anything — an image on a canvas, a
 * sticker, a text block in a layout editor.
 *
 * Resizing a rotated box is where most implementations drift: they resize in
 * screen axes, so the corner you are not holding slides away. Here the maths
 * runs in the box's own rotated frame and the opposite corner or edge is held
 * fixed in the parent's coordinates, which is what design tools do. Shift keeps
 * the aspect ratio (and snaps rotation to 15°), Alt resizes from the centre.
 * The frame is one tab stop: arrows move it, Alt+arrows resize it, and
 * Ctrl+Left/Right or [ and ] rotate it; Shift makes each step larger.
 */
export function TransformBox({
  value: valueProp,
  defaultValue = { x: 40, y: 40, width: 160, height: 120, rotation: 0 },
  onValueChange,
  label,
  children,
  minWidth = 24,
  minHeight = 24,
  lockAspectRatio = false,
  disabled = false,
  className,
}: TransformBoxProps) {
  const [state, setState] = useState(defaultValue)
  const value = valueProp ?? state
  const gesture = useRef<Gesture | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')

  const set = (next: TransformBoxValue) => {
    const rounded = {
      x: Math.round(next.x * 10) / 10,
      y: Math.round(next.y * 10) / 10,
      width: Math.round(next.width * 10) / 10,
      height: Math.round(next.height * 10) / 10,
      rotation: Math.round(normalise(next.rotation) * 10) / 10,
    }
    if (valueProp === undefined) setState(rounded)
    onValueChange?.(rounded)
  }

  const begin = (event: ReactPointerEvent<HTMLElement>, next: Gesture) => {
    if (disabled || event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    frameRef.current?.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gesture.current = next
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = gesture.current
    if (!current) return
    if (current.kind === 'move') {
      set({ ...current.start, x: current.start.x + event.clientX - current.px, y: current.start.y + event.clientY - current.py })
    } else if (current.kind === 'resize') {
      const [wx, wy] = [event.clientX - current.px, event.clientY - current.py]
      const t = rad(current.start.rotation)
      const dx = wx * Math.cos(t) + wy * Math.sin(t)
      const dy = -wx * Math.sin(t) + wy * Math.cos(t)
      set(resizeTransformBox(current.start, current.handle, dx, dy, { keepAspect: lockAspectRatio || event.shiftKey, fromCenter: event.altKey, minWidth, minHeight }))
    } else {
      let angle = (Math.atan2(event.clientY - current.cy, event.clientX - current.cx) * 180) / Math.PI - current.offset
      if (event.shiftKey) angle = Math.round(angle / 15) * 15
      set({ ...current.start, rotation: angle })
    }
  }
  const end = () => {
    if (gesture.current) setMessage(describe(value))
    gesture.current = null
  }

  const describe = (box: TransformBoxValue) =>
    `${label}: ${Math.round(box.x)}, ${Math.round(box.y)}, ${Math.round(box.width)} by ${Math.round(box.height)}, rotated ${Math.round(box.rotation)} degrees`

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.target !== event.currentTarget) return
    const step = event.shiftKey ? 10 : 1
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    let next: TransformBoxValue | null = null
    if (event.key === '[' || event.key === ']') next = { ...value, rotation: value.rotation + (event.key === ']' ? 1 : -1) * (event.shiftKey ? 15 : 1) }
    else if (arrows[event.key]) {
      const [ax, ay] = arrows[event.key]
      if ((event.ctrlKey || event.metaKey) && ax) next = { ...value, rotation: value.rotation + ax * (event.shiftKey ? 15 : 1) }
      else if (event.altKey)
        next = resizeTransformBox(value, [ax ? 1 : 0, ay ? 1 : 0], ax * step, ay * step, { keepAspect: lockAspectRatio, minWidth, minHeight })
      else next = { ...value, x: value.x + ax * step, y: value.y + ay * step }
    }
    if (!next) return
    event.preventDefault()
    set(next)
    setMessage(describe(next))
  }

  const cursorFor = ([sx, sy]: Handle) => CURSORS[((Math.round((Math.atan2(sy, sx) * 180) / Math.PI / 45 + value.rotation / 45) % 4) + 4) % 4]

  return (
    <div
      ref={frameRef}
      role="group"
      aria-roledescription="transform frame"
      aria-label={`${describe(value)}. Arrows move, Alt and arrows resize, square brackets rotate.`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => begin(event, { kind: 'move', start: value, px: event.clientX, py: event.clientY })}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn(
        'group absolute touch-none select-none outline-none',
        !disabled && 'cursor-move',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus',
        className,
      )}
      style={{ left: value.x, top: value.y, width: value.width, height: value.height, transform: `rotate(${value.rotation}deg)` }}
    >
      <div className="size-full overflow-hidden">{children}</div>
      <div data-frame="" aria-hidden="true" className={cn('pointer-events-none absolute inset-0 border-[1.5px] border-accent-strong', disabled && 'hidden')} />
      {!disabled && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute -top-7 left-1/2 h-7 w-px -translate-x-1/2 bg-accent-strong" />
          <div
            aria-hidden="true"
            onPointerDown={(event) => {
              const rect = frameRef.current!.getBoundingClientRect()
              const [cx, cy] = [rect.left + rect.width / 2, rect.top + rect.height / 2]
              const pointer = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI
              begin(event, { kind: 'rotate', start: value, cx, cy, offset: pointer - value.rotation })
            }}
            className="absolute -top-9 left-1/2 size-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-accent-strong bg-surface"
          />
          {HANDLES.map((handle) => (
            <div
              key={handle.join()}
              aria-hidden="true"
              onPointerDown={(event) => begin(event, { kind: 'resize', start: value, px: event.clientX, py: event.clientY, handle })}
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-2)] border-[1.5px] border-accent-strong bg-surface"
              style={{ left: `${((handle[0] + 1) / 2) * 100}%`, top: `${((handle[1] + 1) / 2) * 100}%`, cursor: cursorFor(handle) }}
            />
          ))}
        </>
      )}
      <PlotAnnouncer message={message} />
    </div>
  )
}
