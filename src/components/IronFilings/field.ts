/**
 * The magnetostatics behind IronFilings, as plain numbers with no DOM.
 *
 * Units. Everything here is in “field space”: lengths are fractions of the
 * frame’s shorter side, so a 16:10 frame is 1.6 × 1 and the picture is the same
 * at any size. Magnets are stored as fractions of the frame’s width and height
 * (so they survive a resize) and converted here.
 *
 * Sources. A bar magnet is modelled as two opposite magnetic poles — the
 * “monopole” or Gilbert model — not as one point dipole. That is the honest way
 * to model a school bar magnet: a point dipole B = (3r̂(m·r̂) − m)/|r|³ is the
 * far field of *any* magnet and is exact only at distances much larger than the
 * magnet, which is precisely where filings are not interesting. Near a bar the
 * field visibly comes out of one end and goes into the other, and two point
 * charges at the ends reproduce that; seen from far away the pair’s field tends
 * to the dipole formula anyway, with moment q·d. The poles sit at 5/6 of the
 * half-length from the centre, the textbook “magnetic length” of a bar, which is
 * why the tufts of filings form just beyond the ends rather than at the corners.
 * A true point dipole is also offered (`poles: 'point'`), for a small disc or a
 * compass needle, with the formula above.
 *
 * The poles are point poles in three dimensions seen in the plane of the card,
 * so the field falls as 1/r², which is what a card lying on top of a magnet
 * shows. Every 1/r is softened by a small constant so the field stays finite
 * at a pole; a filing never sits exactly on one anyway, because the magnet body
 * is in the way.
 */

export type IronFilingsPoles = 'bar' | 'point'

export interface IronFilingsMagnet {
  /** Stable key for the magnet and its handles. */
  id: string
  /** Centre, from 0 (left edge of the frame) to 1 (right edge). */
  x: number
  /** Centre, from 0 (top) to 1 (bottom). */
  y: number
  /** Direction the north end points, in degrees clockwise from pointing right. */
  angle: number
  /** Pole strength. 1 is the reference magnet; 0 switches it off; negative swaps the ends. */
  strength?: number
  /** `bar`: two poles near the ends (the school model). `point`: a single point dipole, like a compass needle or a disc magnet. */
  poles?: IronFilingsPoles
  /** Length as a fraction of the frame’s shorter side. Defaults to 0.34; a point magnet uses it for its size and moment. */
  length?: number
  /** Accessible name of the magnet’s handle. Defaults to “Magnet 1”, “Magnet 2”… */
  label?: string
}

/** Extent of the frame in field space: the shorter side is 1. */
export interface FieldBounds {
  width: number
  height: number
}

export interface FieldSource {
  /** Position in field space. */
  x: number
  y: number
  /** Monopole strength: positive is a north pole, negative a south pole, 0 for a dipole. */
  q: number
  /** Dipole moment, zero for a monopole. */
  mx: number
  my: number
  /** A traced field line that comes within this distance has reached the source. */
  radius: number
  /** Which magnet it belongs to. */
  owner: number
}

/** The solid part of a magnet, which filings pile against but cannot enter. */
export interface MagnetBody {
  cx: number
  cy: number
  /** Unit vector along the north axis. */
  ux: number
  uy: number
  /** Half the length along the axis, and half the thickness across it. For a point magnet, the radius (and `halfWidth` is unused). */
  half: number
  halfWidth: number
  round: boolean
}

export interface Vec {
  x: number
  y: number
}

export const DEFAULT_LENGTH = 0.34
/** Thickness of a bar as a fraction of its length. */
export const BAR_ASPECT = 0.27
/** Diameter of a point magnet as a fraction of its `length`. */
export const DISC_SCALE = 0.36
/** Where the effective pole sits, as a fraction of the half-length: the “magnetic length” of a bar. */
const MAGNETIC_LENGTH = 5 / 6
/** Added to every r² so a pole’s field stays finite; about (0.035)². */
const SOFTENING = 0.0012
/** Below this the field has no usable direction: a neutral point, where a traced line must stop. */
const NEUTRAL = 1e-4

const radians = (degrees: number) => (degrees * Math.PI) / 180

export function boundsFor(width: number, height: number): FieldBounds {
  const side = Math.max(1, Math.min(width, height))
  return { width: Math.max(1, width) / side, height: Math.max(1, height) / side }
}

/** The field sources and solid bodies for a set of magnets. */
export function buildSources(magnets: IronFilingsMagnet[], bounds: FieldBounds): { sources: FieldSource[]; bodies: MagnetBody[] } {
  const sources: FieldSource[] = []
  const bodies: MagnetBody[] = []
  magnets.forEach((magnet, owner) => {
    const cx = magnet.x * bounds.width
    const cy = magnet.y * bounds.height
    const theta = radians(magnet.angle)
    const ux = Math.cos(theta)
    const uy = Math.sin(theta)
    const length = Math.max(0.05, magnet.length ?? DEFAULT_LENGTH)
    const strength = magnet.strength ?? 1
    const round = magnet.poles === 'point'
    bodies.push(
      round
        ? { cx, cy, ux, uy, half: (length * DISC_SCALE) / 2, halfWidth: 0, round }
        : { cx, cy, ux, uy, half: length / 2, halfWidth: (length * BAR_ASPECT) / 2, round },
    )
    if (!strength) return
    if (round) {
      // The moment a pole pair of the same strength and length would have (q·d), so switching
      // a magnet between the two models keeps its far field.
      const moment = strength * length * MAGNETIC_LENGTH
      sources.push({ x: cx, y: cy, q: 0, mx: ux * moment, my: uy * moment, radius: (length * DISC_SCALE) / 2, owner })
    } else {
      const reach = (length / 2) * MAGNETIC_LENGTH
      const radius = Math.min(0.045, length * 0.12)
      sources.push({ x: cx + ux * reach, y: cy + uy * reach, q: strength, mx: 0, my: 0, radius, owner })
      sources.push({ x: cx - ux * reach, y: cy - uy * reach, q: -strength, mx: 0, my: 0, radius, owner })
    }
  })
  return { sources, bodies }
}

/**
 * B at (x, y), written into `out`; returns |B|.
 * Monopole: B = q·r̂/r². Point dipole: B = (3r̂(m·r̂) − m)/r³ = (3(m·d)d − m·r²)/r⁵.
 */
export function fieldAt(sources: FieldSource[], x: number, y: number, out: Vec): number {
  let bx = 0
  let by = 0
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]!
    const dx = x - s.x
    const dy = y - s.y
    const r2 = dx * dx + dy * dy + SOFTENING
    const r = Math.sqrt(r2)
    if (s.q !== 0) {
      const k = s.q / (r2 * r)
      bx += k * dx
      by += k * dy
    } else {
      const dot = s.mx * dx + s.my * dy
      const inv5 = 1 / (r2 * r2 * r)
      bx += (3 * dot * dx - s.mx * r2) * inv5
      by += (3 * dot * dy - s.my * r2) * inv5
    }
  }
  out.x = bx
  out.y = by
  return Math.sqrt(bx * bx + by * by)
}

const scratch: Vec = { x: 0, y: 0 }
const magnitude = (sources: FieldSource[], x: number, y: number) => fieldAt(sources, x, y, scratch)

/* ------------------------------------------------------------ field lines */

/**
 * Field lines, traced by fourth-order Runge–Kutta along the unit field direction.
 *
 * A line starts on a small ring round every north pole and follows B̂ until it
 * enters another pole, leaves the frame, or reaches a neutral point where B has
 * no direction. The number of lines from a pole is proportional to its strength,
 * so line density reads as flux, which is what a field-line picture means.
 *
 * Lines that arrive from outside the frame — or from a pole off screen — would be
 * missed that way, so every south pole is traced backwards too; a backward line
 * that ends on a north pole is the same line already drawn forwards and is dropped.
 * RK4 rather than Euler because Euler spirals outwards on closed curves: with a
 * step of 0.007 a line round a bar returns to within a hair of its south pole.
 */
export function traceFieldLines(sources: FieldSource[], bounds: FieldBounds, density = 12): Float32Array[] {
  const lines: Float32Array[] = []
  if (!sources.length) return lines
  const step = 0.007
  const maxSteps = 1100
  const margin = 0.2
  const buffer = new Float32Array(maxSteps + 4)
  const k1: Vec = { x: 0, y: 0 }
  const k2: Vec = { x: 0, y: 0 }
  const k3: Vec = { x: 0, y: 0 }
  const k4: Vec = { x: 0, y: 0 }

  const direction = (x: number, y: number, sign: number, out: Vec) => {
    const m = fieldAt(sources, x, y, out)
    if (m < NEUTRAL) return false
    out.x *= sign / m
    out.y *= sign / m
    return true
  }

  /** Follows the line from (x, y). Returns where it ended: 0 nowhere, 1 a north pole or dipole, −1 a south pole. */
  const trace = (x: number, y: number, sign: number, origin: number) => {
    let n = 0
    buffer[n++] = x
    buffer[n++] = y
    let end = 0
    for (let i = 0; i < maxSteps; i++) {
      if (!direction(x, y, sign, k1)) break
      if (!direction(x + (k1.x * step) / 2, y + (k1.y * step) / 2, sign, k2)) break
      if (!direction(x + (k2.x * step) / 2, y + (k2.y * step) / 2, sign, k3)) break
      if (!direction(x + k3.x * step, y + k3.y * step, sign, k4)) break
      x += (step / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x)
      y += (step / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y)
      if (i % 2 === 1 && n < buffer.length - 2) {
        buffer[n++] = x
        buffer[n++] = y
      }
      if (x < -margin || y < -margin || x > bounds.width + margin || y > bounds.height + margin) break
      let hit = -1
      for (let s = 0; s < sources.length; s++) {
        // A dipole’s lines come back to it, so its own ring only counts once the line has left.
        if (s === origin && i < 12) continue
        const source = sources[s]!
        const dx = x - source.x
        const dy = y - source.y
        if (dx * dx + dy * dy < source.radius * source.radius) {
          hit = s
          break
        }
      }
      if (hit >= 0) {
        const source = sources[hit]!
        if (n < buffer.length - 2) {
          buffer[n++] = source.x
          buffer[n++] = source.y
        }
        end = source.q < 0 ? -1 : 1
        break
      }
    }
    return { points: buffer.slice(0, n), end }
  }

  sources.forEach((source, index) => {
    const dipole = source.q === 0
    const strength = dipole ? Math.hypot(source.mx, source.my) / (DEFAULT_LENGTH * MAGNETIC_LENGTH) : Math.abs(source.q)
    const count = Math.max(4, Math.min(48, Math.round(density * strength * (dipole ? 1.4 : 1))))
    const ring = source.radius * 1.2
    for (let k = 0; k < count; k++) {
      const a = ((k + 0.5) / count) * Math.PI * 2
      const sx = source.x + Math.cos(a) * ring
      const sy = source.y + Math.sin(a) * ring
      if (dipole) {
        // Only where the field leaves the dipole; the rest are the same lines coming home.
        fieldAt(sources, sx, sy, scratch)
        if (scratch.x * Math.cos(a) + scratch.y * Math.sin(a) <= 0) continue
        const line = trace(sx, sy, 1, index)
        if (line.points.length >= 4) lines.push(line.points)
      } else if (source.q > 0) {
        const line = trace(sx, sy, 1, index)
        if (line.points.length >= 4) lines.push(line.points)
      } else {
        const line = trace(sx, sy, -1, index)
        if (line.end === 0 && line.points.length >= 4) lines.push(line.points)
      }
    }
  })
  return lines
}

/* --------------------------------------------------------- neutral points */

/**
 * Points in the frame where the field cancels — between two like poles, most
 * famously. Found by scanning |B| on a coarse grid for local minima and polishing
 * each with a compass search, then kept only if the field really vanishes there:
 * at a true neutral point |B| grows linearly away from it, so the value at the
 * point is tiny next to the value a short distance off, whereas an ordinary
 * weak patch is weak all round.
 */
export function neutralPoints(sources: FieldSource[], bounds: FieldBounds): Vec[] {
  if (sources.length < 2) return []
  const cols = Math.max(8, Math.round(40 * bounds.width))
  const rows = Math.max(8, Math.round(40 * bounds.height))
  const cw = bounds.width / cols
  const ch = bounds.height / rows
  const grid = new Float64Array(cols * rows)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) grid[j * cols + i] = magnitude(sources, (i + 0.5) * cw, (j + 0.5) * ch)
  const found: Vec[] = []
  for (let j = 1; j < rows - 1; j++) {
    for (let i = 1; i < cols - 1; i++) {
      const v = grid[j * cols + i]!
      let minimum = true
      for (let dj = -1; dj <= 1 && minimum; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && grid[(j + dj) * cols + i + di]! < v) minimum = false
      if (!minimum) continue
      let x = (i + 0.5) * cw
      let y = (j + 0.5) * ch
      let best = v
      let h = Math.max(cw, ch)
      for (let iteration = 0; iteration < 80 && h > 1e-5; iteration++) {
        let moved = false
        for (const [dx, dy] of [[h, 0], [-h, 0], [0, h], [0, -h]] as const) {
          const value = magnitude(sources, x + dx, y + dy)
          if (value < best) {
            best = value
            x += dx
            y += dy
            moved = true
            break
          }
        }
        if (!moved) h /= 2
      }
      if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) continue
      // The centre of a softened pole also reads |B| = 0 (its own field vanishes there), so skip its core.
      if (sources.some((s) => Math.hypot(x - s.x, y - s.y) < s.radius * 1.1)) continue
      const around = (magnitude(sources, x + 0.06, y) + magnitude(sources, x - 0.06, y) + magnitude(sources, x, y + 0.06) + magnitude(sources, x, y - 0.06)) / 4
      if (best > around * 0.06) continue
      if (found.some((p) => Math.hypot(p.x - x, p.y - y) < 0.04)) continue
      found.push({ x, y })
    }
  }
  return found
}

/* ------------------------------------------------------- strength shading */

/** |B| on a cols × rows grid, compressed to 0–1 with a saturating curve so the far field still shows. */
export function strengthGrid(sources: FieldSource[], bounds: FieldBounds, cols: number, rows: number): Float32Array {
  const out = new Float32Array(cols * rows)
  for (let j = 0; j < rows; j++) {
    const y = ((j + 0.5) / rows) * bounds.height
    for (let i = 0; i < cols; i++) {
      const m = magnitude(sources, ((i + 0.5) / cols) * bounds.width, y)
      out[j * cols + i] = Math.pow(m / (m + 4), 0.8)
    }
  }
  return out
}

/* ---------------------------------------------------------------- forces */

/**
 * The force magnet `b` feels from magnet `a`, from the pole model: each pole of
 * `b` feels q·B_a. A point dipole feels (m·∇)B_a, taken by central difference.
 */
export function forceBetween(sources: FieldSource[], a: number, b: number): Vec {
  const from = sources.filter((s) => s.owner === a)
  const on = sources.filter((s) => s.owner === b)
  const force: Vec = { x: 0, y: 0 }
  const field: Vec = { x: 0, y: 0 }
  for (const pole of on) {
    if (pole.q !== 0) {
      fieldAt(from, pole.x, pole.y, field)
      force.x += pole.q * field.x
      force.y += pole.q * field.y
    } else {
      const m = Math.hypot(pole.mx, pole.my)
      if (!m) continue
      const e = 0.004
      const ux = pole.mx / m
      const uy = pole.my / m
      fieldAt(from, pole.x + ux * e, pole.y + uy * e, field)
      const fx = field.x
      const fy = field.y
      fieldAt(from, pole.x - ux * e, pole.y - uy * e, field)
      force.x += (m * (fx - field.x)) / (2 * e)
      force.y += (m * (fy - field.y)) / (2 * e)
    }
  }
  return force
}

/* ---------------------------------------------------------------- filings */

export interface FilingSet {
  x: Float32Array
  y: Float32Array
  /** Angle of the filing’s long axis. */
  a: Float32Array
  /** Angular velocity. */
  w: Float32Array
  /** |B| where the filing sits, kept for drawing. */
  b: Float32Array
}

export function createFilings(count: number): FilingSet {
  return {
    x: new Float32Array(count),
    y: new Float32Array(count),
    a: new Float32Array(count),
    w: new Float32Array(count),
    b: new Float32Array(count),
  }
}

/** Positions uniform over the frame, angles uniform: the card after a shake. */
export function scatterFilings(set: FilingSet, bounds: FieldBounds, random: () => number) {
  for (let i = 0; i < set.x.length; i++) {
    set.x[i] = random() * bounds.width
    set.y[i] = random() * bounds.height
    set.a[i] = random() * Math.PI
    set.w[i] = 0
  }
}

/** Every filing turned straight to the field where it lies: the settled state, drawn at once. */
export function alignFilings(set: FilingSet, sources: FieldSource[]) {
  const v: Vec = { x: 0, y: 0 }
  for (let i = 0; i < set.x.length; i++) {
    const m = fieldAt(sources, set.x[i]!, set.y[i]!, v)
    set.b[i] = m
    set.w[i] = 0
    if (m > NEUTRAL) set.a[i] = Math.atan2(v.y, v.x)
  }
}

const inside = (bodies: MagnetBody[], x: number, y: number) => {
  for (const body of bodies) {
    const dx = x - body.cx
    const dy = y - body.cy
    if (body.round) {
      if (dx * dx + dy * dy < body.half * body.half) return true
      continue
    }
    const along = dx * body.ux + dy * body.uy
    const across = -dx * body.uy + dy * body.ux
    if (Math.abs(along) < body.half && Math.abs(across) < body.halfWidth) return true
  }
  return false
}

/** Rotational stiffness: angular acceleration per unit of (saturated) field. */
const STIFFNESS = 60
/** Rotational damping, per second. With the stiffness above, a filing overshoots a little and settles in about half a second. */
const DAMPING = 9
/** Fastest drift towards strong field, in field units per second, when fully agitated. */
const DRIFT = 0.05

/**
 * One step of the filings. Returns the mean angular speed, so the caller can stop
 * the loop once everything has settled.
 *
 * Rotation. An iron filing is magnetised by the field it sits in, along its own
 * length, so the field turns it with a torque proportional to the sine of the
 * angle between them — of twice the angle, because a filing has no north end:
 * pointing along B and pointing against it are the same state, and the doubled
 * angle makes the energy repeat every half-turn, so a filing always turns the
 * short way. The torque grows with |B| but is saturated, because in a strong field
 * a filing is already fully magnetised; that also keeps the integration stable
 * near a pole. Damping stands in for friction with the card.
 *
 * Drift. The force on an induced dipole is ∇(m·B), which points up the gradient
 * of |B|: filings are pulled towards strong field, which is why they gather at
 * the poles. Friction holds a real filing still until the card is tapped, so drift
 * is scaled by `agitation` — high after a shake, a little after a magnet moves,
 * decaying in between. A filing that would enter a magnet’s body stays where it
 * was, so they pile up against the ends in tufts. The gradient costs four more
 * field evaluations, so it is taken for half the filings each frame, alternating
 * by `phase`, and each moves twice as far: the same drift at half the cost.
 */
export function stepFilings(
  set: FilingSet,
  sources: FieldSource[],
  bodies: MagnetBody[],
  bounds: FieldBounds,
  dt: number,
  agitation: number,
  phase = 0,
): number {
  const v: Vec = { x: 0, y: 0 }
  const drifting = agitation > 0.01
  const h = 0.012
  const damp = Math.exp(-DAMPING * dt)
  let spin = 0
  for (let i = 0; i < set.x.length; i++) {
    let x = set.x[i]!
    let y = set.y[i]!
    const m = fieldAt(sources, x, y, v)
    set.b[i] = m
    let a = set.a[i]!
    let w = set.w[i]!
    if (m > NEUTRAL) {
      const phi = Math.atan2(v.y, v.x)
      w += -STIFFNESS * (m / (m + 0.6)) * Math.sin(2 * (a - phi)) * dt
    }
    w *= damp
    if (w > 30) w = 30
    else if (w < -30) w = -30
    a += w * dt
    if (a > Math.PI) a -= Math.PI * 2
    else if (a < -Math.PI) a += Math.PI * 2
    set.a[i] = a
    set.w[i] = w
    spin += Math.abs(w)

    if (drifting && (i & 1) === (phase & 1)) {
      const gx = (magnitude(sources, x + h, y) - magnitude(sources, x - h, y)) / (2 * h)
      const gy = (magnitude(sources, x, y + h) - magnitude(sources, x, y - h)) / (2 * h)
      const g = Math.hypot(gx, gy)
      if (g > 1e-6) {
        const speed = (DRIFT * agitation * g) / (g + 40)
        const nx = Math.min(bounds.width, Math.max(0, x + (gx / g) * speed * 2 * dt))
        const ny = Math.min(bounds.height, Math.max(0, y + (gy / g) * speed * 2 * dt))
        if (!inside(bodies, nx, ny) || inside(bodies, x, y)) {
          x = nx
          y = ny
        }
      }
      set.x[i] = x
      set.y[i] = y
    }
  }
  return set.x.length ? spin / set.x.length : 0
}
