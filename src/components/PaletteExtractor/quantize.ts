/** A colour as 0–255 channels. */
export type PaletteExtractorRgb = [number, number, number]

/** Opaque pixels as packed RGB triples, sampled to at most `limit` of them. */
export function paletteExtractorSamples(pixels: ImageData, limit = 40000): Uint8Array {
  const total = pixels.width * pixels.height
  const stride = Math.max(1, Math.floor(total / limit))
  const out: number[] = []
  for (let index = 0; index < total; index += stride) {
    const at = index * 4
    if (pixels.data[at + 3] < 128) continue
    out.push(pixels.data[at], pixels.data[at + 1], pixels.data[at + 2])
  }
  return Uint8Array.from(out)
}

interface Box {
  indices: Uint32Array
  range: number
  channel: number
}

function describe(samples: Uint8Array, indices: Uint32Array): Box {
  const low = [255, 255, 255]
  const high = [0, 0, 0]
  for (const index of indices)
    for (let channel = 0; channel < 3; channel += 1) {
      const value = samples[index * 3 + channel]
      if (value < low[channel]) low[channel] = value
      if (value > high[channel]) high[channel] = value
    }
  const ranges = high.map((value, channel) => value - low[channel])
  const channel = ranges.indexOf(Math.max(...ranges))
  return { indices, range: ranges[channel], channel }
}

const mean = (samples: Uint8Array, indices: Uint32Array): PaletteExtractorRgb => {
  const sum = [0, 0, 0]
  for (const index of indices) for (let channel = 0; channel < 3; channel += 1) sum[channel] += samples[index * 3 + channel]
  return sum.map((value) => value / Math.max(1, indices.length)) as PaletteExtractorRgb
}

/**
 * The median index, moved to the nearest place where the channel value
 * changes — so a run of one colour is never cut in two, which would average
 * half of it into a neighbour and invent a colour the image does not have.
 */
function cleanSplit(samples: Uint8Array, sorted: Uint32Array, channel: number) {
  const middle = Math.floor(sorted.length / 2)
  const value = (index: number) => samples[sorted[index] * 3 + channel]
  let left = middle
  while (left > 0 && value(left - 1) === value(middle)) left -= 1
  let right = middle
  while (right < sorted.length && value(right) === value(middle)) right += 1
  if (left > 0 && (middle - left <= right - middle || right >= sorted.length)) return left
  return right < sorted.length ? right : middle
}

/**
 * Median cut: start with one box holding every sample, and repeatedly split
 * the box whose population × widest channel range is largest, at the median
 * of that channel. Weighting by population as well as range stops a handful
 * of outlier pixels from earning a colour of their own.
 */
export function paletteExtractorMedianCut(samples: Uint8Array, count: number): PaletteExtractorRgb[] {
  const all = new Uint32Array(samples.length / 3)
  for (let index = 0; index < all.length; index += 1) all[index] = index
  if (all.length === 0) return []
  const boxes: Box[] = [describe(samples, all)]
  while (boxes.length < count) {
    let pick = -1
    let priority = 0
    boxes.forEach((box, index) => {
      const value = box.range * box.indices.length
      if (box.indices.length > 1 && box.range > 0 && value > priority) {
        priority = value
        pick = index
      }
    })
    if (pick === -1) break
    const { indices, channel } = boxes[pick]
    const sorted = Uint32Array.from(indices).sort((a, b) => samples[a * 3 + channel] - samples[b * 3 + channel])
    const middle = cleanSplit(samples, sorted, channel)
    boxes.splice(pick, 1, describe(samples, sorted.slice(0, middle)), describe(samples, sorted.slice(middle)))
  }
  return boxes.map((box) => mean(samples, box.indices))
}

/** Index of the nearest centroid for every sample, by squared RGB distance. */
export function paletteExtractorAssign(samples: Uint8Array, centroids: PaletteExtractorRgb[]): Uint16Array {
  const labels = new Uint16Array(samples.length / 3)
  for (let index = 0; index < labels.length; index += 1) {
    const r = samples[index * 3]
    const g = samples[index * 3 + 1]
    const b = samples[index * 3 + 2]
    let best = 0
    let bestDistance = Infinity
    for (let k = 0; k < centroids.length; k += 1) {
      const [cr, cg, cb] = centroids[k]
      const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        best = k
      }
    }
    labels[index] = best
  }
  return labels
}

/** One Lloyd step of k-means: move each centroid to the mean of the samples nearest it. Returns how far they moved. */
export function paletteExtractorRefine(samples: Uint8Array, centroids: PaletteExtractorRgb[]): { centroids: PaletteExtractorRgb[]; shift: number } {
  const labels = paletteExtractorAssign(samples, centroids)
  const sums = centroids.map(() => [0, 0, 0, 0])
  labels.forEach((label, index) => {
    sums[label][0] += samples[index * 3]
    sums[label][1] += samples[index * 3 + 1]
    sums[label][2] += samples[index * 3 + 2]
    sums[label][3] += 1
  })
  let shift = 0
  const next = centroids.map((centroid, k) => {
    const [r, g, b, n] = sums[k]
    if (!n) return centroid
    const moved: PaletteExtractorRgb = [r / n, g / n, b / n]
    shift = Math.max(shift, Math.hypot(moved[0] - centroid[0], moved[1] - centroid[1], moved[2] - centroid[2]))
    return moved
  })
  return { centroids: next, shift }
}
