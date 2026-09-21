/**
 * The geometry behind Tesseract, as plain numbers with no DOM.
 *
 * All six convex regular 4-polytopes are built from their textbook coordinates,
 * scaled so every vertex sits on the unit 3-sphere:
 *
 *   5-cell    {3,3,3}   the 4-simplex: (±1,±1,±1,−1/√5) with an even number of
 *                       minus signs among the first three, plus (0,0,0,4/√5)
 *   tesseract {4,3,3}   the 16 sign vectors (±1,±1,±1,±1)
 *   16-cell   {3,3,4}   the 8 unit vectors ±eᵢ
 *   24-cell   {3,4,3}   the 24 permutations of (±1,±1,0,0)
 *   600-cell  {3,3,5}   the 16-cell's ±eᵢ, the tesseract's (±½,±½,±½,±½), and the
 *                       even permutations of (±φ, ±1, ±1/φ, 0)/2 — 8 + 16 + 96 = 120
 *   120-cell  {5,3,3}   the 600 vertices of the seven golden-ratio families below
 *
 * Edges are pairs of vertices at the shortest distance that occurs, which for a
 * regular polytope is exactly the edge set (for the tesseract it is the rule
 * "differ in one coordinate", and that rule is used directly). Faces are the
 * shortest cycles of the edge graph — triangles, squares or pentagons — which,
 * for these six and only because they are regular, are exactly the 2-faces. The
 * counts come out as the known f-vectors: 5-cell 5/10/10, tesseract 16/32/24,
 * 16-cell 8/24/32, 24-cell 24/96/96, 600-cell 120/720/1200, 120-cell 600/1200/720,
 * and V − E + F − C = 0 for each.
 *
 * Rotation in four dimensions happens in a plane, not about an axis, and there
 * are six planes: xy, xz, xw, yz, yw, zw. The orientation is one angle per plane,
 * composed in a fixed order (the w planes first, in the body's own frame, then
 * the three ordinary 3D planes, which act like a camera). Planes that share no
 * axis — xy and zw, xw and yz — commute, so spinning such a pair is an exact
 * double rotation; spinning them at equal speed is the isoclinic (Clifford)
 * rotation, in which every point moves on a great circle and nothing stands still.
 */

export type TesseractShape = '5-cell' | 'tesseract' | '16-cell' | '24-cell' | '120-cell' | '600-cell'
export type TesseractPlane = 'xy' | 'xz' | 'xw' | 'yz' | 'yw' | 'zw'
export type TesseractAngles = Record<TesseractPlane, number>
export type TesseractProjection = 'perspective' | 'stereographic'

/** The six planes of rotation, in the order angle arrays use. */
export const PLANES: readonly TesseractPlane[] = ['xy', 'xz', 'xw', 'yz', 'yw', 'zw']

/** The order the plane rotations are applied in: the body's w planes, then the 3D view. */
const COMPOSE: readonly TesseractPlane[] = ['xw', 'yw', 'zw', 'xy', 'xz', 'yz']

const AXIS: Record<string, number> = { x: 0, y: 1, z: 2, w: 3 }

export const PHI = (1 + Math.sqrt(5)) / 2

export interface PolytopeInfo {
  /** Display name. */
  name: string
  /** Its other names. */
  other: string
  /** Schläfli symbol. */
  schlafli: string
  /** Adjective for a 2-face: triangular, square, pentagonal. */
  face: string
  /** Adjective for a 3-cell: tetrahedral, cubic, octahedral, dodecahedral. */
  cell: string
  /** Number of 3-cells. */
  cells: number
}

export const POLYTOPES: Record<TesseractShape, PolytopeInfo> = {
  '5-cell': { name: '5-cell', other: 'pentachoron, the 4-simplex', schlafli: '{3,3,3}', face: 'triangular', cell: 'tetrahedral', cells: 5 },
  tesseract: { name: 'Tesseract', other: '8-cell, the 4-cube', schlafli: '{4,3,3}', face: 'square', cell: 'cubic', cells: 8 },
  '16-cell': { name: '16-cell', other: 'hexadecachoron, the 4-orthoplex', schlafli: '{3,3,4}', face: 'triangular', cell: 'tetrahedral', cells: 16 },
  '24-cell': { name: '24-cell', other: 'icositetrachoron', schlafli: '{3,4,3}', face: 'triangular', cell: 'octahedral', cells: 24 },
  '120-cell': { name: '120-cell', other: 'hecatonicosachoron', schlafli: '{5,3,3}', face: 'pentagonal', cell: 'dodecahedral', cells: 120 },
  '600-cell': { name: '600-cell', other: 'hexacosichoron', schlafli: '{3,3,5}', face: 'triangular', cell: 'tetrahedral', cells: 600 },
}

/** The shapes in the conventional order, by number of cells. */
export const SHAPES: readonly TesseractShape[] = ['5-cell', 'tesseract', '16-cell', '24-cell', '120-cell', '600-cell']

export interface Polytope extends PolytopeInfo {
  shape: TesseractShape
  /** x, y, z, w per vertex, on the unit 3-sphere. */
  positions: Float64Array
  vertexCount: number
  /** Two vertex indices per edge. */
  edges: Uint16Array
  edgeCount: number
  /** `faceSize` vertex indices per face, in order around it. */
  faces: Uint16Array
  faceSize: number
  faceCount: number
  /** The angle an edge subtends at the centre, in radians — how far an edge's arc runs on the 3-sphere. */
  arc: number
}

/* ------------------------------------------------------------ vertices */

type Vec4 = [number, number, number, number]

const PERMUTATIONS: number[][] = []
;(function permute(rest: number[], acc: number[]) {
  if (!rest.length) PERMUTATIONS.push(acc)
  for (let i = 0; i < rest.length; i++) permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]])
})([0, 1, 2, 3], [])

/** Even permutations: an even number of inversions. Twelve of the twenty-four. */
const EVEN = PERMUTATIONS.filter((p) => {
  let inversions = 0
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (p[i] > p[j]) inversions++
  return inversions % 2 === 0
})

/** Every (even, if asked) permutation of `base` with every choice of signs. Duplicates are removed later. */
function family(base: Vec4, evenOnly = false): Vec4[] {
  const out: Vec4[] = []
  for (const p of evenOnly ? EVEN : PERMUTATIONS) {
    const placed: Vec4 = [0, 0, 0, 0]
    for (let i = 0; i < 4; i++) placed[p[i]] = base[i]
    for (let signs = 0; signs < 16; signs++) out.push(placed.map((value, i) => (signs & (1 << i) ? -value : value)) as Vec4)
  }
  return out
}

function rawVertices(shape: TesseractShape): Vec4[] {
  switch (shape) {
    case '5-cell': {
      const low = -1 / Math.sqrt(5)
      return [
        [1, 1, 1, low],
        [1, -1, -1, low],
        [-1, 1, -1, low],
        [-1, -1, 1, low],
        [0, 0, 0, 4 / Math.sqrt(5)],
      ]
    }
    case 'tesseract':
      // Vertex i has coordinate k = +1 when bit k of i is set, so neighbours differ in one bit.
      return Array.from({ length: 16 }, (_, i) => [0, 1, 2, 3].map((k) => (i & (1 << k) ? 1 : -1)) as Vec4)
    case '16-cell':
      return family([1, 0, 0, 0])
    case '24-cell':
      return family([1, 1, 0, 0])
    case '600-cell':
      return [...family([1, 0, 0, 0]), ...family([0.5, 0.5, 0.5, 0.5]), ...family([PHI / 2, 0.5, 1 / (2 * PHI), 0], true)]
    case '120-cell':
      // Coxeter's coordinates, circumradius √8.
      return [
        ...family([0, 0, 2, 2]),
        ...family([1, 1, 1, Math.sqrt(5)]),
        ...family([PHI ** -2, PHI, PHI, PHI]),
        ...family([1 / PHI, 1 / PHI, 1 / PHI, PHI ** 2]),
        ...family([0, PHI ** -2, 1, PHI ** 2], true),
        ...family([0, 1 / PHI, PHI, Math.sqrt(5)], true),
        ...family([1 / PHI, 1, PHI, 2], true),
      ]
  }
}

function uniqueOnSphere(points: Vec4[]): Vec4[] {
  const seen = new Map<string, Vec4>()
  for (const point of points) {
    const key = point.map((value) => (Math.abs(value) < 1e-9 ? '0' : value.toFixed(6))).join(',')
    if (!seen.has(key)) seen.set(key, point)
  }
  const unique = [...seen.values()]
  let radius = 0
  for (const point of unique) radius = Math.max(radius, Math.hypot(...point))
  return unique.map((point) => point.map((value) => value / radius) as Vec4)
}

/* ------------------------------------------------------------ edges and faces */

function distance(p: Float64Array, a: number, b: number) {
  const dx = p[a * 4] - p[b * 4]
  const dy = p[a * 4 + 1] - p[b * 4 + 1]
  const dz = p[a * 4 + 2] - p[b * 4 + 2]
  const dw = p[a * 4 + 3] - p[b * 4 + 3]
  return Math.sqrt(dx * dx + dy * dy + dz * dz + dw * dw)
}

function edgesOf(shape: TesseractShape, positions: Float64Array, count: number): number[] {
  const edges: number[] = []
  if (shape === 'tesseract') {
    // The definition, not a distance test: vertices whose indices differ in exactly one bit.
    for (let i = 0; i < count; i++) for (let k = 0; k < 4; k++) if (!(i & (1 << k))) edges.push(i, i | (1 << k))
    return edges
  }
  let shortest = Infinity
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) shortest = Math.min(shortest, distance(positions, i, j))
  const cut = shortest * (1 + 1e-4)
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) if (distance(positions, i, j) <= cut) edges.push(i, j)
  return edges
}

/** Length of the shortest cycle, by breadth-first search from every vertex. */
function girth(adjacency: number[][]): number {
  let best = Infinity
  const n = adjacency.length
  const depth = new Int32Array(n)
  const parent = new Int32Array(n)
  for (let s = 0; s < n; s++) {
    depth.fill(-1)
    depth[s] = 0
    parent[s] = -1
    const queue = [s]
    for (let q = 0; q < queue.length; q++) {
      const u = queue[q]
      if (depth[u] * 2 >= best) break
      for (const v of adjacency[u]) {
        if (depth[v] < 0) {
          depth[v] = depth[u] + 1
          parent[v] = u
          queue.push(v)
        } else if (v !== parent[u]) best = Math.min(best, depth[u] + depth[v] + 1)
      }
    }
  }
  return best
}

/**
 * Every cycle of length `size`, each listed once: it starts at its smallest vertex
 * and runs in the direction whose second vertex is smaller than its last.
 */
function cyclesOf(adjacency: number[][], size: number): number[] {
  const neighbours = adjacency.map((list) => new Set(list))
  const path = new Array<number>(size)
  const out: number[] = []
  const extend = (start: number, length: number) => {
    const last = path[length - 1]
    if (length === size) {
      if (neighbours[last].has(start) && path[1] < path[size - 1]) out.push(...path)
      return
    }
    for (const next of adjacency[last]) {
      if (next <= start) continue
      let used = false
      for (let i = 1; i < length; i++) if (path[i] === next) used = true
      if (used) continue
      path[length] = next
      extend(start, length + 1)
    }
  }
  for (let start = 0; start < adjacency.length; start++) {
    path[0] = start
    extend(start, 1)
  }
  return out
}

const cache = new Map<TesseractShape, Polytope>()

/** The polytope, built once and cached. The 120-cell takes a few milliseconds the first time. */
export function polytope(shape: TesseractShape): Polytope {
  const hit = cache.get(shape)
  if (hit) return hit
  const vertices = uniqueOnSphere(rawVertices(shape))
  const count = vertices.length
  const positions = new Float64Array(count * 4)
  vertices.forEach((vertex, i) => positions.set(vertex, i * 4))
  const edgeList = edgesOf(shape, positions, count)
  const adjacency: number[][] = Array.from({ length: count }, () => [])
  for (let e = 0; e < edgeList.length; e += 2) {
    adjacency[edgeList[e]].push(edgeList[e + 1])
    adjacency[edgeList[e + 1]].push(edgeList[e])
  }
  const faceSize = girth(adjacency)
  const faceList = cyclesOf(adjacency, faceSize)
  const chord = distance(positions, edgeList[0], edgeList[1])
  const built: Polytope = {
    ...POLYTOPES[shape],
    shape,
    positions,
    vertexCount: count,
    edges: Uint16Array.from(edgeList),
    edgeCount: edgeList.length / 2,
    faces: Uint16Array.from(faceList),
    faceSize,
    faceCount: faceList.length / faceSize,
    arc: 2 * Math.asin(Math.min(1, chord / 2)),
  }
  cache.set(shape, built)
  return built
}

/* ------------------------------------------------------------ rotation */

export const anglesToArray = (angles: Partial<TesseractAngles>, out = new Float64Array(6)) => {
  PLANES.forEach((plane, i) => (out[i] = angles[plane] ?? 0))
  return out
}

export const arrayToAngles = (array: ArrayLike<number>): TesseractAngles =>
  Object.fromEntries(PLANES.map((plane, i) => [plane, array[i]])) as TesseractAngles

/**
 * The 4×4 rotation matrix (row-major) for a set of plane angles, in PLANES order.
 * Each plane rotation is the identity except for a 2×2 block on its two axes; the
 * product is built by rotating the rows of the running matrix, which is the same
 * as left-multiplying by that block.
 */
export function rotationMatrix(angles: ArrayLike<number>, out = new Float64Array(16)): Float64Array {
  out.fill(0)
  out[0] = out[5] = out[10] = out[15] = 1
  for (const plane of COMPOSE) {
    const theta = angles[PLANES.indexOf(plane)]
    if (!theta) continue
    const i = AXIS[plane[0]]
    const j = AXIS[plane[1]]
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    for (let col = 0; col < 4; col++) {
      const a = out[i * 4 + col]
      const b = out[j * 4 + col]
      out[i * 4 + col] = c * a - s * b
      out[j * 4 + col] = s * a + c * b
    }
  }
  return out
}

/** Rotates every vertex: out = M·p. */
export function rotateAll(matrix: Float64Array, positions: Float64Array, out: Float64Array) {
  for (let o = 0; o < positions.length; o += 4) {
    const x = positions[o]
    const y = positions[o + 1]
    const z = positions[o + 2]
    const w = positions[o + 3]
    for (let r = 0; r < 4; r++) out[o + r] = matrix[r * 4] * x + matrix[r * 4 + 1] * y + matrix[r * 4 + 2] * z + matrix[r * 4 + 3] * w
  }
}

/* ------------------------------------------------------------ projection */

export interface Camera {
  projection: TesseractProjection
  /** Perspective: distance of the 4D eye along +w, in circumradii (> 1). */
  eye: number
  /** Distance of the ordinary 3D camera along +z. */
  distance: number
  /** Pixels per unit on the picture plane. */
  scale: number
  cx: number
  cy: number
}

/**
 * Four dimensions to a point on screen, in two steps.
 *
 * 4D → 3D. Perspective puts an eye on the w axis at distance `eye` and divides by
 * the distance to it: (x, y, z)·eye/(eye − w). Stereographic puts the eye on the
 * 3-sphere itself, at its pole (0,0,0,1): (x, y, z)/(1 − w). It is the same divide
 * with the eye moved onto the sphere, which is why things near the pole run off to
 * infinity, and why (with edges bent onto the sphere first) it preserves angles.
 *
 * 3D → 2D. An ordinary pinhole camera on the z axis.
 *
 * Writes screen x, y and the 3D depth to `out` at `o`. Returns false for a point
 * at infinity or behind the camera, so a caller can break the line there.
 */
export function project(x: number, y: number, z: number, w: number, camera: Camera, out: Float64Array, o: number): boolean {
  let k: number
  if (camera.projection === 'stereographic') {
    const gap = 1 - w
    if (gap < 0.035) return false
    k = 1 / gap
  } else {
    const gap = camera.eye - w
    if (gap < 0.02) return false
    k = camera.eye / gap
  }
  const Z = z * k
  const gap3 = camera.distance - Z
  if (gap3 < camera.distance * 0.2) return false
  const f = (camera.distance / gap3) * camera.scale
  out[o] = camera.cx + x * k * f
  out[o + 1] = camera.cy - y * k * f
  out[o + 2] = Z
  return true
}

/**
 * The radius the picture needs, in picture-plane units, so the whole solid fits.
 * Perspective: a unit 3-sphere seen from `eye` reaches at most eye/√(eye² − 1) in 3D,
 * and a 3D ball of radius R seen from `distance` has silhouette R·d/√(d² − R²).
 * Stereographic is unbounded, so it fits the part within 2.3 times the equator and lets
 * the rest leave the frame, which is what the projection does.
 */
export function fitRadius(projection: TesseractProjection, eye: number, distance: number) {
  const r3 = projection === 'stereographic' ? 2.3 : eye / Math.sqrt(eye * eye - 1)
  return (r3 * distance) / Math.sqrt(distance * distance - r3 * r3)
}

/**
 * Weights for points along an edge's great-circle arc (slerp):
 * p(t) = (sin((1 − t)Ω)·a + sin(tΩ)·b) / sin Ω. Under stereographic projection
 * edges are drawn as these arcs, so they come out as the circles the projection
 * really makes; under perspective an edge is one straight segment.
 */
export function arcWeights(arc: number, projection: TesseractProjection) {
  const steps = projection === 'stereographic' ? Math.max(2, Math.min(20, Math.ceil(arc / 0.09))) : 1
  const from = new Float64Array(steps + 1)
  const to = new Float64Array(steps + 1)
  const sine = Math.sin(arc)
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    if (steps === 1 || sine < 1e-9) {
      from[k] = 1 - t
      to[k] = t
    } else {
      from[k] = Math.sin((1 - t) * arc) / sine
      to[k] = Math.sin(t * arc) / sine
    }
  }
  return { steps, from, to }
}
