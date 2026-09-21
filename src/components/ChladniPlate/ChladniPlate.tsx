'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { tokenRgb, useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import type { IconComponent } from '../../lib/types'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Slider } from '../Slider'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'
import { amplitudeField, displacement, FIELD_SIZE, modesFor, nearestMode, type ChladniPlateMode, type ChladniPlateShape } from './modes'

export type ChladniPlateTone = 'ink' | 'accent'

export interface ChladniPlateProps {
  /** Square plate (cos·cos modes) or circular plate (Bessel modes). */
  shape?: ChladniPlateShape
  /** Controlled drive frequency in hertz. The nearest eigenmode sets the figure. */
  frequency?: number
  /** Uncontrolled starting frequency. Defaults to the tenth mode. */
  defaultFrequency?: number
  /** Called when the slider, the mode buttons or bowing change the frequency. */
  onFrequencyChange?: (frequency: number) => void
  /** Controlled drive state. Paused, the plate falls quiet and the sand stays where it is. */
  playing?: boolean
  /** Uncontrolled starting drive state. */
  defaultPlaying?: boolean
  /** Called when the play button toggles. */
  onPlayingChange?: (playing: boolean) => void
  /** Start muted. Sound only ever begins from a click on the sound button. */
  defaultMuted?: boolean
  /** Starting volume, 0–1. */
  defaultVolume?: number
  /** Number of grains. 5,000–20,000 reads best. */
  grains?: number
  /** Grain colour: the ink token or the accent. */
  tone?: ChladniPlateTone
  /** Multiplies how far grains hop. Higher forms figures faster and blurrier. */
  intensity?: number
  /** Maximum width in pixels. The plate is square and fills its container up to this. */
  size?: number
  /** Show the transport, frequency and sound controls. */
  controls?: boolean
  /** Accessible name for the plate. */
  label?: string
  className?: string
}

const SpeakerIcon: IconComponent = ({ size = 16, strokeWidth = 2, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M2.5 6h2.5l3.5-3v10l-3.5-3h-2.5z" />
    <path d="M11 5.5a3.5 3.5 0 010 5M12.8 3.6a6 6 0 010 8.8" />
  </svg>
)

const MutedIcon: IconComponent = ({ size = 16, strokeWidth = 2, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M2.5 6h2.5l3.5-3v10l-3.5-3h-2.5z" />
    <path d="M11 6l3.5 4M14.5 6L11 10" />
  </svg>
)

const describe = (mode: ChladniPlateMode, shape: ChladniPlateShape) =>
  shape === 'circle' ? `${mode.n} nodal diameters, radial mode ${mode.m}` : `mode (${mode.n}, ${mode.m})`

/**
 * Sand on a vibrating plate, collecting into the plate’s Chladni figure.
 *
 * Nothing draws the figure. Each grain hops a random distance proportional to how hard
 * the plate moves beneath it, so grains on antinodes are thrown about and grains on the
 * nodal lines barely move — and a random walk whose step shrinks to zero somewhere ends
 * up there. That is the real mechanism, which is why the figure scatters and re-forms
 * on its own when the frequency jumps to a new mode.
 *
 * The drive frequency snaps to the nearest eigenmode, and how close it sits to that
 * mode’s eigenfrequency sets how strongly the plate rings. Dragging along the rim
 * “bows” it: among the neighbouring modes, the one with the strongest antinode under
 * the bow wins, as with a real bow. The tone is a Web Audio oscillator, muted until
 * the sound button is pressed. Reduced motion draws the settled figure directly.
 */
export function ChladniPlate({
  shape = 'square',
  frequency: frequencyProp,
  defaultFrequency,
  onFrequencyChange,
  playing: playingProp,
  defaultPlaying = true,
  onPlayingChange,
  defaultMuted = true,
  defaultVolume = 0.4,
  grains = 12000,
  tone = 'ink',
  intensity = 1,
  size = 460,
  controls = true,
  label = 'Chladni plate',
  className,
}: ChladniPlateProps) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const modes = useMemo(() => modesFor(shape), [shape])
  const [internalFrequency, setInternalFrequency] = useState(() => defaultFrequency ?? modesFor(shape)[Math.min(9, modesFor(shape).length - 1)].frequency)
  const frequency = frequencyProp ?? internalFrequency
  const [internalPlaying, setInternalPlaying] = useState(defaultPlaying)
  const playing = playingProp ?? internalPlaying
  const [muted, setMuted] = useState(defaultMuted)
  const [volume, setVolume] = useState(defaultVolume)
  const [announcement, setAnnouncement] = useState('')
  const [bowPoint, setBowPoint] = useState<{ x: number; y: number } | null>(null)

  const modeIndex = nearestMode(modes, frequency)
  const mode = modes[modeIndex]
  const minF = modes[0].frequency * 0.92
  const maxF = modes[modes.length - 1].frequency * 1.04
  const toSlider = (f: number) => Math.round((Math.log(f / minF) / Math.log(maxF / minF)) * 1000)
  const fromSlider = (v: number) => minF * Math.pow(maxF / minF, v / 1000)
  const resonance = 0.25 + 0.75 / (1 + Math.pow(Math.log(frequency / mode.frequency) / 0.03, 2))

  const plateRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sim = useRef({
    xs: new Float32Array(0),
    ys: new Float32Array(0),
    field: new Float32Array(FIELD_SIZE * FIELD_SIZE),
    energy: 0,
    bow: 0,
    bowing: false,
    boost: 0,
    seed: 0x9e3779b9,
    image: null as ImageData | null,
    base: 0,
    frame: 0,
    running: false,
    visible: true,
    lastPick: { x: -1, y: -1 },
  })
  const audio = useRef<{ context: AudioContext; oscillator: OscillatorNode; gain: GainNode } | null>(null)
  const live = useRef({ playing, resonance, muted, volume, reduced, intensity, shape, modeIndex, modes, frequency })
  live.current = { playing, resonance, muted, volume, reduced, intensity, shape, modeIndex, modes, frequency }

  const setFrequency = useCallback(
    (next: number) => {
      if (frequencyProp === undefined) setInternalFrequency(next)
      onFrequencyChange?.(next)
    },
    [frequencyProp, onFrequencyChange],
  )

  /* ---------------------------------------------------------------- audio */

  const syncAudio = useCallback(() => {
    const node = audio.current
    if (!node) return
    const state = live.current
    const s = sim.current
    const audible = state.muted || !s.visible || document.hidden ? 0 : Math.min(1, state.playing ? state.resonance : s.energy)
    const now = node.context.currentTime
    node.oscillator.frequency.setTargetAtTime(state.frequency, now, 0.03)
    node.gain.gain.setTargetAtTime(audible * state.volume * 0.22, now, 0.06)
  }, [])

  const toggleSound = () => {
    const next = !muted
    setMuted(next)
    if (!next && !audio.current) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Context) return
      const context = new Context()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.value = 0
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      audio.current = { context, oscillator, gain }
    }
    if (!next) void audio.current?.context.resume()
  }

  useEffect(() => syncAudio(), [syncAudio, muted, volume, playing, frequency, resonance])

  useEffect(
    () => () => {
      const node = audio.current
      audio.current = null
      if (node) {
        node.oscillator.stop()
        void node.context.close()
      }
    },
    [],
  )

  /* ------------------------------------------------------------ drawing */

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const s = sim.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !s.image) return
    const width = s.image.width
    const data = s.image.data
    new Uint32Array(data.buffer).fill(s.base)
    const { xs, ys } = s
    for (let i = 0; i < xs.length; i++) {
      const px = xs[i] * width - 0.5
      const py = ys[i] * width - 0.5
      const x0 = px | 0
      const y0 = py | 0
      if (x0 < 0 || y0 < 0 || x0 >= width - 1 || y0 >= width - 1) continue
      const fx = px - x0
      const fy = py - y0
      const o = (y0 * width + x0) * 4 + 3
      const below = o + width * 4
      data[o] += (1 - fx) * (1 - fy) * 230
      data[o + 4] += fx * (1 - fy) * 230
      data[below] += (1 - fx) * fy * 230
      data[below + 4] += fx * fy * 230
    }
    context.putImageData(s.image, 0, 0)
  }, [])

  const random = () => {
    const s = sim.current
    s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0
    return s.seed / 4294967296
  }

  const place = (settled: boolean) => {
    const s = sim.current
    const round = live.current.shape === 'circle'
    for (let i = 0; i < s.xs.length; i++) {
      let x = 0.5
      let y = 0.5
      for (let attempt = 0; attempt < (settled ? 60 : 1); attempt++) {
        do {
          x = random()
          y = random()
        } while (round && Math.hypot(x - 0.5, y - 0.5) > 0.495)
        if (!settled) break
        const a = s.field[Math.min(FIELD_SIZE - 1, (y * FIELD_SIZE) | 0) * FIELD_SIZE + Math.min(FIELD_SIZE - 1, (x * FIELD_SIZE) | 0)]
        if (random() < Math.exp(-Math.pow(a / 0.045, 2))) break
      }
      s.xs[i] = x
      s.ys[i] = y
    }
  }

  /* --------------------------------------------------------------- loop */

  const step = useCallback((dt: number) => {
    const s = sim.current
    const state = live.current
    const target = Math.max(state.playing ? state.resonance : 0, Math.min(1.2, s.bow))
    s.energy += (target - s.energy) * (1 - Math.exp(-dt * 3.5))
    s.bow *= Math.exp(-dt / (s.bowing ? 1.6 : 0.7))
    s.boost *= Math.exp(-dt * 4.5)
    if (s.energy < 0.004 && s.boost < 0.004) return
    const G = FIELD_SIZE
    const field = s.field
    const hop = 0.02 * state.intensity * Math.min(3, dt * 60)
    const settle = 0.0006 * s.energy * Math.min(3, dt * 60)
    const round = state.shape === 'circle'
    const { xs, ys } = s
    let seed = s.seed
    for (let i = 0; i < xs.length; i++) {
      let x = xs[i]
      let y = ys[i]
      const gx = Math.min(G - 2, Math.max(1, (x * G) | 0))
      const gy = Math.min(G - 2, Math.max(1, (y * G) | 0))
      const k = gy * G + gx
      const reach = (field[k] * s.energy + s.boost + 0.015 * s.energy) * hop
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      x += (seed / 4294967296 - 0.5) * 2 * reach - (field[k + 1] - field[k - 1]) * settle
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      y += (seed / 4294967296 - 0.5) * 2 * reach - (field[k + G] - field[k - G]) * settle
      if (round) {
        const dx = x - 0.5
        const dy = y - 0.5
        const r = Math.hypot(dx, dy)
        if (r > 0.495) {
          const back = (0.99 - r) / r
          x = 0.5 + dx * back
          y = 0.5 + dy * back
        }
      } else {
        if (x < 0.002) x = 0.004 - x
        else if (x > 0.998) x = 1.996 - x
        if (y < 0.002) y = 0.004 - y
        else if (y > 0.998) y = 1.996 - y
      }
      xs[i] = x
      ys[i] = y
    }
    s.seed = seed
  }, [])

  const start = useCallback(() => {
    const s = sim.current
    if (s.running || live.current.reduced) return
    s.running = true
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      syncAudio()
      const state = live.current
      const awake = state.playing || s.energy > 0.004 || s.boost > 0.004 || s.bowing
      if (s.visible && !document.hidden && awake) s.frame = requestAnimationFrame(tick)
      else s.running = false
    }
    s.frame = requestAnimationFrame(tick)
  }, [draw, step, syncAudio])

  /* ------------------------------------------------------------ effects */

  // Grain buffers.
  useEffect(() => {
    const s = sim.current
    const count = Math.max(500, Math.min(40000, Math.round(grains)))
    s.xs = new Float32Array(count)
    s.ys = new Float32Array(count)
    place(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grains, shape])

  // The mode's amplitude field; a new figure scatters the old one.
  useEffect(() => {
    const s = sim.current
    s.field = amplitudeField(shape, mode)
    if (reduced) {
      place(true)
      draw()
    } else {
      s.boost = Math.max(s.boost, 0.3)
      start()
    }
    const timer = setTimeout(() => setAnnouncement(`${describe(mode, shape)}, ${Math.round(mode.frequency)} hertz`), 450)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, mode, reduced, draw, start])

  useEffect(() => {
    if (playing) start()
  }, [playing, start])

  // Canvas size and grain colour.
  useEffect(() => {
    const canvas = canvasRef.current
    const plate = plateRef.current
    if (!canvas || !plate) return
    const resize = () => {
      const s = sim.current
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const side = Math.max(1, Math.round(plate.clientWidth * ratio))
      if (canvas.width !== side) {
        canvas.width = canvas.height = side
      }
      const context = canvas.getContext('2d')
      if (!context) return
      const [r, g, b] = tokenRgb(plate, tone === 'accent' ? '--color-accent' : '--color-ink', [40, 40, 40])
      const view = new Uint8ClampedArray(4)
      view.set([r, g, b, 0])
      s.base = new Uint32Array(view.buffer)[0]
      if (!s.image || s.image.width !== side) s.image = context.createImageData(side, side)
      draw()
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(plate)
    return () => observer?.disconnect()
  }, [tone, themeVersion, draw])

  // Park the loop off-screen and in hidden tabs.
  useEffect(() => {
    const plate = plateRef.current
    const s = sim.current
    const wake = () => {
      syncAudio()
      if (s.visible && !document.hidden) start()
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = entry.isIntersecting
            wake()
          })
    if (plate) observer?.observe(plate)
    document.addEventListener('visibilitychange', wake)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', wake)
      cancelAnimationFrame(s.frame)
      s.running = false
    }
  }, [start, syncAudio])

  /* ------------------------------------------------------------- bowing */

  const platePoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
  }

  const nearEdge = ({ x, y }: { x: number; y: number }) =>
    shape === 'circle' ? Math.abs(0.5 - Math.hypot(x - 0.5, y - 0.5)) < 0.06 : Math.min(x, 1 - x, y, 1 - y) < 0.07 && x > -0.02 && x < 1.02 && y > -0.02 && y < 1.02

  /** Of the modes around the current one, the one moving hardest under the bow. */
  const pickMode = (point: { x: number; y: number }) => {
    const x = Math.min(0.995, Math.max(0.005, point.x))
    const y = Math.min(0.995, Math.max(0.005, point.y))
    let best = modeIndex
    let score = -1
    for (let i = Math.max(0, modeIndex - 4); i <= Math.min(modes.length - 1, modeIndex + 4); i++) {
      const value = Math.abs(displacement(shape, modes[i], shape === 'circle' ? 0.5 + (x - 0.5) * 0.97 : x, shape === 'circle' ? 0.5 + (y - 0.5) * 0.97 : y))
      const weighted = value * (i === modeIndex ? 1.15 : 1)
      if (weighted > score) {
        score = weighted
        best = i
      }
    }
    if (best !== modeIndex) setFrequency(modes[best].frequency)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = platePoint(event)
    if (!nearEdge(point)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const s = sim.current
    s.bowing = true
    s.lastPick = point
    s.bow = Math.max(s.bow, 0.35)
    setBowPoint(point)
    pickMode(point)
    start()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = sim.current
    if (!s.bowing) return
    const point = platePoint(event)
    const moved = Math.hypot(point.x - s.lastPick.x, point.y - s.lastPick.y)
    s.bow = Math.min(1.2, s.bow + Math.min(0.25, Math.hypot(event.movementX, event.movementY) * 0.012))
    setBowPoint(point)
    if (moved > 0.08) {
      s.lastPick = point
      pickMode(point)
    }
    start()
  }

  const endBow = () => {
    sim.current.bowing = false
    setBowPoint(null)
  }

  /* ---------------------------------------------------------------- view */

  const togglePlaying = () => {
    if (playingProp === undefined) setInternalPlaying(!playing)
    onPlayingChange?.(!playing)
  }

  const round = shape === 'circle'
  const hz = `${Math.round(frequency)} Hz`

  return (
    <div className={cn('flex w-full flex-col gap-4', className)} style={{ maxWidth: size }}>
      <div
        ref={plateRef}
        role="img"
        aria-label={`${label}: ${describe(mode, shape)} at ${hz}. Sand gathers on the lines that do not move.`}
        className={cn('relative aspect-square w-full touch-none select-none', round ? 'rounded-full' : 'rounded-[var(--radius-card)]')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endBow}
        onPointerCancel={endBow}
      >
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0 border border-line-strong bg-surface shadow-[var(--shadow-card)]',
            'bg-[radial-gradient(120%_90%_at_30%_20%,color-mix(in_oklab,var(--color-ink)_0%,transparent),color-mix(in_oklab,var(--color-ink)_7%,transparent))]',
            round ? 'rounded-full' : 'rounded-[var(--radius-card)]',
          )}
        />
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-strong bg-surface-muted" />
        <canvas ref={canvasRef} aria-hidden="true" className={cn('absolute inset-0 size-full', round ? 'rounded-full' : 'rounded-[var(--radius-card)]')} />
        {bowPoint ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_55%,transparent),transparent_70%)]"
            style={{ left: `${bowPoint.x * 100}%`, top: `${bowPoint.y * 100}%` }}
          />
        ) : null}
      </div>

      {controls ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={playing ? 'outline' : 'accent'} onClick={togglePlaying} className="min-w-[76px]">
              {playing ? 'Pause' : 'Play'}
            </Button>
            <IconButton icon={ChevronLeftIcon} label="Previous mode" size="xs" tone="plain" disabled={modeIndex === 0} onClick={() => setFrequency(modes[modeIndex - 1].frequency)} />
            <span className="min-w-[128px] text-center font-mono text-[12px] tabular-nums text-ink-soft">
              {round ? `n ${mode.n} · m ${mode.m}` : `(${mode.n}, ${mode.m})`} · {hz}
            </span>
            <IconButton icon={ChevronRightIcon} label="Next mode" size="xs" tone="plain" disabled={modeIndex === modes.length - 1} onClick={() => setFrequency(modes[modeIndex + 1].frequency)} />
            <IconButton icon={muted ? MutedIcon : SpeakerIcon} label="Sound" aria-pressed={!muted} selected={!muted} size="xs" tone="plain" className="ml-auto" onClick={toggleSound} />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-[12px] font-semibold text-ink-soft">
              Frequency <span className="font-mono font-normal tabular-nums text-ink-faint">{hz}</span>
            </span>
            <Slider
              min={0}
              max={1000}
              value={toSlider(frequency)}
              aria-valuetext={`${hz}, ${describe(mode, shape)}`}
              onChange={(event) => setFrequency(Math.round(fromSlider(Number(event.target.value))))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-ink-soft">Volume</span>
            <Slider
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              aria-valuetext={muted ? `${Math.round(volume * 100)} percent, muted` : `${Math.round(volume * 100)} percent`}
              onChange={(event) => setVolume(Number(event.target.value) / 100)}
            />
          </label>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
