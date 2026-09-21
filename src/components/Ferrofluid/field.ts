/**
 * The maths behind Ferrofluid, as plain numbers with no DOM.
 *
 * Three parts, each the real thing at a size a frame can afford:
 *
 * 1. The magnetic field. Each magnet is the near pole of a bar magnet held a
 *    little above the table — a monopole of strength s at height z₀ — so on the
 *    table, at horizontal offset ρ from it,
 *      H = s · (ρ, −z₀) / (|ρ|² + z₀²)^{3/2},   |H| = s / (|ρ|² + z₀²).
 *    The vertical part stands peaks straight up out of the table; the
 *    horizontal part tips them towards the magnet. Right under a magnet the
 *    field is nearly vertical and the peaks are seen end-on, as the hexagonal
 *    array of tips a real Rosensweig pattern shows from above; off to the side
 *    it is nearly horizontal and they lean over into the spikes of the rim.
 *    Fields are summed as vectors, not magnitudes: between two like poles the
 *    sideways parts cancel and the peaks stand up, and between opposite ones
 *    the field runs straight across and they comb out towards both.
 *
 * 2. The Rosensweig (normal-field) instability. A ferrofluid surface is flat
 *    until the magnetic pressure beats gravity plus surface tension; the ratio
 *    is the magnetic Bond number N = H² / H꜀². Above N = 1 the surface breaks
 *    into peaks on a hexagonal lattice whose spacing is the critical wavelength
 *    λ꜀ = 2π√(σ/ρg). The bifurcation is subcritical: once standing, peaks survive
 *    until the field drops well below the onset (Cowley & Rosensweig, 1967),
 *    so a spike keeps a memory of having stood. `CRITICAL_DOWN` is that lower edge.
 *
 * 3. The surface. The pool is a few soft balls and each spike a tapered cone,
 *    all as compact polynomial kernels (1 − q²)³ of the distance to a point or a
 *    segment, summed on a grid — and the outline is the 0.5 isoline, extracted
 *    by marching squares with linear interpolation along each cell edge. The
 *    segments are chained by the edge they cross, which is exact (no coordinate
 *    hashing) and gives closed loops with the fluid always on the left.
 */

export interface FerrofluidMagnet {
  /** Stable key for the magnet and its handle. */
  id: string
  /** Horizontal position, from 0 (left edge of the stage) to 1 (right edge). */
  x: number
  /** Vertical position, from 0 (top) to 1 (bottom). */
  y: number
  /** Field strength multiplier. At 1 the field reaches critical half the stage’s shorter side away. */
  strength?: number
  /** North (1) or south (−1). Between like poles the sideways pulls cancel; between opposite ones the field runs straight across. */
  polarity?: 1 | -1
  /** Accessible name of the magnet’s handle. Defaults to “Magnet 1”, “Magnet 2”… */
  label?: string
}

/** A field sample: `x`, `y` in the table’s plane, `z` out of it. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/** A magnet resolved to field units: positions divided by the stage’s shorter side, strength signed. */
export interface FieldSource {
  x: number
  y: number
  charge: number
}

/** Height of each pole above the table, in field units. Sets how hard the field peaks right under a magnet. */
export const POLE_HEIGHT = 0.13
/** A strength-1 magnet reaches the critical field H꜀ = 1 at this horizontal distance, in field units. */
export const CRITICAL_REACH = 0.5
/** The source strength that makes `CRITICAL_REACH` true. */
export const UNIT_CHARGE = CRITICAL_REACH * CRITICAL_REACH + POLE_HEIGHT * POLE_HEIGHT
/** Bond number at which a flat surface breaks into peaks. */
export const CRITICAL_UP = 1
/** Bond number below which a standing peak finally collapses — the hysteresis of the subcritical bifurcation. */
export const CRITICAL_DOWN = 0.72

/**
 * The summed field on the table at (x, y); the vector goes into `out`, the
 * magnitude is returned. The in-plane part points at a north pole and away
 * from a south one.
 */
export function fieldAt(sources: readonly FieldSource[], x: number, y: number, out: Vec3): number {
  let hx = 0
  let hy = 0
  let hz = 0
  const z2 = POLE_HEIGHT * POLE_HEIGHT
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]
    const dx = x - source.x
    const dy = y - source.y
    const d2 = dx * dx + dy * dy + z2
    const k = source.charge / (d2 * Math.sqrt(d2))
    hx -= dx * k
    hy -= dy * k
    hz += POLE_HEIGHT * k
  }
  out.x = hx
  out.y = hy
  out.z = hz
  return Math.sqrt(hx * hx + hy * hy + hz * hz)
}

/**
 * Peak height for a Bond number, with hysteresis. `standing` is whether the
 * peak is already up; the result is the new target height as a fraction of the
 * maximum, and whether it now stands.
 *
 * The amplitude is measured from the lower branch, √(N − N_down), so a flat
 * surface that crosses N = 1 jumps straight to a finite height and a standing
 * peak shrinks continuously to nothing at N_down — the S-shaped curve of a
 * subcritical bifurcation, cut to its two stable branches. A tanh saturates
 * it, because a real peak cannot outgrow the fluid that feeds it.
 */
export function peakTarget(bond: number, standing: boolean, gain: number): { height: number; standing: boolean } {
  const onset = standing ? CRITICAL_DOWN : CRITICAL_UP
  const excess = bond - onset
  if (excess <= 0) return { height: 0, standing: false }
  return { height: Math.tanh(gain * Math.sqrt(bond - CRITICAL_DOWN)), standing: true }
}

/**
 * The first `count` sites of a triangular (hexagonal) lattice with the given
 * spacing, nearest the origin first, as flat x, y pairs. A small deterministic
 * jitter stands in for the defects a real peak lattice always has.
 */
export function hexLattice(count: number, spacing: number): Float32Array {
  const rows = Math.ceil(Math.sqrt(count)) + 2
  const sites: { x: number; y: number; d: number }[] = []
  const rowHeight = (spacing * Math.sqrt(3)) / 2
  for (let j = -rows; j <= rows; j++) {
    const offset = (Math.abs(j) % 2) * 0.5
    for (let i = -rows; i <= rows; i++) {
      const hash = Math.sin((i * 12.9898 + j * 78.233) * 43758.5453)
      const jitter = (hash - Math.floor(hash)) * Math.PI * 2
      const x = (i + offset) * spacing + Math.cos(jitter) * spacing * 0.06
      const y = j * rowHeight + Math.sin(jitter) * spacing * 0.06
      sites.push({ x, y, d: x * x + y * y })
    }
  }
  sites.sort((a, b) => a.d - b.d)
  const out = new Float32Array(Math.min(count, sites.length) * 2)
  for (let k = 0; k < out.length / 2; k++) {
    out[k * 2] = sites[k].x
    out[k * 2 + 1] = sites[k].y
  }
  return out
}

/* ------------------------------------------------------------ metaballs */

/** The isovalue the outline is drawn at. */
export const META_THRESHOLD = 0.5
/**
 * Kernel reach per unit of visible radius. A lone ball’s field (1 − q²)³ crosses
 * 0.5 at q = √(1 − 0.5^⅓) ≈ 0.4542, so a ball meant to look `r` wide reaches r / 0.4542.
 */
export const BALL_REACH = 1 / Math.sqrt(1 - Math.cbrt(META_THRESHOLD))

export interface MetaGrid {
  /** Cells across and down; samples are one more in each direction. */
  nx: number
  ny: number
  /** Cell size, in the caller’s units. */
  cell: number
  values: Float32Array
  /** Where the isoline crosses each horizontal and vertical edge, as a fraction along it. */
  hCross: Float32Array
  vCross: Float32Array
  /** For each edge, the edge the outline leaves by; −1 for none. */
  next: Int32Array
}

export function createMetaGrid(): MetaGrid {
  return { nx: 0, ny: 0, cell: 1, values: new Float32Array(0), hCross: new Float32Array(0), vCross: new Float32Array(0), next: new Int32Array(0) }
}

/** Fit the grid to a width × height area at roughly `cell` per cell. Reallocates only when the shape changes. */
export function sizeGrid(grid: MetaGrid, width: number, height: number, cell: number) {
  const nx = Math.max(4, Math.ceil(width / cell))
  const ny = Math.max(4, Math.ceil(height / cell))
  grid.cell = cell
  if (nx === grid.nx && ny === grid.ny) return
  grid.nx = nx
  grid.ny = ny
  grid.values = new Float32Array((nx + 1) * (ny + 1))
  grid.hCross = new Float32Array(nx * (ny + 1))
  grid.vCross = new Float32Array((nx + 1) * ny)
  grid.next = new Int32Array(grid.hCross.length + grid.vCross.length)
}

export function clearGrid(grid: MetaGrid) {
  grid.values.fill(0)
}

/**
 * Add one ball of visible radius `radius` at (x, y). The kernel has compact
 * support, so only the samples under it are touched — a spike costs a few
 * dozen writes, not the whole grid. The outermost ring of samples is never
 * written, which keeps it at zero and guarantees every outline closes.
 *
 * `reach` is how far the kernel extends, in multiples of `radius`; the weight
 * is scaled so a lone ball still crosses the threshold exactly at `radius`.
 * The default, about 2.2, blends generously — right for the pool. Spikes use
 * a shorter reach so neighbours stay separate spikes until they really touch.
 */
export function addBall(grid: MetaGrid, x: number, y: number, radius: number, reach = BALL_REACH) {
  if (radius <= 0) return
  const { nx, ny, cell, values } = grid
  const edge = 1 - 1 / (reach * reach)
  const weight = META_THRESHOLD / (edge * edge * edge)
  reach *= radius
  const inverse = 1 / (reach * reach)
  const stride = nx + 1
  const i0 = Math.max(1, Math.ceil((x - reach) / cell))
  const i1 = Math.min(nx - 1, Math.floor((x + reach) / cell))
  const j0 = Math.max(1, Math.ceil((y - reach) / cell))
  const j1 = Math.min(ny - 1, Math.floor((y + reach) / cell))
  for (let j = j0; j <= j1; j++) {
    const dy = j * cell - y
    const dy2 = dy * dy
    const row = j * stride
    for (let i = i0; i <= i1; i++) {
      const dx = i * cell - x
      const q2 = (dx * dx + dy2) * inverse
      if (q2 < 1) {
        const t = 1 - q2
        values[row + i] += weight * t * t * t
      }
    }
  }
}

/**
 * Add a tapered segment from (ax, ay), `ra` wide, to (bx, by), `rb` wide — a
 * cone with a rounded tip, as an implicit primitive. Each sample finds its
 * nearest point on the axis, reads the radius there and applies the same
 * kernel as a ball, so the cone is one continuous surface (a chain of balls
 * leaves gaps near a sharp tip) and it still blends into the pool at its base.
 */
export function addCone(grid: MetaGrid, ax: number, ay: number, bx: number, by: number, ra: number, rb: number, reach = BALL_REACH) {
  if (ra <= 0) return
  const { nx, ny, cell, values } = grid
  const edge = 1 - 1 / (reach * reach)
  const weight = META_THRESHOLD / (edge * edge * edge)
  const ux = bx - ax
  const uy = by - ay
  const length2 = ux * ux + uy * uy
  const span = Math.max(ra, rb) * reach
  const stride = nx + 1
  const i0 = Math.max(1, Math.ceil((Math.min(ax, bx) - span) / cell))
  const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx) + span) / cell))
  const j0 = Math.max(1, Math.ceil((Math.min(ay, by) - span) / cell))
  const j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by) + span) / cell))
  for (let j = j0; j <= j1; j++) {
    const py = j * cell - ay
    const row = j * stride
    for (let i = i0; i <= i1; i++) {
      const px = i * cell - ax
      const t = length2 > 0 ? Math.min(1, Math.max(0, (px * ux + py * uy) / length2)) : 0
      const dx = px - ux * t
      const dy = py - uy * t
      const r = (ra + (rb - ra) * t) * reach
      const q2 = (dx * dx + dy * dy) / (r * r)
      if (q2 < 1) {
        const s = 1 - q2
        values[row + i] += weight * s * s * s
      }
    }
  }
}

/**
 * Segments per case, as pairs of cell edges (0 top, 1 right, 2 bottom, 3 left),
 * each travelling with the fluid on its left. Cases 5 and 10 are the saddles and
 * are decided per cell from the centre value.
 */
const CASES: readonly (readonly number[])[] = [
  [],
  [3, 0],
  [0, 1],
  [3, 1],
  [1, 2],
  [],
  [0, 2],
  [3, 2],
  [2, 3],
  [2, 0],
  [],
  [2, 1],
  [1, 3],
  [1, 0],
  [0, 3],
  [],
]
const SADDLE_5_JOINED = [1, 0, 3, 2]
const SADDLE_5_SPLIT = [3, 0, 1, 2]
const SADDLE_10_JOINED = [0, 3, 2, 1]
const SADDLE_10_SPLIT = [0, 1, 2, 3]

/**
 * Marching squares over the grid. Returns closed loops as flat x, y arrays in
 * the grid’s units, the fluid on the left of each (so holes run the other way).
 */
export function contour(grid: MetaGrid, threshold = META_THRESHOLD): number[][] {
  const { nx, ny, cell, values, hCross, vCross, next } = grid
  const stride = nx + 1
  const hCount = nx * (ny + 1)

  // Where the isoline crosses each edge, by linear interpolation between the two samples.
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = values[j * stride + i]
      const b = values[j * stride + i + 1]
      hCross[j * nx + i] = (a >= threshold) !== (b >= threshold) ? (threshold - a) / (b - a) : -1
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const a = values[j * stride + i]
      const b = values[(j + 1) * stride + i]
      vCross[j * stride + i] = (a >= threshold) !== (b >= threshold) ? (threshold - a) / (b - a) : -1
    }
  }

  next.fill(-1)
  let any = false
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v0 = values[j * stride + i]
      const v1 = values[j * stride + i + 1]
      const v2 = values[(j + 1) * stride + i + 1]
      const v3 = values[(j + 1) * stride + i]
      const code = (v0 >= threshold ? 1 : 0) | (v1 >= threshold ? 2 : 0) | (v2 >= threshold ? 4 : 0) | (v3 >= threshold ? 8 : 0)
      if (code === 0 || code === 15) continue
      let pairs = CASES[code]
      if (code === 5 || code === 10) {
        const joined = (v0 + v1 + v2 + v3) / 4 >= threshold
        pairs = code === 5 ? (joined ? SADDLE_5_JOINED : SADDLE_5_SPLIT) : joined ? SADDLE_10_JOINED : SADDLE_10_SPLIT
      }
      for (let k = 0; k < pairs.length; k += 2) {
        next[edgeId(pairs[k], i, j, nx, stride, hCount)] = edgeId(pairs[k + 1], i, j, nx, stride, hCount)
      }
      any = true
    }
  }
  if (!any) return []

  const loops: number[][] = []
  for (let start = 0; start < next.length; start++) {
    if (next[start] < 0) continue
    const points: number[] = []
    let edge = start
    while (edge >= 0) {
      const following = next[edge]
      if (following < 0) break
      next[edge] = -1
      if (edge < hCount) {
        const row = Math.floor(edge / nx)
        points.push((edge - row * nx + hCross[edge]) * cell, row * cell)
      } else {
        const k = edge - hCount
        const row = Math.floor(k / stride)
        points.push((k - row * stride) * cell, (row + vCross[k]) * cell)
      }
      edge = following
    }
    if (points.length >= 6) loops.push(points)
  }
  return loops
}

function edgeId(side: number, i: number, j: number, nx: number, stride: number, hCount: number) {
  switch (side) {
    case 0:
      return j * nx + i
    case 1:
      return hCount + j * stride + i + 1
    case 2:
      return (j + 1) * nx + i
    default:
      return hCount + j * stride + i
  }
}
