/**
 * Drawing for PendulumWave: the side view through a small perspective camera and the
 * view from above, onto a 2D canvas, in colours read from the theme tokens. Nothing
 * here moves anything — it draws whatever state it is handed — so the component can
 * call it from the loop, from a seek, or once for a reduced-motion still.
 */

import type { PendulumRig, PendulumState } from './pendulums'

/** What the drawing needs to know: the rig, the moment, the after-images and the stage. */
export interface PendulumScene {
  rig: PendulumRig | null
  state: PendulumState | null
  /** TRAIL snapshots of every angle, a ring buffer. */
  ghosts: Float32Array
  ghostHead: number
  ghostCount: number
  palette: Palette
  /** Stage size in CSS pixels. */
  width: number
  height: number
  /** Side-view fit, recomputed when the stage or the rig changes. */
  fit: Fit | null
}

export type Rgb = [number, number, number]

export interface Palette {
  ink: Rgb
  soft: Rgb
  faint: Rgb
  line: Rgb
  accent: Rgb
  surface: Rgb
}

const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const TAU = Math.PI * 2

/** After-images kept for trails, and the simulated time between them: about a third of a second in all. */
export const TRAIL = 14
export const TRAIL_EVERY = 1 / 42

/*
 * The side view is a small perspective camera. World units are the longest string's
 * length; the row runs along z (0 is the nearest end, with the longest pendulum;
 * 1 is the far end, ROW string-lengths away), every pendulum swings along x, and y
 * is up with the bar at 0. The camera stands off the near end at 42° to the row and
 * a little above the bar, where people stand to watch the real apparatus: the row
 * recedes across the stage and the wave runs down it as sideways offsets.
 *
 * The yaw is a trade. End-on (0°) shows the swing at full width but piles every
 * pendulum into one column; broadside (90°) spreads them out but turns the swing
 * straight towards the eye. Around 40° the nearest bob still moves a good third
 * of its full width and neighbours stay clear of each other. The picture is fitted
 * to the stage afterwards, so these numbers set the angle, not the size.
 */
const YAW = (42 * Math.PI) / 180
const DISTANCE = 3.6
const EYE = 0.45
const ROW = 3
const FLOOR = 1.14
const COS_YAW = Math.cos(YAW)
const SIN_YAW = Math.sin(YAW)

function project(x: number, y: number, z: number): [number, number, number] {
  const dz = (z - 0.5) * ROW
  const depth = -x * SIN_YAW + dz * COS_YAW + DISTANCE
  return [(x * COS_YAW + dz * SIN_YAW) / depth, (EYE - y) / depth, 1 / depth]
}

/** Space kept clear at the top of the stage for the figure's name. */
const TOP_INSET = 40

/** Bob radius in string-lengths: a real bob is about a tenth of its string across; smaller when the row is crowded. */
const bobRadius = (count: number) => Math.min(0.05, Math.max(0.022, 0.75 / count))

export interface Fit {
  scale: number
  ox: number
  oy: number
}

/** Scale and offset that fit the whole apparatus, at the furthest the bobs can reach, inside the stage. */
function fitSide(rig: PendulumRig, width: number, height: number): Fit {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const radius = bobRadius(rig.count)
  const include = (x: number, y: number, z: number, r = 0) => {
    const [X, Y, k] = project(x, y, z)
    minX = Math.min(minX, X - r * k)
    maxX = Math.max(maxX, X + r * k)
    minY = Math.min(minY, Y - r * k)
    maxY = Math.max(maxY, Y + r * k)
  }
  const reach = rig.offset / rig.lengths[0]
  for (let n = 0; n < rig.count; n++) {
    const z = n / (rig.count - 1)
    const length = rig.lengths[n] / rig.lengths[0]
    const swing = Math.max(rig.release[n], 0.02)
    include(0, 0, z)
    include(length * Math.sin(swing), -length * Math.cos(swing), z, radius)
    include(-length * Math.sin(swing), -length * Math.cos(swing), z, radius)
    include(0, -length, z, radius)
    include(reach, -FLOOR, z, radius * 1.2)
    include(-reach, -FLOOR, z, radius * 1.2)
  }
  include(0, -FLOOR, -0.06)
  include(0, -FLOOR, 1.06)
  const margin = Math.max(14, Math.min(width, height) * 0.05)
  const spanX = Math.max(1e-6, maxX - minX)
  const spanY = Math.max(1e-6, maxY - minY)
  const room = Math.max(1, height - margin - TOP_INSET)
  const scale = Math.min((width - margin * 2) / spanX, room / spanY)
  return { scale, ox: (width - spanX * scale) / 2 - minX * scale, oy: TOP_INSET + (room - spanY * scale) / 2 - minY * scale }
}


export const FALLBACK: Palette = {
  ink: [30, 32, 34],
  soft: [92, 97, 101],
  faint: [106, 112, 117],
  line: [227, 229, 227],
  accent: [120, 160, 60],
  surface: [255, 255, 255],
}

function bobFill(palette: Palette, index: number, count: number): Rgb {
  const deep = mix(palette.accent, palette.ink, 0.42)
  return mix(palette.accent, deep, count > 1 ? index / (count - 1) : 0)
}

function drawBob(context: CanvasRenderingContext2D, x: number, y: number, r: number, fill: Rgb, palette: Palette) {
  context.beginPath()
  context.arc(x, y, r, 0, TAU)
  context.fillStyle = rgba(fill, 1)
  context.fill()
  context.lineWidth = 1
  context.strokeStyle = rgba(palette.ink, 0.38)
  context.stroke()
  context.beginPath()
  context.arc(x - r * 0.3, y - r * 0.32, r * 0.32, 0, TAU)
  context.fillStyle = rgba(palette.surface, 0.5)
  context.fill()
}

/** The ghosts, newest first, as (age 0–1, angles). */
function forEachGhost(s: PendulumScene, visit: (age: number, offset: number) => void) {
  for (let j = 1; j <= s.ghostCount; j++) {
    const slot = (s.ghostHead - j + TRAIL) % TRAIL
    visit(j / (TRAIL + 1), slot * (s.rig?.count ?? 0))
  }
}

export function drawSide(context: CanvasRenderingContext2D, s: PendulumScene, trails: boolean) {
  const rig = s.rig!
  const state = s.state!
  const palette = s.palette
  const fit = (s.fit ??= fitSide(rig, s.width, s.height))
  const N = rig.count
  const L0 = rig.lengths[0]
  const radius = bobRadius(N)
  const at = (x: number, y: number, z: number): [number, number, number] => {
    const [X, Y, k] = project(x, y, z)
    return [fit.ox + X * fit.scale, fit.oy + Y * fit.scale, k * fit.scale]
  }
  const z = (n: number) => n / (N - 1)
  const bobAt = (n: number, theta: number) => {
    const length = rig.lengths[n] / L0
    return at(length * Math.sin(theta), -length * Math.cos(theta), z(n))
  }

  context.lineCap = 'round'
  context.lineJoin = 'round'

  // Floor line and the far post, behind everything.
  const [nearFootX, nearFootY] = at(0, -FLOOR, -0.06)
  const [farFootX, farFootY] = at(0, -FLOOR, 1.06)
  const [nearTopX, nearTopY, nearK] = at(0, 0, -0.06)
  const [farTopX, farTopY, farK] = at(0, 0, 1.06)
  context.strokeStyle = rgba(palette.line, 1)
  context.lineWidth = 1.5
  context.beginPath()
  context.moveTo(nearFootX, nearFootY)
  context.lineTo(farFootX, farFootY)
  context.stroke()
  context.strokeStyle = rgba(palette.faint, 0.55)
  context.lineWidth = Math.max(1.5, radius * farK * 0.3)
  context.beginPath()
  context.moveTo(farTopX, farTopY)
  context.lineTo(farFootX, farFootY)
  context.stroke()

  // Shadows on the floor: the wave, read as sideways offsets, even from here.
  for (let n = 0; n < N; n++) {
    const length = rig.lengths[n] / L0
    const [x, y, k] = at(length * Math.sin(state.theta[n]), -FLOOR, z(n))
    context.beginPath()
    context.ellipse(x, y, radius * k * 1.15, radius * k * 0.34, 0, 0, TAU)
    context.fillStyle = rgba(palette.ink, 0.08)
    context.fill()
  }

  // The bar the strings hang from.
  context.strokeStyle = rgba(palette.soft, 0.9)
  context.lineWidth = Math.max(2, radius * nearK * 0.34)
  context.beginPath()
  context.moveTo(nearTopX, nearTopY)
  context.lineTo(farTopX, farTopY)
  context.stroke()

  if (trails) {
    forEachGhost(s, (age, offset) => {
      const fade = 0.22 * (1 - age) * (1 - age)
      for (let n = N - 1; n >= 0; n--) {
        const [x, y, k] = bobAt(n, s.ghosts[offset + n])
        context.beginPath()
        context.arc(x, y, radius * k * (1 - age * 0.35), 0, TAU)
        context.fillStyle = rgba(bobFill(palette, n, N), fade)
        context.fill()
      }
    })
  }

  // Far to near, so nearer strings and bobs cover the ones behind.
  for (let n = N - 1; n >= 0; n--) {
    const [px, py, k] = at(0, 0, z(n))
    const [bx, by] = bobAt(n, state.theta[n])
    context.strokeStyle = rgba(palette.faint, 0.75)
    context.lineWidth = Math.max(0.75, radius * k * 0.1)
    context.beginPath()
    context.moveTo(px, py)
    context.lineTo(bx, by)
    context.stroke()
    drawBob(context, bx, by, radius * k, bobFill(palette, n, N), palette)
  }

  // The near post, in front of it all.
  context.strokeStyle = rgba(palette.faint, 0.7)
  context.lineWidth = Math.max(2, radius * nearK * 0.3)
  context.beginPath()
  context.moveTo(nearTopX, nearTopY)
  context.lineTo(nearFootX, nearFootY)
  context.stroke()
}

/**
 * 1 when neighbouring bobs sit close together (a line, a wave), falling towards 0.12
 * as they jump from side to side (rows, chaos). The mean step between neighbours is
 * about 0.3 of the reach on one wave and 1.3 on two rows.
 */
function smoothness(ys: ArrayLike<number>, reach: number): number {
  let total = 0
  for (let i = 1; i < ys.length; i++) total += Math.abs(ys[i] - ys[i - 1])
  const step = total / Math.max(1, ys.length - 1) / Math.max(1e-6, reach)
  return Math.min(1, Math.max(0.12, 1.5 - step * 1.2))
}

/** A smooth curve through the points (Catmull–Rom as cubic Béziers). */
function curveThrough(context: CanvasRenderingContext2D, xs: ArrayLike<number>, ys: ArrayLike<number>) {
  const n = xs.length
  context.beginPath()
  context.moveTo(xs[0], ys[0])
  for (let i = 0; i < n - 1; i++) {
    const a = Math.max(0, i - 1)
    const d = Math.min(n - 1, i + 2)
    context.bezierCurveTo(
      xs[i] + (xs[i + 1] - xs[a]) / 6,
      ys[i] + (ys[i + 1] - ys[a]) / 6,
      xs[i + 1] - (xs[d] - xs[i]) / 6,
      ys[i + 1] - (ys[d] - ys[i]) / 6,
      xs[i + 1],
      ys[i + 1],
    )
  }
}

/*
 * The front view looks down on the row from above, the way the audience in front
 * of the apparatus reads it: the bar runs across, each string is foreshortened to a
 * short needle from its pivot, and each bob sits wherever its swing has carried it.
 * Every bob is drawn at one shared scale — the release offset fills most of the
 * height — so relative positions are true. Longer strings put their bobs further
 * from the eye, so they are drawn a touch smaller.
 */
export function drawFront(context: CanvasRenderingContext2D, s: PendulumScene, trails: boolean) {
  const rig = s.rig!
  const state = s.state!
  const palette = s.palette
  const { width, height } = s
  const N = rig.count
  const marginX = Math.max(24, width * 0.07)
  const span = width - marginX * 2
  const gap = span / (N - 1)
  const radius = Math.min(11, Math.max(3.5, gap * 0.32))
  const bottom = Math.max(14, height * 0.06)
  const middle = (TOP_INSET + height - bottom) / 2
  const reach = Math.max(4, (height - TOP_INSET - bottom) / 2 - radius)
  const scale = rig.offset > 0 ? reach / rig.offset : 0
  const shortest = rig.lengths[N - 1]
  const xs = new Float64Array(N)
  const ys = new Float64Array(N)
  const place = (thetaAt: (n: number) => number) => {
    for (let n = 0; n < N; n++) {
      xs[n] = marginX + n * gap
      ys[n] = middle - rig.lengths[n] * Math.sin(thetaAt(n)) * scale
    }
  }

  context.lineCap = 'round'
  context.lineJoin = 'round'

  // Where the bobs were released from: the line they all return to.
  context.setLineDash([3, 5])
  context.strokeStyle = rgba(palette.line, 1)
  context.lineWidth = 1
  for (const y of [middle - reach, middle + reach]) {
    context.beginPath()
    context.moveTo(marginX - radius, y)
    context.lineTo(width - marginX + radius, y)
    context.stroke()
  }
  context.setLineDash([])

  // The bar, seen from above.
  context.strokeStyle = rgba(palette.soft, 0.55)
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(marginX - radius * 1.6, middle)
  context.lineTo(width - marginX + radius * 1.6, middle)
  context.stroke()

  const deep = mix(palette.accent, palette.ink, 0.35)
  if (trails) {
    forEachGhost(s, (age, offset) => {
      place((n) => s.ghosts[offset + n])
      context.strokeStyle = rgba(deep, 0.2 * (1 - age) * (1 - age) * smoothness(ys, reach))
      context.lineWidth = 1.5
      curveThrough(context, xs, ys)
      context.stroke()
    })
  }

  place((n) => state.theta[n])

  // Strings, foreshortened to needles from each pivot.
  context.strokeStyle = rgba(palette.faint, 0.7)
  context.lineWidth = 1
  for (let n = 0; n < N; n++) {
    context.beginPath()
    context.moveTo(xs[n], middle)
    context.lineTo(xs[n], ys[n])
    context.stroke()
  }
  context.fillStyle = rgba(palette.soft, 0.9)
  for (let n = 0; n < N; n++) {
    context.beginPath()
    context.arc(xs[n], middle, 1.8, 0, TAU)
    context.fill()
  }

  // A guide through the bobs — nothing joins them; it only makes the figure legible,
  // so it fades as neighbours jump apart: bright on a wave, faint on rows and chaos.
  context.strokeStyle = rgba(deep, 0.45 * smoothness(ys, reach))
  context.lineWidth = 1.5
  curveThrough(context, xs, ys)
  context.stroke()

  for (let n = 0; n < N; n++) {
    const r = radius * (0.84 + 0.16 * (shortest / rig.lengths[n]))
    drawBob(context, xs[n], ys[n], r, bobFill(palette, n, N), palette)
  }
}
