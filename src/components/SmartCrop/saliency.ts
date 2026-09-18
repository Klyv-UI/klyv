/** A crop as fractions of the image, 0–1 on each axis. */
export interface SmartCropRect {
  x: number
  y: number
  width: number
  height: number
}

/** A scored crop suggestion. */
export interface SmartCropSuggestion extends SmartCropRect {
  /** Share of the image’s weighted interest the crop keeps, less a penalty for what it cuts; higher is better. */
  score: number
}

export interface SmartCropMap {
  width: number
  height: number
  /** Interest per cell, 0–1. */
  values: Float32Array
}

/** A skin tone, as a direction in RGB space — the same hue at any brightness points the same way. */
const SKIN = [0.78, 0.57, 0.44]
const SKIN_LENGTH = Math.hypot(SKIN[0], SKIN[1], SKIN[2])

/**
 * Where the interest is in an image, on a coarse grid: edge energy from a
 * Sobel pass, skin tones, and strong saturation, weighted and normalised.
 * Faces and subjects score through skin and detail; flat sky and walls score
 * near zero, which is exactly what a crop can afford to lose.
 */
export function smartCropSaliency(pixels: ImageData, maxSide = 120): SmartCropMap {
  const scale = Math.min(1, maxSide / Math.max(pixels.width, pixels.height))
  const width = Math.max(3, Math.round(pixels.width * scale))
  const height = Math.max(3, Math.round(pixels.height * scale))
  const rgb = new Float32Array(width * height * 3)
  // Box-filter down to the analysis grid, so thin detail is averaged rather than skipped.
  const counts = new Float32Array(width * height)
  for (let y = 0; y < pixels.height; y += 1) {
    const row = Math.min(height - 1, Math.floor(y * scale))
    for (let x = 0; x < pixels.width; x += 1) {
      const cell = row * width + Math.min(width - 1, Math.floor(x * scale))
      const at = (y * pixels.width + x) * 4
      rgb[cell * 3] += pixels.data[at]
      rgb[cell * 3 + 1] += pixels.data[at + 1]
      rgb[cell * 3 + 2] += pixels.data[at + 2]
      counts[cell] += 1
    }
  }
  const luma = new Float32Array(width * height)
  for (let cell = 0; cell < counts.length; cell += 1) {
    const n = counts[cell] || 1
    rgb[cell * 3] /= n * 255
    rgb[cell * 3 + 1] /= n * 255
    rgb[cell * 3 + 2] /= n * 255
    luma[cell] = 0.299 * rgb[cell * 3] + 0.587 * rgb[cell * 3 + 1] + 0.114 * rgb[cell * 3 + 2]
  }

  const values = new Float32Array(width * height)
  let peak = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = y * width + x
      let edge = 0
      if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
        const l = (dx: number, dy: number) => luma[cell + dy * width + dx]
        const gx = l(1, -1) + 2 * l(1, 0) + l(1, 1) - l(-1, -1) - 2 * l(-1, 0) - l(-1, 1)
        const gy = l(-1, 1) + 2 * l(0, 1) + l(1, 1) - l(-1, -1) - 2 * l(0, -1) - l(1, -1)
        edge = Math.min(1, Math.hypot(gx, gy) / 2)
      }
      const r = rgb[cell * 3]
      const g = rgb[cell * 3 + 1]
      const b = rgb[cell * 3 + 2]
      const length = Math.hypot(r, g, b) || 1
      const distance = Math.hypot(r / length - SKIN[0] / SKIN_LENGTH, g / length - SKIN[1] / SKIN_LENGTH, b / length - SKIN[2] / SKIN_LENGTH)
      const skinness = 1 - distance
      const skin = skinness > 0.8 && luma[cell] > 0.2 && luma[cell] < 0.95 ? (skinness - 0.8) / 0.2 : 0
      const max = Math.max(r, g, b)
      const chroma = max > 0 ? (max - Math.min(r, g, b)) / max : 0
      const saturation = chroma > 0.4 && luma[cell] > 0.05 && luma[cell] < 0.9 ? (chroma - 0.4) / 0.6 : 0
      const value = edge * 1 + skin * 1.8 + saturation * 0.5
      values[cell] = value
      if (value > peak) peak = value
    }
  }
  if (peak > 0) for (let cell = 0; cell < values.length; cell += 1) values[cell] /= peak
  return { width, height, values }
}

/** 1 on a third line, falling to 0 a sixth of the way away. */
const third = (u: number) => Math.max(0, 1 - Math.min(Math.abs(u - 1 / 3), Math.abs(u - 2 / 3)) * 6)

/**
 * Score every candidate crop of one size. Interest inside the crop counts
 * more the nearer it sits to a third line, most at an intersection; interest
 * near the crop’s edge counts less, so subjects are not cut at the border;
 * interest left outside is subtracted.
 */
export function smartCropScoreSize(map: SmartCropMap, cropWidth: number, cropHeight: number, total: number): SmartCropSuggestion {
  const { width, height, values } = map
  const cw = Math.max(1, Math.round(cropWidth))
  const ch = Math.max(1, Math.round(cropHeight))
  const wx = new Float32Array(cw)
  const wy = new Float32Array(ch)
  const tx = new Float32Array(cw)
  const ty = new Float32Array(ch)
  const edge = (u: number) => Math.min(1, Math.min(u, 1 - u) / 0.08)
  for (let i = 0; i < cw; i += 1) {
    const u = (i + 0.5) / cw
    tx[i] = third(u)
    wx[i] = edge(u)
  }
  for (let j = 0; j < ch; j += 1) {
    const v = (j + 0.5) / ch
    ty[j] = third(v)
    wy[j] = edge(v)
  }
  const step = Math.max(1, Math.round(Math.min(width, height) * 0.04))
  let best: SmartCropSuggestion = { x: 0, y: 0, width: cw / width, height: ch / height, score: -Infinity }
  for (let y0 = 0; y0 + ch <= height; y0 += step) {
    for (let x0 = 0; x0 + cw <= width; x0 += step) {
      let inside = 0
      let weighted = 0
      for (let j = 0; j < ch; j += 1) {
        const row = (y0 + j) * width + x0
        for (let i = 0; i < cw; i += 1) {
          const s = values[row + i]
          if (s === 0) continue
          inside += s
          weighted += s * wx[i] * wy[j] * (0.45 + 0.35 * (tx[i] + ty[j]) + 0.7 * tx[i] * ty[j])
        }
      }
      const score = (weighted - 0.6 * (total - inside)) / (total || 1)
      if (score > best.score) best = { x: x0 / width, y: y0 / height, width: cw / width, height: ch / height, score }
    }
  }
  return best
}

/** The candidate sizes for an aspect ratio: the largest that fits, then smaller, down to 55% of it. */
export function smartCropSizes(map: SmartCropMap, aspect: number): [number, number][] {
  const fitsWide = map.width / map.height > aspect
  const fullWidth = fitsWide ? map.height * aspect : map.width
  const fullHeight = fitsWide ? map.height : map.width / aspect
  return [1, 0.9, 0.8, 0.7, 0.62, 0.55].map((scale) => [fullWidth * scale, fullHeight * scale])
}
