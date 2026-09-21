/**
 * The cloth itself: a grid of Verlet points joined by distance links, with no
 * DOM in it. ClothPanel owns the rendering; this file owns the physics, so the
 * two can be read (and tuned) separately.
 *
 * Every array is typed and allocated once. A 10×7 cloth is 70 points and about
 * 230 links, which is nothing — but the step runs sixty times a second next to
 * a hundred transformed DOM nodes, and it should cost nothing to match.
 */

export type ClothPanelPins = 'top' | 'corners' | 'left' | 'none'

/** Each triangle is a full clone of the content, so this is the clone budget. */
export const MAX_TRIANGLES = 140

export interface ClothMesh {
  cols: number
  rows: number
  count: number
  width: number
  height: number
  x: Float32Array
  y: Float32Array
  z: Float32Array
  px: Float32Array
  py: Float32Array
  pz: Float32Array
  /** Rest position, which is also the content coordinate the point carries. */
  rx: Float32Array
  ry: Float32Array
  /** Inverse mass: 0 for a pinned point. */
  inv: Float32Array
  linkA: Uint16Array
  linkB: Uint16Array
  rest: Float32Array
  alive: Uint8Array
  /** Three point indices per triangle, then its three edge links. */
  tri: Uint16Array
  triEdge: Uint16Array
  triCell: Uint16Array
  triAlive: Uint8Array
  /** Per cell: the shear link that is not the edge of either triangle. */
  cellCross: Int32Array
  restArea: Float32Array
  /** Scratch for per-point forces and shading. */
  ax: Float32Array
  ay: Float32Array
  az: Float32Array
  weight: Float32Array
  broken: number
}

export interface ClothStep {
  gravity: number
  damping: number
  iterations: number
  /** Wind as an acceleration in px per step², in 3D. */
  windX: number
  windY: number
  windZ: number
  time: number
  /** Stretch ratio at which a link breaks. 0 turns tearing off. */
  tearLimit: number
  grab: number
  grabX: number
  grabY: number
  margin: number
}

/** Fits the grid under the clone budget by trimming the longer side. */
export function fitGrid(cols: number, rows: number) {
  let c = Math.max(2, Math.round(cols))
  let r = Math.max(2, Math.round(rows))
  while (2 * (c - 1) * (r - 1) > MAX_TRIANGLES) {
    if (c >= r) c -= 1
    else r -= 1
  }
  return { cols: c, rows: r }
}

export function buildMesh(width: number, height: number, gridCols: number, gridRows: number, pins: ClothPanelPins) {
  const { cols, rows } = fitGrid(gridCols, gridRows)
  const count = cols * rows
  const cells = (cols - 1) * (rows - 1)
  const f = () => new Float32Array(count)
  const mesh: ClothMesh = {
    cols,
    rows,
    count,
    width,
    height,
    x: f(),
    y: f(),
    z: f(),
    px: f(),
    py: f(),
    pz: f(),
    rx: f(),
    ry: f(),
    inv: f(),
    linkA: new Uint16Array(0),
    linkB: new Uint16Array(0),
    rest: new Float32Array(0),
    alive: new Uint8Array(0),
    tri: new Uint16Array(cells * 6),
    triEdge: new Uint16Array(cells * 6),
    triCell: new Uint16Array(cells * 2),
    triAlive: new Uint8Array(cells * 2).fill(1),
    cellCross: new Int32Array(cells),
    restArea: new Float32Array(cells * 2),
    ax: f(),
    ay: f(),
    az: f(),
    weight: f(),
    broken: 0,
  }
  const at = (r: number, c: number) => r * cols + c

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = at(r, c)
      mesh.rx[i] = (c / (cols - 1)) * width
      mesh.ry[i] = (r / (rows - 1)) * height
      const pinned =
        (pins === 'top' && r === 0) ||
        (pins === 'left' && c === 0) ||
        (pins === 'corners' && r === 0 && (c === 0 || c === cols - 1))
      mesh.inv[i] = pinned ? 0 : 1
    }
  }

  const a: number[] = []
  const b: number[] = []
  const link = (p: number, q: number) => {
    a.push(p)
    b.push(q)
    return a.length - 1
  }
  const horizontal: number[] = []
  const vertical: number[] = []
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols - 1; c += 1) horizontal[r * cols + c] = link(at(r, c), at(r, c + 1))
  for (let r = 0; r < rows - 1; r += 1) for (let c = 0; c < cols; c += 1) vertical[r * cols + c] = link(at(r, c), at(r + 1, c))

  // Cells alternate their diagonal so the cloth has no preferred shear direction.
  let t = 0
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const cell = r * (cols - 1) + c
      const p00 = at(r, c)
      const p10 = at(r, c + 1)
      const p01 = at(r + 1, c)
      const p11 = at(r + 1, c + 1)
      const top = horizontal[r * cols + c]
      const bottom = horizontal[(r + 1) * cols + c]
      const left = vertical[r * cols + c]
      const right = vertical[r * cols + c + 1]
      const even = (r + c) % 2 === 0
      const diagonal = even ? link(p00, p11) : link(p10, p01)
      mesh.cellCross[cell] = even ? link(p10, p01) : link(p00, p11)
      const shapes = even
        ? [
            [p00, p10, p11, top, right, diagonal],
            [p00, p11, p01, diagonal, bottom, left],
          ]
        : [
            [p00, p10, p01, top, diagonal, left],
            [p10, p11, p01, right, bottom, diagonal],
          ]
      for (const shape of shapes) {
        for (let k = 0; k < 3; k += 1) {
          mesh.tri[t * 3 + k] = shape[k]
          mesh.triEdge[t * 3 + k] = shape[k + 3]
        }
        mesh.triCell[t] = cell
        t += 1
      }
    }
  }

  mesh.linkA = Uint16Array.from(a)
  mesh.linkB = Uint16Array.from(b)
  mesh.rest = Float32Array.from(a, (p, l) => Math.hypot(mesh.rx[b[l]] - mesh.rx[p], mesh.ry[b[l]] - mesh.ry[p]))
  mesh.alive = new Uint8Array(a.length).fill(1)
  for (let k = 0; k < mesh.triAlive.length; k += 1) mesh.restArea[k] = (width / (cols - 1)) * (height / (rows - 1)) * 0.5
  resetMesh(mesh)
  return mesh
}

/** Back to the flat rest shape, every link whole. */
export function resetMesh(mesh: ClothMesh) {
  mesh.x.set(mesh.rx)
  mesh.px.set(mesh.rx)
  mesh.y.set(mesh.ry)
  mesh.py.set(mesh.ry)
  mesh.z.fill(0)
  mesh.pz.fill(0)
  mesh.alive.fill(1)
  mesh.triAlive.fill(1)
  mesh.broken = 0
}

function breakLink(mesh: ClothMesh, l: number) {
  mesh.alive[l] = 0
  mesh.broken += 1
  // Every triangle drawn across this link loses its skin, and the cell it sat
  // in loses the shear link that was holding it square.
  for (let t = 0; t < mesh.triAlive.length; t += 1) {
    const e = t * 3
    if (mesh.triEdge[e] !== l && mesh.triEdge[e + 1] !== l && mesh.triEdge[e + 2] !== l) continue
    mesh.triAlive[t] = 0
    const cross = mesh.cellCross[mesh.triCell[t]]
    if (mesh.alive[cross]) {
      mesh.alive[cross] = 0
    }
  }
}

/** One fixed step. Returns the largest squared speed of a free point, and how many links broke. */
export function stepMesh(mesh: ClothMesh, s: ClothStep) {
  const { x, y, z, px, py, pz, inv, ax, ay, az, tri } = mesh
  ax.fill(0)
  ay.fill(0)
  az.fill(0)

  // Wind presses on each triangle along its normal — the part that makes
  // cloth billow — plus a little drag in the plane so it streams.
  const windOn = s.windX !== 0 || s.windY !== 0 || s.windZ !== 0
  if (windOn) {
    for (let t = 0; t < mesh.triAlive.length; t += 1) {
      if (!mesh.triAlive[t]) continue
      const i = tri[t * 3]
      const j = tri[t * 3 + 1]
      const k = tri[t * 3 + 2]
      const e1x = x[j] - x[i]
      const e1y = y[j] - y[i]
      const e1z = z[j] - z[i]
      const e2x = x[k] - x[i]
      const e2y = y[k] - y[i]
      const e2z = z[k] - z[i]
      let nx = e1y * e2z - e1z * e2y
      let ny = e1z * e2x - e1x * e2z
      let nz = e1x * e2y - e1y * e2x
      const length = Math.hypot(nx, ny, nz) || 1
      nx /= length
      ny /= length
      nz /= length
      const cx = (x[i] + x[j] + x[k]) / 3
      const cy = (y[i] + y[j] + y[k]) / 3
      // Turbulence across the surface, so neighbouring panels disagree.
      const swirl = Math.sin(s.time * 2.3 + cx * 0.021 - cy * 0.017) + 0.5 * Math.sin(s.time * 3.7 - cx * 0.034)
      const wz = s.windZ * swirl
      const push = (nx * s.windX + ny * s.windY + nz * wz) * 0.7
      ax[i] += nx * push
      ay[i] += ny * push
      az[i] += nz * push
      ax[j] += nx * push
      ay[j] += ny * push
      az[j] += nz * push
      ax[k] += nx * push
      ay[k] += ny * push
      az[k] += nz * push
    }
  }

  let fastest = 0
  for (let i = 0; i < mesh.count; i += 1) {
    if (inv[i] === 0 || i === s.grab) continue
    const vx = (x[i] - px[i]) * s.damping
    const vy = (y[i] - py[i]) * s.damping
    const vz = (z[i] - pz[i]) * s.damping
    fastest = Math.max(fastest, vx * vx + vy * vy + vz * vz)
    px[i] = x[i]
    py[i] = y[i]
    pz[i] = z[i]
    x[i] += vx + ax[i] + s.windX * 0.12
    y[i] += vy + ay[i] + s.gravity + s.windY * 0.12
    z[i] += vz + az[i]
  }

  // The held point *is* the pointer. Its previous position is where it was a
  // step ago, so letting go throws the cloth at the speed it was moving.
  let held = 0
  if (s.grab >= 0) {
    px[s.grab] = x[s.grab]
    py[s.grab] = y[s.grab]
    pz[s.grab] = z[s.grab]
    x[s.grab] = s.grabX
    y[s.grab] = s.grabY
    z[s.grab] *= 0.8
    held = inv[s.grab]
    inv[s.grab] = 0
  }

  const { linkA, linkB, rest, alive } = mesh
  for (let pass = 0; pass < s.iterations; pass += 1) {
    for (let l = 0; l < rest.length; l += 1) {
      if (!alive[l]) continue
      const a = linkA[l]
      const b = linkB[l]
      const wa = inv[a]
      const wb = inv[b]
      const w = wa + wb
      if (w === 0) continue
      const dx = x[b] - x[a]
      const dy = y[b] - y[a]
      const dz = z[b] - z[a]
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001
      const shift = (distance - rest[l]) / distance / w
      x[a] += dx * shift * wa
      y[a] += dy * shift * wa
      z[a] += dz * shift * wa
      x[b] -= dx * shift * wb
      y[b] -= dy * shift * wb
      z[b] -= dz * shift * wb
    }
  }
  if (s.grab >= 0) inv[s.grab] = held

  // A floor and walls a little way outside the panel, so a torn or unpinned
  // cloth comes to rest on the page instead of falling off it.
  const floor = mesh.height + s.margin
  const depth = Math.max(mesh.width, mesh.height) * 0.45
  for (let i = 0; i < mesh.count; i += 1) {
    if (y[i] > floor) {
      y[i] = floor
      px[i] += (x[i] - px[i]) * 0.4
    }
    if (y[i] < -s.margin) y[i] = -s.margin
    if (x[i] < -s.margin) x[i] = -s.margin
    if (x[i] > mesh.width + s.margin) x[i] = mesh.width + s.margin
    if (z[i] > depth) z[i] = depth
    if (z[i] < -depth) z[i] = -depth
  }

  let tore = 0
  if (s.tearLimit > 0) {
    for (let l = 0; l < rest.length; l += 1) {
      if (!alive[l]) continue
      const a = linkA[l]
      const b = linkB[l]
      const distance = Math.hypot(x[b] - x[a], y[b] - y[a], z[b] - z[a])
      if (distance > rest[l] * s.tearLimit) {
        breakLink(mesh, l)
        tore += 1
      }
    }
  }
  return { fastest, tore }
}

/**
 * Eases every point towards its rest position and returns the largest distance
 * left. Previous positions move by the same fraction, so velocity decays with
 * it — the cloth relaxes into the panel rather than snapping.
 */
export function pullToRest(mesh: ClothMesh, k: number) {
  let far = 0
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.x[i] += (mesh.rx[i] - mesh.x[i]) * k
    mesh.y[i] += (mesh.ry[i] - mesh.y[i]) * k
    mesh.z[i] += -mesh.z[i] * k
    mesh.px[i] += (mesh.rx[i] - mesh.px[i]) * k
    mesh.py[i] += (mesh.ry[i] - mesh.py[i]) * k
    mesh.pz[i] += -mesh.pz[i] * k
    far = Math.max(far, Math.abs(mesh.x[i] - mesh.rx[i]), Math.abs(mesh.y[i] - mesh.ry[i]), Math.abs(mesh.z[i]))
  }
  return far
}

/**
 * Light per point, from -1 (in shadow) to 1 (catching the light). Two cues:
 * the vertex normal against a light from the upper left, and how stretched the
 * surrounding cloth is — bunched fabric darkens, pulled fabric thins and pales.
 */
export function shadeMesh(mesh: ClothMesh, out: Float32Array) {
  const { x, y, z, tri } = mesh
  const nx = mesh.ax
  const ny = mesh.ay
  const nz = mesh.az
  nx.fill(0)
  ny.fill(0)
  nz.fill(0)
  const area = out
  area.fill(0)
  const weight = mesh.weight
  weight.fill(0)
  for (let t = 0; t < mesh.triAlive.length; t += 1) {
    if (!mesh.triAlive[t]) continue
    const i = tri[t * 3]
    const j = tri[t * 3 + 1]
    const k = tri[t * 3 + 2]
    const e1x = x[j] - x[i]
    const e1y = y[j] - y[i]
    const e1z = z[j] - z[i]
    const e2x = x[k] - x[i]
    const e2y = y[k] - y[i]
    const e2z = z[k] - z[i]
    const cx = e1y * e2z - e1z * e2y
    const cy = e1z * e2x - e1x * e2z
    const cz = e1x * e2y - e1y * e2x
    const ratio = (Math.hypot(cx, cy, cz) * 0.5) / mesh.restArea[t]
    for (let v = 0; v < 3; v += 1) {
      const p = tri[t * 3 + v]
      nx[p] += cx
      ny[p] += cy
      nz[p] += cz
      area[p] += ratio
      weight[p] += 1
    }
  }
  // Light from the upper left and in front: (-0.4, -0.55, 0.73), normalised.
  const flat = 0.73
  for (let p = 0; p < mesh.count; p += 1) {
    if (!weight[p]) {
      out[p] = 0
      continue
    }
    const length = Math.hypot(nx[p], ny[p], nz[p]) || 1
    const lit = (-0.4 * nx[p] - 0.55 * ny[p] + 0.73 * nz[p]) / length
    const stretch = area[p] / weight[p] - 1
    out[p] = Math.max(-1, Math.min(1, (lit - flat) * 2.4 + stretch * 0.9))
  }
}
