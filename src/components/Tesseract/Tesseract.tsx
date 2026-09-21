'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '../../lib/cn'
import { tokenRgb, useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { Slider } from '../Slider'
import { Switch } from '../Switch'
import {
  PHI,
  PLANES,
  SHAPES,
  anglesToArray,
  arcWeights,
  arrayToAngles,
  fitRadius,
  polytope,
  project,
  rotateAll,
  rotationMatrix,
  type Camera,
  type TesseractAngles,
  type TesseractPlane,
  type TesseractProjection,
  type TesseractShape,
} from './polytopes'

export type TesseractTone = 'duo' | 'accent' | 'ink'
/** Which planes a drag turns: the ones through w, or the ordinary 3D ones. */
export type TesseractDragPlanes = '4d' | '3d'

export interface TesseractHandle {
  /** Ease back to the starting orientation and stop any momentum. */
  reset: () => void
  /** Turn to these plane angles, in radians; planes left out keep theirs. Eases unless `instant` or under reduced motion. */
  setRotation: (angles: Partial<TesseractAngles>, instant?: boolean) => void
  /** The current plane angles, in radians. */
  getRotation: () => TesseractAngles
}

export interface TesseractProps {
  /** Which regular 4-polytope to draw. The built-in control can change it; `onShapeChange` reports that. */
  shape?: TesseractShape
  /** Called when the built-in shape control picks another polytope. */
  onShapeChange?: (shape: TesseractShape) => void
  /** 4D → 3D projection: a perspective eye on the w axis, or stereographic from the 3-sphere's pole, which bends edges into arcs. */
  projection?: TesseractProjection
  /** Called when the built-in projection control changes. */
  onProjectionChange?: (projection: TesseractProjection) => void
  /** Controlled orientation, radians per plane. When set, the component draws exactly this and reports turns through `onRotationChange`. */
  rotation?: Partial<TesseractAngles>
  /** Uncontrolled starting orientation, radians per plane. Planes left out take the built-in three-quarter view. */
  defaultRotation?: Partial<TesseractAngles>
  /** Called when a drag, key, wheel or slider turns it. Not called for the automatic spin. */
  onRotationChange?: (angles: TesseractAngles) => void
  /** Spin speed per plane, radians per second. Defaults to xw and yw in the golden ratio, plus a slow xz drift. */
  spin?: Partial<TesseractAngles>
  /** Spin on its own. Ignored under reduced motion and when `rotation` is controlled. */
  autoRotate?: boolean
  /** Freeze the spin and any momentum. Dragging still turns it. */
  paused?: boolean
  /** Perspective only: distance of the 4D eye along w, in circumradii (above 1). Closer exaggerates it — the inner cell shrinks. */
  eye?: number
  /** Fill the 2-faces (the squares of the tesseract's eight cubes, and so on) as translucent polygons, sorted back to front. */
  cells?: boolean
  /** Draw a dot on every vertex, sized by nearness in w. */
  vertices?: boolean
  /** Drag, arrow keys and (while focused) the wheel turn it. */
  interactive?: boolean
  /** What a plain drag turns. Shift swaps to the other pair while held. */
  dragPlanes?: TesseractDragPlanes
  /** Edge colour: ink far in w blending to accent near (`duo`), or a single token. */
  tone?: TesseractTone
  /** Maximum width in pixels. The view is square and fills its container up to this. */
  size?: number
  /** Show the shape, projection and display controls, and the per-plane sliders whenever it is still. */
  controls?: boolean
  /** Accessible name, followed by a generated description of the shape and its orientation. An empty string makes the picture decorative. */
  label?: string
  className?: string
}

/**
 * The still frame, and where reset returns to: turned a little way out of w so the
 * inner cell sits off-centre inside the outer one and no two edges coincide, and
 * tilted in xz and yz so the view is three-quarter rather than face-on.
 */
const DEFAULT_ROTATION: TesseractAngles = { xy: 0, xz: 0.52, xw: 0.46, yz: 0.34, yw: 0.27, zw: 0.12 }

/**
 * xw and yw in the golden ratio, so the two turns never fall back into step and the
 * motion does not visibly repeat; the slow xz drift moves the viewpoint round.
 */
const DEFAULT_SPIN: Partial<TesseractAngles> = { xw: 0.34, yw: 0.34 / PHI, xz: 0.045 }

/** Indices into the angle arrays, in PLANES order (xy is 0). */
const [XZ, XW, YZ, YW, ZW] = [1, 2, 3, 4, 5]

/** Depth bands: edges are sorted into this many steps of nearness in w and each band is one path. */
const BANDS = 14

/** Line width and dot radius at 480 px, per shape: fewer edges can carry heavier lines. */
const WEIGHT: Record<TesseractShape, { line: number; dot: number; glow: boolean }> = {
  '5-cell': { line: 2.4, dot: 3.4, glow: true },
  tesseract: { line: 2.2, dot: 3.1, glow: true },
  '16-cell': { line: 2, dot: 3.2, glow: true },
  '24-cell': { line: 1.6, dot: 2.6, glow: true },
  '120-cell': { line: 0.85, dot: 1.1, glow: false },
  '600-cell': { line: 1, dot: 1.7, glow: false },
}

const SHAPE_LABEL: Record<TesseractShape, string> = {
  '5-cell': '5-cell',
  tesseract: 'Tesseract',
  '16-cell': '16-cell',
  '24-cell': '24-cell',
  '120-cell': '120-cell',
  '600-cell': '600-cell',
}

const degrees = (radians: number) => {
  const d = Math.round((radians * 180) / Math.PI) % 360
  return d > 180 ? d - 360 : d <= -180 ? d + 360 : d
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** State that follows a prop when the prop changes, and can be changed from inside otherwise. */
function useFollowing<T>(value: T): [T, (next: T) => void] {
  const [state, setState] = useState(value)
  const [seen, setSeen] = useState(value)
  if (!Object.is(seen, value)) {
    setSeen(value)
    setState(value)
  }
  return [state, setState]
}

/**
 * A regular 4-polytope — the tesseract by default — turning in four dimensions.
 *
 * This is real 4D geometry, not a CSS cube. The vertices are the textbook
 * coordinates of each polytope on the unit 3-sphere; the orientation is an angle
 * in each of the six planes of 4-space, composed into a 4×4 rotation matrix; and
 * the picture is two projections in a row — 4D to 3D, by a perspective divide from
 * an eye out on the w axis or stereographically from the 3-sphere's pole, then 3D
 * to 2D by an ordinary camera. Turning in xw is what makes the small inner cube
 * swell out through the big outer one: they are the same size, one is simply
 * nearer the 4D eye.
 *
 * Depth in the fourth dimension is the one thing a picture cannot show directly,
 * so it is carried by the lines: edges near the 4D eye are thicker, more opaque and
 * (in the duo tone) accent-coloured; edges far away are thin, faint and ink. Edges
 * are sorted into depth bands and drawn far to near, one path per band, so the
 * 1,200 edges of the 120-cell still cost a handful of canvas calls.
 *
 * Drag turns it with momentum; arrow keys, the wheel (once focused) and, whenever
 * it is still, one slider per plane turn it too. Under reduced motion it never
 * spins on its own: it holds a three-quarter still and the sliders turn it by hand.
 */
export const Tesseract = forwardRef<TesseractHandle, TesseractProps>(function Tesseract(
  {
    shape: shapeProp = 'tesseract',
    onShapeChange,
    projection: projectionProp = 'perspective',
    onProjectionChange,
    rotation,
    defaultRotation,
    onRotationChange,
    spin = DEFAULT_SPIN,
    autoRotate = true,
    paused = false,
    eye = 1.8,
    cells: cellsProp = false,
    vertices: verticesProp = true,
    interactive = true,
    dragPlanes: dragPlanesProp = '4d',
    tone = 'duo',
    size = 480,
    controls = true,
    label = 'Four-dimensional polytope',
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const hintId = useId()
  const [shape, setShape] = useFollowing(shapeProp)
  const [projection, setProjection] = useFollowing(projectionProp)
  const [cells, setCells] = useFollowing(cellsProp)
  const [showVertices, setShowVertices] = useFollowing(verticesProp)
  const [dragPlanes, setDragPlanes] = useFollowing(dragPlanesProp)
  const [held, setHeld] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const poly = useMemo(() => polytope(shape), [shape])
  const controlled = rotation !== undefined
  const spinArray = anglesToArray(spin)
  const spinning = autoRotate && !paused && !held && !reduced && !controlled && spinArray.some((v) => v !== 0)
  const eyeDistance = Math.max(1.15, eye)

  const start = useMemo(() => anglesToArray({ ...DEFAULT_ROTATION, ...defaultRotation }), [defaultRotation])
  const [snapshot, setSnapshot] = useState<TesseractAngles>(() => arrayToAngles(anglesToArray({ ...DEFAULT_ROTATION, ...defaultRotation })))

  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sim = useRef({
    angles: anglesToArray({ ...DEFAULT_ROTATION, ...defaultRotation }),
    target: null as Float64Array | null,
    velocity: new Float64Array(6),
    matrix: new Float64Array(16),
    rotated: new Float64Array(0),
    screen: new Float64Array(0),
    valid: new Uint8Array(0),
    edgeOrder: new Uint32Array(0),
    faceOrder: [] as number[],
    faceDepth: new Float64Array(0),
    point: new Float64Array(3),
    strokes: [] as string[],
    glows: [] as string[],
    fills: [] as string[],
    cssWidth: 0,
    ratio: 1,
    visible: true,
    frame: 0,
    last: 0,
    lastSync: 0,
    synced: anglesToArray({ ...DEFAULT_ROTATION, ...defaultRotation }),
    poly: null as ReturnType<typeof polytope> | null,
    drag: null as null | { id: number; x: number; y: number; time: number; h: number; v: number; vh: number; vv: number },
  })

  const live = useRef({ poly, projection, eyeDistance, cells, showVertices, spinning, spinArray, controlled, reduced, rotation, onRotationChange, interactive })
  live.current = { poly, projection, eyeDistance, cells, showVertices, spinning, spinArray, controlled, reduced, rotation, onRotationChange, interactive }

  // Keep the controlled angles in the simulation; the draw on the next frame picks them up.
  if (controlled) anglesToArray({ ...DEFAULT_ROTATION, ...rotation }, sim.current.angles)

  /* ------------------------------------------------------------ drawing */

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const s = sim.current
    const L = live.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !canvas.width || !s.strokes.length) return
    const P = L.poly
    const V = P.vertexCount
    if (s.poly !== P) {
      s.poly = P
      s.rotated = new Float64Array(V * 4)
      s.screen = new Float64Array(V * 3)
      s.valid = new Uint8Array(V)
      s.edgeOrder = new Uint32Array(P.edgeCount)
      s.faceDepth = new Float64Array(P.faceCount)
      s.faceOrder = Array.from({ length: P.faceCount }, (_, i) => i)
    }
    const W = canvas.width
    const H = canvas.height
    context.clearRect(0, 0, W, H)
    context.lineCap = 'round'
    context.lineJoin = 'round'

    rotationMatrix(s.angles, s.matrix)
    rotateAll(s.matrix, P.positions, s.rotated)
    const camera: Camera = {
      projection: L.projection,
      eye: L.eyeDistance,
      distance: 5,
      scale: (Math.min(W, H) / 2) * 0.82 / fitRadius(L.projection, L.eyeDistance, 5),
      cx: W / 2,
      cy: H / 2,
    }
    const r = s.rotated
    const screen = s.screen
    for (let v = 0; v < V; v++) s.valid[v] = project(r[v * 4], r[v * 4 + 1], r[v * 4 + 2], r[v * 4 + 3], camera, screen, v * 3) ? 1 : 0

    // Nearness in w, 0 (far side of the 3-sphere from the 4D eye) to 1 (the side facing it).
    const nearness = (w: number) => clamp01((w + 1) / 2)
    const band = (w: number) => Math.min(BANDS - 1, (nearness(w) * BANDS) | 0)
    const { steps, from, to } = arcWeights(P.arc, L.projection)
    const point = s.point
    const scaleFactor = Math.min(1.4, Math.max(0.6, s.cssWidth / 480)) * s.ratio
    const weight = WEIGHT[P.shape]

    /** Adds the edge a→b to the current path, as a straight segment or a sampled arc broken where it leaves the picture. */
    const traceEdge = (a: number, b: number, joined: boolean) => {
      if (steps === 1) {
        if (!s.valid[a] || !s.valid[b]) return false
        if (joined) context.lineTo(screen[a * 3], screen[a * 3 + 1])
        else context.moveTo(screen[a * 3], screen[a * 3 + 1])
        context.lineTo(screen[b * 3], screen[b * 3 + 1])
        return true
      }
      let pen = joined
      let whole = true
      for (let k = 0; k <= steps; k++) {
        const f = from[k]
        const t = to[k]
        const ok = project(
          f * r[a * 4] + t * r[b * 4],
          f * r[a * 4 + 1] + t * r[b * 4 + 1],
          f * r[a * 4 + 2] + t * r[b * 4 + 2],
          f * r[a * 4 + 3] + t * r[b * 4 + 3],
          camera,
          point,
          0,
        )
        if (!ok) {
          pen = false
          whole = false
          continue
        }
        if (pen) context.lineTo(point[0], point[1])
        else context.moveTo(point[0], point[1])
        pen = true
      }
      return whole
    }

    // Faces first, beneath the edges, painted from the back of the 3D view to the front.
    if (L.cells) {
      const n = P.faceSize
      const faces = P.faces
      for (let f = 0; f < P.faceCount; f++) {
        let depth = 0
        for (let k = 0; k < n; k++) depth += screen[faces[f * n + k] * 3 + 2]
        s.faceDepth[f] = depth
      }
      s.faceOrder.sort((a, b) => s.faceDepth[a] - s.faceDepth[b])
      for (const f of s.faceOrder) {
        let w = 0
        let ok = true
        for (let k = 0; k < n; k++) {
          const v = faces[f * n + k]
          w += r[v * 4 + 3]
          if (!s.valid[v]) ok = false
        }
        if (!ok) continue
        context.beginPath()
        for (let k = 0; k < n && ok; k++) ok = traceEdge(faces[f * n + k], faces[f * n + ((k + 1) % n)], k > 0)
        if (!ok) continue
        context.closePath()
        context.fillStyle = s.fills[band(w / n)]
        context.fill()
      }
    }

    // Edges, bucketed by nearness in w with a counting sort, drawn far to near.
    const edges = P.edges
    const counts = new Uint32Array(BANDS + 1)
    const bandOf = new Uint8Array(P.edgeCount)
    for (let e = 0; e < P.edgeCount; e++) {
      const b = band((r[edges[e * 2] * 4 + 3] + r[edges[e * 2 + 1] * 4 + 3]) / 2)
      bandOf[e] = b
      counts[b + 1]++
    }
    for (let b = 0; b < BANDS; b++) counts[b + 1] += counts[b]
    const cursor = counts.slice()
    for (let e = 0; e < P.edgeCount; e++) s.edgeOrder[cursor[bandOf[e]]++] = e
    for (let b = 0; b < BANDS; b++) {
      if (counts[b] === counts[b + 1]) continue
      const t = (b + 0.5) / BANDS
      context.beginPath()
      for (let i = counts[b]; i < counts[b + 1]; i++) {
        const e = s.edgeOrder[i]
        traceEdge(edges[e * 2], edges[e * 2 + 1], false)
      }
      const width = weight.line * (0.35 + 1.3 * t * t) * scaleFactor
      if (weight.glow && t > 0.5) {
        // A wide, faint pass under the nearest edges: a little bloom where the eye is.
        context.strokeStyle = s.glows[b]
        context.lineWidth = width * 4
        context.stroke()
      }
      context.strokeStyle = s.strokes[b]
      context.lineWidth = width
      context.stroke()
    }

    if (L.showVertices) {
      for (let b = 0; b < BANDS; b++) {
        const t = (b + 0.5) / BANDS
        const radius = weight.dot * (0.45 + 0.9 * t) * scaleFactor
        context.beginPath()
        let any = false
        for (let v = 0; v < V; v++) {
          if (!s.valid[v] || band(r[v * 4 + 3]) !== b) continue
          context.moveTo(screen[v * 3] + radius, screen[v * 3 + 1])
          context.arc(screen[v * 3], screen[v * 3 + 1], radius, 0, Math.PI * 2)
          any = true
        }
        if (!any) continue
        context.fillStyle = s.strokes[b]
        context.fill()
      }
    }
  }, [])

  /* ------------------------------------------------------------ loop */

  /**
   * Copies the angles into React state for the sliders and the label, at most every
   * 120 ms unless forced — and never when nothing moved, because a render wakes the
   * loop for one frame and that frame ends here.
   */
  const syncSnapshot = useCallback((force = false) => {
    const s = sim.current
    const now = typeof performance === 'undefined' ? Date.now() : performance.now()
    if (!force && now - s.lastSync < 120) return
    let same = true
    for (let i = 0; i < 6; i++) if (Math.abs(s.synced[i] - s.angles[i]) > 1e-6) same = false
    if (same) return
    s.lastSync = now
    s.synced.set(s.angles)
    setSnapshot(arrayToAngles(s.angles))
  }, [])

  /** Spin, momentum and easing for one step. Returns whether anything is still moving. */
  const advance = useCallback((dt: number) => {
    const s = sim.current
    const L = live.current
    if (L.controlled) return false
    // A held drag is not motion: each pointer move asks for its own frame.
    let moving = L.spinning
    const { angles, velocity } = s
    for (let i = 0; i < 6; i++) {
      if (L.spinning) {
        angles[i] += L.spinArray[i] * dt
        if (s.target) s.target[i] += L.spinArray[i] * dt
      }
      if (velocity[i] !== 0 && !s.drag) {
        angles[i] += velocity[i] * dt
        velocity[i] *= Math.exp(-dt * 1.7)
        if (Math.abs(velocity[i]) < 0.004) velocity[i] = 0
        else moving = true
      }
    }
    if (s.target) {
      const ease = 1 - Math.exp(-dt * 8)
      let settled = true
      for (let i = 0; i < 6; i++) {
        const gap = s.target[i] - angles[i]
        angles[i] += gap * ease
        if (Math.abs(gap) > 2e-4) settled = false
      }
      if (settled) {
        angles.set(s.target)
        s.target = null
      } else moving = true
    }
    // Keep the numbers small; the target moves by the same whole turn so easing is unaffected.
    for (let i = 0; i < 6; i++) {
      const turns = Math.round(angles[i] / (Math.PI * 2))
      if (turns) {
        angles[i] -= turns * Math.PI * 2
        if (s.target) s.target[i] -= turns * Math.PI * 2
      }
    }
    return moving
  }, [])

  const wake = useRef<() => void>(() => {})

  useEffect(() => {
    const s = sim.current
    const tick = (now: number) => {
      s.frame = 0
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60
      const moving = advance(dt)
      draw()
      if (moving && s.visible && !document.hidden) {
        s.last = now
        s.frame = requestAnimationFrame(tick)
      } else {
        s.last = 0
        if (!live.current.spinning && !live.current.controlled) syncSnapshot(true)
      }
    }
    wake.current = () => {
      if (!s.frame && typeof requestAnimationFrame !== 'undefined') s.frame = requestAnimationFrame(tick)
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = entry.isIntersecting
            wake.current()
          })
    if (frameRef.current) observer?.observe(frameRef.current)
    const onVisibility = () => wake.current()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      if (s.frame) cancelAnimationFrame(s.frame)
      s.frame = 0
      wake.current = () => {}
    }
  }, [advance, draw, syncSnapshot])

  // Any change of shape, projection, display or controlled angle is one more frame; the loop decides whether to keep going.
  useEffect(() => wake.current())

  // Canvas size.
  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    if (!canvas || !frame) return
    const resize = () => {
      const s = sim.current
      s.ratio = Math.min(2, window.devicePixelRatio || 1)
      s.cssWidth = frame.clientWidth
      const side = Math.round(frame.clientWidth * s.ratio)
      if (side > 0 && canvas.width !== side) canvas.width = canvas.height = side
      wake.current()
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(frame)
    return () => observer?.disconnect()
  }, [])

  // Colours: every band's stroke, glow and fill, re-read from the tokens when the theme or accent changes.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const ink = tokenRgb(frame, '--color-ink', [40, 40, 40])
    const accent = tokenRgb(frame, '--color-accent', [120, 120, 120])
    const s = sim.current
    // Fewer, larger faces can carry more fill; the 600-cell's 1,200 triangles at full alpha would be a solid mass.
    const density = Math.min(1, Math.sqrt(24 / poly.faceCount))
    s.strokes = []
    s.glows = []
    s.fills = []
    for (let b = 0; b < BANDS; b++) {
      const t = (b + 0.5) / BANDS
      const mix = tone === 'duo' ? t * t * (3 - 2 * t) : tone === 'accent' ? 1 : 0
      const [red, green, blue] = [0, 1, 2].map((c) => Math.round(ink[c] + (accent[c] - ink[c]) * mix))
      const rgb = `${red},${green},${blue}`
      s.strokes.push(`rgba(${rgb},${(0.12 + 0.88 * Math.pow(t, 1.5)).toFixed(3)})`)
      s.glows.push(`rgba(${rgb},${(0.14 * (t - 0.5) * 2).toFixed(3)})`)
      s.fills.push(`rgba(${rgb},${((0.025 + 0.12 * t) * density).toFixed(3)})`)
    }
    wake.current()
  }, [tone, themeVersion, poly])

  /* ------------------------------------------------------------ turning */

  const report = () => {
    const L = live.current
    L.onRotationChange?.(arrayToAngles(sim.current.angles))
    if (!L.spinning && !L.controlled) syncSnapshot()
    wake.current()
  }

  /** Turns by `delta` radians in each listed plane, at once. */
  const turn = (deltas: [number, number][]) => {
    const s = sim.current
    for (const [plane, delta] of deltas) {
      s.angles[plane] += delta
      if (s.target) s.target[plane] += delta
    }
    report()
  }

  /** A keyboard step: eased when motion is welcome, immediate otherwise. */
  const nudge = (plane: number, delta: number) => {
    const s = sim.current
    const L = live.current
    s.velocity[plane] = 0
    if (L.reduced || L.controlled) {
      turn([[plane, delta]])
      return degrees(s.angles[plane])
    }
    s.target = s.target ?? Float64Array.from(s.angles)
    s.target[plane] += delta
    L.onRotationChange?.(arrayToAngles(s.target))
    wake.current()
    return degrees(s.target[plane])
  }

  const setRotation = useCallback(
    (angles: Partial<TesseractAngles>, instant = false) => {
      const s = sim.current
      const L = live.current
      const next = Float64Array.from(s.target ?? s.angles)
      PLANES.forEach((plane, i) => {
        const value = angles[plane]
        if (value === undefined) return
        // The shortest way round to the requested angle.
        next[i] = s.angles[i] + Math.atan2(Math.sin(value - s.angles[i]), Math.cos(value - s.angles[i]))
      })
      s.velocity.fill(0)
      if (L.controlled) {
        L.onRotationChange?.(arrayToAngles(next))
        return
      }
      if (instant || L.reduced) {
        s.angles.set(next)
        s.target = null
        syncSnapshot(true)
      } else s.target = next
      L.onRotationChange?.(arrayToAngles(next))
      wake.current()
    },
    [syncSnapshot],
  )

  const reset = useCallback(() => setRotation(arrayToAngles(start)), [setRotation, start])

  useImperativeHandle(ref, () => ({ reset, setRotation, getRotation: () => arrayToAngles(sim.current.angles) }), [reset, setRotation])

  /* ------------------------------------------------------------ pointer, wheel, keys */

  const dragAxes = (shift: boolean): [number, number] => ((dragPlanes === '4d') !== shift ? [XW, YW] : [XZ, YZ])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button > 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const s = sim.current
    const [h, v] = dragAxes(event.shiftKey)
    s.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, h, v, vh: 0, vv: 0 }
    s.velocity.fill(0)
    s.target = null
    wake.current()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sim.current.drag
    if (!drag || drag.id !== event.pointerId) return
    const [h, v] = dragAxes(event.shiftKey)
    // A drag across the whole width is half a turn. Right and down move the near side with the pointer.
    const k = Math.PI / Math.max(120, event.currentTarget.clientWidth)
    const dh = -(event.clientX - drag.x) * k
    const dv = (event.clientY - drag.y) * k
    const elapsed = Math.max(1, event.timeStamp - drag.time) / 1000
    drag.vh = h === drag.h ? drag.vh * 0.4 + (dh / elapsed) * 0.6 : dh / elapsed
    drag.vv = v === drag.v ? drag.vv * 0.4 + (dv / elapsed) * 0.6 : dv / elapsed
    Object.assign(drag, { x: event.clientX, y: event.clientY, time: event.timeStamp, h, v })
    turn([
      [h, dh],
      [v, dv],
    ])
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = sim.current
    const drag = s.drag
    if (!drag || drag.id !== event.pointerId) return
    s.drag = null
    // A release while still moving throws it; a pause before letting go does not.
    if (!reduced && !controlled && event.timeStamp - drag.time < 90) {
      s.velocity[drag.h] = Math.max(-7, Math.min(7, drag.vh))
      s.velocity[drag.v] = Math.max(-7, Math.min(7, drag.vv))
    }
    wake.current()
  }

  // The wheel turns zw only once the view has focus, so scrolling past it on a long page still scrolls the page.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (event: WheelEvent) => {
      if (!live.current.interactive || document.activeElement !== frame) return
      event.preventDefault()
      const px = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      const delta = -px * 0.004
      const L = live.current
      if (L.reduced || L.controlled) turn([[ZW, delta]])
      else {
        const s = sim.current
        s.velocity[ZW] = Math.max(-7, Math.min(7, s.velocity[ZW] + delta * 6))
        wake.current()
      }
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = Math.PI / 12
    const w = event.shiftKey
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [w ? XW : XZ, step],
      ArrowRight: [w ? XW : XZ, -step],
      ArrowUp: [w ? YW : YZ, -step],
      ArrowDown: [w ? YW : YZ, step],
      PageUp: [ZW, step],
      PageDown: [ZW, -step],
    }
    const hit = keys[event.key]
    if (hit) {
      const [plane, delta] = hit
      const now = nudge(plane, delta)
      setAnnouncement(`${PLANES[plane]} plane, ${now} degrees`)
    } else if (event.key === 'Home') {
      reset()
      setAnnouncement('Back to the starting orientation')
    } else if (event.key === ' ' && autoRotate && !reduced && !controlled && !paused) {
      setHeld((value) => !value)
      setAnnouncement(held ? 'Spinning' : 'Spin paused')
    } else return
    event.preventDefault()
  }

  /* ------------------------------------------------------------ announcements */

  const firstShape = useRef(true)
  useEffect(() => {
    if (firstShape.current) {
      firstShape.current = false
      return
    }
    setAnnouncement(`${poly.name} ${poly.schlafli}: ${poly.vertexCount} vertices, ${poly.edgeCount} edges, ${poly.cells} ${poly.cell} cells`)
  }, [poly])

  /* ------------------------------------------------------------ view */

  const shown = controlled ? { ...DEFAULT_ROTATION, ...rotation } : snapshot
  const spinPlanes = PLANES.filter((_, i) => spinArray[i] !== 0)
  const orientation = spinning
    ? `turning in the ${spinPlanes.join(', ')} plane${spinPlanes.length === 1 ? '' : 's'}`
    : `turned ${PLANES.filter((plane) => degrees(shown[plane]) !== 0)
        .map((plane) => `${degrees(shown[plane])}° in ${plane}`)
        .join(', ') || 'to face straight on'}`
  const summary = `${poly.name} ${poly.schlafli}: ${poly.vertexCount} vertices, ${poly.edgeCount} edges, ${poly.faceCount} ${poly.face} faces and ${poly.cells} ${poly.cell} cells, in ${projection} projection, ${orientation}.`
  const decorative = label === ''
  const legend =
    tone === 'duo'
      ? 'linear-gradient(to right, color-mix(in oklab, var(--color-ink) 15%, transparent), var(--color-accent))'
      : `linear-gradient(to right, color-mix(in oklab, var(${tone === 'accent' ? '--color-accent' : '--color-ink'}) 15%, transparent), var(${tone === 'accent' ? '--color-accent' : '--color-ink'}))`

  const setShapeFrom = (next: TesseractShape) => {
    setShape(next)
    onShapeChange?.(next)
  }
  const setProjectionFrom = (next: TesseractProjection) => {
    setProjection(next)
    onProjectionChange?.(next)
    setAnnouncement(next === 'stereographic' ? 'Stereographic projection: edges bend into arcs' : 'Perspective projection')
  }

  const setPlane = (plane: TesseractPlane, value: number) => {
    const s = sim.current
    const i = PLANES.indexOf(plane)
    s.velocity[i] = 0
    if (s.target) s.target[i] = value
    s.angles[i] = value
    report()
    if (!controlled) syncSnapshot(true)
  }

  return (
    <div className={cn('flex w-full flex-col gap-4', className)} style={{ maxWidth: size }}>
      <div
        ref={frameRef}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'group' : undefined}
        aria-roledescription={interactive ? 'rotatable 4D view' : undefined}
        aria-label={interactive ? (decorative ? poly.name : label) : undefined}
        aria-describedby={interactive ? hintId : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'relative isolate aspect-square w-full select-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]',
          'bg-[radial-gradient(90%_80%_at_50%_45%,color-mix(in_oklab,var(--color-accent)_7%,transparent),transparent_70%)]',
          interactive && 'cursor-grab touch-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:cursor-grabbing',
        )}
      >
        {interactive ? (
          <span id={hintId} className="sr-only">
            Drag to turn it: sideways turns the {dragPlanes === '4d' ? 'xw' : 'xz'} plane, up and down the {dragPlanes === '4d' ? 'yw' : 'yz'} plane,
            and holding Shift swaps to the {dragPlanes === '4d' ? '3D' : '4D'} planes. Arrow keys turn xz and yz; with Shift, xw and yw. Page Up and
            Page Down turn zw, as does the scroll wheel once this view has focus. Home goes back to the start.
            {spinning ? ' Space pauses the spin.' : ''}
          </span>
        ) : null}
        <canvas
          ref={canvasRef}
          role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : `${label}. ${summary}`}
          aria-hidden={decorative || undefined}
          className="absolute inset-0 size-full"
        />
        <div aria-hidden="true" className="pointer-events-none absolute left-4 top-3.5 flex flex-col gap-0.5">
          <span className="text-[13px] font-bold text-ink">{poly.name}</span>
          <span className="font-mono text-[11px] tabular-nums text-ink-faint">
            {poly.schlafli} · {poly.vertexCount}V {poly.edgeCount}E {poly.faceCount}F {poly.cells}C
          </span>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-3.5 left-4 flex items-center gap-2 font-mono text-[11px] text-ink-faint">
          <span>far</span>
          <span className="h-1.5 w-16 rounded-full" style={{ background: legend }} />
          <span>near in w</span>
        </div>
      </div>

      {controls ? (
        <div className="flex flex-col gap-3">
          <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
            <SegmentedControl
              label="Polytope"
              size="sm"
              value={shape}
              onValueChange={setShapeFrom}
              options={SHAPES.map((value) => ({ value, label: SHAPE_LABEL[value] }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Projection"
              size="sm"
              value={projection}
              onValueChange={setProjectionFrom}
              options={[
                { value: 'perspective', label: 'Perspective' },
                { value: 'stereographic', label: 'Stereographic' },
              ]}
            />
            {interactive ? (
              <SegmentedControl
                label="Drag turns"
                size="sm"
                value={dragPlanes}
                onValueChange={setDragPlanes}
                options={[
                  { value: '4d', label: 'xw · yw' },
                  { value: '3d', label: 'xz · yz' },
                ]}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={cells} onChange={(event) => setCells(event.target.checked)} />
              Faces
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={showVertices} onChange={(event) => setShowVertices(event.target.checked)} />
              Vertices
            </label>
            <div className="ml-auto flex gap-2">
              {autoRotate && !reduced && !controlled && !paused ? (
                <Button size="sm" variant="outline" onClick={() => setHeld((value) => !value)} className="min-w-[72px]">
                  {held ? 'Spin' : 'Pause'}
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>
          {!spinning ? (
            <fieldset className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <legend className="mb-2 text-[12px] font-semibold text-ink-soft">Turn by hand</legend>
              {PLANES.map((plane) => (
                <label key={plane} className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-[12px] font-semibold text-ink-soft">
                    {plane}
                    <span className="font-mono font-normal tabular-nums text-ink-faint">{degrees(shown[plane])}°</span>
                  </span>
                  <Slider
                    min={-180}
                    max={180}
                    value={degrees(shown[plane])}
                    aria-valuetext={`${degrees(shown[plane])} degrees in the ${plane} plane`}
                    onChange={(event) => setPlane(plane, (Number(event.target.value) * Math.PI) / 180)}
                  />
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
})
