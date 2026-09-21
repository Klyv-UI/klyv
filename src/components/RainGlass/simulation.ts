/**
 * The rain on RainGlass: a small CPU simulation in CSS pixels.
 *
 * Two populations. Droplets are the mist — thousands of tiny beads that never move, kept in one typed array and
 * found through a uniform grid. Drops are the few hundred that matter: they grow by swallowing droplets and each
 * other, and once heavy enough they slide. Sliding is stick–slip, as on real glass: a drop runs, catches on nothing
 * visible, stalls, and lets go again, wandering a little sideways as it goes. A running drop sheds a trail of
 * droplets behind it, loses the water it sheds, and wipes the fog along its path through the `wipe` callback.
 */

export interface RainGlassDrop {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  /** Seconds left stalled. */
  stuck: number
  /** Distance run since the last trail droplet. */
  run: number
  /** Where it was last frame, for the wipe stroke. */
  px: number
  py: number
  dead: boolean
}

export interface RainGlassStepOptions {
  /** 0–1: how hard it is raining. */
  intensity: number
  /** Multiplier for drop radii. */
  dropSize: number
  /** Called for every running drop with a stroke from its last position to its new one. */
  wipe?: (x0: number, y0: number, x1: number, y1: number, r: number) => void
}

const DROPLET_CAP = 2600
const DROP_CAP = 360
const CELL = 24

/** Small deterministic PRNG, so a still frame is the same every time. */
export function rainGlassRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class RainGlassSimulation {
  width = 0
  height = 0
  drops: RainGlassDrop[] = []
  /** x, y, r per droplet. */
  droplets = new Float32Array(DROPLET_CAP * 3)
  dropletCount = 0
  private random: () => number
  private spawnDrop = 0
  private spawnDroplet = 0
  private cellStart = new Int32Array(1)
  private cellItems = new Int32Array(DROPLET_CAP)
  private columns = 1
  private rows = 1

  constructor(seed = 7) {
    this.random = rainGlassRandom(seed)
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.drops = this.drops.filter((drop) => drop.x < width + drop.r && drop.y < height + drop.r)
    let n = 0
    const d = this.droplets
    for (let i = 0; i < this.dropletCount; i++) {
      if (d[i * 3]! < width && d[i * 3 + 1]! < height) {
        d[n * 3] = d[i * 3]!
        d[n * 3 + 1] = d[i * 3 + 1]!
        d[n * 3 + 2] = d[i * 3 + 2]!
        n++
      }
    }
    this.dropletCount = n
    this.columns = Math.max(1, Math.ceil(width / CELL))
    this.rows = Math.max(1, Math.ceil(height / CELL))
    this.cellStart = new Int32Array(this.columns * this.rows + 1)
  }

  /** The largest radius a drop reaches before it must run, in CSS pixels. */
  maxRadius(dropSize: number) {
    return 11 * dropSize
  }

  private addDroplet(x: number, y: number, r: number) {
    const d = this.droplets
    // A full glass recycles a random bead rather than refusing new ones, so the mist keeps changing.
    const i = this.dropletCount < DROPLET_CAP ? this.dropletCount++ : Math.floor(this.random() * DROPLET_CAP)
    d[i * 3] = x
    d[i * 3 + 1] = y
    d[i * 3 + 2] = r
  }

  private removeDroplet(i: number) {
    const d = this.droplets
    const last = --this.dropletCount
    d[i * 3] = d[last * 3]!
    d[i * 3 + 1] = d[last * 3 + 1]!
    d[i * 3 + 2] = d[last * 3 + 2]!
  }

  /** Counting sort of droplets into grid cells. */
  private index() {
    const { columns, rows, cellStart, cellItems, droplets } = this
    cellStart.fill(0)
    const cellOf = (i: number) => {
      const cx = Math.min(columns - 1, Math.max(0, Math.floor(droplets[i * 3]! / CELL)))
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(droplets[i * 3 + 1]! / CELL)))
      return cy * columns + cx
    }
    for (let i = 0; i < this.dropletCount; i++) cellStart[cellOf(i) + 1]!++
    for (let c = 1; c < cellStart.length; c++) cellStart[c]! += cellStart[c - 1]!
    const fill = cellStart.slice(0, -1)
    for (let i = 0; i < this.dropletCount; i++) cellItems[fill[cellOf(i)]!++] = i
  }

  step(dt: number, { intensity, dropSize, wipe }: RainGlassStepOptions) {
    const { width, height, random } = this
    if (!width || !height) return
    const area = (width * height) / 10000
    const maxR = this.maxRadius(dropSize)

    // Mist: a steady fall of beads, too small to run.
    this.spawnDroplet += dt * intensity * area * 7
    while (this.spawnDroplet >= 1) {
      this.spawnDroplet--
      this.addDroplet(random() * width, random() * height, (0.55 + random() * random() * 1.9) * Math.sqrt(dropSize))
    }
    // Drops: fewer, larger, most of them not yet heavy enough to move.
    this.spawnDrop += dt * intensity * area * 0.55
    while (this.spawnDrop >= 1 && this.drops.length < DROP_CAP) {
      this.spawnDrop--
      const r = maxR * (0.22 + random() * random() * 0.62)
      const x = random() * width
      const y = random() * height * 1.05 - height * 0.05
      this.drops.push({ x, y, r, vx: 0, vy: 0, stuck: 0, run: 0, px: x, py: y, dead: false })
    }
    if (this.spawnDrop > 1) this.spawnDrop = 1

    this.index()
    const slide = maxR * 0.62
    const gravity = 520

    for (const drop of this.drops) {
      drop.px = drop.x
      drop.py = drop.y
      if (drop.r > slide) {
        const weight = Math.min(1.8, drop.r / maxR)
        if (drop.stuck > 0) {
          drop.stuck -= dt
          drop.vy *= Math.pow(0.02, dt)
        } else {
          const terminal = 70 + 380 * (weight - 0.55)
          drop.vy = Math.min(terminal, drop.vy + gravity * weight * dt)
          // Stick–slip: slow drops catch more often than fast ones.
          if (random() < dt * (2.4 - weight) * 1.3) {
            drop.stuck = random() * random() * 0.9
            drop.vy *= 0.25
          }
        }
        drop.vx += (random() - 0.5) * 260 * dt
        drop.vx *= Math.pow(0.05, dt)
        drop.x += drop.vx * dt * Math.min(1, drop.vy / 80)
        drop.y += drop.vy * dt
        const moved = Math.hypot(drop.x - drop.px, drop.y - drop.py)
        drop.run += moved
        const gap = Math.max(4, drop.r * 0.9)
        while (drop.run > gap) {
          drop.run -= gap
          if (random() < 0.75) {
            const tr = drop.r * (0.12 + random() * 0.2)
            this.addDroplet(drop.x + (random() - 0.5) * drop.r * 0.6, drop.y - drop.r * (1.3 + random() * 0.9), tr)
            drop.r = Math.sqrt(Math.max(drop.r * drop.r - tr * tr * 0.55, slide * slide * 0.7))
          }
        }
        if (moved > 0.05) wipe?.(drop.px, drop.py, drop.x, drop.y, drop.r)
        if (drop.y - drop.r * 2 > height) drop.dead = true
      } else drop.vy = 0

      // Swallow the beads it touches.
      this.absorb(drop, maxR)
    }

    // Merge drops that touch: the larger keeps going with the water of both.
    const drops = this.drops
    drops.sort((a, b) => a.y - b.y)
    for (let i = 0; i < drops.length; i++) {
      const a = drops[i]!
      if (a.dead) continue
      for (let j = i + 1; j < drops.length; j++) {
        const b = drops[j]!
        if (b.y - a.y > a.r + maxR * 1.7) break
        if (b.dead) continue
        const reach = (a.r + b.r) * 0.82
        const dx = a.x - b.x
        const dy = a.y - b.y
        if (dx * dx + dy * dy > reach * reach) continue
        const [big, small] = a.r >= b.r ? [a, b] : [b, a]
        big.r = Math.min(maxR * 1.7, Math.sqrt(big.r * big.r + small.r * small.r * 0.9))
        big.vy = Math.max(big.vy, small.vy)
        big.x = (big.x * big.r + small.x * small.r * 0.4) / (big.r + small.r * 0.4)
        small.dead = true
      }
    }
    this.drops = drops.filter((drop) => !drop.dead)
    this.compact()
  }

  private absorb(drop: RainGlassDrop, maxR: number) {
    const { columns, rows, cellStart, cellItems, droplets } = this
    const reach = drop.r + 3
    const x0 = Math.max(0, Math.floor((drop.x - reach) / CELL))
    const x1 = Math.min(columns - 1, Math.floor((drop.x + reach) / CELL))
    const y0 = Math.max(0, Math.floor((drop.y - reach * 1.4) / CELL))
    const y1 = Math.min(rows - 1, Math.floor((drop.y + reach) / CELL))
    let gained = 0
    const running = drop.vy > 1
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * columns + cx
        for (let k = cellStart[c]!; k < cellStart[c + 1]!; k++) {
          const i = cellItems[k]!
          if (i >= this.dropletCount) continue
          const r = droplets[i * 3 + 2]!
          if (r <= 0) continue
          const dx = droplets[i * 3]! - drop.x
          const dy = (droplets[i * 3 + 1]! - drop.y) * 0.8
          // A running drop meets what lies ahead of it, not the trail it has just left.
          if (running && dy < -drop.r * 0.3) continue
          const limit = drop.r + r * 0.6
          if (dx * dx + dy * dy < limit * limit) {
            gained += r * r
            droplets[i * 3 + 2] = 0
          }
        }
      }
    }
    if (gained) drop.r = Math.min(maxR * 1.7, Math.sqrt(drop.r * drop.r + gained * 0.5))
  }

  /** Drop the beads that were swallowed this frame. */
  private compact() {
    const d = this.droplets
    for (let i = this.dropletCount - 1; i >= 0; i--) if (d[i * 3 + 2]! <= 0) this.removeDroplet(i)
  }
}
