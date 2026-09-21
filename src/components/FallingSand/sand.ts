/**
 * The falling-sand automaton behind FallingSand, as typed arrays with no DOM.
 *
 * A falling-sand game is a cellular automaton: every cell of a grid holds one
 * material, and each step visits every cell once and lets it move into, swap
 * with or transform a neighbour by its material’s rule. Nothing is a particle
 * with a position and a velocity; a pile is just the shape the rules leave.
 *
 *   powder  sand      falls; blocked, tries the two lower diagonals. Trying
 *                     diagonals is what gives a pile its angle of repose — 45°,
 *                     the natural slope of a one-cell neighbourhood.
 *   liquid  water     falls, then diagonals, then runs sideways up to its
 *           oil       dispersion in cells per step, so it finds its level. Oil is
 *                     lighter and floats; water sinks through it.
 *   gas     smoke     rises, spreads, and fades out.
 *           steam     rises and condenses back into water when it cools.
 *   flame   fire      ignites each neighbour with that neighbour’s flammability,
 *                     boils water it touches, and burns out into smoke.
 *   solid   wood      static and flammable.
 *           stone     static and inert.
 *           packed    static sand that crumbles to loose sand where anything
 *                     moving touches it. The headline is drawn in it: a headline
 *                     that collapsed before anyone read it would be no use.
 *
 * Heavier mobile materials sink through lighter liquids and gases by swapping
 * with them, which is all “density” means here.
 *
 * A settled pile costs nothing. Every change marks a rectangle around itself,
 * and the next step scans only the union of those rectangles; when a step
 * changes nothing, the rectangle is empty and the grid is asleep until a brush,
 * a pour or a drop touches it again.
 */

export type FallingSandMaterial = 'empty' | 'sand' | 'packed' | 'water' | 'oil' | 'wood' | 'stone' | 'fire' | 'smoke' | 'steam'

export type Rgb = readonly [number, number, number]

const EMPTY = 0
const SAND = 1
const PACKED = 2
const WATER = 3
const OIL = 4
const WOOD = 5
const STONE = 6
const FIRE = 7
const SMOKE = 8
const STEAM = 9

/** Numeric id of each material in the grid. */
export const MATERIAL_IDS: Record<FallingSandMaterial, number> = {
  empty: EMPTY,
  sand: SAND,
  packed: PACKED,
  water: WATER,
  oil: OIL,
  wood: WOOD,
  stone: STONE,
  fire: FIRE,
  smoke: SMOKE,
  steam: STEAM,
}
export const MATERIAL_COUNT = 10
/** Shades per material in the colour table: grain variation, or heat and fade. */
export const SHADES = 8

const VOID = 0
const POWDER = 1
const LIQUID = 2
const GAS = 3
const SOLID = 4
const FLAME = 5

//                                  empty  sand    packed water   oil     wood   stone  fire   smoke steam
const KIND = new Uint8Array(/*   */ [VOID, POWDER, SOLID, LIQUID, LIQUID, SOLID, SOLID, FLAME, GAS, GAS])
const DENSITY = new Int8Array(/* */ [0, 10, 99, 6, 4, 99, 99, -1, -3, -2])
/** Cells a liquid may run sideways in one step. Higher finds its level faster and looks thinner. */
const DISPERSION = new Uint8Array([0, 0, 0, 6, 3, 0, 0, 0, 0, 0])
/** Chance per step that a touching flame lights this cell. */
const FLAMMABILITY = new Float32Array([0, 0, 0, 0, 0.3, 0.035, 0, 0, 0, 0])
/** How far a grain’s shade may stray from its material’s colour, 0–1. */
const VARIANCE = new Float32Array([0, 0.28, 0.22, 0.08, 0.12, 0.3, 0.26, 0, 0, 0])

/**
 * Sideways moves a liquid may make without finding a drop, reset whenever it falls.
 *
 * Without it, the last partial layer of a pool sloshes wall to wall forever and
 * the grid never sleeps. With it, surface water runs far enough to level out to
 * within a cell, and then stops — the automaton’s stand-in for viscosity.
 */
const RESTLESS = 40
/** Chance per step, per moving neighbour, that packed sand lets go of a grain. */
const CRUMBLE = 0.08

/** Label and default colour of each material. Colours are CSS, resolved against the theme at runtime. */
export const SAND_MATERIALS: Record<FallingSandMaterial, { label: string; colour: string; fallback?: string }> = {
  empty: { label: 'Erase', colour: 'var(--color-surface-sunken)' },
  sand: { label: 'Sand', colour: 'var(--color-accent)' },
  packed: { label: 'Packed sand', colour: 'color-mix(in oklab, var(--color-accent) 64%, var(--color-ink))' },
  // Water and steam are the one deliberate fixed hue, as a piano’s keys are black and white: the library has no
  // blue token, and deriving one from the accent was tried — a lime accent turned 140° is blue, but a violet one
  // comes out amber and reads as fire. The hue is fixed; the lightness comes from the ink token, so it sits right
  // in both modes. `palette.water` overrides it with a token where a brand has one.
  water: {
    label: 'Water',
    colour: 'color-mix(in oklab, oklch(0.6 0.14 245) 78%, var(--color-ink-soft))',
    fallback: 'var(--color-ink-soft)',
  },
  oil: { label: 'Oil', colour: 'color-mix(in oklab, var(--color-ink) 80%, var(--color-warning))' },
  wood: { label: 'Wood', colour: 'color-mix(in oklab, var(--color-warning) 48%, var(--color-ink))' },
  stone: { label: 'Stone', colour: 'color-mix(in oklab, var(--color-ink-faint) 72%, var(--color-surface))' },
  fire: { label: 'Fire', colour: 'var(--color-danger)' },
  smoke: { label: 'Smoke', colour: 'var(--color-ink-faint)' },
  steam: {
    label: 'Steam',
    colour: 'color-mix(in oklab, oklch(0.8 0.08 245) 60%, var(--color-ink-faint))',
    fallback: 'var(--color-line-strong)',
  },
}
/** The hot end of the fire ramp. Fresh flames and glowing embers are this; dying ones cool to the fire colour. */
export const FIRE_HOT = 'var(--color-warning)'

export interface SandRect {
  x: number
  y: number
  width: number
  height: number
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const BLACK: Rgb = [0, 0, 0]
const WHITE: Rgb = [255, 255, 255]

/**
 * The colour table: `SHADES` packed RGBA words per material, so drawing a cell
 * is one array read. `colours` is indexed by material id; index 0 is the
 * background. Words are packed through a byte view, so they are right on either
 * endianness.
 */
export function buildShades(colours: readonly Rgb[], hot: Rgb): Uint32Array {
  const bytes = new Uint8ClampedArray(4)
  const word = new Uint32Array(bytes.buffer)
  const table = new Uint32Array(MATERIAL_COUNT * SHADES)
  const background = colours[EMPTY]
  for (let m = 0; m < MATERIAL_COUNT; m++) {
    const base = colours[m]
    for (let k = 0; k < SHADES; k++) {
      const t = k / (SHADES - 1)
      let c: Rgb
      if (m === EMPTY) c = background
      // Fire’s shade is its heat.
      else if (m === FIRE) c = mix(base, hot, t)
      // A gas’s shade is the life it has left: it thins into the background rather than blinking out.
      else if (KIND[m] === GAS) c = mix(background, base, 0.2 + 0.8 * t)
      else {
        const v = (t - 0.5) * VARIANCE[m]
        c = v < 0 ? mix(base, BLACK, -v) : mix(base, WHITE, v)
      }
      bytes[0] = c[0]
      bytes[1] = c[1]
      bytes[2] = c[2]
      bytes[3] = 255
      table[m * SHADES + k] = word[0]
    }
  }
  return table
}

export class SandGrid {
  readonly width: number
  readonly height: number
  /** Material id per cell. */
  readonly cells: Uint8Array
  /** Frames left for fire and gases; the sideways budget for liquids. */
  readonly life: Uint8Array
  /** A random byte per grain, fixed when it is placed, so a pile has grain and does not shimmer. */
  readonly tint: Uint8Array
  /** The direction a liquid last ran, so a stream keeps going instead of dithering. */
  readonly flow: Int8Array
  /** Which step last visited the cell, so a grain that has moved is not moved again in the same step. */
  private readonly stamp: Uint8Array
  /** The step (mod 256) on which the cell last changed, so packed sand can tell a grain arriving from one resting. */
  private readonly moved: Uint8Array
  private parity = 0
  private tick = 0
  private seed = 0x2545f491
  // Rectangle the next step scans (inclusive; empty when x0 > x1). Everything that touches a cell grows it — the
  // step running now, and a brush or a pour between steps — and each step takes it and starts a fresh one.
  private nx0 = 0
  private ny0 = 0
  private nx1 = -1
  private ny1 = -1
  // Rectangle not yet drawn.
  private px0 = 0
  private py0 = 0
  private px1 = -1
  private py1 = -1

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    const size = width * height
    this.cells = new Uint8Array(size)
    this.life = new Uint8Array(size)
    this.tint = new Uint8Array(size)
    this.flow = new Int8Array(size)
    this.stamp = new Uint8Array(size)
    this.moved = new Uint8Array(size)
    this.nx0 = this.px0 = width
    this.ny0 = this.py0 = height
  }

  /** xorshift32: fast, seedable, and good enough to decide which way a grain slides. */
  random() {
    let s = this.seed
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    this.seed = s >>> 0
    return this.seed / 4294967296
  }

  /** True while anything is still moving. */
  get awake() {
    return this.nx0 <= this.nx1
  }

  /** Something changed at (x, y): scan around it next step, and redraw it. */
  private touch(x: number, y: number) {
    const { width: W, height: H } = this
    if (x - 1 < this.nx0) this.nx0 = Math.max(0, x - 1)
    if (x + 1 > this.nx1) this.nx1 = Math.min(W - 1, x + 1)
    if (y - 1 < this.ny0) this.ny0 = Math.max(0, y - 1)
    if (y + 1 > this.ny1) this.ny1 = Math.min(H - 1, y + 1)
    if (x < this.px0) this.px0 = x
    if (x > this.px1) this.px1 = x
    if (y < this.py0) this.py0 = y
    if (y > this.py1) this.py1 = y
  }

  /** Scan and redraw the whole grid. */
  markAll() {
    this.nx0 = this.px0 = 0
    this.ny0 = this.py0 = 0
    this.nx1 = this.px1 = this.width - 1
    this.ny1 = this.py1 = this.height - 1
  }

  /** Redraw every cell without waking the automaton — for a new palette. */
  repaint() {
    this.px0 = this.py0 = 0
    this.px1 = this.width - 1
    this.py1 = this.height - 1
  }

  clear() {
    this.cells.fill(0)
    this.life.fill(0)
    this.markAll()
  }

  /** Place a material in cell `i` at (x, y), with a fresh life, grain and direction. */
  put(i: number, x: number, y: number, material: number, life = -1) {
    this.cells[i] = material
    this.tint[i] = (this.random() * 256) | 0
    this.flow[i] = this.random() < 0.5 ? -1 : 1
    this.life[i] =
      life >= 0
        ? life
        : material === FIRE
          ? 16 + ((this.random() * 18) | 0)
          : material === SMOKE
            ? 60 + ((this.random() * 80) | 0)
            : material === STEAM
              ? 90 + ((this.random() * 90) | 0)
              : KIND[material] === LIQUID
                ? RESTLESS
                : 0
    this.stamp[i] = this.parity
    this.moved[i] = this.tick
    this.touch(x, y)
  }

  private swap(i: number, x: number, y: number, j: number, jx: number, jy: number) {
    const { cells, life, tint, flow, stamp } = this
    const c = cells[i]
    cells[i] = cells[j]
    cells[j] = c
    const l = life[i]
    life[i] = life[j]
    life[j] = l
    const t = tint[i]
    tint[i] = tint[j]
    tint[j] = t
    const f = flow[i]
    flow[i] = flow[j]
    flow[j] = f
    stamp[i] = stamp[j] = this.parity
    this.moved[i] = this.moved[j] = this.tick
    this.touch(x, y)
    this.touch(jx, jy)
  }

  /** Can `m` move into a cell holding `other` by swapping with it? Empty, or a lighter liquid, gas or flame. */
  private sinks(m: number, other: number) {
    if (other === EMPTY) return true
    const kind = KIND[other]
    return (kind === LIQUID || kind === GAS || kind === FLAME) && DENSITY[other] < DENSITY[m]
  }

  /** Does cell `n` hold something loose that moved this step or the last? */
  private striking(n: number, now: number) {
    const c = this.cells[n]
    return c !== EMPTY && KIND[c] !== SOLID && ((now - this.moved[n]) & 255) <= 1
  }

  /**
   * How far a liquid can run along its row in direction `f`, stopping at the first thing in the way or the first
   * drop: the reach in the low four bits, plus 16 when it ends over a drop.
   */
  private run(i: number, x: number, y: number, f: number, m: number) {
    const { width: W, height: H, cells } = this
    let reach = 0
    for (let k = 1; k <= DISPERSION[m]; k++) {
      const nx = x + f * k
      if (nx < 0 || nx >= W) break
      const c = cells[i + f * k]
      if (c !== EMPTY && KIND[c] !== GAS) break
      reach = k
      if (y + 1 < H && this.sinks(m, cells[i + f * k + W])) return reach + 16
    }
    return reach
  }

  /** One step of the automaton. Returns false, having done nothing, when the grid is asleep. */
  step() {
    if (this.nx0 > this.nx1) return false
    const { width: W, height: H, cells, life, flow, stamp } = this
    const x0 = this.nx0
    const x1 = this.nx1
    const y0 = this.ny0
    const y1 = this.ny1
    this.nx0 = W
    this.ny0 = H
    this.nx1 = this.ny1 = -1
    const parity = (this.parity ^= 1)

    // Bottom row first, so a falling grain lands in a row already scanned and cannot fall twice; a rising gas
    // is stamped as it moves into a row not yet scanned, for the same reason.
    for (let y = y1; y >= y0; y--) {
      // The scan direction alternates row by row, and the pattern flips every step. Scan every row left to right
      // and the grain on the left always gets first claim on a free cell: piles lean, then walk sideways across
      // the floor, and water creeps one way. Alternating gives neither side the advantage for long enough to show.
      const forward = ((y + this.tick) & 1) === 0
      const dir = forward ? 1 : -1
      const end = forward ? x1 + 1 : x0 - 1
      for (let x = forward ? x0 : x1; x !== end; x += dir) {
        const i = y * W + x
        if (stamp[i] === parity) continue
        stamp[i] = parity
        const m = cells[i]
        if (m === EMPTY) continue
        const kind = KIND[m]

        if (kind === POWDER) {
          if (y + 1 >= H) continue
          const below = i + W
          if (this.sinks(m, cells[below])) {
            const displaced = cells[below]
            this.swap(i, x, y, below, x, y + 1)
            if (KIND[displaced] === LIQUID) life[i] = RESTLESS
            continue
          }
          const side = this.random() < 0.5 ? -1 : 1
          if (x + side >= 0 && x + side < W && this.sinks(m, cells[below + side])) this.swap(i, x, y, below + side, x + side, y + 1)
          else if (x - side >= 0 && x - side < W && this.sinks(m, cells[below - side])) this.swap(i, x, y, below - side, x - side, y + 1)
          continue
        }

        if (kind === LIQUID) {
          if (y + 1 < H) {
            const below = i + W
            if (this.sinks(m, cells[below])) {
              this.swap(i, x, y, below, x, y + 1)
              life[below] = RESTLESS
              continue
            }
            const side = this.random() < 0.5 ? -1 : 1
            if (x + side >= 0 && x + side < W && this.sinks(m, cells[below + side])) {
              this.swap(i, x, y, below + side, x + side, y + 1)
              life[below + side] = RESTLESS
              continue
            }
            if (x - side >= 0 && x - side < W && this.sinks(m, cells[below - side])) {
              this.swap(i, x, y, below - side, x - side, y + 1)
              life[below - side] = RESTLESS
              continue
            }
          }
          // Run sideways, the way it last ran first. A run towards a drop is always allowed — that is water finding
          // its level — and a run across a flat surface spends the budget.
          let f = flow[i] || 1
          let run = this.run(i, x, y, f, m)
          if (!(run & 15) || (run < 16 && !life[i])) {
            f = -f
            run = this.run(i, x, y, f, m)
          }
          const reach = run & 15
          if (reach && (run >= 16 || life[i] > 0)) {
            if (run < 16) life[i]--
            const j = i + f * reach
            this.swap(i, x, y, j, x + f * reach, y)
            flow[j] = f
          } else flow[i] = f
          continue
        }

        if (kind === GAS) {
          if (--life[i] === 0) {
            // Steam cools back into water; smoke simply thins out.
            this.put(i, x, y, m === STEAM ? WATER : EMPTY)
            continue
          }
          this.touch(x, y)
          if (y > 0) {
            const above = i - W
            const a = cells[above]
            if (a === EMPTY || KIND[a] === LIQUID) {
              this.swap(i, x, y, above, x, y - 1)
              continue
            }
            const side = this.random() < 0.5 ? -1 : 1
            if (x + side >= 0 && x + side < W && cells[above + side] === EMPTY) {
              this.swap(i, x, y, above + side, x + side, y - 1)
              continue
            }
          }
          const side = this.random() < 0.5 ? -1 : 1
          if (x + side >= 0 && x + side < W && cells[i + side] === EMPTY) this.swap(i, x, y, i + side, x + side, y)
          continue
        }

        if (kind === FLAME) {
          let quenched = false
          for (let dy = -1; dy <= 1 && !quenched; dy++) {
            const ny = y + dy
            if (ny < 0 || ny >= H) continue
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx
              if ((dx === 0 && dy === 0) || nx < 0 || nx >= W) continue
              const n = ny * W + nx
              const c = cells[n]
              if (c === WATER) {
                // Water boils, and the flame goes out in the steam.
                this.put(n, nx, ny, STEAM)
                this.put(i, x, y, STEAM)
                quenched = true
                break
              }
              const chance = FLAMMABILITY[c]
              // Wood becomes a long-lived ember; oil flares and is gone.
              if (chance && this.random() < chance) this.put(n, nx, ny, FIRE, c === WOOD ? 50 + ((this.random() * 50) | 0) : -1)
            }
          }
          if (quenched) continue
          if (--life[i] === 0) {
            this.put(i, x, y, this.random() < 0.6 ? SMOKE : EMPTY)
            continue
          }
          this.touch(x, y)
          // Loose flames lick upwards; embers stay where the wood was.
          if (life[i] < 40 && y > 0 && cells[i - W] === EMPTY && this.random() < 0.3) this.swap(i, x, y, i - W, x, y - 1)
          continue
        }

        if (m === PACKED) {
          // Count loose neighbours above and beside it that moved in this step or the last: grains arriving, not
          // grains resting. A pile leaning on a letter, or growing up from below, leaves it alone, so the words
          // survive whatever is happening elsewhere in the box and only erode where the stream actually strikes.
          // It never wakes itself either, or one grain resting on a letter would tunnel all the way through it.
          const now = this.tick & 255
          let load = 0
          if (x > 0 && this.striking(i - 1, now)) load++
          if (x + 1 < W && this.striking(i + 1, now)) load++
          // A grain landing on top bears down on it, so it counts twice.
          if (y > 0 && this.striking(i - W, now)) load += 2
          if (load && this.random() < CRUMBLE * load) this.put(i, x, y, SAND)
        }
        // Wood and stone never move on their own.
      }
    }

    this.tick++
    return true
  }

  /**
   * Paint a disc of `material` centred on a cell. Solids fill it; loose materials are sprinkled at half density so a
   * stroke reads as poured rather than stamped. Fire also lights anything flammable it covers; erasing clears all.
   */
  paint(cx: number, cy: number, radius: number, material: number) {
    const { width: W, height: H, cells } = this
    const r = Math.max(0.5, radius)
    const r2 = r * r
    const solid = KIND[material] === SOLID
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) continue
        const i = y * W + x
        const c = cells[i]
        if (material === EMPTY) {
          if (c !== EMPTY) this.put(i, x, y, EMPTY)
        } else if (material === FIRE) {
          if ((c === EMPTY || FLAMMABILITY[c] > 0) && this.random() < 0.5) this.put(i, x, y, FIRE, c === WOOD ? 70 : -1)
        } else if (c === EMPTY && (solid || this.random() < 0.5)) this.put(i, x, y, material)
      }
    }
  }

  /** Paint along a segment, so a fast stroke is continuous rather than a row of dots. */
  paintLine(ax: number, ay: number, bx: number, by: number, radius: number, material: number) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1, radius * 0.6)))
    for (let s = 0; s <= steps; s++) this.paint(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps, radius, material)
  }

  /** Drip `material` into the top row around column `cx`. */
  emit(cx: number, halfWidth: number, material: number, rate = 0.55) {
    const lo = Math.max(0, Math.round(cx - halfWidth))
    const hi = Math.min(this.width - 1, Math.round(cx + halfWidth))
    for (let x = lo; x <= hi; x++) if (this.cells[x] === EMPTY && this.random() < rate) this.put(x, x, 0, material)
  }

  /** Fill every cell whose alpha in an RGBA mask of the same size is over half with `material`. */
  seedMask(rgba: ArrayLike<number>, material: number) {
    for (let i = 0; i < this.cells.length; i++) {
      if (rgba[i * 4 + 3] > 127) this.put(i, i % this.width, (i / this.width) | 0, material)
    }
    this.markAll()
  }

  /** How many cells hold each material, by id. */
  census() {
    const counts = new Uint32Array(MATERIAL_COUNT)
    for (let i = 0; i < this.cells.length; i++) counts[this.cells[i]]++
    return counts
  }

  /** Draw the cells changed since the last call into `pixels`, one word per cell. Returns the rectangle drawn. */
  render(pixels: Uint32Array, shades: Uint32Array): SandRect | null {
    if (this.px0 > this.px1) return null
    const { width: W, cells, life, tint } = this
    const x0 = this.px0
    const y0 = this.py0
    const x1 = this.px1
    const y1 = this.py1
    for (let y = y0; y <= y1; y++) {
      for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
        const m = cells[i]
        const k =
          m === FIRE ? (life[i] >= 56 ? 7 : life[i] >> 3) : KIND[m] === GAS ? Math.min(7, life[i] >> 4) : tint[i] & 7
        pixels[i] = shades[m * SHADES + k]
      }
    }
    this.px0 = W
    this.py0 = this.height
    this.px1 = this.py1 = -1
    return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
  }
}
