/** A point in image pixels. */
export interface DocumentScannerPoint {
  x: number
  y: number
}

/** Page corners, in order: top-left, top-right, bottom-right, bottom-left. */
export type DocumentScannerQuad = [DocumentScannerPoint, DocumentScannerPoint, DocumentScannerPoint, DocumentScannerPoint]

/** Separable 5-tap binomial blur, which approximates a Gaussian with σ ≈ 1. */
function blur(gray: Float32Array, width: number, height: number) {
  const kernel = [1, 4, 6, 4, 1]
  const pass = new Float32Array(gray.length)
  const out = new Float32Array(gray.length)
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      let sum = 0
      for (let k = -2; k <= 2; k += 1) sum += gray[y * width + Math.min(width - 1, Math.max(0, x + k))] * kernel[k + 2]
      pass[y * width + x] = sum / 16
    }
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      let sum = 0
      for (let k = -2; k <= 2; k += 1) sum += pass[Math.min(height - 1, Math.max(0, y + k)) * width + x] * kernel[k + 2]
      out[y * width + x] = sum / 16
    }
  return out
}

/**
 * Canny-style edges: blur, Sobel, thin to one pixel by non-maximum
 * suppression along the gradient, then keep weak edges only where they touch
 * strong ones (hysteresis). Returns 1 for edge pixels.
 */
export function documentScannerEdges(pixels: ImageData): Uint8Array {
  const { width, height, data } = pixels
  const gray = new Float32Array(width * height)
  for (let index = 0; index < gray.length; index += 1) gray[index] = 0.299 * data[index * 4] + 0.587 * data[index * 4 + 1] + 0.114 * data[index * 4 + 2]
  const smooth = blur(gray, width, height)
  const magnitude = new Float32Array(width * height)
  const direction = new Uint8Array(width * height)
  let peak = 0
  for (let y = 1; y < height - 1; y += 1)
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x
      const s = (dx: number, dy: number) => smooth[at + dy * width + dx]
      const gx = s(1, -1) + 2 * s(1, 0) + s(1, 1) - s(-1, -1) - 2 * s(-1, 0) - s(-1, 1)
      const gy = s(-1, 1) + 2 * s(0, 1) + s(1, 1) - s(-1, -1) - 2 * s(0, -1) - s(1, -1)
      magnitude[at] = Math.hypot(gx, gy)
      if (magnitude[at] > peak) peak = magnitude[at]
      // Quantise the gradient angle to one of four neighbour axes.
      const angle = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180
      direction[at] = angle < 22.5 || angle >= 157.5 ? 0 : angle < 67.5 ? 1 : angle < 112.5 ? 2 : 3
    }
  const high = peak * 0.22
  const low = high * 0.4
  const state = new Uint8Array(width * height)
  const stack: number[] = []
  const offsets = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ]
  for (let y = 1; y < height - 1; y += 1)
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x
      const value = magnitude[at]
      if (value < low) continue
      const [dx, dy] = offsets[direction[at]]
      if (value < magnitude[at + dy * width + dx] || value < magnitude[at - dy * width - dx]) continue
      state[at] = value >= high ? 2 : 1
      if (value >= high) stack.push(at)
    }
  const edges = new Uint8Array(width * height)
  while (stack.length) {
    const at = stack.pop()!
    if (edges[at]) continue
    edges[at] = 1
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        const next = at + dy * width + dx
        if (state[next] && !edges[next]) stack.push(next)
      }
  }
  return edges
}

const cross = (o: DocumentScannerPoint, a: DocumentScannerPoint, b: DocumentScannerPoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

function hull(points: DocumentScannerPoint[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const lower: DocumentScannerPoint[] = []
  const upper: DocumentScannerPoint[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop()
    lower.push(point)
  }
  for (const point of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop()
    upper.push(point)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

const area = (quad: DocumentScannerPoint[]) =>
  Math.abs(quad.reduce((sum, point, index) => sum + point.x * quad[(index + 1) % quad.length].y - quad[(index + 1) % quad.length].x * point.y, 0)) / 2

/** Corners sorted clockwise from the top-left, by sums and differences of their coordinates. */
export function documentScannerOrder(points: DocumentScannerPoint[]): DocumentScannerQuad {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y))
  const byDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y))
  return [bySum[0], byDiff[3], bySum[3], byDiff[0]]
}

/**
 * The page outline: the connected edge contour with the largest extent,
 * reduced to its convex hull, then to the four hull vertices enclosing the
 * most area. Returns null when nothing large enough to be a page is found.
 */
export function documentScannerFindQuad(edges: Uint8Array, width: number, height: number): DocumentScannerQuad | null {
  // Close one-pixel gaps so a page border broken by a shadow still forms one contour.
  const closed = new Uint8Array(edges.length)
  for (let y = 1; y < height - 1; y += 1)
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x
      if (edges[at] || edges[at - 1] || edges[at + 1] || edges[at - width] || edges[at + width]) closed[at] = 1
    }
  const label = new Int32Array(edges.length)
  let best: DocumentScannerPoint[] = []
  let bestExtent = 0
  let next = 1
  for (let start = 0; start < closed.length; start += 1) {
    if (!closed[start] || label[start]) continue
    const members: DocumentScannerPoint[] = []
    const stack = [start]
    label[start] = next
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    while (stack.length) {
      const at = stack.pop()!
      const x = at % width
      const y = (at - x) / width
      members.push({ x, y })
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const neighbour = ny * width + nx
          if (closed[neighbour] && !label[neighbour]) {
            label[neighbour] = next
            stack.push(neighbour)
          }
        }
    }
    next += 1
    const extent = (maxX - minX) * (maxY - minY)
    if (extent > bestExtent) {
      bestExtent = extent
      best = members
    }
  }
  if (bestExtent < width * height * 0.08) return null
  let outline = hull(best)
  // Brute force over hull vertices is fine at 40; subsample longer hulls evenly first.
  if (outline.length > 40) outline = Array.from({ length: 40 }, (_, index) => outline[Math.floor((index * outline.length) / 40)])
  if (outline.length < 4) return null
  let quad: DocumentScannerPoint[] = []
  let largest = 0
  const n = outline.length
  for (let a = 0; a < n; a += 1)
    for (let b = a + 1; b < n; b += 1)
      for (let c = b + 1; c < n; c += 1)
        for (let d = c + 1; d < n; d += 1) {
          const candidate = [outline[a], outline[b], outline[c], outline[d]]
          const size = area(candidate)
          if (size > largest) {
            largest = size
            quad = candidate
          }
        }
  return documentScannerOrder(quad)
}

/**
 * The homography taking the output rectangle (0,0)–(width,height) onto `quad`,
 * found by solving the eight-unknown linear system from the four point pairs
 * with Gaussian elimination. Returned as the nine entries of a 3×3 matrix.
 */
export function documentScannerHomography(quad: DocumentScannerQuad, width: number, height: number): number[] {
  const from = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]
  const rows: number[][] = []
  from.forEach(([u, v], index) => {
    const { x, y } = quad[index]
    rows.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x])
    rows.push([0, 0, 0, u, v, 1, -u * y, -v * y, y])
  })
  for (let column = 0; column < 8; column += 1) {
    let pivot = column
    for (let row = column + 1; row < 8; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row
    ;[rows[column], rows[pivot]] = [rows[pivot], rows[column]]
    const lead = rows[column][column] || 1e-12
    for (let k = column; k < 9; k += 1) rows[column][k] /= lead
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue
      const factor = rows[row][column]
      for (let k = column; k < 9; k += 1) rows[row][k] -= factor * rows[column][k]
    }
  }
  return [...rows.map((row) => row[8]), 1]
}

/** Warp rows [from, to) of the output with bilinear sampling of the source through the homography. */
export function documentScannerWarpRows(source: ImageData, target: ImageData, h: number[], from: number, to: number) {
  const { width: sw, height: sh, data: src } = source
  const { width: tw, data: out } = target
  for (let v = from; v < to; v += 1) {
    for (let u = 0; u < tw; u += 1) {
      const w = h[6] * (u + 0.5) + h[7] * (v + 0.5) + h[8]
      const x = Math.min(sw - 1.001, Math.max(0, (h[0] * (u + 0.5) + h[1] * (v + 0.5) + h[2]) / w - 0.5))
      const y = Math.min(sh - 1.001, Math.max(0, (h[3] * (u + 0.5) + h[4] * (v + 0.5) + h[5]) / w - 0.5))
      const x0 = Math.floor(x)
      const y0 = Math.floor(y)
      const fx = x - x0
      const fy = y - y0
      const a = (y0 * sw + x0) * 4
      const b = a + 4
      const c = a + sw * 4
      const d = c + 4
      const at = (v * tw + u) * 4
      for (let k = 0; k < 3; k += 1) {
        const top = src[a + k] + (src[b + k] - src[a + k]) * fx
        const bottom = src[c + k] + (src[d + k] - src[c + k]) * fx
        out[at + k] = top + (bottom - top) * fy
      }
      out[at + 3] = 255
    }
  }
}

/**
 * The “scanned” look: each pixel compared with the mean of its neighbourhood
 * (from an integral image, so the window size costs nothing), inked where it is
 * clearly darker. Uneven lighting stops mattering because the threshold moves with it.
 */
export function documentScannerThreshold(image: ImageData, radius = 12, bias = 0.1): ImageData {
  const { width, height, data } = image
  const integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let row = 0
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4
      row += 0.299 * data[at] + 0.587 * data[at + 1] + 0.114 * data[at + 2]
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row
    }
  }
  const out = new ImageData(width, height)
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(height, y + radius + 1)
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width, x + radius + 1)
      const sum = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1] - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0]
      const mean = sum / ((x1 - x0) * (y1 - y0))
      const at = (y * width + x) * 4
      const luma = 0.299 * data[at] + 0.587 * data[at + 1] + 0.114 * data[at + 2]
      const value = luma < mean * (1 - bias) ? 24 : 255
      out.data[at] = out.data[at + 1] = out.data[at + 2] = value
      out.data[at + 3] = 255
    }
  }
  return out
}
