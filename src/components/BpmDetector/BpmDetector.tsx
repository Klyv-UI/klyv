'use client'

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { Switch } from '../Switch'

export interface BpmDetectorResult {
  /** Tempo in beats per minute, to a tenth. */
  bpm: number
  /** How clearly the winning tempo stood out, 0 to 1. */
  confidence: number
  /** Estimated beat times in seconds. */
  beats: number[]
}

export interface BpmDetectorProps {
  /** Tempos offered for the generated drum loop. */
  loopTempos?: number[]
  /** Slowest and fastest tempo considered. */
  minBpm?: number
  maxBpm?: number
  /** Offer analysing a local audio file. */
  allowFiles?: boolean
  /** Called when an analysis finishes. */
  onDetect?: (result: BpmDetectorResult) => void
  /** Merged last, so it wins. */
  className?: string
}

const RATE = 22050
const FRAME = 1024
const HOP = 256
const FPS = RATE / HOP

/* ------------------------------------------------------------------ signal */

/** A drum loop at a given tempo — kick, snare, hats and a bass line — starting a little after zero so the phase is not trivial. */
function drumLoop(bpm: number, sampleRate = 44100) {
  const seconds = 12
  const length = seconds * sampleRate
  const out = new Float32Array(length)
  const beat = 60 / bpm
  const lead = 0.23
  let seed = 11
  const noise = () => {
    seed = (seed * 16807) % 2147483647
    return (seed / 2147483647) * 2 - 1
  }
  const add = (start: number, duration: number, voice: (t: number) => number) => {
    const from = Math.round(start * sampleRate)
    const count = Math.min(length - from, Math.round(duration * sampleRate))
    for (let i = 0; i < count; i += 1) out[from + i] += voice(i / sampleRate)
  }
  for (let n = 0; lead + n * beat < seconds; n += 1) {
    const at = lead + n * beat
    if (n % 2 === 0) {
      let phase = 0
      add(at, 0.35, (t) => {
        phase += (2 * Math.PI * (50 + 110 * Math.exp(-t * 35))) / sampleRate
        return Math.sin(phase) * Math.exp(-t * 9) * 0.9
      })
      add(at, beat * 0.9, (t) => Math.sin(2 * Math.PI * (n % 8 < 4 ? 55 : 49) * t) * 0.25 * Math.exp(-t * 2))
    } else {
      let last = 0
      add(at, 0.2, (t) => {
        const white = noise()
        const bright = white - last * 0.6
        last = white
        return (bright * 0.5 + Math.sin(2 * Math.PI * 200 * t) * 0.25) * Math.exp(-t * 20)
      })
    }
    for (const offset of [0, 0.5]) {
      let previous = 0
      add(at + offset * beat, offset ? 0.12 : 0.04, (t) => {
        const white = noise()
        const high = white - previous
        previous = white
        return high * (offset ? 0.1 : 0.14) * Math.exp(-t * (offset ? 20 : 60))
      })
    }
  }
  return { channels: [out], sampleRate }
}

/**
 * Down to one 22 kHz channel through an OfflineAudioContext, band-limited
 * with a 40 Hz high-pass and an 8 kHz low-pass: rumble and hiss carry no beat,
 * and the low-pass is also the anti-alias filter for the resample.
 */
async function prepare(channels: Float32Array[], sampleRate: number) {
  const length = Math.ceil((channels[0].length * RATE) / sampleRate)
  if (typeof OfflineAudioContext === 'undefined') {
    const mono = new Float32Array(length)
    for (let i = 0; i < length; i += 1) {
      const at = Math.min(channels[0].length - 1, Math.floor((i * sampleRate) / RATE))
      for (const data of channels) mono[i] += data[at] / channels.length
    }
    return { mono, filtered: false }
  }
  const offline = new OfflineAudioContext(1, length, RATE)
  const buffer = offline.createBuffer(channels.length, channels[0].length, sampleRate)
  channels.forEach((data, channel) => buffer.getChannelData(channel).set(data))
  const source = offline.createBufferSource()
  source.buffer = buffer
  const highpass = offline.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 40
  const lowpass = offline.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 8000
  source.connect(highpass).connect(lowpass).connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return { mono: rendered.getChannelData(0), filtered: true }
}

/* ------------------------------------------------------------------ analysis */

const WINDOW = Float64Array.from({ length: FRAME }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / FRAME))
const REVERSED = Uint16Array.from({ length: FRAME }, (_, n) => {
  let out = 0
  for (let bit = 1, value = n; bit < FRAME; bit <<= 1, value >>= 1) out = (out << 1) | (value & 1)
  return out
})

/** Iterative radix-2 FFT, in place. */
function fft(re: Float64Array, im: Float64Array) {
  for (let i = 0; i < FRAME; i += 1) {
    const j = REVERSED[i]
    if (j > i) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let size = 2; size <= FRAME; size <<= 1) {
    const step = (-2 * Math.PI) / size
    for (let start = 0; start < FRAME; start += size) {
      for (let k = 0; k < size / 2; k += 1) {
        const wr = Math.cos(step * k)
        const wi = Math.sin(step * k)
        const a = start + k
        const b = a + size / 2
        const tr = wr * re[b] - wi * im[b]
        const ti = wr * im[b] + wi * re[b]
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

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

/** Spectral flux: how much log-magnitude rose, summed over bins, frame to frame. Chunked across tasks. */
function onsetEnvelope(mono: Float32Array, onProgress: (share: number) => void, token: { cancelled: boolean }) {
  return new Promise<Float64Array | null>((resolve) => {
    const frames = Math.max(0, Math.floor((mono.length - FRAME) / HOP) + 1)
    const flux = new Float64Array(frames)
    let previous = new Float64Array(FRAME / 2)
    let current = new Float64Array(FRAME / 2)
    const re = new Float64Array(FRAME)
    const im = new Float64Array(FRAME)
    let frame = 0
    const slice = () => {
      if (token.cancelled) return resolve(null)
      const end = Math.min(frames, frame + 600)
      for (; frame < end; frame += 1) {
        const offset = frame * HOP
        for (let n = 0; n < FRAME; n += 1) {
          re[n] = mono[offset + n] * WINDOW[n]
          im[n] = 0
        }
        fft(re, im)
        let rise = 0
        for (let k = 1; k < FRAME / 2; k += 1) {
          current[k] = Math.log1p(100 * Math.hypot(re[k], im[k]))
          const delta = current[k] - previous[k]
          if (delta > 0 && frame > 0) rise += delta
        }
        flux[frame] = rise
        ;[previous, current] = [current, previous]
      }
      onProgress(frames ? frame / frames : 1)
      if (frame < frames) nextTask(slice)
      else resolve(flux)
    }
    slice()
  })
}

/** Subtract a moving average and keep what rises above it: the peaks, not the loudness. */
function normalise(flux: Float64Array) {
  const half = Math.round(FPS * 0.25)
  const out = new Float64Array(flux.length)
  let max = 0
  for (let i = 0; i < flux.length; i += 1) {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - half); j <= Math.min(flux.length - 1, i + half); j += 1) {
      sum += flux[j]
      count += 1
    }
    out[i] = Math.max(0, flux[i] - sum / count)
    max = Math.max(max, out[i])
  }
  if (max > 0) for (let i = 0; i < out.length; i += 1) out[i] /= max
  return out
}

const sample = (envelope: Float64Array, at: number) => {
  const i = Math.floor(at)
  const f = at - i
  return (envelope[i] ?? 0) * (1 - f) + (envelope[i + 1] ?? 0) * f
}

/** Best phase and how well a beat grid of `period` frames lines up with the onsets. */
function gridFit(envelope: Float64Array, period: number) {
  let best = { phase: 0, score: -1 }
  for (let phase = 0; phase < period; phase += 0.5) {
    let sum = 0
    let count = 0
    for (let at = phase; at < envelope.length - 1; at += period) {
      sum += sample(envelope, at)
      count += 1
    }
    const score = count ? sum / count : 0
    if (score > best.score) best = { phase, score }
  }
  return best
}

/**
 * Tempo from the onset envelope. Autocorrelation finds periods at which the
 * onsets repeat; each lag is scored with its double (a true beat period also
 * repeats at two beats) and weighted by a log-normal prior around 120 BPM,
 * because autocorrelation alone cannot tell 70 from 140. Then the octave check:
 * a winner below 90 or above 180 gives way to its double or half if that fits
 * nearly as well. A fine search around the peak, fitting a beat grid, sets the
 * tempo to a tenth and finds where the beats fall.
 */
function detect(envelope: Float64Array, minBpm: number, maxBpm: number): BpmDetectorResult {
  const lagMin = Math.floor((60 / maxBpm) * FPS)
  const lagMax = Math.ceil((60 / minBpm) * FPS)
  const ac = new Float64Array(lagMax * 2 + 2)
  for (let lag = 1; lag < ac.length && lag < envelope.length; lag += 1) {
    let sum = 0
    for (let i = 0; i + lag < envelope.length; i += 1) sum += envelope[i] * envelope[i + lag]
    ac[lag] = sum / (envelope.length - lag)
  }
  const prior = (bpm: number) => Math.exp(-0.5 * Math.log2(bpm / 120) ** 2)
  const scores = new Map<number, number>()
  for (let lag = lagMin; lag <= lagMax; lag += 1) scores.set(lag, (ac[lag] + 0.5 * ac[lag * 2]) * prior((60 * FPS) / lag))
  let best = lagMin
  for (const [lag, score] of scores) if (score > scores.get(best)!) best = lag
  const raw = (lag: number) => ac[lag] + 0.5 * (ac[lag * 2] ?? 0)
  const bpmOf = (lag: number) => (60 * FPS) / lag
  if (bpmOf(best) < 90 && Math.round(best / 2) >= lagMin && raw(Math.round(best / 2)) >= 0.8 * raw(best)) best = Math.round(best / 2)
  else if (bpmOf(best) > 180 && best * 2 <= lagMax && raw(best * 2) >= 0.8 * raw(best)) best *= 2

  // Parabolic peak, then a grid search ±3% around it.
  const [a, b, c] = [ac[best - 1], ac[best], ac[best + 1]]
  const centre = best + (a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0)
  let fit = { period: centre, phase: 0, score: -1 }
  for (let period = centre * 0.97; period <= centre * 1.03; period += centre * 0.001) {
    const trial = gridFit(envelope, period)
    if (trial.score > fit.score) fit = { period, ...trial }
  }
  const values = [...scores.values()].sort((x, y) => x - y)
  const median = values[Math.floor(values.length / 2)]
  const peak = Math.max(...values)
  const confidence = Math.max(0, Math.min(1, peak > 0 ? (peak - median) / peak : 0))
  const beats: number[] = []
  for (let at = fit.phase; at < envelope.length; at += fit.period) beats.push((at * HOP + FRAME / 2) / RATE)
  return { bpm: Math.round(bpmOf(fit.period) * 10) / 10, confidence, beats }
}

/* ------------------------------------------------------------------ view */

const W = 640

function peaks(mono: Float32Array, columns: number) {
  const size = Math.max(1, Math.floor(mono.length / columns))
  return Array.from({ length: columns }, (_, column) => {
    let low = 0
    let high = 0
    for (let i = column * size; i < Math.min(mono.length, (column + 1) * size); i += 1) {
      low = Math.min(low, mono[i])
      high = Math.max(high, mono[i])
    }
    return [low, high]
  })
}

/**
 * Tempo detection that shows its working.
 *
 * The audio — a decoded file, or a drum loop generated in code — is rendered
 * through an OfflineAudioContext to one band-limited 22 kHz channel. A
 * short-time Fourier transform turns it into spectral flux, the standard onset
 * signal: how much energy arrived, bin by bin, since the previous frame.
 * Autocorrelating that envelope gives the periods at which onsets repeat, and
 * the tempo is the best of those within the allowed range after a prior and an
 * octave check settle the usual doubling and halving mistakes.
 *
 * Nothing is taken on trust: the waveform is drawn with the detected beats on
 * it, playback can click along on them, and Tap lets a person check the answer
 * against their own sense of the beat. Analysis runs in slices, so a
 * four-minute song does not freeze the page.
 */
export function BpmDetector({ loopTempos = [92, 124, 174], minBpm = 60, maxBpm = 200, allowFiles = true, onDetect, className }: BpmDetectorProps) {
  const [choice, setChoice] = useState(String(loopTempos[1] ?? loopTempos[0]))
  const [fileName, setFileName] = useState('')
  const [audio, setAudio] = useState<{ channels: Float32Array[]; sampleRate: number } | null>(null)
  const [state, setState] = useState<{ mono: Float32Array; envelope: Float64Array; result: BpmDetectorResult; filtered: boolean } | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [clicks, setClicks] = useState(true)
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [taps, setTaps] = useState<number[]>([])
  const contextRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<AudioScheduledSourceNode[]>([])
  const reduced = usePrefersReducedMotion()
  const id = useId()

  useEffect(() => {
    if (choice === 'file') return
    setFileName('')
    setAudio(drumLoop(Number(choice)))
  }, [choice])

  useEffect(() => {
    if (!audio) return
    const token = { cancelled: false }
    setState(null)
    setProgress(0)
    setTaps([])
    void (async () => {
      try {
        const { mono, filtered } = await prepare(audio.channels, audio.sampleRate)
        const flux = await onsetEnvelope(mono, setProgress, token)
        if (!flux || token.cancelled) return
        const envelope = normalise(flux)
        const result = detect(envelope, minBpm, maxBpm)
        setState({ mono, envelope, result, filtered })
        onDetect?.(result)
      } catch {
        if (!token.cancelled) setError('That audio could not be analysed.')
      }
    })()
    return () => {
      token.cancelled = true
    }
  }, [audio, minBpm, maxBpm])

  const stop = () => {
    for (const node of nodesRef.current) {
      try {
        node.stop()
      } catch {
        // Not started, or already done.
      }
    }
    nodesRef.current = []
    setPlaying(false)
    setPlayhead(null)
  }

  useEffect(
    () => () => {
      stop()
      void contextRef.current?.close()
    },
    [],
  )

  const play = async () => {
    if (!audio || !state) return
    if (typeof AudioContext === 'undefined') {
      setError('Web Audio is not available here, so nothing can play. The analysis above still stands.')
      return
    }
    const context = (contextRef.current ??= new AudioContext())
    await context.resume()
    const buffer = context.createBuffer(audio.channels.length, audio.channels[0].length, audio.sampleRate)
    audio.channels.forEach((data, channel) => buffer.getChannelData(channel).set(data))
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    const start = context.currentTime + 0.05
    source.start(start)
    const nodes: AudioScheduledSourceNode[] = [source]
    if (clicks) {
      // A short high blip on every detected beat, scheduled on the audio clock so it cannot drift.
      for (const beat of state.result.beats) {
        const blip = context.createOscillator()
        const gain = context.createGain()
        blip.frequency.value = 1760
        gain.gain.setValueAtTime(0.25, start + beat)
        gain.gain.exponentialRampToValueAtTime(0.001, start + beat + 0.04)
        blip.connect(gain).connect(context.destination)
        blip.start(start + beat)
        blip.stop(start + beat + 0.05)
        nodes.push(blip)
      }
    }
    source.onended = () => {
      if (nodesRef.current[0] === source) stop()
    }
    nodesRef.current = nodes
    setPlaying(true)
    const duration = audio.channels[0].length / audio.sampleRate
    const tick = () => {
      if (nodesRef.current[0] !== source) return
      setPlayhead(Math.min(duration, Math.max(0, context.currentTime - start)))
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
      setError('This browser cannot decode audio, so files cannot be analysed here.')
      return
    }
    try {
      const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await file.arrayBuffer())
      setChoice('file')
      setFileName(file.name)
      setAudio({ channels: Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel)), sampleRate: decoded.sampleRate })
    } catch {
      setError(`Could not decode ${file.name}. Try a WAV, MP3, AAC or Ogg file.`)
    }
  }

  // Taps: the median interval of the last eight, restarting after a two-second pause.
  const tap = () => {
    const now = performance.now()
    setTaps((list) => [...(list.length && now - list[list.length - 1] > 2000 ? [] : list), now].slice(-9))
  }
  const intervals = taps.slice(1).map((time, index) => time - taps[index]).sort((a, b) => a - b)
  const tapped = intervals.length >= 3 ? 60000 / intervals[Math.floor(intervals.length / 2)] : null
  const detected = state?.result.bpm
  const ratio = tapped && detected ? tapped / detected : 1
  const octave = Math.abs(ratio - 2) < 0.08 ? ' — double the detected tempo' : Math.abs(ratio - 0.5) < 0.04 ? ' — half the detected tempo' : ''

  const duration = audio ? audio.channels[0].length / audio.sampleRate : 1
  const columns = state ? peaks(state.mono, W / 2) : []

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          label="Audio"
          value={choice}
          onValueChange={(value) => {
            if (value === choice) return
            stop()
            setError('')
            setChoice(value)
          }}
          options={[
            ...loopTempos.map((tempo) => ({ value: String(tempo), label: `Loop ${tempo}` })),
            ...(fileName ? [{ value: 'file', label: 'File' }] : []),
          ]}
        />
        {allowFiles && (
          <label className="inline-flex h-8 cursor-pointer items-center rounded-full border border-line-strong bg-surface px-3.5 text-[12px] font-bold text-ink hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
            Analyse a file
            <input type="file" accept="audio/*" className="sr-only" onChange={onFile} />
          </label>
        )}
      </div>

      {!state ? (
        <div role="status" className="flex h-[168px] flex-col items-center justify-center gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-sunken">
          <span className="text-[13px] font-semibold text-ink-soft">Finding onsets… {Math.round(progress * 100)}%</span>
          <span aria-hidden="true" className="h-1 w-40 overflow-hidden rounded-full bg-track">
            <span className="block h-full bg-accent-strong" style={{ width: `${progress * 100}%` }} />
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="m-0 flex items-baseline gap-1.5" role="status">
              <span className="text-[40px] font-extrabold leading-none tabular-nums text-ink">{state.result.bpm.toFixed(1)}</span>
              <span className="text-[13px] font-bold text-ink-soft">BPM</span>
              <span className="sr-only">, confidence {Math.round(state.result.confidence * 100)} percent</span>
            </p>
            <div className="flex min-w-[140px] flex-col gap-1" aria-hidden="true">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Confidence {Math.round(state.result.confidence * 100)}%</span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-track">
                <span className="block h-full rounded-full bg-accent-strong" style={{ width: `${state.result.confidence * 100}%` }} />
              </span>
            </div>
            <p className="m-0 text-[12px] font-medium text-ink-soft">
              First beat at {state.result.beats[0]?.toFixed(2)} s · {state.result.beats.length} beats
              {fileName ? ` · ${fileName}` : ''}
            </p>
          </div>

          <figure className="m-0 flex flex-col gap-1">
            <svg viewBox={`0 0 ${W} 120`} className="block h-auto w-full rounded-[var(--radius-tile)] border border-line bg-surface-sunken" role="img" aria-labelledby={`${id}-wave`}>
              <title id={`${id}-wave`}>
                Waveform with {state.result.beats.length} detected beats marked, {state.result.bpm} BPM
              </title>
              {columns.map(([low, high], column) => (
                <line key={column} x1={column * 2 + 1} x2={column * 2 + 1} y1={60 - high * 52} y2={60 - low * 52 + 0.5} strokeWidth={1.4} className="stroke-ink-faint" />
              ))}
              {state.result.beats.map((beat, index) => (
                <line key={index} x1={(beat / duration) * W} x2={(beat / duration) * W} y1={4} y2={116} strokeWidth={1.5} className="stroke-accent-strong" />
              ))}
              {playhead !== null && <line x1={(playhead / duration) * W} x2={(playhead / duration) * W} y1={0} y2={120} strokeWidth={2} className="stroke-ink" />}
            </svg>
            <svg viewBox={`0 0 ${W} 36`} className="block h-auto w-full" aria-hidden="true">
              <path
                d={Array.from(state.envelope, (value, index) => `${index ? 'L' : 'M'}${((((index * HOP + FRAME / 2) / RATE) / duration) * W).toFixed(1)},${(34 - value * 32).toFixed(1)}`).join('')}
                fill="none"
                strokeWidth={1}
                className="stroke-ink-soft"
              />
            </svg>
            <figcaption className="text-[11px] font-medium text-ink-faint">
              Waveform with detected beats, and the spectral-flux onset envelope beneath it{state.filtered ? '' : ' (unfiltered: this browser has no OfflineAudioContext)'}.
            </figcaption>
          </figure>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant={playing ? 'outline' : 'accent'} onClick={playing ? stop : play} aria-pressed={playing}>
              {playing ? 'Stop' : 'Play'}
            </Button>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Switch switchSize="sm" checked={clicks} disabled={playing} onChange={(event) => setClicks(event.target.checked)} />
              Click on beats
            </label>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="muted" onClick={tap} aria-describedby={`${id}-tap`}>
                Tap
              </Button>
              <p id={`${id}-tap`} className="m-0 text-[12px] font-medium tabular-nums text-ink-soft" aria-live="polite">
                {tapped
                  ? `You: ${tapped.toFixed(1)} BPM · ${Math.abs((tapped / (detected ?? tapped) - 1) * 100).toFixed(1)}% from detected${octave}`
                  : taps.length
                    ? `Keep tapping… ${4 - taps.length > 0 ? 4 - taps.length : 1} more`
                    : 'Tap along to check'}
              </p>
            </div>
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
