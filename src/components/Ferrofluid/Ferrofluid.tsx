'use client'

import {
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
import {
  UNIT_CHARGE,
  addBall,
  addCone,
  clearGrid,
  contour,
  createMetaGrid,
  fieldAt,
  hexLattice,
  peakTarget,
  sizeGrid,
  type FerrofluidMagnet,
  type FieldSource,
  type Vec3,
} from './field'

export type FerrofluidTone = 'ink' | 'accent'

export interface FerrofluidHandle {
  /** Surge the field for a moment, so spikes near threshold jump up and ring. `amount` 0–2, default 1. */
  pulse: (amount?: number) => void
  /** Put the drop back in the middle, at rest, with its spikes down. */
  reset: () => void
}

export interface FerrofluidProps {
  /**
   * A number of magnets to start with (uncontrolled, 0–6), or the magnets themselves (controlled).
   * Two is the default and the arrangement that reads best: a horseshoe’s north and south ends
   * either side of the drop, which comb both rims into spikes before anyone touches it.
   */
  magnets?: number | FerrofluidMagnet[]
  /** Called with the new magnets whenever one is dragged, follows the pointer or is nudged with the keyboard. */
  onMagnetsChange?: (magnets: FerrofluidMagnet[]) => void
  /** Field strength multiplier for every magnet. Higher raises spikes from further away. At 1 the field reaches critical half the stage’s shorter side from a pole. */
  strength?: number
  /** 0–1. Low rings and wobbles for a long time; high is syrup, with no overshoot. */
  viscosity?: number
  /** Most spikes the drop can grow, 1–60. It also sets the lattice spacing, and with it their length: fewer spikes, a coarser and taller comb. */
  spikes?: number
  /** Fluid colour: the ink token or the accent. The side facing the field always catches the accent. */
  tone?: FerrofluidTone
  /** Pointer and keyboard control. Off, it is a picture driven only by props and the ref. */
  interactive?: boolean
  /** Freeze on the current frame. */
  paused?: boolean
  /** Show the pulse and reset buttons and a readout under the stage. */
  controls?: boolean
  /** Accessible name. An empty string makes the whole thing decorative. */
  label?: string
  /** Merged last, so it wins. The stage is 16:10 unless you give it another aspect ratio. */
  className?: string
}

interface Spike {
  /** Lattice site, relative to the drop’s centre, in pixels. */
  lx: number
  ly: number
  /** Height as a fraction of the tallest a spike can be, and its rate of change per second. */
  h: number
  v: number
  /** Whether it is standing — the hysteresis flag. */
  up: boolean
  /** Its natural frequency relative to the others, so neighbours do not wobble in step. */
  detune: number
  /** The direction it leans in the table’s plane, a unit vector. */
  dx: number
  dy: number
  /** How far it leans over, 0 (standing straight up, seen end-on) to 1 (lying along the table). */
  lean: number
}

type Rgb = [number, number, number]

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))
const rgba = ([r, g, b]: Rgb, alpha = 1) => `rgba(${r},${g},${b},${alpha})`
const fract = (value: number) => value - Math.floor(value)

/** Base radius, tip radius and greatest length of a spike, as multiples of the lattice spacing. */
const SPIKE_BASE = 0.34
const SPIKE_TIP = 0.1
const SPIKE_LENGTH = 2.6
/** Kernel reach for spikes: shorter than the pool’s, so neighbours stay separate until they touch. */
const SPIKE_REACH = 1.3
/**
 * Field concentration at the edge. Field lines crowd where they leave a
 * magnetised body, so the peaks on the rim facing the field stand tallest and
 * those in the middle stay short: length × (EDGE_FLOOR + EDGE_GAIN · how far out
 * towards the field the site sits).
 */
const EDGE_FLOOR = 0.3
const EDGE_GAIN = 1.1
/** Amplitude gain in the bifurcation’s normal form. */
const PEAK_GAIN = 0.55
/** How much of a spike’s triangle comes out of the pool: peaks overlap it, so less than all. */
const SPIKE_VOLUME = 0.5
/** Radius of the drop at rest, as a fraction of the stage’s shorter side. */
const REST_RADIUS = 0.23
/**
 * Contact-line pinning, in units of the stage’s shorter side per second squared.
 *
 * A sessile drop does not slide at the first hint of a force: the contact line
 * sticks until the pull beats the hysteresis of the contact angle. Without it a
 * drop creeps all the way to any magnet in the room and sits against it, where
 * the field lines converge on one point and the peaks fuse into a single spur —
 * which is exactly what a ferrofluid does *not* look like. With it, the drop
 * stays put under a magnet held at arm’s length, grows its crown there, and
 * runs only when one is brought close.
 */
const PINNING = 1.6
/** Cap on what is left after pinning, same units. The field near a pole is violent; a drop is not. */
const PULL_CAP = 0.8

/**
 * Resting places for `count` magnets, keeping any already placed.
 *
 * Two is the interesting default: the north and south ends of one horseshoe,
 * either side of the drop. Their fields add through it into something close to
 * a uniform field, which is the arrangement that combs both rims into spikes
 * rather than pulling them into one spur — and the drop sits in equilibrium
 * between them. Distances are the mid-range where a crown stands: far enough
 * that the field lines through the drop are near parallel, near enough to be
 * well above critical.
 */
function spread(count: number, previous: FerrofluidMagnet[] = []): FerrofluidMagnet[] {
  const n = clamp(Math.round(count), 0, 6)
  const place = (i: number, angle: number, across: number, down: number, polarity: 1 | -1): FerrofluidMagnet =>
    previous[i] ?? { id: `magnet-${i + 1}`, x: 0.5 + Math.cos(angle) * across, y: 0.5 + Math.sin(angle) * down, polarity }
  // The pair sits slightly off level, which fans the comb instead of ruling it into parallel blades.
  if (n === 2) return [place(0, 0.17, 0.375, 0.3, 1), place(1, Math.PI + 0.17, 0.375, 0.3, -1)]
  return Array.from({ length: n }, (_, i) => place(i, -0.4 + (i * Math.PI * 2) / Math.max(1, n), 0.31, 0.4, 1))
}

/**
 * A ramp of one hue from near-black to near-white. The fluid keeps the token’s
 * tint but not its lightness, so it reads as a dark liquid metal in both themes
 * rather than turning pale when the ink does.
 */
function ramp(token: Rgb) {
  const peak = Math.max(1, token[0], token[1], token[2])
  return (level: number): Rgb => [0, 1, 2].map((i) => Math.round(clamp(255 * level * (0.55 + (0.45 * token[i]) / peak), 0, 255))) as Rgb
}

/** Close a loop with quadratic curves through the midpoints, which hides the last trace of the grid. */
function trace(path: Path2D, points: number[]) {
  const n = points.length / 2
  path.moveTo((points[(n - 1) * 2] + points[0]) / 2, (points[(n - 1) * 2 + 1] + points[1]) / 2)
  for (let i = 0; i < n; i++) {
    const j = ((i + 1) % n) * 2
    path.quadraticCurveTo(points[i * 2], points[i * 2 + 1], (points[i * 2] + points[j]) / 2, (points[i * 2 + 1] + points[j + 1]) / 2)
  }
  path.closePath()
}

/**
 * A drop of ferrofluid that grows Rosensweig spikes towards a magnet.
 *
 * Nothing here is keyframed. Each magnet is a pole held just above the table.
 * Every frame their fields are summed as vectors at each site of a hexagonal
 * lattice inside the drop, and the square of the local field over the critical
 * field — the magnetic Bond number — sets a target height: nothing below one,
 * then a peak that grows with the square root of the excess, as the
 * bifurcation’s normal form has it. The bifurcation is subcritical, so a peak
 * appears at a finite height and, once up, holds on until the field falls well
 * below onset: pull a magnet away slowly and the spikes linger, then drop
 * together. Each spike chases its target on a damped spring, so it overshoots,
 * rings and settles; viscosity is the damping.
 *
 * The vertical part of the field stands a peak up; the in-plane part tips it
 * over towards the magnet, so from above it reaches across the table by its
 * height times its lean. Under a magnet the peaks are seen end-on, as a lattice
 * of glinting tips; beside one they lie over into the spikes of the rim, and
 * the rim facing the field, where field lines crowd, grows the longest.
 *
 * The fluid is conserved: the area in the spikes comes out of the pool, so the
 * drop shrinks as they rise. Pool and spikes are implicit shapes — soft balls
 * and tapered cones — summed on a grid, and the outline is their isoline, found
 * by marching squares with linear interpolation, so neighbouring spikes merge
 * into one surface and part again. It is drawn as liquid metal: a near-black
 * body, a specular rim made by stroking the outline offset against the light,
 * and an accent rim on the side facing the field. The drop creeps up the field
 * gradient (the Kelvin force) and can be picked up and thrown. Reduced motion
 * draws the settled shape as a still.
 */
export const Ferrofluid = forwardRef<FerrofluidHandle, FerrofluidProps>(function Ferrofluid(
  {
    magnets: magnetsProp = 2,
    onMagnetsChange,
    strength = 1.3,
    viscosity = 0.35,
    spikes = 19,
    tone = 'ink',
    interactive = true,
    paused = false,
    controls = true,
    label = 'Ferrofluid',
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const hintId = useId()
  const controlled = Array.isArray(magnetsProp) ? magnetsProp : undefined
  const count = typeof magnetsProp === 'number' ? magnetsProp : undefined
  const [internal, setInternal] = useState<FerrofluidMagnet[]>(() => spread(count ?? 2))
  const magnets = controlled ?? internal
  const [announcement, setAnnouncement] = useState('')

  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sim = useRef({
    w: 0,
    h: 0,
    ratio: 1,
    /** Rest radius of the drop, and its radius now that the spikes have taken their share. */
    rest: 0,
    radius: 0,
    /** Lattice spacing: the model’s critical wavelength. */
    spacing: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    spikes: [] as Spike[],
    sources: [] as FieldSource[],
    grid: createMetaGrid(),
    pulse: 0,
    colours: null as null | { deep: Rgb; body: Rgb; sheen: Rgb; edge: Rgb; accent: Rgb },
    frame: 0,
    running: false,
    visible: true,
    placed: false,
    drawn: false,
    /** The drop in the hand: pointer id, grab offset, and the last sample for the throw velocity. */
    grab: null as null | { id: number; ox: number; oy: number; t: number; px: number; py: number },
    magnetDrag: null as null | { id: number; index: number },
    spoken: '',
    spokenAt: 0,
  })
  const live = useRef({ magnets, strength, viscosity, spikes, reduced, paused })
  live.current = { magnets, strength, viscosity, spikes, reduced, paused }
  const wake = useRef<() => void>(() => {})

  // A count that changes keeps the magnets already placed and adds or drops from the end.
  useEffect(() => {
    if (count !== undefined) setInternal((current) => (current.length === Math.round(count) ? current : spread(count, current)))
  }, [count])

  const commit = useCallback(
    (next: FerrofluidMagnet[]) => {
      if (!controlled) setInternal(next)
      onMagnetsChange?.(next)
    },
    [controlled, onMagnetsChange],
  )

  const moveMagnet = useCallback(
    (index: number, x: number, y: number) => {
      const current = live.current.magnets
      if (!current[index]) return
      commit(current.map((magnet, i) => (i === index ? { ...magnet, x: clamp(x, 0, 1), y: clamp(y, 0, 1) } : magnet)))
    },
    [commit],
  )

  /* ------------------------------------------------------------- physics */

  /** Magnets into field units — positions over the stage’s shorter side, charge signed and scaled. Returns the unit. */
  const resolveSources = () => {
    const s = sim.current
    const { magnets: list, strength: gain } = live.current
    const unit = Math.max(1, Math.min(s.w, s.h))
    const surge = 1 + s.pulse
    s.sources = list.map((m) => ({
      x: (m.x * s.w) / unit,
      y: (m.y * s.h) / unit,
      charge: UNIT_CHARGE * gain * (m.strength ?? 1) * (m.polarity ?? 1) * surge,
    }))
    return unit
  }

  /** The lattice: `spikes` sites filling the rest disc, which fixes their spacing. */
  const layout = () => {
    const s = sim.current
    const n = clamp(Math.round(live.current.spikes), 1, 60)
    const rest = Math.min(s.w, s.h) * REST_RADIUS
    s.radius = s.rest && s.radius ? (s.radius * rest) / s.rest : rest
    s.rest = rest
    // n sites of area (√3/2)λ² fill πR², so λ = R·√(2π / (√3·n)).
    s.spacing = rest * Math.sqrt((2 * Math.PI) / (Math.sqrt(3) * n))
    const sites = hexLattice(n, s.spacing)
    const previous = s.spikes
    s.spikes = Array.from({ length: sites.length / 2 }, (_, i) => ({
      lx: sites[i * 2],
      ly: sites[i * 2 + 1],
      h: previous[i]?.h ?? 0,
      v: previous[i]?.v ?? 0,
      up: previous[i]?.up ?? false,
      detune: 0.86 + fract(Math.sin(i * 91.7 + 3.1) * 43758.5453) * 0.28,
      dx: previous[i]?.dx ?? 1,
      dy: previous[i]?.dy ?? 0,
      lean: previous[i]?.lean ?? 0,
    }))
    if (!s.placed) {
      s.x = s.w / 2
      s.y = s.h / 2
      s.placed = true
    }
  }

  const resetDrop = () => {
    const s = sim.current
    s.x = s.w / 2
    s.y = s.h / 2
    s.vx = 0
    s.vy = 0
    s.pulse = 0
    s.radius = s.rest
    for (const spike of s.spikes) {
      spike.h = 0
      spike.v = 0
      spike.up = false
    }
    wake.current()
  }

  /**
   * Advance by `dt`. With `settle`, skip the springs and put every spike at its
   * target with the volume balanced — the frame reduced motion shows.
   */
  const step = (dt: number, settle = false) => {
    const s = sim.current
    if (!s.w || !s.h || !s.spikes.length) return
    const state = live.current
    const unit = resolveSources()
    const probe: Vec3 = { x: 0, y: 0, z: 0 }
    const bond = (px: number, py: number) => {
      const h = fieldAt(s.sources, px / unit, py / unit, probe)
      return h * h
    }

    // The Kelvin force pulls a magnetic fluid up the gradient of H², so the drop is drawn towards the field —
    // but only once that pull beats what pins its contact line, and it stops short rather than swallowing a pole.
    if (!s.grab && !settle) {
      const e = unit * 0.02
      let ax = (bond(s.x + e, s.y) - bond(s.x - e, s.y)) / (2 * e)
      let ay = (bond(s.x, s.y + e) - bond(s.x, s.y - e)) / (2 * e)
      const pull = Math.hypot(ax, ay) * unit * unit * 0.12
      const free = Math.min(unit * PULL_CAP, Math.max(0, pull - unit * PINNING))
      let nearest = Infinity
      for (const m of state.magnets) nearest = Math.min(nearest, Math.hypot(m.x * s.w - s.x, m.y * s.h - s.y))
      // Arrived: the pole is at the drop's edge and the fluid has climbed it. Nothing left to cross.
      const scale = pull > 0 ? (free / pull) * clamp((nearest - s.rest * 1.35) / s.rest, 0, 1) : 0
      ax *= scale
      ay *= scale
      const drag = Math.exp(-dt * (1.1 + state.viscosity * 4))
      s.vx = (s.vx + ax * dt) * drag
      s.vy = (s.vy + ay * dt) * drag
      s.x += s.vx * dt
      s.y += s.vy * dt
    }
    // Walls: the drop bounces off the stage’s edges and loses half its speed doing it.
    const margin = s.radius * 1.05
    if (s.x < margin || s.x > s.w - margin) {
      s.x = clamp(s.x, margin, Math.max(margin, s.w - margin))
      s.vx *= -0.5
    }
    if (s.y < margin || s.y > s.h - margin) {
      s.y = clamp(s.y, margin, Math.max(margin, s.h - margin))
      s.vy *= -0.5
    }

    // Spikes: the Bond number at each site, a target through the hysteretic onset, a damped spring towards it.
    const omega = 13 - state.viscosity * 6
    const zeta = 0.09 + state.viscosity * 0.85
    const e = unit * 0.015
    // The peaks sit on the fluid, so the lattice contracts with the pool.
    const shrink = s.radius / s.rest
    let volume = 0
    for (const spike of s.spikes) {
      const px = s.x + spike.lx * shrink
      const py = s.y + spike.ly * shrink
      const h = fieldAt(s.sources, px / unit, py / unit, probe)
      const flat = Math.hypot(probe.x, probe.y)
      const { height, standing } = peakTarget(h * h, spike.up, PEAK_GAIN)
      spike.up = standing
      if (flat > 1e-6) {
        // Along the field line — an axis — and pointing up the field gradient, into the stronger field.
        // Where the gradient runs across the line (midway between two poles) it cannot choose, so the
        // spike keeps the sense it has rather than flickering between the two.
        let dx = probe.x / flat
        let dy = probe.y / flat
        const gx = bond(px + e, py) - bond(px - e, py)
        const gy = bond(px, py + e) - bond(px, py - e)
        const along = dx * gx + dy * gy
        const decisive = Math.abs(along) > 0.3 * Math.hypot(gx, gy)
        if (decisive ? along < 0 : dx * spike.dx + dy * spike.dy < 0) {
          dx = -dx
          dy = -dy
        }
        // Tipped by the in-plane share of the field, and longest on the rim that faces it.
        const edge = EDGE_FLOOR + EDGE_GAIN * Math.max(0, (spike.lx * dx + spike.ly * dy) / s.rest)
        const lean = (flat / h) * edge
        // A reversal snaps: blending through it would pass near zero and point the spike anywhere.
        const blend = settle || dx * spike.dx + dy * spike.dy < -0.2 ? 1 : 1 - Math.exp(-dt * 14)
        spike.dx += (dx - spike.dx) * blend
        spike.dy += (dy - spike.dy) * blend
        spike.lean += (lean - spike.lean) * blend
        const norm = Math.hypot(spike.dx, spike.dy) || 1
        spike.dx /= norm
        spike.dy /= norm
      }
      if (settle) {
        spike.h = height
        spike.v = 0
      } else {
        const w = omega * spike.detune
        spike.v += (w * w * (height - spike.h) - 2 * zeta * w * spike.v) * dt
        spike.h = Math.max(0, spike.h + spike.v * dt)
      }
      volume += spike.h
    }

    // Conservation: a spike is about a triangle of its base width and height, and that area leaves the pool.
    const drawn = volume * SPIKE_BASE * s.spacing * SPIKE_LENGTH * s.spacing * SPIKE_VOLUME
    const pool = Math.PI * s.rest * s.rest
    const target = Math.sqrt(Math.max(pool * 0.35, pool - drawn) / Math.PI)
    s.radius = settle ? target : s.radius + (target - s.radius) * (1 - Math.exp(-dt * 10))

    if (!settle) s.pulse *= Math.exp(-dt * 2.2)
  }

  /* ------------------------------------------------------------- drawing */

  const draw = () => {
    const canvas = canvasRef.current
    const s = sim.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !s.w || !s.h || !s.colours) return
    s.drawn = true
    const { deep, body, sheen, edge, accent } = s.colours
    const unit = Math.min(s.w, s.h)
    context.setTransform(s.ratio, 0, 0, s.ratio, 0, 0)
    context.clearRect(0, 0, s.w, s.h)

    // The implicit surface: pool and spikes summed on a grid about 1/190 of the stage across —
    // fine enough that a spike’s tip is still a couple of cells wide, below which it breaks off
    // into stray beads as the contour loses the thin part between them.
    const grid = s.grid
    sizeGrid(grid, s.w, s.h, Math.max(2, unit / 190))
    clearGrid(grid)
    const probe: Vec3 = { x: 0, y: 0, z: 0 }
    const centre = fieldAt(s.sources, s.x / unit, s.y / unit, probe)
    const flat = Math.hypot(probe.x, probe.y)
    const ex = flat > 1e-6 ? probe.x / flat : 0
    const ey = flat > 1e-6 ? probe.y / flat : 0
    // The pool stretches a little along the in-plane field, its leading edge slightly thinner: a teardrop.
    const stretch = s.radius * Math.min(0.28, flat * 0.05)
    addBall(grid, s.x - ex * stretch, s.y - ey * stretch, s.radius * 0.9)
    addBall(grid, s.x, s.y, s.radius * 0.96)
    addBall(grid, s.x + ex * stretch, s.y + ey * stretch, s.radius * 0.86)
    const base = s.spacing * SPIKE_BASE
    const tip = s.spacing * SPIKE_TIP
    const tallest = s.spacing * SPIKE_LENGTH
    const shrink = s.radius / s.rest
    // Where each standing peak’s tip is seen from above, for the glints.
    const tips: number[] = []
    for (const spike of s.spikes) {
      if (spike.h < 0.01) continue
      // A spike swells in as it rises, so the surface bulges before it peaks rather than popping.
      const grow = Math.min(1, spike.h / 0.22)
      // Seen from above, a peak of height h leaning by `lean` reaches h·lean across the table.
      const reach = spike.h * tallest * spike.lean
      const ax = s.x + spike.lx * shrink
      const ay = s.y + spike.ly * shrink
      const bx = ax + spike.dx * reach
      const by = ay + spike.dy * reach
      addCone(grid, ax, ay, bx, by, base * grow, Math.min(base * grow, tip), SPIKE_REACH)
      if (spike.h > 0.12) tips.push(bx, by, spike.h)
    }
    const loops = contour(grid)
    if (!loops.length) return
    const path = new Path2D()
    for (const loop of loops) trace(path, loop)

    // Body: a soft shadow to sit it on the table, then a gradient lit from the upper left.
    const r = s.radius
    context.save()
    context.shadowColor = rgba(deep, 0.35)
    context.shadowBlur = r * 0.35 * s.ratio
    context.shadowOffsetY = r * 0.1 * s.ratio
    const fill = context.createRadialGradient(s.x - r * 0.35, s.y - r * 0.45, r * 0.1, s.x, s.y, r * 1.9)
    fill.addColorStop(0, rgba(body))
    fill.addColorStop(0.55, rgba(deep))
    fill.addColorStop(1, rgba(deep))
    context.fillStyle = fill
    context.fill(path, 'evenodd')
    context.restore()

    // Everything else is light on the surface, so it is clipped to it.
    context.save()
    context.clip(path, 'evenodd')
    context.lineJoin = 'round'
    // Specular rim: the outline stroked offset away from the light, so only its lit side lands inside the fluid.
    const lift = Math.max(1.2, unit * 0.006)
    context.translate(lift, lift * 1.2)
    context.lineWidth = lift * 2.2
    context.strokeStyle = rgba(sheen, 0.55)
    context.stroke(path)
    context.translate(-lift * 0.5, -lift * 0.6)
    context.lineWidth = lift * 0.9
    context.strokeStyle = rgba(sheen, 0.95)
    context.stroke(path)
    context.setTransform(s.ratio, 0, 0, s.ratio, 0, 0)
    // The side facing the field catches the accent, as if a coloured lamp stood where the magnet is.
    if (flat > 0.05) {
      const reach = lift * 1.6
      context.translate(-ex * reach, -ey * reach)
      context.lineWidth = reach * 1.6
      context.strokeStyle = rgba(accent, Math.min(0.6, 0.2 + centre * 0.1))
      context.stroke(path)
      context.setTransform(s.ratio, 0, 0, s.ratio, 0, 0)
    }
    // A broad, soft reflection of a window above the table.
    const glint = context.createRadialGradient(s.x - r * 0.4, s.y - r * 0.5, 0, s.x - r * 0.4, s.y - r * 0.5, r * 0.75)
    glint.addColorStop(0, rgba(sheen, 0.28))
    glint.addColorStop(1, rgba(sheen, 0))
    context.fillStyle = glint
    context.fillRect(0, 0, s.w, s.h)
    // Each standing peak catches the light at its tip. Seen end-on under a magnet these are the
    // only sign of the peaks, and they sit on the hexagonal lattice a real Rosensweig pattern has.
    const spot = Math.max(1.5, base * 0.55)
    for (let i = 0; i < tips.length; i += 3) {
      const x = tips[i] - spot * 0.25
      const y = tips[i + 1] - spot * 0.3
      const light = context.createRadialGradient(x, y, 0, x, y, spot)
      light.addColorStop(0, rgba(sheen, Math.min(0.9, tips[i + 2])))
      light.addColorStop(1, rgba(sheen, 0))
      context.fillStyle = light
      context.fillRect(x - spot, y - spot, spot * 2, spot * 2)
    }
    context.restore()

    // A hairline where the fluid meets the table, so a dark drop keeps an edge on a dark theme.
    context.lineWidth = 1
    context.strokeStyle = rgba(edge, 0.45)
    context.stroke(path)
  }

  /* ---------------------------------------------------------------- loop */

  const announce = () => {
    const s = sim.current
    const standing = s.spikes.filter((spike) => spike.h > 0.12).length
    const tallest = s.spikes.reduce((most, spike) => Math.max(most, spike.h), 0)
    const text = standing
      ? `${standing} ${standing === 1 ? 'spike' : 'spikes'} standing, the tallest at ${Math.round(Math.min(1, tallest) * 100)}% of full height`
      : 'Flat: the field is below critical'
    const now = performance.now()
    if (text !== s.spoken && now - s.spokenAt > 900) {
      s.spoken = text
      s.spokenAt = now
      setAnnouncement(text)
    }
  }

  const settle = () => {
    step(0, true)
    draw()
    announce()
  }

  const start = () => {
    const s = sim.current
    const state = live.current
    // Never a blank box: the state as it stands is drawn at once, before the first frame.
    if (!s.drawn) draw()
    if (s.running || state.reduced || state.paused || !s.visible || document.hidden) return
    s.running = true
    let last = performance.now()
    let quiet = 0
    const tick = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      // Two half steps: the springs are stiff enough that one explicit step at 30 fps would ring numerically.
      step(dt / 2)
      step(dt / 2)
      draw()
      announce()
      const moving =
        s.grab || s.magnetDrag || s.pulse > 0.01 || Math.hypot(s.vx, s.vy) > 0.5 || s.spikes.some((spike) => Math.abs(spike.v) > 0.004)
      quiet = moving ? 0 : quiet + dt
      const current = live.current
      // Stop once everything has been still for half a second; any input wakes it again.
      if (quiet < 0.5 && s.visible && !document.hidden && !current.paused && !current.reduced) s.frame = requestAnimationFrame(tick)
      else s.running = false
    }
    s.frame = requestAnimationFrame(tick)
  }

  const pulse = (amount = 1) => {
    sim.current.pulse = clamp(amount, 0, 2) * 0.8
    // Reduced motion: the peak of the surge, drawn as a still until the next change.
    if (live.current.reduced) settle()
    else start()
  }

  // The loop and the handlers read everything through refs, so the latest closures are always the right ones.
  wake.current = () => {
    const state = live.current
    if (state.reduced) settle()
    else if (state.paused) {
      if (!sim.current.drawn) settle()
    } else start()
  }

  useImperativeHandle(ref, () => ({ pulse: (amount?: number) => pulse(amount), reset: () => resetDrop() }))

  /* ------------------------------------------------------------ effects */

  // Size, colours and lattice. Re-run on theme, tone or spike count.
  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const measure = () => {
      const s = sim.current
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return
      if (s.placed && s.w && s.h) {
        s.x *= w / s.w
        s.y *= h / s.h
      }
      s.w = w
      s.h = h
      s.ratio = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * s.ratio)
      canvas.height = Math.round(h * s.ratio)
      const ink = tokenRgb(stage, tone === 'accent' ? '--color-accent' : '--color-ink', [30, 32, 36])
      const accent = tokenRgb(stage, '--color-accent', [200, 240, 80])
      const shade = ramp(ink)
      s.colours = { deep: shade(0.05), body: shade(0.3), sheen: shade(0.96), edge: shade(0.5), accent }
      layout()
      // A resize clears the canvas, so a paused or finished drop is drawn again at once.
      if (s.running) return
      if (live.current.paused && s.drawn) draw()
      else wake.current()
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(stage)
    return () => observer?.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, themeVersion, spikes])

  // Anything the physics reads has changed: run, or draw the new still.
  useEffect(() => {
    if (reduced) sim.current.pulse = 0
    wake.current()
  }, [magnets, strength, viscosity, reduced, paused])

  // Park the loop off screen and in hidden tabs.
  useEffect(() => {
    const stage = stageRef.current
    const s = sim.current
    const resume = () => {
      if (s.visible && !document.hidden) wake.current()
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = Boolean(entry?.isIntersecting)
            resume()
          })
    if (stage) observer?.observe(stage)
    document.addEventListener('visibilitychange', resume)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', resume)
      cancelAnimationFrame(s.frame)
      s.running = false
    }
  }, [])

  /* ------------------------------------------------------------- pointer */

  const pointOf = (event: { clientX: number; clientY: number }) => {
    const box = stageRef.current?.getBoundingClientRect()
    if (!box || !box.width || !box.height) return null
    return { x: event.clientX - box.left, y: event.clientY - box.top, w: box.width, h: box.height }
  }

  const onStageDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button > 0) return
    const point = pointOf(event)
    if (!point) return
    const s = sim.current
    event.currentTarget.setPointerCapture(event.pointerId)
    if (Math.hypot(point.x - s.x, point.y - s.y) < s.radius * 1.15 && !reduced && !paused) {
      s.grab = { id: event.pointerId, ox: s.x - point.x, oy: s.y - point.y, t: performance.now(), px: point.x, py: point.y }
      s.vx = 0
      s.vy = 0
      wake.current()
    } else if (magnets.length) {
      s.magnetDrag = { id: event.pointerId, index: 0 }
      moveMagnet(0, point.x / point.w, point.y / point.h)
    }
  }

  const onStageMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return
    const point = pointOf(event)
    if (!point) return
    const s = sim.current
    if (s.grab?.id === event.pointerId) {
      const now = performance.now()
      const dt = Math.max(0.004, (now - s.grab.t) / 1000)
      // Throw velocity, smoothed over the last few moves so a flick is not one noisy sample.
      s.vx = s.vx * 0.4 + ((point.x - s.grab.px) / dt) * 0.6
      s.vy = s.vy * 0.4 + ((point.y - s.grab.py) / dt) * 0.6
      s.grab.t = now
      s.grab.px = point.x
      s.grab.py = point.y
      s.x = point.x + s.grab.ox
      s.y = point.y + s.grab.oy
      wake.current()
      return
    }
    // The first magnet follows a hovering mouse; touch and pen move it only while pressed.
    const pressed = s.magnetDrag?.id === event.pointerId && s.magnetDrag.index === 0
    if (pressed || (event.pointerType === 'mouse' && !s.grab && !s.magnetDrag)) moveMagnet(0, point.x / point.w, point.y / point.h)
  }

  const onStageUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = sim.current
    if (s.grab?.id === event.pointerId) {
      // A release after a pause is a set-down, not a throw.
      if (performance.now() - s.grab.t > 80) {
        s.vx = 0
        s.vy = 0
      }
      const cap = Math.min(s.w, s.h) * 4
      const speed = Math.hypot(s.vx, s.vy)
      if (speed > cap) {
        s.vx *= cap / speed
        s.vy *= cap / speed
      }
      s.grab = null
    }
    if (s.magnetDrag?.id === event.pointerId) s.magnetDrag = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    wake.current()
  }

  const onPuckDown = (index: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!interactive) return
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    sim.current.magnetDrag = { id: event.pointerId, index }
    wake.current()
  }
  const onPuckMove = (index: number) => (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation()
    if (sim.current.magnetDrag?.id !== event.pointerId) return
    const point = pointOf(event)
    if (point) moveMagnet(index, point.x / point.w, point.y / point.h)
  }
  const onPuckUp = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation()
    sim.current.magnetDrag = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    wake.current()
  }

  /* ------------------------------------------------------------ keyboard */

  /** Arrow keys move a magnet a fortieth of the stage, a tenth with Shift. True when the key was used. */
  const nudge = (index: number, event: KeyboardEvent) => {
    const distance = event.shiftKey ? 0.1 : 0.025
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-distance, 0],
      ArrowRight: [distance, 0],
      ArrowUp: [0, -distance],
      ArrowDown: [0, distance],
    }
    const move = moves[event.key]
    const magnet = magnets[index]
    if (!move || !magnet) return false
    moveMagnet(index, magnet.x + move[0], magnet.y + move[1])
    return true
  }

  const onStageKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'p' || event.key === 'P') {
      event.preventDefault()
      if (!paused) pulse()
    } else if (nudge(0, event)) event.preventDefault()
  }

  const onPuckKey = (index: number) => (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation()
    if (nudge(index, event)) event.preventDefault()
  }

  /* ---------------------------------------------------------------- view */

  const decorative = !label
  const focusable = interactive && !decorative
  const puckLabel = (magnet: FerrofluidMagnet, index: number) =>
    `${magnet.label ?? `Magnet ${index + 1}`}${magnet.polarity === -1 ? ', south pole' : ''}: ${Math.round(magnet.x * 100)}% across, ${Math.round(magnet.y * 100)}% down`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div
        ref={stageRef}
        tabIndex={focusable ? 0 : undefined}
        role={decorative ? undefined : focusable ? 'group' : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
        aria-describedby={focusable ? hintId : undefined}
        aria-keyshortcuts={focusable ? 'ArrowUp ArrowDown ArrowLeft ArrowRight P' : undefined}
        onKeyDown={focusable ? onStageKey : undefined}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={onStageUp}
        className={cn(
          'relative isolate aspect-[16/10] w-full select-none overflow-hidden rounded-[var(--radius-card)] border border-line',
          'bg-[radial-gradient(90%_80%_at_50%_45%,var(--color-surface),var(--color-surface-sunken))]',
          interactive && 'cursor-crosshair touch-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 block size-full" />
        {focusable && (
          <span id={hintId} className="sr-only">
            The first magnet follows the pointer; arrow keys move it, with Shift for bigger steps, and P pulses the field. Each magnet
            is also a button the arrow keys move. Drag the drop to throw it.
          </span>
        )}
        {magnets.map((magnet, index) => {
          const position = { left: `${clamp(magnet.x, 0, 1) * 100}%`, top: `${clamp(magnet.y, 0, 1) * 100}%` }
          const puckClass = cn(
            'absolute z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full',
            interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
          )
          const face = (
            <>
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_45%,transparent),transparent_70%)]"
              />
              <span
                aria-hidden="true"
                className="relative grid size-5 place-items-center rounded-full border-2 border-surface bg-ink text-[9px] font-bold leading-none text-ink-inverse shadow-[var(--shadow-card)] ring-1 ring-line-strong"
              >
                {magnet.polarity === -1 ? 'S' : 'N'}
              </span>
            </>
          )
          const handlers = {
            onPointerDown: onPuckDown(index),
            onPointerMove: onPuckMove(index),
            onPointerUp: onPuckUp,
            onPointerCancel: onPuckUp,
          }
          // A real button only where it can be reached; otherwise the puck is part of the picture.
          return focusable ? (
            <button
              key={magnet.id}
              type="button"
              aria-label={puckLabel(magnet, index)}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
              onKeyDown={onPuckKey(index)}
              style={position}
              className={cn(puckClass, 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus')}
              {...handlers}
            >
              {face}
            </button>
          ) : (
            <span key={magnet.id} aria-hidden="true" style={position} className={puckClass} {...handlers}>
              {face}
            </span>
          )
        })}
      </div>

      {controls && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="accent" onClick={() => pulse()} disabled={paused}>
            Pulse the field
          </Button>
          <Button size="sm" variant="ghost" onClick={resetDrop}>
            Reset the drop
          </Button>
          <span className="ml-auto text-[12px] tabular-nums text-ink-faint" aria-hidden="true">
            {announcement}
          </span>
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
})
