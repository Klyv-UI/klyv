/**
 * OKLCH to sRGB and back, with gamut mapping.
 *
 * The theme derives whole neutral palettes from a hue and a chroma, and it has
 * to do that in a space where equal steps of lightness look equal whatever the
 * hue — which HSL is not: an HSL yellow at 50% is far brighter than an HSL blue
 * at 50%. OKLCH is. It is written out here rather than taken from a colour
 * library because it is forty lines of matrices, and the library has two
 * runtime dependencies it intends to keep at two.
 *
 * Matrices from Björn Ottosson's reference implementation.
 */

export interface Oklch {
  /** Perceived lightness, 0 to 1. */
  l: number
  /** Chroma, 0 upward. sRGB tops out near 0.37. */
  c: number
  /** Hue angle in degrees. Meaningless when chroma is 0. */
  h: number
}

const toLinear = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
const toGamma = (value: number) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055)

function linearRgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180
  const a = c * Math.cos(radians)
  const b = c * Math.sin(radians)
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ]
}

const EPSILON = 1e-5

/** Whether a colour can be shown on an sRGB screen without clipping. */
export function inGamut(color: Oklch): boolean {
  return linearRgb(color).every((channel) => channel >= -EPSILON && channel <= 1 + EPSILON)
}

/**
 * The nearest displayable colour of the same lightness and hue.
 *
 * Chroma is the only thing given up. Clipping each RGB channel instead — what
 * a naive conversion does — shifts the hue and the lightness too, so a deep
 * teal comes back a different, brighter green; and lightness is the one thing
 * a contrast guarantee cannot afford to lose.
 */
export function clipToGamut(color: Oklch): Oklch {
  const l = Math.min(1, Math.max(0, color.l))
  const clamped = { l, c: Math.max(0, color.c), h: color.h }
  if (inGamut(clamped)) return clamped

  let low = 0
  let high = clamped.c
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2
    if (inGamut({ l, c: middle, h: color.h })) low = middle
    else high = middle
  }
  return { l, c: low, h: color.h }
}

/** Channels 0–255, gamut-mapped first. */
export function oklchToRgb(color: Oklch): [number, number, number] {
  return linearRgb(clipToGamut(color)).map((channel) =>
    Math.round(Math.min(1, Math.max(0, toGamma(channel))) * 255),
  ) as [number, number, number]
}

export function oklchToHex(color: Oklch): string {
  return `#${oklchToRgb(color)
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

export function hexToOklch(hex: string): Oklch {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((character) => character + character).join('') : value
  const number = Number.parseInt(full, 16)
  const [r, g, b] = [(number >> 16) & 255, (number >> 8) & 255, number & 255].map((channel) => toLinear(channel / 255))

  const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const medium = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const short = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const l = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short
  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short
  const bb = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short
  const c = Math.hypot(a, bb)
  const h = c < EPSILON ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
  return { l, c, h }
}
