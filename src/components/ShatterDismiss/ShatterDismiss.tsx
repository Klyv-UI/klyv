'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { usePrefersReducedMotion } from '../../lib/motion'
import { IconButton } from '../IconButton'
import { CrossIcon } from '../internal/icons'
import { fractureRect, simulateShards, SHATTER_FPS, type ShatterDismissTrajectory } from './fracture'

/** A point in viewport (client) pixels — `event.clientX` / `event.clientY`. */
export interface ShatterDismissPoint {
  x: number
  y: number
}

export interface ShatterDismissHandle {
  /** Fracture the element, from `point` (client pixels) or its centre. */
  shatter: (point?: ShatterDismissPoint) => void
  /** Fly the shards back together and return the real element. */
  restore: () => void
}

export interface ShatterDismissProps {
  /** The content that shatters. It stays mounted while dismissed, so its state survives an undo. */
  children: ReactNode
  /** Controlled dismissed state. `false` after `true` plays the undo. */
  shattered?: boolean
  /** Uncontrolled starting state. */
  defaultShattered?: boolean
  /** Called when the close button, `shatter()` or `restore()` asks for a change. */
  onShatteredChange?: (shattered: boolean) => void
  /** Fires once the last shard has faded. */
  onShattered?: () => void
  /** Fires once the real element is back. */
  onRestored?: () => void
  /** Roughly how many shards. */
  shards?: number
  /** Multiplies the blast. */
  force?: number
  /** Multiplies gravity. */
  gravity?: number
  /** Pixels below the element where shards land and bounce; `false` lets them fall away. */
  floor?: number | false
  /** Hairline highlights on the shard edges, like cut glass. */
  edges?: boolean
  /** Close the gap the element leaves, and reopen it before an undo. */
  collapse?: boolean
  /** Show the built-in close button in the top-right corner. */
  closeButton?: boolean
  /** Accessible name of the close button. */
  closeLabel?: string
  /** Where focus goes when the element is dismissed while it holds focus. */
  focusTarget?: RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined)
  /** Announced politely on dismissal. */
  announcement?: string
  /** Announced politely once restored. */
  restoredAnnouncement?: string
  /** Classes for the outer wrapper. */
  className?: string
  /** Classes for the element that shatters. */
  contentClassName?: string
}

type Phase = 'idle' | 'shattering' | 'shattered' | 'restoring'

interface Flight {
  overlay: HTMLDivElement
  nodes: HTMLDivElement[]
  trajectory: ShatterDismissTrajectory
  left: number
  top: number
}

const INHERITED = ['color', 'font', 'line-height', 'letter-spacing', 'text-align', 'direction', 'text-transform', 'color-scheme', 'font-feature-settings', 'font-variation-settings'] as const

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const COLLAPSE_MS = 300

/** A detached copy of the live element: no ids or names to collide with, canvases repainted, values kept. */
function cloneLive(content: HTMLElement, width: number, height: number): HTMLElement {
  const clone = content.cloneNode(true) as HTMLElement
  for (const node of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]) {
    node.removeAttribute('id')
    node.removeAttribute('name')
    node.removeAttribute('autofocus')
  }
  const sourceCanvases = content.querySelectorAll('canvas')
  clone.querySelectorAll('canvas').forEach((canvas, index) => {
    const source = sourceCanvases[index]
    if (source && source.width && source.height) canvas.getContext('2d')?.drawImage(source, 0, 0)
  })
  const sourceSelects = content.querySelectorAll('select')
  clone.querySelectorAll('select').forEach((select, index) => (select.selectedIndex = sourceSelects[index]?.selectedIndex ?? 0))
  Object.assign(clone.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    margin: '0',
    width: `${width}px`,
    height: `${height}px`,
    visibility: 'visible',
    opacity: '1',
    transform: 'none',
    transition: 'none',
  })
  return clone
}

/** The fixed layer the shards fly in, carrying the element’s inherited type and theme variables. */
function buildFlight(content: HTMLElement, count: number, point: ShatterDismissPoint | undefined, physics: { force: number; gravity: number; floor: number | false }, edges: boolean): Flight | null {
  const rect = content.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return null
  const ix = Math.min(rect.width, Math.max(0, (point?.x ?? rect.left + rect.width / 2) - rect.left))
  const iy = Math.min(rect.height, Math.max(0, (point?.y ?? rect.top + rect.height / 2) - rect.top))
  const cells = fractureRect(rect.width, rect.height, ix, iy, count)
  const trajectory = simulateShards(cells, rect.height, ix, iy, physics)

  const overlay = document.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('inert', '')
  const computed = getComputedStyle(content)
  for (const name of INHERITED) overlay.style.setProperty(name, computed.getPropertyValue(name))
  for (let i = 0; i < computed.length; i++) {
    const name = computed[i]
    if (name.startsWith('--')) overlay.style.setProperty(name, computed.getPropertyValue(name))
  }
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: '0',
    height: '0',
    overflow: 'visible',
    pointerEvents: 'none',
    zIndex: 'var(--z-popover)',
  })

  const nodes = cells.map((cell, index) => {
    const node = document.createElement('div')
    const polygon = []
    for (let k = 0; k < cell.points.length; k += 2) polygon.push(`${cell.points[k].toFixed(2)}px ${cell.points[k + 1].toFixed(2)}px`)
    Object.assign(node.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      clipPath: `polygon(${polygon.join(',')})`,
      transformOrigin: `${cell.cx}px ${cell.cy}px`,
      willChange: 'transform, opacity',
    })
    node.appendChild(cloneLive(content, rect.width, rect.height))
    if (edges) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', String(rect.width))
      svg.setAttribute('height', String(rect.height))
      Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible' })
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      const points = []
      for (let k = 0; k < cell.points.length; k += 2) points.push(`${cell.points[k]},${cell.points[k + 1]}`)
      shape.setAttribute('points', points.join(' '))
      // Alternate facets catch a little more or less light, so the pieces read as separate panes.
      const tint = index % 3 === 0 ? 'var(--color-ink) 5%' : index % 3 === 1 ? 'var(--color-shell) 14%' : 'var(--color-ink) 2%'
      Object.assign(shape.style, {
        fill: `color-mix(in oklab, ${tint}, transparent)`,
        stroke: 'color-mix(in oklab, var(--color-ink) 34%, transparent)',
        strokeWidth: '1.6',
        strokeLinejoin: 'round',
      })
      svg.appendChild(shape)
      node.appendChild(svg)
    }
    overlay.appendChild(node)
    return node
  })
  return { overlay, nodes, trajectory, left: rect.left, top: rect.top }
}

/** Write one moment of the recorded flight to the shard layers, interpolating between frames. */
function pose(flight: Flight, time: number) {
  const { frames, count, length } = flight.trajectory
  const position = Math.min(length - 1, Math.max(0, time * SHATTER_FPS))
  const f0 = Math.floor(position)
  const f1 = Math.min(length - 1, f0 + 1)
  const t = position - f0
  for (let i = 0; i < count; i++) {
    const a = (f0 * count + i) * 4
    const b = (f1 * count + i) * 4
    const x = frames[a] + (frames[b] - frames[a]) * t
    const y = frames[a + 1] + (frames[b + 1] - frames[a + 1]) * t
    const angle = frames[a + 2] + (frames[b + 2] - frames[a + 2]) * t
    const opacity = frames[a + 3] + (frames[b + 3] - frames[a + 3]) * t
    const style = flight.nodes[i].style
    style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${angle.toFixed(4)}rad)`
    style.opacity = opacity.toFixed(3)
  }
}

/**
 * Dismisses content by breaking it like a pane of glass, and puts it back together on undo.
 *
 * The shards are the live element itself: it is cloned once per Voronoi cell and each clone
 * is clipped to its polygon, so whatever was on screen — typed values, a canvas, a chart —
 * is what breaks. Seeds crowd the impact point, which gives fine splinters where it was
 * struck and broad panes at the far edges, the one detail that makes it read as glass.
 *
 * The whole flight is simulated before the first frame and recorded, so undo plays the
 * same frames backwards and every shard retraces its own path home. The original stays
 * mounted underneath with `visibility: hidden` (out of the tab order and the accessibility
 * tree), which is why its state survives the round trip. Reduced motion swaps the shards
 * for a short fade.
 */
export const ShatterDismiss = forwardRef<ShatterDismissHandle, ShatterDismissProps>(function ShatterDismiss(
  {
    children,
    shattered: shatteredProp,
    defaultShattered = false,
    onShatteredChange,
    onShattered,
    onRestored,
    shards = 28,
    force = 1,
    gravity = 1,
    floor = false,
    edges = true,
    collapse = false,
    closeButton = true,
    closeLabel = 'Dismiss',
    focusTarget,
    announcement = 'Dismissed. Undo available.',
    restoredAnnouncement = 'Restored.',
    className,
    contentClassName,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const [internal, setInternal] = useState(defaultShattered)
  const shattered = shatteredProp ?? internal
  const [initiallyHidden] = useState(shattered)
  const [message, setMessage] = useState('')

  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const phase = useRef<Phase>(shattered ? 'shattered' : 'idle')
  const flight = useRef<Flight | null>(null)
  const frame = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const point = useRef<ShatterDismissPoint>()
  const playhead = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const latest = useRef({ onShattered, onRestored, onShatteredChange, shards, force, gravity, floor, edges, collapse, focusTarget, announcement, restoredAnnouncement, reduced })
  latest.current = { onShattered, onRestored, onShatteredChange, shards, force, gravity, floor, edges, collapse, focusTarget, announcement, restoredAnnouncement, reduced }

  const request = useCallback(
    (next: boolean, at?: ShatterDismissPoint) => {
      point.current = at
      if (shatteredProp === undefined) setInternal(next)
      latest.current.onShatteredChange?.(next)
    },
    [shatteredProp],
  )

  useImperativeHandle(ref, () => ({ shatter: (at) => request(true, at), restore: () => request(false) }), [request])

  const announce = (text: string) => {
    setMessage('')
    requestAnimationFrame(() => setMessage(text))
  }

  const setCollapsed = (collapsed: boolean) => {
    const wrapper = wrapperRef.current
    if (!wrapper || !latest.current.collapse) return
    wrapper.style.gridTemplateRows = collapsed ? '0fr' : '1fr'
  }

  const stop = () => {
    cancelAnimationFrame(frame.current)
    clearTimeout(timer.current)
  }

  const play = (direction: 1 | -1) => {
    const current = flight.current
    if (!current) return
    const from = playhead.current
    const reverseFor = Math.min(0.85, Math.max(0.5, from * 0.55))
    let started = 0
    let last = 0
    const tick = (now: number) => {
      if (!started) started = last = now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (direction === 1) {
        playhead.current = Math.min(current.trajectory.duration, playhead.current + dt)
      } else {
        const progress = Math.min(1, (now - started) / 1000 / reverseFor)
        playhead.current = from * (1 - ease(progress))
      }
      pose(current, playhead.current)
      const done = direction === 1 ? playhead.current >= current.trajectory.duration : playhead.current <= 0
      if (!done) {
        frame.current = requestAnimationFrame(tick)
        return
      }
      if (direction === 1) {
        current.overlay.remove()
        phase.current = 'shattered'
        latest.current.onShattered?.()
      } else {
        finishRestore()
      }
    }
    frame.current = requestAnimationFrame(tick)
  }

  const finishRestore = () => {
    const content = contentRef.current
    flight.current?.overlay.remove()
    flight.current = null
    phase.current = 'idle'
    if (content) {
      content.style.visibility = ''
      content.style.opacity = ''
      content.style.transform = ''
      content.style.transition = ''
    }
    const wrapper = wrapperRef.current
    if (wrapper) wrapper.style.overflow = ''
    const back = returnFocus.current
    returnFocus.current = null
    if (back && back.isConnected && (document.activeElement === document.body || !document.activeElement)) back.focus({ preventScroll: true })
    announce(latest.current.restoredAnnouncement)
    latest.current.onRestored?.()
  }

  const runShatter = () => {
    const content = contentRef.current
    const wrapper = wrapperRef.current
    if (!content || !wrapper) return
    const options = latest.current
    stop()
    const active = document.activeElement as HTMLElement | null
    const hadFocus = !!active && content.contains(active)

    if (phase.current === 'restoring' && flight.current && !options.reduced) {
      // Undo interrupted: send the same shards back out from where they are.
      phase.current = 'shattering'
      play(1)
    } else if (options.reduced) {
      phase.current = 'shattering'
      content.style.transition = 'opacity 180ms ease, transform 180ms ease'
      content.style.opacity = '0'
      content.style.transform = 'scale(0.97)'
      timer.current = setTimeout(() => {
        content.style.visibility = 'hidden'
        phase.current = 'shattered'
        options.onShattered?.()
      }, 190)
    } else {
      flight.current?.overlay.remove()
      const next = buildFlight(content, Math.max(3, Math.round(options.shards)), point.current, options, options.edges)
      flight.current = next
      phase.current = 'shattering'
      content.style.visibility = 'hidden'
      if (next) {
        document.body.appendChild(next.overlay)
        playhead.current = 0
        pose(next, 0)
        play(1)
      } else {
        phase.current = 'shattered'
        options.onShattered?.()
      }
    }

    wrapper.style.overflow = options.collapse ? 'hidden' : ''
    if (options.collapse) timer.current = setTimeout(() => setCollapsed(true), options.reduced ? 200 : 180)
    if (hadFocus) {
      returnFocus.current = active
      const target = typeof options.focusTarget === 'function' ? options.focusTarget() : options.focusTarget?.current
      target?.focus({ preventScroll: true })
    }
    announce(options.announcement)
  }

  const runRestore = () => {
    const content = contentRef.current
    if (!content) return
    const options = latest.current
    stop()
    phase.current = 'restoring'
    const reopen = options.collapse && wrapperRef.current?.style.gridTemplateRows === '0fr'
    setCollapsed(false)
    const begin = () => {
      const current = flight.current
      if (options.reduced || !current) {
        content.style.visibility = ''
        content.style.transition = 'opacity 200ms ease, transform 200ms ease'
        content.style.opacity = '0'
        content.style.transform = 'scale(0.97)'
        requestAnimationFrame(() => {
          content.style.opacity = '1'
          content.style.transform = 'none'
        })
        timer.current = setTimeout(finishRestore, 210)
        return
      }
      // The page may have scrolled or reflowed since: land the shards where the element is now.
      const rect = content.getBoundingClientRect()
      current.overlay.style.left = `${rect.left}px`
      current.overlay.style.top = `${rect.top}px`
      if (!current.overlay.isConnected) document.body.appendChild(current.overlay)
      pose(current, playhead.current)
      play(-1)
    }
    if (reopen) timer.current = setTimeout(begin, COLLAPSE_MS)
    else begin()
  }

  useIsomorphicLayoutEffect(() => {
    const busy = phase.current === 'shattering' || phase.current === 'shattered'
    if (shattered && !busy) runShatter()
    if (!shattered && busy) runRestore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shattered])

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      clearTimeout(timer.current)
      flight.current?.overlay.remove()
    },
    [],
  )

  return (
    <div
      ref={wrapperRef}
      className={cn('grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none', className)}
      style={{ gridTemplateRows: initiallyHidden && collapse ? '0fr' : '1fr' }}
    >
      <div
        ref={contentRef}
        className={cn('relative min-h-0', contentClassName)}
        style={initiallyHidden ? { visibility: 'hidden' } : undefined}
      >
        {children}
        {closeButton ? (
          <IconButton
            icon={CrossIcon}
            label={closeLabel}
            tone="bare"
            size="xs"
            className="absolute right-2 top-2"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect()
              request(true, { x: box.left + box.width / 2, y: box.top + box.height / 2 })
            }}
          />
        ) : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  )
})
