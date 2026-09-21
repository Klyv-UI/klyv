/**
 * The vibration modes behind ChladniPlate, as plain numbers with no DOM.
 *
 * Square plate: the classic approximation
 *   u(x, y) = cos(nπx)·cos(mπy) − cos(mπx)·cos(nπy)
 * on the unit square, with an eigenfrequency proportional to n² + m².
 *
 * Circular plate: u(r, θ) = J_n(α·r)·cos(nθ), where α is a root of J_n′ so the
 * rim is free to move (sand leaves the edge, as it does on a real plate). The
 * frequency goes as α². J_n is evaluated from Bessel’s integral with the
 * trapezoid rule, which converges fast because the integrand is periodic.
 */

export type ChladniPlateShape = 'square' | 'circle'

export interface ChladniPlateMode {
  /** Square: first wave number. Circle: nodal diameters. */
  n: number
  /** Square: second wave number. Circle: nodal circles, counting from 1. */
  m: number
  /** Hertz. */
  frequency: number
  /** Circle only: the radial wave number. */
  alpha?: number
}

/** Resolution of the precomputed amplitude field. */
export const FIELD_SIZE = 220

/** J_n(x) by Bessel’s integral: (1/π)∫₀^π cos(nτ − x·sinτ) dτ. */
export function besselJ(n: number, x: number): number {
  const steps = 96
  let sum = 0
  for (let k = 0; k <= steps; k++) {
    const tau = (k / steps) * Math.PI
    const weight = k === 0 || k === steps ? 0.5 : 1
    sum += weight * Math.cos(n * tau - x * Math.sin(tau))
  }
  return sum / steps
}

const besselPrime = (n: number, x: number) => (n === 0 ? -besselJ(1, x) : (besselJ(n - 1, x) - besselJ(n + 1, x)) / 2)

let squareCache: ChladniPlateMode[] | null = null
let circleCache: ChladniPlateMode[] | null = null

/** Square-plate modes with 2 ≤ n ≤ 10 and 0 ≤ m < n, sorted by eigenfrequency. */
export function squareModes(): ChladniPlateMode[] {
  if (squareCache) return squareCache
  const out: ChladniPlateMode[] = []
  for (let n = 2; n <= 10; n++) for (let m = 0; m < n; m++) out.push({ n, m, frequency: 12 * (n * n + m * m) })
  squareCache = out.sort((a, b) => a.frequency - b.frequency || a.n - b.n)
  return squareCache
}

/** Circular-plate modes: n nodal diameters, the roots of J_n′ up to α ≈ 19, sorted by eigenfrequency. */
export function circleModes(): ChladniPlateMode[] {
  if (circleCache) return circleCache
  const out: ChladniPlateMode[] = []
  for (let n = 0; n <= 8; n++) {
    let previous = besselPrime(n, 0.3)
    let count = 0
    for (let x = 0.35; x < 19.2; x += 0.05) {
      const value = besselPrime(n, x)
      if (previous * value < 0) {
        let lo = x - 0.05
        let hi = x
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2
          if (besselPrime(n, lo) * besselPrime(n, mid) <= 0) hi = mid
          else lo = mid
        }
        const alpha = (lo + hi) / 2
        count++
        if (alpha > 2.9) out.push({ n, m: count, alpha, frequency: 6.5 * alpha * alpha })
      }
      previous = value
    }
  }
  circleCache = out.sort((a, b) => a.frequency - b.frequency)
  return circleCache
}

export const modesFor = (shape: ChladniPlateShape) => (shape === 'circle' ? circleModes() : squareModes())

/** The mode whose eigenfrequency is nearest `frequency` on a log scale. */
export function nearestMode(modes: ChladniPlateMode[], frequency: number): number {
  let best = 0
  let distance = Infinity
  for (let i = 0; i < modes.length; i++) {
    const d = Math.abs(Math.log(modes[i].frequency / frequency))
    if (d < distance) {
      distance = d
      best = i
    }
  }
  return best
}

const radialCache = new Map<string, Float32Array<ArrayBuffer>>()

/** J_n(α·r) sampled on r ∈ [0, 1]. */
function radial(mode: ChladniPlateMode) {
  const key = `${mode.n}:${mode.alpha}`
  const cached = radialCache.get(key)
  if (cached) return cached
  const table = new Float32Array(257)
  for (let i = 0; i <= 256; i++) table[i] = besselJ(mode.n, (mode.alpha ?? 0) * (i / 256))
  radialCache.set(key, table)
  return table
}

/** Signed displacement at plate coordinates (x, y) ∈ [0, 1]². Zero outside a circular plate. */
export function displacement(shape: ChladniPlateShape, mode: ChladniPlateMode, x: number, y: number): number {
  if (shape === 'square') {
    const { n, m } = mode
    return Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) - Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y)
  }
  const dx = x * 2 - 1
  const dy = y * 2 - 1
  const r = Math.hypot(dx, dy)
  if (r > 1) return 0
  const table = radial(mode)
  const position = r * 256
  const i = Math.min(255, Math.floor(position))
  const t = position - i
  return (table[i] + (table[i + 1] - table[i]) * t) * Math.cos(mode.n * Math.atan2(dy, dx))
}

/** |u| on a FIELD_SIZE² grid, normalised so the strongest antinode is 1. */
export function amplitudeField(shape: ChladniPlateShape, mode: ChladniPlateMode) {
  const size = FIELD_SIZE
  const field = new Float32Array(size * size)
  let peak = 0
  for (let j = 0; j < size; j++) {
    const y = (j + 0.5) / size
    for (let i = 0; i < size; i++) {
      const value = Math.abs(displacement(shape, mode, (i + 0.5) / size, y))
      field[j * size + i] = value
      if (value > peak) peak = value
    }
  }
  if (peak > 0) for (let k = 0; k < field.length; k++) field[k] /= peak
  return field
}
