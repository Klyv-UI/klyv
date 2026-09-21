/**
 * The physics behind OrbitSandbox, as plain numbers with no DOM.
 *
 * Gravity: every pair of bodies pulls on each other with Plummer-softened
 * Newtonian gravity,
 *   a_i = G · Σ_j m_j (r_j − r_i) / (|r_j − r_i|² + ε²)^(3/2)
 * which is what an inverse square becomes when each body is smeared over a
 * radius ε. It removes the singularity at r = 0 — two bodies passing through
 * each other with collisions off get a hard kick instead of an infinite one —
 * and is still exactly the gradient of a potential,
 *   U = −G · Σ_{i<j} m_i m_j / √(r² + ε²)
 * so energy is still a conserved quantity and the readout means something.
 *
 * Integration: velocity Verlet, in its kick–drift–kick form. It is second
 * order, costs one force evaluation per step, and — the reason it is here and
 * explicit Euler or RK4 are not — it is symplectic: it preserves phase-space
 * volume, so it exactly conserves a "shadow" energy a hair away from the true
 * one. Energy error then oscillates within a fixed band instead of
 * accumulating. Euler adds energy every orbit, so a planet spirals out; RK4
 * removes a little every orbit, so a planet spirals in. Verlet's planets stay
 * on their ellipses for as long as you watch. That only holds with a fixed
 * step, which is why `DT` is a constant and the frame rate only changes how
 * many steps a frame runs.
 *
 * Collisions: bodies touching (distance < r_a + r_b) either merge — mass
 * added, position at the centre of mass, velocity from total momentum, radius
 * from total volume — or bounce elastically along the line of centres. Both
 * conserve momentum exactly. A merge is inelastic by nature and loses kinetic
 * energy, which the component reports rather than hides.
 */

export type OrbitTone = 'accent' | 'ink' | 'soft' | 'success' | 'warning' | 'danger'
export type OrbitCollisionMode = 'merge' | 'bounce' | 'off'
export type OrbitPreset = 'solar' | 'binary' | 'figure-eight' | 'slingshot'

/** A body as code describes one. Only the position is required. */
export interface OrbitBodyInput {
  /** Position in world units. The default view spans about seventy. */
  x: number
  y: number
  /** Velocity in world units per unit of simulated time. */
  vx?: number
  vy?: number
  /** Mass. Radius follows it as mass^(1/3) unless `radius` is given. Defaults to 1. */
  mass?: number
  /** Radius in world units, overriding the one mass implies. */
  radius?: number
  /** Colour token the body and its trail are drawn in. */
  tone?: OrbitTone
  /** Name, announced when the body is selected. */
  label?: string
}

export interface OrbitBody {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  /** Acceleration at the current position — velocity Verlet carries it between steps. */
  ax: number
  ay: number
  mass: number
  radius: number
  tone: OrbitTone
  label?: string
}

export interface OrbitPhysics {
  gravity: number
  softening: number
  collisions: OrbitCollisionMode
}

/** The integration step, in units of simulated time. Fixed: see the header. */
export const DT = 0.004

/**
 * World units of radius per cube root of mass. Radius ∝ m^(1/3) is every
 * body having the same density, so two merging bodies keep their volume.
 */
export const RADIUS_PER_CBRT_MASS = 0.42

export const radiusForMass = (mass: number) => RADIUS_PER_CBRT_MASS * Math.cbrt(Math.max(mass, 1e-6))

let nextId = 1

export function createBody(input: OrbitBodyInput): OrbitBody {
  const mass = input.mass !== undefined && input.mass > 0 ? input.mass : 1
  return {
    id: nextId++,
    x: input.x,
    y: input.y,
    vx: input.vx ?? 0,
    vy: input.vy ?? 0,
    ax: 0,
    ay: 0,
    mass,
    radius: input.radius !== undefined && input.radius > 0 ? input.radius : radiusForMass(mass),
    tone: input.tone ?? 'ink',
    label: input.label,
  }
}

export const cloneBodies = (bodies: OrbitBody[]) => bodies.map((body) => ({ ...body }))

/* ------------------------------------------------------------------ forces */

/** Write every body's acceleration from the softened pairwise forces. O(n²), each pair once. */
export function accelerate(bodies: OrbitBody[], gravity: number, softening: number) {
  // A floor on ε² so ε = 0 is plain Newton rather than a division by zero.
  const eps2 = Math.max(softening * softening, 1e-9)
  const n = bodies.length
  for (let i = 0; i < n; i++) {
    bodies[i].ax = 0
    bodies[i].ay = 0
  }
  for (let i = 0; i < n; i++) {
    const a = bodies[i]
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d2 = dx * dx + dy * dy + eps2
      const pull = gravity / (d2 * Math.sqrt(d2))
      a.ax += dx * pull * b.mass
      a.ay += dy * pull * b.mass
      b.ax -= dx * pull * a.mass
      b.ay -= dy * pull * a.mass
    }
  }
}

/**
 * One velocity Verlet step: half a kick with the old acceleration, a full
 * drift, new accelerations, the other half kick. Algebraically the same as
 * x += v·dt + ½a·dt², v += ½(a + a′)·dt. Accelerations must be current on entry.
 */
export function step(bodies: OrbitBody[], dt: number, gravity: number, softening: number) {
  const half = dt * 0.5
  for (const body of bodies) {
    body.vx += body.ax * half
    body.vy += body.ay * half
    body.x += body.vx * dt
    body.y += body.vy * dt
  }
  accelerate(bodies, gravity, softening)
  for (const body of bodies) {
    body.vx += body.ax * half
    body.vy += body.ay * half
  }
}

/* -------------------------------------------------------------- collisions */

export interface OrbitMerge {
  /** The heavier body, which keeps its id, colour and name. */
  survivor: number
  absorbed: number
}

/**
 * Resolve every touching pair. Returns true if anything moved, in which case
 * the caller recomputes accelerations before the next step.
 */
export function collide(bodies: OrbitBody[], mode: OrbitCollisionMode, merges?: OrbitMerge[]): boolean {
  if (mode === 'off' || bodies.length < 2) return false
  let changed = false
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]
      const b = bodies[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const reach = a.radius + b.radius
      const d2 = dx * dx + dy * dy
      if (d2 >= reach * reach) continue
      changed = true
      const total = a.mass + b.mass
      if (mode === 'merge') {
        const big = a.mass >= b.mass ? a : b
        const small = big === a ? b : a
        big.x = (a.x * a.mass + b.x * b.mass) / total
        big.y = (a.y * a.mass + b.y * b.mass) / total
        big.vx = (a.vx * a.mass + b.vx * b.mass) / total
        big.vy = (a.vy * a.mass + b.vy * b.mass) / total
        // Volume adds, so radii add as cubes — the same as radiusForMass(total)
        // for bodies that follow the law, and sensible for ones given a radius.
        big.radius = Math.cbrt(a.radius ** 3 + b.radius ** 3)
        big.mass = total
        bodies.splice(bodies.indexOf(small), 1)
        merges?.push({ survivor: big.id, absorbed: small.id })
        // Indices have shifted and the merged body may now touch another: rescan.
        i = -1
        break
      }
      // Elastic bounce along the line of centres.
      const d = Math.sqrt(d2) || 1e-9
      const nx = dx / d
      const ny = dy / d
      // Separate them first, each moving in inverse proportion to its mass, so
      // the centre of mass stays where it was.
      const overlap = reach - d
      a.x -= nx * overlap * (b.mass / total)
      a.y -= ny * overlap * (b.mass / total)
      b.x += nx * overlap * (a.mass / total)
      b.y += ny * overlap * (a.mass / total)
      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (closing < 0) {
        // The 1-D elastic result along n; the tangential parts are untouched.
        const impulse = ((2 * a.mass * b.mass) / total) * closing
        a.vx += (impulse / a.mass) * nx
        a.vy += (impulse / a.mass) * ny
        b.vx -= (impulse / b.mass) * nx
        b.vy -= (impulse / b.mass) * ny
      }
    }
  }
  return changed
}

/**
 * Advance a whole number of steps, collisions included. The one routine the
 * live loop, the aim prediction and the reduced-motion trace all call — which
 * is what makes the predicted path the path.
 */
export function advance(bodies: OrbitBody[], steps: number, physics: OrbitPhysics, merges?: OrbitMerge[]) {
  for (let k = 0; k < steps; k++) {
    step(bodies, DT, physics.gravity, physics.softening)
    if (collide(bodies, physics.collisions, merges)) accelerate(bodies, physics.gravity, physics.softening)
  }
}

/* -------------------------------------------------------------- invariants */

export interface OrbitEnergy {
  kinetic: number
  potential: number
  total: number
}

/** Kinetic plus the softened potential — the quantity the force law conserves. */
export function energy(bodies: OrbitBody[], gravity: number, softening: number): OrbitEnergy {
  const eps2 = Math.max(softening * softening, 1e-9)
  let kinetic = 0
  let potential = 0
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]
    kinetic += 0.5 * a.mass * (a.vx * a.vx + a.vy * a.vy)
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      potential -= (gravity * a.mass * b.mass) / Math.sqrt(dx * dx + dy * dy + eps2)
    }
  }
  return { kinetic, potential, total: kinetic + potential }
}

/** Centre of mass, its velocity, and the total mass. */
export function barycentre(bodies: OrbitBody[]) {
  let mass = 0
  let x = 0
  let y = 0
  let vx = 0
  let vy = 0
  for (const body of bodies) {
    mass += body.mass
    x += body.x * body.mass
    y += body.y * body.mass
    vx += body.vx * body.mass
    vy += body.vy * body.mass
  }
  if (mass <= 0) return { x: 0, y: 0, vx: 0, vy: 0, mass: 0 }
  return { x: x / mass, y: y / mass, vx: vx / mass, vy: vy / mass, mass }
}

/** Sign of the total angular momentum about the barycentre: which way the system turns. */
export function spin(bodies: OrbitBody[]) {
  const c = barycentre(bodies)
  let l = 0
  for (const b of bodies) l += b.mass * ((b.x - c.x) * (b.vy - c.vy) - (b.y - c.y) * (b.vx - c.vx))
  return l < 0 ? -1 : 1
}

/** Move to the barycentre frame: centre of mass at the origin and at rest, so a scene does not drift off. */
export function toBarycentreFrame(bodies: OrbitBody[]) {
  const c = barycentre(bodies)
  for (const body of bodies) {
    body.x -= c.x
    body.y -= c.y
    body.vx -= c.vx
    body.vy -= c.vy
  }
}

/** Speed of a circular orbit at distance r from a mass M under the softened force. */
export const circularSpeed = (gravity: number, mass: number, r: number, softening: number) =>
  Math.sqrt((gravity * mass * r * r) / Math.pow(r * r + softening * softening, 1.5))

/* ------------------------------------------------------------ predictions */

export interface OrbitPrediction {
  /** x, y pairs in world units. */
  points: Float32Array
  count: number
  /** The launched body ends inside another. */
  impact: boolean
}

/**
 * The path a new body would take if launched now: the whole system is copied,
 * the probe appended exactly as a launch would append it, and the copy is run
 * through `advance`. Same integrator, same step, same collision order — so the
 * drawn path is not an estimate of what happens, it is what happens.
 */
export function predict(bodies: OrbitBody[], probe: OrbitBodyInput, physics: OrbitPhysics, steps: number, maxPoints = 500): OrbitPrediction {
  const copy = cloneBodies(bodies)
  const ghost = createBody(probe)
  ghost.id = -1
  copy.push(ghost)
  accelerate(copy, physics.gravity, physics.softening)
  const stride = Math.max(1, Math.ceil(steps / maxPoints))
  const points = new Float32Array((Math.ceil(steps / stride) + 2) * 2)
  let count = 0
  points[count * 2] = ghost.x
  points[count++ * 2 + 1] = ghost.y
  const merges: OrbitMerge[] = []
  let tracked = ghost
  for (let done = 0; done < steps; done += stride) {
    merges.length = 0
    advance(copy, Math.min(stride, steps - done), physics, merges)
    if (merges.some((merge) => merge.absorbed === -1)) {
      // The probe fell into something heavier: the path ends where it hit.
      const into = copy.find((body) => merges.some((merge) => merge.absorbed === -1 && merge.survivor === body.id))
      points[count * 2] = into ? into.x : tracked.x
      points[count++ * 2 + 1] = into ? into.y : tracked.y
      return { points, count, impact: true }
    }
    tracked = copy.find((body) => body.id === -1) ?? tracked
    points[count * 2] = tracked.x
    points[count++ * 2 + 1] = tracked.y
  }
  return { points, count, impact: false }
}

/**
 * Snapshots of the system at even intervals — the reduced-motion view, where
 * the reader steps and scrubs through time instead of watching it run.
 */
export function timeline(bodies: OrbitBody[], physics: OrbitPhysics, horizon: number, samples: number): OrbitBody[][] {
  const work = cloneBodies(bodies)
  accelerate(work, physics.gravity, physics.softening)
  const pairs = Math.max(1, (work.length * (work.length - 1)) / 2)
  // Keep the whole trace under a few million pair evaluations however many bodies there are.
  const budget = Math.floor(6_000_000 / pairs)
  const totalSteps = Math.max(samples, Math.min(Math.round(horizon / DT), budget))
  const stepsPerSample = Math.max(1, Math.round(totalSteps / samples))
  const out: OrbitBody[][] = [cloneBodies(work)]
  for (let s = 0; s < samples; s++) {
    advance(work, stepsPerSample, physics)
    out.push(cloneBodies(work))
  }
  return out
}

/** Simulated time between two timeline snapshots, matching `timeline`'s own arithmetic. */
export function timelineInterval(count: number, horizon: number, samples: number) {
  const pairs = Math.max(1, (count * (count - 1)) / 2)
  const totalSteps = Math.max(samples, Math.min(Math.round(horizon / DT), Math.floor(6_000_000 / pairs)))
  return Math.max(1, Math.round(totalSteps / samples)) * DT
}

/* ----------------------------------------------------------------- presets */

export interface OrbitScene {
  bodies: OrbitBody[]
  /** Radius around the barycentre the camera should fit. */
  extent: number
  /** Simulated time the reduced-motion trace should cover: about one of the scene's slowest orbits. */
  horizon: number
}

export const ORBIT_PRESET_LABELS: Record<OrbitPreset, string> = {
  solar: 'Star and planets',
  binary: 'Binary star',
  'figure-eight': 'Figure eight',
  slingshot: 'Slingshot',
}

/** A body on a circular orbit around `host`, at angle θ and distance r, turning anticlockwise on screen. */
function around(host: OrbitBody, r: number, theta: number, input: Omit<OrbitBodyInput, 'x' | 'y'>, physics: Pick<OrbitPhysics, 'gravity' | 'softening'>, sense = 1) {
  const v = circularSpeed(physics.gravity, host.mass, r, physics.softening)
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return createBody({
    ...input,
    x: host.x + r * c,
    y: host.y + r * s,
    // Screen y points down, so (sin θ, −cos θ) is anticlockwise as seen.
    vx: host.vx + v * s * sense,
    vy: host.vy - v * c * sense,
  })
}

/**
 * Chenciner and Montgomery's figure-eight: three equal masses chasing each
 * other round one curve. The initial conditions are Carles Simó's, for
 * G = m = 1, period 6.32591398. It is a known periodic solution, so an
 * integrator that is wrong shows it within one lap — the eight unravels.
 */
const EIGHT = { x: 0.97000436, y: -0.24308753, vx: -0.93240737, vy: -0.86473146, period: 6.32591398 }

function figureEight(physics: Pick<OrbitPhysics, 'gravity' | 'softening'>): OrbitScene {
  // Scale the unit solution to world size. Positions × S with masses × M is
  // still a solution if velocities go × √(GM/S) — and time stretches by
  // S^1.5/√(GM). M is picked so one lap takes about eighteen time units.
  const S = 14
  const lap = 18
  const M = Math.pow((EIGHT.period * Math.pow(S, 1.5)) / lap, 2) / physics.gravity
  const k = Math.sqrt((physics.gravity * M) / S)
  const bodies = [
    createBody({ x: EIGHT.x * S, y: EIGHT.y * S, vx: (-EIGHT.vx / 2) * k, vy: (-EIGHT.vy / 2) * k, mass: M, tone: 'accent', label: 'First body' }),
    createBody({ x: -EIGHT.x * S, y: -EIGHT.y * S, vx: (-EIGHT.vx / 2) * k, vy: (-EIGHT.vy / 2) * k, mass: M, tone: 'ink', label: 'Second body' }),
    createBody({ x: 0, y: 0, vx: EIGHT.vx * k, vy: EIGHT.vy * k, mass: M, tone: 'success', label: 'Third body' }),
  ]
  return { bodies, extent: 17, horizon: lap * 1.02 }
}

/**
 * The slingshot probe's starting state, for G = 1 and scaled by √G for other
 * values: with every velocity × √G the paths are identical and only time runs
 * faster. Found by a random search over launch points (bound ellipse before,
 * flyby 2–6 time units in, never closer than 3 to the giant) for the largest
 * gain in energy relative to the star: from −25.6 to +23.3, bound to escaping.
 */
const SLINGSHOT = { giantAngle: 0, x: 20.4563, y: 6.5933, vx: 1.1441, vy: -5.5953 }

/** The scene for a preset, built for the given G and ε so every circular orbit is circular. */
export function presetScene(preset: OrbitPreset, physics: Pick<OrbitPhysics, 'gravity' | 'softening'>): OrbitScene {
  if (preset === 'figure-eight') return figureEight(physics)

  if (preset === 'binary') {
    // Two equal stars 24 apart on a circular mutual orbit, and a planet on an
    // S-type orbit round one of them: 5 out, about a fifth of the separation,
    // inside the ~0.27 Holman–Wiegert limit for an equal-mass circular binary.
    // Any closer and it grazes its star (radius 2.8); any wider and star A
    // strips it within a few laps.
    const m = 300
    const d = 24
    const pull = (physics.gravity * m * m * d) / Math.pow(d * d + physics.softening ** 2, 1.5)
    const v = Math.sqrt((pull * (d / 2)) / m)
    const a = createBody({ x: -d / 2, y: 0, vx: 0, vy: v, mass: m, tone: 'accent', label: 'Star A' })
    const b = createBody({ x: d / 2, y: 0, vx: 0, vy: -v, mass: m, tone: 'warning', label: 'Star B' })
    const planet = around(b, 5, 0, { mass: 0.8, tone: 'ink', label: 'Planet' }, physics)
    const bodies = [a, b, planet]
    toBarycentreFrame(bodies)
    return { bodies, extent: 19, horizon: 31 }
  }

  if (preset === 'slingshot') {
    // A giant on a circular orbit and a probe on a looping ellipse timed to
    // pass just behind it. Passing behind a moving mass, the probe is pulled
    // along with it and leaves with more speed relative to the star than it
    // arrived with — enough here to escape. The encounter is found by search,
    // not by hand: see `probe` below.
    const star = createBody({ x: 0, y: 0, mass: 900, tone: 'accent', label: 'Star' })
    const giant = around(star, 18, SLINGSHOT.giantAngle, { mass: 60, tone: 'warning', label: 'Giant' }, physics)
    const probe = createBody({
      x: SLINGSHOT.x,
      y: SLINGSHOT.y,
      vx: SLINGSHOT.vx * Math.sqrt(physics.gravity),
      vy: SLINGSHOT.vy * Math.sqrt(physics.gravity),
      mass: 0.3,
      tone: 'danger',
      label: 'Probe',
    })
    const bodies = [star, giant, probe]
    toBarycentreFrame(bodies)
    return { bodies, extent: 30, horizon: 22 }
  }

  // A star, four planets from a quick inner one to a slow heavy outer one, and
  // a moon at 0.46 of the third planet's Hill radius (2.8 here). The moon is
  // retrograde, like Triton: prograde moons that far out are pulled off by the
  // star within a few laps, retrograde ones hold — a real asymmetry, and one
  // the integrator reproduces.
  const star = createBody({ x: 0, y: 0, mass: 700, tone: 'accent', label: 'Star' })
  const first = around(star, 8, 0.4, { mass: 0.6, tone: 'soft', label: 'First planet' }, physics)
  const second = around(star, 13, 2.5, { mass: 2, tone: 'success', label: 'Second planet' }, physics)
  const third = around(star, 20, 4.1, { mass: 6, tone: 'ink', label: 'Third planet' }, physics)
  const moon = around(third, 1.3, 0, { mass: 0.02, tone: 'soft', label: 'Moon' }, physics, -1)
  const fourth = around(star, 30, 5.6, { mass: 9, tone: 'warning', label: 'Fourth planet' }, physics)
  const bodies = [star, first, second, third, moon, fourth]
  toBarycentreFrame(bodies)
  return { bodies, extent: 34, horizon: 42 }
}

/** A scene from bodies code supplied, as given: no change of frame, so positions mean what the caller wrote. */
export function customScene(inputs: OrbitBodyInput[], physics: Pick<OrbitPhysics, 'gravity'>): OrbitScene {
  const bodies = inputs.map(createBody)
  const c = barycentre(bodies)
  let extent = 8
  for (const body of bodies) extent = Math.max(extent, Math.hypot(body.x - c.x, body.y - c.y) + body.radius * 2)
  // One circular period at the scene's edge — roughly its slowest orbit.
  const gm = Math.max(physics.gravity * c.mass, 1e-6)
  return { bodies, extent: extent * 1.1, horizon: Math.min(80, (2 * Math.PI * Math.pow(extent, 1.5)) / Math.sqrt(gm)) }
}
