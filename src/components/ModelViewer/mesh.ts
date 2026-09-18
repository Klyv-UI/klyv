/** A triangle soup ready to upload: three vertices per triangle, one flat normal per vertex. */
export interface ModelViewerMesh {
  positions: Float32Array
  normals: Float32Array
  triangles: number
  min: [number, number, number]
  max: [number, number, number]
  format: 'stl-binary' | 'stl-ascii' | 'obj'
}

function build(vertices: number[], format: ModelViewerMesh['format']): ModelViewerMesh {
  const positions = Float32Array.from(vertices)
  const normals = new Float32Array(positions.length)
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let at = 0; at < positions.length; at += 9) {
    // Normals are recomputed from the winding: files often store zeros or stale values.
    const ux = positions[at + 3] - positions[at]
    const uy = positions[at + 4] - positions[at + 1]
    const uz = positions[at + 5] - positions[at + 2]
    const vx = positions[at + 6] - positions[at]
    const vy = positions[at + 7] - positions[at + 1]
    const vz = positions[at + 8] - positions[at + 2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const length = Math.hypot(nx, ny, nz) || 1
    nx /= length
    ny /= length
    nz /= length
    for (let k = 0; k < 3; k += 1) {
      normals.set([nx, ny, nz], at + k * 3)
      for (let axis = 0; axis < 3; axis += 1) {
        const value = positions[at + k * 3 + axis]
        if (value < min[axis]) min[axis] = value
        if (value > max[axis]) max[axis] = value
      }
    }
  }
  if (!Number.isFinite(min[0])) throw new Error('The model has no triangles.')
  return { positions, normals, triangles: positions.length / 9, min, max, format }
}

/**
 * STL, binary or ASCII. Binary is recognised by its size — an 80-byte header,
 * a triangle count, and exactly 50 bytes per triangle — because plenty of
 * binary files start with the word "solid" in the header, which is the ASCII
 * format’s marker.
 */
export function modelViewerParseStl(buffer: ArrayBuffer): ModelViewerMesh {
  const view = new DataView(buffer)
  if (buffer.byteLength >= 84) {
    const count = view.getUint32(80, true)
    if (84 + count * 50 === buffer.byteLength) {
      const vertices: number[] = []
      for (let triangle = 0; triangle < count; triangle += 1) {
        const base = 84 + triangle * 50 + 12
        for (let value = 0; value < 9; value += 1) vertices.push(view.getFloat32(base + value * 4, true))
      }
      return build(vertices, 'stl-binary')
    }
  }
  const text = new TextDecoder().decode(buffer)
  if (!/^\s*solid/.test(text)) throw new Error('This is not an STL file: the size does not match a binary STL and it does not start with “solid”.')
  const vertices: number[] = []
  for (const match of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) vertices.push(Number(match[1]), Number(match[2]), Number(match[3]))
  if (vertices.length % 9 !== 0 || vertices.some((value) => !Number.isFinite(value))) throw new Error('The ASCII STL has a malformed facet.')
  return build(vertices, 'stl-ascii')
}

/**
 * Wavefront OBJ: `v` and `f` lines. Faces may use v, v/vt, v//vn or v/vt/vn,
 * and negative indices counting back from the latest vertex. Polygons are
 * split into a fan of triangles from their first vertex, which is exact for
 * the convex faces modelling tools export.
 */
export function modelViewerParseObj(text: string): ModelViewerMesh {
  const points: number[][] = []
  const vertices: number[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/).map(Number)
      points.push([x, y, z])
    } else if (line.startsWith('f ')) {
      const corners = line
        .split(/\s+/)
        .slice(1)
        .map((token) => {
          const index = parseInt(token.split('/')[0], 10)
          return index < 0 ? points.length + index : index - 1
        })
      if (corners.some((index) => !points[index])) throw new Error(`A face refers to a vertex that does not exist: “${line}”.`)
      for (let k = 1; k < corners.length - 1; k += 1) vertices.push(...points[corners[0]], ...points[corners[k]], ...points[corners[k + 1]])
    }
  }
  return build(vertices, 'obj')
}

/** Parse by format, or guess it: text with `v`/`f` lines is OBJ, anything else is tried as STL. */
export function modelViewerParse(data: ArrayBuffer | string, format?: 'stl' | 'obj'): ModelViewerMesh {
  if (format === 'obj' || (typeof data === 'string' && !/^\s*solid/.test(data))) {
    return modelViewerParseObj(typeof data === 'string' ? data : new TextDecoder().decode(data))
  }
  return modelViewerParseStl(typeof data === 'string' ? (new TextEncoder().encode(data).buffer as ArrayBuffer) : data)
}

/** Each edge once, as line-segment endpoints, for the wireframe. */
export function modelViewerEdges(mesh: ModelViewerMesh): Float32Array {
  const { positions } = mesh
  const seen = new Set<string>()
  const out: number[] = []
  const key = (at: number) => `${positions[at].toFixed(5)},${positions[at + 1].toFixed(5)},${positions[at + 2].toFixed(5)}`
  for (let at = 0; at < positions.length; at += 9) {
    for (const [a, b] of [
      [at, at + 3],
      [at + 3, at + 6],
      [at + 6, at],
    ]) {
      const ka = key(a)
      const kb = key(b)
      const edge = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      if (seen.has(edge)) continue
      seen.add(edge)
      out.push(positions[a], positions[a + 1], positions[a + 2], positions[b], positions[b + 1], positions[b + 2])
    }
  }
  return Float32Array.from(out)
}
