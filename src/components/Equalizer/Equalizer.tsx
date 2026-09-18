'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { Switch } from '../Switch'

export type EqualizerBandType = 'lowshelf' | 'peaking' | 'highshelf'

export interface EqualizerBand {
  id: string
  type: EqualizerBandType
  /** Centre or corner frequency in Hz. */
  frequency: number
  /** Boost or cut in dB. */
  gain: number
  /** Bandwidth of a peaking band. Shelves ignore it, as Web Audio’s do. */
  q: number
}

export interface EqualizerPreset {
  name: string
  bands: EqualizerBand[]
}

export interface EqualizerProps {
  /** The bands, controlled. */
  bands?: EqualizerBand[]
  /** The bands, uncontrolled. Defaults to a low shelf, three peaks and a high shelf. */
  defaultBands?: EqualizerBand[]
  onBandsChange?: (bands: EqualizerBand[]) => void
  /** One-click settings. Defaults to Flat, Bass boost, Vocal, Air and Telephone. */
  presets?: EqualizerPreset[]
  /** Largest boost or cut on the graph, in dB. */
  range?: number
  /** Height of the graph in pixels. */
  height?: number
  /** Accessible name for the graph. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const band = (id: string, type: EqualizerBandType, frequency: number, gain = 0, q = 1): EqualizerBand => ({ id, type, frequency, gain, q })
const FLAT = [band('low', 'lowshelf', 90), band('p1', 'peaking', 250), band('p2', 'peaking', 1000), band('p3', 'peaking', 3500), band('high', 'highshelf', 9000)]
const withGains = (gains: number[], q: number[] = [1, 1, 1, 1, 1], freqs?: number[]) =>
  FLAT.map((item, index) => ({ ...item, gain: gains[index], q: q[index], frequency: freqs?.[index] ?? item.frequency }))
const PRESETS: EqualizerPreset[] = [
  { name: 'Flat', bands: FLAT },
  { name: 'Bass boost', bands: withGains([7, 2, 0, 0, 0], [1, 0.8, 1, 1, 1]) },
  { name: 'Vocal', bands: withGains([-3, -2, 2.5, 4, 1], [1, 1, 0.9, 1.2, 1]) },
  { name: 'Air', bands: withGains([0, 0, -1, 1.5, 6], [1, 1, 1, 0.7, 1], [90, 250, 1000, 5000, 11000]) },
  { name: 'Telephone', bands: withGains([-18, -6, 5, 3, -18], [1, 0.7, 1.4, 1, 1], [300, 500, 1400, 2400, 3400]) },
]

const MIN_HZ = 20
const MAX_HZ = 20000
const POINTS = 240
const FREQS = Float32Array.from({ length: POINTS }, (_, index) => MIN_HZ * (MAX_HZ / MIN_HZ) ** (index / (POINTS - 1)))
const TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000]
const hz = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} kHz` : `${Math.round(value)} Hz`)
const db = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)} dB`
const TYPE_NAMES: Record<EqualizerBandType, string> = { lowshelf: 'low shelf', peaking: 'peak', highshelf: 'high shelf' }

/**
 * The RBJ cookbook response — the formulas the Web Audio spec defines
 * BiquadFilterNode with. Used only where Web Audio is missing, so the curve
 * still draws; in a browser the nodes answer for themselves.
 */
function cookbookResponse(item: EqualizerBand, sampleRate: number, out: Float32Array) {
  const A = 10 ** (item.gain / 40)
  const w0 = (2 * Math.PI * item.frequency) / sampleRate
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  let b: number[]
  let a: number[]
  if (item.type === 'peaking') {
    const alpha = sin / (2 * item.q)
    b = [1 + alpha * A, -2 * cos, 1 - alpha * A]
    a = [1 + alpha / A, -2 * cos, 1 - alpha / A]
  } else {
    const alpha = (sin / 2) * Math.SQRT2
    const root = 2 * Math.sqrt(A) * alpha
    const sign = item.type === 'lowshelf' ? 1 : -1
    b = [A * (A + 1 - sign * (A - 1) * cos + root), sign * 2 * A * (A - 1 - sign * (A + 1) * cos), A * (A + 1 - sign * (A - 1) * cos - root)]
    a = [A + 1 + sign * (A - 1) * cos + root, -sign * 2 * (A - 1 + sign * (A + 1) * cos), A + 1 + sign * (A - 1) * cos - root]
  }
  FREQS.forEach((frequency, index) => {
    const w = (2 * Math.PI * frequency) / sampleRate
    const re = (c: number[]) => c[0] + c[1] * Math.cos(w) + c[2] * Math.cos(2 * w)
    const im = (c: number[]) => -c[1] * Math.sin(w) - c[2] * Math.sin(2 * w)
    out[index] = Math.hypot(re(b), im(b)) / Math.hypot(re(a), im(a))
  })
}

/** A two-bar groove built sample by sample: kick, snare, hats, a saw bass and a pad — something with content in every band. */
function synthLoop(sampleRate: number) {
  const bpm = 100
  const beat = 60 / bpm
  const length = Math.round(beat * 8 * sampleRate)
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  let seed = 7
  const noise = () => {
    seed = (seed * 16807) % 2147483647
    return (seed / 2147483647) * 2 - 1
  }
  const addAt = (start: number, duration: number, voice: (t: number, i: number) => number, pan = 0) => {
    const from = Math.round(start * sampleRate)
    const count = Math.min(length - from, Math.round(duration * sampleRate))
    for (let i = 0; i < count; i += 1) {
      const value = voice(i / sampleRate, i)
      left[from + i] += value * (1 - pan) * 0.5
      right[from + i] += value * (1 + pan) * 0.5
    }
  }
  for (let step = 0; step < 16; step += 1) {
    const at = step * (beat / 2)
    if (step % 4 === 0 || step === 11) {
      let phase = 0
      addAt(at, 0.45, (t) => {
        phase += (2 * Math.PI * (45 + 90 * Math.exp(-t * 30))) / sampleRate
        return Math.sin(phase) * Math.exp(-t * 7) * 1.1
      })
    }
    if (step % 4 === 2) {
      let last = 0
      addAt(at, 0.25, (t) => {
        const white = noise()
        const bright = white - last
        last = white
        return (bright * 0.45 + Math.sin(2 * Math.PI * 185 * t) * 0.35) * Math.exp(-t * 18)
      })
    }
    let previous = 0
    addAt(at, 0.06, () => {
      const white = noise()
      const high = white - previous
      previous = white
      return high * 0.12
    }, step % 2 ? 0.4 : -0.4)
    addAt(at + beat / 4, 0.03, () => noise() * 0.05, 0.3)
  }
  const roots = [55, 43.65, 65.41, 49]
  const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]]
  roots.forEach((root, bar) => {
    const start = bar * beat * 2
    let smooth = 0
    addAt(start, beat * 2, (t) => {
      const saw = 2 * ((t * root * 2) % 1) - 1
      smooth += (saw - smooth) * 0.08
      return smooth * 0.5 * Math.min(1, t * 60) * (0.7 + 0.3 * Math.exp(-t * 3))
    })
    chords[bar].forEach((note, index) => {
      addAt(start, beat * 2, (t) => {
        const env = Math.min(1, t * 4) * Math.min(1, (beat * 2 - t) * 6)
        return (Math.sin(2 * Math.PI * note * t) + 0.3 * Math.sin(2 * Math.PI * note * 2.003 * t)) * 0.07 * env
      }, index - 1)
    })
    for (let n = 0; n < 8; n += 1) {
      const note = chords[bar][n % 3] * 2
      addAt(start + n * (beat / 4), beat / 4, (t) => ((t * note) % 1 < 0.5 ? 1 : -1) * 0.035 * Math.exp(-t * 14), n % 2 ? 0.5 : -0.5)
    }
  })
  let peak = 0
  for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  const scale = 0.8 / (peak || 1)
  for (let i = 0; i < length; i += 1) {
    left[i] *= scale
    right[i] *= scale
  }
  return [left, right]
}

interface Graph {
  context: AudioContext
  source: AudioBufferSourceNode
  filters: BiquadFilterNode[]
  analyser: AnalyserNode
  output: GainNode
}

/**
 * A parametric equaliser that is actually applied to sound.
 *
 * Each band is a real BiquadFilterNode, and the curve is not drawn from a
 * formula of our own: every band’s node is asked for its response with
 * getFrequencyResponse, on a log frequency axis, and the responses are summed
 * in decibels — so what is drawn is exactly what is heard. The nodes for the
 * curve live on an OfflineAudioContext, so the graph works before anything
 * plays and without asking for permission to make sound.
 *
 * The demo source is synthesised in code, and its live spectrum is drawn
 * behind the curve, so a boost at 90 Hz visibly lifts the kick. Handles drag
 * in two dimensions; on the keyboard, arrows move frequency and gain,
 * Page Up and Page Down (or the wheel) set Q, and each handle announces all
 * three values.
 */
export function Equalizer({
  bands: bandsProp,
  defaultBands = FLAT,
  onBandsChange,
  presets = PRESETS,
  range = 18,
  height = 260,
  label = 'Equaliser curve',
  className,
}: EqualizerProps) {
  const [inner, setInner] = useState(defaultBands)
  const bands = bandsProp ?? inner
  const [selected, setSelected] = useState(bands[0]?.id ?? '')
  const [playing, setPlaying] = useState(false)
  const [bypass, setBypass] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const graphRef = useRef<Graph | null>(null)
  const offlineRef = useRef<OfflineAudioContext | null | undefined>(undefined)
  const plotRef = useRef<HTMLDivElement>(null)
  const spectrumRef = useRef<SVGPathElement>(null)
  const dragRef = useRef<{ id: string; pointer: number } | null>(null)
  const reduced = usePrefersReducedMotion()
  const id = useId()

  const W = 640
  const H = height
  const PAD = { left: 34, right: 8, top: 10, bottom: 20 }
  const xOf = (frequency: number) => PAD.left + (Math.log(frequency / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * (W - PAD.left - PAD.right)
  const yOf = (gain: number) => PAD.top + ((range - gain) / (2 * range)) * (H - PAD.top - PAD.bottom)
  const freqAt = (x: number) => MIN_HZ * (MAX_HZ / MIN_HZ) ** ((x - PAD.left) / (W - PAD.left - PAD.right))
  const gainAt = (y: number) => range - ((y - PAD.top) / (H - PAD.top - PAD.bottom)) * 2 * range

  const setBands = (next: EqualizerBand[]) => {
    if (bandsProp === undefined) setInner(next)
    onBandsChange?.(next)
  }
  const change = (bandId: string, patch: Partial<EqualizerBand>) =>
    setBands(
      bands.map((item) =>
        item.id === bandId
          ? {
              ...item,
              ...patch,
              frequency: Math.min(MAX_HZ, Math.max(MIN_HZ, patch.frequency ?? item.frequency)),
              gain: Math.round(Math.min(range, Math.max(-range, patch.gain ?? item.gain)) * 10) / 10,
              q: Math.round(Math.min(18, Math.max(0.1, patch.q ?? item.q)) * 100) / 100,
            }
          : item,
      ),
    )

  // The combined response: each band's magnitude from its own BiquadFilterNode, summed in dB.
  const response = useMemo(() => {
    if (offlineRef.current === undefined) {
      try {
        offlineRef.current = typeof OfflineAudioContext === 'undefined' ? null : new OfflineAudioContext(1, 128, 48000)
      } catch {
        offlineRef.current = null
      }
    }
    const offline = offlineRef.current
    const total = new Float32Array(POINTS)
    const magnitude = new Float32Array(POINTS)
    const phase = new Float32Array(POINTS)
    for (const item of bands) {
      if (offline) {
        const node = offline.createBiquadFilter()
        node.type = item.type
        node.frequency.value = item.frequency
        node.gain.value = item.gain
        node.Q.value = item.q
        node.getFrequencyResponse(FREQS, magnitude, phase)
      } else cookbookResponse(item, 48000, magnitude)
      for (let index = 0; index < POINTS; index += 1) total[index] += 20 * Math.log10(Math.max(1e-6, magnitude[index]))
    }
    return total
  }, [bands])

  const curve = Array.from(response, (value, index) => `${index ? 'L' : 'M'}${xOf(FREQS[index]).toFixed(1)},${yOf(Math.max(-range - 2, Math.min(range + 2, value))).toFixed(1)}`).join('')

  /* ---------------------------------------------------------------- audio */

  const connect = (graph: Graph, count: number, off: boolean) => {
    graph.source.disconnect()
    graph.filters.forEach((filter) => filter.disconnect())
    if (graph.filters.length !== count) graph.filters = Array.from({ length: count }, () => graph.context.createBiquadFilter())
    let last: AudioNode = graph.source
    if (!off) for (const filter of graph.filters) last = last.connect(filter)
    last.connect(graph.analyser)
  }

  const start = async () => {
    if (graphRef.current) {
      await graphRef.current.context.resume()
      setPlaying(true)
      return
    }
    if (typeof AudioContext === 'undefined') {
      setUnsupported(true)
      return
    }
    const context = new AudioContext()
    const [left, right] = synthLoop(context.sampleRate)
    const buffer = context.createBuffer(2, left.length, context.sampleRate)
    buffer.copyToChannel(left, 0)
    buffer.copyToChannel(right, 1)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const analyser = context.createAnalyser()
    analyser.fftSize = 8192
    analyser.smoothingTimeConstant = 0.8
    const output = context.createGain()
    output.gain.value = 0.7
    analyser.connect(output).connect(context.destination)
    const graph: Graph = { context, source, filters: [], analyser, output }
    connect(graph, bands.length, bypass)
    graphRef.current = graph
    source.start()
    await context.resume()
    setPlaying(true)
  }

  const stop = async () => {
    await graphRef.current?.context.suspend()
    setPlaying(false)
  }

  useEffect(
    () => () => {
      void graphRef.current?.context.close()
      graphRef.current = null
    },
    [],
  )

  // Live parameters glide rather than jump, so dragging a handle never clicks.
  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    if (graph.filters.length !== bands.length) connect(graph, bands.length, bypass)
    const now = graph.context.currentTime
    bands.forEach((item, index) => {
      const filter = graph.filters[index]
      filter.type = item.type
      filter.frequency.setTargetAtTime(item.frequency, now, 0.015)
      filter.gain.setTargetAtTime(item.gain, now, 0.015)
      filter.Q.setTargetAtTime(item.q, now, 0.015)
    })
  }, [bands, playing])

  useEffect(() => {
    if (graphRef.current) connect(graphRef.current, bands.length, bypass)
  }, [bypass])

  // The spectrum behind the curve. Four times a second under reduced motion.
  useEffect(() => {
    const graph = graphRef.current
    const path = spectrumRef.current
    if (!playing || !graph || !path) return
    const bins = new Float32Array(graph.analyser.frequencyBinCount)
    const binHz = graph.context.sampleRate / graph.analyser.fftSize
    const columns = 160
    let handle = 0
    let cancelled = false
    const draw = () => {
      if (cancelled) return
      graph.analyser.getFloatFrequencyData(bins)
      let d = `M${PAD.left},${H - PAD.bottom}`
      for (let column = 0; column < columns; column += 1) {
        const lo = MIN_HZ * (MAX_HZ / MIN_HZ) ** (column / columns)
        const hi = MIN_HZ * (MAX_HZ / MIN_HZ) ** ((column + 1) / columns)
        let level = -140
        for (let bin = Math.floor(lo / binHz); bin <= Math.ceil(hi / binHz) && bin < bins.length; bin += 1) level = Math.max(level, bins[bin])
        const y = PAD.top + ((-10 - Math.max(-100, Math.min(-10, level))) / 90) * (H - PAD.top - PAD.bottom)
        d += `L${xOf(Math.sqrt(lo * hi)).toFixed(1)},${y.toFixed(1)}`
      }
      path.setAttribute('d', `${d}L${W - PAD.right},${H - PAD.bottom}Z`)
      handle = reduced ? window.setTimeout(draw, 250) : requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelled = true
      cancelAnimationFrame(handle)
      window.clearTimeout(handle)
      path.setAttribute('d', '')
    }
  }, [playing, reduced, H])

  // The wheel sets Q. A native listener, because React's is passive and could not stop the page scrolling.
  useEffect(() => {
    const plot = plotRef.current
    if (!plot) return
    const onWheel = (event: WheelEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-band]')
      if (!target) return
      event.preventDefault()
      const item = bandsRef.current.find((entry) => entry.id === target.dataset.band)
      if (item?.type === 'peaking') changeRef.current(item.id, { q: item.q * (event.deltaY < 0 ? 1.1 : 1 / 1.1) })
    }
    plot.addEventListener('wheel', onWheel, { passive: false })
    return () => plot.removeEventListener('wheel', onWheel)
  }, [])
  const bandsRef = useRef(bands)
  bandsRef.current = bands
  const changeRef = useRef(change)
  changeRef.current = change

  /* ---------------------------------------------------------------- input */

  const toView = (event: PointerEvent<HTMLElement>) => {
    const box = plotRef.current!.getBoundingClientRect()
    return { x: ((event.clientX - box.left) / box.width) * W, y: ((event.clientY - box.top) / box.height) * H }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, item: EqualizerBand) => {
    const coarse = event.shiftKey
    const semitone = 2 ** ((coarse ? 4 : 1) / 12)
    const patches: Record<string, Partial<EqualizerBand>> = {
      ArrowRight: { frequency: item.frequency * semitone },
      ArrowLeft: { frequency: item.frequency / semitone },
      ArrowUp: { gain: item.gain + (coarse ? 3 : 0.5) },
      ArrowDown: { gain: item.gain - (coarse ? 3 : 0.5) },
      PageUp: { q: item.q * 1.2 },
      PageDown: { q: item.q / 1.2 },
      ']': { q: item.q * 1.2 },
      '[': { q: item.q / 1.2 },
      Home: { gain: 0 },
    }
    const patch = patches[event.key]
    if (!patch) return
    event.preventDefault()
    if ('q' in patch && item.type !== 'peaking') return
    change(item.id, patch)
  }

  const active = bands.find((item) => item.id === selected) ?? bands[0]
  const presetName = presets.find((preset) => JSON.stringify(preset.bands) === JSON.stringify(bands))?.name

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={playing ? 'outline' : 'accent'} onClick={playing ? stop : start} aria-pressed={playing}>
          {playing ? 'Stop loop' : 'Play loop'}
        </Button>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={bypass} onChange={(event) => setBypass(event.target.checked)} />
          Bypass
        </label>
        <div role="group" aria-label="Presets" className="ml-auto flex flex-wrap gap-1">
          {presets.map((preset) => (
            <Button key={preset.name} size="sm" variant={presetName === preset.name ? 'muted' : 'ghost'} aria-pressed={presetName === preset.name} onClick={() => setBands(preset.bands)}>
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      <div ref={plotRef} className={cn('relative w-full touch-none select-none overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken', bypass && 'opacity-70')}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={`${id}-desc`}>
          <desc id={`${id}-desc`}>
            {label}: {bands.map((item) => `${TYPE_NAMES[item.type]} at ${hz(item.frequency)} ${db(item.gain)}`).join(', ')}
            {bypass ? '. Bypassed.' : '.'}
          </desc>
          <path ref={spectrumRef} className="fill-[color-mix(in_oklab,var(--color-ink-faint)_22%,transparent)]" />
          {TICKS.map((tick) => (
            <g key={tick}>
              <line x1={xOf(tick)} x2={xOf(tick)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-line" />
              <text x={xOf(tick)} y={H - 6} textAnchor="middle" className="fill-ink-faint text-[9px] font-medium">
                {tick >= 1000 ? `${tick / 1000}k` : tick}
              </text>
            </g>
          ))}
          {[-range, -range / 2, 0, range / 2, range].map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(tick)} y2={yOf(tick)} className={tick === 0 ? 'stroke-line-strong' : 'stroke-line'} />
              <text x={PAD.left - 5} y={yOf(tick) + 3} textAnchor="end" className="fill-ink-faint text-[9px] font-medium">
                {tick > 0 ? `+${tick}` : tick}
              </text>
            </g>
          ))}
          <path d={`${curve}L${W - PAD.right},${yOf(0)}L${PAD.left},${yOf(0)}Z`} className="fill-[color-mix(in_oklab,var(--color-accent)_22%,transparent)]" />
          <path d={curve} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-accent-strong" />
        </svg>

        {bands.map((item, index) => {
          const current = item.id === active?.id
          return (
            <div
              key={item.id}
              role="slider"
              tabIndex={0}
              data-band={item.id}
              aria-label={`Band ${index + 1}, ${TYPE_NAMES[item.type]}`}
              aria-valuemin={-range}
              aria-valuemax={range}
              aria-valuenow={item.gain}
              aria-valuetext={`${hz(item.frequency)}, ${db(item.gain)}${item.type === 'peaking' ? `, Q ${item.q.toFixed(2)}` : ''}`}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown"
              onFocus={() => setSelected(item.id)}
              onKeyDown={(event) => onKeyDown(event, item)}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                event.currentTarget.focus()
                dragRef.current = { id: item.id, pointer: event.pointerId }
              }}
              onPointerMove={(event) => {
                if (dragRef.current?.id !== item.id || dragRef.current.pointer !== event.pointerId) return
                const { x, y } = toView(event)
                change(item.id, { frequency: freqAt(x), gain: gainAt(y) })
              }}
              onPointerUp={() => (dragRef.current = null)}
              onPointerCancel={() => (dragRef.current = null)}
              className={cn(
                'absolute flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 text-[10px] font-extrabold outline-none active:cursor-grabbing',
                current ? 'border-ink bg-accent text-accent-ink' : 'border-ink-soft bg-surface text-ink',
                'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
              )}
              style={{ left: `${(xOf(item.frequency) / W) * 100}%`, top: `${(yOf(item.gain) / H) * 100}%` }}
            >
              <span aria-hidden="true">{index + 1}</span>
            </div>
          )
        })}
      </div>

      {active && (
        <p className="m-0 text-[12px] font-medium tabular-nums text-ink-soft">
          <strong className="font-bold text-ink">Band {bands.indexOf(active) + 1}</strong> · {TYPE_NAMES[active.type]} · {hz(active.frequency)} · {db(active.gain)}
          {active.type === 'peaking' ? ` · Q ${active.q.toFixed(2)}` : ''}
          <span className="text-ink-faint"> — drag, or arrows for frequency and gain, Page Up/Down or wheel for Q</span>
        </p>
      )}
      {unsupported && (
        <p role="status" className="m-0 text-[12px] font-medium text-danger">
          Web Audio is not available here, so the loop cannot play. The curve is still computed.
        </p>
      )}
    </div>
  )
}
