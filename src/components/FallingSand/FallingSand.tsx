'use client'

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '../../lib/cn'
import { tokenRgb, useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import type { IconComponent } from '../../lib/types'
import { Button } from '../Button'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl'
import { Slider } from '../Slider'
import {
  FIRE_HOT,
  MATERIAL_COUNT,
  MATERIAL_IDS,
  SAND_MATERIALS,
  SHADES,
  SandGrid,
  buildShades,
  type FallingSandMaterial,
  type Rgb,
} from './sand'

export interface FallingSandHandle {
  /** Clear the box and draw the headline again. */
  reset: () => void
  /** Pour from the top for a few seconds, in a stream that wanders across the box. Sand unless told otherwise. */
  pour: (seconds?: number, material?: FallingSandMaterial) => void
  /** Drop a handful at a point (0–1, y down). The centre and the current brush by default. */
  drop: (x?: number, y?: number, material?: FallingSandMaterial) => void
}

export interface FallingSandProps {
  /** A headline drawn into the grid in the theme font, as `seedMaterial`. Use `\n` for a second line. */
  seedText?: string
  /** What the headline is made of. Packed sand holds its shape until something touches it; sand falls at once. */
  seedMaterial?: 'packed' | 'sand'
  /** The materials offered in the picker, in order. `'empty'` is the eraser. */
  materials?: FallingSandMaterial[]
  /** Colour overrides per material, as any CSS colour — tokens, `color-mix()`. `empty` is the background. */
  palette?: Partial<Record<FallingSandMaterial, string>>
  /** Controlled brush material. */
  brush?: FallingSandMaterial
  /** Uncontrolled starting brush material. */
  defaultBrush?: FallingSandMaterial
  /** Called when the picker changes the brush. */
  onBrushChange?: (material: FallingSandMaterial) => void
  /** Controlled brush radius, in cells. */
  brushSize?: number
  /** Uncontrolled starting brush radius, in cells. */
  defaultBrushSize?: number
  /** Called when the slider changes the brush radius. */
  onBrushSizeChange?: (size: number) => void
  /** A source that drips from the top without stopping: `true` for sand, or a material. */
  pour?: boolean | FallingSandMaterial
  /** Automaton steps per frame, 1–6. Each step moves a falling grain one cell. */
  speed?: number
  /** CSS pixels per cell. Smaller is finer and costs more; the grid is capped at 150,000 cells whatever this says. */
  cellSize?: number
  /** Controlled pause. Painting still works and shows at once; nothing moves. */
  paused?: boolean
  /** Uncontrolled starting pause state. */
  defaultPaused?: boolean
  /** Called when the pause button toggles. */
  onPausedChange?: (paused: boolean) => void
  /** Show the material picker, brush slider and buttons. */
  controls?: boolean
  /** Accessible name for the sand box. */
  label?: string
  /** Merged last, so it wins. A height here is shared between the box and the controls. */
  className?: string
}

const DEFAULT_MATERIALS: FallingSandMaterial[] = ['sand', 'water', 'oil', 'wood', 'stone', 'fire', 'steam', 'empty']
const NAMES = Object.keys(MATERIAL_IDS) as FallingSandMaterial[]
/** 150,000 cells steps in a couple of milliseconds even when all of it is awake, which it rarely is. */
const MAX_CELLS = 150_000
const SAND = MATERIAL_IDS.sand

const EraserIcon: IconComponent = ({ size = 12, className }) => (
  <svg viewBox="0 0 12 12" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="2 1.6" className={className} aria-hidden="true">
    <rect x="1.5" y="1.5" width="9" height="9" rx="2.5" />
  </svg>
)

/** A small square of the material’s own colour, so the picker is also a legend. */
const swatch = (colour: string): IconComponent =>
  function Swatch({ size = 12, className }) {
    return (
      <svg viewBox="0 0 12 12" width={size} height={size} className={className} aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="2.5" style={{ fill: colour, stroke: 'color-mix(in oklab, currentColor 25%, transparent)' }} />
      </svg>
    )
  }

/**
 * Any CSS colour as RGB bytes. A bare token goes through `tokenRgb`; anything else — `color-mix()`, relative colour
 * syntax — is set on the host so the browser resolves it, and a colour the browser rejects falls back.
 */
function resolveColour(host: HTMLElement, value: string, fallback?: string): Rgb {
  const token = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim())
  if (token) return tokenRgb(host, token[1], [128, 128, 128])
  const previous = host.style.color
  host.style.color = ''
  host.style.color = value
  if (!host.style.color) {
    host.style.color = previous
    return fallback ? resolveColour(host, fallback) : [128, 128, 128]
  }
  const computed = getComputedStyle(host).color
  host.style.color = previous
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const context = probe.getContext('2d', { willReadFrequently: true })
  if (!context) return [128, 128, 128]
  context.fillStyle = computed
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

/**
 * The headline as an RGBA mask at grid size: one pixel per cell, so the letters come out as chunky type made of
 * grains. Same trick as ReactionDiffusion’s seed — draw in the theme font on a 2D canvas, read back the alpha.
 */
function textMask(columns: number, rows: number, text: string, host: HTMLElement) {
  const mask = document.createElement('canvas')
  mask.width = columns
  mask.height = rows
  const context = mask.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const style = getComputedStyle(host)
  const family = style.getPropertyValue('--font-sans').trim() || style.fontFamily || 'sans-serif'
  const lines = text.split('\n')
  context.font = `800 100px ${family}`
  const widest = Math.max(...lines.map((line) => context.measureText(line).width), 1)
  // Wide enough to fill the box, and short enough to leave the bottom third for the pile.
  const size = Math.min((columns * 0.88 * 100) / widest, (rows * 0.6) / (lines.length * 1.02))
  context.font = `800 ${size}px ${family}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  lines.forEach((line, index) => context.fillText(line, columns / 2, rows * 0.4 + (index - (lines.length - 1) / 2) * size * 1.02))
  return context.getImageData(0, 0, columns, rows).data
}

const where = (x: number, y: number) => {
  const across = x < 0.34 ? 'left' : x > 0.66 ? 'right' : ''
  const down = y < 0.34 ? 'top' : y > 0.66 ? 'bottom' : ''
  return down || across ? `the ${[down, across].filter(Boolean).join(' ')}` : 'the centre'
}

interface Engine {
  reset: () => void
  pour: (seconds: number, material: number) => void
  drop: (x: number, y: number, material: number) => void
  stroke: (from: readonly [number, number] | null, to: readonly [number, number]) => void
  release: () => void
  recolour: () => void
  wake: () => void
}

/**
 * A falling-sand cellular automaton in which a headline is the sand.
 *
 * Every cell of a typed-array grid holds one material, and each step lets each cell move or transform by that
 * material’s rule: sand falls and piles by trying its lower diagonals, water and oil run sideways until they find
 * their level, fire lights its neighbours by their flammability and burns out into smoke, steam rises and
 * condenses. The rules are in `sand.ts`; this file draws the grid and wires up the brush.
 *
 * `seedText` is drawn in the theme font straight into the grid as packed sand — a static material that crumbles
 * to loose sand only where something moving touches it — so the words hold their shape until the pointer, a pour or
 * a drop disturbs them, and then come apart grain by grain.
 *
 * The grid is drawn one pixel per cell into an ImageData and scaled up by CSS with `image-rendering: pixelated`, so
 * the cells stay crisp and the browser does the scaling for free. Only the rectangle that changed is uploaded, and
 * a grid with nothing moving is not stepped or drawn at all. Colours are theme tokens resolved at runtime and
 * re-read when the theme or accent changes. Under reduced motion the automaton is run to rest off screen and one
 * settled frame is shown; painting, dropping and pouring still work, and show where everything ends up.
 */
export const FallingSand = forwardRef<FallingSandHandle, FallingSandProps>(function FallingSand(
  {
    seedText,
    seedMaterial = 'packed',
    materials = DEFAULT_MATERIALS,
    palette,
    brush: brushProp,
    defaultBrush,
    onBrushChange,
    brushSize: brushSizeProp,
    defaultBrushSize = 4,
    onBrushSizeChange,
    pour = false,
    speed = 2,
    cellSize = 4,
    paused: pausedProp,
    defaultPaused = false,
    onPausedChange,
    controls = true,
    label = 'Falling sand',
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const hintId = `${useId()}-hint`
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [internalBrush, setInternalBrush] = useState<FallingSandMaterial>(defaultBrush ?? materials[0] ?? 'sand')
  const brush = brushProp ?? internalBrush
  const [internalBrushSize, setInternalBrushSize] = useState(defaultBrushSize)
  const brushSize = brushSizeProp ?? internalBrushSize
  const [internalPaused, setInternalPaused] = useState(defaultPaused)
  const paused = pausedProp ?? internalPaused
  const [aim, setAim] = useState({ x: 0.5, y: 0.5 })
  const [aiming, setAiming] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const settings = useRef({ brush, brushSize, speed, paused, pour, reduced, palette })
  settings.current = { brush, brushSize, speed, paused, pour, reduced, palette }
  const engine = useRef<Engine | null>(null)
  const strokeFrom = useRef<readonly [number, number] | null>(null)
  const reportOnRest = useRef(false)

  const setBrush = (next: FallingSandMaterial) => {
    if (brushProp === undefined) setInternalBrush(next)
    onBrushChange?.(next)
  }
  const setBrushSize = (next: number) => {
    if (brushSizeProp === undefined) setInternalBrushSize(next)
    onBrushSizeChange?.(next)
  }
  const togglePaused = () => {
    if (pausedProp === undefined) setInternalPaused(!paused)
    onPausedChange?.(!paused)
  }

  const colourOf = (material: FallingSandMaterial) => palette?.[material] ?? SAND_MATERIALS[material].colour
  const labelOf = (material: FallingSandMaterial) => SAND_MATERIALS[material].label
  const paletteKey = JSON.stringify(palette ?? {})
  const options = useMemo<SegmentedOption<FallingSandMaterial>[]>(
    () => materials.map((material) => ({ value: material, label: labelOf(material), icon: material === 'empty' ? EraserIcon : swatch(colourOf(material)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materials.join(), paletteKey],
  )

  useImperativeHandle(
    ref,
    () => ({
      reset: () => engine.current?.reset(),
      pour: (seconds = 3, material) => engine.current?.pour(seconds, MATERIAL_IDS[material ?? (typeof settings.current.pour === 'string' ? settings.current.pour : 'sand')]),
      drop: (x = 0.5, y = 0.5, material) => engine.current?.drop(x, y, MATERIAL_IDS[material ?? settings.current.brush]),
    }),
    [],
  )

  /* ------------------------------------------------------------- engine */

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    if (!box || !canvas) return
    // No 2D canvas (jsdom, or a locked-down browser): the box stays an empty surface and the controls still render.
    const context = canvas.getContext('2d')
    if (!context) return

    let grid: SandGrid | null = null
    let image: ImageData | null = null
    let pixels: Uint32Array = new Uint32Array(0)
    let shades: Uint32Array = new Uint32Array(MATERIAL_COUNT * SHADES)
    let frame = 0
    let visible = true
    let disposed = false
    let ready = false
    let settleRun = 0
    let pourUntil = 0
    let burst = SAND
    let pourX = 0

    const pouringNow = () => settings.current.pour !== false || performance.now() < pourUntil
    const pourMaterial = () => {
      const source = settings.current.pour
      return performance.now() < pourUntil ? burst : typeof source === 'string' ? MATERIAL_IDS[source] : SAND
    }

    const draw = () => {
      if (!grid || !image) return
      const rect = grid.render(pixels, shades)
      if (rect) context.putImageData(image, 0, 0, rect.x, rect.y, rect.width, rect.height)
    }

    const recolour = () => {
      const custom = settings.current.palette
      const colours: Rgb[] = []
      for (const name of NAMES) colours[MATERIAL_IDS[name]] = resolveColour(box, custom?.[name] ?? SAND_MATERIALS[name].colour, SAND_MATERIALS[name].fallback)
      shades = buildShades(colours, resolveColour(box, FIRE_HOT))
      grid?.repaint()
      draw()
    }

    /** A grid sized to the box: one cell per `cellSize` CSS pixels, coarser if that would exceed the cap. */
    const build = () => {
      const width = box.clientWidth
      const height = box.clientHeight
      if (width < 16 || height < 16) return false
      const size = Math.max(1, cellSize, Math.sqrt((width * height) / MAX_CELLS))
      const columns = Math.max(8, Math.round(width / size))
      const rows = Math.max(8, Math.round(height / size))
      if (grid && grid.width === columns && grid.height === rows) return false
      grid = new SandGrid(columns, rows)
      canvas.width = columns
      canvas.height = rows
      image = context.createImageData(columns, rows)
      pixels = new Uint32Array(image.data.buffer)
      return true
    }

    const seed = () => {
      if (!grid) return
      grid.clear()
      if (seedText) {
        const mask = textMask(grid.width, grid.height, seedText, box)
        if (mask) grid.seedMask(mask, MATERIAL_IDS[seedMaterial])
      }
      pourX = grid.width / 2
    }

    // The stream wanders in a random walk, so a long pour spreads a pile rather than building a spike.
    const emit = () => {
      if (!grid) return
      pourX = Math.min(grid.width * 0.94, Math.max(grid.width * 0.06, pourX + (grid.random() - 0.5) * 1.4))
      grid.emit(pourX, Math.max(1, grid.width / 90), pourMaterial())
    }

    const report = () => {
      if (!grid || !reportOnRest.current) return
      reportOnRest.current = false
      const counts = grid.census()
      const parts = NAMES.filter((name) => name !== 'empty' && counts[MATERIAL_IDS[name]] > 0).map(
        (name) => `${SAND_MATERIALS[name].label.toLowerCase()} ${counts[MATERIAL_IDS[name]].toLocaleString()}`,
      )
      setAnnouncement(parts.length ? `Settled. Cells of ${parts.join(', ')}.` : 'Settled. The box is empty.')
    }

    // Reduced motion: run the automaton to rest off screen, a chunk at a time so the page never freezes, and show
    // only the result. Timeouts rather than frames, so it still finishes in a background tab.
    const settle = (pourSteps = 0) => {
      const run = ++settleRun
      let budget = 3000
      let pouring = pourSteps
      const chunk = () => {
        if (disposed || run !== settleRun || !grid) return
        for (let k = 0; k < 150 && budget > 0; k++, budget--) {
          if (pouring > 0) {
            emit()
            pouring--
          }
          if (!grid.step() && pouring <= 0) budget = 0
        }
        if (budget > 0) setTimeout(chunk, 0)
        else {
          draw()
          report()
        }
      }
      chunk()
    }

    const tick = () => {
      frame = 0
      if (!grid || disposed) return
      const s = settings.current
      if (!s.paused) {
        const steps = Math.max(1, Math.min(6, Math.round(s.speed)))
        for (let k = 0; k < steps; k++) {
          if (pouringNow()) emit()
          grid.step()
        }
      }
      draw()
      // Asleep and not pouring: stop asking for frames. A settled pile costs nothing until something wakes it.
      if (!s.paused && (grid.awake || pouringNow()) && visible && !document.hidden) frame = requestAnimationFrame(tick)
      else if (!grid.awake) report()
    }

    const wake = () => {
      const s = settings.current
      if (frame || disposed || !grid || s.reduced || s.paused || !visible || document.hidden) return
      frame = requestAnimationFrame(tick)
    }

    /** After anything that changes the grid from outside a step. */
    const edited = (pourSteps = 0) => {
      if (settings.current.reduced) settle(pourSteps)
      else if (settings.current.paused) draw()
      else wake()
    }

    const start = () => {
      if (!grid) return
      draw()
      if (settings.current.reduced) settle(pouringNow() ? 900 : 0)
      else wake()
    }

    const rebuild = () => {
      if (!ready || disposed || !build()) return
      seed()
      recolour()
      start()
    }

    // The theme font may still be loading; seeding with a fallback face would bake the wrong letters in.
    recolour()
    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    void fontsReady.then(() => {
      ready = true
      rebuild()
    })

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(rebuild)
    resizeObserver?.observe(box)
    const intersectionObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            wake()
          })
    intersectionObserver?.observe(box)
    document.addEventListener('visibilitychange', wake)

    engine.current = {
      reset: () => {
        if (!grid) return
        seed()
        start()
      },
      pour: (seconds, material) => {
        if (!grid) return
        burst = material
        pourX = grid.width * (0.2 + grid.random() * 0.6)
        pourUntil = performance.now() + seconds * 1000
        reportOnRest.current = true
        edited(Math.round(seconds * 60 * Math.max(1, settings.current.speed)))
      },
      drop: (x, y, material) => {
        if (!grid) return
        grid.paint(x * grid.width, y * grid.height, settings.current.brushSize * 1.6, material)
        reportOnRest.current = true
        edited()
      },
      stroke: (from, to) => {
        if (!grid) return
        const id = MATERIAL_IDS[settings.current.brush]
        const r = settings.current.brushSize
        if (from) grid.paintLine(from[0] * grid.width, from[1] * grid.height, to[0] * grid.width, to[1] * grid.height, r, id)
        else grid.paint(to[0] * grid.width, to[1] * grid.height, r, id)
        // Under reduced motion the stroke is shown where it is painted, and settles when the pointer lifts.
        if (settings.current.reduced) draw()
        else edited()
      },
      release: () => {
        reportOnRest.current = true
        if (settings.current.reduced) settle()
      },
      recolour,
      wake: () => {
        if (settings.current.reduced) return
        wake()
      },
    }

    return () => {
      disposed = true
      engine.current = null
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      document.removeEventListener('visibilitychange', wake)
    }
  }, [seedText, seedMaterial, cellSize, reduced])

  useEffect(() => engine.current?.recolour(), [themeVersion, paletteKey])
  // Unpausing, or turning a pour on, has to restart a loop that went to sleep.
  useEffect(() => engine.current?.wake(), [paused, pour, speed])

  /* ------------------------------------------------------------ pointer */

  const pointAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return [(event.clientX - box.left) / Math.max(1, box.width), (event.clientY - box.top) / Math.max(1, box.height)] as const
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setAiming(false)
    const point = pointAt(event)
    strokeFrom.current = point
    engine.current?.stroke(null, point)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = strokeFrom.current
    if (!from) return
    const point = pointAt(event)
    engine.current?.stroke(from, point)
    strokeFrom.current = point
  }

  const endStroke = () => {
    if (!strokeFrom.current) return
    strokeFrom.current = null
    engine.current?.release()
  }

  /* ----------------------------------------------------------- keyboard */

  const dropAtAim = () => {
    engine.current?.drop(aim.x, aim.y, MATERIAL_IDS[brush])
    setAnnouncement(brush === 'empty' ? `Cleared a patch at ${where(aim.x, aim.y)}.` : `Dropped ${labelOf(brush).toLowerCase()} at ${where(aim.x, aim.y)}.`)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.12 : 0.04
    const moves: Record<string, readonly [number, number] | undefined> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const move = moves[event.key]
    if (move) {
      setAiming(true)
      setAim(({ x, y }) => ({ x: Math.min(0.97, Math.max(0.03, x + move[0])), y: Math.min(0.97, Math.max(0.03, y + move[1])) }))
    } else if (event.key === 'Enter' || event.key === ' ') {
      setAiming(true)
      dropAtAim()
    } else return
    event.preventDefault()
  }

  /* --------------------------------------------------------------- view */

  const pourNow = () => {
    const material = typeof pour === 'string' ? pour : 'sand'
    engine.current?.pour(3, MATERIAL_IDS[material])
    setAnnouncement(`Pouring ${labelOf(material).toLowerCase()} for three seconds.`)
  }

  const reset = () => {
    engine.current?.reset()
    setAnnouncement(seedText ? 'Reset. The headline is back.' : 'Reset. The box is empty.')
  }

  const describe = seedText ? `${label}: “${seedText.split('\n').join(' ')}” drawn in ${labelOf(seedMaterial).toLowerCase()}` : label

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div
        ref={boxRef}
        tabIndex={0}
        role="group"
        aria-roledescription="sand box"
        aria-label={label}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onBlur={() => setAiming(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        className={cn(
          'relative isolate min-h-[260px] flex-1 cursor-crosshair touch-none select-none overflow-hidden',
          'rounded-[var(--radius-card)] border border-line bg-surface-sunken',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <span id={hintId} className="sr-only">
          Drag to paint with the selected material. Arrow keys move a marker, and Enter or Space drops material at it.
        </span>
        <canvas ref={canvasRef} role="img" aria-label={describe} className="absolute inset-0 block size-full [image-rendering:pixelated]" />
        {aiming ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink shadow-[0_0_0_2px_var(--color-surface)]"
            style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%` }}
          />
        ) : null}
      </div>

      {controls ? (
        <div className="flex flex-col gap-3">
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl label="Material" size="sm" value={brush} onValueChange={setBrush} options={options} />
          </div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
              <span className="flex justify-between text-[12px] font-semibold text-ink-soft">
                Brush size <span className="font-mono font-normal tabular-nums text-ink-faint">{brushSize}</span>
              </span>
              <Slider
                min={1}
                max={16}
                value={brushSize}
                aria-valuetext={`${brushSize} ${brushSize === 1 ? 'cell' : 'cells'} across the radius`}
                onChange={(event) => setBrushSize(Number(event.target.value))}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="accent" onClick={dropAtAim}>
                {brush === 'empty' ? 'Clear a patch' : `Drop ${labelOf(brush).toLowerCase()}`}
              </Button>
              <Button size="sm" variant="outline" onClick={pourNow}>
                Pour
              </Button>
              {reduced ? null : (
                <Button size="sm" variant="outline" onClick={togglePaused} className="min-w-[72px]">
                  {paused ? 'Play' : 'Pause'}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
})
