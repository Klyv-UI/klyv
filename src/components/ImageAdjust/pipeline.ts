export type ImageAdjustChannel = 'rgb' | 'r' | 'g' | 'b'

/** A point on a tone curve, input to output, both 0–255. */
export interface ImageAdjustCurvePoint {
  x: number
  y: number
}

export interface ImageAdjustSettings {
  /** Stops of exposure, −2 to 2. */
  exposure: number
  /** −100 to 100. */
  contrast: number
  /** −100 (greyscale) to 100. */
  saturation: number
  /** −100 (cool) to 100 (warm). */
  temperature: number
  /** Tone curve per channel. `rgb` applies to all three first; the channel curves apply after it. */
  curves: Record<ImageAdjustChannel, ImageAdjustCurvePoint[]>
  /** Input black and white points (0–255) and midtone gamma (0.1–9.99). */
  levels: { black: number; white: number; gamma: number }
  /** Clockwise quarter turns, in degrees. */
  rotation: 0 | 90 | 180 | 270
  flipX: boolean
  flipY: boolean
}

const IDENTITY: ImageAdjustCurvePoint[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
]

export const IMAGE_ADJUST_DEFAULTS: ImageAdjustSettings = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  curves: { rgb: IDENTITY, r: IDENTITY, g: IDENTITY, b: IDENTITY },
  levels: { black: 0, white: 255, gamma: 1 },
  rotation: 0,
  flipX: false,
  flipY: false,
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson). Unlike a natural spline it
 * never overshoots between points, so a curve dragged up at one end cannot
 * dip below its neighbours and invert tones in between.
 */
export function imageAdjustSpline(points: ImageAdjustCurvePoint[]): (x: number) => number {
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const n = sorted.length
  if (n === 0) return (x) => x
  if (n === 1) return () => sorted[0].y
  const slopes: number[] = []
  for (let k = 0; k < n - 1; k += 1) slopes.push((sorted[k + 1].y - sorted[k].y) / (sorted[k + 1].x - sorted[k].x || 1))
  const tangents = sorted.map((_, k) => (k === 0 ? slopes[0] : k === n - 1 ? slopes[n - 2] : (slopes[k - 1] + slopes[k]) / 2))
  for (let k = 0; k < n - 1; k += 1) {
    if (slopes[k] === 0) {
      tangents[k] = tangents[k + 1] = 0
      continue
    }
    if (k > 0 && slopes[k - 1] * slopes[k] <= 0) tangents[k] = 0
    const a = tangents[k] / slopes[k]
    const b = tangents[k + 1] / slopes[k]
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      tangents[k] = tau * a * slopes[k]
      tangents[k + 1] = tau * b * slopes[k]
    }
  }
  return (x) => {
    if (x <= sorted[0].x) return sorted[0].y
    if (x >= sorted[n - 1].x) return sorted[n - 1].y
    let k = 0
    while (x > sorted[k + 1].x) k += 1
    const h = sorted[k + 1].x - sorted[k].x
    const t = (x - sorted[k].x) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * sorted[k].y +
      (t3 - 2 * t2 + t) * h * tangents[k] +
      (-2 * t3 + 3 * t2) * sorted[k + 1].y +
      (t3 - t2) * h * tangents[k + 1]
    )
  }
}

/** A curve sampled into the 256-entry table the pixel loop reads. */
export function imageAdjustCurveLut(points: ImageAdjustCurvePoint[]): Uint8ClampedArray {
  const curve = imageAdjustSpline(points)
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v += 1) lut[v] = Math.round(curve(v))
  return lut
}

/**
 * Every per-channel operation folded into one table per channel, so the pixel
 * loop does three lookups and a saturation mix regardless of how many controls
 * moved. Order: white balance, exposure, levels, contrast, master curve, channel curve.
 */
export function imageAdjustLuts(settings: ImageAdjustSettings): Uint8ClampedArray[] {
  const master = imageAdjustCurveLut(settings.curves.rgb)
  const gain = 2 ** settings.exposure
  const warmth = settings.temperature / 100
  const balance = [1 + 0.18 * warmth, 1 + 0.02 * warmth, 1 - 0.18 * warmth]
  const { black, white, gamma } = settings.levels
  const span = Math.max(1, white - black)
  const c = (settings.contrast / 100) * 255
  const contrast = (259 * (c + 255)) / (255 * (259 - c))
  return (['r', 'g', 'b'] as const).map((channel, index) => {
    const own = imageAdjustCurveLut(settings.curves[channel])
    const lut = new Uint8ClampedArray(256)
    for (let v = 0; v < 256; v += 1) {
      let x = v * balance[index] * gain
      x = Math.min(1, Math.max(0, (x - black) / span)) ** (1 / gamma) * 255
      x = (x - 128) * contrast + 128
      lut[v] = own[master[Math.min(255, Math.max(0, Math.round(x)))]]
    }
    return lut
  })
}
