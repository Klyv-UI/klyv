'use client'

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface ParallaxPortalLayerProps {
  /** Distance behind the frame in px. Negative comes out in front of it, past the frame edge. */
  depth: number
  /** Horizontal position of the anchor, 0 (left edge) to 1 (right edge). */
  x?: number
  /** Vertical position of the anchor, 0 (top) to 1 (floor). */
  y?: number
  /** Which point of the layer sits on (x, y). `bottom` stands it on the floor. */
  anchor?: 'bottom' | 'center' | 'top'
  /** The prop itself. */
  children: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

export interface ParallaxPortalWalls {
  back?: ReactNode
  floor?: ReactNode
  ceiling?: ReactNode
  left?: ReactNode
  right?: ReactNode
}

export interface ParallaxPortalProps {
  /** Accessible name of the view. */
  label: string
  /** `ParallaxPortalLayer`s, placed in the room by their `depth`. */
  children?: ReactNode
  /** What is painted on each surface of the room. Any surface left out gets a lined panel. */
  walls?: ParallaxPortalWalls
  /** How deep the room goes behind the frame, px. */
  depth?: number
  /** Distance from the eye to the frame, px. Smaller exaggerates depth. */
  perspective?: number
  /** How far the eye may travel, as a fraction of half the frame. */
  intensity?: number
  /** Drift slowly on its own while nobody is pointing at it. */
  idle?: boolean
  /** Offer a button to steer with the phone’s tilt, where the device has one. */
  tilt?: boolean
  /** Hold the view still. */
  paused?: boolean
  /** Merged last, so it wins. Give it a height. */
  className?: string
}

/** A prop in the room. Only means something as a child of `ParallaxPortal`. */
export function ParallaxPortalLayer({ depth, x = 0.5, y = 1, anchor = 'bottom', children, className }: ParallaxPortalLayerProps) {
  const shift = anchor === 'bottom' ? '-100%' : anchor === 'top' ? '0%' : '-50%'
  return (
    <div
      className={cn('absolute', className)}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate3d(-50%, ${shift}, ${-depth}px)` }}
    >
      {children}
    </div>
  )
}

const LINES =
  'repeating-linear-gradient(90deg, var(--color-line) 0 1px, transparent 1px 48px), repeating-linear-gradient(0deg, var(--color-line) 0 1px, transparent 1px 48px)'

function Panel({ children, shade }: { children?: ReactNode; shade: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: children ? undefined : `${LINES}, var(--color-surface-muted)` }}>
      {children}
      <div className="pointer-events-none absolute inset-0" style={{ background: shade }} />
    </div>
  )
}

/**
 * A frame that is a window into a room behind the screen.
 *
 * The trick is off-axis projection. The room is ordinary CSS 3D — walls,
 * floor and ceiling meeting a back wall at `depth` — and the pointer moves
 * `perspective-origin`, not the room. Moving the eye point leaves the plane of
 * the frame fixed while everything behind it shears towards a new vanishing
 * point, which is exactly what a real window does when you lean. Rotating the
 * room instead, as a tilt card would, turns the frame too and the illusion
 * collapses.
 *
 * Layers with a negative depth live in a second, unclipped stage with the same
 * eye point, so they can come through the glass and past the frame edge.
 * The eye eases towards its target and the loop sleeps once it arrives, while
 * off screen, or while the tab is hidden.
 */
export function ParallaxPortal({
  label,
  children,
  walls = {},
  depth = 520,
  perspective = 760,
  intensity = 0.7,
  idle = true,
  tilt = true,
  paused = false,
  className,
}: ParallaxPortalProps) {
  const reduced = usePrefersReducedMotion()
  const hintId = useId()
  const root = useRef<HTMLDivElement>(null)
  const stages = useRef<(HTMLDivElement | null)[]>([])
  const glare = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0, source: 'none' as 'none' | 'pointer' | 'keys' | 'tilt' })
  const eye = useRef({ x: 0, y: 0 })
  const wake = useRef<() => void>(() => {})
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [canTilt, setCanTilt] = useState(false)
  const [tilting, setTilting] = useState<'off' | 'on' | 'denied'>('off')
  const still = reduced || paused

  useEffect(() => {
    const node = root.current
    if (!node) return
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setCanTilt(tilt && typeof DeviceOrientationEvent !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  }, [tilt])

  // One loop: ease the eye toward its target, write two style properties, sleep when settled.
  useEffect(() => {
    const apply = () => {
      const origin = `${50 + eye.current.x * intensity * 50}% ${50 + eye.current.y * intensity * 50}%`
      for (const stage of stages.current) if (stage) stage.style.perspectiveOrigin = origin
      if (glare.current) glare.current.style.transform = `translate3d(${-eye.current.x * 18}%, ${-eye.current.y * 12}%, 0)`
    }
    if (still) {
      eye.current = { x: 0, y: 0 }
      apply()
      return
    }
    let raf = 0
    let last = 0
    let visible = true
    const drifting = () => idle && target.current.source === 'none'
    const step = (now: number) => {
      raf = 0
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      if (drifting()) {
        const t = now / 1000
        target.current.x = Math.sin(t * 0.31) * 0.55
        target.current.y = Math.sin(t * 0.23 + 1) * 0.3
      }
      const k = 1 - Math.exp(-dt * 6)
      const dx = target.current.x - eye.current.x
      const dy = target.current.y - eye.current.y
      eye.current = { x: eye.current.x + dx * k, y: eye.current.y + dy * k }
      apply()
      if (visible && !document.hidden && (drifting() || Math.abs(dx) + Math.abs(dy) > 0.0005)) {
        raf = requestAnimationFrame(step)
      } else last = 0
    }
    wake.current = () => {
      if (!raf && visible) raf = requestAnimationFrame(step)
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            wake.current()
          })
    if (root.current) observer?.observe(root.current)
    const onVisibility = () => wake.current()
    document.addEventListener('visibilitychange', onVisibility)
    wake.current()
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wake.current = () => {}
    }
  }, [still, idle, intensity])

  const aim = (x: number, y: number, source: 'pointer' | 'keys' | 'tilt') => {
    target.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), source }
    wake.current()
  }
  const release = () => {
    target.current = { x: 0, y: 0, source: 'none' }
    wake.current()
  }

  useEffect(() => {
    if (tilting !== 'on' || still) return
    let base: { beta: number; gamma: number } | null = null
    const onOrient = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return
      base ??= { beta: event.beta, gamma: event.gamma }
      aim((event.gamma - base.gamma) / 25, (event.beta - base.beta) / 25, 'tilt')
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [tilting, still])

  const enableTilt = async () => {
    const request = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
    try {
      const answer = request ? await request() : 'granted'
      setTilting(answer === 'granted' ? 'on' : 'denied')
    } catch {
      setTilting('denied')
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.25], ArrowDown: [0, 0.25] }
    if (event.key in steps) {
      const from = target.current.source === 'keys' ? target.current : eye.current
      aim(from.x + steps[event.key][0], from.y + steps[event.key][1], 'keys')
    } else if (event.key === 'Escape' || event.key === 'Home') release()
    else return
    event.preventDefault()
  }

  const inside: ReactElement[] = []
  const outside: ReactElement[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement<{ depth?: number }>(child)) return
    ;((child.props.depth ?? 0) < 0 ? outside : inside).push(child)
  })

  const { w, h } = size
  const R = depth
  const plane = (o: [number, number, number], ex: [number, number, number], ey: [number, number, number]) => {
    const n = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]]
    return `matrix3d(${[...ex, 0, ...ey, 0, ...n, 0, ...o, 1].join(',')})`
  }
  const surfaces: { key: keyof ParallaxPortalWalls; style: CSSProperties; shade: string }[] = [
    { key: 'back', style: { width: w, height: h, transform: plane([0, 0, -R], [1, 0, 0], [0, 1, 0]) }, shade: 'transparent' },
    {
      key: 'floor',
      style: { width: w, height: R, transform: plane([0, h, -R], [1, 0, 0], [0, 0, 1]) },
      shade: 'linear-gradient(to bottom, color-mix(in oklab, black 22%, transparent), transparent 70%)',
    },
    {
      key: 'ceiling',
      style: { width: w, height: R, transform: plane([0, 0, 0], [1, 0, 0], [0, 0, -1]) },
      shade: 'linear-gradient(to top, color-mix(in oklab, black 26%, transparent), color-mix(in oklab, black 8%, transparent))',
    },
    {
      key: 'left',
      style: { width: R, height: h, transform: plane([0, 0, 0], [0, 0, -1], [0, 1, 0]) },
      shade: 'linear-gradient(to left, color-mix(in oklab, black 16%, transparent), color-mix(in oklab, black 4%, transparent))',
    },
    {
      key: 'right',
      style: { width: R, height: h, transform: plane([w, 0, -R], [0, 0, 1], [0, 1, 0]) },
      shade: 'linear-gradient(to right, color-mix(in oklab, black 16%, transparent), color-mix(in oklab, black 4%, transparent))',
    },
  ]
  const stageStyle: CSSProperties = { perspective, perspectiveOrigin: '50% 50%' }

  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      aria-describedby={hintId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={(event) => {
        if (still || (event.pointerType === 'touch' && tilting === 'on')) return
        const box = event.currentTarget.getBoundingClientRect()
        aim(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1, 'pointer')
      }}
      onPointerLeave={() => target.current.source === 'pointer' && release()}
      onBlur={() => target.current.source === 'keys' && release()}
      className={cn('relative isolate h-80 w-full touch-pan-y rounded-[var(--radius-card)]', className)}
    >
      <span id={hintId} className="sr-only">
        A room seen through the frame. Move the pointer over it, or use the arrow keys, to look around; Escape recentres.
      </span>
      <div
        className="absolute inset-0 overflow-hidden rounded-[inherit] border border-line bg-surface-sunken"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div
          ref={(node) => {
            stages.current[0] = node
          }}
          className="absolute inset-0"
          style={stageStyle}
        >
          <div className="absolute inset-0 [transform-style:preserve-3d]">
            {w > 0 &&
              surfaces.map(({ key, style, shade }) => (
                <div key={key} aria-hidden="true" className="absolute left-0 top-0 origin-top-left" style={style}>
                  <Panel shade={shade}>{walls[key]}</Panel>
                </div>
              ))}
            {w > 0 && inside}
          </div>
        </div>
        {/* The glass: an inner rim and a sheen that slides against the eye. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ boxShadow: 'inset 0 0 0 1px color-mix(in oklab, white 12%, transparent), inset 0 0 60px color-mix(in oklab, black 28%, transparent)' }}
        />
        <div
          ref={glare}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1/4 opacity-60 mix-blend-soft-light"
          style={{ background: 'linear-gradient(115deg, transparent 38%, color-mix(in oklab, white 40%, transparent) 48%, transparent 58%)' }}
        />
      </div>
      <div
        ref={(node) => {
          stages.current[1] = node
        }}
        className="pointer-events-none absolute inset-0"
        style={stageStyle}
      >
        <div className="absolute inset-0 [transform-style:preserve-3d]">{w > 0 && outside}</div>
      </div>
      {canTilt && !still && tilting !== 'on' && (
        <button
          type="button"
          onClick={enableTilt}
          className="absolute bottom-3 right-3 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-[var(--shadow-float)]"
        >
          {tilting === 'denied' ? 'Motion access was refused' : 'Look around by tilting'}
        </button>
      )}
    </div>
  )
}
