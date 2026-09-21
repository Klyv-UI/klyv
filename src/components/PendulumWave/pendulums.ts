/**
 * The pendulum wave behind PendulumWave, as plain numbers with no DOM.
 *
 * The apparatus (the Harvard Natural Sciences demonstration) is a row of simple
 * pendulums whose periods are chosen so that, in one cycle of `cycle` seconds,
 * pendulum n completes exactly N_base + n oscillations:
 *
 *   T_n = cycle / (N_base + n),      L_n = g · (T_n / 2π)²
 *
 * Neighbours then drift apart in phase by 1/cycle of a swing per second, so at time
 * t the relative phase across the row is n · t/cycle swings. Every pattern follows
 * from that one line: a fan and a travelling wave while n · t/cycle is small, two
 * rows at t = cycle/2 (neighbours half a swing apart), three at a third, and one
 * straight line again at t = cycle, because every pendulum has completed a whole
 * number of swings.
 *
 * The swing itself is the real pendulum, θ'' = −(g/L)·sin θ − 2γ·θ', integrated with
 * RK4 — not a sine wave. At the release angles used here the difference is a
 * fraction of a per cent of the period, but it is there, and it is why the
 * amplitude slider can detune the pattern (see `buildRig`).
 */

/** Standard gravity, m/s². The pattern does not depend on it — only the lengths do. */
export const GRAVITY = 9.80665

/**
 * Fixed integration step, seconds. The live loop, a seek and a reset all step by
 * exactly this, so the same time always gives the same state, and scrubbing back
 * to a moment shows what playing to it would have shown.
 *
 * RK4 rather than a symplectic Verlet step, because what the eye reads here is
 * *phase*, not energy. Verlet keeps energy bounded forever but its phase slips by
 * about (ωh)²/24 of a swing per swing; RK4 slips by about (ωh)⁴/120. For the
 * fastest pendulum of a 20-second cycle (ω ≈ 10.7 rad/s) at h = 1/240 s that is
 * 8·10⁻⁵ against 3·10⁻⁸ per swing — both invisible in one cycle, but only one of
 * them stays invisible over an afternoon of looping.
 */
export const STEP = 1 / 240

/** No pendulum is released further out than this, however high the amplitude. */
export const MAX_RELEASE = (75 * Math.PI) / 180

const DEG = Math.PI / 180
const TAU = Math.PI * 2

export interface PendulumRigOptions {
  /** Number of pendulums. */
  count: number
  /** Seconds for the whole pattern to come back to a line. */
  cycle: number
  /** Oscillations the slowest pendulum makes per cycle. */
  baseCycles: number
  /** Release angle of the longest pendulum, degrees. */
  amplitude: number
  /** Release angle the strings were cut for, degrees. 0 is the textbook small-angle cut. */
  tuning: number
  /** Amplitude decay rate γ, per second. */
  damping: number
}

export interface PendulumRig {
  count: number
  cycle: number
  baseCycles: number
  /** Whole oscillations per cycle, N_base + n. */
  cycles: Float64Array
  /** String lengths, metres. Index 0 is the longest and slowest. */
  lengths: Float64Array
  /** g / L_n, the coefficient of sin θ in the equation of motion. */
  stiffness: Float64Array
  /** Release angle of each pendulum, radians. */
  release: Float64Array
  /** Speed through the bottom of the swing when released from rest, rad/s. */
  bottomSpeed: Float64Array
  /** The horizontal distance every bob is pulled back by, metres. */
  offset: number
  /** The release angle actually used for the longest pendulum, degrees — the requested one, capped by MAX_RELEASE. */
  amplitude: number
  /** γ, per second. */
  damping: number
}

export interface PendulumState {
  /** Whole integration steps since release. Time is `steps · STEP`. */
  steps: number
  theta: Float64Array
  omega: Float64Array
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * The exact period of a pendulum released from rest at θ₀, as a multiple of the
 * small-angle period 2π√(L/g): T/T₀ = 2K(k)/π with k = sin(θ₀/2), which is
 * 1 / AGM(1, cos(θ₀/2)). The arithmetic–geometric mean converges quadratically, so
 * five rounds reach double precision. About 1 + θ₀²/16: +0.27 % at 12°, +7 % at 60°.
 */
export function periodStretch(theta0: number): number {
  let a = 1
  let b = Math.cos(theta0 / 2)
  for (let i = 0; i < 8 && Math.abs(a - b) > 1e-15; i++) {
    const mean = (a + b) / 2
    b = Math.sqrt(a * b)
    a = mean
  }
  return 1 / a
}

/**
 * Every bob is pulled back by the same horizontal distance — the longest pendulum
 * to `amplitude`, the rest to whatever angle puts them level with it — which is how
 * the real apparatus is released, with one board against the whole row. Shorter
 * strings therefore start at larger angles. Returns that shared distance.
 */
function releaseAngles(lengths: Float64Array, amplitude: number, out: Float64Array): number {
  const offset = lengths[0] * Math.sin(Math.min(amplitude, MAX_RELEASE))
  const ceiling = Math.sin(MAX_RELEASE)
  for (let n = 0; n < lengths.length; n++) out[n] = Math.asin(Math.min(ceiling, offset / lengths[n]))
  return offset
}

/**
 * Cut the strings and pull the row back.
 *
 * The lengths start from the textbook L = g(T/2π)². That is exact only for
 * vanishing swings; a real pendulum released at θ₀ runs slow by `periodStretch(θ₀)`,
 * and because a common release puts the short strings at larger angles, they run
 * slower than the long ones — the row's phases drift apart as well as the whole
 * pattern stretching. At 12° the shortest of fifteen, starting near 18°, would end
 * a 60-second cycle about a third of a swing behind the longest: the line would
 * come back as a fan.
 *
 * So, as a builder does by ear, the strings are cut for one release angle,
 * `tuning`: each length is shortened until its *exact* period at the angle it will
 * actually start from is T_n. Those angles depend on the lengths (through the
 * shared pull-back), so it is a fixed-point iteration; it converges in a handful of
 * rounds because the correction is second order in the angle.
 *
 * Release at the tuned angle and the cycle closes to double precision. Release
 * from anything else — further or less far — and it does not, by exactly as much
 * as the real apparatus would miss. `closingSpread` measures by how much. With
 * `tuning = 0` this is the textbook cut, correct in the small-angle limit.
 */
export function buildRig(options: PendulumRigOptions): PendulumRig {
  const count = Math.round(clamp(options.count, 2, 48))
  const cycle = clamp(options.cycle, 2, 600)
  const baseCycles = Math.round(clamp(options.baseCycles, 1, 400))
  const cycles = new Float64Array(count)
  const periods = new Float64Array(count)
  const lengths = new Float64Array(count)
  const release = new Float64Array(count)
  for (let n = 0; n < count; n++) {
    cycles[n] = baseCycles + n
    periods[n] = cycle / cycles[n]
    lengths[n] = GRAVITY * Math.pow(periods[n] / TAU, 2)
  }

  // Neither angle may ask the shortest string to start past MAX_RELEASE. Tuning
  // shortens the short strings most, so the cap is re-taken every round.
  const feasible = (from: Float64Array) => Math.asin(Math.min(1, Math.sin(MAX_RELEASE) * (from[count - 1] / from[0])))
  const requested = clamp(options.tuning, 0, 75) * DEG
  if (requested > 0) {
    for (let round = 0; round < 60; round++) {
      releaseAngles(lengths, Math.min(requested, feasible(lengths)), release)
      let change = 0
      for (let n = 0; n < count; n++) {
        const next = GRAVITY * Math.pow(periods[n] / (TAU * periodStretch(release[n])), 2)
        change = Math.max(change, Math.abs(next - lengths[n]) / lengths[n])
        lengths[n] = next
      }
      if (change < 1e-14) break
    }
  }

  const amplitude = Math.min(clamp(options.amplitude, 0, 90) * DEG, feasible(lengths))
  const offset = releaseAngles(lengths, amplitude, release)
  const stiffness = new Float64Array(count)
  const bottomSpeed = new Float64Array(count)
  for (let n = 0; n < count; n++) {
    stiffness[n] = GRAVITY / lengths[n]
    bottomSpeed[n] = Math.sqrt(2 * stiffness[n] * (1 - Math.cos(release[n])))
  }
  return { count, cycle, baseCycles, cycles, lengths, stiffness, release, bottomSpeed, offset, amplitude: amplitude / DEG, damping: Math.max(0, options.damping) }
}

/**
 * The largest amplitude that still leaves the shortest string below MAX_RELEASE,
 * degrees. A short cycle means a wide spread of lengths, so this shrinks with it:
 * about 39° for fifteen pendulums over sixty seconds, 19° over twenty.
 */
export function maxAmplitude(rig: PendulumRig): number {
  const ratio = rig.lengths[rig.count - 1] / rig.lengths[0]
  return Math.asin(Math.min(1, Math.sin(MAX_RELEASE) * ratio)) / DEG
}

/**
 * How far from a straight line the row is when the cycle ends, in swings: the
 * spread between the pendulum that has got furthest ahead of its whole number of
 * oscillations and the one furthest behind. Zero at the tuned angle; under about
 * 0.05 the eye still reads a line. Damping is ignored — it shifts every period by
 * γ²/2ω², a few parts in a million here.
 */
export function closingSpread(rig: PendulumRig): number {
  let low = Infinity
  let high = -Infinity
  for (let n = 0; n < rig.count; n++) {
    const period = TAU * Math.sqrt(rig.lengths[n] / GRAVITY) * periodStretch(rig.release[n])
    const drift = rig.cycle / period - rig.cycles[n]
    low = Math.min(low, drift)
    high = Math.max(high, drift)
  }
  return high - low
}

/** Every bob pulled back and held still. */
export function releaseState(rig: PendulumRig, into?: PendulumState): PendulumState {
  const state = into && into.theta.length === rig.count ? into : { steps: 0, theta: new Float64Array(rig.count), omega: new Float64Array(rig.count) }
  state.steps = 0
  state.theta.set(rig.release)
  state.omega.fill(0)
  return state
}

/**
 * One RK4 step of θ'' = −(g/L)·sin θ − 2γ·θ' for every pendulum. `onCross` is told
 * when a bob passes the bottom going one way — once per swing — with its speed
 * there as a fraction of its speed on the first pass.
 */
export function stepRig(rig: PendulumRig, state: PendulumState, onCross?: (index: number, strength: number) => void) {
  const h = STEP
  const half = h / 2
  const drag = 2 * rig.damping
  const { theta, omega } = state
  for (let n = 0; n < rig.count; n++) {
    const k = rig.stiffness[n]
    const t1 = theta[n]
    const w1 = omega[n]
    const a1 = -k * Math.sin(t1) - drag * w1
    const t2 = t1 + half * w1
    const w2 = w1 + half * a1
    const a2 = -k * Math.sin(t2) - drag * w2
    const t3 = t1 + half * w2
    const w3 = w1 + half * a2
    const a3 = -k * Math.sin(t3) - drag * w3
    const t4 = t1 + h * w3
    const w4 = w1 + h * a3
    const a4 = -k * Math.sin(t4) - drag * w4
    const next = t1 + (h / 6) * (w1 + 2 * w2 + 2 * w3 + w4)
    theta[n] = next
    omega[n] = w1 + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4)
    if (onCross && t1 > 0 && next <= 0 && rig.bottomSpeed[n] > 0) onCross(n, Math.min(1, Math.abs(omega[n]) / rig.bottomSpeed[n]))
  }
  state.steps++
}

/** Steps between stored states: one a second of simulated time. */
const CHECKPOINT = Math.round(1 / STEP)

/**
 * Random access into the run. Scrubbing to a moment means integrating to it from
 * release — there is no closed form for the nonlinear, damped swing — so states are
 * kept once a simulated second, and a seek replays at most a second from the last
 * one before it. A scrub across a one-minute cycle costs 240 steps, not 14,000.
 */
export class PendulumTimeline {
  private readonly marks: Float64Array[] = []

  constructor(private readonly rig: PendulumRig) {
    const start = releaseState(rig)
    this.marks.push(Float64Array.from([...start.theta, ...start.omega]))
  }

  seek(state: PendulumState, steps: number) {
    const target = Math.max(0, Math.round(steps))
    const count = this.rig.count
    const index = Math.min(Math.floor(target / CHECKPOINT), this.marks.length - 1)
    const mark = this.marks[index]
    state.theta.set(mark.subarray(0, count))
    state.omega.set(mark.subarray(count))
    state.steps = index * CHECKPOINT
    while (state.steps < target) {
      stepRig(this.rig, state)
      if (state.steps % CHECKPOINT === 0 && state.steps / CHECKPOINT === this.marks.length && this.marks.length < 4000) {
        const saved = new Float64Array(count * 2)
        saved.set(state.theta)
        saved.set(state.omega, count)
        this.marks.push(saved)
      }
    }
  }
}

/** The cycle's pitch set: each pendulum's own frequency, moved up by whole octaves until the slowest sits near middle C. */
export function chimePitches(rig: PendulumRig): Float64Array {
  const slowest = rig.cycles[0] / rig.cycle
  const shift = Math.pow(2, Math.round(Math.log2(262 / slowest)))
  return rig.cycles.map((cycles) => (cycles / rig.cycle) * shift)
}

/* ------------------------------------------------------------ the cycle, named */

export interface PendulumPhase {
  /** Stable identity, for noticing a change. */
  key: string
  /** Short name: “one line”, “two waves”, “chaos”. */
  name: string
  /** A sentence about what the bobs are doing. */
  detail: string
  /** A named figure rather than a transition between them. */
  figure: boolean
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five']

/**
 * How far off a figure the row can be and still look like it: the relative phase
 * across the whole row, in swings. A tenth of a swing spread over the row is where
 * a line starts to read as a slight curve.
 */
const TOLERANCE = 0.12

/**
 * What the row looks like at fraction `u` of the cycle.
 *
 * At u the relative phase between neighbours is u swings, so the phase across the
 * row is (count − 1)·u. Near zero (or one) that is a line. When it is a whole
 * number k of swings, the row is k full wavelengths of a travelling wave. When u is
 * p/q, neighbours are p/q of a swing apart and only q distinct phases exist, so the
 * bobs gather into q rows — two at a half, three at a third and two thirds, four
 * at a quarter. Past three waves and away from those fractions, no figure the eye
 * can hold: the “chaos”, which is still exactly periodic.
 */
export function describePhase(u: number, count: number): PendulumPhase {
  const f = ((u % 1) + 1) % 1
  const across = Math.max(1, count - 1)
  const span = across * Math.min(f, 1 - f)
  if (span < TOLERANCE) return { key: 'line', name: 'one line', detail: 'Every bob in step, in one straight line.', figure: true }
  for (const q of [2, 3, 4]) {
    for (let p = 1; p < q; p++) {
      if (q === 4 && p === 2) continue
      if (across * Math.abs(f - p / q) < TOLERANCE) {
        return {
          key: `rows-${q}`,
          name: `${WORDS[q]} rows`,
          detail: q === 2 ? 'Alternate bobs swing in opposite directions: two rows.' : `Every ${q === 3 ? 'third' : 'fourth'} bob in step: ${WORDS[q]} rows.`,
          figure: true,
        }
      }
    }
  }
  if (span <= 3.25) {
    const k = Math.round(span)
    const going = f < 0.5
    if (k >= 1 && Math.abs(span - k) < TOLERANCE) {
      return {
        key: `waves-${k}-${going ? 'out' : 'in'}`,
        name: k === 1 ? 'one wave' : `${WORDS[k]} waves`,
        detail: `${k === 1 ? 'One full wave' : `${WORDS[k][0].toUpperCase()}${WORDS[k].slice(1)} full waves`} along the row, ${going ? 'winding up' : 'unwinding'}.`,
        figure: true,
      }
    }
    if (span < 1) return going ? { key: 'fan', name: 'fanning out', detail: 'The row fans out into a curve.', figure: false } : { key: 'closing', name: 'closing up', detail: 'The curve straightens towards a line.', figure: false }
    return going ? { key: 'snake', name: 'a travelling wave', detail: 'A wave runs along the row.', figure: false } : { key: 'unwind', name: 'a wave unwinding', detail: 'The wave runs back along the row.', figure: false }
  }
  return { key: 'chaos', name: 'chaos', detail: 'No figure the eye can hold, though it is still exactly periodic.', figure: false }
}

export interface PendulumMark {
  /** Fraction of the cycle. */
  at: number
  /** Short tick label, or empty for a minor tick. */
  label: string
  kind: 'line' | 'rows' | 'waves'
}

/** Where the named figures fall in the cycle, for a ruler. */
export function cycleMarks(count: number): PendulumMark[] {
  const marks: PendulumMark[] = [
    { at: 0, label: '1', kind: 'line' },
    { at: 1 / 4, label: '4', kind: 'rows' },
    { at: 1 / 3, label: '3', kind: 'rows' },
    { at: 1 / 2, label: '2', kind: 'rows' },
    { at: 2 / 3, label: '3', kind: 'rows' },
    { at: 3 / 4, label: '4', kind: 'rows' },
    { at: 1, label: '1', kind: 'line' },
  ]
  const across = Math.max(1, count - 1)
  for (let k = 1; k <= 3; k++) {
    const at = k / across
    if (at >= 0.23) break
    marks.push({ at, label: '', kind: 'waves' }, { at: 1 - at, label: '', kind: 'waves' })
  }
  return marks.sort((a, b) => a.at - b.at)
}
