/** A point on the drawing, in the editor's own coordinates. */
export interface PathEditorVector {
  x: number
  y: number
}

/** One anchor. Handles are absolute positions; null means the segment on that side leaves straight. */
export interface PathEditorPoint extends PathEditorVector {
  in: PathEditorVector | null
  out: PathEditorVector | null
  /** Smooth anchors keep their two handles on one line, so the curve passes through without a kink. */
  smooth: boolean
}

/** One subpath: the anchors between an M and the next M (or Z). */
export interface PathEditorContour {
  points: PathEditorPoint[]
  closed: boolean
}

const TOKEN = /[MmLlHhVvCcQqZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[AaSsTt]/g

const same = (a: PathEditorVector, b: PathEditorVector) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
const lerp = (a: PathEditorVector, b: PathEditorVector, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Whether both handles sit on one line through the anchor, pointing away from each other. */
function looksSmooth(point: PathEditorPoint) {
  if (!point.in || !point.out) return false
  const ax = point.in.x - point.x
  const ay = point.in.y - point.y
  const bx = point.out.x - point.x
  const by = point.out.y - point.y
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by)
  return length > 0 && Math.abs(ax * by - ay * bx) / length < 0.02 && ax * bx + ay * by < 0
}

/**
 * Parse SVG path data into contours. Understands M, L, H, V, C, Q and Z in both
 * absolute and relative form, with implicit repeats; quadratics become cubics,
 * which describe the same curve exactly. Arcs and the shorthand S/T are refused
 * with a message rather than silently dropped.
 */
export function pathEditorParse(d: string): PathEditorContour[] {
  const tokens = d.match(TOKEN) ?? []
  const contours: PathEditorContour[] = []
  let contour: PathEditorContour | null = null
  let cursor = { x: 0, y: 0 }
  let start = { x: 0, y: 0 }
  let command = ''
  let index = 0

  const number = () => {
    const token = tokens[index]
    if (token === undefined || /[a-zA-Z]/.test(token)) throw new Error(`Expected a number after ${command}.`)
    index += 1
    return Number(token)
  }
  const pair = (relative: boolean) => {
    const x = number()
    const y = number()
    return relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y }
  }
  const open = () => {
    if (contour) return contour
    contour = { points: [{ ...cursor, in: null, out: null, smooth: false }], closed: false }
    contours.push(contour)
    return contour
  }
  const last = () => open().points[open().points.length - 1]
  const lineTo = (to: PathEditorVector) => {
    open().points.push({ ...to, in: null, out: null, smooth: false })
    cursor = to
  }

  while (index < tokens.length) {
    const token = tokens[index]
    if (/[a-zA-Z]/.test(token)) {
      if (/[AaSsTt]/.test(token)) throw new Error(`The ${token} command is not supported — convert arcs and shorthand curves first.`)
      command = token
      index += 1
    } else if (!command) {
      throw new Error('Path data must start with M.')
    }
    const relative = command === command.toLowerCase()
    switch (command.toUpperCase()) {
      case 'M': {
        cursor = pair(relative)
        start = cursor
        contour = null
        open()
        // Coordinates after a moveto are implicit linetos.
        command = relative ? 'l' : 'L'
        break
      }
      case 'L':
        lineTo(pair(relative))
        break
      case 'H': {
        const x = number()
        lineTo({ x: relative ? cursor.x + x : x, y: cursor.y })
        break
      }
      case 'V': {
        const y = number()
        lineTo({ x: cursor.x, y: relative ? cursor.y + y : y })
        break
      }
      case 'C': {
        const c1 = pair(relative)
        const c2 = pair(relative)
        const to = pair(relative)
        last().out = c1
        open().points.push({ ...to, in: c2, out: null, smooth: false })
        cursor = to
        break
      }
      case 'Q': {
        const control = pair(relative)
        const to = pair(relative)
        const from = cursor
        last().out = lerp(from, control, 2 / 3)
        open().points.push({ ...to, in: lerp(to, control, 2 / 3), out: null, smooth: false })
        cursor = to
        break
      }
      case 'Z': {
        const current = open()
        // A path that returns to its start before Z repeats the first anchor; fold it back in.
        if (current.points.length > 1 && same(current.points[0], current.points[current.points.length - 1])) {
          const end = current.points.pop()!
          current.points[0].in = end.in
        }
        current.closed = true
        contour = null
        cursor = start
        command = ''
        break
      }
    }
  }

  for (const shape of contours) for (const point of shape.points) point.smooth = looksSmooth(point)
  return contours
}

const num = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  return (Object.is(rounded, -0) ? 0 : rounded).toString()
}
const xy = (point: PathEditorVector) => `${num(point.x)} ${num(point.y)}`

function segment(from: PathEditorPoint, to: PathEditorPoint) {
  if (!from.out && !to.in) return `L${xy(to)}`
  return `C${xy(from.out ?? from)} ${xy(to.in ?? to)} ${xy(to)}`
}

/** Absolute M/L/C/Z path data, two decimals, one subpath per contour. */
export function pathEditorSerialize(contours: PathEditorContour[]): string {
  return contours
    .filter((contour) => contour.points.length > 0)
    .map(({ points, closed }) => {
      let d = `M${xy(points[0])}`
      for (let index = 1; index < points.length; index += 1) d += ` ${segment(points[index - 1], points[index])}`
      if (closed && points.length > 1) {
        const end = points[points.length - 1]
        if (end.out || points[0].in) d += ` ${segment(end, points[0])}`
        d += ' Z'
      }
      return d
    })
    .join(' ')
}

/** The four control points of the segment leaving `from`. */
export function pathEditorControls(from: PathEditorPoint, to: PathEditorPoint): PathEditorVector[] {
  return [from, from.out ?? from, to.in ?? to, to]
}

/** Point at `t` on a cubic. */
export function pathEditorAt(controls: PathEditorVector[], t: number): PathEditorVector {
  const [p0, p1, p2, p3] = controls
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

/** The parameter on a segment nearest to `target`: a coarse scan, then a narrowing search around the best sample. */
export function pathEditorNearest(controls: PathEditorVector[], target: PathEditorVector): number {
  const distance = (t: number) => {
    const point = pathEditorAt(controls, t)
    return Math.hypot(point.x - target.x, point.y - target.y)
  }
  let best = 0
  for (let step = 0; step <= 64; step += 1) if (distance(step / 64) < distance(best)) best = step / 64
  let span = 1 / 64
  for (let round = 0; round < 12; round += 1) {
    const left = Math.max(0, best - span / 2)
    const right = Math.min(1, best + span / 2)
    best = distance(left) < distance(best) ? left : distance(right) < distance(best) ? right : best
    span /= 2
  }
  return best
}

/**
 * Split the segment from `from` to `to` at `t` with de Casteljau's construction.
 * Returns the new anchor and the handles the two neighbours need so the curve keeps its exact shape.
 */
export function pathEditorSplit(from: PathEditorPoint, to: PathEditorPoint, t: number) {
  if (!from.out && !to.in) {
    return { fromOut: null, point: { ...lerp(from, to, t), in: null, out: null, smooth: false }, toIn: null }
  }
  const [p0, p1, p2, p3] = pathEditorControls(from, to)
  const p01 = lerp(p0, p1, t)
  const p12 = lerp(p1, p2, t)
  const p23 = lerp(p2, p3, t)
  const p012 = lerp(p01, p12, t)
  const p123 = lerp(p12, p23, t)
  const middle = lerp(p012, p123, t)
  return { fromOut: p01, point: { ...middle, in: p012, out: p123, smooth: true }, toIn: p23 }
}
