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
import { Slider } from '../Slider'
import {
  angleBetween,
  createRayBuffer,
  DEFAULT_SIZE,
  minimumDeviation,
  refractiveIndex,
  SODIUM_D,
  spectrum,
  toBody,
  traceRay,
  type PrismLightElement,
  type PrismLightElementKind,
  type PrismLightGlass,
} from './optics'

export type { PrismLightElement, PrismLightElementKind, PrismLightGlass } from './optics'

export interface PrismLightBeam {
  /** Where the source sits, from 0 (left edge of the bench) to 1 (right edge). */
  x: number
  /** Where the source sits, from 0 (top) to 1 (bottom). */
  y: number
  /** Direction in degrees, anticlockwise from pointing right. */
  angle: number
  /** Width in CSS pixels. A wide beam is traced as several parallel rays, which is what lets a lens bring it to a focus. */
  width?: number
  /** `'white'` for the whole visible spectrum, or one wavelength in nanometres (380–700). */
  light?: 'white' | number
}

export interface PrismLightHandle {
  /** Put the elements and the beam back where they started and restart the idle sweep. */
  reset: () => void
  /** Turn the beam to the angle that bends it least — the prism’s minimum deviation — and return that angle, or null if the beam can reach no glass. */
  findMinimumDeviation: () => number | null
}

export interface PrismLightProps {
  /** Controlled optical elements. Positions are fractions of the bench, so they survive resizes. */
  elements?: PrismLightElement[]
  /** Elements for uncontrolled use. Defaults to one equilateral prism. */
  defaultElements?: PrismLightElement[]
  /** Called with the new elements whenever one is dragged, turned or nudged from the keyboard. */
  onElementsChange?: (elements: PrismLightElement[]) => void
  /** Controlled beam: source position, direction, width and light. */
  beam?: PrismLightBeam
  /** Beam for uncontrolled use. */
  defaultBeam?: PrismLightBeam
  /** Called when the slider, a drag across the bench or the source’s handle changes the beam. */
  onBeamChange?: (beam: PrismLightBeam) => void
  /**
   * Dense flint (n_d 1.767, Abbe 30), crown (n_d 1.517, Abbe 64 — about half
   * the spread), or a fixed index with no dispersion at all. Flint is the
   * default because it is what a dispersing prism is actually made of: crown
   * is the reference glass, but its 1.4° fan is a few pixels of colour at the
   * edges of a white beam, where flint’s 11° is a spectrum.
   */
  glass?: PrismLightGlass
  /** Wavelengths sampled across 380–700 nm for white light, 3–64. More is a smoother spectrum and costs more. */
  rays?: number
  /** Split every ray at every face by the Fresnel equations, so the faint partial reflections appear. */
  fresnel?: boolean
  /** Let the pointer and keyboard move and turn the elements and aim the beam. */
  interactive?: boolean
  /** Swing the beam ±5° back and forth, so the fan moves, until the first touch. Ignored under reduced motion. */
  sweep?: boolean
  /** Hold the sweep, and any glide towards a new angle, where they are. */
  paused?: boolean
  /** Width over height of the bench. */
  aspectRatio?: number
  /** Show the beam-angle slider and the buttons under the bench. */
  controls?: boolean
  /** Accessible name of the bench. An empty string makes the drawing decorative. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

type Rgb = [number, number, number]

/**
 * The default scene is composed around the exit beam, not the prism.
 *
 * The fan leaves the glass at a fixed angle — about 11° in flint here — so how
 * much of a spectrum you actually see is how far it travels before the frame
 * stops it. The prism therefore sits in the left third with the source tucked
 * into the corner behind it, which buys the fan the full width of the bench:
 * roughly 120 pixels of spectrum rather than the 18 it gets on a short throw.
 */
const DEFAULT_ELEMENTS: PrismLightElement[] = [{ id: 'prism', kind: 'prism', x: 0.3, y: 0.46, rotation: 0, size: 0.46 }]
const DEFAULT_BEAM: PrismLightBeam = { x: 0.05, y: 0.66, angle: 31, width: 6, light: 'white' }
const KIND_NAMES: Record<PrismLightElementKind, string> = { prism: 'Prism', lens: 'Lens', slab: 'Glass slab', mirror: 'Mirror' }
/** The slider’s range. Pointer aiming is not held to it, so a beam can be sent backwards at a mirror. */
const ANGLE_MIN = -90
const ANGLE_MAX = 90
/**
 * The idle sweep: ±5° either side of the set angle over ten seconds.
 *
 * It used to be ±9°, which was wide enough to swing the default scene past the
 * critical angle and back — the fan vanished into a total reflection twice a
 * cycle, which reads as a fault rather than as physics. Five degrees keeps the
 * spectrum on the bench the whole way round; the slider still reaches
 * everything, and the button goes straight to minimum deviation.
 */
const SWEEP_AMPLITUDE = 5
const SWEEP_PERIOD = 10
/**
 * How far the drawing is overexposed. At 1 the white beam is exactly white
 * and each separated colour is a thirtieth of it — true, and too dim to read.
 * Like a photograph of a prism, the beam is allowed to clip so the fan shows.
 */
const EXPOSURE = 2.4

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const css = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`
const mix = (a: Rgb, b: Rgb, t: number) => a.map((value, i) => Math.round(value + (b[i] - value) * t)) as Rgb
const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
/** Degrees into (−180, 180], to one decimal. */
const wrapAngle = (degrees: number) => {
  let wrapped = ((degrees % 360) + 360) % 360
  if (wrapped > 180) wrapped -= 360
  return Math.round(wrapped * 10) / 10
}
/** The key the source’s handle is filed under; element ids are never empty. */
const SOURCE = ''
const percent = (fraction: number) => Math.round(fraction * 100)
const isWhite = (beam: PrismLightBeam) => beam.light === undefined || beam.light === 'white'

interface Analysis {
  /** The beam reached glass or a mirror and came out again. */
  hit: boolean
  /** Deviation of the reference wavelength, in degrees. */
  deviation: number
  /** Angle between the 400 nm and 700 nm rays leaving the glass; null for one wavelength or no dispersion. */
  fan: number | null
  tir: boolean
  /** Refractive index at the reference wavelength. */
  index: number
  /** The closed-form minimum deviation, when the bench holds just one prism. */
  minimum: number | null
}

const probeBuffer = createRayBuffer(512)

/**
 * The numbers for the readout, the status and the slider’s value text: the
 * central ray traced at the sodium D line (or the beam’s own wavelength), and
 * at 400 and 700 nm for the width of the fan.
 */
function analyse(
  elements: PrismLightElement[],
  beam: PrismLightBeam,
  glass: PrismLightGlass,
  fresnel: boolean,
  width: number,
  height: number,
  angle: number,
): Analysis {
  const bodies = elements.map((element) => toBody(element, width, height))
  const radians = (angle * Math.PI) / 180
  const dx = Math.cos(radians)
  const dy = -Math.sin(radians)
  const white = isWhite(beam)
  const reference = white ? SODIUM_D : (beam.light as number)
  const probe = (nm: number) => {
    probeBuffer.count = 0
    return traceRay(beam.x * width, beam.y * height, dx, dy, { bodies, width, height, index: refractiveIndex(glass, nm), fresnel }, probeBuffer)
  }
  const main = probe(reference)
  const index = refractiveIndex(glass, reference)
  const hit = main.exitIntensity > 0
  let fan: number | null = null
  let tir = main.totalReflection
  if (hit && white && typeof glass !== 'number') {
    const violet = probe(400)
    const red = probe(700)
    tir = tir || violet.totalReflection
    if (violet.exitIntensity > 0 && red.exitIntensity > 0) fan = Math.abs(angleBetween(red.exitX, red.exitY, violet.exitX, violet.exitY))
  }
  const onePrism = elements.length === 1 && elements[0].kind === 'prism'
  return {
    hit,
    deviation: hit ? Math.abs(angleBetween(dx, dy, main.exitX, main.exitY)) : 0,
    fan,
    tir,
    index,
    minimum: onePrism ? minimumDeviation(index) : null,
  }
}

function describe(analysis: Analysis, angle: number): string {
  if (!analysis.hit) return `Beam at ${angle.toFixed(1)}°, missing the glass`
  let text = `Beam at ${angle.toFixed(1)}°, deviated ${analysis.deviation.toFixed(1)}°`
  if (analysis.fan !== null) text += `, colours fanned over ${analysis.fan.toFixed(1)}°`
  if (analysis.tir) text += ', with total internal reflection'
  return text
}

type Drag =
  | { kind: 'move'; target: string | null; pointer: number }
  | { kind: 'turn'; target: string; pointer: number; cx: number; cy: number; from: number; start: number }
  | { kind: 'aim'; pointer: number }

/**
 * A beam of light through glass you can move and turn, traced one wavelength
 * at a time.
 *
 * White light is not drawn as a rainbow. It is thirty-odd separate rays, one
 * per sampled wavelength, all leaving the source along the same line; each
 * gets its own refractive index from Cauchy’s equation, bends by Snell’s law
 * at every face it meets, and is drawn additively in its own CIE colour. Where
 * the rays still coincide they sum to white; where the glass has pulled them
 * apart they show as a spectrum. Nothing paints the fan — the dispersion does.
 *
 * Total internal reflection is not a rule either: past the critical angle the
 * refraction formula has no real solution, and the tracer reflects. Turn the
 * prism until the exit face goes silver, or swap crown for flint — whose
 * critical angle is 34° rather than 41° — and watch the beam that got through
 * a moment ago turn back inside the glass. The Fresnel equations split the
 * light at every face, so the faint first-surface reflection is there too.
 *
 * The bench is dark in both themes, because additive light needs darkness to
 * add to; it is mixed from the ink and surface tokens and tinted by the accent,
 * so it still belongs to the theme. Drawing happens only when something
 * changed — the idle sweep is the only loop, and it stops at the first touch,
 * off screen, in a hidden tab and under reduced motion.
 *
 * While `interactive`, a touch drag on the bench aims or turns rather than
 * scrolling the page; every handle is also a button the arrow keys move.
 */
export const PrismLight = forwardRef<PrismLightHandle, PrismLightProps>(function PrismLight(
  {
    elements: elementsProp,
    defaultElements = DEFAULT_ELEMENTS,
    onElementsChange,
    beam: beamProp,
    defaultBeam = DEFAULT_BEAM,
    onBeamChange,
    glass = 'flint',
    rays = 32,
    fresnel = true,
    interactive = true,
    sweep = true,
    paused = false,
    aspectRatio = 16 / 9,
    controls = true,
    label = 'Optical bench',
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const hintId = useId()
  const [elementsState, setElementsState] = useState(defaultElements)
  const elements = elementsProp ?? elementsState
  const [beamState, setBeamState] = useState(defaultBeam)
  const beam = beamProp ?? beamState
  const [size, setSize] = useState({ width: 960, height: 960 / aspectRatio })
  const [chrome, setChrome] = useState<string>()
  const [status, setStatus] = useState('')

  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)
  const tirRef = useRef<HTMLSpanElement>(null)
  const handleRefs = useRef(new Map<string, HTMLButtonElement>())
  const action = useRef('')

  const single = isWhite(beam) ? undefined : clamp(beam.light as number, 380, 700)
  const samples = useMemo(() => spectrum(clamp(Math.round(rays), 3, 64), single), [rays, single])

  const sim = useRef({
    width: 0,
    height: 0,
    ratio: 1,
    /** Degrees added to the set angle by the sweep or a glide. */
    offset: 0,
    phase: 0,
    sweeping: false,
    touched: false,
    visible: true,
    loop: 0,
    pending: 0,
    last: 0,
    focused: null as string | null,
    drag: null as Drag | null,
    palette: { bench: 'black', chrome: 'white', accent: 'white' },
    buffer: createRayBuffer(),
    /** Start the loop if there is motion for it to run. */
    animate: () => {},
    /** Repaint on the next frame, and start the loop if it is wanted. */
    wake: () => {},
  })
  // Everything the renderer reads, in one ref, so a change repaints without rebuilding observers.
  const live = useRef({ elements, beam, glass, fresnel, samples, paused, reduced })
  live.current = { elements, beam, glass, fresnel, samples, paused, reduced }

  const commitElements = useCallback(
    (next: PrismLightElement[]) => {
      live.current.elements = next
      if (elementsProp === undefined) setElementsState(next)
      onElementsChange?.(next)
    },
    [elementsProp, onElementsChange],
  )

  const commitBeam = useCallback(
    (next: PrismLightBeam) => {
      live.current.beam = next
      if (beamProp === undefined) setBeamState(next)
      onBeamChange?.(next)
    },
    [beamProp, onBeamChange],
  )

  /** The first touch ends the idle sweep for good. `settle` drops the offset at once, for when the beam itself is being aimed. */
  const touch = (settle: boolean) => {
    const s = sim.current
    s.touched = true
    s.sweeping = false
    if (settle) s.offset = 0
  }

  /* ------------------------------------------------------------ drawing */

  const paint = useCallback(() => {
    const s = sim.current
    const { width, height, ratio, palette } = s
    if (!width || !height) return
    const state = live.current
    const angle = state.beam.angle + s.offset
    const analysis = analyse(state.elements, state.beam, state.glass, state.fresnel, width, height, angle)

    const readout = readoutRef.current
    if (readout) {
      const parts = [`beam ${angle.toFixed(1)}°`]
      if (analysis.hit) {
        parts.push(`deviation ${analysis.deviation.toFixed(1)}°`)
        if (analysis.minimum !== null) parts.push(`minimum ${analysis.minimum.toFixed(1)}°`)
        if (analysis.fan !== null) parts.push(`fan ${analysis.fan.toFixed(2)}°`)
      } else parts.push('misses the glass')
      parts.push(`n ${analysis.index.toFixed(3)}`)
      readout.textContent = parts.join('  ·  ')
    }
    if (tirRef.current) tirRef.current.hidden = !analysis.tir

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
    context.fillStyle = palette.bench
    context.fillRect(0, 0, width, height)

    // The tapped holes of an optical table, faint: they give the eye a grid to judge angles against.
    context.fillStyle = palette.chrome
    context.globalAlpha = 0.07
    context.beginPath()
    for (let x = 12; x < width; x += 24) for (let y = 12; y < height; y += 24) context.rect(x - 0.75, y - 0.75, 1.5, 1.5)
    context.fill()

    const bodies = state.elements.map((element) => toBody(element, width, height))
    bodies.forEach((body, index) => {
      context.beginPath()
      context.moveTo(body.xs[0], body.ys[0])
      for (let i = 1; i < body.count; i++) context.lineTo(body.xs[i], body.ys[i])
      context.closePath()
      if (body.mirror) {
        context.globalAlpha = 0.85
        context.fillStyle = palette.chrome
        context.fill()
      } else {
        context.globalAlpha = 0.1
        context.fillStyle = palette.accent
        context.fill()
        context.globalAlpha = 0.05
        context.fillStyle = palette.chrome
        context.fill()
      }
      const focused = s.focused === state.elements[index].id
      context.globalAlpha = focused ? 0.95 : 0.45
      context.strokeStyle = focused ? palette.accent : palette.chrome
      context.lineWidth = focused ? 1.5 : 1
      context.stroke()
    })

    // The source: a housing behind the aperture, pointing along the beam.
    const radians = (angle * Math.PI) / 180
    const dx = Math.cos(radians)
    const dy = -Math.sin(radians)
    const ox = state.beam.x * width
    const oy = state.beam.y * height
    const beamWidth = clamp(state.beam.width ?? 8, 1, 80)
    context.save()
    context.translate(ox, oy)
    context.rotate(-radians)
    context.globalAlpha = 0.8
    context.fillStyle = palette.chrome
    context.fillRect(-30, -(beamWidth / 2 + 5), 28, beamWidth + 10)
    if (s.focused === SOURCE) {
      context.globalAlpha = 0.95
      context.strokeStyle = palette.accent
      context.lineWidth = 1.5
      context.strokeRect(-31.5, -(beamWidth / 2 + 6.5), 31, beamWidth + 13)
    }
    context.globalAlpha = 1
    context.fillStyle = palette.accent
    context.fillRect(-4, -beamWidth / 2 - 1, 4, beamWidth + 2)
    context.restore()

    // The light. Every wavelength, and every parallel strip of a wide beam, is its own ray.
    context.globalCompositeOperation = 'lighter'
    context.lineCap = 'butt'
    const strips = clamp(Math.round(beamWidth / 3), 1, 15)
    const strip = beamWidth / strips
    const halo = strip + 6
    const haloShare = 0.12 / Math.sqrt(strips)
    const { buffer } = s
    const data = buffer.data
    for (const sample of state.samples) {
      const options = { bodies, width, height, index: refractiveIndex(state.glass, sample.nm), fresnel: state.fresnel }
      context.strokeStyle = css(sample.rgb)
      for (let k = 0; k < strips; k++) {
        const across = (k - (strips - 1) / 2) * strip
        buffer.count = 0
        traceRay(ox - dy * across, oy + dx * across, dx, dy, options, buffer)
        for (let i = 0; i < buffer.count; i++) {
          const o = i * 5
          const strength = Math.min(1, sample.alpha * data[o + 4] * EXPOSURE)
          if (strength < 0.004) continue
          context.beginPath()
          context.moveTo(data[o], data[o + 1])
          context.lineTo(data[o + 2], data[o + 3])
          context.globalAlpha = strength * haloShare
          context.lineWidth = halo
          context.stroke()
          context.globalAlpha = strength
          context.lineWidth = strip
          context.stroke()
        }
      }
    }
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
  }, [])

  /* --------------------------------------------------------------- loop */

  // One loop, alive only while the sweep or a glide is moving the beam, on screen, in a visible tab.
  useEffect(() => {
    const s = sim.current
    const stage = stageRef.current
    const tick = (now: number) => {
      s.loop = 0
      const { paused: frozen, reduced: still } = live.current
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60
      s.last = now
      const sweeping = s.sweeping && !frozen && !still
      if (sweeping) {
        s.phase += (dt * 2 * Math.PI) / SWEEP_PERIOD
        s.offset = SWEEP_AMPLITUDE * Math.sin(s.phase)
      } else if (!frozen) {
        s.offset *= Math.exp(-dt * 5)
        if (still || Math.abs(s.offset) < 0.01) s.offset = 0
      }
      paint()
      if (!frozen && (sweeping || s.offset !== 0) && s.visible && !document.hidden) s.loop = requestAnimationFrame(tick)
      else s.last = 0
    }
    /** Is there anything for the loop to move? */
    const moving = () => {
      const { paused: frozen, reduced: still } = live.current
      return !frozen && ((s.sweeping && !still) || s.offset !== 0)
    }
    s.animate = () => {
      if (!s.loop && moving() && s.visible && !document.hidden) {
        s.last = 0
        s.loop = requestAnimationFrame(tick)
      }
    }
    // A repaint with no motion behind it — a prop change, a drag, a handle
    // taking focus — is coalesced to one a frame. Motion, if any, is the loop’s.
    s.wake = () => {
      s.animate()
      if (s.loop || s.pending) return
      s.pending = requestAnimationFrame(() => {
        s.pending = 0
        paint()
      })
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = Boolean(entry?.isIntersecting)
            s.wake()
          })
    if (stage) observer?.observe(stage)
    const onVisibility = () => s.wake()
    document.addEventListener('visibilitychange', onVisibility)
    s.wake()
    return () => {
      cancelAnimationFrame(s.loop)
      cancelAnimationFrame(s.pending)
      s.loop = 0
      s.pending = 0
      s.wake = () => {}
      s.animate = () => {}
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [paint])

  useEffect(() => {
    const s = sim.current
    if (!sweep || reduced) {
      s.sweeping = false
      if (reduced) s.offset = 0
    } else if (!s.touched) s.sweeping = true
    s.wake()
  }, [sweep, reduced])

  useEffect(() => sim.current.wake(), [elements, beam, glass, fresnel, samples, paused])

  // Colours from tokens: the bench from ink and surface, whichever is darker; the glass edges from the lighter one.
  // Before the size effect, so the first frame is drawn in the theme's colours rather than repainted into them.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const ink = tokenRgb(stage, '--color-ink', [24, 24, 27])
    const surface = tokenRgb(stage, '--color-surface', [250, 250, 250])
    const accent = tokenRgb(stage, '--color-accent', [110, 110, 230])
    const [dark, light] = luminance(ink) < luminance(surface) ? [ink, surface] : [surface, ink]
    const bench = mix(mix(dark, light, 0.035), accent, 0.05)
    sim.current.palette = { bench: css(bench), chrome: css(light), accent: css(accent) }
    setChrome(css(light))
    // A new theme is a new picture, and waiting a frame to show it is a visible flash of the old one.
    paint()
    sim.current.animate()
  }, [themeVersion, paint])

  // Canvas size.
  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const s = sim.current
    const measure = () => {
      const width = stage.clientWidth
      const height = stage.clientHeight
      if (!width || !height) return
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      s.width = width
      s.height = height
      s.ratio = ratio
      const pixelWidth = Math.round(width * ratio)
      const pixelHeight = Math.round(height * ratio)
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      setSize((previous) => (Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1 ? previous : { width, height }))
      // Setting either dimension clears the canvas, so this one paints straight
      // away rather than asking for a frame: the bench is a still picture most
      // of the time, and a frame of nothing is the whole picture missing. It is
      // also the first frame, which would otherwise wait on a loop that only
      // runs when the beam is sweeping.
      paint()
      s.animate()
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [paint])

  /* --------------------------------------------------------- the handle */

  const findMinimumDeviation = useCallback((): number | null => {
    const s = sim.current
    const state = live.current
    const width = s.width || size.width
    const height = s.height || size.height
    const bodies = state.elements.map((element) => toBody(element, width, height))
    const nm = isWhite(state.beam) ? SODIUM_D : (state.beam.light as number)
    const options = { bodies, width, height, index: refractiveIndex(state.glass, nm), fresnel: state.fresnel }
    const deviationAt = (angle: number) => {
      const radians = (angle * Math.PI) / 180
      const dx = Math.cos(radians)
      const dy = -Math.sin(radians)
      probeBuffer.count = 0
      const result = traceRay(state.beam.x * width, state.beam.y * height, dx, dy, options, probeBuffer)
      // Only a beam that got through counts; a total reflection can come out at any angle at all.
      if (result.exitIntensity < 0.3 || result.totalReflection) return Infinity
      return Math.abs(angleBetween(dx, dy, result.exitX, result.exitY))
    }
    let best: number | null = null
    let least = Infinity
    for (let angle = ANGLE_MIN; angle <= ANGLE_MAX; angle += 0.5) {
      const deviation = deviationAt(angle)
      if (deviation < least) {
        least = deviation
        best = angle
      }
    }
    if (best === null) return null
    // Deviation is smooth and has one minimum near the best sample: a ternary search pins it down.
    let low = best - 0.5
    let high = best + 0.5
    for (let i = 0; i < 40; i++) {
      const a = low + (high - low) / 3
      const b = high - (high - low) / 3
      if (deviationAt(a) <= deviationAt(b)) high = b
      else low = a
    }
    const angle = Math.round(((low + high) / 2) * 10) / 10
    const shown = state.beam.angle + s.offset
    touch(true)
    // Glide there rather than jump, unless motion is reduced or held.
    if (!state.reduced && !state.paused) s.offset = shown - angle
    action.current = `Beam turned to ${angle.toFixed(1)}°, the angle of minimum deviation`
    commitBeam({ ...state.beam, angle })
    s.wake()
    return angle
  }, [commitBeam, size.width, size.height])

  const reset = useCallback(() => {
    const s = sim.current
    commitElements(defaultElements)
    commitBeam(defaultBeam)
    s.touched = false
    s.phase = 0
    s.offset = 0
    s.sweeping = sweep && !live.current.reduced
    action.current = 'Bench reset'
    s.wake()
  }, [commitElements, commitBeam, defaultElements, defaultBeam, sweep])

  useImperativeHandle(ref, () => ({ reset, findMinimumDeviation }), [reset, findMinimumDeviation])

  /* -------------------------------------------------------- interaction */

  const nameOf = (element: PrismLightElement) => element.label ?? KIND_NAMES[element.kind]

  const moveTo = (target: string | null, fx: number, fy: number) => {
    const x = clamp(fx, 0.02, 0.98)
    const y = clamp(fy, 0.02, 0.98)
    touch(false)
    if (target === null) {
      commitBeam({ ...live.current.beam, x, y })
      action.current = `Beam source at ${percent(x)}% across, ${percent(y)}% down`
      return
    }
    const next = live.current.elements.map((element) => (element.id === target ? { ...element, x, y } : element))
    const moved = next.find((element) => element.id === target)
    if (moved) action.current = `${nameOf(moved)} at ${percent(x)}% across, ${percent(y)}% down`
    commitElements(next)
  }

  const turnTo = (target: string | null, degrees: number) => {
    if (target === null) {
      touch(true)
      const angle = wrapAngle(degrees)
      commitBeam({ ...live.current.beam, angle })
      action.current = ''
      return
    }
    touch(false)
    const rotation = wrapAngle(degrees)
    const next = live.current.elements.map((element) => (element.id === target ? { ...element, rotation } : element))
    const turned = next.find((element) => element.id === target)
    if (turned) action.current = `${nameOf(turned)} turned to ${rotation.toFixed(0)}°`
    commitElements(next)
  }

  const pointFor = (event: { clientX: number; clientY: number }) => {
    const box = stageRef.current?.getBoundingClientRect()
    if (!box || !box.width || !box.height) return null
    const x = event.clientX - box.left
    const y = event.clientY - box.top
    return { x, y, fx: x / box.width, fy: y / box.height, width: box.width, height: box.height }
  }

  const aimAt = (point: { x: number; y: number; width: number; height: number }) => {
    const current = live.current.beam
    const dx = point.x - current.x * point.width
    const dy = point.y - current.y * point.height
    if (Math.hypot(dx, dy) < 6) return
    turnTo(null, (Math.atan2(-dy, dx) * 180) / Math.PI)
  }

  const onHandleDown = (target: string | null) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!interactive) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    sim.current.drag = { kind: 'move', target, pointer: event.pointerId }
  }

  const onStageDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button !== 0) return
    const point = pointFor(event)
    if (!point) return
    const s = sim.current
    // A press on, or just around, an element’s body turns it about its centre; anywhere else aims the beam.
    let found: PrismLightElement | null = null
    let nearest = Infinity
    for (const element of live.current.elements) {
      const reach = ((element.size ?? DEFAULT_SIZE[element.kind]) * point.height) / 2 + 6
      const distance = Math.hypot(point.x - element.x * point.width, point.y - element.y * point.height)
      if (distance < reach && distance < nearest) {
        nearest = distance
        found = element
      }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (found) {
      const cx = found.x * point.width
      const cy = found.y * point.height
      s.drag = { kind: 'turn', target: found.id, pointer: event.pointerId, cx, cy, from: Math.atan2(point.y - cy, point.x - cx), start: found.rotation ?? 0 }
      handleRefs.current.get(found.id)?.focus({ preventScroll: true })
    } else {
      s.drag = { kind: 'aim', pointer: event.pointerId }
      aimAt(point)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = sim.current.drag
    if (!drag || drag.pointer !== event.pointerId) return
    const point = pointFor(event)
    if (!point) return
    if (drag.kind === 'move') moveTo(drag.target, point.fx, point.fy)
    else if (drag.kind === 'aim') aimAt(point)
    else {
      // Screen angles run clockwise; rotations run anticlockwise.
      const now = Math.atan2(point.y - drag.cy, point.x - drag.cx)
      turnTo(drag.target, drag.start - ((now - drag.from) * 180) / Math.PI)
    }
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const s = sim.current
    if (s.drag?.pointer === event.pointerId) s.drag = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onHandleKey = (target: string | null) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!interactive) return
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const turns: Record<string, number> = { '[': 2, ']': -2, '{': 15, '}': -15 }
    const arrow = arrows[event.key]
    let turn = turns[event.key] ?? 0
    if (arrow && event.shiftKey) turn = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? 2 : -2
    if (!turn && !arrow) return
    event.preventDefault()
    const element = target === null ? null : live.current.elements.find((candidate) => candidate.id === target)
    const current = live.current.beam
    if (turn) turnTo(target, (target === null ? current.angle : (element?.rotation ?? 0)) + turn)
    else moveTo(target, (element ?? current).x + arrow[0] * 0.01, (element ?? current).y + arrow[1] * 0.01)
  }

  const onFocus = (target: string | null) => () => {
    sim.current.focused = target ?? SOURCE
    sim.current.wake()
  }
  const onBlur = () => {
    sim.current.focused = null
    sim.current.wake()
  }

  /* ---------------------------------------------------------- the words */

  const analysis = useMemo(
    () => analyse(elements, beam, glass, fresnel, size.width, size.height, beam.angle),
    [elements, beam, glass, fresnel, size.width, size.height],
  )
  const summary = describe(analysis, beam.angle)
  const key = `${summary}|${beam.x},${beam.y}|${elements.map((element) => `${element.x},${element.y},${element.rotation ?? 0}`).join(';')}`
  const announcedKey = useRef(key)

  // Speak once the bench has been still for half a second, not on every step of a drag.
  useEffect(() => {
    if (key === announcedKey.current) return
    const timer = setTimeout(() => {
      announcedKey.current = key
      setStatus(action.current ? `${action.current}. ${summary}.` : `${summary}.`)
      action.current = ''
    }, 500)
    return () => clearTimeout(timer)
  }, [key, summary])

  const handleClass = cn(
    'absolute grid size-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full',
    'active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  )

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div
        ref={stageRef}
        onPointerDown={onStageDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          'relative isolate w-full select-none overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-card)]',
          interactive && 'touch-none',
        )}
        style={{ aspectRatio, color: chrome }}
      >
        <canvas
          ref={canvasRef}
          role={label ? 'img' : undefined}
          aria-label={label ? `${label}: ${summary}.` : undefined}
          aria-hidden={label ? undefined : true}
          className="absolute inset-0 block size-full"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-2.5 flex items-start justify-between gap-3">
          <span ref={readoutRef} className="min-w-0 font-mono text-[11px] tabular-nums opacity-70" />
          <span ref={tirRef} hidden className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
            Total internal reflection
          </span>
        </div>
        {interactive ? (
          <>
            <span id={hintId} className="sr-only">
              Arrow keys move it. Shift with the arrow keys, or the bracket keys, turn it. With a pointer, drag a handle to move it, drag an element’s body to turn it, or
              drag across empty bench to aim the beam.
            </span>
            <button
              ref={(node) => {
                if (node) handleRefs.current.set(SOURCE, node)
                else handleRefs.current.delete(SOURCE)
              }}
              type="button"
              aria-label={`Beam source, ${percent(beam.x)}% across, ${percent(beam.y)}% down, aimed at ${beam.angle.toFixed(1)}°`}
              aria-describedby={hintId}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
              onPointerDown={onHandleDown(null)}
              onKeyDown={onHandleKey(null)}
              onFocus={onFocus(null)}
              onBlur={onBlur}
              className={handleClass}
              style={{ left: `${beam.x * 100}%`, top: `${beam.y * 100}%` }}
            >
              <span aria-hidden="true" className="size-3 rounded-full border-2 border-current bg-accent" />
            </button>
            {elements.map((element) => (
              <button
                key={element.id}
                ref={(node) => {
                  if (node) handleRefs.current.set(element.id, node)
                  else handleRefs.current.delete(element.id)
                }}
                type="button"
                aria-label={`${nameOf(element)}, ${percent(element.x)}% across, ${percent(element.y)}% down, turned ${Math.round(element.rotation ?? 0)}°`}
                aria-describedby={hintId}
                aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
                onPointerDown={onHandleDown(element.id)}
                onKeyDown={onHandleKey(element.id)}
                onFocus={onFocus(element.id)}
                onBlur={onBlur}
                className={handleClass}
                style={{ left: `${element.x * 100}%`, top: `${element.y * 100}%` }}
              >
                <span aria-hidden="true" className="size-2.5 rounded-full border border-current opacity-70" />
              </button>
            ))}
          </>
        ) : null}
      </div>

      {controls ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-[12px] font-semibold text-ink-soft">
              Beam angle <span className="font-mono font-normal tabular-nums text-ink-faint">{beam.angle.toFixed(1)}°</span>
            </span>
            <Slider
              min={ANGLE_MIN}
              max={ANGLE_MAX}
              step={0.5}
              value={clamp(beam.angle, ANGLE_MIN, ANGLE_MAX)}
              aria-valuetext={summary}
              onChange={(event) => turnTo(null, Number(event.target.value))}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => findMinimumDeviation()}>
              Find minimum deviation
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Reset
            </Button>
            <span className="ml-auto font-mono text-[12px] tabular-nums text-ink-faint">
              {typeof glass === 'number' ? `n ${glass.toFixed(3)}, no dispersion` : `${glass === 'flint' ? 'Dense flint' : 'Crown'} · n_d ${refractiveIndex(glass, SODIUM_D).toFixed(3)}`}
            </span>
          </div>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  )
})
