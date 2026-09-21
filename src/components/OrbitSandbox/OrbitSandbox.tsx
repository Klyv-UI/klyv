'use client'

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '../../lib/cn'
import { tokenRgb, useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { SegmentedControl } from '../SegmentedControl'
import { Slider } from '../Slider'
import { Switch } from '../Switch'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'
import {
  DT,
  ORBIT_PRESET_LABELS,
  accelerate,
  advance,
  barycentre,
  circularSpeed,
  cloneBodies,
  createBody,
  customScene,
  energy,
  predict,
  presetScene,
  radiusForMass,
  spin,
  timeline,
  timelineInterval,
  type OrbitBody,
  type OrbitBodyInput,
  type OrbitCollisionMode,
  type OrbitMerge,
  type OrbitPhysics,
  type OrbitPrediction,
  type OrbitPreset,
  type OrbitTone,
} from './nbody'

export interface OrbitSandboxHandle {
  /** Add a body to the system as it stands. Position and velocity in world units. */
  add: (body: OrbitBodyInput) => void
  /** Reload the current scene from its starting state. */
  reset: () => void
  /** Remove every body. */
  clear: () => void
}

export interface OrbitSandboxProps {
  /** Starting bodies, in world units (the default view spans about seventy). Overrides `preset`. */
  bodies?: OrbitBodyInput[]
  /** The arrangement to start from when `bodies` is not given. The scene picker changes it after. */
  preset?: OrbitPreset
  /** The gravitational constant G. Presets are built for it, so their circular orbits stay circular. */
  gravity?: number
  /** Plummer softening length ε in world units: how far gravity is smeared to avoid the r = 0 singularity. */
  softening?: number
  /** Touching bodies merge (conserving mass and momentum), bounce elastically, or pass through. */
  collisions?: OrbitCollisionMode
  /** Fading trails: `true` for 20 units of simulated time, a number for that many, `false` for none. */
  trails?: boolean | number
  /** Simulated time per real second, relative to the default. The speed slider starts here. */
  timeScale?: number
  /** Controlled pause. Omit to let the play button own it. */
  paused?: boolean
  /** Called when the play button, the space key or the handle changes the pause state. */
  onPausedChange?: (paused: boolean) => void
  /** Draw each body's velocity as an arrow. */
  showVectors?: boolean
  /** Mark the system's centre of mass. It should never move: momentum is conserved. */
  showBarycentre?: boolean
  /** Mass of a body launched by dragging or from the keyboard. The mass slider starts here. */
  launchMass?: number
  /** Accessible name for the drawing. Without it the canvas is decorative and the status line carries the state. */
  label?: string
  /** Show the transport, scene picker, switches and sliders. */
  controls?: boolean
  /** Merged last, so it wins. */
  className?: string
}

type Source = OrbitPreset | 'custom'
type Rgb = [number, number, number]
type Paint = OrbitTone | 'line' | 'faint'
type Palette = Record<Paint, Rgb>

interface Trail {
  points: Float32Array
  start: number
  count: number
  cap: number
  tone: OrbitTone
}

interface Drag {
  kind: 'aim' | 'select' | 'pan'
  id: number
  /** Where the pointer went down, and where it is now, in CSS pixels. */
  sx: number
  sy: number
  x: number
  y: number
  /** World point under the pointer at the start — the launch point for an aim. */
  ox: number
  oy: number
  hit: number | null
}

interface Aim {
  x: number
  y: number
  vx: number
  vy: number
}

/** Simulated time units per real second at `timeScale` 1. The inner planet laps in about two seconds. */
const TIME_RATE = 2.5
/** Launch velocity per world unit of drag. */
const LAUNCH_GAIN = 0.5
/** Simulated time between trail samples. */
const TRAIL_EVERY = 0.05
const DEFAULT_TRAIL = 20
/** More than this per frame and the simulation slows down rather than taking bigger steps. */
const MAX_STEPS_PER_FRAME = 600
/** Pair evaluations one aim prediction may spend, so it stays cheap however many bodies there are. */
const PREDICT_BUDGET = 350_000
const PREDICT_MAX_STEPS = 2500
const TRACE_SAMPLES = 360
/** What one press of Step advances when running normally, in simulated time. */
const STEP_TIME = 0.25
/** Velocity arrows show where a body would be this much simulated time later, in a straight line. */
const VECTOR_TIME = 0.9
const LAUNCH_TONES: OrbitTone[] = ['success', 'danger', 'warning', 'ink', 'accent']

const TOKENS: Record<Paint, [string, Rgb]> = {
  accent: ['--color-accent', [180, 220, 70]],
  ink: ['--color-ink', [30, 30, 30]],
  soft: ['--color-ink-soft', [95, 97, 100]],
  success: ['--color-success', [45, 113, 53]],
  warning: ['--color-warning', [245, 165, 36]],
  danger: ['--color-danger', [196, 38, 48]],
  line: ['--color-line-strong', [220, 222, 220]],
  faint: ['--color-ink-faint', [106, 112, 117]],
}

const SOURCE_OPTIONS = (Object.keys(ORBIT_PRESET_LABELS) as OrbitPreset[]).map((value) => ({ value: value as Source, label: ORBIT_PRESET_LABELS[value] }))

const css = (c: Rgb, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const numbers = new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 4 })
const formatEnergy = (e: number) => numbers.format(e).replace('-', '−')
const formatDrift = (pct: number) => {
  const size = Math.abs(pct)
  const sign = pct < 0 ? '−' : '+'
  return `${sign}${size !== 0 && size < 0.0001 ? size.toExponential(1) : size.toFixed(4)}%`
}
const physicsOf = (state: { gravity: number; softening: number; collisions: OrbitCollisionMode }): OrbitPhysics => ({
  gravity: state.gravity,
  softening: state.softening,
  collisions: state.collisions,
})

function makeTrail(cap: number, tone: OrbitTone): Trail {
  return { points: new Float32Array(cap * 2), start: 0, count: 0, cap, tone }
}

function pushTrail(trail: Trail, x: number, y: number) {
  let i: number
  if (trail.count < trail.cap) i = (trail.start + trail.count++) % trail.cap
  else {
    i = trail.start
    trail.start = (trail.start + 1) % trail.cap
  }
  trail.points[i * 2] = x
  trail.points[i * 2 + 1] = y
}

/**
 * An n-body gravity sandbox: fling a body and watch it fall into orbit.
 *
 * The physics lives in `nbody.ts` — softened Newtonian gravity integrated with
 * velocity Verlet, which is symplectic, so a stable orbit stays closed instead
 * of spiralling in or out, and total energy wobbles within a hair of where it
 * started. The readout shows that drift; it sits around a hundred-thousandth
 * of a per cent until two bodies pass very close.
 *
 * Aiming is honest: while you drag, the drawn path is the system copied and
 * run forward through the very same `advance` the live loop calls, with the
 * new body appended exactly as the launch will append it. It is not a conic
 * guessed from the nearest mass — it bends round the moon, and it ends where
 * the body will actually hit something.
 *
 * Trails are ring buffers in world coordinates, so they stay on their orbits
 * while the view pans and zooms. Under reduced motion nothing runs by itself:
 * the scene is traced ahead into snapshots, drawn as complete paths, and the
 * reader moves through them with Step and a time scrubber.
 */
export const OrbitSandbox = forwardRef<OrbitSandboxHandle, OrbitSandboxProps>(function OrbitSandbox(
  {
    bodies: bodiesProp,
    preset = 'solar',
    gravity = 1,
    softening = 0.25,
    collisions = 'merge',
    trails = true,
    timeScale = 1,
    paused: pausedProp,
    onPausedChange,
    showVectors = false,
    showBarycentre = false,
    launchMass = 1,
    label,
    controls = true,
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const idBase = useId()
  const bodiesKey = bodiesProp ? JSON.stringify(bodiesProp) : ''
  const trailLength = typeof trails === 'number' ? Math.max(0, trails) : DEFAULT_TRAIL

  const [source, setSource] = useState<Source>(bodiesProp ? 'custom' : preset)
  const [internalPaused, setInternalPaused] = useState(false)
  const paused = pausedProp ?? internalPaused
  const [trailsOn, setTrailsOn] = useState(trails !== false && trails !== 0)
  const [vectors, setVectors] = useState(showVectors)
  const [marker, setMarker] = useState(showBarycentre)
  const [speed, setSpeed] = useState(timeScale)
  const [mass, setMass] = useState(launchMass)
  const [dragMode, setDragMode] = useState<'launch' | 'pan'>('launch')
  const [selected, setSelectedState] = useState<number | null>(null)
  const [follow, setFollowState] = useState(false)
  const [scrub, setScrub] = useState(0)
  const [summary, setSummary] = useState('')
  const [aimText, setAimText] = useState('')

  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)

  const live = useRef({
    gravity,
    softening,
    collisions,
    paused,
    reduced,
    speed,
    mass,
    trailsOn,
    trailLength,
    vectors,
    marker,
    dragMode,
    source,
    bodiesProp,
  })
  live.current = { gravity, softening, collisions, paused, reduced, speed, mass, trailsOn, trailLength, vectors, marker, dragMode, source, bodiesProp }

  const sim = useRef({
    bodies: [] as OrbitBody[],
    trails: new Map<number, Trail>(),
    ghosts: [] as { trail: Trail; age: number }[],
    paths: [] as { tone: OrbitTone; points: Float32Array; count: number }[],
    timeline: null as OrbitBody[][] | null,
    index: 0,
    interval: 0,
    timeBase: 0,
    extent: 30,
    horizon: 40,
    time: 0,
    acc: 0,
    sinceTrail: 0,
    e0: 0,
    version: 0,
    cam: { x: 0, y: 0, scale: 10 },
    fit: true,
    w: 0,
    h: 0,
    ratio: 1,
    palette: null as Palette | null,
    pointers: new Map<number, { x: number; y: number }>(),
    drag: null as Drag | null,
    pinch: null as { d: number; x: number; y: number } | null,
    keyAim: null as { x: number; y: number; angle: number; speed: number } | null,
    keyActive: false,
    aim: null as Aim | null,
    prediction: null as OrbitPrediction | null,
    predictionKey: '',
    selected: null as number | null,
    follow: false,
    toneCursor: 0,
    launched: 0,
    frame: 0,
    last: 0,
    visible: true,
    tick: 0,
  })
  const wake = useRef<() => void>(() => {})

  /* ------------------------------------------------------------ state */

  const setPaused = (next: boolean) => {
    if (pausedProp === undefined) setInternalPaused(next)
    onPausedChange?.(next)
  }

  const select = (id: number | null) => {
    const s = sim.current
    s.selected = id
    setSelectedState(id)
    if (id === null) setFollow(false)
  }

  const setFollow = (on: boolean) => {
    sim.current.follow = on
    setFollowState(on)
    wake.current()
  }

  const nameOf = (body: OrbitBody | undefined) => body?.label ?? 'Body'

  /** Speak body count and total energy. Called on events, not every frame — a live region that changes sixty times a second is noise. */
  const summarise = (lead: string) => {
    const s = sim.current
    const n = s.bodies.length
    if (!n) return setSummary(`${lead}. No bodies — drag, or press Enter on the sandbox, to launch one.`)
    const e = energy(s.bodies, live.current.gravity, live.current.softening).total
    const drift = s.e0 ? ((e - s.e0) / Math.abs(s.e0)) * 100 : 0
    setSummary(`${lead}. ${n} ${n === 1 ? 'body' : 'bodies'}, total energy ${formatEnergy(e)}, drift ${formatDrift(drift)}.`)
  }

  /** Take the current energy as the reference the drift is measured from. */
  const rebase = () => {
    const s = sim.current
    s.e0 = energy(s.bodies, live.current.gravity, live.current.softening).total
  }

  /* ------------------------------------------------------------ camera */

  const fitScale = () => {
    const s = sim.current
    return Math.max(0.01, Math.min(s.w, s.h) / (2 * s.extent))
  }

  const toWorld = (px: number, py: number) => {
    const { cam, w, h } = sim.current
    return { x: cam.x + (px - w / 2) / cam.scale, y: cam.y + (py - h / 2) / cam.scale }
  }

  const zoomAt = (px: number, py: number, factor: number) => {
    const s = sim.current
    const fit = fitScale()
    const anchor = s.follow ? { x: s.w / 2, y: s.h / 2 } : { x: px, y: py }
    const before = toWorld(anchor.x, anchor.y)
    s.cam.scale = Math.min(fit * 40, Math.max(fit * 0.08, s.cam.scale * factor))
    s.cam.x = before.x - (anchor.x - s.w / 2) / s.cam.scale
    s.cam.y = before.y - (anchor.y - s.h / 2) / s.cam.scale
    s.fit = false
    wake.current()
  }

  const fitView = () => {
    const s = sim.current
    const c = barycentre(s.bodies)
    s.cam.x = c.x
    s.cam.y = c.y
    s.cam.scale = fitScale()
    s.fit = true
    wake.current()
  }

  /* ------------------------------------------------------------ scene */

  const recordTrails = () => {
    const s = sim.current
    const cap = Math.max(2, Math.round(live.current.trailLength / TRAIL_EVERY))
    for (const body of s.bodies) {
      let trail = s.trails.get(body.id)
      if (!trail || trail.cap !== cap) {
        trail = makeTrail(cap, body.tone)
        s.trails.set(body.id, trail)
      }
      pushTrail(trail, body.x, body.y)
    }
  }

  const applySnapshot = (index: number) => {
    const s = sim.current
    if (!s.timeline) return
    s.index = Math.max(0, Math.min(s.timeline.length - 1, index))
    s.bodies = cloneBodies(s.timeline[s.index])
    s.time = s.timeBase + s.index * s.interval
    s.version++
    setScrub(s.index)
    if (s.selected !== null && !s.bodies.some((b) => b.id === s.selected)) select(null)
    wake.current()
  }

  /** Reduced motion: trace the system ahead from where it is into snapshots, and draw the paths. */
  const rebuildTimeline = () => {
    const s = sim.current
    const physics = physicsOf(live.current)
    s.timeBase = s.time
    s.timeline = timeline(s.bodies, physics, s.horizon, TRACE_SAMPLES)
    s.interval = timelineInterval(s.bodies.length, s.horizon, TRACE_SAMPLES)
    const byId = new Map<number, { tone: OrbitTone; values: number[] }>()
    for (const snapshot of s.timeline) {
      for (const body of snapshot) {
        let path = byId.get(body.id)
        if (!path) byId.set(body.id, (path = { tone: body.tone, values: [] }))
        path.values.push(body.x, body.y)
      }
    }
    s.paths = [...byId.values()].map((path) => ({ tone: path.tone, points: Float32Array.from(path.values), count: path.values.length / 2 }))
    s.bodies = cloneBodies(s.timeline[0])
    rebase()
    applySnapshot(0)
  }

  const loadScene = (which: Source) => {
    const s = sim.current
    const state = live.current
    const physics = physicsOf(state)
    const scene = which === 'custom' && state.bodiesProp ? customScene(state.bodiesProp, physics) : presetScene(which === 'custom' ? 'solar' : which, physics)
    s.bodies = scene.bodies
    s.extent = scene.extent
    s.horizon = scene.horizon
    s.trails.clear()
    s.ghosts = []
    s.paths = []
    s.timeline = null
    s.time = 0
    s.acc = 0
    s.sinceTrail = 0
    s.keyAim = null
    s.version++
    accelerate(s.bodies, physics.gravity, physics.softening)
    rebase()
    select(null)
    fitView()
    if (state.reduced) rebuildTimeline()
    else recordTrails()
    summarise(which === 'custom' ? 'Scene loaded' : `${ORBIT_PRESET_LABELS[which]} loaded`)
  }

  const addBody = (input: OrbitBodyInput) => {
    const s = sim.current
    const state = live.current
    const tone = input.tone ?? LAUNCH_TONES[s.toneCursor++ % LAUNCH_TONES.length]
    const body = createBody({ mass: state.mass, label: `Body ${++s.launched}`, ...input, tone })
    s.bodies.push(body)
    accelerate(s.bodies, state.gravity, state.softening)
    s.version++
    rebase()
    if (state.reduced) rebuildTimeline()
    summarise(`${nameOf(body)} launched`)
    wake.current()
  }

  const clearAll = () => {
    const s = sim.current
    s.bodies = []
    s.trails.clear()
    s.ghosts = []
    s.paths = []
    s.version++
    s.e0 = 0
    select(null)
    if (live.current.reduced) rebuildTimeline()
    summarise('Cleared')
    wake.current()
  }

  const onMerges = (merges: OrbitMerge[]) => {
    const s = sim.current
    for (const merge of merges) {
      const trail = s.trails.get(merge.absorbed)
      if (trail) s.ghosts.push({ trail, age: 0 })
      s.trails.delete(merge.absorbed)
      if (s.selected === merge.absorbed) select(merge.survivor)
    }
    // A merge is a perfectly inelastic collision: momentum survives it, kinetic
    // energy does not. The reference is re-taken so the drift keeps measuring
    // the integrator, not the crash.
    rebase()
    summarise(merges.length === 1 ? 'Two bodies merged; momentum kept, kinetic energy lost to the impact' : `${merges.length} merges`)
  }

  /** Run whole integration steps on the live system, sampling trails as it goes. */
  const simulate = (steps: number) => {
    const s = sim.current
    const physics = physicsOf(live.current)
    const merges: OrbitMerge[] = []
    for (let k = 0; k < steps; k++) {
      advance(s.bodies, 1, physics, merges)
      s.time += DT
      s.sinceTrail += DT
      if (s.sinceTrail >= TRAIL_EVERY) {
        s.sinceTrail -= TRAIL_EVERY
        recordTrails()
      }
    }
    if (steps) s.version++
    if (merges.length) onMerges(merges)
  }

  const stepOnce = () => {
    const s = sim.current
    if (live.current.reduced) {
      if (!s.timeline) return
      // At the end of the trace, carry on: trace again from the last snapshot.
      if (s.index >= s.timeline.length - 1) rebuildTimeline()
      else applySnapshot(s.index + Math.max(1, Math.round(TRACE_SAMPLES / 72)))
    } else {
      simulate(Math.round(STEP_TIME / DT))
      wake.current()
    }
  }

  /* ------------------------------------------------------------ aiming */

  const ensureKeyAim = () => {
    const s = sim.current
    if (s.keyAim) return s.keyAim
    // Start somewhere useful: 55% of the way to the edge, moving at the speed
    // of a circular orbit round everything, in the direction the system turns.
    const c = barycentre(s.bodies)
    const r = (0.55 * Math.min(s.w || 600, s.h || 400)) / 2 / s.cam.scale
    const v = c.mass > 0 ? circularSpeed(live.current.gravity, c.mass, r, live.current.softening) : 0
    s.keyAim = { x: c.x + r, y: c.y, angle: (spin(s.bodies) * Math.PI) / 2, speed: v }
    return s.keyAim
  }

  const currentAim = (): Aim | null => {
    const s = sim.current
    const drag = s.drag
    if (drag?.kind === 'aim') {
      const end = toWorld(drag.x, drag.y)
      return { x: drag.ox, y: drag.oy, vx: (end.x - drag.ox) * LAUNCH_GAIN, vy: (end.y - drag.oy) * LAUNCH_GAIN }
    }
    if (s.keyActive && s.keyAim) {
      const k = s.keyAim
      return { x: k.x, y: k.y, vx: Math.cos(k.angle) * k.speed, vy: Math.sin(k.angle) * k.speed }
    }
    return null
  }

  const refreshPrediction = () => {
    const s = sim.current
    const aim = currentAim()
    s.aim = aim
    if (!aim) {
      s.prediction = null
      return
    }
    const key = `${s.version}|${aim.x}|${aim.y}|${aim.vx}|${aim.vy}|${live.current.mass}`
    if (key === s.predictionKey && s.prediction) return
    const n = s.bodies.length + 1
    const pairs = Math.max(1, (n * (n - 1)) / 2)
    const steps = Math.max(50, Math.min(PREDICT_MAX_STEPS, Math.floor(PREDICT_BUDGET / pairs)))
    s.prediction = predict(s.bodies, { ...aim, mass: live.current.mass }, physicsOf(live.current), steps)
    s.predictionKey = key
  }

  const launch = () => {
    refreshPrediction()
    const aim = sim.current.aim
    if (aim) addBody({ x: aim.x, y: aim.y, vx: aim.vx, vy: aim.vy })
  }

  const describeAim = () => {
    const s = sim.current
    const k = s.keyAim
    if (!k) return ''
    refreshPrediction()
    const c = barycentre(s.bodies)
    const degrees = Math.round(((-k.angle * 180) / Math.PI + 720) % 360)
    let outcome = 'Nothing to orbit.'
    if (s.prediction?.impact) outcome = 'It will hit another body.'
    else if (c.mass > 0) {
      const vx = Math.cos(k.angle) * k.speed - c.vx
      const vy = Math.sin(k.angle) * k.speed - c.vy
      const bound = 0.5 * (vx * vx + vy * vy) - (live.current.gravity * c.mass) / Math.hypot(k.x - c.x, k.y - c.y) < 0
      outcome = bound ? 'Bound: it will orbit.' : 'Unbound: it will escape.'
    }
    return `Launch point ${k.x.toFixed(1)}, ${(-k.y).toFixed(1)}. Heading ${degrees} degrees, speed ${k.speed.toFixed(2)}. ${outcome}`
  }

  /* ------------------------------------------------------------ drawing */

  const writeReadout = () => {
    const el = readoutRef.current
    if (!el) return
    const s = sim.current
    const n = s.bodies.length
    if (!n) {
      el.textContent = 'Empty — drag anywhere to launch a body'
      return
    }
    const e = energy(s.bodies, live.current.gravity, live.current.softening).total
    const drift = s.e0 ? ((e - s.e0) / Math.abs(s.e0)) * 100 : 0
    el.textContent = `${n} ${n === 1 ? 'body' : 'bodies'} · E ${formatEnergy(e)} · ΔE ${formatDrift(drift)} · t ${s.time.toFixed(1)}`
  }

  const strokeTrail = (context: CanvasRenderingContext2D, trail: Trail, colour: Rgb, fade: number, sx: (x: number) => number, sy: (y: number) => number) => {
    const { points, start, count, cap } = trail
    if (count < 2) return
    // Eight bands, each a single path at its own opacity: a fade for eight strokes rather than one per segment.
    const bands = 8
    for (let band = 0; band < bands; band++) {
      const from = Math.floor((band * (count - 1)) / bands)
      const to = Math.floor(((band + 1) * (count - 1)) / bands)
      if (to <= from) continue
      context.strokeStyle = css(colour, fade * Math.pow((band + 1) / bands, 1.6))
      context.beginPath()
      for (let i = from; i <= to; i++) {
        const j = ((start + i) % cap) * 2
        if (i === from) context.moveTo(sx(points[j]), sy(points[j + 1]))
        else context.lineTo(sx(points[j]), sy(points[j + 1]))
      }
      context.stroke()
    }
  }

  const arrow = (context: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
    const length = Math.hypot(x1 - x0, y1 - y0)
    if (length < 2) return
    const ux = (x1 - x0) / length
    const uy = (y1 - y0) / length
    const head = Math.min(7, length * 0.4)
    context.beginPath()
    context.moveTo(x0, y0)
    context.lineTo(x1, y1)
    context.moveTo(x1 - ux * head - uy * head * 0.55, y1 - uy * head + ux * head * 0.55)
    context.lineTo(x1, y1)
    context.lineTo(x1 - ux * head + uy * head * 0.55, y1 - uy * head - ux * head * 0.55)
    context.stroke()
  }

  const draw = () => {
    const canvas = canvasRef.current
    const s = sim.current
    const palette = s.palette
    // Nothing measured yet (or jsdom, which measures nothing): skip before asking for a context.
    if (!canvas || !palette || !s.w || !s.h) return
    const context = canvas.getContext('2d')
    if (!context) return
    const state = live.current
    const { w, h, ratio, cam } = s
    const scale = cam.scale
    const sx = (x: number) => (x - cam.x) * scale + w / 2
    const sy = (y: number) => (y - cam.y) * scale + h / 2
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, w, h)
    context.lineCap = 'round'
    context.lineJoin = 'round'

    // A world-space dot grid at a round spacing, so panning and zooming read as movement.
    const raw = 64 / scale
    const power = Math.pow(10, Math.floor(Math.log10(raw)))
    const mantissa = raw / power
    const spacing = (mantissa < 1.5 ? 1 : mantissa < 3.5 ? 2 : mantissa < 7.5 ? 5 : 10) * power
    context.fillStyle = css(palette.line, 1)
    const left = Math.floor((cam.x - w / 2 / scale) / spacing) * spacing
    const top = Math.floor((cam.y - h / 2 / scale) / spacing) * spacing
    for (let x = left; x <= cam.x + w / 2 / scale; x += spacing) {
      for (let y = top; y <= cam.y + h / 2 / scale; y += spacing) context.fillRect(sx(x) - 1, sy(y) - 1, 2, 2)
    }

    // Traced paths under reduced motion; fading trails otherwise.
    context.lineWidth = 1.6
    if (state.reduced) {
      for (const path of s.paths) {
        if (path.count < 2) continue
        context.strokeStyle = css(palette[path.tone], 0.55)
        context.beginPath()
        for (let i = 0; i < path.count; i++) {
          if (i === 0) context.moveTo(sx(path.points[0]), sy(path.points[1]))
          else context.lineTo(sx(path.points[i * 2]), sy(path.points[i * 2 + 1]))
        }
        context.stroke()
      }
    } else if (state.trailsOn) {
      for (const ghost of s.ghosts) strokeTrail(context, ghost.trail, palette[ghost.trail.tone], 0.7 * Math.max(0, 1 - ghost.age / 1.4), sx, sy)
      for (const body of s.bodies) {
        const trail = s.trails.get(body.id)
        if (trail) strokeTrail(context, trail, palette[body.tone], 0.75, sx, sy)
      }
    }

    // The predicted path, then the launch itself.
    const aim = s.aim
    if (aim && s.prediction) {
      const { points, count, impact } = s.prediction
      const tone = LAUNCH_TONES[s.toneCursor % LAUNCH_TONES.length]
      context.setLineDash([5, 5])
      context.lineWidth = 1.6
      context.strokeStyle = css(palette[tone], 0.95)
      context.beginPath()
      for (let i = 0; i < count; i++) {
        if (i === 0) context.moveTo(sx(points[0]), sy(points[1]))
        else context.lineTo(sx(points[i * 2]), sy(points[i * 2 + 1]))
      }
      context.stroke()
      context.setLineDash([])
      if (impact && count) {
        const ex = sx(points[(count - 1) * 2])
        const ey = sy(points[(count - 1) * 2 + 1])
        context.strokeStyle = css(palette.danger, 1)
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(ex - 5, ey - 5)
        context.lineTo(ex + 5, ey + 5)
        context.moveTo(ex + 5, ey - 5)
        context.lineTo(ex - 5, ey + 5)
        context.stroke()
      }
      const ox = sx(aim.x)
      const oy = sy(aim.y)
      context.fillStyle = css(palette[tone], 0.55)
      context.beginPath()
      context.arc(ox, oy, Math.max(3, radiusForMass(state.mass) * scale), 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = css(palette.ink, 0.75)
      context.lineWidth = 1.5
      arrow(context, ox, oy, sx(aim.x + aim.vx / LAUNCH_GAIN), sy(aim.y + aim.vy / LAUNCH_GAIN))
      if (s.drag?.kind !== 'aim') {
        // The keyboard's launch point gets crosshairs, so it can be found at a glance.
        context.strokeStyle = css(palette.faint, 0.9)
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(ox - 14, oy)
        context.lineTo(ox - 6, oy)
        context.moveTo(ox + 6, oy)
        context.lineTo(ox + 14, oy)
        context.moveTo(ox, oy - 14)
        context.lineTo(ox, oy - 6)
        context.moveTo(ox, oy + 6)
        context.lineTo(ox, oy + 14)
        context.stroke()
      }
    }

    if (state.marker && s.bodies.length) {
      const c = barycentre(s.bodies)
      const bx = sx(c.x)
      const by = sy(c.y)
      context.strokeStyle = css(palette.faint, 1)
      context.lineWidth = 1.25
      context.beginPath()
      context.arc(bx, by, 4.5, 0, Math.PI * 2)
      context.moveTo(bx - 9, by)
      context.lineTo(bx + 9, by)
      context.moveTo(bx, by - 9)
      context.lineTo(bx, by + 9)
      context.stroke()
    }

    for (const body of s.bodies) {
      const x = sx(body.x)
      const y = sy(body.y)
      const r = Math.max(2.5, body.radius * scale)
      if (x < -r * 4 || y < -r * 4 || x > w + r * 4 || y > h + r * 4) continue
      const colour = palette[body.tone]
      if (body.mass >= 100) {
        const glow = context.createRadialGradient(x, y, r * 0.6, x, y, r * 3.4)
        glow.addColorStop(0, css(colour, 0.4))
        glow.addColorStop(1, css(colour, 0))
        context.fillStyle = glow
        context.beginPath()
        context.arc(x, y, r * 3.4, 0, Math.PI * 2)
        context.fill()
      }
      context.fillStyle = css(colour, 1)
      context.beginPath()
      context.arc(x, y, r, 0, Math.PI * 2)
      context.fill()
      // An ink rim, so a pale accent on a pale theme still has an edge.
      context.strokeStyle = css(palette.ink, 0.28)
      context.lineWidth = 1
      context.stroke()
      if (body.id === s.selected) {
        context.strokeStyle = css(palette.ink, 0.85)
        context.lineWidth = 1.5
        context.setLineDash([3, 3])
        context.beginPath()
        context.arc(x, y, r + 5, 0, Math.PI * 2)
        context.stroke()
        context.setLineDash([])
      }
    }

    if (state.vectors) {
      context.strokeStyle = css(palette.soft, 0.9)
      context.lineWidth = 1.25
      for (const body of s.bodies) arrow(context, sx(body.x), sy(body.y), sx(body.x + body.vx * VECTOR_TIME), sy(body.y + body.vy * VECTOR_TIME))
    }
  }

  /* ------------------------------------------------------------ pointer */

  const local = (event: { clientX: number; clientY: number }) => {
    const box = stageRef.current?.getBoundingClientRect()
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
  }

  const hitTest = (px: number, py: number) => {
    const s = sim.current
    let best: number | null = null
    let distance = Infinity
    for (const body of s.bodies) {
      const d = Math.hypot((body.x - s.cam.x) * s.cam.scale + s.w / 2 - px, (body.y - s.cam.y) * s.cam.scale + s.h / 2 - py)
      if (d < Math.max(10, body.radius * s.cam.scale + 4) && d < distance) {
        distance = d
        best = body.id
      }
    }
    return best
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return
    const s = sim.current
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const p = local(event)
    s.pointers.set(event.pointerId, p)
    s.keyActive = false
    if (s.pointers.size >= 2) {
      const [a, b] = [...s.pointers.values()]
      s.drag = null
      s.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    } else {
      const pan = live.current.dragMode === 'pan' || event.shiftKey || event.button === 1
      const hit = pan ? null : hitTest(p.x, p.y)
      const origin = toWorld(p.x, p.y)
      s.drag = { kind: pan ? 'pan' : hit !== null ? 'select' : 'aim', id: event.pointerId, sx: p.x, sy: p.y, x: p.x, y: p.y, ox: origin.x, oy: origin.y, hit }
    }
    wake.current()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = sim.current
    if (!s.pointers.has(event.pointerId)) return
    const p = local(event)
    s.pointers.set(event.pointerId, p)
    if (s.pinch && s.pointers.size >= 2) {
      const [a, b] = [...s.pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      if (s.pinch.d > 0 && d > 0) zoomAt(mx, my, d / s.pinch.d)
      if (!s.follow) {
        s.cam.x -= (mx - s.pinch.x) / s.cam.scale
        s.cam.y -= (my - s.pinch.y) / s.cam.scale
      }
      s.pinch = { d, x: mx, y: my }
    } else if (s.drag && s.drag.id === event.pointerId) {
      const drag = s.drag
      if (drag.kind === 'pan') {
        if (s.follow) setFollow(false)
        s.cam.x -= (p.x - drag.x) / s.cam.scale
        s.cam.y -= (p.y - drag.y) / s.cam.scale
        s.fit = false
      } else if (drag.kind === 'select' && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) drag.kind = 'aim'
      drag.x = p.x
      drag.y = p.y
    }
    wake.current()
  }

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const s = sim.current
    const drag = s.drag
    s.pointers.delete(event.pointerId)
    if (drag && drag.id === event.pointerId) {
      if (!cancelled && drag.kind === 'aim') launch()
      if (!cancelled && drag.kind === 'select' && drag.hit !== null) {
        const body = s.bodies.find((b) => b.id === drag.hit)
        select(drag.hit)
        summarise(`${nameOf(body)} selected, mass ${numbers.format(body?.mass ?? 0)}`)
      }
      s.drag = null
    }
    if (s.pointers.size < 2) s.pinch = null
    s.aim = null
    s.prediction = null
    wake.current()
  }

  /* ------------------------------------------------------------ keyboard */

  const cycleSelection = (direction: number) => {
    const s = sim.current
    if (!s.bodies.length) return
    const at = s.bodies.findIndex((b) => b.id === s.selected)
    const next = s.bodies[(at + direction + s.bodies.length + (at < 0 && direction < 0 ? 1 : 0)) % s.bodies.length]
    select(next.id)
    summarise(`${nameOf(next)} selected, mass ${numbers.format(next.mass)}`)
    wake.current()
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const s = sim.current
    const coarse = event.shiftKey
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const k = ensureKeyAim()
    const view = s.w / s.cam.scale
    let aimChanged = true
    if (key === 'ArrowLeft') k.angle -= ((coarse ? 15 : 5) * Math.PI) / 180
    else if (key === 'ArrowRight') k.angle += ((coarse ? 15 : 5) * Math.PI) / 180
    else if (key === 'ArrowUp') k.speed += Math.max(0.05, k.speed * (coarse ? 0.2 : 0.04))
    else if (key === 'ArrowDown') k.speed = Math.max(0, k.speed - Math.max(0.05, k.speed * (coarse ? 0.2 : 0.04)))
    else if (key === 'w') k.y -= view * (coarse ? 0.1 : 0.025)
    else if (key === 's') k.y += view * (coarse ? 0.1 : 0.025)
    else if (key === 'a') k.x -= view * (coarse ? 0.1 : 0.025)
    else if (key === 'd') k.x += view * (coarse ? 0.1 : 0.025)
    else {
      aimChanged = false
      if (key === 'Enter') {
        s.keyActive = true
        launch()
      } else if (key === ' ' && !live.current.reduced) setPaused(!live.current.paused)
      else if (key === '+' || key === '=') zoomAt(s.w / 2, s.h / 2, 1.25)
      else if (key === '-' || key === '_') zoomAt(s.w / 2, s.h / 2, 0.8)
      else if (key === '0') fitView()
      else if (key === '[') cycleSelection(-1)
      else if (key === ']') cycleSelection(1)
      else if (key === 'f' && s.selected !== null) setFollow(!s.follow)
      else if (key === 'Escape' && s.keyActive) s.keyActive = false
      else return
    }
    event.preventDefault()
    if (aimChanged) {
      s.keyActive = true
      setAimText(describeAim())
    }
    wake.current()
  }

  /* ------------------------------------------------------------ loop */

  const frame = (now: number) => {
    const s = sim.current
    const state = live.current
    const dt = s.last ? Math.min(0.1, (now - s.last) / 1000) : 1 / 60
    s.last = now
    const running = !state.paused && !state.reduced
    if (running) {
      s.acc += dt * TIME_RATE * state.speed
      let steps = Math.floor(s.acc / DT)
      if (steps > MAX_STEPS_PER_FRAME) {
        steps = MAX_STEPS_PER_FRAME
        s.acc = 0
      } else s.acc -= steps * DT
      simulate(steps)
    }
    for (const ghost of s.ghosts) ghost.age += dt
    s.ghosts = s.ghosts.filter((ghost) => ghost.age < 1.4)
    let settling = false
    if (s.follow) {
      const body = s.bodies.find((b) => b.id === s.selected)
      if (body) {
        const k = state.reduced ? 1 : 1 - Math.exp(-dt * 10)
        s.cam.x += (body.x - s.cam.x) * k
        s.cam.y += (body.y - s.cam.y) * k
        settling = Math.hypot(body.x - s.cam.x, body.y - s.cam.y) * s.cam.scale > 0.5
      }
    }
    refreshPrediction()
    draw()
    if (s.tick++ % 6 === 0 || !running) writeReadout()
    return running || settling || s.ghosts.length > 0
  }

  const run = useRef({ frame, loadScene, addBody, clearAll, rebuildTimeline, rebase, summarise, draw, writeReadout })
  run.current = { frame, loadScene, addBody, clearAll, rebuildTimeline, rebase, summarise, draw, writeReadout }

  useImperativeHandle(
    ref,
    () => ({
      add: (body) => run.current.addBody(body),
      reset: () => run.current.loadScene(live.current.source),
      clear: () => run.current.clearAll(),
    }),
    [],
  )

  /* ------------------------------------------------------------ effects */

  // Props that seed internal state follow later changes too.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) return
    setSource(bodiesKey ? 'custom' : preset)
  }, [preset, bodiesKey])
  useEffect(() => {
    if (!mounted.current) return
    setTrailsOn(trails !== false && trails !== 0)
  }, [trails])
  useEffect(() => {
    if (mounted.current) setVectors(showVectors)
  }, [showVectors])
  useEffect(() => {
    if (mounted.current) setMarker(showBarycentre)
  }, [showBarycentre])
  useEffect(() => {
    if (mounted.current) setSpeed(timeScale)
  }, [timeScale])
  useEffect(() => {
    if (mounted.current) setMass(launchMass)
  }, [launchMass])
  useEffect(() => {
    mounted.current = true
  }, [])

  // The scene: on mount, on a new preset, on new bodies from code.
  useEffect(() => {
    run.current.loadScene(source)
  }, [source, bodiesKey])

  // Physics changes apply to the system as it stands; the energy reference is re-taken.
  const physicsMounted = useRef(false)
  useEffect(() => {
    if (!physicsMounted.current) {
      physicsMounted.current = true
      return
    }
    const s = sim.current
    accelerate(s.bodies, gravity, softening)
    s.version++
    run.current.rebase()
    if (live.current.reduced) run.current.rebuildTimeline()
    run.current.summarise(`Gravity ${gravity}, softening ${softening}, collisions ${collisions === 'off' ? 'off' : `set to ${collisions}`}`)
    wake.current()
  }, [gravity, softening, collisions])

  // Reduced motion swaps the running loop for a traced, scrubbable timeline.
  useEffect(() => {
    const s = sim.current
    if (reduced) run.current.rebuildTimeline()
    else if (s.timeline) {
      s.timeline = null
      s.paths = []
      s.trails.clear()
    }
    wake.current()
  }, [reduced])

  // Colours from tokens, re-read whenever the theme, accent or mode changes.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const palette = {} as Palette
    for (const paint of Object.keys(TOKENS) as Paint[]) palette[paint] = tokenRgb(stage, TOKENS[paint][0], TOKENS[paint][1])
    sim.current.palette = palette
    wake.current()
  }, [themeVersion])

  // Canvas size, at a device pixel ratio capped at 2.
  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const resize = () => {
      const s = sim.current
      s.w = stage.clientWidth
      s.h = stage.clientHeight
      s.ratio = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.round(s.w * s.ratio))
      const height = Math.max(1, Math.round(s.h * s.ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      if (s.fit && s.w && s.h) s.cam.scale = fitScale()
      wake.current()
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(stage)
    return () => observer?.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // One requestAnimationFrame loop. It runs while the system runs, the camera
  // settles or a ghost trail fades, and parks off screen and in hidden tabs.
  useEffect(() => {
    const s = sim.current
    const stage = stageRef.current
    const tick = (now: number) => {
      s.frame = 0
      const again = run.current.frame(now)
      if (again && s.visible && !document.hidden) s.frame = requestAnimationFrame(tick)
      else s.last = 0
    }
    wake.current = () => {
      if (!s.frame && s.visible && !document.hidden) s.frame = requestAnimationFrame(tick)
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = entry.isIntersecting
            wake.current()
          })
    if (stage) observer?.observe(stage)
    const onVisibility = () => wake.current()
    document.addEventListener('visibilitychange', onVisibility)
    wake.current()
    return () => {
      cancelAnimationFrame(s.frame)
      s.frame = 0
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wake.current = () => {}
    }
  }, [])

  // Anything the loop reads that changed: give it a frame.
  useEffect(() => {
    wake.current()
    if (!paused) sim.current.last = 0
  }, [paused, speed, trailsOn, vectors, marker, mass, reduced])

  // Wheel zoom about the pointer. Native, because React's wheel listener is passive and cannot stop the page scrolling.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const p = local(event)
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      zoomAt(p.x, p.y, Math.exp(-delta * 0.0015))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  })

  /* ------------------------------------------------------------ view */

  const chooseSource = (next: Source) => {
    if (next === source) run.current.loadScene(next)
    else setSource(next)
  }
  const selectedBody = sim.current.bodies.find((b) => b.id === selected)
  const timelineLength = sim.current.timeline?.length ?? 1
  const options = bodiesProp ? [{ value: 'custom' as Source, label: 'Yours' }, ...SOURCE_OPTIONS] : SOURCE_OPTIONS
  const hintId = `${idBase}-hint`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-roledescription="gravity sandbox"
        aria-label={`${label ?? 'Orbit sandbox'}: aim and launch`}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          // Keyboard focus shows the keyboard's aim straight away; a click does not.
          let visible = false
          try {
            visible = event.currentTarget.matches(':focus-visible')
          } catch {
            visible = false
          }
          if (visible) {
            ensureKeyAim()
            sim.current.keyActive = true
            setAimText(describeAim())
            wake.current()
          }
        }}
        onBlur={() => {
          sim.current.keyActive = false
          wake.current()
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endPointer(event, false)}
        onPointerCancel={(event) => endPointer(event, true)}
        className={cn(
          'relative isolate h-[clamp(300px,58vw,460px)] w-full touch-none select-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-sunken',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          dragMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
        )}
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })} />
        <span
          ref={readoutRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3 rounded-[var(--radius-tile)] bg-[color-mix(in_oklab,var(--color-surface)_78%,transparent)] px-2 py-1 font-mono text-[11px] tabular-nums text-ink-soft"
        />
        <span id={hintId} className="sr-only">
          Drag to launch a body; the drag sets its velocity and the dashed line is the path it will take. With this area focused, the arrow keys set
          heading and speed, W A S D move the launch point, and Enter launches. Plus and minus zoom, 0 fits the view, the bracket keys select a body, F
          follows it{reduced ? '' : ', and Space pauses'}.
        </span>
      </div>

      {controls ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!reduced ? (
              <Button size="sm" variant={paused ? 'accent' : 'outline'} onClick={() => setPaused(!paused)} className="min-w-[76px]">
                {paused ? 'Play' : 'Pause'}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={stepOnce} disabled={!reduced && !paused}>
              Step
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run.current.loadScene(source)}>
              Reset
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>
              Clear
            </Button>
            <span className="ml-auto flex items-center gap-1">
              <IconButton icon={ChevronLeftIcon} label="Previous body" size="xs" tone="plain" onClick={() => cycleSelection(-1)} />
              <span className="min-w-[96px] truncate text-center text-[12px] font-semibold text-ink-soft">{selectedBody ? nameOf(selectedBody) : 'None selected'}</span>
              <IconButton icon={ChevronRightIcon} label="Next body" size="xs" tone="plain" onClick={() => cycleSelection(1)} />
              <Button size="sm" variant={follow ? 'accent' : 'outline'} aria-pressed={follow} disabled={selected === null} onClick={() => setFollow(!follow)}>
                Follow
              </Button>
            </span>
          </div>
          <SegmentedControl label="Scene" size="sm" value={source} onValueChange={chooseSource} options={options} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <SegmentedControl
              label="Dragging"
              size="sm"
              value={dragMode}
              onValueChange={setDragMode}
              options={[
                { value: 'launch', label: 'Drag launches' },
                { value: 'pan', label: 'Drag pans' },
              ]}
            />
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={trailsOn} disabled={reduced} onChange={(event) => setTrailsOn(event.target.checked)} />
              Trails
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={vectors} onChange={(event) => setVectors(event.target.checked)} />
              Velocities
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={marker} onChange={(event) => setMarker(event.target.checked)} />
              Barycentre
            </label>
          </div>
          {reduced ? (
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-[12px] font-semibold text-ink-soft">
                Time <span className="font-mono font-normal tabular-nums text-ink-faint">t {(sim.current.timeBase + scrub * sim.current.interval).toFixed(1)}</span>
              </span>
              <Slider
                min={0}
                max={Math.max(1, timelineLength - 1)}
                value={scrub}
                aria-valuetext={`t ${(sim.current.timeBase + scrub * sim.current.interval).toFixed(1)}`}
                onChange={(event) => applySnapshot(Number(event.target.value))}
              />
            </label>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-[12px] font-semibold text-ink-soft">
                New body mass <span className="font-mono font-normal tabular-nums text-ink-faint">{numbers.format(mass)}</span>
              </span>
              <Slider
                min={0}
                max={100}
                value={Math.round((Math.log10(mass / 0.1) / Math.log10(3000)) * 100)}
                aria-valuetext={`mass ${numbers.format(mass)}`}
                onChange={(event) => setMass(Number((0.1 * Math.pow(3000, Number(event.target.value) / 100)).toPrecision(2)))}
              />
            </label>
            {!reduced ? (
              <label className="flex flex-col gap-1.5">
                <span className="flex justify-between text-[12px] font-semibold text-ink-soft">
                  Speed <span className="font-mono font-normal tabular-nums text-ink-faint">{speed.toFixed(2)}×</span>
                </span>
                <Slider
                  min={0}
                  max={100}
                  value={Math.round(((Math.log2(speed) + 2) / 5) * 100)}
                  aria-valuetext={`${speed.toFixed(2)} times`}
                  onChange={(event) => setSpeed(Number(Math.pow(2, (Number(event.target.value) / 100) * 5 - 2).toFixed(2)))}
                />
              </label>
            ) : null}
          </div>
          <p className="text-[12px] leading-relaxed text-ink-faint">
            Drag to launch — the dashed line is where it will go. Shift-drag, or switch to “Drag pans”, to move the view; scroll or pinch to zoom; click a
            body to select it. Focus the sandbox for the keyboard: arrows aim, W A S D move the launch point, Enter launches.
          </p>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {summary}
      </span>
      <span className="sr-only" aria-live="polite">
        {aimText}
      </span>
    </div>
  )
})
