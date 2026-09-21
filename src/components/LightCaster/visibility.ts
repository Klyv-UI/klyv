/**
 * 2D visibility for LightCaster: what a point light at (lx, ly) can see past a set of wall segments.
 *
 * The classic ray-cast construction: a visibility polygon only changes shape at segment endpoints, so one ray is
 * cast at every endpoint and one a hair either side of it. The ray at the corner stops on the corner; the two
 * beside it either stop on the same wall or slip past it to whatever is behind, which is what gives a shadow its
 * sharp edge. Sorting the hits by angle gives the polygon.
 *
 * Segments are a flat Float64Array of `ax, ay, bx, by`, and results are written into caller-owned buffers, so a
 * frame allocates nothing but the sort order.
 */

/** Half-width, in radians, of the pair of rays cast beside each corner. */
const EPSILON = 0.00012

export interface LightCasterPolygon {
  xs: Float64Array
  ys: Float64Array
  /** Number of valid points in `xs` and `ys`, in angle order. */
  count: number
}

/** Nearest hit along a ray from (lx, ly) in direction (dx, dy), as a distance; Infinity when it hits nothing. */
export function castRay(
  lx: number,
  ly: number,
  dx: number,
  dy: number,
  segments: Float64Array,
  segmentCount: number,
  skipFrom = -1,
  skipTo = -1,
): number {
  let best = Infinity
  for (let s = 0; s < segmentCount; s++) {
    if (s >= skipFrom && s < skipTo) continue
    const o = s * 4
    const ax = segments[o]!
    const ay = segments[o + 1]!
    const ex = segments[o + 2]! - ax
    const ey = segments[o + 3]! - ay
    const den = dx * ey - dy * ex
    if (den > -1e-12 && den < 1e-12) continue
    const qx = ax - lx
    const qy = ay - ly
    const t = (qx * ey - qy * ex) / den
    if (t <= 1e-6 || t >= best) continue
    const u = (qx * dy - qy * dx) / den
    if (u >= 0 && u <= 1) best = t
  }
  return best
}

/**
 * The visibility polygon of a light. `angles`, `xs` and `ys` must hold at least three entries per endpoint.
 * Returns the polygon in `out`.
 */
export function visibilityPolygon(
  lx: number,
  ly: number,
  segments: Float64Array,
  segmentCount: number,
  scratch: { angles: Float64Array; xs: Float64Array; ys: Float64Array; order: number[] },
  out: LightCasterPolygon,
): LightCasterPolygon {
  const { angles, xs, ys, order } = scratch
  let count = 0
  // Every segment has two endpoints; rectangles share them, but duplicate rays are cheap and harmless.
  for (let s = 0; s < segmentCount; s++) {
    for (let end = 0; end < 2; end++) {
      const px = segments[s * 4 + end * 2]!
      const py = segments[s * 4 + end * 2 + 1]!
      const base = Math.atan2(py - ly, px - lx)
      for (let k = -1; k <= 1; k++) {
        const angle = base + k * EPSILON
        const dx = Math.cos(angle)
        const dy = Math.sin(angle)
        const t = castRay(lx, ly, dx, dy, segments, segmentCount)
        if (t === Infinity) continue
        angles[count] = angle
        xs[count] = lx + dx * t
        ys[count] = ly + dy * t
        count++
      }
    }
  }
  order.length = count
  for (let i = 0; i < count; i++) order[i] = i
  order.sort((a, b) => angles[a]! - angles[b]!)
  for (let i = 0; i < count; i++) {
    out.xs[i] = xs[order[i]!]!
    out.ys[i] = ys[order[i]!]!
  }
  out.count = count
  return out
}
