'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import {
  addGusts,
  ageGusts,
  curlAt,
  flakeArea,
  radiusForArea,
  SAME_GROUND,
  SNOW_COLUMN,
  SnowField,
  SnowFlakes,
  type SnowEmit,
  type SnowGust,
  type SnowSurface,
} from './drift'

/** `snow` is white shaded from the ink token, `accent` is tinted by the accent, `ink` is ash. */
export type SnowDriftTone = 'snow' | 'accent' | 'ink'

export interface SnowDriftProps {
  /** The content it snows on. Its elements are the ground, measured from the live layout. */
  children: ReactNode
  /**
   * Selector for the elements snow settles on, searched inside the region. Their top edges are the ground, and the
   * region’s bottom is the floor. When nothing matches, every direct child is a surface.
   */
  selector?: string
  /** Flakes per second across the whole region. 0 stops new snow; what is already falling still lands. */
  intensity?: number
  /** Steady wind, from −1 (hard left) to 1 (hard right). Its strength also stirs the turbulence. */
  wind?: number
  /** Let flakes settle. Off, they fall past everything and nothing piles up. */
  accumulate?: boolean
  /** How fast the piles sink, in pixels a second, so a page left open does not fill up. 0 keeps every flake. */
  melt?: number
  /** Snow already settled when it first appears, in pixels. Under reduced motion there is always some. */
  depth?: number
  /** The deepest a pile can get, in pixels. */
  maxDepth?: number
  /** Colour of the snow. Every tone is read from theme tokens and repaints when the theme or accent changes. */
  tone?: SnowDriftTone
  /** Sweeping the pointer gusts the air and blows settled snow back up. Nothing is captured, so links still work. */
  interactive?: boolean
  /** Freeze the falling flakes where they are. Settled snow stays. */
  paused?: boolean
  /** Describe the scene for assistive tech. Without it the snow is decorative and hidden. */
  label?: string
  /** Merged last, so it wins. Layout classes here lay out the children directly. */
  className?: string
}

/** Imperative controls — the keyboard route to what a pointer sweep does, and a way to reset. */
export interface SnowDriftHandle {
  /** A gust across the whole region that blows most of the settled snow back into the air. */
  gust: () => void
  /** Remove all snow, settled and falling. */
  clear: () => void
}

type Rgb = [number, number, number]

interface Palette {
  crest: Rgb
  shade: Rgb
  edge: Rgb
  flake: Rgb
  contact: Rgb
  dark: boolean
}

/**
 * Each tone as CSS colours, per theme. Snow is white, and white snow on a white page is invisible, so on a light
 * theme the flanks and falling flakes are shaded from the ink token and the crest gets an outline; on a dark theme
 * the snow itself is the contrast, and the flanks only dim a little.
 */
const TONES: Record<SnowDriftTone, (dark: boolean) => Record<Exclude<keyof Palette, 'dark'>, string>> = {
  snow: (dark) => ({
    crest: 'color-mix(in oklab, var(--color-surface) 4%, white)',
    shade: dark ? 'color-mix(in oklab, var(--color-surface) 30%, white)' : 'color-mix(in oklab, var(--color-ink) 12%, white)',
    edge: dark ? 'white' : 'color-mix(in oklab, var(--color-ink) 26%, white)',
    flake: dark ? 'color-mix(in oklab, var(--color-surface) 6%, white)' : 'color-mix(in oklab, var(--color-ink) 32%, white)',
    contact: dark ? 'var(--color-canvas)' : 'var(--color-ink)',
  }),
  accent: (dark) => ({
    crest: 'color-mix(in oklab, var(--color-accent) 22%, white)',
    shade: dark ? 'color-mix(in oklab, var(--color-accent) 75%, var(--color-surface))' : 'color-mix(in oklab, var(--color-accent) 70%, var(--color-ink))',
    edge: dark ? 'color-mix(in oklab, var(--color-accent) 40%, white)' : 'color-mix(in oklab, var(--color-accent) 55%, var(--color-ink))',
    flake: dark ? 'color-mix(in oklab, var(--color-accent) 45%, white)' : 'color-mix(in oklab, var(--color-accent) 75%, var(--color-ink))',
    contact: dark ? 'var(--color-canvas)' : 'var(--color-ink)',
  }),
  ink: () => ({
    crest: 'color-mix(in oklab, var(--color-ink) 55%, var(--color-surface))',
    shade: 'var(--color-ink)',
    edge: 'var(--color-ink)',
    flake: 'color-mix(in oklab, var(--color-ink) 75%, var(--color-surface))',
    contact: 'var(--color-ink)',
  }),
}

/** Resolve any CSS colour — a token, oklab, color-mix — to 0–255 RGB by painting one pixel. */
function resolveColour(value: string, host: HTMLElement, probe: CanvasRenderingContext2D | null, fallback: Rgb): Rgb {
  host.style.color = ''
  host.style.color = value
  const computed = getComputedStyle(host).color
  host.style.color = ''
  if (!probe || !computed) return fallback
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = computed
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r!, g!, b!]
}

const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r},${g},${b},${alpha})`
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

const DEFAULT_SELECTOR = '[data-snow], h1, h2, h3, img, button'
const MAX_FLAKES = 1800
const TAU = Math.PI * 2
/** The largest clump a pointer sweep throws; a gust from code throws bigger ones so one pass lifts a whole page. */
const SWEEP_CLUMP = 2.2
const GUST_CLUMP = 3.2

/**
 * Snow that falls on the page’s own elements.
 *
 * Like LightCaster, it reads the layout rather than painting over it. The elements the selector finds are measured
 * with getBoundingClientRect and kept current with a ResizeObserver on each, on scroll and on DOM changes, and their
 * top edges — following a rounded corner’s curve — become the ground of a 1D heightfield with one column every two
 * pixels, over the region’s floor. Each column holds only the highest surface under it, so snow never reaches
 * underneath a card, and snow already settled rides a card that moves.
 *
 * Flakes are simulated in a curl-noise wind with per-flake drag and flutter (see drift.ts). One that lands adds to
 * its column, and after every frame of landings a thermal-erosion pass lets any slope steeper than snow’s angle of
 * repose slide sideways. That is what turns a column chart into drifts: mounds with sloped flanks, avalanches down
 * them, and cornices that slough off a card’s edge as flakes and fall to the floor. Piles melt at a set rate and
 * are capped at `maxDepth`, so the page never fills up.
 *
 * The overlay is one canvas above the content with `pointer-events: none`; the sweep listens on the region without
 * capturing or preventing anything, so every link and button underneath works and text stays selectable. A sweep
 * pushes a rolling puff into the wind and throws the snow under it back into the air; `gust()` does it to the whole
 * region, and a button that appears on keyboard focus calls it. Under reduced motion no flake falls: the snow is
 * computed as already settled and drawn as a still, with a button that settles another layer at once.
 */
export const SnowDrift = forwardRef<SnowDriftHandle, SnowDriftProps>(function SnowDrift(
  {
    children,
    selector = DEFAULT_SELECTOR,
    intensity = 110,
    wind = 0.12,
    accumulate = true,
    melt = 0.25,
    depth = 0,
    maxDepth = 36,
    tone = 'snow',
    interactive = true,
    paused = false,
    label,
    className,
  },
  ref,
) {
  const regionRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const [announcement, setAnnouncement] = useState('')

  // Everything the loop reads lives in one ref, so a prop change never rebuilds the observers or loses the snow.
  const live = useRef({ intensity, wind, accumulate, melt, depth, maxDepth, tone, interactive, paused, reduced })
  live.current = { intensity, wind, accumulate, melt, depth, maxDepth, tone, interactive, paused, reduced }

  // The simulation outlives the effect, so a new selector re-measures the ground without melting the snow.
  const [sim] = useState(() => ({
    field: new SnowField(),
    flakes: new SnowFlakes(MAX_FLAKES),
    gusts: [] as SnowGust[],
    primed: false,
    still: false,
  }))

  const api = useRef({
    gust: () => {},
    clear: () => {},
    snow: () => {},
    sync: () => {},
    repaint: () => {},
    sweep: (_x: number, _y: number, _time: number) => {},
    release: () => {},
  })

  useImperativeHandle(
    ref,
    () => ({
      gust: () => api.current.gust(),
      clear: () => api.current.clear(),
    }),
    [],
  )

  useEffect(() => {
    api.current.sync()
  }, [paused, reduced, intensity, wind, accumulate, melt, maxDepth])

  useEffect(() => {
    api.current.repaint()
  }, [tone, themeVersion])

  useEffect(() => {
    const region = regionRef.current
    const content = contentRef.current
    const canvas = canvasRef.current
    const state = sim
    if (!region || !content || !canvas) return
    // jsdom and some locked-down browsers have no 2D context: the content still renders, just without snow.
    const context = canvas.getContext('2d')
    if (!context) return
    const probeCanvas = document.createElement('canvas')
    probeCanvas.width = probeCanvas.height = 1
    const probe = probeCanvas.getContext('2d', { willReadFrequently: true })

    const { field, flakes, gusts } = state
    const air: [number, number] = [0, 0]
    let palette: Palette | null = null
    let width = 0
    let height = 0
    let scale = 1
    let observed: Element[] = []
    let loopFrame = 0
    let drawFrame = 0
    let measureFrame = 0
    let visible = true
    let last = 0
    let time = 0
    let spawnDebt = 0
    let spillDebt = 0
    let seed = 0x2f6b4a1d
    let settleSeed = 11
    let pointer: { x: number; y: number; time: number } | null = null

    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }

    const readPalette = () => {
      const surface = resolveColour('var(--color-surface)', region, probe, [255, 255, 255])
      const dark = (0.2126 * surface[0] + 0.7152 * surface[1] + 0.0722 * surface[2]) / 255 < 0.45
      const css = TONES[live.current.tone](dark)
      palette = {
        dark,
        crest: resolveColour(css.crest, region, probe, [250, 250, 250]),
        shade: resolveColour(css.shade, region, probe, [200, 200, 205]),
        edge: resolveColour(css.edge, region, probe, [170, 170, 175]),
        flake: resolveColour(css.flake, region, probe, [220, 220, 225]),
        contact: resolveColour(css.contact, region, probe, [20, 20, 20]),
      }
    }

    /* ------------------------------------------------------------ measuring */

    const measure = () => {
      measureFrame = 0
      const box = region.getBoundingClientRect()
      width = box.width
      height = box.height
      scale = Math.min(2, window.devicePixelRatio || 1)
      const pixelWidth = Math.max(1, Math.round(width * scale))
      const pixelHeight = Math.max(1, Math.round(height * scale))
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      let nodes: HTMLElement[] = []
      try {
        nodes = Array.from(content.querySelectorAll<HTMLElement>(selector))
      } catch {
        // An invalid selector is the caller’s mistake, but not worth a crash: fall back to the children.
      }
      if (!nodes.length) nodes = Array.from(content.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
      const surfaces: SnowSurface[] = []
      for (const node of nodes) {
        const rect = node.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) continue
        surfaces.push({
          left: rect.left - box.left,
          right: rect.right - box.left,
          top: rect.top - box.top,
          radius: parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0,
        })
      }
      // A zero-sized first measurement (a hidden tab, a collapsed parent, jsdom) is not an empty page: wait for a real one.
      if (width >= 1 && height >= 1) {
        field.layout(width, height, surfaces)
        if (!state.primed) {
          state.primed = true
          if (live.current.depth > 0) field.settle(live.current.depth, live.current.maxDepth, settleSeed++)
        }
      }
      const same = nodes.length === observed.length && nodes.every((node, i) => node === observed[i])
      if (!same && resizeObserver) {
        for (const node of observed) resizeObserver.unobserve(node)
        for (const node of nodes) resizeObserver.observe(node)
        observed = nodes
      }
    }

    const requestMeasure = () => {
      if (!measureFrame) {
        measureFrame = requestAnimationFrame(() => {
          measure()
          sync()
          requestDraw()
        })
      }
    }

    /* ------------------------------------------------------------ throwing snow */

    /** Snow sliding over a ledge: collected until there is a flake’s worth, then dropped off the edge as one. */
    const spill: SnowEmit = (x, y, direction, area) => {
      spillDebt += area
      if (spillDebt < flakeArea(1.1)) return true
      const radius = clamp(radiusForArea(spillDebt), 0.9, 2.4)
      if (!flakes.spawn(x + direction * 1.5, y, direction * (10 + random() * 22), 8 + random() * 18, radius, random(), spillDebt)) {
        spillDebt -= area
        return false
      }
      spillDebt = 0
      return true
    }

    /** Settled snow thrown back into the air: as many clumps as it takes, or none if there is no room for them all. */
    const thrower =
      (vx: number, lift: number, clump: number): SnowEmit =>
      (x, y, direction, area) => {
        const count = Math.max(1, Math.ceil(area / flakeArea(clump)))
        if (flakes.capacity - flakes.count < count) return false
        const each = area / count
        const radius = clamp(radiusForArea(each), 0.8, clump)
        for (let k = 0; k < count; k++) {
          flakes.spawn(
            x + (random() - 0.5) * SNOW_COLUMN * 3,
            y - random() * 3,
            vx * (0.3 + random() * 0.55) + direction * (15 + random() * 55),
            -(50 + random() * 110) - lift * (0.5 + random()),
            radius,
            random(),
            each,
          )
        }
        return true
      }

    /* ------------------------------------------------------------ physics */

    const step = (dt: number) => {
      const s = live.current
      time += dt
      const blow = clamp(s.wind, -1, 1)
      const steady = blow * 95
      const turbulence = 0.45 + Math.abs(blow) * 0.6

      if (s.intensity > 0) {
        spawnDebt = Math.min(8, spawnDebt + s.intensity * dt)
        // With a side wind, flakes that reach the far side start upwind of the region, or that side would stay bare.
        const reach = Math.abs(blow) * height * 0.9
        while (spawnDebt >= 1 && !flakes.full) {
          spawnDebt -= 1
          const across = random() * (width + reach)
          // Many small flakes, few large ones: a power law on the radius.
          const radius = 0.8 + 2.8 * Math.pow(random(), 2.2)
          flakes.spawn(blow >= 0 ? across - reach : across, -6 - random() * 30, steady, 30, radius, random())
        }
      }

      ageGusts(gusts, dt)
      const { x, y, vx, vy, radius, phase, mass } = flakes
      for (let i = flakes.count - 1; i >= 0; i--) {
        const r = radius[i]!
        const p = phase[i]!
        curlAt(x[i]!, y[i]!, time, turbulence, air)
        air[0] += steady
        if (gusts.length) addGusts(gusts, x[i]!, y[i]!, air)
        // A falling flake tumbles and rocks side to side; small, light flakes rock the most.
        const flutter = Math.sin(time * (1.5 + p * 1.6) + p * 40) * (24 / (r + 0.6))
        // Terminal speed relative to the air, and linear drag towards it with a response time that grows with size.
        const fall = 24 + r * 13
        const k = Math.min(1, (dt * 7) / (0.6 + r))
        vx[i] = vx[i]! + (air[0] + flutter - vx[i]!) * k
        vy[i] = vy[i]! + (air[1] + fall - vy[i]!) * k
        const before = y[i]!
        const nx = x[i]! + vx[i]! * dt
        const ny = before + vy[i]! * dt
        x[i] = nx
        y[i] = ny
        if (ny > height + 8 || ny < -height || nx < -width - 60 || nx > width * 2 + 60) {
          flakes.remove(i)
          continue
        }
        if (!s.accumulate) continue
        const c = field.columnAt(nx)
        if (c < 0 || c >= field.cols) continue
        const top = field.top(c)
        if (ny < top) continue
        // Land if it is inside this column’s snow, or crossed its surface this frame. A flake below an element’s top
        // edge came in from the side, in front of the element: it keeps falling, and snow never forms under a card.
        if (ny <= field.ground[c]! + 1 || before <= top + 1) {
          field.deposit(c, mass[i]!, s.maxDepth)
          flakes.remove(i)
        }
      }

      if (s.accumulate) field.relax(2, s.maxDepth, spill)
      field.melt(s.melt, dt)
    }

    /* ------------------------------------------------------------ drawing */

    /** The snow’s surface from column `start` to `end` (exclusive), as a curve through the column midpoints. */
    const traceTop = (start: number, end: number, move: boolean) => {
      const { ground, display } = field
      let px = start * SNOW_COLUMN
      let py = ground[start]! - display[start]!
      if (move) context.moveTo(px, py)
      else context.lineTo(px, py)
      for (let c = start; c < end; c++) {
        const cx = (c + 0.5) * SNOW_COLUMN
        const cy = ground[c]! - display[c]!
        context.quadraticCurveTo(px, py, (px + cx) / 2, (py + cy) / 2)
        px = cx
        py = cy
      }
      context.lineTo(end * SNOW_COLUMN, ground[end - 1]! - display[end - 1]!)
    }

    const drawDrifts = (colours: Palette) => {
      field.smooth()
      const { ground, display, onElement, cols } = field
      let c = 0
      while (c < cols) {
        if (display[c]! < 0.35) {
          c++
          continue
        }
        // A run is a stretch of visible snow on one surface; it breaks where the ground steps.
        const start = c
        let highest = Infinity
        let lowest = -Infinity
        while (c < cols && display[c]! >= 0.35 && (c === start || Math.abs(ground[c]! - ground[c - 1]!) < SAME_GROUND)) {
          highest = Math.min(highest, ground[c]! - display[c]!)
          lowest = Math.max(lowest, ground[c]!)
          c++
        }
        const end = c

        // Body: the top curve, then back along the ground a pixel low so there is no seam against the element.
        context.beginPath()
        traceTop(start, end, true)
        for (let k = end - 1; k >= start; k--) context.lineTo((k + 0.5) * SNOW_COLUMN, ground[k]! + 1)
        context.lineTo(start * SNOW_COLUMN, ground[start]! + 1)
        context.closePath()
        const body = context.createLinearGradient(0, highest, 0, lowest + 1)
        body.addColorStop(0, rgba(colours.crest, 1))
        body.addColorStop(0.45, rgba(colours.crest, 0.97))
        body.addColorStop(1, rgba(colours.shade, 0.96))
        context.fillStyle = body
        context.fill()

        // Contact shadow on the element’s face, which is what makes the snow sit on it rather than float over it.
        if (onElement[start]) {
          context.beginPath()
          context.moveTo(start * SNOW_COLUMN, ground[start]! + 1.5)
          for (let k = start; k < end; k++) context.lineTo((k + 0.5) * SNOW_COLUMN, ground[k]! + 1.5)
          context.lineTo(end * SNOW_COLUMN, ground[end - 1]! + 1.5)
          context.strokeStyle = rgba(colours.contact, colours.dark ? 0.45 : 0.14)
          context.lineWidth = 2
          context.stroke()
        }

        // Crest: a soft edge — a faint glow, then a fine line in the edge colour.
        context.beginPath()
        traceTop(start, end, true)
        context.shadowColor = rgba(colours.crest, colours.dark ? 0.55 : 0.9)
        context.shadowBlur = colours.dark ? 8 : 4
        context.strokeStyle = rgba(colours.edge, colours.dark ? 0.5 : 0.55)
        context.lineWidth = 1.1
        context.stroke()
        context.shadowBlur = 0
        context.shadowColor = 'transparent'
      }
    }

    /** Flakes in three passes by size, so there are three fills a frame rather than a thousand. Small reads as far. */
    const drawFlakes = (colours: Palette) => {
      const { x, y, radius, count } = flakes
      const bands: [number, number, number][] = [
        [0, 1.4, 0.5],
        [1.4, 2.3, 0.72],
        [2.3, Infinity, 0.92],
      ]
      for (const [low, high, alpha] of bands) {
        context.beginPath()
        for (let i = 0; i < count; i++) {
          const r = radius[i]!
          if (r < low || r >= high) continue
          context.moveTo(x[i]! + r, y[i]!)
          context.arc(x[i]!, y[i]!, r, 0, TAU)
        }
        context.fillStyle = rgba(colours.flake, alpha)
        context.fill()
      }
    }

    const render = () => {
      if (!palette) readPalette()
      if (!palette || width < 1 || height < 1) return
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(scale, 0, 0, scale, 0, 0)
      drawDrifts(palette)
      if (!live.current.reduced) drawFlakes(palette)
    }

    function requestDraw() {
      if (!drawFrame && !loopFrame) {
        drawFrame = requestAnimationFrame(() => {
          drawFrame = 0
          render()
        })
      }
    }

    /* ------------------------------------------------------------ loop */

    /** Nothing falling, nothing to melt and no snow on the way: the loop can rest until something changes. */
    const quiet = () => {
      const s = live.current
      return s.intensity <= 0 && flakes.count === 0 && gusts.length === 0 && (s.melt <= 0 || field.empty)
    }

    const running = () => {
      const s = live.current
      return !s.paused && !s.reduced && visible && !document.hidden && width >= 1 && !quiet()
    }

    const loop = (now: number) => {
      loopFrame = 0
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      step(dt)
      render()
      if (running()) loopFrame = requestAnimationFrame(loop)
      else {
        last = 0
        requestDraw()
      }
    }

    /** The reduced-motion still: nothing in the air, and the snow already down. */
    const enterStill = () => {
      flakes.clear()
      gusts.length = 0
      const s = live.current
      const target = Math.max(s.depth, s.maxDepth * 0.5)
      let total = 0
      for (let c = 0; c < field.cols; c++) total += field.depth[c]!
      const mean = field.cols ? total / field.cols : 0
      if (mean < target * 0.5) field.settle(target - mean, s.maxDepth, settleSeed++)
      state.still = true
    }

    function sync() {
      const s = live.current
      for (let c = 0; c < field.cols; c++) if (field.depth[c]! > s.maxDepth) field.depth[c] = s.maxDepth
      if (s.reduced && !state.still && field.cols) enterStill()
      if (!s.reduced) state.still = false
      if (running()) {
        if (!loopFrame) {
          cancelAnimationFrame(drawFrame)
          drawFrame = 0
          last = 0
          loopFrame = requestAnimationFrame(loop)
        }
      } else {
        cancelAnimationFrame(loopFrame)
        loopFrame = 0
        last = 0
        requestDraw()
      }
    }

    /* ------------------------------------------------------------ observers */

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            requestMeasure()
          })
    resizeObserver?.observe(region)
    readPalette()
    measure()
    sync()

    // Scrolling inside the region moves its elements relative to it; so can a sticky child when the page scrolls.
    const onScroll = () => {
      if (visible) requestMeasure()
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    // A card that opens, a class that moves something, an element added or removed: measure again.
    const mutations = new MutationObserver(requestMeasure)
    mutations.observe(content, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'open', 'hidden', 'data-snow'],
    })

    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting)
            if (visible) requestMeasure()
            sync()
          })
    intersection?.observe(region)
    const onVisibility = () => sync()
    document.addEventListener('visibilitychange', onVisibility)

    /* ------------------------------------------------------------ api */

    api.current = {
      gust: () => {
        const s = live.current
        if (!field.cols) return
        if (s.reduced) {
          // No flakes under reduced motion: the gust takes most of the snow away at once.
          for (let c = 0; c < field.cols; c++) field.depth[c] = field.depth[c]! * 0.3
          requestDraw()
          return
        }
        const direction = s.wind < 0 ? -1 : 1
        const radius = Math.max(90, height * 0.4)
        for (let k = 0; k < 5; k++) {
          gusts.push({
            x: ((k + 0.5) / 5) * width,
            y: height * (0.35 + random() * 0.5),
            vx: direction * 480,
            vy: -150,
            radius,
            age: 0,
            life: 1.2,
            spin: direction * 140,
          })
        }
        // Every column, in a shuffled order, so if the air fills up the snow left behind is spread out, not one side.
        const order = Array.from({ length: field.cols }, (_, c) => c)
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1))
          ;[order[i], order[j]] = [order[j]!, order[i]!]
        }
        const throwUp = thrower(direction * 420, 160, GUST_CLUMP)
        for (const c of order) {
          const d = field.depth[c]!
          if (d < 0.2) continue
          const take = d * 0.75
          if (!throwUp((c + 0.5) * SNOW_COLUMN, field.top(c), direction, take * SNOW_COLUMN)) continue
          field.depth[c] = d - take
        }
        sync()
      },
      clear: () => {
        field.clear()
        flakes.clear()
        gusts.length = 0
        spillDebt = 0
        state.still = live.current.reduced
        sync()
        requestDraw()
      },
      snow: () => {
        field.settle(live.current.maxDepth * 0.22, live.current.maxDepth, settleSeed++)
        requestDraw()
      },
      sync,
      repaint: () => {
        readPalette()
        requestDraw()
      },
      sweep: (clientX, clientY, now) => {
        const s = live.current
        if (!s.interactive || s.reduced || s.paused || !field.cols) return
        const box = region.getBoundingClientRect()
        const x = clientX - box.left
        const y = clientY - box.top
        const before = pointer
        pointer = { x, y, time: now }
        if (!before) return
        const dt = (now - before.time) / 1000
        if (dt <= 0 || dt > 0.2) return
        const vx = (x - before.x) / Math.max(0.008, dt)
        const vy = (y - before.y) / Math.max(0.008, dt)
        const speed = Math.hypot(vx, vy)
        // A slow hand is someone reading, not sweeping.
        if (speed < 90) return
        const push = Math.min(1, 900 / speed) * 0.55
        gusts.push({ x, y, vx: vx * push, vy: vy * push, radius: 55 + Math.min(80, speed * 0.04), age: 0, life: 0.6, spin: Math.sign(vx) * Math.min(160, speed * 0.08) })
        if (gusts.length > 24) gusts.shift()
        field.lift(x, y, 34 + Math.min(40, speed * 0.02), Math.min(7, speed * 0.005), thrower(vx * push, Math.min(220, speed * 0.1), SWEEP_CLUMP))
        sync()
      },
      release: () => {
        pointer = null
      },
    }
    sync()

    return () => {
      cancelAnimationFrame(loopFrame)
      cancelAnimationFrame(drawFrame)
      cancelAnimationFrame(measureFrame)
      resizeObserver?.disconnect()
      mutations.disconnect()
      intersection?.disconnect()
      window.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('visibilitychange', onVisibility)
      api.current = { gust: () => {}, clear: () => {}, snow: () => {}, sync: () => {}, repaint: () => {}, sweep: () => {}, release: () => {} }
    }
  }, [selector, sim])

  // Listening on the region, not the canvas: nothing is captured and nothing is prevented, so links, buttons and
  // text selection underneath behave exactly as they would with no snow at all.
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactive) api.current.sweep(event.clientX, event.clientY, event.timeStamp)
  }
  const onPointerLeave = () => api.current.release()

  const letItSnow = () => {
    api.current.snow()
    setAnnouncement('Another layer of snow has settled.')
  }
  const gustFromKeyboard = () => {
    api.current.gust()
    setAnnouncement('A gust blew the snow back into the air.')
  }

  return (
    <div
      ref={regionRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn('relative isolate overflow-hidden', className)}
    >
      <div ref={contentRef} className="contents">
        {children}
      </div>
      <canvas
        ref={canvasRef}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className="pointer-events-none absolute inset-0 z-10 block size-full"
      />
      {reduced ? (
        <Button size="sm" variant="white" onClick={letItSnow} className="absolute bottom-3 right-3 z-20">
          Let it snow
        </Button>
      ) : interactive ? (
        // The keyboard route to a sweep: out of sight until it has focus, so it adds no chrome for pointer users.
        <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:right-3 focus-within:top-3 focus-within:z-20">
          <Button size="sm" variant="white" onClick={gustFromKeyboard}>
            Blow the snow off
          </Button>
        </div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
})
