/**
 * The optics behind PrismLight, as plain numbers with no DOM.
 *
 * Three pieces of real physics, each small enough to check by hand:
 *
 * 1. Dispersion. Glass bends short wavelengths more than long ones. Cauchy’s
 *    equation, n(λ) = A + B/λ² with λ in micrometres, is the two-term fit
 *    optics catalogues used before Sellmeier, and across the visible range it
 *    is within a few parts in 10⁴ of the real curve. The constants below give
 *    n_d = 1.517 and an Abbe number of about 64 for crown (BK7-like), and
 *    n_d = 1.767 with an Abbe number of about 30 for dense flint (SF10-like) —
 *    so flint both bends harder and fans the colours out roughly twice as wide.
 *
 * 2. Refraction. At every surface the ray is bent with the vector form of
 *    Snell’s law, t = η·d + (η·cosθᵢ − cosθₜ)·N, where η = n₁/n₂ and N faces the
 *    incoming ray. When 1 − η²·sin²θᵢ goes negative there is no transmitted ray
 *    at all — the angle is past critical — and the ray reflects in full: total
 *    internal reflection. Nothing special-cases it; it falls out of the square
 *    root.
 *
 * 3. Partial reflection. The Fresnel equations split the energy at each face
 *    between a reflected and a transmitted ray, averaged over the two
 *    polarisations because the source is unpolarised. At normal incidence on
 *    crown that is 4% reflected, which is why the stray ray off the first face
 *    is faint but there, and why it brightens towards grazing incidence.
 *
 * Colour is not an HSL sweep. Each wavelength goes through the CIE 1931 2°
 * colour matching functions, then XYZ to linear sRGB with the standard D65
 * matrix, then the sRGB transfer curve. That is why the spectrum has the real
 * proportions: a narrow yellow, a wide green, a cyan that is barely there, and
 * red and violet ends that fade into the dark rather than stopping at an edge.
 *
 * The matching functions are the published table at 10 nm, interpolated. The
 * analytic multi-lobe fit of Wyman, Sloan and Shirley (JCGT, 2013) was the
 * first choice and is excellent where the curves are large, but its Gaussian
 * tails carry too much ȳ at 700 nm and too little x̄ at 380 nm. Those values
 * are tiny, which is why the fit ignores them — but every sample here is
 * normalised to full brightness before it is drawn, so the tails decide the
 * hue at both ends, and the fit turned deep red orange and violet cyan.
 */

/* ------------------------------------------------------------------ glass */

/** A named glass, or a fixed refractive index with no dispersion at all. */
export type PrismLightGlass = 'crown' | 'flint' | number

/** Cauchy constants: A (dimensionless) and B (µm²). */
export const CAUCHY: Record<'crown' | 'flint', { A: number; B: number }> = {
  crown: { A: 1.5046, B: 0.0042 },
  flint: { A: 1.728, B: 0.01342 },
}

/** Refractive index of `glass` at `nm` nanometres. */
export function refractiveIndex(glass: PrismLightGlass, nm: number): number {
  if (typeof glass === 'number') return Math.max(1, glass)
  const { A, B } = CAUCHY[glass] ?? CAUCHY.crown
  const um = nm / 1000
  return A + B / (um * um)
}

/** The sodium D line, the wavelength refractive indices are conventionally quoted at. */
export const SODIUM_D = 589.3

/* ------------------------------------------------------------------ colour */

/** CIE 1931 2° standard observer, x̄ ȳ z̄ from 380 to 700 nm in 10 nm steps. */
const CMF = [
  [0.001368, 0.000039, 0.00645], [0.004243, 0.00012, 0.02005], [0.01431, 0.000396, 0.06785], [0.04351, 0.00121, 0.2074],
  [0.13438, 0.004, 0.6456], [0.2839, 0.0116, 1.3856], [0.34828, 0.023, 1.74706], [0.3362, 0.038, 1.77211],
  [0.2908, 0.06, 1.6692], [0.19536, 0.09098, 1.28764], [0.09564, 0.13902, 0.81295], [0.03201, 0.20802, 0.46518],
  [0.0049, 0.323, 0.272], [0.0093, 0.503, 0.1582], [0.06327, 0.71, 0.07825], [0.1655, 0.862, 0.04216],
  [0.2904, 0.954, 0.0203], [0.43345, 0.99495, 0.00875], [0.5945, 0.995, 0.0039], [0.7621, 0.952, 0.0021],
  [0.9163, 0.87, 0.00165], [1.0263, 0.757, 0.0011], [1.0622, 0.631, 0.0008], [1.0026, 0.503, 0.00034],
  [0.85445, 0.381, 0.00019], [0.6424, 0.265, 0.00005], [0.4479, 0.175, 0.00002], [0.2835, 0.107, 0],
  [0.1649, 0.061, 0], [0.0874, 0.032, 0], [0.04677, 0.017, 0], [0.0227, 0.00821, 0], [0.011359, 0.004102, 0],
]

/** CIE 1931 colour matching functions x̄, ȳ, z̄ at `nm`, linearly interpolated from the table. */
export function cie1931(nm: number): [number, number, number] {
  const position = Math.min(CMF.length - 1, Math.max(0, (nm - 380) / 10))
  const i = Math.min(CMF.length - 2, Math.floor(position))
  const t = position - i
  const a = CMF[i]
  const b = CMF[i + 1]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

const encode = (linear: number) => (linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055)

/** A wavelength’s linear sRGB, out-of-gamut channels clipped, scaled so the brightest channel is 1. */
function spectralLinear(nm: number): [number, number, number] {
  const [X, Y, Z] = cie1931(nm)
  // Spectral colours lie outside sRGB, so one channel comes out negative. It
  // is clipped rather than lifted with white: lifting keeps the hue angle but
  // washes every colour towards pastel, and a spectrum should look saturated.
  const r = Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z)
  const g = Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z)
  const b = Math.max(0, 0.0557 * X - 0.204 * Y + 1.057 * Z)
  const high = Math.max(r, g, b, 1e-9)
  return [r / high, g / high, b / high]
}

/**
 * The displayable colour of one wavelength, as 0–255 sRGB at full brightness.
 * Brightness is carried separately, by the ray’s opacity, so a hue is never
 * dimmed twice.
 */
export function wavelengthToRgb(nm: number): [number, number, number] {
  const [r, g, b] = spectralLinear(nm)
  return [Math.round(encode(r) * 255), Math.round(encode(g) * 255), Math.round(encode(b) * 255)]
}

export interface SpectralSample {
  /** Wavelength in nanometres. */
  nm: number
  /** 0–255 sRGB. */
  rgb: [number, number, number]
  /** Opacity at full intensity. Drawn additively on top of one another, all the samples together make white. */
  alpha: number
}

/** The shortest and longest wavelengths sampled for a white beam. */
export const VISIBLE: [number, number] = [380, 700]

/**
 * `count` evenly spaced wavelengths across the visible range, each with its
 * colour and the opacity to draw it at.
 *
 * Each sample’s share of the light follows ȳ — the eye’s luminous efficiency —
 * so green carries the most and the ends the least. It is lifted 30% off the
 * floor, a deliberate departure: at ȳ alone the deep red and violet ends are
 * nearly invisible on a screen, and they are half the point of the picture.
 *
 * The colours are then white-balanced, as a camera would be: every sample’s
 * channels are scaled by the same three factors, chosen so the weighted sum of
 * all of them is exactly neutral. That is what makes the undeviated beam white
 * where the samples overlap, and a spectrum where they part.
 */
export function spectrum(count: number, single?: number): SpectralSample[] {
  if (single !== undefined) return [{ nm: single, rgb: wavelengthToRgb(single), alpha: 1 }]
  const n = Math.max(2, Math.round(count))
  const at = (i: number) => VISIBLE[0] + ((VISIBLE[1] - VISIBLE[0]) * i) / (n - 1)
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, cie1931(at(i))[1])
  const raw: { nm: number; weight: number; colour: [number, number, number] }[] = []
  const sum = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    const nm = at(i)
    const weight = 0.3 + 0.7 * (cie1931(nm)[1] / peak)
    const colour = wavelengthToRgb(nm).map((channel) => channel / 255) as [number, number, number]
    for (let c = 0; c < 3; c++) sum[c] += weight * colour[c]
    raw.push({ nm, weight, colour })
  }
  const floor = Math.max(1e-6, Math.min(sum[0], sum[1], sum[2]))
  return raw.map(({ nm, weight, colour }) => ({
    nm,
    rgb: colour.map((channel, c) => Math.round((channel * floor * 255) / Math.max(1e-6, sum[c]))) as [number, number, number],
    alpha: weight / floor,
  }))
}

/* ---------------------------------------------------------------- geometry */

export type PrismLightElementKind = 'prism' | 'lens' | 'slab' | 'mirror'

export interface PrismLightElement {
  /** Stable key for the element and its handle. */
  id: string
  /** Equilateral prism, bi-convex lens, parallel-sided slab, or a flat mirror. */
  kind: PrismLightElementKind
  /** Centre, from 0 (left edge of the bench) to 1 (right edge). */
  x: number
  /** Centre, from 0 (top) to 1 (bottom). */
  y: number
  /** Degrees, anticlockwise as seen on screen. */
  rotation?: number
  /** Overall size as a fraction of the bench’s height. */
  size?: number
  /** Accessible name of the element’s handle. Defaults to its kind. */
  label?: string
}

/** One element resolved to a convex polygon in bench pixels. */
export interface Body {
  xs: Float64Array
  ys: Float64Array
  /** Outward unit normal of edge i, which runs from vertex i to vertex i + 1. */
  nx: Float64Array
  ny: Float64Array
  count: number
  mirror: boolean
}

export const DEFAULT_SIZE: Record<PrismLightElementKind, number> = { prism: 0.46, lens: 0.5, slab: 0.4, mirror: 0.42 }

/** The element’s outline in its own frame, as unit-radius points. */
function outline(kind: PrismLightElementKind): [number, number][] {
  switch (kind) {
    case 'prism':
      // Apex up. Circumradius 1, so the side is √3.
      return [-90, 30, 150].map((deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)])
    case 'slab':
      return [
        [-0.95, -0.32],
        [0.95, -0.32],
        [0.95, 0.32],
        [-0.95, 0.32],
      ]
    case 'mirror':
      return [
        [-1, -0.035],
        [1, -0.035],
        [1, 0.035],
        [-1, 0.035],
      ]
    case 'lens': {
      // Two spherical faces of radius 1.6 on a half-aperture of 0.9: a sag of
      // 0.28 each side. Twenty facets a face is fine enough that the focus is
      // a caustic, not a set of kinks, and coarse enough to trace in real time.
      const radius = 1.6
      const aperture = 0.9
      const half = Math.asin(aperture / radius)
      const centre = Math.sqrt(radius * radius - aperture * aperture)
      const points: [number, number][] = []
      const facets = 20
      // The right face, top rim to bottom rim, then the left face back up. The
      // two arcs meet at the rim, so the left one skips both of its ends.
      for (let i = 0; i <= facets; i++) {
        const a = -half + (2 * half * i) / facets
        points.push([radius * Math.cos(a) - centre, radius * Math.sin(a)])
      }
      for (let i = 1; i < facets; i++) {
        const a = half - (2 * half * i) / facets
        points.push([centre - radius * Math.cos(a), radius * Math.sin(a)])
      }
      return points
    }
  }
}

const outlines = new Map<PrismLightElementKind, [number, number][]>()

/** Resolve an element to a polygon in bench pixels, with outward normals. */
export function toBody(element: PrismLightElement, width: number, height: number): Body {
  let shape = outlines.get(element.kind)
  if (!shape) {
    shape = outline(element.kind)
    outlines.set(element.kind, shape)
  }
  const radius = ((element.size ?? DEFAULT_SIZE[element.kind]) * height) / 2
  // Anticlockwise on screen is a negative angle in a y-down frame.
  const angle = (-(element.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const cx = element.x * width
  const cy = element.y * height
  const count = shape.length
  const xs = new Float64Array(count)
  const ys = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const [px, py] = shape[i]
    xs[i] = cx + (px * cos - py * sin) * radius
    ys[i] = cy + (px * sin + py * cos) * radius
  }
  let mx = 0
  let my = 0
  for (let i = 0; i < count; i++) {
    mx += xs[i] / count
    my += ys[i] / count
  }
  const nx = new Float64Array(count)
  const ny = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count
    const ex = xs[j] - xs[i]
    const ey = ys[j] - ys[i]
    const length = Math.hypot(ex, ey) || 1
    let ox = ey / length
    let oy = -ex / length
    // Convex, so the outward side is the one facing away from the centroid.
    if (ox * ((xs[i] + xs[j]) / 2 - mx) + oy * ((ys[i] + ys[j]) / 2 - my) < 0) {
      ox = -ox
      oy = -oy
    }
    nx[i] = ox
    ny[i] = oy
  }
  return { xs, ys, nx, ny, count, mirror: element.kind === 'mirror' }
}

/** Is the point inside the convex body? */
export function contains(body: Body, x: number, y: number): boolean {
  for (let i = 0; i < body.count; i++) {
    if ((x - body.xs[i]) * body.nx[i] + (y - body.ys[i]) * body.ny[i] > 0) return false
  }
  return true
}

/* ------------------------------------------------------------------ tracing */

/** Segments laid down by the tracer: x1, y1, x2, y2, intensity — five floats each. */
export interface RayBuffer {
  data: Float64Array
  count: number
}

export const createRayBuffer = (segments = 6000): RayBuffer => ({ data: new Float64Array(segments * 5), count: 0 })

export interface TraceOptions {
  bodies: Body[]
  width: number
  height: number
  /** Refractive index of the glass at this wavelength. */
  index: number
  /** Split energy by Fresnel at every face, or transmit everything that is not past critical. */
  fresnel: boolean
}

export interface TraceResult {
  /**
   * Final direction of the principal ray — the one that keeps going through
   * every transmission, total reflection and mirror, never a Fresnel branch.
   * That is the ray a deviation is measured on: at grazing incidence the
   * partial reflection off the first face can be brighter than what gets in,
   * and it would be wrong to call that the beam.
   */
  exitX: number
  exitY: number
  /** The principal ray’s remaining intensity when it left the bench; 0 when it never touched an element. */
  exitIntensity: number
  /** Whether the principal ray was totally internally reflected anywhere. */
  totalReflection: boolean
}

/** Rays dimmer than this are not followed further. */
const FLOOR = 0.012
/** Faces one ray may cross before it is dropped — a slab between two mirrors would otherwise bounce forever. */
const MAX_BOUNCES = 24
/** Reflected children a single ray may spawn, counting its descendants. */
const MAX_BRANCHES = 10

/**
 * Trace one wavelength from (x, y) along (dx, dy) through the bench, writing
 * every straight run into `buffer`.
 *
 * Each body is convex and treated on its own, so whether a hit enters or
 * leaves glass is read straight off the face normal: moving against it is
 * entering. Overlapping bodies are therefore not a compound lens — the bench
 * UI keeps them apart, and the simplification keeps the tracer to a loop.
 */
export function traceRay(x: number, y: number, dx: number, dy: number, options: TraceOptions, buffer: RayBuffer): TraceResult {
  const { bodies, width, height, index, fresnel } = options
  const capacity = buffer.data.length / 5
  const result: TraceResult = { exitX: dx, exitY: dy, exitIntensity: 0, totalReflection: false }
  // Pending rays: x, y, dx, dy, intensity, principal (0/1), bounces so far.
  const stack: number[] = [x, y, dx, dy, 1, 1, 0]
  let branches = 0
  const reach = (width + height) * 4

  while (stack.length) {
    const bounces0 = stack.pop()!
    const principal = stack.pop() === 1
    let intensity = stack.pop()!
    let vy = stack.pop()!
    let vx = stack.pop()!
    let py = stack.pop()!
    let px = stack.pop()!
    let touched = false

    for (let bounce = bounces0; bounce <= MAX_BOUNCES; bounce++) {
      // Nearest face along the ray. t is in pixels because (vx, vy) is a unit vector.
      let best = reach
      let hitBody = -1
      let hitEdge = -1
      for (let b = 0; b < bodies.length; b++) {
        const body = bodies[b]
        for (let i = 0; i < body.count; i++) {
          const j = i + 1 === body.count ? 0 : i + 1
          const ax = body.xs[i]
          const ay = body.ys[i]
          const ex = body.xs[j] - ax
          const ey = body.ys[j] - ay
          const denominator = vx * ey - vy * ex
          if (Math.abs(denominator) < 1e-12) continue
          const t = ((ax - px) * ey - (ay - py) * ex) / denominator
          if (t < 1e-3 || t >= best) continue
          const s = ((ax - px) * vy - (ay - py) * vx) / denominator
          if (s < 0 || s > 1) continue
          best = t
          hitBody = b
          hitEdge = i
        }
      }

      // Where the ray would leave the bench, so free runs end at the frame.
      let wall = reach
      if (vx > 1e-9) wall = Math.min(wall, (width - px) / vx)
      else if (vx < -1e-9) wall = Math.min(wall, -px / vx)
      if (vy > 1e-9) wall = Math.min(wall, (height - py) / vy)
      else if (vy < -1e-9) wall = Math.min(wall, -py / vy)
      wall = Math.max(0, wall)

      if (hitBody < 0 || wall < best) {
        push(buffer, capacity, px, py, px + vx * wall, py + vy * wall, intensity)
        if (principal && touched) {
          result.exitX = vx
          result.exitY = vy
          result.exitIntensity = intensity
        }
        break
      }

      const hx = px + vx * best
      const hy = py + vy * best
      push(buffer, capacity, px, py, hx, hy, intensity)
      px = hx
      py = hy
      touched = true

      const body = bodies[hitBody]
      let nx = body.nx[hitEdge]
      let ny = body.ny[hitEdge]
      let cosI = -(vx * nx + vy * ny)
      const entering = cosI > 0
      // Turn N to face the incoming ray; cosθᵢ is then positive either way.
      if (!entering) {
        nx = -nx
        ny = -ny
        cosI = -cosI
      }

      if (body.mirror) {
        vx += 2 * cosI * nx
        vy += 2 * cosI * ny
        intensity *= 0.94
        if (intensity < FLOOR) break
        continue
      }

      const n1 = entering ? 1 : index
      const n2 = entering ? index : 1
      const eta = n1 / n2
      const k = 1 - eta * eta * (1 - cosI * cosI)

      if (k < 0) {
        // Past the critical angle: no transmitted ray exists, so all of it reflects.
        if (principal) result.totalReflection = true
        vx += 2 * cosI * nx
        vy += 2 * cosI * ny
        continue
      }

      const cosT = Math.sqrt(k)
      if (fresnel) {
        const rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT)
        const rp = (n1 * cosT - n2 * cosI) / (n1 * cosT + n2 * cosI)
        const reflectance = (rs * rs + rp * rp) / 2
        const reflected = intensity * reflectance
        if (reflected > FLOOR && branches < MAX_BRANCHES) {
          branches++
          stack.push(px, py, vx + 2 * cosI * nx, vy + 2 * cosI * ny, reflected, 0, bounce + 1)
        }
        intensity -= reflected
      }
      const scale = eta * cosI - cosT
      vx = eta * vx + scale * nx
      vy = eta * vy + scale * ny
      const length = Math.hypot(vx, vy) || 1
      vx /= length
      vy /= length
      if (intensity < FLOOR) break
    }
  }
  return result
}

function push(buffer: RayBuffer, capacity: number, x1: number, y1: number, x2: number, y2: number, intensity: number) {
  if (buffer.count >= capacity) return
  const o = buffer.count * 5
  buffer.data[o] = x1
  buffer.data[o + 1] = y1
  buffer.data[o + 2] = x2
  buffer.data[o + 3] = y2
  buffer.data[o + 4] = intensity
  buffer.count++
}

/* --------------------------------------------------------------- deviation */

/** Signed angle in degrees from direction a to direction b, both unit vectors. */
export const angleBetween = (ax: number, ay: number, bx: number, by: number) => (Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI

/**
 * Minimum deviation of a prism with apex angle `apex` (degrees) at index `n`:
 * D = 2·asin(n·sin(A/2)) − A. The closed form the live readout is checked
 * against; it only exists when n·sin(A/2) ≤ 1.
 */
export function minimumDeviation(n: number, apex = 60): number | null {
  const s = n * Math.sin((apex * Math.PI) / 360)
  return s > 1 ? null : (2 * Math.asin(s) * 180) / Math.PI - apex
}
