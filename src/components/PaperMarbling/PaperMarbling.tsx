'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '../../lib/cn'
import { useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import type { IconComponent } from '../../lib/types'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { Slider } from '../Slider'
import {
  applyOp,
  cloneInks,
  PATTERN_NAMES,
  recipeFor,
  replay,
  type Bath,
  type Ink,
  type MarbleOp,
  type MarbleTine,
  type PaperMarblingPattern,
} from './marbling'

export type PaperMarblingStatus = 'playing' | 'ready'

export interface PaperMarblingHandle {
  /** Drop ink at (x, y), each 0–1 across and down the paper. Defaults to the centre, the current size and colour. */
  drop(x?: number, y?: number, options?: { radius?: number; color?: number }): void
  /** Draw a tine from (x0, y0) towards (x1, y1), in the same 0–1 coordinates; the length is the shift. */
  comb(x0: number, y0: number, x1: number, y1: number, options?: { spacing?: number; decay?: number; amplitude?: number; wavelength?: number }): void
  /** Take back the last operation. */
  undo(): void
  /** Empty the bath. */
  reset(): void
  /** Empty the bath and make the current pattern from its recipe. */
  play(): void
  /** The paper as a PNG, or null where the canvas cannot be read. */
  toBlob(): Promise<Blob | null>
}

export interface PaperMarblingProps {
  /** Ink colours: CSS colours or tokens, or `'accent'` for four inks mixed from the accent and the ink token. */
  palette?: 'accent' | string[]
  /** Controlled drop radius, as a fraction of the paper’s height. */
  dropSize?: number
  /** Uncontrolled starting drop radius. */
  defaultDropSize?: number
  /** Called when the drop-size slider moves. */
  onDropSizeChange?: (size: number) => void
  /** Controlled pattern. Changing it empties the bath and makes the new pattern from its recipe. */
  pattern?: PaperMarblingPattern
  /** Uncontrolled starting pattern. */
  defaultPattern?: PaperMarblingPattern
  /** Called when the pattern control changes. */
  onPatternChange?: (pattern: PaperMarblingPattern) => void
  /** Play the recipe step by step when the paper first scrolls into view. Off, the finished pattern is shown at once. */
  autoplay?: boolean
  /** Hold the recipe where it is. Clicks and drags still work. */
  paused?: boolean
  /** Recipe playback speed. 1 makes a bouquet in about ten seconds. */
  speed?: number
  /** Width over height of the paper. */
  aspectRatio?: number
  /** Show the recipe, ink, size and edit controls. */
  controls?: boolean
  /** Accessible name. The canvas is described with the pattern and its operations; without a label it is decorative. */
  label?: string
  /** Called when a recipe starts playing and when it ends or is stopped. */
  onStatusChange?: (status: PaperMarblingStatus) => void
  /** Merged last, so it wins. */
  className?: string
}

const ACCENT_INKS = [
  'var(--color-accent)',
  'color-mix(in oklab, var(--color-accent) 50%, var(--color-ink))',
  'var(--color-ink)',
  'color-mix(in oklab, var(--color-accent) 38%, var(--color-surface))',
]
const ACCENT_NAMES = ['Accent', 'Deep', 'Ink', 'Pale']

const PATTERN_OPTIONS: { value: PaperMarblingPattern; label: string }[] = [
  { value: 'stone', label: 'Stone' },
  { value: 'gel-git', label: 'Gel-git' },
  { value: 'nonpareil', label: 'Nonpareil' },
  { value: 'bouquet', label: 'Bouquet' },
  { value: 'free', label: 'Freehand' },
]

// The stylus a freehand drag draws with: a wake about half a small drop wide.
const STYLUS = { spacing: 0.05, decay: 0.28 }

// Drops spread out fast and settle; a tine is drawn at an even pace. Seconds at speed 1.
const DURATION = { drop: 0.3, tine: 0.2 }

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

/**
 * Resolve any CSS colour — a token, `var()`, `color-mix()` — to the string the
 * browser computes for it, by letting the host element compute it. Canvas
 * `fillStyle` cannot read custom properties, and asking the element keeps
 * scoped themes working.
 */
function resolveColour(host: HTMLElement, value: string): string {
  const previous = host.style.color
  host.style.color = value
  const computed = getComputedStyle(host).color
  host.style.color = previous
  return computed
}

const count = (ops: readonly MarbleOp[]) => {
  let drops = 0
  for (const op of ops) if (op.kind === 'drop') drops++
  return { drops, tines: ops.length - drops }
}

/**
 * Ebru — Turkish paper marbling — done with Aubrey Jaffer’s closed-form maps.
 *
 * Nothing is painted. The bath holds closed polygons of ink, and each thing a
 * marbler does is a map applied to every vertex already there: a drop pushes
 * all ink outwards by the area-preserving circle map, a tine drags it along a
 * wake that decays as λ^(d/α). Polygons are subdivided wherever an edge
 * stretches, and filled oldest first with a slight feathered edge. See
 * `marbling.ts` for the maths.
 *
 * The operation list, not the polygons, is the state. Every operator is exact
 * and cheap, so undo is `ops.pop()` and a replay from an empty bath, and a
 * resize is the same replay onto a bath of the new shape — no snapshots, no
 * inverse maps, and no drift from repeatedly editing the geometry. An
 * operation in progress is shown by re-applying a partial copy of it (a smaller
 * drop, a shorter stroke) to the settled bath each frame.
 *
 * A recipe plays a historical pattern — stone, gel-git, nonpareil, bouquet —
 * operation by operation. Clicking drops ink; dragging draws a tine, previewed
 * live. Under reduced motion every operation lands at once and a recipe shows
 * the finished paper; Undo then steps back through it.
 */
export const PaperMarbling = forwardRef<PaperMarblingHandle, PaperMarblingProps>(function PaperMarbling(
  {
    palette = 'accent',
    dropSize: dropSizeProp,
    defaultDropSize = 0.1,
    onDropSizeChange,
    pattern: patternProp,
    defaultPattern = 'bouquet',
    onPatternChange,
    autoplay = true,
    paused = false,
    speed = 1,
    aspectRatio = 1.5,
    controls = true,
    label,
    onStatusChange,
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const [internalPattern, setInternalPattern] = useState(defaultPattern)
  const pattern = patternProp ?? internalPattern
  const [internalSize, setInternalSize] = useState(defaultDropSize)
  const dropSize = dropSizeProp ?? internalSize
  const [colour, setColour] = useState(0)
  const [tally, setTally] = useState({ drops: 0, tines: 0 })
  const [status, setStatus] = useState<PaperMarblingStatus>('ready')
  const [announcement, setAnnouncement] = useState('')

  // Keyed on the colours, not the array, so an inline palette does not re-resolve every render.
  const paletteKey = palette === 'accent' ? 'accent' : palette.join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inks = useMemo(() => (palette === 'accent' || !palette.length ? ACCENT_INKS : palette), [paletteKey])
  const inkNames = palette === 'accent' || !palette.length ? ACCENT_NAMES : inks.map((_, index) => `Ink ${index + 1}`)
  const activeColour = colour % inks.length

  const paperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useRef({
    ops: [] as MarbleOp[],
    base: [] as Ink[],
    bath: { width: aspectRatio, detail: 0.004, budget: 60000 } as Bath,
    queue: [] as MarbleOp[],
    pending: null as { op: MarbleOp; elapsed: number; duration: number; recipe: boolean } | null,
    drag: null as { id: number; x0: number; y0: number; x1: number; y1: number; moved: boolean } | null,
    colours: [] as string[],
    paper: '',
    guide: '',
    seed: 1,
    tooth: 0,
    frame: 0,
    last: 0,
    dirty: false,
    visible: true,
  })
  const live = useRef({ reduced, paused, speed, pattern, dropSize, activeColour, inkCount: inks.length })
  live.current = { reduced, paused, speed, pattern, dropSize, activeColour, inkCount: inks.length }
  const statusCallback = useRef(onStatusChange)
  statusCallback.current = onStatusChange

  const report = useCallback((next: PaperMarblingStatus) => setStatus(next), [])

  // Told after the render that carries the new status, never from inside the
  // state updater: an updater runs during render, and calling a prop from
  // there updates the parent mid-render.
  useEffect(() => {
    statusCallback.current?.(status)
  }, [status])

  /* ------------------------------------------------------------ drawing */

  /** The tine a drag in progress describes. */
  const dragOp = (): MarbleTine | null => {
    const d = engine.current.drag
    if (!d || !d.moved) return null
    const dx = d.x1 - d.x0
    const dy = d.y1 - d.y0
    const length = Math.hypot(dx, dy)
    if (length < 1e-4) return null
    const width = engine.current.bath.width
    return { kind: 'tine', x: d.x0 / width, y: d.y0, dx: dx / length, dy: dy / length, shift: length, ...STYLUS, amplitude: 0, wavelength: 0.3, phase: 0 }
  }

  /** The settled bath, plus whatever operation is in progress, drawn back to front. */
  const render = useCallback((overlay = true) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !canvas.width || !canvas.height) return
    const e = engine.current
    let inks = e.base
    let stroke: MarbleTine | null = null
    let progress = 1
    if (e.pending) {
      const t = Math.min(1, e.pending.elapsed / e.pending.duration)
      progress = e.pending.op.kind === 'drop' ? easeOut(t) : easeInOut(t)
      inks = cloneInks(e.base)
      applyOp(inks, e.pending.op, e.bath, progress)
      if (e.pending.op.kind === 'tine') stroke = e.pending.op
    } else {
      stroke = dragOp()
      if (stroke) {
        inks = cloneInks(e.base)
        applyOp(inks, stroke, e.bath)
      }
    }

    const scale = canvas.height
    context.globalAlpha = 1
    context.fillStyle = e.paper
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.lineJoin = 'round'
    // A hairline of the same ink at partial opacity round every fill: it
    // softens the polygon’s hard edge the way ink bleeds a fibre into paper.
    const feather = Math.max(1, scale / 420)
    for (const ink of inks) {
      const p = ink.pts
      if (p.length < 6) continue
      const colour = e.colours[ink.color % Math.max(1, e.colours.length)]
      if (!colour) continue
      context.beginPath()
      context.moveTo(p[0] * scale, p[1] * scale)
      for (let i = 2; i < p.length; i += 2) context.lineTo(p[i] * scale, p[i + 1] * scale)
      context.closePath()
      context.globalAlpha = 1
      context.fillStyle = colour
      context.fill()
      context.globalAlpha = 0.4
      context.strokeStyle = colour
      context.lineWidth = feather
      context.stroke()
    }

    // The stylus: its line across the bath, and where the ink it started on has got to.
    if (overlay && stroke && e.guide) {
      const bx = stroke.x * e.bath.width * scale
      const by = stroke.y * scale
      const reach = (e.bath.width + 1) * scale
      context.globalAlpha = 0.35
      context.strokeStyle = e.guide
      context.lineWidth = Math.max(1, scale / 360)
      context.setLineDash([scale / 90, scale / 90])
      context.beginPath()
      context.moveTo(bx - stroke.dx * reach, by - stroke.dy * reach)
      context.lineTo(bx + stroke.dx * reach, by + stroke.dy * reach)
      context.stroke()
      context.setLineDash([])
      const tip = stroke.shift * progress * scale
      context.globalAlpha = 0.85
      context.fillStyle = e.guide
      context.beginPath()
      context.arc(bx + stroke.dx * tip, by + stroke.dy * tip, Math.max(2.5, scale / 110), 0, Math.PI * 2)
      context.fill()
    }
    context.globalAlpha = 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ------------------------------------------------------ the operations */

  const sync = () => setTally(count(engine.current.ops))

  const commit = (op: MarbleOp) => {
    const e = engine.current
    e.ops.push(op)
    applyOp(e.base, op, e.bath)
  }

  /** Finish whatever is in progress at once and drop the rest of a recipe. */
  const takeOver = () => {
    const e = engine.current
    if (e.pending) commit(e.pending.op)
    e.pending = null
    const stopped = e.queue.length > 0
    e.queue = []
    if (stopped) setAnnouncement('Recipe stopped.')
    report('ready')
    return stopped
  }

  // `paused` holds the recipe only: an operation the reader started still lands.
  const moving = () => {
    const e = engine.current
    const state = live.current
    if (state.reduced) return false
    return (e.pending !== null && (!state.paused || !e.pending.recipe)) || (!state.paused && e.queue.length > 0)
  }
  const needsFrames = () => engine.current.dirty || moving()

  const tween = (op: MarbleOp, recipe: boolean) => ({
    op,
    elapsed: 0,
    duration: DURATION[op.kind] / Math.max(0.05, live.current.speed),
    recipe,
  })

  const startNext = () => {
    const e = engine.current
    const op = e.queue.shift()
    if (op) e.pending = tween(op, true)
  }

  const tick = useCallback((now: number) => {
    const e = engine.current
    const state = live.current
    e.frame = 0
    const dt = e.last ? Math.min(0.05, (now - e.last) / 1000) : 1 / 60
    e.last = now
    if (!e.pending && e.queue.length && !state.paused) startNext()
    const current = e.pending
    if (current && (!state.paused || !current.recipe)) {
      current.elapsed += dt
      if (current.elapsed >= current.duration) {
        commit(current.op)
        e.pending = null
        sync()
        if (e.queue.length) {
          if (!state.paused) startNext()
        } else if (current.recipe) {
          report('ready')
          setAnnouncement(`${PATTERN_NAMES[state.pattern]} finished.`)
        }
      }
    }
    e.dirty = false
    render()
    if (needsFrames() && e.visible && !document.hidden) e.frame = requestAnimationFrame(tick)
    else e.last = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, report])

  const wake = useCallback(() => {
    const e = engine.current
    if (!e.frame && e.visible && !document.hidden && needsFrames()) e.frame = requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  /** Do one operation: tweened, or at once under reduced motion. */
  const perform = (op: MarbleOp, message: string) => {
    const e = engine.current
    takeOver()
    if (live.current.reduced) {
      commit(op)
      sync()
      render()
    } else {
      e.pending = tween(op, false)
      // Counted as done now: the tween is only the picture catching up.
      setTally(count([...e.ops, op]))
      wake()
    }
    setAnnouncement(message)
  }

  const clear = () => {
    const e = engine.current
    takeOver()
    e.ops = []
    e.base = []
    e.tooth = 0
    sync()
    render()
  }

  /** Land everything outstanding at once, and say so. */
  const flush = () => {
    const e = engine.current
    if (e.pending) commit(e.pending.op)
    e.pending = null
    for (const op of e.queue) commit(op)
    e.queue = []
    sync()
    render()
    report('ready')
  }

  const play = useCallback(() => {
    const e = engine.current
    const state = live.current
    clear()
    const recipe = recipeFor(state.pattern, state.inkCount, e.bath.width, e.seed++)
    if (state.reduced) {
      for (const op of recipe) commit(op)
      sync()
      render()
      setAnnouncement(`${PATTERN_NAMES[state.pattern]}: ${recipe.length} operations, shown finished.`)
      return
    }
    e.queue = recipe
    report('playing')
    setAnnouncement(`Making ${PATTERN_NAMES[state.pattern]}: ${recipe.length} operations.`)
    wake()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, report, wake])

  /** Show the finished pattern at once, without playing it. */
  const finish = useCallback(() => {
    const e = engine.current
    const state = live.current
    e.queue = []
    e.pending = null
    e.ops = recipeFor(state.pattern, state.inkCount, e.bath.width, e.seed++)
    e.base = replay(e.ops, e.bath)
    sync()
    render()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render])

  const drop = (x = 0.5, y = 0.5, options?: { radius?: number; color?: number }) => {
    const state = live.current
    perform(
      { kind: 'drop', x, y, radius: options?.radius ?? state.dropSize, color: options?.color ?? state.activeColour },
      'Ink dropped.',
    )
  }

  const combFrom = (x0: number, y0: number, x1: number, y1: number, options?: { spacing?: number; decay?: number; amplitude?: number; wavelength?: number }) => {
    const width = engine.current.bath.width
    const dx = (x1 - x0) * width
    const dy = y1 - y0
    const length = Math.hypot(dx, dy)
    if (length < 1e-4) return
    perform(
      {
        kind: 'tine',
        x: x0,
        y: y0,
        dx: dx / length,
        dy: dy / length,
        shift: length,
        spacing: options?.spacing ?? STYLUS.spacing,
        decay: options?.decay ?? STYLUS.decay,
        amplitude: options?.amplitude ?? 0,
        wavelength: options?.wavelength ?? 0.3,
        phase: 0,
      },
      'Tine drawn.',
    )
  }

  /** The keyboard’s stylus: each press draws the next stroke of a gel-git, down then up, walking across the bath. */
  const nextTooth = () => {
    const e = engine.current
    const k = e.tooth++
    const teeth = Math.max(3, Math.round(e.bath.width / 0.12))
    const x = ((k % teeth) + 0.5) / teeth
    const down = k % 2 === 0
    combFrom(x, down ? 0.37 : 0.63, x, down ? 0.63 : 0.37, { spacing: 0.05, decay: 0.2 })
  }

  const undo = () => {
    const e = engine.current
    takeOver()
    if (!e.ops.length) return
    // Replay rather than invert: the operators are exact and cheap, so the
    // bath after n − 1 operations is simply recomputed from nothing.
    e.ops.pop()
    e.base = replay(e.ops, e.bath)
    sync()
    render()
    setAnnouncement('Undone.')
  }

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current
      if (!canvas || typeof canvas.toBlob !== 'function' || !canvas.width) return resolve(null)
      render(false)
      try {
        canvas.toBlob((blob) => {
          resolve(blob)
          render()
        }, 'image/png')
      } catch {
        resolve(null)
      }
    })

  const save = async () => {
    const blob = await toBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `marbled-${live.current.pattern}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setAnnouncement('Paper saved as a PNG.')
  }

  useImperativeHandle(ref, () => ({
    drop,
    comb: combFrom,
    undo,
    reset: () => {
      clear()
      setAnnouncement('Bath cleared.')
    },
    play,
    toBlob,
  }))

  /* ------------------------------------------------------------ effects */

  // Ink and paper colours, re-read whenever the theme, accent or palette changes.
  useEffect(() => {
    const paper = paperRef.current
    if (!paper) return
    const e = engine.current
    e.colours = inks.map((value) => resolveColour(paper, value))
    e.paper = resolveColour(paper, 'var(--color-surface)')
    e.guide = resolveColour(paper, 'var(--color-ink)')
    render()
  }, [inks, themeVersion, render])

  // Canvas size. A new shape replays the operations onto a bath of that shape.
  useEffect(() => {
    const canvas = canvasRef.current
    const paper = paperRef.current
    if (!canvas || !paper) return
    const resize = () => {
      const w = paper.clientWidth
      const h = paper.clientHeight
      if (!w || !h) return
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(w * ratio))
      canvas.height = Math.max(1, Math.round(h * ratio))
      const e = engine.current
      const width = w / h
      // About 1.5 CSS pixels between vertices: under a device pixel of error after any one operation.
      const detail = Math.min(0.01, Math.max(0.0022, 1.5 / h))
      if (Math.abs(width - e.bath.width) > 0.01 || Math.abs(detail - e.bath.detail) / e.bath.detail > 0.3) {
        e.bath = { ...e.bath, width, detail }
        e.base = replay(e.ops, e.bath)
      }
      render()
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(paper)
    return () => observer?.disconnect()
  }, [render])

  // A new pattern is made from its recipe: played when autoplay is on — the loop
  // only runs on screen, so it starts in earnest when the paper is scrolled into
  // view — and otherwise shown finished at once. Which of the two it is depends
  // only on the props, so an effect run twice on mount lands in the same place.
  useEffect(() => {
    if (autoplay) play()
    else finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern])

  // Reduced motion switched on mid-recipe: land the rest at once.
  useEffect(() => {
    if (reduced) flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  useEffect(() => {
    if (!paused) wake()
  }, [paused, wake])

  // Park the loop off screen and in hidden tabs.
  useEffect(() => {
    const paper = paperRef.current
    const e = engine.current
    const onVisible = () => wake()
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            e.visible = entry.isIntersecting
            onVisible()
          })
    if (paper) observer?.observe(paper)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisible)
      cancelAnimationFrame(e.frame)
      e.frame = 0
      e.last = 0
    }
  }, [wake])

  /* ------------------------------------------------------------ pointer */

  const bathPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const h = box.height || 1
    return { x: (event.clientX - box.left) / h, y: (event.clientY - box.top) / h, px: h }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    takeOver()
    const { x, y } = bathPoint(event)
    engine.current.drag = { id: event.pointerId, x0: x, y0: y, x1: x, y1: y, moved: false }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const e = engine.current
    const d = e.drag
    if (!d || d.id !== event.pointerId) return
    const { x, y, px } = bathPoint(event)
    d.x1 = x
    d.y1 = y
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) * px > 5) d.moved = true
    if (d.moved) {
      e.dirty = true
      wake()
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const e = engine.current
    const d = e.drag
    if (!d || d.id !== event.pointerId) return
    const stroke = dragOp()
    e.drag = null
    if (stroke) {
      // Already shown live while dragging, so it is committed as it stands.
      commit(stroke)
      sync()
      render()
      setAnnouncement('Tine drawn.')
    } else drop(d.x0 / e.bath.width, d.y0)
  }

  const onPointerCancel = () => {
    engine.current.drag = null
    render()
  }

  /* ---------------------------------------------------------------- view */

  const setPattern = (next: PaperMarblingPattern) => {
    if (patternProp === undefined) setInternalPattern(next)
    onPatternChange?.(next)
  }
  const setDropSize = (next: number) => {
    if (dropSizeProp === undefined) setInternalSize(next)
    onDropSizeChange?.(next)
  }

  const swatches = useMemo(
    () =>
      inks.map((value, index) => {
        const Swatch: IconComponent = ({ size = 15, className: iconClass }) => (
          <svg viewBox="0 0 16 16" width={size} height={size} className={iconClass} aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" style={{ fill: value }} stroke="currentColor" strokeOpacity={0.3} />
          </svg>
        )
        return { value: String(index), label: inkNames[index], icon: Swatch }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inks, inkNames.join('|')],
  )

  const playing = status === 'playing'
  const summary = `${PATTERN_NAMES[pattern]}${playing ? ', being made' : ''}: ${tally.drops} ${tally.drops === 1 ? 'drop' : 'drops'} of ink and ${tally.tines} tine ${tally.tines === 1 ? 'stroke' : 'strokes'}.`

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div
        ref={paperRef}
        className="relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]"
        style={{ aspectRatio: String(aspectRatio) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full"
          {...(label ? { role: 'img', 'aria-label': `${label}. ${summary}` } : { 'aria-hidden': true })}
        />
      </div>

      {controls ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {reduced ? (
              <Button size="sm" variant="accent" onClick={play}>
                Show again
              </Button>
            ) : (
              <Button size="sm" variant={playing ? 'outline' : 'accent'} onClick={() => (playing ? takeOver() : play())} className="min-w-[112px]">
                {playing ? 'Stop' : 'Play recipe'}
              </Button>
            )}
            <SegmentedControl label="Pattern" size="sm" value={pattern} onValueChange={setPattern} options={PATTERN_OPTIONS} />
          </div>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <SegmentedControl label="Ink colour" size="sm" value={String(activeColour)} onValueChange={(value) => setColour(Number(value))} options={swatches} />
            <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span className="flex justify-between text-[12px] font-semibold text-ink-soft">
                Drop size <span className="font-mono font-normal tabular-nums text-ink-faint">{Math.round(dropSize * 100)}%</span>
              </span>
              <Slider
                min={3}
                max={25}
                value={Math.round(dropSize * 100)}
                aria-valuetext={`${Math.round(dropSize * 100)} percent of the paper’s height`}
                onChange={(event) => setDropSize(Number(event.target.value) / 100)}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="muted" onClick={() => drop()}>
              Drop at centre
            </Button>
            <Button size="sm" variant="muted" onClick={nextTooth}>
              Draw a tine
            </Button>
            <Button size="sm" variant="outline" onClick={undo} disabled={tally.drops + tally.tines === 0}>
              Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clear()
                setAnnouncement('Bath cleared.')
              }}
            >
              Clear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void save()} className="ml-auto">
              Save PNG
            </Button>
          </div>
          <p className="flex flex-wrap justify-between gap-2 text-[12px] text-ink-faint">
            <span>Click the paper to drop ink; drag across it to draw a tine.</span>
            <span className="font-mono tabular-nums">
              {tally.drops} drops · {tally.tines} tines
            </span>
          </p>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
})
