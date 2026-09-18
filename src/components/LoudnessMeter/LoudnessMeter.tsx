'use client'

import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'

export type LoudnessMeterSignal = 'music' | 'tone'

export interface LoudnessMeterAnalysis {
  /** Seconds of audio analysed. */
  duration: number
  /** Momentary loudness (400 ms) every 100 ms, in LUFS. −Infinity is silence. */
  momentary: Float32Array
  /** Short-term loudness (3 s) every 100 ms, in LUFS. */
  shortTerm: Float32Array
  /** Gated integrated loudness up to each 100 ms step, in LUFS. */
  running: Float32Array
  /** Integrated loudness of the whole programme, in LUFS. */
  integrated: number
  /** Loudness range (EBU Tech 3342), in LU. */
  range: number
  /** Highest 4× oversampled peak, in dBTP. */
  truePeak: number
  /** Highest sample, in dBFS — shown beside the true peak to make the difference visible. */
  samplePeak: number
}

export interface LoudnessMeterProps {
  /** The generated signal analysed first. */
  defaultSignal?: LoudnessMeterSignal
  /** Integrated target in LUFS — −14 for most streaming, −23 for EBU R 128 broadcast. */
  target?: number
  /** Highest acceptable true peak in dBTP. */
  peakLimit?: number
  /** Offer analysing a local audio file. */
  allowFiles?: boolean
  /** Called when an analysis finishes. */
  onAnalysis?: (analysis: LoudnessMeterAnalysis) => void
  /** Merged last, so it wins. */
  className?: string
}

/* ------------------------------------------------------------------ BS.1770-4 */

/**
 * The K-weighting pre-filter, derived for any sample rate. These are the
 * analogue prototypes libebur128 fitted to the two biquads BS.1770 prints for
 * 48 kHz; at 48 kHz they reproduce the published coefficients to the last
 * digit, and at 44.1 kHz they give the same curve rather than a mis-tuned one.
 */
function kWeighting(sampleRate: number) {
  let K = Math.tan((Math.PI * 1681.974450955533) / sampleRate)
  const Vh = 10 ** (3.999843853973347 / 20)
  const Vb = Vh ** 0.4996667741545416
  let Q = 0.7071752369554196
  let a0 = 1 + K / Q + K * K
  const shelf = {
    b: [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  }
  K = Math.tan((Math.PI * 38.13547087602444) / sampleRate)
  Q = 0.5003270373238773
  a0 = 1 + K / Q + K * K
  const highpass = { b: [1, -2, 1], a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0] }
  return [shelf, highpass]
}

/** 4× interpolation filter: a 48-tap windowed sinc split into four 12-tap phases, as BS.1770-4 Annex 2 describes. */
const PHASES = (() => {
  const taps = 48
  const h = Array.from({ length: taps }, (_, n) => {
    const x = (n - (taps - 1) / 2) / 4
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
    const window = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (taps - 1))
    return sinc * window
  })
  return [0, 1, 2, 3].map((phase) => {
    const coefficients = h.filter((_, n) => n % 4 === phase)
    const sum = coefficients.reduce((total, value) => total + value, 0)
    return coefficients.map((value) => value / sum)
  })
})()

/**
 * Yield to the page, then continue. A message rather than a timer: timers in a
 * background tab are throttled to once a second, which would stretch a
 * two-second analysis into a minute.
 */
function nextTask(run: () => void) {
  if (typeof MessageChannel === 'undefined') {
    window.setTimeout(run, 0)
    return
  }
  const channel = new MessageChannel()
  channel.port1.onmessage = () => {
    channel.port1.close()
    run()
  }
  channel.port2.postMessage(null)
}

const lufs = (power: number) => (power > 0 ? -0.691 + 10 * Math.log10(power) : -Infinity)
const weightsFor = (channels: number) => (channels === 6 ? [1, 1, 1, 0, 1.41, 1.41] : new Array(channels).fill(1))

function gatedIntegrated(blocks: number[]) {
  const loud = blocks.filter((power) => lufs(power) > -70)
  if (!loud.length) return -Infinity
  const relative = lufs(loud.reduce((sum, power) => sum + power, 0) / loud.length) - 10
  const kept = loud.filter((power) => lufs(power) > relative)
  return lufs(kept.reduce((sum, power) => sum + power, 0) / kept.length)
}

/** EBU Tech 3342: short-term values gated at −70 LUFS and 20 LU below their mean, then the 10th to 95th percentile. */
function loudnessRange(shortTermPowers: number[]) {
  const loud = shortTermPowers.filter((power) => lufs(power) > -70)
  if (!loud.length) return 0
  const relative = lufs(loud.reduce((sum, power) => sum + power, 0) / loud.length) - 20
  const values = loud.map(lufs).filter((value) => value > relative).sort((a, b) => a - b)
  const at = (p: number) => values[Math.min(values.length - 1, Math.max(0, Math.round(p * (values.length - 1))))]
  return values.length ? at(0.95) - at(0.1) : 0
}

/** The whole measurement, in slices of half a second of audio, yielding between them so the page never stalls. */
function analyse(channels: Float32Array[], sampleRate: number, onProgress: (share: number) => void, signal: { cancelled: boolean }) {
  return new Promise<LoudnessMeterAnalysis | null>((resolve) => {
    const [shelf, highpass] = kWeighting(sampleRate)
    const length = channels[0].length
    const hop = Math.round(sampleRate / 10)
    const steps = Math.floor(length / hop)
    const sums = channels.map(() => new Float64Array(steps))
    const state = channels.map(() => ({ x1: 0, x2: 0, y1: 0, y2: 0, u1: 0, u2: 0, z1: 0, z2: 0, history: new Float32Array(12), cursor: 0 }))
    let truePeak = 0
    let samplePeak = 0
    let position = 0

    const slice = () => {
      if (signal.cancelled) return resolve(null)
      const end = Math.min(steps * hop, position + Math.round(sampleRate / 2))
      channels.forEach((data, channel) => {
        const s = state[channel]
        const sum = sums[channel]
        for (let i = position; i < end; i += 1) {
          const x = data[i]
          // Stage 1: the head-shaped high shelf. Stage 2: the RLB high-pass.
          const y = shelf.b[0] * x + shelf.b[1] * s.x1 + shelf.b[2] * s.x2 - shelf.a[0] * s.y1 - shelf.a[1] * s.y2
          s.x2 = s.x1
          s.x1 = x
          s.y2 = s.y1
          s.y1 = y
          const z = highpass.b[0] * y + highpass.b[1] * s.u1 + highpass.b[2] * s.u2 - highpass.a[0] * s.z1 - highpass.a[1] * s.z2
          s.u2 = s.u1
          s.u1 = y
          s.z2 = s.z1
          s.z1 = z
          sum[Math.floor(i / hop)] += z * z

          const magnitude = Math.abs(x)
          if (magnitude > samplePeak) samplePeak = magnitude
          s.history[s.cursor] = x
          s.cursor = (s.cursor + 1) % 12
          for (const phase of PHASES) {
            let value = 0
            for (let k = 0; k < 12; k += 1) value += phase[k] * s.history[(s.cursor - 1 - k + 24) % 12]
            if (Math.abs(value) > truePeak) truePeak = Math.abs(value)
          }
        }
      })
      position = end
      onProgress(position / (steps * hop || 1))
      if (position < steps * hop) {
        nextTask(slice)
        return
      }

      const weights = weightsFor(channels.length)
      const windowPower = (step: number, size: number) => {
        if (step + 1 < size) return 0
        let total = 0
        channels.forEach((_, channel) => {
          let energy = 0
          for (let k = step - size + 1; k <= step; k += 1) energy += sums[channel][k]
          total += weights[channel] * (energy / (size * hop))
        })
        return total
      }
      const blocks: number[] = []
      const shortPowers: number[] = []
      const momentary = new Float32Array(steps)
      const shortTerm = new Float32Array(steps)
      const running = new Float32Array(steps)
      for (let step = 0; step < steps; step += 1) {
        const block = windowPower(step, 4)
        const short = windowPower(step, 30)
        momentary[step] = lufs(block)
        shortTerm[step] = lufs(short)
        if (step >= 3) blocks.push(block)
        if (step >= 29) shortPowers.push(short)
        running[step] = step % 5 === 4 || step === steps - 1 ? gatedIntegrated(blocks) : running[step - 1] ?? -Infinity
      }
      resolve({
        duration: length / sampleRate,
        momentary,
        shortTerm,
        running,
        integrated: gatedIntegrated(blocks),
        range: loudnessRange(shortPowers),
        truePeak: 20 * Math.log10(Math.max(truePeak, samplePeak, 1e-9)),
        samplePeak: 20 * Math.log10(Math.max(samplePeak, 1e-9)),
      })
    }
    slice()
  })
}

/* ------------------------------------------------------------------ test signals */

/**
 * A 24-second arrangement with a quiet intro, a verse, a loud chorus and a
 * fade — so short-term loudness moves and the range is not zero. Its high
 * saw lead has inter-sample peaks, so the true peak reads above the sample peak.
 */
function* testMusic(sampleRate: number): Generator<void, Float32Array[]> {
  const seconds = 24
  const length = seconds * sampleRate
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  const beat = 0.5
  let seed = 3
  const noise = () => {
    seed = (seed * 16807) % 2147483647
    return (seed / 2147483647) * 2 - 1
  }
  const section = (t: number) => (t < 4 ? 0.22 : t < 12 ? 0.5 : t < 20 ? 1 : Math.max(0, 0.3 * (1 - (t - 20) / 4)))
  const add = (start: number, duration: number, voice: (t: number) => number, pan = 0) => {
    const from = Math.round(start * sampleRate)
    const count = Math.min(length - from, Math.round(duration * sampleRate))
    for (let i = 0; i < count; i += 1) {
      const value = voice(i / sampleRate) * section(start + i / sampleRate)
      left[from + i] += value * (1 - pan)
      right[from + i] += value * (1 + pan)
    }
  }
  const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]]
  for (let bar = 0; bar < 12; bar += 1) {
    // One bar per slice: the caller yields to the page between them.
    yield
    const at = bar * beat * 4
    const chord = chords[bar % 4]
    chord.forEach((note, index) => add(at, beat * 4, (t) => Math.sin(2 * Math.PI * note * t) * 0.09 * Math.min(1, t * 3), index - 1))
    if (at < 4) continue
    for (let n = 0; n < 4; n += 1) {
      let phase = 0
      add(at + n * beat, 0.4, (t) => {
        phase += (2 * Math.PI * (48 + 100 * Math.exp(-t * 28))) / sampleRate
        return Math.sin(phase) * Math.exp(-t * 8) * 0.8
      })
      add(at + n * beat + beat / 2, 0.05, () => noise() * 0.12, 0.3)
      if (n % 2) add(at + n * beat, 0.2, (t) => (noise() * 0.4 + Math.sin(2 * Math.PI * 190 * t) * 0.3) * Math.exp(-t * 16))
    }
    add(at, beat * 4, (t) => (2 * ((t * chord[0] * 0.25) % 1) - 1) * 0.22)
    if (at >= 12 && at < 20) {
      for (let n = 0; n < 8; n += 1) add(at + n * (beat / 2), beat / 2, (t) => (2 * ((t * chord[n % 3] * 2) % 1) - 1) * 0.12 * Math.exp(-t * 4), n % 2 ? 0.4 : -0.4)
    }
  }
  let peak = 0
  for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  // Peaks at about −1.4 dBFS, so the true peak stays under the usual −1 dBTP ceiling.
  const gain = 0.85 / peak
  for (let i = 0; i < length; i += 1) {
    left[i] *= gain
    right[i] *= gain
  }
  return [left, right]
}

/** 1 kHz at −20 dBFS in both channels: BS.1770 says this reads −20 LUFS, which makes it the calibration check. */
function referenceTone(sampleRate: number) {
  const length = 10 * sampleRate
  const tone = Float32Array.from({ length }, (_, i) => 0.1 * Math.sin((2 * Math.PI * 1000 * i) / sampleRate))
  return [tone, tone.slice()]
}

/* ------------------------------------------------------------------ view */

const show = (value: number, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits).replace('-', '−') : '−∞')
const FLOOR = -60

function Bar({ label, value, target }: { label: string; value: number; target: number }) {
  const fill = Number.isFinite(value) ? Math.max(0, Math.min(1, (value - FLOOR) / -FLOOR)) : 0
  return (
    <div className="flex flex-col items-center gap-1">
      <div aria-hidden="true" className="relative h-[160px] w-5 overflow-hidden rounded-full bg-track">
        <div
          className={cn('absolute inset-x-0 bottom-0 rounded-full', value > target + 1 ? 'bg-warning' : 'bg-accent-strong')}
          style={{ height: `${fill * 100}%` }}
        />
        <div className="absolute inset-x-0 h-0.5 bg-ink" style={{ bottom: `${((target - FLOOR) / -FLOOR) * 100}%` }} />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{label}</span>
    </div>
  )
}

/**
 * Loudness measured the way broadcasters and streaming services measure it.
 *
 * Peak meters answer “will it clip?”; they cannot say whether two tracks will
 * sound equally loud. ITU-R BS.1770-4 can, and this is it implemented rather
 * than approximated: the two-stage K-weighting filter derived for the actual
 * sample rate, mean-square power over 400 ms momentary and 3 s short-term
 * windows on a 100 ms hop, integrated loudness with the −70 LUFS absolute gate
 * and the −10 LU relative gate, a 4× oversampled true peak, and loudness range
 * per EBU Tech 3342.
 *
 * The whole signal is measured up front, in slices that yield to the page, and
 * playback then reads the meters at the playhead — so the numbers are the
 * standard’s, not a smoothed guess. The reference tone is there as a check:
 * 1 kHz at −20 dBFS must read −20 LUFS.
 */
export function LoudnessMeter({ defaultSignal = 'music', target = -14, peakLimit = -1, allowFiles = true, onAnalysis, className }: LoudnessMeterProps) {
  const [signal, setSignal] = useState<LoudnessMeterSignal | 'file'>(defaultSignal)
  const [fileName, setFileName] = useState('')
  const [source, setSource] = useState<{ channels: Float32Array[]; sampleRate: number } | null>(null)
  const [analysis, setAnalysis] = useState<LoudnessMeterAnalysis | null>(null)
  const [progress, setProgress] = useState(0)
  const [cursor, setCursor] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const contextRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioBufferSourceNode | null>(null)
  const graphRef = useRef<SVGSVGElement>(null)
  const reduced = usePrefersReducedMotion()
  const id = useId()
  const sampleRate = 48000

  // Generated signals are made at 48 kHz in plain arrays: no Web Audio needed to measure them.
  useEffect(() => {
    if (signal === 'file') return
    if (signal === 'tone') {
      setSource({ channels: referenceTone(sampleRate), sampleRate })
      return
    }
    const music = testMusic(sampleRate)
    let cancelled = false
    const next = () => {
      if (cancelled) return
      const step = music.next()
      if (step.done) setSource({ channels: step.value, sampleRate })
      else nextTask(next)
    }
    setAnalysis(null)
    nextTask(next)
    return () => {
      cancelled = true
    }
  }, [signal])

  useEffect(() => {
    if (!source) return
    const token = { cancelled: false }
    setAnalysis(null)
    setCursor(null)
    setProgress(0)
    void analyse(source.channels, source.sampleRate, setProgress, token).then((result) => {
      if (!result) return
      setAnalysis(result)
      onAnalysis?.(result)
    })
    return () => {
      token.cancelled = true
    }
  }, [source])

  const stop = () => {
    try {
      nodeRef.current?.stop()
    } catch {
      // Already stopped.
    }
    nodeRef.current = null
    setPlaying(false)
  }

  useEffect(
    () => () => {
      stop()
      void contextRef.current?.close()
    },
    [],
  )

  const play = async () => {
    if (!source || !analysis) return
    if (typeof AudioContext === 'undefined') {
      setError('Web Audio is not available here, so the signal cannot play. The measurements above still stand.')
      return
    }
    const context = (contextRef.current ??= new AudioContext())
    await context.resume()
    const buffer = context.createBuffer(source.channels.length, source.channels[0].length, source.sampleRate)
    source.channels.forEach((data, channel) => buffer.getChannelData(channel).set(data))
    const node = context.createBufferSource()
    node.buffer = buffer
    node.connect(context.destination)
    const offset = cursor !== null && cursor < analysis.duration - 0.5 ? cursor : 0
    node.start(0, offset)
    node.onended = () => {
      if (nodeRef.current === node) setPlaying(false)
    }
    nodeRef.current = node
    const started = context.currentTime - offset
    setPlaying(true)
    // The meters follow the playhead: a frame loop, or four updates a second under reduced motion.
    const tick = () => {
      if (nodeRef.current !== node) return
      setCursor(Math.min(analysis.duration, context.currentTime - started))
      if (reduced) window.setTimeout(tick, 250)
      else requestAnimationFrame(tick)
    }
    tick()
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    stop()
    setError('')
    if (typeof OfflineAudioContext === 'undefined') {
      setError('This browser cannot decode audio, so files cannot be measured here.')
      return
    }
    try {
      const decoded = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(await file.arrayBuffer())
      setSignal('file')
      setFileName(file.name)
      setSource({ channels: Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel)), sampleRate: decoded.sampleRate })
    } catch {
      setError(`Could not decode ${file.name}. Try a WAV, MP3, AAC or Ogg file.`)
    }
  }

  const step = analysis ? Math.max(0, Math.min(analysis.momentary.length - 1, Math.round((cursor ?? analysis.duration) * 10) - 1)) : 0
  const momentary = analysis?.momentary[step] ?? -Infinity
  const shortTerm = analysis?.shortTerm[step] ?? -Infinity
  const running = cursor === null ? analysis?.integrated ?? -Infinity : analysis?.running[step] ?? -Infinity

  // History graph geometry.
  const W = 640
  const H = 150
  const x = (seconds: number) => (analysis ? (seconds / analysis.duration) * W : 0)
  const y = (value: number) => (Math.max(FLOOR, Math.min(0, Number.isFinite(value) ? value : FLOOR)) / FLOOR) * (H - 8) + 4
  const line = (values: Float32Array) => Array.from(values, (value, index) => `${index ? 'L' : 'M'}${x((index + 1) / 10).toFixed(1)},${y(value).toFixed(1)}`).join('')

  const scrub = (seconds: number) => {
    if (!analysis) return
    stop()
    setCursor(Math.max(0.1, Math.min(analysis.duration, seconds)))
  }
  const onGraphKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!analysis) return
    const at = cursor ?? analysis.duration
    const moves: Record<string, number> = { ArrowRight: at + 1, ArrowLeft: at - 1, PageUp: at + 5, PageDown: at - 5, Home: 0.1, End: analysis.duration }
    if (!(event.key in moves)) return
    event.preventDefault()
    scrub(moves[event.key])
  }
  const onGraphPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!analysis || (event.type === 'pointermove' && event.buttons !== 1)) return
    const box = graphRef.current!.getBoundingClientRect()
    scrub(((event.clientX - box.left) / box.width) * analysis.duration)
  }

  const stats: [string, string, string, boolean][] = analysis
    ? [
        ['Integrated', show(analysis.integrated), 'LUFS', Math.abs(analysis.integrated - target) > 1],
        ['Range', show(analysis.range), 'LU', false],
        ['True peak', show(analysis.truePeak), 'dBTP', analysis.truePeak > peakLimit],
        ['Sample peak', show(analysis.samplePeak), 'dBFS', false],
      ]
    : []

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          label="Signal"
          value={signal}
          onValueChange={(value) => {
            if (value === signal) return
            stop()
            setError('')
            setSignal(value)
          }}
          options={[
            { value: 'music' as const, label: 'Test music' },
            { value: 'tone' as const, label: 'Reference tone' },
            ...(fileName ? [{ value: 'file' as const, label: 'File' }] : []),
          ]}
        />
        {allowFiles && (
          <label className="inline-flex h-8 cursor-pointer items-center rounded-full border border-line-strong bg-surface px-3.5 text-[12px] font-bold text-ink hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
            Measure a file
            <input type="file" accept="audio/*" className="sr-only" onChange={onFile} />
          </label>
        )}
        <Button size="sm" variant={playing ? 'outline' : 'accent'} disabled={!analysis} onClick={playing ? stop : play} aria-pressed={playing} className="ml-auto">
          {playing ? 'Stop' : 'Play'}
        </Button>
      </div>
      {signal === 'file' && fileName && <p className="m-0 -mt-2 text-[12px] font-medium text-ink-soft">Measuring {fileName}</p>}

      {!analysis ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-sunken" role="status">
          <span className="text-[13px] font-semibold text-ink-soft">Measuring… {Math.round(progress * 100)}%</span>
          <span aria-hidden="true" className="h-1 w-40 overflow-hidden rounded-full bg-track">
            <span className="block h-full bg-accent-strong" style={{ width: `${progress * 100}%` }} />
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-stretch gap-4">
            <div className="flex gap-3 rounded-[var(--radius-tile)] border border-line bg-surface p-3" role="group" aria-label="Meters at the playhead">
              <Bar label="M" value={momentary} target={target} />
              <Bar label="S" value={shortTerm} target={target} />
              <dl className="m-0 flex min-w-[140px] flex-col justify-between gap-2">
                {[
                  ['Momentary', momentary],
                  ['Short-term', shortTerm],
                  ['Integrated so far', running],
                ].map(([name, value]) => (
                  <div key={name as string}>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{name}</dt>
                    <dd className="m-0 text-[20px] font-extrabold tabular-nums text-ink">
                      {show(value as number)} <span className="text-[11px] font-bold text-ink-faint">LUFS</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex min-w-[240px] flex-1 flex-col gap-2">
              <dl className="m-0 grid grid-cols-2 gap-2">
                {stats.map(([name, value, unit, warn]) => (
                  <div key={name} className="flex flex-col justify-center rounded-[var(--radius-tile)] bg-surface-muted px-3 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{name}</dt>
                    <dd className={cn('m-0 text-[20px] font-extrabold tabular-nums', warn ? 'text-danger' : 'text-ink')}>
                      {value} <span className="text-[11px] font-bold text-ink-faint">{unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 text-[12px] font-medium text-ink-soft">
                {Number.isFinite(analysis.integrated)
                  ? `${show(Math.abs(analysis.integrated - target))} LU ${analysis.integrated > target ? 'above' : 'below'} the ${show(target, 0)} LUFS target${analysis.truePeak > peakLimit ? `; true peak exceeds ${show(peakLimit, 0)} dBTP` : ''}.`
                  : 'Silent: nothing passes the −70 LUFS gate.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p id={`${id}-graph`} className="m-0 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Loudness over time — <span className="text-ink-soft">short-term</span>, momentary and integrated
            </p>
            <svg
              ref={graphRef}
              viewBox={`0 0 ${W} ${H}`}
              role="slider"
              tabIndex={0}
              aria-labelledby={`${id}-graph`}
              aria-valuemin={0}
              aria-valuemax={Math.round(analysis.duration * 10) / 10}
              aria-valuenow={Math.round((cursor ?? analysis.duration) * 10) / 10}
              aria-valuetext={`${show(cursor ?? analysis.duration)} seconds: momentary ${show(momentary)}, short-term ${show(shortTerm)} LUFS`}
              onKeyDown={onGraphKey}
              onPointerDown={onGraphPointer}
              onPointerMove={onGraphPointer}
              className="block h-auto w-full cursor-crosshair touch-none rounded-[var(--radius-tile)] border border-line bg-surface-sunken outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {[-10, -20, -30, -40, -50].map((level) => (
                <g key={level}>
                  <line x1={0} x2={W} y1={y(level)} y2={y(level)} className="stroke-line" />
                  <text x={4} y={y(level) - 2} className="fill-ink-faint text-[9px] font-medium">
                    {level}
                  </text>
                </g>
              ))}
              <line x1={0} x2={W} y1={y(target)} y2={y(target)} strokeDasharray="4 4" className="stroke-ink-soft" />
              <path d={line(analysis.momentary)} fill="none" strokeWidth={1} className="stroke-[color-mix(in_oklab,var(--color-ink-faint)_70%,transparent)]" />
              <path d={line(analysis.shortTerm)} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-accent-strong" />
              {Number.isFinite(analysis.integrated) && <line x1={0} x2={W} y1={y(analysis.integrated)} y2={y(analysis.integrated)} strokeWidth={1.5} className="stroke-ink" />}
              {cursor !== null && <line x1={x(cursor)} x2={x(cursor)} y1={0} y2={H} strokeWidth={1.5} className="stroke-ink" />}
            </svg>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="m-0 text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
