'use client'

import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '../../lib/cn'
import { tokenRgb, useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { Switch } from '../Switch'
import { ToggleGroup } from '../ToggleGroup'
import {
  alignFilings,
  BAR_ASPECT,
  boundsFor,
  buildSources,
  createFilings,
  DEFAULT_LENGTH,
  DISC_SCALE,
  forceBetween,
  neutralPoints,
  scatterFilings,
  stepFilings,
  strengthGrid,
  traceFieldLines,
  type FieldBounds,
  type FieldSource,
  type IronFilingsMagnet,
  type MagnetBody,
  type Vec,
} from './field'

export type { IronFilingsMagnet, IronFilingsPoles } from './field'

export type IronFilingsTone = 'ink' | 'accent'

export interface IronFilingsHandle {
  /** Scatter the filings at random, as tapping the card does, and let them turn to the field again. */
  shake: () => void
}

export interface IronFilingsProps {
  /** Controlled magnets. Positions are fractions of the frame, so they survive a resize. */
  magnets?: IronFilingsMagnet[]
  /** Magnets for uncontrolled use. Defaults to two bars with their north ends facing, which shows a neutral point. */
  defaultMagnets?: IronFilingsMagnet[]
  /** Called with the new magnets whenever one is dragged, turned or moved with the keyboard. */
  onMagnetsChange?: (magnets: IronFilingsMagnet[]) => void
  /** Number of filings. 2,000–5,000 reads best; capped at 12,000. */
  filings?: number
  /** Draw the filings. The built-in toggles change it locally; a new prop value wins. */
  showFilings?: boolean
  /** Draw field lines traced from the poles. The built-in toggles change it locally; a new prop value wins. */
  showFieldLines?: boolean
  /** Shade the frame by field strength. The built-in toggles change it locally; a new prop value wins. */
  showStrength?: boolean
  /** Magnets can be dragged, turned and moved with the keyboard. Off, they are part of the picture. */
  interactive?: boolean
  /** Filing colour: the ink token or the accent. */
  tone?: IronFilingsTone
  /** Freeze the filings where they are. Magnets still move, and lines and shading still follow them. */
  paused?: boolean
  /** Width over height of the frame. */
  aspectRatio?: number
  /** Accessible name of the picture. Without it the canvas is decorative and hidden. */
  label?: string
  /** Show the layer toggles, the pause switch and the shake button. */
  controls?: boolean
  /** Merged last, so it wins. */
  className?: string
}

type Layer = 'filings' | 'lines' | 'strength'

const DEFAULT_MAGNETS: IronFilingsMagnet[] = [
  { id: 'left', x: 0.28, y: 0.5, angle: 0 },
  { id: 'right', x: 0.72, y: 0.5, angle: 180 },
]

const LAYER_ITEMS: { value: Layer; label: string }[] = [
  { value: 'filings', label: 'Filings' },
  { value: 'lines', label: 'Field lines' },
  { value: 'strength', label: 'Strength' },
]

/** Resolution of the strength shading, in cells per unit of field space. It is smoothed when scaled up. */
const SHADE_RESOLUTION = 64

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const wrapDegrees = (degrees: number) => ((Math.round(degrees) % 360) + 360) % 360
const percent = (value: number) => `${Math.round(value * 100)}%`

const DIRECTIONS = ['right', 'down and right', 'down', 'down and left', 'left', 'up and left', 'up', 'up and right']
/** The angle as a direction on screen; angles run clockwise because screen y points down. */
const pointing = (degrees: number) => DIRECTIONS[Math.round(wrapDegrees(degrees) / 45) % 8]!

const nameOf = (magnet: IronFilingsMagnet, index: number) => magnet.label ?? `Magnet ${index + 1}`

/**
 * Iron filings on a card over real magnets.
 *
 * Nothing draws the pattern. Each of a few thousand filings has a position, an
 * angle and an angular velocity; every frame it feels the torque of the field
 * where it lies and turns towards it, overshooting a little and settling, and
 * drifts slowly up the gradient of |B| after the card is disturbed — which is why
 * filings bunch at the poles. The field is the sum of the magnets’ poles, a bar
 * being two opposite point poles near its ends (see `field.ts` for why that
 * model and not a point dipole), so two magnets show attraction and repulsion,
 * and between two like poles the filings lie in every direction at the neutral
 * point where the fields cancel. It is marked, and announced.
 *
 * Field lines are traced separately by fourth-order Runge–Kutta from rings round
 * each pole, and the strength shading is |B| on a coarse grid; both are rebuilt
 * only when a magnet moves. Magnets are real buttons: drag to move, drag the grip
 * to turn, or use the arrow keys, [ and ]. Reduced motion draws every filing
 * already aligned and re-aligns them the instant a magnet moves.
 */
export const IronFilings = forwardRef<IronFilingsHandle, IronFilingsProps>(function IronFilings(
  {
    magnets: controlled,
    defaultMagnets = DEFAULT_MAGNETS,
    onMagnetsChange,
    filings = 3200,
    showFilings = true,
    showFieldLines = false,
    showStrength = false,
    interactive = true,
    tone = 'ink',
    paused = false,
    aspectRatio = 16 / 10,
    label,
    controls = true,
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const hintId = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultMagnets)
  const magnets = controlled ?? uncontrolled
  const [layers, setLayers] = useState<Layer[]>(() => layersFrom(showFilings, showFieldLines, showStrength))
  const [pausedHere, setPausedHere] = useState(false)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [announcement, setAnnouncement] = useState('')
  const [lastMoved, setLastMoved] = useState<string | null>(null)
  const frozen = paused || pausedHere

  useEffect(() => setLayers(layersFrom(showFilings, showFieldLines, showStrength)), [showFilings, showFieldLines, showStrength])

  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ id: string; mode: 'move' | 'turn'; dx: number; dy: number } | null>(null)
  const sim = useRef({
    set: createFilings(0),
    sources: [] as FieldSource[],
    bodies: [] as MagnetBody[],
    bounds: { width: 1, height: 1 } as FieldBounds,
    lines: [] as Float32Array[],
    neutral: [] as Vec[],
    shade: null as HTMLCanvasElement | null,
    grid: null as Float32Array | null,
    gridSize: { cols: 0, rows: 0 },
    colours: { filing: [40, 40, 40], line: [90, 90, 90], accent: [120, 160, 60] } as Record<'filing' | 'line' | 'accent', [number, number, number]>,
    agitation: 0.3,
    spin: 1,
    seed: 0x2545f491,
    ratio: 1,
    frame: 0,
    tick: 0,
    running: false,
    visible: true,
    scattered: false,
  })
  const live = useRef({ magnets, layers, frozen, reduced })
  live.current = { magnets, layers, frozen, reduced }

  const commit = useCallback(
    (next: IronFilingsMagnet[]) => {
      if (controlled === undefined) setUncontrolled(next)
      onMagnetsChange?.(next)
    },
    [controlled, onMagnetsChange],
  )

  const random = () => {
    const s = sim.current
    s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0
    return s.seed / 4294967296
  }

  /* ------------------------------------------------------------ drawing */

  const paintShade = useCallback(() => {
    const s = sim.current
    const { grid } = s
    const { cols, rows } = s.gridSize
    if (!grid || !cols || !rows) return
    const shade = s.shade ?? document.createElement('canvas')
    s.shade = shade
    if (shade.width !== cols || shade.height !== rows) {
      shade.width = cols
      shade.height = rows
    }
    const context = shade.getContext('2d')
    if (!context) return
    const image = context.createImageData(cols, rows)
    const [r, g, b] = s.colours.accent
    for (let k = 0; k < grid.length; k++) {
      const o = k * 4
      image.data[o] = r
      image.data[o + 1] = g
      image.data[o + 2] = b
      image.data[o + 3] = grid[k]! * 150
    }
    context.putImageData(image, 0, 0)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !canvas.width || !canvas.height) return
    const s = sim.current
    const shown = live.current.layers
    const side = Math.min(canvas.width, canvas.height)
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)

    if (shown.includes('strength') && s.shade) {
      context.imageSmoothingEnabled = true
      context.drawImage(s.shade, 0, 0, canvas.width, canvas.height)
    }

    if (shown.includes('lines') && s.lines.length) {
      const [r, g, b] = s.colours.line
      context.strokeStyle = `rgba(${r},${g},${b},0.55)`
      context.lineWidth = 1.1 * s.ratio
      context.lineJoin = 'round'
      context.beginPath()
      for (const line of s.lines) {
        context.moveTo(line[0]! * side, line[1]! * side)
        for (let k = 2; k < line.length; k += 2) context.lineTo(line[k]! * side, line[k + 1]! * side)
      }
      context.stroke()
      // One chevron a line, at its midpoint, pointing the way the field runs: north to south.
      context.beginPath()
      const size = 4 * s.ratio
      for (const line of s.lines) {
        const points = line.length / 2
        if (points < 8) continue
        const k = Math.floor(points / 2) * 2
        const x = line[k]! * side
        const y = line[k + 1]! * side
        const angle = Math.atan2(line[k + 3]! - line[k - 1]!, line[k + 2]! - line[k - 2]!)
        context.moveTo(x - Math.cos(angle - 0.5) * size, y - Math.sin(angle - 0.5) * size)
        context.lineTo(x, y)
        context.lineTo(x - Math.cos(angle + 0.5) * size, y - Math.sin(angle + 0.5) * size)
      }
      context.stroke()
    }

    if (shown.includes('filings')) {
      const { x, y, a, b: strength } = s.set
      const half = clamp(side * 0.0075, 2.2 * s.ratio, 5.5 * s.ratio)
      const [r, g, b] = s.colours.filing
      context.lineWidth = 1.3 * s.ratio
      context.lineCap = 'round'
      // Four alpha bands, one path each: fainter where the field is weak. That is a drawing
      // choice for legibility, not physics — real filings are as dark everywhere.
      const bands = [0.34, 0.55, 0.75, 0.92]
      for (let band = 0; band < bands.length; band++) {
        context.beginPath()
        for (let i = 0; i < x.length; i++) {
          const m = strength[i]!
          const level = Math.min(3, Math.floor((m / (m + 1.2)) * 4))
          if (level !== band) continue
          const cx = x[i]! * side
          const cy = y[i]! * side
          const dx = Math.cos(a[i]!) * half
          const dy = Math.sin(a[i]!) * half
          context.moveTo(cx - dx, cy - dy)
          context.lineTo(cx + dx, cy + dy)
        }
        context.strokeStyle = `rgba(${r},${g},${b},${bands[band]})`
        context.stroke()
      }
    }

    if (s.neutral.length) {
      const [r, g, b] = s.colours.line
      context.strokeStyle = `rgba(${r},${g},${b},0.9)`
      context.lineWidth = 1.2 * s.ratio
      context.setLineDash([3 * s.ratio, 3 * s.ratio])
      for (const point of s.neutral) {
        context.beginPath()
        context.arc(point.x * side, point.y * side, 9 * s.ratio, 0, Math.PI * 2)
        context.stroke()
      }
      context.setLineDash([])
    }
  }, [])

  /* --------------------------------------------------------------- loop */

  const start = useCallback(() => {
    const s = sim.current
    if (s.running || live.current.reduced || live.current.frozen || !s.visible || document.hidden) return
    s.running = true
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const state = live.current
      s.tick++
      s.spin = stepFilings(s.set, s.sources, s.bodies, s.bounds, dt, s.agitation, s.tick)
      s.agitation *= Math.exp(-dt / 2.2)
      draw()
      // Once the filings have stopped turning and the card has stopped shaking, the picture
      // is still: stop scheduling frames until something moves again.
      const awake = s.spin > 0.004 || s.agitation > 0.01 || drag.current !== null
      if (awake && s.visible && !document.hidden && !state.frozen && !state.reduced) s.frame = requestAnimationFrame(tick)
      else s.running = false
    }
    s.frame = requestAnimationFrame(tick)
  }, [draw])

  /** Disturb the card: filings rotate freely and drift for a while. */
  const agitate = useCallback(
    (amount: number) => {
      const s = sim.current
      s.agitation = Math.max(s.agitation, amount)
      s.spin = Math.max(s.spin, 1)
      start()
    },
    [start],
  )

  const shake = useCallback(() => {
    const s = sim.current
    scatterFilings(s.set, s.bounds, random)
    if (live.current.reduced || live.current.frozen) {
      if (live.current.reduced) alignFilings(s.set, s.sources)
      draw()
      return
    }
    agitate(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agitate, draw])

  useImperativeHandle(ref, () => ({ shake }), [shake])

  /* ------------------------------------------------------------ effects */

  // Filing buffers.
  useEffect(() => {
    const s = sim.current
    s.set = createFilings(Math.max(0, Math.min(12000, Math.round(filings))))
    s.scattered = false
  }, [filings])

  // The field: sources, lines, shading and neutral points, rebuilt when a magnet or a layer changes.
  useEffect(() => {
    const s = sim.current
    if (!box.width || !box.height) return
    s.bounds = boundsFor(box.width, box.height)
    const built = buildSources(magnets, s.bounds)
    s.sources = built.sources
    s.bodies = built.bodies
    s.lines = layers.includes('lines') ? traceFieldLines(s.sources, s.bounds) : []
    s.neutral = neutralPoints(s.sources, s.bounds)
    if (layers.includes('strength')) {
      const cols = Math.max(8, Math.round(SHADE_RESOLUTION * s.bounds.width))
      const rows = Math.max(8, Math.round(SHADE_RESOLUTION * s.bounds.height))
      s.grid = strengthGrid(s.sources, s.bounds, cols, rows)
      s.gridSize = { cols, rows }
      paintShade()
    }
    if (!s.scattered) {
      scatterFilings(s.set, s.bounds, random)
      s.scattered = true
      if (!reduced) {
        // A first frame that is already mostly combed, so the page never opens on noise.
        alignFilings(s.set, s.sources)
        for (let i = 0; i < s.set.a.length; i++) s.set.a[i] = s.set.a[i]! + (random() - 0.5) * 1.2
      }
    }
    if (reduced) alignFilings(s.set, s.sources)
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magnets, layers, box, filings, reduced, draw, paintShade])

  // A magnet that moves jolts the card a little, so the filings turn and creep again.
  useEffect(() => {
    if (!reduced) agitate(0.3)
  }, [magnets, box, reduced, agitate])

  useEffect(() => {
    if (!frozen) start()
  }, [frozen, start])

  // Canvas size, and the colours read from tokens.
  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    if (!canvas || !frame) return
    const s = sim.current
    const resize = () => {
      const width = frame.clientWidth
      const height = frame.clientHeight
      if (!width || !height) return
      s.ratio = Math.min(2, window.devicePixelRatio || 1)
      const pixelWidth = Math.max(1, Math.round(width * s.ratio))
      const pixelHeight = Math.max(1, Math.round(height * s.ratio))
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      setBox((current) => (current.width === width && current.height === height ? current : { width, height }))
      draw()
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(frame)
    return () => observer?.disconnect()
  }, [draw])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const s = sim.current
    s.colours = {
      filing: tokenRgb(frame, tone === 'accent' ? '--color-accent' : '--color-ink', [40, 40, 40]),
      line: tokenRgb(frame, '--color-ink-soft', [90, 90, 90]),
      accent: tokenRgb(frame, '--color-accent', [120, 160, 60]),
    }
    paintShade()
    draw()
  }, [tone, themeVersion, draw, paintShade])

  // Park the loop off screen and in hidden tabs.
  useEffect(() => {
    const frame = frameRef.current
    const s = sim.current
    const wake = () => {
      if (s.visible && !document.hidden) start()
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = Boolean(entry?.isIntersecting)
            wake()
          })
    if (frame) observer?.observe(frame)
    document.addEventListener('visibilitychange', wake)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', wake)
      cancelAnimationFrame(s.frame)
      s.running = false
    }
  }, [start])

  // What the last-moved magnet is doing, said once it comes to rest.
  useEffect(() => {
    if (!lastMoved) return
    const timer = setTimeout(() => setAnnouncement(describe(lastMoved)), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMoved, magnets])

  /* -------------------------------------------------------- description */

  function describe(id: string) {
    // Built afresh rather than read from the simulation, so the words are right even before
    // the frame has been measured (or where there is no layout at all).
    const bounds = sim.current.bounds
    const { sources } = buildSources(magnets, bounds)
    const neutral = neutralPoints(sources, bounds)
    const index = magnets.findIndex((magnet) => magnet.id === id)
    const magnet = magnets[index]
    if (!magnet) return ''
    const parts = [`${nameOf(magnet, index)} at ${percent(magnet.x)} across, ${percent(magnet.y)} down, north end pointing ${pointing(magnet.angle)}.`]

    // The nearest other magnet, and whether the pole model says they pull or push.
    let nearest = -1
    let distance = Infinity
    magnets.forEach((other, k) => {
      if (k === index) return
      const d = Math.hypot((other.x - magnet.x) * bounds.width, (other.y - magnet.y) * bounds.height)
      if (d < distance) {
        distance = d
        nearest = k
      }
    })
    if (nearest >= 0 && distance < 1.2) {
      const other = magnets[nearest]!
      const force = forceBetween(sources, nearest, index)
      const away = { x: (magnet.x - other.x) * bounds.width, y: (magnet.y - other.y) * bounds.height }
      const repel = force.x * away.x + force.y * away.y > 0
      const facing = (m: IronFilingsMagnet, toward: IronFilingsMagnet) => {
        const theta = (m.angle * Math.PI) / 180
        const along = Math.cos(theta) * (toward.x - m.x) * bounds.width + Math.sin(theta) * (toward.y - m.y) * bounds.height
        return along * Math.sign(m.strength ?? 1) >= 0 ? 'north' : 'south'
      }
      parts.push(`Its ${facing(magnet, other)} end faces the ${facing(other, magnet)} end of ${nameOf(other, nearest)}, so they ${repel ? 'repel' : 'attract'}.`)
    }
    if (neutral.length === 1) {
      const point = neutral[0]!
      parts.push(`The fields cancel at a neutral point ${percent(point.x / bounds.width)} across, ${percent(point.y / bounds.height)} down.`)
    } else if (neutral.length > 1) parts.push(`The fields cancel at ${neutral.length} neutral points.`)
    return parts.join(' ')
  }

  /* ---------------------------------------------------------- handlers */

  const update = (id: string, change: Partial<IronFilingsMagnet>) => {
    commit(live.current.magnets.map((magnet) => (magnet.id === id ? { ...magnet, ...change } : magnet)))
    setLastMoved(id)
  }

  const pointFor = (event: { clientX: number; clientY: number }) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return null
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, width: rect.width, height: rect.height }
  }

  const onDown = (magnet: IronFilingsMagnet, mode: 'move' | 'turn') => (event: ReactPointerEvent<HTMLElement>) => {
    const point = pointFor(event)
    if (!point) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: magnet.id, mode, dx: point.x - magnet.x, dy: point.y - magnet.y }
  }

  const onMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current
    const point = current && pointFor(event)
    if (!current || !point) return
    const magnet = live.current.magnets.find((entry) => entry.id === current.id)
    if (!magnet) return
    if (current.mode === 'move') {
      update(current.id, { x: clamp(point.x - current.dx, 0.02, 0.98), y: clamp(point.y - current.dy, 0.02, 0.98) })
    } else {
      const angle = (Math.atan2((point.y - magnet.y) * point.height, (point.x - magnet.x) * point.width) * 180) / Math.PI
      update(current.id, { angle: wrapDegrees(angle) })
    }
  }

  const onUp = (event: ReactPointerEvent<HTMLElement>) => {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onMagnetKey = (magnet: IronFilingsMagnet) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 0.08 : 0.02
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      update(magnet.id, { x: clamp(magnet.x + move[0], 0.02, 0.98), y: clamp(magnet.y + move[1], 0.02, 0.98) })
    } else if (event.key === '[' || event.key === ']') {
      event.preventDefault()
      update(magnet.id, { angle: wrapDegrees(magnet.angle + (event.key === ']' ? 15 : -15)) })
    }
  }

  const onGripKey = (magnet: IronFilingsMagnet) => (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 15 : 5
    const turns: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 45, PageDown: -45 }
    if (event.key === 'Home') {
      event.preventDefault()
      update(magnet.id, { angle: 0 })
    } else if (turns[event.key] !== undefined) {
      event.preventDefault()
      update(magnet.id, { angle: wrapDegrees(magnet.angle + turns[event.key]!) })
    }
  }

  /* ---------------------------------------------------------------- view */

  const side = Math.min(box.width, box.height) || 300

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div
        ref={frameRef}
        className={cn(
          'relative isolate w-full touch-none select-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface',
          'bg-[radial-gradient(120%_90%_at_30%_20%,transparent,color-mix(in_oklab,var(--color-ink)_5%,transparent))]',
        )}
        style={{ aspectRatio: String(aspectRatio) }}
      >
        <canvas
          ref={canvasRef}
          role={label ? 'img' : undefined}
          aria-label={label ? `${label}. ${magnets.length} magnet${magnets.length === 1 ? '' : 's'}; filings line up along the field.` : undefined}
          aria-hidden={label ? undefined : true}
          className="pointer-events-none absolute inset-0 block size-full"
        />
        {magnets.map((magnet, index) => {
          const round = magnet.poles === 'point'
          const length = (magnet.length ?? DEFAULT_LENGTH) * side
          const width = round ? length * DISC_SCALE : length
          const height = round ? length * DISC_SCALE : Math.max(16, length * BAR_ASPECT)
          const flipped = (magnet.strength ?? 1) < 0
          const body = round ? (
            <svg aria-hidden="true" viewBox="-10 -10 20 20" className="size-[78%]" style={{ transform: `rotate(${flipped ? 180 : 0}deg)` }}>
              <path d="M9 0 L0 -2.6 L0 2.6 Z" className="fill-accent" />
              <path d="M-9 0 L0 -2.6 L0 2.6 Z" className="fill-ink-soft" />
              <circle r="1.3" className="fill-surface" />
            </svg>
          ) : (
            <>
              <span aria-hidden="true" className={cn('flex h-full flex-1 items-center pl-[8%] text-[11px] font-bold', flipped ? 'bg-accent text-accent-ink' : 'bg-ink-soft text-ink-inverse')}>
                {flipped ? 'N' : 'S'}
              </span>
              <span aria-hidden="true" className={cn('flex h-full flex-1 items-center justify-end pr-[8%] text-[11px] font-bold', flipped ? 'bg-ink-soft text-ink-inverse' : 'bg-accent text-accent-ink')}>
                {flipped ? 'S' : 'N'}
              </span>
            </>
          )
          const style = {
            left: percent(magnet.x),
            top: percent(magnet.y),
            width,
            height,
            transform: `translate(-50%, -50%) rotate(${magnet.angle}deg)`,
          }
          const shape = cn(
            'absolute z-10 flex items-center justify-center overflow-hidden shadow-[var(--shadow-tile)] ring-1 ring-line-strong',
            round ? 'rounded-full bg-surface' : 'rounded-[var(--radius-4)]',
          )
          if (!interactive) {
            return (
              <div key={magnet.id} aria-hidden="true" className={shape} style={style}>
                {body}
              </div>
            )
          }
          const theta = (magnet.angle * Math.PI) / 180
          const reach = width / 2 + 16
          const turnName = `Turn ${nameOf(magnet, index)}`
          return (
            <Fragment key={magnet.id}>
            <button
              type="button"
              aria-label={`${nameOf(magnet, index)}: ${percent(magnet.x)} across, ${percent(magnet.y)} down, north end pointing ${pointing(magnet.angle)}`}
              aria-describedby={hintId}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight [ ]"
              onPointerDown={onDown(magnet, 'move')}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={onMagnetKey(magnet)}
              className={cn(shape, 'cursor-grab touch-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus')}
              style={style}
            >
              {body}
            </button>
            {box.width ? (
              <div
                role="slider"
                tabIndex={0}
                aria-label={turnName}
                aria-valuemin={0}
                aria-valuemax={359}
                aria-valuenow={wrapDegrees(magnet.angle)}
                aria-valuetext={`${wrapDegrees(magnet.angle)} degrees, north end pointing ${pointing(magnet.angle)}`}
                onPointerDown={onDown(magnet, 'turn')}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={onGripKey(magnet)}
                className={cn(
                  'absolute z-20 grid size-6 cursor-grab touch-none place-items-center rounded-full active:cursor-grabbing',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                )}
                style={{
                  left: magnet.x * box.width + Math.cos(theta) * reach,
                  top: magnet.y * box.height + Math.sin(theta) * reach,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-accent bg-surface shadow-[var(--shadow-tile)]" />
              </div>
            ) : null}
            </Fragment>
          )
        })}
      </div>

      {controls ? (
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup label="Show" size="sm" items={LAYER_ITEMS} value={layers} onValueChange={setLayers} />
          {!reduced ? (
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={frozen} disabled={paused} onChange={(event) => setPausedHere(event.target.checked)} />
              Pause
            </label>
          ) : null}
          <Button size="sm" variant="outline" onClick={shake} className="ml-auto">
            Shake the card
          </Button>
        </div>
      ) : null}

      {interactive ? (
        <span id={hintId} className="sr-only">
          Arrow keys move the magnet, with Shift for larger steps; [ and ] turn it. The round grip beyond its north end turns it with the arrow keys.
        </span>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
})

function layersFrom(filings: boolean, lines: boolean, strength: boolean): Layer[] {
  const out: Layer[] = []
  if (filings) out.push('filings')
  if (lines) out.push('lines')
  if (strength) out.push('strength')
  return out
}
