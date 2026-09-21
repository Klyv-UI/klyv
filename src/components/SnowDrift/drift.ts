/**
 * The physics behind SnowDrift, as plain numbers with no DOM.
 *
 * Settled snow is a 1D heightfield: one column every SNOW_COLUMN CSS pixels, each holding the y of the highest
 * surface under it (an element’s top edge, or the floor) and the depth of snow on that surface. A flake that lands
 * adds its area to the column it lands in; nothing else ever adds snow.
 *
 * What makes a pile look like snow rather than a bar chart is thermal erosion — Musgrave, Kolb & Mace, “The
 * Synthesis and Rendering of Eroded Fractal Terrains” (SIGGRAPH 1989). Between each pair of neighbouring columns,
 * if the difference in height is steeper than the talus angle, half the excess moves downhill. With the talus set
 * to snow’s angle of repose, a heap spreads into a mound whose flanks stand at that angle, and a flake that lands
 * on a flank sets off a small slide. Where the downhill neighbour is far below — the edge of a card — the material
 * does not slide into it: it goes over the edge and falls, as flakes, onto whatever is underneath.
 *
 * The air is curl noise — Bridson, Hourihan & Nordenstam, “Curl-Noise for Procedural Fluid Flow” (SIGGRAPH 2007).
 * The wind is the curl of a scalar noise field ψ, (∂ψ/∂y, −∂ψ/∂x), which is divergence-free by construction, so it
 * swirls without sources or sinks and flakes never bunch into spots where the air “drains”. Flakes are not
 * advected directly: each has linear drag towards the local air velocity plus its own terminal fall speed, with a
 * response time that grows with size, so small flakes follow every eddy and large ones fall straighter.
 */

/** Width of one heightfield column, in CSS pixels. */
export const SNOW_COLUMN = 2

/** Angle of repose of settled snow, in degrees. Dry snow stands at 35–40°; a little cohesion lets it stand steeper. */
export const REPOSE_DEGREES = 42

/** The greatest height difference two neighbouring columns can hold before snow slides between them. */
const TALUS = Math.tan((REPOSE_DEGREES * Math.PI) / 180) * SNOW_COLUMN

/** A step down between columns deeper than this is a ledge: snow falls off it instead of sliding. */
const LEDGE = 6

/**
 * Neighbouring columns whose ground differs by less than this are the same surface — close enough to share a
 * landing, a smoothing pass and a drawn curve. It is more than a pixel so the curve of a rounded corner still counts.
 */
export const SAME_GROUND = 3

/** How much of the excess over the talus moves per pass. 1 settles a pair at once; lower lets a slide be seen. */
const SLIDE_RATE = 0.45

/**
 * Area of settled snow a flake of radius r becomes. Each flake drawn stands for a puff of many real ones, so it
 * settles into more than its own disc; this is what sets how fast piles grow for a given `intensity`.
 */
export const flakeArea = (radius: number) => 2.8 * radius * radius
export const radiusForArea = (area: number) => Math.sqrt(area / 2.8)

/* ------------------------------------------------------------------ noise */

/** An integer hash to [0, 1). */
function lattice(ix: number, iy: number): number {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Value noise with a smoothstep fade: cheap, smooth, and all curl noise needs as its potential. */
export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = lattice(ix, iy)
  const b = lattice(ix + 1, iy)
  const c = lattice(ix, iy + 1)
  const d = lattice(ix + 1, iy + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** The stream function ψ: two octaves at unrelated scales, drifting with time so the eddies evolve. */
function stream(x: number, y: number, t: number): number {
  return valueNoise(x * 0.0034 + t * 0.05, y * 0.0034 - t * 0.11) + 0.5 * valueNoise(x * 0.0091 - 7.3, y * 0.0091 + t * 0.23 + 3.1)
}

/**
 * Turbulence at (x, y) in pixels per second: the curl of ψ by central differences. `strength` scales it; about 1 is
 * a breezy day.
 */
export function curlAt(x: number, y: number, t: number, strength: number, out: [number, number]) {
  const e = 3
  const scale = (strength * 9000) / (2 * e)
  out[0] = (stream(x, y + e, t) - stream(x, y - e, t)) * scale
  out[1] = -(stream(x + e, y, t) - stream(x - e, y, t)) * scale
}

/* ------------------------------------------------------------------ gusts */

/** A short-lived puff of air: what a pointer sweep, or `gust()`, adds to the wind. */
export interface SnowGust {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  age: number
  life: number
  /** Swirl: positive rolls clockwise. A puff that only pushes looks like a hand, one that rolls looks like air. */
  spin: number
}

/** Add every live gust’s push at (x, y) to `out`. A Gaussian in space, fading linearly over its life. */
export function addGusts(gusts: SnowGust[], x: number, y: number, out: [number, number]) {
  for (const gust of gusts) {
    const dx = x - gust.x
    const dy = y - gust.y
    const r2 = gust.radius * gust.radius
    const d2 = dx * dx + dy * dy
    if (d2 > r2 * 6) continue
    const w = Math.exp(-d2 / r2) * (1 - gust.age / gust.life)
    const roll = (gust.spin * w) / gust.radius
    out[0] += gust.vx * w - dy * roll
    out[1] += gust.vy * w + dx * roll
  }
}

/** Age the gusts and drop the spent ones. They also drift with their own push, a little. */
export function ageGusts(gusts: SnowGust[], dt: number) {
  for (let i = gusts.length - 1; i >= 0; i--) {
    const gust = gusts[i]!
    gust.age += dt
    gust.x += gust.vx * dt * 0.35
    gust.y += gust.vy * dt * 0.35
    if (gust.age >= gust.life) gusts.splice(i, 1)
  }
}

/* ------------------------------------------------------------------ flakes */

/** Flakes in the air, as parallel typed arrays: a thousand objects a frame would be garbage the collector notices. */
export class SnowFlakes {
  readonly capacity: number
  count = 0
  readonly x: Float32Array
  readonly y: Float32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly radius: Float32Array
  readonly phase: Float32Array
  /** Area of snow it becomes when it lands. Kept separately so snow blown off a pile lands as the same amount. */
  readonly mass: Float32Array

  constructor(capacity: number) {
    this.capacity = capacity
    this.x = new Float32Array(capacity)
    this.y = new Float32Array(capacity)
    this.vx = new Float32Array(capacity)
    this.vy = new Float32Array(capacity)
    this.radius = new Float32Array(capacity)
    this.phase = new Float32Array(capacity)
    this.mass = new Float32Array(capacity)
  }

  get full() {
    return this.count >= this.capacity
  }

  spawn(x: number, y: number, vx: number, vy: number, radius: number, phase: number, mass = flakeArea(radius)): boolean {
    if (this.count >= this.capacity) return false
    const i = this.count++
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.radius[i] = radius
    this.phase[i] = phase
    this.mass[i] = mass
    return true
  }

  /** Remove by swapping the last flake into the gap; order does not matter. */
  remove(i: number) {
    const last = --this.count
    if (i === last) return
    this.x[i] = this.x[last]!
    this.y[i] = this.y[last]!
    this.vx[i] = this.vx[last]!
    this.vy[i] = this.vy[last]!
    this.radius[i] = this.radius[last]!
    this.phase[i] = this.phase[last]!
    this.mass[i] = this.mass[last]!
  }

  clear() {
    this.count = 0
  }
}

/** A surface snow can settle on: the top edge of an element, in pixels from the region’s top-left corner. */
export interface SnowSurface {
  left: number
  right: number
  top: number
  /** Corner radius of the top edge. The ground follows the curve, so snow rounds off a card’s corner and slides from it. */
  radius: number
}

/** Called when snow leaves a column as flakes. Return false to refuse (no room), and it settles in place instead. */
export type SnowEmit = (x: number, y: number, direction: number, area: number) => boolean

/* ------------------------------------------------------------------ field */

export class SnowField {
  width = 0
  height = 0
  cols = 0
  /** y of the highest surface in each column: an element’s top edge, or the floor. */
  ground = new Float32Array(0)
  /** 1 where that surface is an element, 0 where it is the floor. */
  onElement = new Uint8Array(0)
  /** Settled snow in each column, in CSS pixels. */
  depth = new Float32Array(0)
  /** `depth` after a display-only smoothing. The physics never reads it. */
  display = new Float32Array(0)
  private scratch = new Float32Array(0)
  private flip = false

  /**
   * Lay the ground from measured surfaces. When the width changes, the snow already settled is resampled onto the
   * new columns by linear interpolation — depth is a height, not a count, so a resize neither adds nor loses snow.
   * Depth stays with its column when the ground under it moves, so snow rides a card that opens or slides down.
   */
  layout(width: number, height: number, surfaces: SnowSurface[]) {
    const cols = Math.max(1, Math.ceil(width / SNOW_COLUMN))
    if (cols !== this.cols) {
      const old = this.depth
      const next = new Float32Array(cols)
      if (old.length > 1) {
        const ratio = (old.length - 1) / Math.max(1, cols - 1)
        for (let c = 0; c < cols; c++) {
          const at = c * ratio
          const i = Math.floor(at)
          const f = at - i
          next[c] = old[i]! * (1 - f) + (old[Math.min(old.length - 1, i + 1)] ?? 0) * f
        }
      }
      this.cols = cols
      this.depth = next
      this.ground = new Float32Array(cols)
      this.onElement = new Uint8Array(cols)
      this.display = new Float32Array(cols)
      this.scratch = new Float32Array(cols)
    }
    this.width = width
    this.height = height
    this.ground.fill(height)
    this.onElement.fill(0)
    for (const surface of surfaces) {
      // A top edge at or above the region’s own top could only hold snow no one can see.
      if (surface.top < 2 || surface.top >= height) continue
      const from = Math.max(0, Math.floor(surface.left / SNOW_COLUMN))
      const to = Math.min(cols - 1, Math.ceil(surface.right / SNOW_COLUMN) - 1)
      const r = Math.max(0, Math.min(surface.radius, (surface.right - surface.left) / 2))
      for (let c = from; c <= to; c++) {
        // Distance in from the nearer side; inside the corner the edge drops away along a quarter circle.
        const inset = Math.min((c + 0.5) * SNOW_COLUMN - surface.left, surface.right - (c + 0.5) * SNOW_COLUMN)
        const dip = inset < r ? r - Math.sqrt(Math.max(0, r * r - (r - Math.max(0, inset)) ** 2)) : 0
        const top = surface.top + dip
        if (top < this.ground[c]!) {
          this.ground[c] = top
          this.onElement[c] = 1
        }
      }
    }
  }

  columnAt(x: number) {
    return Math.floor(x / SNOW_COLUMN)
  }

  /** y of the snow’s surface in a column. */
  top(c: number) {
    return this.ground[c]! - this.depth[c]!
  }

  /** Add an area of snow at a column, spread 1–2–1 over its neighbours on the same ground so a landing is not a spike. */
  deposit(c: number, area: number, maxDepth: number) {
    const h = area / SNOW_COLUMN
    const g = this.ground[c]!
    const left = c > 0 && Math.abs(this.ground[c - 1]! - g) < SAME_GROUND ? c - 1 : c
    const right = c < this.cols - 1 && Math.abs(this.ground[c + 1]! - g) < SAME_GROUND ? c + 1 : c
    this.depth[left] = Math.min(maxDepth, this.depth[left]! + h * 0.25)
    this.depth[c] = Math.min(maxDepth, this.depth[c]! + h * 0.5)
    this.depth[right] = Math.min(maxDepth, this.depth[right]! + h * 0.25)
  }

  /**
   * Thermal erosion: `passes` sweeps over every neighbouring pair, alternating direction so neither way is favoured.
   * Without `emit`, snow that goes over a ledge lands at once on the ground below it — which is where a falling flake
   * would have taken it anyway, just without the fall. Returns true if anything moved.
   */
  relax(passes: number, maxDepth: number, emit?: SnowEmit) {
    const { depth, ground, cols } = this
    let moved = false
    for (let pass = 0; pass < passes; pass++) {
      this.flip = !this.flip
      for (let k = 0; k < cols - 1; k++) {
        const i = this.flip ? k : cols - 2 - k
        const j = i + 1
        // Elevation, counting up: a smaller y is higher.
        const ei = depth[i]! - ground[i]!
        const ej = depth[j]! - ground[j]!
        const from = ei > ej ? i : j
        const to = from === i ? j : i
        const excess = Math.abs(ei - ej) - TALUS
        if (excess <= 0) continue
        const amount = Math.min(depth[from]!, excess * 0.5 * SLIDE_RATE)
        if (amount < 0.002) continue
        moved = true
        depth[from] = depth[from]! - amount
        const drop = ground[to]! - ground[from]!
        if (drop > LEDGE && emit) {
          const edge = Math.max(i, j) * SNOW_COLUMN
          if (emit(edge, ground[from]! - depth[from]! - 1, to > from ? 1 : -1, amount * SNOW_COLUMN)) continue
        }
        depth[to] = Math.min(maxDepth, depth[to]! + amount)
      }
    }
    return moved
  }

  /** Piles sink by `rate` pixels a second, so snow never grows forever. */
  melt(rate: number, dt: number) {
    if (rate <= 0) return
    const drop = rate * dt
    const { depth } = this
    for (let c = 0; c < this.cols; c++) depth[c] = Math.max(0, depth[c]! - drop)
  }

  /**
   * Take snow off every column whose surface is within `radius` of (x, y), up to `amount` pixels deep at the centre,
   * and hand it to `emit` as airborne snow. Anything `emit` refuses stays where it was.
   */
  lift(x: number, y: number, radius: number, amount: number, emit: SnowEmit) {
    const from = Math.max(0, this.columnAt(x - radius))
    const to = Math.min(this.cols - 1, this.columnAt(x + radius))
    let lifted = 0
    for (let c = from; c <= to; c++) {
      const d = this.depth[c]!
      if (d <= 0.05) continue
      const cx = (c + 0.5) * SNOW_COLUMN
      const top = this.ground[c]! - d
      const distance = Math.hypot(cx - x, (top - y) * 0.7)
      if (distance > radius) continue
      const falloff = 1 - distance / radius
      const take = Math.min(d, amount * falloff * falloff)
      if (take < 0.02) continue
      if (!emit(cx, top, Math.sign(cx - x) || 1, take * SNOW_COLUMN)) break
      this.depth[c] = d - take
      lifted += take
    }
    return lifted
  }

  /**
   * An even fall of `amount` pixels on every surface, varied by noise, then relaxed to the angle of repose — what an
   * hour of snow would leave, computed at once. Used for the starting depth and for the reduced-motion still.
   */
  settle(amount: number, maxDepth: number, seed: number) {
    if (!this.cols || amount <= 0) return
    for (let c = 0; c < this.cols; c++) {
      const n = valueNoise(c * 0.045 + seed, seed * 0.37) * 0.7 + valueNoise(c * 0.13 - seed, 1.7) * 0.3
      this.depth[c] = Math.min(maxDepth, this.depth[c]! + amount * (0.55 + 0.9 * n))
    }
    this.relax(90, maxDepth)
  }

  clear() {
    this.depth.fill(0)
    this.display.fill(0)
  }

  get empty() {
    for (let c = 0; c < this.cols; c++) if (this.depth[c]! > 0.05) return false
    return true
  }

  /**
   * Smooth depth for drawing: two 1–2–1 passes that never blur across a change of ground, so a mound rounds off
   * but the snow on a card does not leak onto the floor beside it.
   */
  smooth() {
    const { cols, ground } = this
    let source = this.depth
    for (let pass = 0; pass < 2; pass++) {
      const target = pass === 0 ? this.scratch : this.display
      for (let c = 0; c < cols; c++) {
        const g = ground[c]!
        const here = source[c]!
        const left = c > 0 && Math.abs(ground[c - 1]! - g) < SAME_GROUND ? source[c - 1]! : here
        const right = c < cols - 1 && Math.abs(ground[c + 1]! - g) < SAME_GROUND ? source[c + 1]! : here
        target[c] = (left + 2 * here + right) * 0.25
      }
      source = target
    }
  }
}
