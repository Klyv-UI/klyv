'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { Text } from '../Text'

export interface PitchTunerReading {
  /** Detected fundamental, in hertz. */
  frequency: number
  /** Nearest equal-tempered note, e.g. `A`, `C#`. */
  note: string
  octave: number
  /** How far from that note, −50 to +50. Positive is sharp. */
  cents: number
}

export interface PitchTunerProps {
  /** Concert pitch for A4, in hertz, when controlled. */
  referenceA4?: number
  /** Starting concert pitch when uncontrolled. */
  defaultReferenceA4?: number
  /** Called when the person changes the reference. */
  onReferenceA4Change?: (hertz: number) => void
  /** Cents either side of the note that count as in tune. */
  tolerance?: number
  /** Lowest pitch listened for. Lower costs more work per frame. */
  minFrequency?: number
  /** Highest pitch listened for. */
  maxFrequency?: number
  /** Called with each new reading, or null when the sound stops. */
  onPitch?: (reading: PitchTunerReading | null) => void
  /** Names the tuner. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * The fundamental frequency of a buffer of samples, by the YIN method, or null
 * when the buffer is too quiet or has no clear period.
 *
 * YIN rather than a plain autocorrelation peak because the plain peak jumps an
 * octave whenever the second harmonic is louder than the first — which on a
 * guitar's low strings is most of the time.
 */
export function detectPitch(samples: Float32Array, sampleRate: number, minFrequency = 60, maxFrequency = 1500): number | null {
  let energy = 0
  for (const sample of samples) energy += sample * sample
  if (Math.sqrt(energy / samples.length) < 0.01) return null

  const maxLag = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(samples.length / 2))
  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency))
  const span = samples.length - maxLag - 1
  const cmnd = new Float32Array(maxLag + 2)
  cmnd[0] = 1
  let running = 0
  for (let lag = 1; lag <= maxLag + 1; lag += 1) {
    let sum = 0
    for (let i = 0; i < span; i += 1) {
      const delta = samples[i] - samples[i + lag]
      sum += delta * delta
    }
    running += sum
    // Cumulative mean normalised difference: removes the bias towards lag 0.
    cmnd[lag] = running ? (sum * lag) / running : 1
  }

  let lag = -1
  for (let tau = minLag; tau <= maxLag; tau += 1) {
    if (cmnd[tau] < 0.15) {
      while (tau + 1 <= maxLag && cmnd[tau + 1] < cmnd[tau]) tau += 1
      lag = tau
      break
    }
  }
  if (lag === -1) return null

  // Parabolic interpolation between samples for sub-sample accuracy.
  const [a, b, c] = [cmnd[lag - 1], cmnd[lag], cmnd[lag + 1]]
  const shift = (a - c) / (2 * (a - 2 * b + c)) || 0
  return sampleRate / (lag + Math.max(-1, Math.min(1, shift)))
}

/** Frequency to the nearest note name, octave and cents, against a given A4. */
export function describePitch(frequency: number, referenceA4 = 440): PitchTunerReading {
  const midi = 69 + 12 * Math.log2(frequency / referenceA4)
  const nearest = Math.round(midi)
  return { frequency, note: NAMES[((nearest % 12) + 12) % 12], octave: Math.floor(nearest / 12) - 1, cents: Math.round((midi - nearest) * 100) }
}

/**
 * A chromatic tuner that listens through the microphone.
 *
 * Pitch is measured from the analyser's raw waveform with YIN, not read off
 * the FFT: an FFT bin at 48 kHz is several hertz wide, which at the bottom of
 * a bass is most of a semitone. The last few readings are median-filtered so
 * the needle settles instead of twitching on every pluck's attack.
 *
 * Concert pitch is adjustable because orchestras and early-music groups do not
 * all tune to 440. The needle eases between readings where motion is welcome
 * and jumps straight to them where it is not. The microphone is released when
 * the tuner is stopped or unmounted.
 */
export function PitchTuner({
  referenceA4,
  defaultReferenceA4 = 440,
  onReferenceA4Change,
  tolerance = 5,
  minFrequency = 60,
  maxFrequency = 1500,
  onPitch,
  label = 'Tuner',
  className,
}: PitchTunerProps) {
  const [innerA4, setInnerA4] = useState(defaultReferenceA4)
  const a4 = referenceA4 ?? innerA4
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'denied' | 'unavailable'>('idle')
  const [reading, setReading] = useState<PitchTunerReading | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const live = useRef<{ stream?: MediaStream; context?: AudioContext; timer?: ReturnType<typeof setInterval> }>({})
  const settings = useRef({ a4, minFrequency, maxFrequency, onPitch })
  settings.current = { a4, minFrequency, maxFrequency, onPitch }
  const spoken = useRef({ text: '', at: 0 })
  const inputId = useId()
  const alive = useRef(true)
  const [draft, setDraft] = useState<string | null>(null)

  const stop = () => {
    clearInterval(live.current.timer)
    live.current.stream?.getTracks().forEach((track) => track.stop())
    void live.current.context?.close().catch(() => undefined)
    live.current = {}
    setReading(null)
    setStatus('idle')
  }

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') return setStatus('unavailable')
    setStatus('starting')
    try {
      // Voice processing is for speech; it smears the waveform a tuner needs.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      if (!alive.current) return stream.getTracks().forEach((track) => track.stop())
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      const recent: number[] = []
      let silentSince = 0
      live.current = { stream, context }
      live.current.timer = setInterval(() => {
        const { a4: reference, minFrequency: low, maxFrequency: high, onPitch: report } = settings.current
        analyser.getFloatTimeDomainData(samples)
        const frequency = detectPitch(samples, context.sampleRate, low, high)
        const now = performance.now()
        if (frequency === null) {
          if (!silentSince) silentSince = now
          if (now - silentSince > 400 && recent.length) {
            recent.length = 0
            setReading(null)
            report?.(null)
          }
          return
        }
        silentSince = 0
        recent.push(frequency)
        if (recent.length > 5) recent.shift()
        const median = [...recent].sort((x, y) => x - y)[Math.floor(recent.length / 2)]
        const next = describePitch(median, reference)
        setReading(next)
        report?.(next)
      }, 50)
      setStatus('listening')
    } catch (error) {
      const name = (error as DOMException)?.name
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      clearInterval(live.current.timer)
      live.current.stream?.getTracks().forEach((track) => track.stop())
      void live.current.context?.close().catch(() => undefined)
    }
  }, [])

  const inTune = reading !== null && Math.abs(reading.cents) <= tolerance
  const verdict = reading === null ? '' : inTune ? 'in tune' : `${Math.abs(reading.cents)} cents ${reading.cents < 0 ? 'flat' : 'sharp'}`

  // Screen readers get the note at a speaking pace, not twenty times a second.
  useEffect(() => {
    if (!reading) return
    const text = `${reading.note}${reading.octave}, ${inTune ? 'in tune' : reading.cents < 0 ? 'flat' : 'sharp'}`
    const now = Date.now()
    if (text !== spoken.current.text && now - spoken.current.at > 1500) {
      spoken.current = { text, at: now }
      setAnnouncement(text)
    }
  }, [reading, inTune])

  const setA4 = (next: number) => {
    if (!Number.isFinite(next)) return
    const clamped = Math.max(400, Math.min(480, Math.round(next)))
    if (referenceA4 === undefined) setInnerA4(clamped)
    onReferenceA4Change?.(clamped)
  }
  /** Typing “4” on the way to “432” must not snap to 400, so the draft commits only when in range. */
  const typeA4 = (text: string) => {
    setDraft(text)
    const next = Number(text)
    if (text && next >= 400 && next <= 480) setA4(next)
  }

  const angle = reading ? Math.max(-50, Math.min(50, reading.cents)) * 0.9 : 0
  const message =
    status === 'denied'
      ? 'Microphone access is blocked. Allow it from the address bar, then start again.'
      : status === 'unavailable'
        ? 'No microphone is available, or this browser cannot analyse audio.'
        : status === 'listening' && !reading
          ? 'Play a single note and let it ring.'
          : status === 'idle'
            ? 'Start the tuner and allow the microphone. Nothing is recorded.'
            : ''

  return (
    <div role="group" aria-label={label} className={cn('flex w-full max-w-[380px] flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5', className)}>
      <svg
        viewBox="0 0 200 116"
        className="w-full max-w-[280px]"
        role="meter"
        aria-label="Tuning"
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={reading?.cents ?? 0}
        aria-valuetext={reading ? `${reading.note}${reading.octave}, ${verdict}` : 'No note'}
      >
        <path d="M22 100a78 78 0 01156 0" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-track" />
        <path
          d={`M${100 - 78 * Math.sin((tolerance * 0.9 * Math.PI) / 180)} ${100 - 78 * Math.cos((tolerance * 0.9 * Math.PI) / 180)}A78 78 0 01${100 + 78 * Math.sin((tolerance * 0.9 * Math.PI) / 180)} ${100 - 78 * Math.cos((tolerance * 0.9 * Math.PI) / 180)}`}
          fill="none"
          strokeWidth="10"
          className="stroke-success"
        />
        {[-50, -25, 0, 25, 50].map((cents) => {
          const radians = (cents * 0.9 * Math.PI) / 180
          return (
            <line key={cents} x1={100 + 64 * Math.sin(radians)} y1={100 - 64 * Math.cos(radians)} x2={100 + 58 * Math.sin(radians)} y2={100 - 58 * Math.cos(radians)} strokeWidth="2" className="stroke-line-strong" />
          )
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px' }} className="transition-transform duration-150 ease-out motion-reduce:transition-none">
          <line x1="100" y1="100" x2="100" y2="30" strokeWidth="3" strokeLinecap="round" className={reading ? (inTune ? 'stroke-success' : 'stroke-ink') : 'stroke-line-strong'} />
        </g>
        <circle cx="100" cy="100" r="6" className="fill-ink" />
      </svg>

      <div className="flex flex-col items-center gap-0.5" aria-hidden="true">
        <Text as="span" size="display" tone={inTune ? 'success' : reading ? 'default' : 'faint'}>
          {reading ? reading.note : '—'}
          <span className="text-[16px]">{reading?.octave}</span>
        </Text>
        <Text as="span" size="caption" tone="soft" tabular>
          {reading ? `${reading.frequency.toFixed(1)} Hz · ${reading.cents > 0 ? '+' : ''}${reading.cents}¢ · ${verdict}` : ' '}
        </Text>
      </div>
      <div role="status" className="sr-only">
        {announcement}
      </div>

      {message && (
        <Text size="caption" tone={status === 'denied' || status === 'unavailable' ? 'danger' : 'faint'} leading="normal" className="text-center">
          {message}
        </Text>
      )}

      <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <Button size="sm" variant={status === 'listening' ? 'outline' : 'accent'} onClick={status === 'listening' ? stop : start} disabled={status === 'starting'}>
          {status === 'listening' ? 'Stop tuner' : 'Start tuner'}
        </Button>
        <span className="flex items-center gap-2">
          <label htmlFor={inputId} className="text-[12px] font-semibold text-ink-soft">
            Reference A4
          </label>
          <Input
            id={inputId}
            type="number"
            inputSize="sm"
            min={400}
            max={480}
            step={1}
            value={draft ?? String(a4)}
            onChange={(event) => typeA4(event.target.value)}
            onBlur={() => {
              if (draft !== null) setA4(Number(draft) || a4)
              setDraft(null)
            }}
            containerClassName="w-[92px]"
            trailing={<span className="text-[11px] text-ink-faint">Hz</span>}
          />
        </span>
      </div>
    </div>
  )
}
