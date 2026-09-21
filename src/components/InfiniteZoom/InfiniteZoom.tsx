'use client'

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { IconButton } from '../IconButton'
import { MinusIcon, PlusIcon } from '../internal/icons'
import type { IconComponent } from '../../lib/types'

export interface InfiniteZoomRect {
  /** Left edge, as a fraction of the scene’s width. */
  x: number
  /** Top edge, as a fraction of the scene’s height. */
  y: number
  /** Width and height, as a fraction of the scene’s — one number, so the next scene keeps the frame’s shape. */
  size: number
}

export interface InfiniteZoomSceneProps {
  /** Name of the scene, shown in the depth indicator and announced on arrival. */
  label: string
  /** A line under the name — a scale, a place. */
  caption?: string
  /** Where the next scene sits inside this one. The last scene’s next is the first. */
  next: InfiniteZoomRect
  /** The picture. It fills the frame; draw it for the frame’s aspect ratio. */
  children: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export interface InfiniteZoomProps {
  /** Accessible name of the view. */
  label: string
  /** `InfiniteZoomScene`s, outermost first. */
  children: ReactNode
  /** Dive on its own when it first appears. Ignored under reduced motion. */
  autoplay?: boolean
  /** Scenes per second while diving. */
  speed?: number
  /** Freeze the camera. */
  paused?: boolean
  /** Show the depth indicator, scrub bar and buttons. */
  controls?: boolean
  /** Merged last, so it wins. Give it a height or an aspect ratio. */
  className?: string
}

/** One scene of an `InfiniteZoom`. Only means something as its child. */
export function InfiniteZoomScene({ children, className }: InfiniteZoomSceneProps) {
  return <div className={cn('absolute inset-0 overflow-hidden', className)}>{children}</div>
}

const PlayIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
    <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" />
  </svg>
)
const PauseIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
    <rect x="3.5" y="3" width="3" height="10" rx="1" />
    <rect x="9.5" y="3" width="3" height="10" rx="1" />
  </svg>
)

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(1)

/**
 * An endless zoom through scenes that contain each other, the last containing
 * the first.
 *
 * The camera is one number: depth, in scenes. Its whole part picks the scene
 * you are in and its fraction is a log-scale zoom towards the fixed point of
 * the map from the frame to the next scene’s rectangle — the one point that
 * does not move when you zoom into it — so the approach is a straight dive
 * and it lands exactly on the next scene. Depth is kept modulo the number of
 * scenes, which is the same as dividing out the loop’s cumulative scale
 * factor, so it can run forever without the numbers drifting or growing.
 *
 * Only the scene you are in, the next one and the one after are mounted; they
 * are composed with transforms, and the next fades in over the parent’s own
 * drawing of it so the hand-off is a crossfade rather than a pop.
 */
export function InfiniteZoom({ label, children, autoplay = false, speed = 0.12, paused = false, controls = true, className }: InfiniteZoomProps) {
  const reduced = usePrefersReducedMotion()
  const scenes = Children.toArray(children).filter(isValidElement) as ReactElement<InfiniteZoomSceneProps>[]
  const N = scenes.length
  const idBase = useId()
  const frame = useRef<HTMLDivElement>(null)
  const slots = useRef(new Map<number, HTMLDivElement>())
  const scrub = useRef<HTMLInputElement>(null)
  const readout = useRef<HTMLSpanElement>(null)
  const cam = useRef({ depth: 0, target: 0, w: 0, h: 0 })
  const wake = useRef<() => void>(() => {})
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const live = playing && !reduced && !paused

  const wrap = (i: number) => ((i % N) + N) % N
  const rectOf = (i: number) => scenes[wrap(i)]?.props.next ?? { x: 0.4, y: 0.4, size: 0.2 }

  const apply = useCallback(() => {
    const { depth, w, h } = cam.current
    if (!N || !w) return
    const k = Math.floor(depth)
    const t = depth - k
    // View rectangle in scene k: a log-scale zoom about the fixed point q.
    const r = rectOf(k)
    const vs = r.size ** t
    const qx = r.x / (1 - r.size)
    const qy = r.y / (1 - r.size)
    let S = 1 / vs
    let tx = -qx * (1 - vs) * w * S
    let ty = -qy * (1 - vs) * h * S
    for (let j = 0; j < 3; j++) {
      const node = slots.current.get(wrap(k + j))
      if (node && (j < 2 || N > 2)) {
        node.style.transform = `translate(${tx}px, ${ty}px) scale(${S})`
        node.style.opacity = String(j === 0 ? 1 : j === 1 ? smooth(0.15, 0.7, t) : 0)
        node.style.visibility = j === 2 ? 'hidden' : 'visible'
      }
      const inner = rectOf(k + j)
      tx += S * inner.x * w
      ty += S * inner.y * h
      S *= inner.size
    }
    if (scrub.current) {
      scrub.current.value = String(depth)
      const at = scenes[wrap(k)]?.props.label
      const to = scenes[wrap(k + 1)]?.props.label
      scrub.current.setAttribute('aria-valuetext', t < 0.02 ? at : `${Math.round(t * 100)}% from ${at} to ${to}`)
    }
    if (readout.current) {
      let m = 1
      for (let i = 0; i < k; i++) m /= rectOf(i).size
      readout.current.textContent = `×${compact(m / vs)}`
    }
    setScene(wrap(k))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N, children])

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const measure = () => {
      cam.current.w = node.clientWidth
      cam.current.h = node.clientHeight
      apply()
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [apply])

  useLayoutEffect(apply, [scene, apply])

  useEffect(() => {
    if (reduced) setPlaying(false)
  }, [reduced])

  // The loop runs only while there is somewhere to go, on screen, in a visible tab.
  useEffect(() => {
    let raf = 0
    let last = 0
    let visible = true
    const step = (now: number) => {
      raf = 0
      const c = cam.current
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      if (live && !paused) c.target += speed * dt
      if (paused) c.target = c.depth
      c.depth = reduced ? c.target : c.depth + (c.target - c.depth) * (1 - Math.exp(-dt * 9))
      if (Math.abs(c.target - c.depth) < 1e-4) c.depth = c.target
      // Wrap by whole loops: the same as dividing out the cumulative scale.
      const loops = Math.floor(c.depth / N) * N
      c.depth -= loops
      c.target -= loops
      apply()
      if (visible && !document.hidden && (live || c.depth !== c.target)) raf = requestAnimationFrame(step)
      else last = 0
    }
    wake.current = () => {
      if (!raf && visible && N) raf = requestAnimationFrame(step)
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            wake.current()
          })
    if (frame.current) observer?.observe(frame.current)
    const onVisibility = () => wake.current()
    document.addEventListener('visibilitychange', onVisibility)
    wake.current()
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wake.current = () => {}
    }
  }, [live, paused, reduced, speed, apply, N])

  const go = (delta: number, takeOver = true) => {
    if (paused) return
    const c = cam.current
    c.target = reduced ? Math.round(c.target) + Math.sign(delta) : c.target + delta
    if (takeOver) setPlaying(false)
    wake.current()
  }
  const goTo = (index: number) => {
    const c = cam.current
    // The nearest copy of that scene, in or out.
    const delta = ((((index - c.target) % N) + N * 1.5) % N) - N / 2
    c.target += delta
    setPlaying(false)
    wake.current()
  }

  useEffect(() => {
    const node = frame.current
    if (!node) return
    let cooldown = 0
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const px = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      if (!reduced) return go(-px / 520)
      if (performance.now() < cooldown || Math.abs(px) < 4) return
      cooldown = performance.now() + 450
      go(-Math.sign(px))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  })

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current
    const before = map.get(event.pointerId)
    if (!before) return
    const points = [...map.values()]
    if (map.size === 2) {
      const [a, b] = points
      const other = a === before ? b : a
      const was = Math.hypot(before.x - other.x, before.y - other.y)
      const now = Math.hypot(event.clientX - other.x, event.clientY - other.y)
      if (was > 0 && now > 0) go(Math.log(now / was) / -Math.log(rectOf(Math.floor(cam.current.depth)).size))
    } else go((before.y - event.clientY) / 240)
    map.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => pointers.current.delete(event.pointerId)

  const onKeyDown = (event: KeyboardEvent) => {
    const c = cam.current
    if (event.key === '+' || event.key === '=') go(0.25)
    else if (event.key === '-' || event.key === '_') go(-0.25)
    else if (event.key === 'PageDown') go(Math.floor(c.target) + 1 - c.target || 1)
    else if (event.key === 'PageUp') go(Math.ceil(c.target) - 1 - c.target || -1)
    else if (event.key === 'Home') goTo(0)
    else if (event.key === ' ' && !reduced) setPlaying((p) => !p)
    else return
    event.preventDefault()
  }

  const mounted = N ? [...new Set([scene, wrap(scene + 1), wrap(scene + 2)])] : []
  const current = scenes[scene]?.props

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div
        ref={frame}
        tabIndex={0}
        role="group"
        aria-roledescription="zoomable scene"
        aria-label={label}
        aria-describedby={`${idBase}-hint`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative isolate min-h-0 flex-1 touch-none select-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-sunken"
      >
        <span id={`${idBase}-hint`} className="sr-only">
          Scroll, drag up or down, pinch, or press plus and minus to zoom. Page Down goes to the next scene.
          {reduced ? '' : ' Space starts or stops the dive.'}
        </span>
        {mounted.map((index) => (
          <div
            key={index}
            ref={(node) => {
              if (node) slots.current.set(index, node)
              else slots.current.delete(index)
            }}
            aria-hidden={index !== scene || undefined}
            className="absolute inset-0 origin-top-left"
          >
            {scenes[index]}
          </div>
        ))}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: 'inset 0 0 80px color-mix(in oklab, black 30%, transparent)' }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[color-mix(in_oklab,black_55%,transparent)] to-transparent p-4 pt-10 text-white">
          <div aria-live="polite" className="min-w-0">
            <p className="truncate text-base font-bold leading-tight">{current?.label}</p>
            {current?.caption && <p className="truncate text-xs font-medium opacity-80">{current.caption}</p>}
          </div>
          <span ref={readout} className="font-mono text-xs tabular-nums opacity-80" aria-hidden="true" />
        </div>
      </div>
      {controls && N > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {!reduced && (
              <IconButton
                icon={playing ? PauseIcon : PlayIcon}
                label={playing ? 'Stop the dive' : 'Dive'}
                tone="muted"
                size="sm"
                onClick={() => setPlaying((p) => !p)}
              />
            )}
            <IconButton icon={MinusIcon} label={reduced ? 'Previous scene' : 'Zoom out'} tone="muted" size="sm" onClick={() => go(reduced ? -1 : -0.5)} />
            <IconButton icon={PlusIcon} label={reduced ? 'Next scene' : 'Zoom in'} tone="muted" size="sm" onClick={() => go(reduced ? 1 : 0.5)} />
            <input
              ref={scrub}
              type="range"
              min={0}
              max={N}
              step={reduced ? 1 : 0.001}
              defaultValue={0}
              aria-label="Depth"
              onChange={(event) => {
                const c = cam.current
                c.depth = c.target = Math.min(N - 1e-6, Number(event.target.value))
                setPlaying(false)
                wake.current()
              }}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--color-accent-strong)]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Scenes">
            {scenes.map((s, index) => (
              <button
                key={index}
                type="button"
                aria-current={index === scene || undefined}
                onClick={() => goTo(index)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                  index === scene ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:text-ink',
                )}
              >
                {s.props.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
