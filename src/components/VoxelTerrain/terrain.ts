/**
 * The maths behind VoxelTerrain, as plain numbers with no DOM: a heightmap, its
 * colours, and the voxel-space renderer that turns them into a picture.
 *
 * Heightmap: diamond–square midpoint displacement (Fournier, Fussell and
 * Carpenter, 1982) on a 1024² grid whose indices wrap in both directions. The
 * wrap is not a convenience. Diamond–square averages neighbours, and on a torus
 * every point has four real neighbours, so the east edge is generated *from*
 * the west edge rather than stitched to it afterwards — the map has no seam and
 * no edge, and a camera that flies off one side is simply over the other. That
 * is the honest way to make a flight endless: not a bigger map, a map with no
 * boundary at all.
 *
 * Renderer: the “voxel space” of NovaLogic’s Comanche (1992). For each screen
 * column, walk away from the camera along the ground, project each height
 * sample to a screen row, and fill from that row up to the highest row already
 * drawn in the column (the y-buffer). Walking front to back means a pixel is
 * written once, by the nearest thing in front of it, and a column that is
 * already covered to the top is skipped outright — so the far distance, where
 * the steps are long and almost everything is hidden, costs almost nothing.
 * There are no polygons, and a ridge line resolves per pixel.
 */

export const MAP_BITS = 10
export const MAP_SIZE = 1 << MAP_BITS
const MASK = MAP_SIZE - 1

/** World units from the deepest sea floor to the highest peak. A map cell is one unit. */
export const HEIGHT_SCALE = 200

/** Heights are stored as 16-bit fractions of HEIGHT_SCALE. */
const UNIT = HEIGHT_SCALE / 65535

export type Rgb = [number, number, number]

export interface Terrain {
  /** Height of each cell, 0–65535 as a fraction of HEIGHT_SCALE, before the sea is flattened. */
  height: Uint16Array
  /** Sea level in the same units. Everything below it renders flat, as water. */
  water: number
  /** Lambert shade under a fixed sun, 0–255 where 160 is unlit colour. */
  shade: Uint8Array
  /** Steepness, 0 (flat) to 255 (a cliff), from the surface normal. */
  steep: Uint8Array
  /** The highest cell, for choosing a vantage. */
  peak: { x: number; y: number }
}

/** Per-cell colour with the shade already applied, and the two sky colours. */
export interface TerrainColours {
  r: Uint8Array
  g: Uint8Array
  b: Uint8Array
  /** Colour at the horizon; distance fog fades into it. */
  haze: Rgb
  /** Colour at the top of the sky. */
  zenith: Rgb
}

/* -------------------------------------------------------------- heightmap */

/** A small, fast, seedable PRNG (mulberry32), so a seed is the whole terrain. */
export function mulberry32(seed: number) {
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
 * Diamond–square on a 2^bits torus. Returns raw, unnormalised heights.
 *
 * `hurst` sets how fast the random displacement shrinks per octave: each halving
 * of the step multiplies it by 2^−hurst. Near 1 the land rolls; near 0 every
 * scale is as loud as the last and it turns to crags.
 *
 * The grid starts at a spacing of a quarter of the map with random values, not
 * with one corner: a single seed point on a torus is its own four corners, and
 * the first octave then has nothing to average but itself.
 */
export function diamondSquare(bits: number, hurst: number, seed: number): Float32Array {
  const n = 1 << bits
  const mask = n - 1
  const h = new Float32Array(n * n)
  const random = mulberry32(seed)
  let step = n >> 2
  for (let y = 0; y < n; y += step) for (let x = 0; x < n; x += step) h[(y << bits) | x] = random() * 2 - 1
  const decay = Math.pow(2, -hurst)
  let amp = decay
  while (step > 1) {
    const half = step >> 1
    // Diamond: the centre of each square is the mean of its four corners, plus noise.
    for (let y = 0; y < n; y += step) {
      const y0 = y << bits
      const y1 = ((y + step) & mask) << bits
      const ym = (y + half) << bits
      for (let x = 0; x < n; x += step) {
        const x1 = (x + step) & mask
        h[ym | (x + half)] = (h[y0 | x] + h[y0 | x1] + h[y1 | x] + h[y1 | x1]) * 0.25 + (random() * 2 - 1) * amp
      }
    }
    // Square: each edge midpoint is the mean of the two corners and the two
    // diamond centres either side of it. Wrapping is what gives the top row a
    // centre “above” it and the left column one to its left.
    for (let y = 0; y < n; y += step) {
      const y0 = y << bits
      const y1 = ((y + step) & mask) << bits
      const ym = (y + half) << bits
      const yu = ((y - half) & mask) << bits
      for (let x = 0; x < n; x += step) {
        const xm = x + half
        const x1 = (x + step) & mask
        const xl = (x - half) & mask
        h[y0 | xm] = (h[y0 | x] + h[y0 | x1] + h[yu | xm] + h[ym | xm]) * 0.25 + (random() * 2 - 1) * amp
        h[ym | x] = (h[y0 | x] + h[y1 | x] + h[ym | xl] + h[ym | xm]) * 0.25 + (random() * 2 - 1) * amp
      }
    }
    step = half
    amp *= decay
  }
  return h
}

function normalise(field: Float32Array) {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < field.length; i++) {
    const v = field[i]
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const span = hi - lo || 1
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - lo) / span
}

/**
 * One wrapping pass of a 1-2-1 tent filter. Diamond–square is known for creases
 * along its coarse grid lines — every midpoint on them is the mean of only two
 * parents — and one gentle pass hides them while keeping all but the finest octave.
 */
function tent(field: Float32Array, bits: number) {
  const n = 1 << bits
  const mask = n - 1
  const out = new Float32Array(field.length)
  for (let y = 0; y < n; y++) {
    const r = y << bits
    for (let x = 0; x < n; x++) out[r | x] = (field[r | ((x - 1) & mask)] + 2 * field[r | x] + field[r | ((x + 1) & mask)]) * 0.25
  }
  for (let y = 0; y < n; y++) {
    const r = y << bits
    const u = ((y - 1) & mask) << bits
    const d = ((y + 1) & mask) << bits
    for (let x = 0; x < n; x++) field[r | x] = (out[u | x] + 2 * out[r | x] + out[d | x]) * 0.25
  }
}

/** The sun: from the north-west and fairly high, so north-west faces catch it. */
const SUN = (() => {
  const v = [-0.55, -0.5, 0.67]
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
})()

/**
 * A complete terrain from a seed. `roughness` 0–1 maps to the Hurst exponent;
 * `waterLevel` 0–1 is the fraction of the height range under the sea.
 *
 * A million cells is tens of milliseconds per pass, so the build awaits `pause`
 * between passes — the caller yields to the browser there, and returns false to
 * abandon a build that a newer seed has overtaken (the result is then null).
 */
export async function buildTerrain(
  seed: number,
  roughness: number,
  waterLevel: number,
  pause: () => Promise<boolean> = () => Promise.resolve(true),
): Promise<Terrain | null> {
  const n = MAP_SIZE
  const r = Math.min(1, Math.max(0, roughness))
  const field = diamondSquare(MAP_BITS, 1.35 - r * 0.9, seed)
  if (!(await pause())) return null
  normalise(field)
  tent(field, MAP_BITS)
  normalise(field)
  if (!(await pause())) return null
  // A power curve flattens the lowlands and sharpens the peaks: raw fractional
  // noise is too symmetric, with as many deep pits as high summits.
  const height = new Uint16Array(n * n)
  const water = Math.round(Math.min(0.9, Math.max(0, waterLevel)) * 65535)
  const floor = water / 65535
  let best = 0
  let top = 0
  for (let i = 0; i < field.length; i++) {
    const v = field[i]
    const curved = v * Math.sqrt(v) // v^1.5
    height[i] = (curved * 65535 + 0.5) | 0
    if (curved > best) {
      best = curved
      top = i
    }
    // The flattened surface in world units, reused below for the gradient.
    field[i] = (curved > floor ? curved : floor) * HEIGHT_SCALE
  }
  const peak = { x: top & MASK, y: top >> MAP_BITS }

  // Lambert shade and steepness from the gradient of the flattened surface,
  // by central differences. The normal of z = e(x, y) is (−∂e/∂x, −∂e/∂y, 1).
  const shade = new Uint8Array(n * n)
  const steep = new Uint8Array(n * n)
  const [lx, ly, lz] = SUN
  for (let y = 0; y < n; y++) {
    const row = y << MAP_BITS
    const up = ((y - 1) & MASK) << MAP_BITS
    const down = ((y + 1) & MASK) << MAP_BITS
    for (let x = 0; x < n; x++) {
      const dx = (field[row | ((x + 1) & MASK)] - field[row | ((x - 1) & MASK)]) * 0.5
      const dy = (field[down | x] - field[up | x]) * 0.5
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1)
      const lambert = (-dx * lx - dy * ly + lz) * inv
      // 0.42 ambient + 0.78 direct: shadowed faces keep their colour, lit
      // ridges go a little past it — that overshoot is what makes them catch the light.
      const lit = (0.42 + 0.78 * (lambert > 0 ? lambert : 0)) * 160
      shade[row | x] = lit > 255 ? 255 : lit
      steep[row | x] = (1 - inv) * 255
    }
  }
  return { height, water, shade, steep, peak }
}

/** Height of the (flattened) surface in world units at any point, bilinear and wrapping. */
export function elevationAt(terrain: Terrain, x: number, y: number): number {
  const { height, water } = terrain
  const fx = Math.floor(x)
  const fy = Math.floor(y)
  const tx = x - fx
  const ty = y - fy
  const at = (i: number, j: number) => {
    const v = height[((j & MASK) << MAP_BITS) | (i & MASK)]
    return v > water ? v : water
  }
  const top = at(fx, fy) + (at(fx + 1, fy) - at(fx, fy)) * tx
  const bottom = at(fx, fy + 1) + (at(fx + 1, fy + 1) - at(fx, fy + 1)) * tx
  return (top + (bottom - top) * ty) * UNIT
}

/**
 * Somewhere worth looking from: low ground a fair way from the highest peak,
 * facing it, with nothing close by in the way. Forty-eight candidates (sixteen
 * bearings at three distances) are scored by the ground under them plus the
 * tallest thing in the first stretch of the sightline, and the lowest score
 * wins — usually a lake or a valley floor with the mountain filling the view.
 * The altitude returned clears that near stretch.
 */
export function vantage(terrain: Terrain): { x: number; y: number; z: number; yaw: number } {
  const { peak } = terrain
  let best = { x: peak.x, y: peak.y, z: HEIGHT_SCALE, yaw: 0 }
  let lowest = Infinity
  for (const reach of [260, 360, 460]) {
    for (let k = 0; k < 16; k++) {
      const yaw = (k / 16) * Math.PI * 2
      const cos = Math.cos(yaw)
      const sin = Math.sin(yaw)
      const x = peak.x - cos * reach
      const y = peak.y - sin * reach
      const ground = elevationAt(terrain, x, y)
      let block = 0
      for (let d = 8; d < reach * 0.4; d += 8) block = Math.max(block, elevationAt(terrain, x + cos * d, y + sin * d))
      const score = ground + Math.max(0, block - ground) * 1.5
      if (score < lowest) {
        lowest = score
        best = { x: ((x % MAP_SIZE) + MAP_SIZE) % MAP_SIZE, y: ((y % MAP_SIZE) + MAP_SIZE) % MAP_SIZE, z: Math.max(ground + 34, block + 16), yaw }
      }
    }
  }
  return best
}

/* ----------------------------------------------------------------- colour */

export type VoxelTerrainTone = 'terrain' | 'accent' | 'ink'

/** The theme tokens a palette is built from, already resolved to RGB. */
export interface PaletteTokens {
  ink: Rgb
  inkInverse: Rgb
  accent: Rgb
  canvas: Rgb
}

export interface TerrainPalette {
  deep: Rgb
  shallow: Rgb
  sand: Rgb
  low: Rgb
  high: Rgb
  rock: Rgb
  snow: Rgb
  zenith: Rgb
  haze: Rgb
  /** A dark theme: the land is dimmed to dusk so it does not glare against a dark page. */
  night: boolean
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const luma = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/** Rotate a colour's hue by `degrees`, keeping its lightness and saturation (HSL). */
function hueShift([r, g, b]: Rgb, degrees: number): Rgb {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [r, g, b]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  h = (((h * 60 + degrees) % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [a, bb, cc] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(a + m) * 255, (bb + m) * 255, (cc + m) * 255]
}

/**
 * Terrain bands from the theme, never from literal colours.
 *
 * The light and dark ends of every ramp are `ink` and `ink-inverse`, sorted by
 * lightness: in a light theme ink is the dark end, in a dark theme it is the
 * light end, and between them they always span the full range — so snow is
 * always the lightest thing on the page and deep water the darkest, whichever
 * way the theme runs. Grass is the accent. Water is the accent turned 150°
 * round the hue circle, which for the default lime is a clear blue and for any
 * other accent is a colour that stays apart from the land.
 */
export function terrainPalette(tokens: PaletteTokens, tone: VoxelTerrainTone): TerrainPalette {
  const { accent, canvas } = tokens
  const [dark, light] = luma(tokens.ink) < luma(tokens.inkInverse) ? [tokens.ink, tokens.inkInverse] : [tokens.inkInverse, tokens.ink]
  const night = luma(canvas) < 0.4
  const sea = tone === 'terrain' ? hueShift(accent, 150) : accent
  const zenith = mix(canvas, tone === 'ink' ? dark : sea, night ? 0.16 : 0.34)
  const haze = mix(mix(canvas, light, night ? 0 : 0.45), accent, tone === 'ink' ? 0.05 : night ? 0.2 : 0.14)
  if (tone === 'ink') {
    return {
      deep: mix(mix(dark, light, 0.1), accent, 0.08),
      shallow: mix(mix(dark, light, 0.3), accent, 0.1),
      sand: mix(dark, light, 0.78),
      low: mix(dark, light, 0.5),
      high: mix(dark, light, 0.62),
      rock: mix(dark, light, 0.4),
      snow: light,
      zenith,
      haze,
      night,
    }
  }
  if (tone === 'accent') {
    return {
      deep: mix(dark, accent, 0.18),
      shallow: mix(dark, accent, 0.38),
      sand: mix(accent, light, 0.55),
      low: mix(accent, dark, 0.42),
      high: mix(accent, dark, 0.12),
      rock: mix(accent, dark, 0.6),
      snow: mix(light, accent, 0.12),
      zenith,
      haze,
      night,
    }
  }
  return {
    deep: mix(dark, sea, 0.32),
    shallow: mix(mix(dark, sea, 0.7), light, 0.12),
    sand: mix(mix(light, accent, 0.45), dark, 0.22),
    low: mix(accent, dark, 0.5),
    high: mix(accent, dark, 0.22),
    rock: mix(mix(dark, light, 0.42), accent, 0.06),
    snow: light,
    zenith,
    haze,
    night,
  }
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Colour every cell: a height ramp (sand, low grass, high grass, rock, snow),
 * then slope — steep faces turn to rock whatever their height, and snow only
 * lies where it is flat enough to settle — then the lambert shade on top.
 */
export function paintTerrain(terrain: Terrain, palette: TerrainPalette): TerrainColours {
  const count = MAP_SIZE * MAP_SIZE
  const r = new Uint8Array(count)
  const g = new Uint8Array(count)
  const b = new Uint8Array(count)
  const { height, water, shade, steep } = terrain
  const stops: [number, Rgb][] = [
    [0, palette.sand],
    [0.035, palette.low],
    [0.26, palette.high],
    [0.5, palette.rock],
    [0.66, palette.rock],
    [0.78, palette.snow],
    [1, palette.snow],
  ]
  // The height ramp as a 256-entry table, so the per-cell work is a lookup.
  const ramp = new Float32Array(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let k = 0
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++
    const [t0, c0] = stops[k]
    const [t1, c1] = stops[k + 1]
    const c = mix(c0, c1, smoothstep(t0, t1, t))
    ramp[i * 3] = c[0]
    ramp[i * 3 + 1] = c[1]
    ramp[i * 3 + 2] = c[2]
  }
  const dim = palette.night ? 0.72 : 1
  const land = 65535 - water || 1
  for (let i = 0; i < count; i++) {
    const h = height[i]
    let cr: number
    let cg: number
    let cb: number
    if (h <= water) {
      const depth = smoothstep(0, 0.55, (water - h) / (water || 1))
      cr = palette.shallow[0] + (palette.deep[0] - palette.shallow[0]) * depth
      cg = palette.shallow[1] + (palette.deep[1] - palette.shallow[1]) * depth
      cb = palette.shallow[2] + (palette.deep[2] - palette.shallow[2]) * depth
    } else {
      const t = (h - water) / land
      const k = Math.min(255, (t * 255) | 0) * 3
      cr = ramp[k]
      cg = ramp[k + 1]
      cb = ramp[k + 2]
      const s = steep[i] / 255
      const rocky = smoothstep(0.3, 0.55, s) * smoothstep(0.02, 0.06, t)
      const snowy = smoothstep(0.62, 0.8, t) * (1 - smoothstep(0.35, 0.6, s))
      const toward = rocky * (1 - snowy)
      cr += (palette.rock[0] - cr) * toward
      cg += (palette.rock[1] - cg) * toward
      cb += (palette.rock[2] - cb) * toward
    }
    const light = (shade[i] / 160) * dim
    r[i] = Math.min(255, cr * light)
    g[i] = Math.min(255, cg * light)
    b[i] = Math.min(255, cb * light)
  }
  return { r, g, b, haze: palette.haze, zenith: palette.zenith }
}

/* --------------------------------------------------------------- renderer */

export interface VoxelCamera {
  /** Position on the map, in cells. Any value; it wraps. */
  x: number
  y: number
  /** Altitude in world units. */
  z: number
  /** Heading in radians: 0 faces +x (east), π/2 faces +y (south). */
  yaw: number
  /** Horizon offset as a fraction of screen height: negative looks down, positive up. */
  pitch: number
  /** Bank in radians; positive drops the left wing. */
  roll: number
}

export interface VoxelView {
  /** How far to draw, in cells. */
  distance: number
  /** How fast the sample step grows with distance: step = 0.5 + growth · z. */
  growth: number
  /** Fog density, 0–1. 0 still fades the last stretch so the far edge never pops. */
  fog: number
  /** tan of half the horizontal field of view. */
  tanHalfFov: number
}

/** Scratch space the renderer reuses between frames, sized to the buffer. */
export interface VoxelScratch {
  ybuffer: Int32Array
  horizon: Float32Array
  sky: Uint32Array
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

/** Pack a colour into the byte order an ImageData's Uint32 view expects. */
export const pack = LITTLE_ENDIAN
  ? (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
  : (r: number, g: number, b: number) => ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0

export function createScratch(width: number, height: number): VoxelScratch {
  return { ybuffer: new Int32Array(width), horizon: new Float32Array(width), sky: new Uint32Array(height * 4) }
}

/**
 * The sky gradient as a table, indexed by rows above the horizon (offset by
 * twice the screen height, so a horizon pitched off screen still has an entry):
 * haze at and below the horizon, easing to the zenith colour over most of a screen.
 */
export function paintSky(scratch: VoxelScratch, height: number, colours: TerrainColours) {
  const { haze, zenith } = colours
  const span = height * 0.9
  for (let j = 0; j < scratch.sky.length; j++) {
    const above = j - height * 2
    const t = above <= 0 ? 0 : Math.pow(Math.min(1, above / span), 0.75)
    scratch.sky[j] = pack(
      Math.round(haze[0] + (zenith[0] - haze[0]) * t),
      Math.round(haze[1] + (zenith[1] - haze[1]) * t),
      Math.round(haze[2] + (zenith[2] - haze[2]) * t),
    )
  }
}

/**
 * Draw one frame into `out`, a width × height Uint32 view of an ImageData.
 *
 * Pitch and roll are the voxel-space shear, not a true rotation: pitch moves the
 * horizon, roll tilts it by shifting each column. For the angles a flight uses
 * that is indistinguishable from rotating the camera, and it keeps the one
 * property the whole method rests on — every screen column is one ray along the
 * ground — so verticals stay vertical and the y-buffer still works.
 */
export function renderVoxels(
  out: Uint32Array,
  width: number,
  height: number,
  terrain: Terrain,
  colours: TerrainColours,
  camera: VoxelCamera,
  view: VoxelView,
  scratch: VoxelScratch,
) {
  const { ybuffer, horizon, sky } = scratch
  const { height: map, water } = terrain
  const { r: R, g: G, b: B, haze } = colours
  const focal = width / 2 / view.tanHalfFov
  const base = height * 0.5 + camera.pitch * height
  const tilt = Math.tan(camera.roll)
  for (let i = 0; i < width; i++) {
    ybuffer[i] = height
    horizon[i] = base + (i - width / 2) * tilt
  }

  // Offsetting by a multiple of the map keeps every sample coordinate positive,
  // so `| 0` is a floor and `& MASK` is the wrap, with no Math.floor in the loop.
  const offset = MAP_SIZE * 8
  const cx = (((camera.x % MAP_SIZE) + MAP_SIZE) % MAP_SIZE) + offset
  const cy = (((camera.y % MAP_SIZE) + MAP_SIZE) % MAP_SIZE) + offset
  const fx = Math.cos(camera.yaw)
  const fy = Math.sin(camera.yaw)
  // Right-hand vector: the heading turned a quarter clockwise (y points south).
  const rx = -fy
  const ry = fx
  const camZ = camera.z
  const hr = haze[0]
  const hg = haze[1]
  const hb = haze[2]
  const density = 0.4 + view.fog * 3.6
  const far = view.distance
  let open = width
  let z = 1
  while (z < far && open > 0) {
    const d = z / far
    // Exponential-squared fog, plus a fade over the last quarter that hides the cut-off.
    const fog = Math.max(1 - Math.exp(-d * d * density), smoothstep(0.72, 1, d))
    const f = Math.round(Math.min(1, fog) * 256)
    const half = z * view.tanHalfFov
    let px = cx + fx * z - rx * half
    let py = cy + fy * z - ry * half
    const dx = (rx * half * 2) / width
    const dy = (ry * half * 2) / width
    const invz = focal / z
    for (let i = 0; i < width; i++) {
      const top = ybuffer[i]
      if (top > 0) {
        const k = (((py | 0) & MASK) << MAP_BITS) | ((px | 0) & MASK)
        const h = map[k]
        const y = (camZ - (h > water ? h : water) * UNIT) * invz + horizon[i]
        if (y < top) {
          const row = y <= 0 ? 0 : Math.ceil(y)
          if (row < top) {
            // One colour per run, not per pixel: fog is applied once for the
            // whole vertical strip this sample uncovers.
            const cr = R[k]
            const cg = G[k]
            const cb = B[k]
            const colour = pack(cr + (((hr - cr) * f) >> 8), cg + (((hg - cg) * f) >> 8), cb + (((hb - cb) * f) >> 8))
            for (let p = row * width + i, end = top * width; p < end; p += width) out[p] = colour
            ybuffer[i] = row
            if (row === 0) open--
          }
        }
      }
      px += dx
      py += dy
    }
    z += 0.5 + view.growth * z
  }

  // Sky: whatever each column left uncovered, from the gradient table
  // indexed by height above that column's horizon, so a rolled horizon tilts
  // the sky with it.
  const limit = height * 4 - 1
  for (let i = 0; i < width; i++) {
    const top = ybuffer[i]
    const h0 = Math.round(horizon[i]) + height * 2
    for (let row = 0, p = i; row < top; row++, p += width) {
      const j = h0 - row
      out[p] = sky[j < 0 ? 0 : j > limit ? limit : j]
    }
  }
}
