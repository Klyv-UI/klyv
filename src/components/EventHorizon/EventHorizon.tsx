'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { gravityEffect, gravityTransform, type GravityField } from './gravity'

export type EventHorizonTone = 'ink' | 'accent'

export interface EventHorizonHandle {
  /** Put the hole somewhere, in the field's own pixels from its top-left. */
  moveTo: (x: number, y: number) => void
  /** Let everything go and spring back. */
  release: () => void
}

export interface EventHorizonProps {
  /** The interface to warp. Ordinary markup — it stays interactive. */
  children: ReactNode
  /**
   * What gets pulled. Every element matching this inside the field is a body;
   * everything else rides with its parent. The default takes the children of
   * the field, which is usually a grid of cards.
   */
  bodies?: string
  /** Radius of the event horizon in pixels. Inside it, a body is gone. */
  horizon?: number
  /** How far the pull is felt, in pixels. */
  reach?: number
  /** Overall strength, 1 being the tuned default. */
  strength?: number
  /** Degrees a body is turned at full pull, as the hole's spin drags it round. */
  spin?: number
  /** Where the hole starts, as a fraction of the field: `[0.5, 0.5]` is the middle. */
  origin?: [number, number]
  /** Follow the pointer over the field rather than waiting to be dragged. */
  followPointer?: boolean
  /** The disc's colour: the page's ink, or the accent. */
  tone?: EventHorizonTone
  /** Stop the spin and hold everything where it is. */
  paused?: boolean
  /** Accessible name for the hole, which is a figure in its own right. */
  label?: string
  className?: string
  style?: CSSProperties
}

/** Springs the hole toward where it is wanted, so a jump to a click is not a jump. */
const EASE = 0.18

/**
 * A black hole you can drag across a working interface.
 *
 * Every element you name is a body: it falls toward the hole on an
 * inverse-square pull, stretches along the line to it, turns with the hole's
 * spin, and fades out as it crosses the horizon — then springs back when the
 * hole moves on. Nothing is drawn twice and nothing is a picture: these are
 * the real elements of the page, so a button swallowed and returned is the
 * same button, still focused, still clickable, with its own state intact.
 *
 * The warp is a `transform`, because the stretch is a shear and the individual
 * properties cannot express one. A body's own transform is read when the field
 * measures it and composed onto the end, so an element that was already moved
 * or scaled keeps that. Layout is never touched — nothing reflows — so the cost
 * is one `requestAnimationFrame` writing a property per body in reach, and the
 * field measures its bodies only when it has to.
 *
 * Under reduced motion the hole does not spin and does not follow the pointer;
 * it sits where it was put, with the warp already applied, as a still image of
 * the same idea.
 */
export const EventHorizon = forwardRef<EventHorizonHandle, EventHorizonProps>(function EventHorizon(
  {
    children,
    bodies = ':scope > *',
    horizon = 76,
    reach = 420,
    strength = 1,
    spin = 60,
    origin = [0.5, 0.5],
    followPointer = false,
    tone = 'ink',
    paused = false,
    label = 'A singularity warping the interface around it',
    className,
    style,
  },
  ref,
) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const discRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [held, setHeld] = useState(false)

  // Where the hole is wanted, and where it has got to. Both in field pixels,
  // both refs: this runs every frame and must never re-render the children.
  const target = useRef<{ x: number; y: number } | null>(null)
  const at = useRef<{ x: number; y: number } | null>(null)
  const settings = useRef({ horizon, reach, strength, spin, paused, reducedMotion })
  settings.current = { horizon, reach, strength, spin, paused, reducedMotion }

  const place = useCallback((x: number, y: number) => {
    target.current = { x, y }
    if (!at.current) at.current = { x, y }
  }, [])

  useImperativeHandle(ref, () => ({ moveTo: place, release: () => setHeld(false) }), [place])

  // The hole starts where `origin` puts it, once the field has a size.
  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const box = field.getBoundingClientRect()
    place(box.width * origin[0], box.height * origin[1])
  }, [origin, place])

  useEffect(() => {
    const field = fieldRef.current
    const stage = stageRef.current
    const disc = discRef.current
    if (!field || !stage || !disc) return

    let running = true
    let frame = 0
    let list: HTMLElement[] = []
    let boxes: { x: number; y: number; own: string }[] = []
    let measured = 0

    /** Where each body sits when nothing is pulling it. Measured, not guessed. */
    const measure = () => {
      list = Array.from(stage.querySelectorAll<HTMLElement>(bodies))
      const field_ = field.getBoundingClientRect()
      boxes = list.map((node) => {
        // Measured with the warp off, so a body's rest position and its own
        // transform are its own rather than whatever the last frame left.
        const previous = node.style.transform
        node.style.transform = ''
        const box = node.getBoundingClientRect()
        const computed = getComputedStyle(node).transform
        node.style.transform = previous
        return {
          x: box.left - field_.left + box.width / 2,
          y: box.top - field_.top + box.height / 2,
          own: computed === 'none' ? '' : computed,
        }
      })
      measured = performance.now()
    }

    measure()
    const observer = new ResizeObserver(() => measure())
    observer.observe(field)

    const draw = () => {
      if (!running) return
      frame = requestAnimationFrame(draw)
      const wanted = target.current
      if (!wanted) return
      if (!at.current) at.current = { ...wanted }

      const current = at.current
      const settled = settings.current.reducedMotion
      current.x += (wanted.x - current.x) * (settled ? 1 : EASE)
      current.y += (wanted.y - current.y) * (settled ? 1 : EASE)

      // A body that moves for its own reasons — a card that opens, a list that
      // grows — would otherwise keep its old rest position. Re-measuring every
      // half second is cheap beside a layout thrash every frame.
      if (performance.now() - measured > 500) measure()

      disc.style.translate = `${current.x}px ${current.y}px`

      const field_: GravityField = {
        x: current.x,
        y: current.y,
        horizon: settings.current.horizon,
        reach: settings.current.reach,
        strength: settings.current.strength,
        spin: settings.current.spin,
      }

      for (let index = 0; index < list.length; index++) {
        const node = list[index]
        const rest = boxes[index]
        if (!node || !rest) continue
        const effect = gravityEffect({ x: rest.x, y: rest.y, halfWidth: 0, halfHeight: 0 }, field_)
        if (effect.pull === 0) {
          // Outside the reach: give the element back to the page entirely,
          // rather than leaving identity transforms on hundreds of nodes.
          if (node.style.transform) {
            node.style.transform = ''
            node.style.opacity = ''
            node.style.pointerEvents = ''
          }
          continue
        }
        node.style.transform = `${gravityTransform(effect)} ${rest.own}`.trim()
        node.style.opacity = effect.opacity.toFixed(3)
        // Something being swallowed should not be clickable on the way in.
        node.style.pointerEvents = effect.opacity < 0.35 ? 'none' : ''
      }
    }

    frame = requestAnimationFrame(draw)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      for (const node of list) {
        node.style.transform = ''
        node.style.opacity = ''
        node.style.pointerEvents = ''
      }
    }
  }, [bodies])

  const pointerTo = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = fieldRef.current?.getBoundingClientRect()
    if (!box) return
    place(event.clientX - box.left, event.clientY - box.top)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return
    // A control inside the field is still a control: pressing a button there
    // presses the button rather than grabbing the hole.
    if ((event.target as Element | null)?.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]')) return
    setHeld(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerTo(event)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return
    if (!held && !followPointer) return
    pointerTo(event)
  }

  // The keyboard drives the hole too: it is the only control this has.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 16
    const spot = target.current
    const box = fieldRef.current?.getBoundingClientRect()
    if (!spot || !box) return
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      place(Math.max(0, Math.min(box.width, spot.x + move[0])), Math.max(0, Math.min(box.height, spot.y + move[1])))
    } else if (event.key === 'Home') {
      event.preventDefault()
      place(box.width * origin[0], box.height * origin[1])
    }
  }

  return (
    <div
      ref={fieldRef}
      className={cn('relative isolate overflow-hidden', !reducedMotion && (held ? 'cursor-grabbing' : 'cursor-grab'), className)}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
    >
      <div ref={stageRef} className="contents">
        {children}
      </div>

      {/* The hole: a dark well, a ring of light bent round it, and a disc of
          matter falling in. Positioned by `translate` from the top-left, so
          moving it is one property and never a layout. */}
      <div
        ref={discRef}
        role="img"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute left-0 top-0 z-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ width: 0, height: 0 }}
      >
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute rounded-full',
            !paused && !reducedMotion && 'motion-safe:animate-[event-horizon-spin_9s_linear_infinite]',
          )}
          style={{
            width: horizon * 4,
            height: horizon * 4,
            translate: '-50% -50%',
            background:
              tone === 'accent'
                ? 'conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--color-accent) 70%, transparent) 60deg, transparent 150deg, color-mix(in oklab, var(--color-accent-strong) 55%, transparent) 240deg, transparent 330deg)'
                : 'conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--color-accent) 55%, transparent) 60deg, transparent 150deg, color-mix(in oklab, var(--color-ink) 35%, transparent) 240deg, transparent 330deg)',
            maskImage: 'radial-gradient(closest-side, transparent 38%, #000 52%, #000 72%, transparent 92%)',
            WebkitMaskImage: 'radial-gradient(closest-side, transparent 38%, #000 52%, #000 72%, transparent 92%)',
            filter: 'blur(6px)',
          }}
        />
        {/* The horizon itself: black, with the ring of light at its edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: horizon * 2,
            height: horizon * 2,
            translate: '-50% -50%',
            background: 'radial-gradient(closest-side, #000 62%, color-mix(in oklab, #000 70%, transparent) 86%, transparent 100%)',
            boxShadow:
              '0 0 0 1px color-mix(in oklab, var(--color-accent) 60%, transparent), 0 0 24px 6px color-mix(in oklab, var(--color-accent) 30%, transparent)',
          }}
        />
      </div>
    </div>
  )
})
