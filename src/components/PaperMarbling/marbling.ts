/**
 * The maths behind PaperMarbling, as plain numbers with no DOM.
 *
 * Ebru — Turkish paper marbling — is not painting. Ink floats on a thickened
 * bath; every new drop *pushes* the ink already there outwards, and a stylus
 * drawn through the bath drags ink along with it in a wake that fades with
 * distance. Aubrey Jaffer’s “Mathematical Marbling” (IEEE Computer Graphics
 * and Applications 32(6), 2012) writes both of those as closed-form maps of
 * the plane, and that is what makes this cheap and exact: the ink is a list
 * of closed polygons, and every operation is one pass over every vertex.
 * Nothing is rasterised, diffused or blurred into place.
 *
 * Coordinates. The bath is `width` wide and exactly 1 tall, so a circle is a
 * circle whatever the paper’s shape. Operations are stored with x as a
 * fraction of the width and y as a fraction of the height, so a stored list
 * of operations replays onto a bath of any size.
 */

export type PaperMarblingPattern = 'free' | 'stone' | 'gel-git' | 'nonpareil' | 'bouquet'

/** A drop of ink. */
export interface MarbleDrop {
  kind: 'drop'
  /** Centre, 0–1 across the paper. */
  x: number
  /** Centre, 0–1 down the paper. */
  y: number
  /** Radius, as a fraction of the paper’s height. */
  radius: number
  /** Index into the palette. */
  color: number
}

/** One stroke of a stylus (a single tine), straight or wavy. */
export interface MarbleTine {
  kind: 'tine'
  /** A point the stroke passes through, 0–1 across the paper. */
  x: number
  /** A point the stroke passes through, 0–1 down the paper. */
  y: number
  /** Unit direction of the drag, in bath units (y points down). */
  dx: number
  dy: number
  /** How far ink on the stroke moves, as a fraction of the paper’s height. */
  shift: number
  /** Fraction of the shift left one `spacing` away from the stroke: Jaffer’s λ, 0–1. */
  decay: number
  /** The falloff length, Jaffer’s α, as a fraction of the paper’s height. */
  spacing: number
  /** Sine amplitude across the stroke. 0 is a straight tine. */
  amplitude: number
  /** Sine wavelength along the stroke. */
  wavelength: number
  /** Sine phase, in radians. */
  phase: number
}

export type MarbleOp = MarbleDrop | MarbleTine

/** One colour of ink on the bath: a closed polygon, flattened as x0, y0, x1, y1, … */
export interface Ink {
  color: number
  pts: number[]
}

export interface Bath {
  /** Width in bath units. The height is 1, so this is also the aspect ratio. */
  width: number
  /** Longest edge allowed between two vertices, in bath units. */
  detail: number
  /** Vertices allowed across every ink before refinement stops. */
  budget: number
}

/* ------------------------------------------------------------ operators */

/** A polygon approximating a circle, with edges no longer than `detail`. */
export function circlePolygon(cx: number, cy: number, r: number, detail: number): number[] {
  const n = Math.max(24, Math.min(720, Math.ceil((2 * Math.PI * r) / Math.max(detail, 1e-4))))
  const pts = new Array<number>(n * 2)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts[i * 2] = cx + Math.cos(a) * r
    pts[i * 2 + 1] = cy + Math.sin(a) * r
  }
  return pts
}

/**
 * A drop of radius r at C, as a map of the whole plane.
 *
 * The drop takes up a disc of area πr² that was not there before, so every
 * other point must move outwards to make room — and because the bath is
 * incompressible, the disc of radius d around C that a point used to bound
 * has to keep its area once the drop is inside it. That forces
 * |P′−C|² = d² + r², which is
 *
 *     P′ = C + (P−C)·√(1 + r²/|P−C|²)
 *
 * Exact and area-preserving. It is also why old drops become perfect
 * concentric rings around a new one, thinning as they stretch round it,
 * instead of being merely shoved aside.
 */
export function pushDrop(inks: Ink[], cx: number, cy: number, r: number) {
  const r2 = r * r
  for (const ink of inks) {
    const p = ink.pts
    for (let i = 0; i < p.length; i += 2) {
      const dx = p[i] - cx
      const dy = p[i + 1] - cy
      const d2 = dx * dx + dy * dy
      // A vertex exactly under the new drop has no outward direction. Any
      // point on the rim is a correct image of it; pick one.
      if (d2 < 1e-14) {
        p[i] = cx + r
        continue
      }
      const s = Math.sqrt(1 + r2 / d2)
      p[i] = cx + dx * s
      p[i + 1] = cy + dy * s
    }
  }
}

/**
 * A tine drawn through the bath along a line, as a map of the whole plane.
 *
 * Ink under the stylus travels with it; ink further off is dragged less.
 * Jaffer takes that falloff as λ^(d/α) — at distance α a fraction λ of the
 * shift is left, at 2α λ², and so on — and moves points *along* the stroke:
 *
 *     P′ = P + M·u·λ^(|d|/α),   d = (P−B)·N
 *
 * with B a point on the line, M its unit direction, N its unit normal and u
 * the shift. Every point moves parallel to M by an amount that depends only on
 * its distance across the line, so the map is a shear: one-to-one, and it
 * preserves area exactly, like the drop.
 *
 * With `amplitude` set, the stroke is a sine along its own length and d is
 * measured from the wave instead of the straight line. That is the wavy comb
 * the bouquet pattern is finished with. It is no longer a pure shear, so it
 * only approximately preserves area — as a real wavy stroke only approximately
 * follows its sine.
 */
export function dragTine(inks: Ink[], op: MarbleTine, width: number, amount = 1) {
  const bx = op.x * width
  const by = op.y
  const length = Math.hypot(op.dx, op.dy) || 1
  const mx = op.dx / length
  const my = op.dy / length
  const nx = -my
  const ny = mx
  const u = op.shift * amount
  if (Math.abs(u) < 1e-9) return
  // λ^(d/α) = e^(d·ln λ / α): one exp per vertex instead of a pow.
  const k = Math.log(Math.min(0.999, Math.max(1e-4, op.decay))) / Math.max(op.spacing, 1e-4)
  const wavy = op.amplitude !== 0 && op.wavelength > 1e-6
  const w = wavy ? (Math.PI * 2) / op.wavelength : 0
  for (const ink of inks) {
    const p = ink.pts
    for (let i = 0; i < p.length; i += 2) {
      const px = p[i] - bx
      const py = p[i + 1] - by
      let d = px * nx + py * ny
      if (wavy) d -= op.amplitude * Math.sin(w * (px * mx + py * my) + op.phase)
      const f = u * Math.exp(k * Math.abs(d))
      p[i] += mx * f
      p[i + 1] += my * f
    }
  }
}

/**
 * Split every edge longer than `detail` so a stretched drop stays smooth.
 *
 * Both maps bend straight edges into curves, and after a comb a drop that
 * started as a few hundred vertices can be a filament thousands of vertices
 * long. Splitting after each operation keeps the error at one operation’s
 * worth of bending, which at this edge length is under a device pixel. Edges
 * that lie wholly off the paper are left alone — they are still part of the
 * outline, but nobody sees their curvature — and the refinement stops once
 * the whole bath reaches `budget` vertices, trading smoothness for frame time.
 */
export function refine(inks: Ink[], bath: Bath) {
  let total = 0
  for (const ink of inks) total += ink.pts.length / 2
  if (total >= bath.budget) return
  const max2 = bath.detail * bath.detail
  const margin = 0.1
  const left = -margin
  const right = bath.width + margin
  const top = -margin
  const bottom = 1 + margin
  const outside = (x: number, y: number) => x < left || x > right || y < top || y > bottom
  const cap = Math.max(4000, bath.budget / 3)
  for (const ink of inks) {
    const pts = ink.pts
    const n = pts.length / 2
    if (n < 3 || n >= cap) continue
    let out: number[] | null = null
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2]
      const y0 = pts[i * 2 + 1]
      const j = i + 1 === n ? 0 : i + 1
      const x1 = pts[j * 2]
      const y1 = pts[j * 2 + 1]
      const dx = x1 - x0
      const dy = y1 - y0
      const d2 = dx * dx + dy * dy
      const split = d2 > max2 && !(outside(x0, y0) && outside(x1, y1))
      if (split && !out) out = pts.slice(0, i * 2)
      if (out) {
        out.push(x0, y0)
        if (split) {
          const steps = Math.min(24, Math.ceil(Math.sqrt(d2 / max2)))
          for (let s = 1; s < steps; s++) out.push(x0 + (dx * s) / steps, y0 + (dy * s) / steps)
        }
      }
    }
    if (out) ink.pts = out
  }
}

/**
 * Apply one operation to the bath in place. `amount` (0–1) scales the drop’s
 * radius or the tine’s shift, which is how the component tweens an operation:
 * it re-applies the partial operation to a copy of the settled bath each frame.
 */
export function applyOp(inks: Ink[], op: MarbleOp, bath: Bath, amount = 1) {
  if (op.kind === 'drop') {
    // Area grows linearly with the tween, as a drop spreading at a steady
    // rate would, so the radius goes as the square root.
    const r = op.radius * Math.sqrt(Math.max(0, Math.min(1, amount)))
    if (r < 1e-5) return
    const cx = op.x * bath.width
    pushDrop(inks, cx, op.y, r)
    inks.push({ color: op.color, pts: circlePolygon(cx, op.y, r, bath.detail) })
  } else {
    dragTine(inks, op, bath.width, amount)
  }
  refine(inks, bath)
}

/** Every operation from an empty bath. Exact, because each operator is. */
export function replay(ops: readonly MarbleOp[], bath: Bath): Ink[] {
  const inks: Ink[] = []
  for (const op of ops) applyOp(inks, op, bath)
  return inks
}

export const cloneInks = (inks: readonly Ink[]): Ink[] => inks.map((ink) => ({ color: ink.color, pts: ink.pts.slice() }))

/* ---------------------------------------------------------------- recipes */

/** Mulberry32: a tiny seeded generator, so a pattern replays identically. */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Battal — the “stone” ground every other pattern starts from: drops of each
 * colour in turn, scattered over a jittered grid so they tile the bath
 * without landing in reading order.
 */
function stone(next: () => number, colors: number, count: number, size: number, width: number): MarbleDrop[] {
  const cols = Math.max(2, Math.round(Math.sqrt(count * width)))
  const rows = Math.max(2, Math.ceil(count / cols))
  const cells: [number, number][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r])
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  const ops: MarbleDrop[] = []
  for (let i = 0; i < count; i++) {
    const [c, r] = cells[i % cells.length]
    ops.push({
      kind: 'drop',
      x: (c + 0.5 + (next() - 0.5) * 0.8) / cols,
      y: (r + 0.5 + (next() - 0.5) * 0.8) / rows,
      radius: size * (0.7 + next() * 0.65),
      color: i % colors,
    })
  }
  return ops
}

interface CombOptions {
  /** 'down' strokes run top to bottom and are spaced across; 'across' run left to right and are spaced down. */
  axis: 'down' | 'across'
  /** Distance between teeth, in bath units. */
  pitch: number
  /** Bath width, to lay teeth across the whole paper. */
  width: number
  shift: number
  spacing: number
  decay: number
  /** Reverse every other tooth: the stylus going and coming back. */
  alternate: boolean
  amplitude?: number
  wavelength?: number
}

/**
 * A comb: one tine per tooth, applied a tooth at a time.
 *
 * A real comb’s teeth move together, but Jaffer applies tine lines one after
 * another, and with this pitch and shift the difference is not visible. It is
 * also what lets a recipe play back tooth by tooth, which is how a marbler
 * working with a single stylus would make it anyway.
 */
function comb({ axis, pitch, width, shift, spacing, decay, alternate, amplitude = 0, wavelength = 0.3 }: CombOptions): MarbleTine[] {
  const span = axis === 'down' ? width : 1
  const teeth = Math.max(3, Math.round(span / pitch))
  const gap = span / teeth
  const ops: MarbleTine[] = []
  for (let k = 0; k < teeth; k++) {
    const sign = alternate && k % 2 === 1 ? -1 : 1
    const along = (k + 0.5) * gap
    ops.push({
      kind: 'tine',
      x: axis === 'down' ? along / width : 0.5,
      y: axis === 'down' ? 0.5 : along,
      dx: axis === 'down' ? 0 : sign,
      dy: axis === 'down' ? sign : 0,
      shift,
      decay,
      spacing,
      amplitude,
      wavelength,
      phase: 0,
    })
  }
  return ops
}

/**
 * The operations for a historical pattern, built for a bath of this width.
 *
 * - **stone** (battal): drops alone.
 * - **gel-git** (“come-go”): stone, then a stylus drawn down and back up in
 *   parallel strokes across the whole bath.
 * - **nonpareil**: gel-git, then one pass of a fine comb at right angles,
 *   which pulls every stripe into the small repeated chevrons it is named for.
 * - **bouquet**: nonpareil, then a wide comb drawn back and forth in wavy
 *   strokes, which gathers the chevrons into the fan-shaped “flowers”.
 * - **free**: a few drops to start from.
 */
export function recipeFor(pattern: PaperMarblingPattern, colors: number, width: number, seed = 1): MarbleOp[] {
  const next = random(seed * 2654435761)
  const n = Math.max(1, colors)
  const w = Math.max(0.2, width)
  if (pattern === 'free') return stone(next, n, 5, 0.13, w)
  if (pattern === 'stone') return stone(next, n, Math.round(12 * w), 0.11, w)
  const ground = stone(next, n, Math.round(9 * w), 0.1, w)
  const gelGit = comb({ axis: 'down', pitch: 0.12, width: w, shift: 0.26, spacing: 0.05, decay: 0.2, alternate: true })
  if (pattern === 'gel-git') return [...ground, ...gelGit]
  const fine = comb({ axis: 'across', pitch: 0.065, width: w, shift: 0.05, spacing: 0.024, decay: 0.22, alternate: false })
  if (pattern === 'nonpareil') return [...ground, ...gelGit, ...fine]
  const wide = comb({ axis: 'down', pitch: 0.24, width: w, shift: 0.15, spacing: 0.09, decay: 0.4, alternate: true, amplitude: 0.035, wavelength: 0.33 })
  return [...ground, ...gelGit, ...fine, ...wide]
}

export const PATTERN_NAMES: Record<PaperMarblingPattern, string> = {
  free: 'Freehand',
  stone: 'Stone (battal)',
  'gel-git': 'Gel-git',
  nonpareil: 'Nonpareil',
  bouquet: 'Bouquet',
}
