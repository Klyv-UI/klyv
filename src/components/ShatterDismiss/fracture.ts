/**
 * The geometry and the physics behind ShatterDismiss, kept free of the DOM so
 * both can be reasoned about (and tested) as plain numbers.
 *
 * Fracture: a Voronoi diagram of seeds scattered around the impact point, each
 * cell found by clipping the rectangle with one half-plane per other seed.
 * That is O(n²) clips for n shards — nothing for 28, still nothing for 120 —
 * and needs no Delaunay triangulation or dependency.
 *
 * Motion: every shard is simulated up front at a fixed 60 Hz and the whole
 * trajectory is recorded. Playback reads it forward; undo reads the same
 * frames backward, which is why the pieces retrace their exact flight instead
 * of tweening home along straight lines.
 */

/** One shard: a convex polygon in element pixels, plus the numbers the simulation needs. */
export interface ShatterDismissCell {
  /** Vertices as x, y pairs, relative to the element’s top-left corner. */
  points: number[]
  cx: number
  cy: number
  area: number
}

/** A recorded flight: `frames × shards × 4` floats of dx, dy, angle and opacity. */
export interface ShatterDismissTrajectory {
  frames: Float32Array
  count: number
  length: number
  /** Seconds. */
  duration: number
}

export interface ShatterDismissPhysics {
  /** Multiplies the outward impulse. */
  force: number
  /** Multiplies gravity. */
  gravity: number
  /** Pixels below the element’s bottom edge where shards bounce, or false for none. */
  floor: number | false
}

export const SHATTER_FPS = 60

type Point = [number, number]

/** Keep the side of the bisector of `a` and `b` that is closer to `a`. */
function clip(polygon: Point[], a: Point, b: Point): Point[] {
  const nx = b[0] - a[0]
  const ny = b[1] - a[1]
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const side = (p: Point) => (p[0] - mx) * nx + (p[1] - my) * ny
  const out: Point[] = []
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]
    const q = polygon[(i + 1) % polygon.length]
    const sp = side(p)
    const sq = side(q)
    if (sp <= 0) out.push(p)
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
      const t = sp / (sp - sq)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  }
  return out
}

/**
 * Seeds are drawn at a distance of `R·u^1.9` from the impact, so their density
 * falls off steeply with distance: small splinters where it was struck, broad
 * panes at the far edges. A few seeds on a tight ring guarantee the splinters.
 */
function seeds(width: number, height: number, ix: number, iy: number, count: number, random: () => number): Point[] {
  const reach = Math.max(Math.hypot(ix, iy), Math.hypot(width - ix, iy), Math.hypot(ix, height - iy), Math.hypot(width - ix, height - iy))
  const inside = (x: number, y: number) => x > 0.5 && y > 0.5 && x < width - 0.5 && y < height - 0.5
  const out: Point[] = []
  const ring = Math.min(5, Math.max(3, Math.round(count / 7)))
  const tight = Math.max(6, Math.min(width, height) * 0.07)
  const turn = random() * Math.PI * 2
  for (let i = 0; i < ring; i++) {
    const angle = turn + (i / ring) * Math.PI * 2
    const x = ix + Math.cos(angle) * tight
    const y = iy + Math.sin(angle) * tight
    if (inside(x, y)) out.push([x, y])
  }
  let attempts = 0
  while (out.length < count && attempts < count * 60) {
    attempts++
    const distance = reach * Math.pow(random(), 1.9) + tight * 0.5
    const angle = random() * Math.PI * 2
    const x = ix + Math.cos(angle) * distance
    const y = iy + Math.sin(angle) * distance
    if (!inside(x, y)) continue
    const spacing = 3 + distance * 0.12
    if (out.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < spacing)) continue
    out.push([x, y])
  }
  return out
}

/** Split a `width × height` rectangle into about `count` Voronoi shards around an impact point. */
export function fractureRect(
  width: number,
  height: number,
  ix: number,
  iy: number,
  count: number,
  random: () => number = Math.random,
): ShatterDismissCell[] {
  const sites = seeds(width, height, ix, iy, Math.max(2, count), random)
  const cells: ShatterDismissCell[] = []
  for (let i = 0; i < sites.length; i++) {
    let polygon: Point[] = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ]
    for (let j = 0; j < sites.length && polygon.length > 2; j++) {
      if (j !== i) polygon = clip(polygon, sites[i], sites[j])
    }
    if (polygon.length < 3) continue
    let area = 0
    let cx = 0
    let cy = 0
    for (let k = 0; k < polygon.length; k++) {
      const [x0, y0] = polygon[k]
      const [x1, y1] = polygon[(k + 1) % polygon.length]
      const cross = x0 * y1 - x1 * y0
      area += cross
      cx += (x0 + x1) * cross
      cy += (y0 + y1) * cross
    }
    area /= 2
    if (Math.abs(area) < 1) continue
    cells.push({ points: polygon.flat(), cx: cx / (6 * area), cy: cy / (6 * area), area: Math.abs(area) })
  }
  return cells
}

/**
 * Integrate every shard as a 2D rigid body — impulse away from the impact,
 * spin, gravity, air drag, an optional floor with restitution and friction,
 * and a fade over the last part of the flight — and record each frame.
 */
export function simulateShards(
  cells: ShatterDismissCell[],
  height: number,
  ix: number,
  iy: number,
  physics: ShatterDismissPhysics,
  random: () => number = Math.random,
): ShatterDismissTrajectory {
  const count = cells.length
  const duration = physics.floor === false ? 1.5 : 2.1
  const length = Math.ceil(duration * SHATTER_FPS) + 1
  const frames = new Float32Array(length * count * 4)
  const gravity = 2600 * physics.gravity
  const floorY = physics.floor === false ? Infinity : height + physics.floor
  const fadeFrom = duration * 0.55
  const meanArea = cells.reduce((sum, cell) => sum + cell.area, 0) / Math.max(1, count)
  const reach = Math.max(...cells.map((cell) => Math.hypot(cell.cx - ix, cell.cy - iy)), 1)

  const x = new Float32Array(count)
  const y = new Float32Array(count)
  const a = new Float32Array(count)
  const vx = new Float32Array(count)
  const vy = new Float32Array(count)
  const va = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const cell = cells[i]
    let dx = cell.cx - ix
    let dy = cell.cy - iy
    const distance = Math.hypot(dx, dy)
    if (distance < 1) {
      const angle = random() * Math.PI * 2
      dx = Math.cos(angle)
      dy = Math.sin(angle)
    } else {
      dx /= distance
      dy /= distance
    }
    const near = 1 / (1 + Math.pow(distance / (reach * 0.3), 1.3))
    const speed = physics.force * (260 + 820 * near) * (0.75 + random() * 0.5)
    vx[i] = dx * speed + (random() - 0.5) * 140 * physics.force
    vy[i] = dy * speed - physics.force * (240 + random() * 220)
    const light = Math.min(2.2, Math.max(0.5, Math.sqrt(meanArea / cell.area)))
    va[i] = (random() < 0.5 ? -1 : 1) * physics.force * (2 + random() * 5 + 7 * near) * light
  }

  const local = cells.map((cell) => {
    const out: number[] = []
    for (let k = 0; k < cell.points.length; k += 2) out.push(cell.points[k] - cell.cx, cell.points[k + 1] - cell.cy)
    return out
  })

  const steps = 4
  const h = 1 / SHATTER_FPS / steps
  const drag = Math.exp(-1.1 * h)
  const spinDrag = Math.exp(-0.7 * h)

  for (let f = 0; f < length; f++) {
    const t = f / SHATTER_FPS
    const fade = t <= fadeFrom ? 1 : Math.max(0, 1 - (t - fadeFrom) / (duration - fadeFrom))
    const opacity = fade * fade * (3 - 2 * fade)
    for (let i = 0; i < count; i++) {
      const o = (f * count + i) * 4
      frames[o] = x[i]
      frames[o + 1] = y[i]
      frames[o + 2] = a[i]
      frames[o + 3] = opacity
    }
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < count; i++) {
        vy[i] += gravity * h
        vx[i] *= drag
        vy[i] *= drag
        va[i] *= spinDrag
        x[i] += vx[i] * h
        y[i] += vy[i] * h
        a[i] += va[i] * h
        if (floorY === Infinity) continue
        const sin = Math.sin(a[i])
        const cos = Math.cos(a[i])
        const shape = local[i]
        let lowest = -Infinity
        let contactX = 0
        for (let k = 0; k < shape.length; k += 2) {
          const ry = shape[k] * sin + shape[k + 1] * cos
          if (ry > lowest) {
            lowest = ry
            contactX = shape[k] * cos - shape[k + 1] * sin
          }
        }
        const bottom = cells[i].cy + y[i] + lowest
        if (bottom > floorY) {
          y[i] -= bottom - floorY
          if (vy[i] > 0) {
            const impact = vy[i]
            vy[i] = impact < 90 ? 0 : -impact * 0.32
            vx[i] *= 0.72
            // The contact point is off-centre, so the bounce also twists it.
            va[i] = va[i] * 0.55 - (contactX / Math.max(8, Math.abs(contactX) + 20)) * impact * 0.004
          }
        }
      }
    }
  }

  return { frames, count, length, duration }
}
