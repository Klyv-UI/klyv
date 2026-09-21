import { catalog } from '../data/catalog'
import { dependencies } from '../data/dependencies'
import { sizes } from '../data/sizes'
import { GROUP_IDS, type GroupId } from '../data/groups'

/**
 * The library as a constellation: every component a star, every import an
 * edge, settled by a force simulation.
 *
 * The edges are the real graph — the same `internal` imports the CLI resolves
 * when it copies a component — so what the picture shows is what a bundler
 * would pull. Nothing here is arranged by hand: components that share
 * dependencies end up near each other because their springs pull them
 * together, which is why the clusters mean something.
 *
 * The simulation is written for this size. 617 stars repelling each other
 * pairwise is 380,000 sums a frame; instead each star only repels what is in
 * its own cell of a grid and the eight around it, which is the same answer
 * where it matters — close up — and nothing where it does not.
 */

export interface Star {
  name: string
  slug: string
  group: GroupId
  /** Draw radius, from what the component weighs. */
  radius: number
  /** How many components import it. */
  imported: number
  x: number
  y: number
  vx: number
  vy: number
}

export interface Edge {
  from: number
  to: number
}

const REPULSION = 190
const SPRING = 0.012
const SPRING_LENGTH = 34
const GRAVITY = 0.0016
const DAMPING = 0.86
const CELL = 46
/**
 * Ceilings on one step.
 *
 * An inverse-square repulsion goes to infinity as two stars approach each
 * other, and two of 614 always do: uncapped, a single close pair threw the
 * whole cloud apart on about the hundredth frame and the rest of the settling
 * was spent recovering from it. The force a pair can exert, and the speed a
 * star can reach, are both capped — which costs nothing at the distances that
 * shape the picture and everything at the distances that ruin it.
 */
const MAX_FORCE = 6
const MAX_SPEED = 18

export interface Constellation {
  stars: Star[]
  edges: Edge[]
  index: Map<string, number>
  /** Transitive imports of each star, by index — what lights up on hover. */
  brings: Map<number, number[]>
}

/** Build the graph, with every star placed on its group's arc to start with. */
export function buildConstellation(): Constellation {
  const entries = catalog.filter((entry) => dependencies[entry.name])
  const index = new Map(entries.map((entry, position) => [entry.name, position]))

  const importedBy = new Map<string, number>()
  for (const entry of entries) {
    for (const dependency of dependencies[entry.name].internal) {
      importedBy.set(dependency, (importedBy.get(dependency) ?? 0) + 1)
    }
  }

  const stars: Star[] = entries.map((entry, position) => {
    const gzip = sizes[entry.name]?.gzip ?? 2000
    // A ring per group, so the first frame already has the shape it will keep
    // and the settling reads as tightening rather than as chaos.
    const groupIndex = GROUP_IDS.indexOf(entry.group)
    const angle = (groupIndex / GROUP_IDS.length) * Math.PI * 2
    const spread = 90 + ((position * 37) % 120)
    return {
      name: entry.name,
      slug: entry.slug,
      group: entry.group,
      radius: Math.max(2.4, Math.min(9, Math.sqrt(gzip) / 22)),
      imported: importedBy.get(entry.name) ?? 0,
      x: Math.cos(angle) * (260 + spread) + Math.sin(position) * 40,
      y: Math.sin(angle) * (260 + spread) + Math.cos(position) * 40,
      vx: 0,
      vy: 0,
    }
  })

  const edges: Edge[] = []
  for (const entry of entries) {
    const from = index.get(entry.name)!
    for (const dependency of dependencies[entry.name].internal) {
      const to = index.get(dependency)
      if (to !== undefined) edges.push({ from, to })
    }
  }

  // What each star pulls in, resolved once: the hover highlight is a lookup
  // rather than a graph walk per frame.
  const brings = new Map<number, number[]>()
  for (const entry of entries) {
    const from = index.get(entry.name)!
    const seen = new Set<number>()
    const walk = (name: string) => {
      for (const dependency of dependencies[name]?.internal ?? []) {
        const at = index.get(dependency)
        if (at === undefined || seen.has(at)) continue
        seen.add(at)
        walk(dependency)
      }
    }
    walk(entry.name)
    brings.set(from, [...seen])
  }

  return { stars, edges, index, brings }
}

/**
 * One step of the simulation.
 *
 * `alpha` is how much of the step to apply: it starts at 1 and decays, so the
 * constellation settles instead of jittering forever. Returns the energy left
 * in it, which is what tells the caller it can stop drawing.
 */
export function step(constellation: Constellation, alpha: number, pinned: number | null): number {
  const { stars, edges } = constellation

  // Repulsion, against the eight cells around each star and its own.
  const grid = new Map<string, number[]>()
  for (let i = 0; i < stars.length; i++) {
    const key = `${Math.round(stars[i].x / CELL)}:${Math.round(stars[i].y / CELL)}`
    const cell = grid.get(key)
    if (cell) cell.push(i)
    else grid.set(key, [i])
  }

  for (let i = 0; i < stars.length; i++) {
    const star = stars[i]
    const cellX = Math.round(star.x / CELL)
    const cellY = Math.round(star.y / CELL)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${cellX + dx}:${cellY + dy}`) ?? []) {
          if (j <= i) continue
          const other = stars[j]
          let deltaX = star.x - other.x
          let deltaY = star.y - other.y
          let distance = Math.hypot(deltaX, deltaY)
          if (distance > CELL * 1.5) continue
          if (distance < 0.01) {
            // Exactly on top of each other: push apart in a fixed direction
            // rather than dividing by zero.
            deltaX = (i % 2 === 0 ? 1 : -1) * 0.5
            deltaY = 0.5
            distance = 0.7
          }
          const force = Math.min(MAX_FORCE, REPULSION / (distance * distance)) * alpha
          const fx = (deltaX / distance) * force
          const fy = (deltaY / distance) * force
          star.vx += fx
          star.vy += fy
          other.vx -= fx
          other.vy -= fy
        }
      }
    }
  }

  // Springs along the real imports.
  for (const edge of edges) {
    const from = stars[edge.from]
    const to = stars[edge.to]
    const deltaX = to.x - from.x
    const deltaY = to.y - from.y
    const distance = Math.max(0.01, Math.hypot(deltaX, deltaY))
    const force = (distance - SPRING_LENGTH) * SPRING * alpha
    const fx = (deltaX / distance) * force
    const fy = (deltaY / distance) * force
    from.vx += fx
    from.vy += fy
    to.vx -= fx
    to.vy -= fy
  }

  // A pull to the middle, so nothing drifts off on its own.
  let energy = 0
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i]
    if (i === pinned) {
      star.vx = 0
      star.vy = 0
      continue
    }
    star.vx -= star.x * GRAVITY * alpha
    star.vy -= star.y * GRAVITY * alpha
    star.vx *= DAMPING
    star.vy *= DAMPING
    const speed = Math.hypot(star.vx, star.vy)
    if (speed > MAX_SPEED) {
      star.vx = (star.vx / speed) * MAX_SPEED
      star.vy = (star.vy / speed) * MAX_SPEED
    }
    star.x += star.vx
    star.y += star.vy
    energy += star.vx * star.vx + star.vy * star.vy
  }
  return energy / stars.length
}

/** The star nearest a point in constellation space, within `reach`. */
export function starAt(constellation: Constellation, x: number, y: number, reach: number): number | null {
  let best: number | null = null
  let bestDistance = reach
  for (let i = 0; i < constellation.stars.length; i++) {
    const star = constellation.stars[i]
    const distance = Math.hypot(star.x - x, star.y - y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}
