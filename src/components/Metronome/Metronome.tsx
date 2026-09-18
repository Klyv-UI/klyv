'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { InlineMessage } from '../InlineMessage'
import { NumberInput } from '../NumberInput'
import { Select } from '../Select'
import { Slider } from '../Slider'
import { Text } from '../Text'

export type MetronomeTimeSignature = '2/4' | '3/4' | '4/4' | '5/4' | '6/8' | '7/8'

export interface MetronomeProps {
  /** Tempo in beats per minute (controlled). */
  value?: number
  /** Initial tempo when uncontrolled. */
  defaultValue?: number
  /** Called when the tempo changes — slider, field, or tap. */
  onValueChange?: (bpm: number) => void
  /** Slowest tempo allowed. */
  min?: number
  /** Fastest tempo allowed. */
  max?: number
  /** Time signature (controlled). The top number is the clicks in a bar. */
  timeSignature?: MetronomeTimeSignature
  /** Initial time signature when uncontrolled. */
  defaultTimeSignature?: MetronomeTimeSignature
  onTimeSignatureChange?: (signature: MetronomeTimeSignature) => void
  /** Play the first beat of each bar higher and louder. */
  accent?: boolean
  /** Called on every beat as it sounds, with its 1-based position in the bar. */
  onBeat?: (beat: number) => void
  /** Accessible name for the whole control. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const SIGNATURES: MetronomeTimeSignature[] = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8']
/** How often the scheduler wakes, and how far ahead of the audio clock it books clicks. */
const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_S = 0.12

/**
 * A metronome whose clicks land on time.
 *
 * `setInterval` alone drifts and stutters whenever the main thread is busy,
 * which a musician hears at once. Instead a short timer wakes every 25ms and
 * books any click due in the next 120ms on the AudioContext clock, which runs
 * on the audio thread and does not drift. The lit beat is drawn from the same
 * booked times, so what is seen matches what is heard.
 *
 * Browsers only allow sound after a gesture, so the AudioContext is created
 * on the first press of Start — never on load. Space starts and stops from
 * anywhere inside the control except where Space already means something.
 * Tap tempo averages the last few taps, and a pause of two seconds starts a
 * new count. Under reduced motion the flashing dots are replaced by a still
 * “Beat 2 of 4” readout.
 */
export function Metronome({
  value,
  defaultValue = 100,
  onValueChange,
  min = 30,
  max = 260,
  timeSignature,
  defaultTimeSignature = '4/4',
  onTimeSignatureChange,
  accent = true,
  onBeat,
  label = 'Metronome',
  className,
}: MetronomeProps) {
  const sliderId = useId()
  const hintId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const [uncontrolledBpm, setUncontrolledBpm] = useState(defaultValue)
  const bpm = value ?? uncontrolledBpm
  const [uncontrolledSignature, setUncontrolledSignature] = useState(defaultTimeSignature)
  const signature = timeSignature ?? uncontrolledSignature
  const beats = Number(signature.split('/')[0])

  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const audio = useRef<AudioContext | null>(null)
  const settings = useRef({ bpm, beats, accent, onBeat })
  settings.current = { bpm, beats, accent, onBeat }
  const taps = useRef<number[]>([])

  const setBpm = (next: number) => {
    const clamped = Math.round(Math.min(max, Math.max(min, next)))
    if (value === undefined) setUncontrolledBpm(clamped)
    onValueChange?.(clamped)
  }

  const setSignature = (next: MetronomeTimeSignature) => {
    if (timeSignature === undefined) setUncontrolledSignature(next)
    onTimeSignatureChange?.(next)
  }

  useEffect(() => {
    if (!playing) return
    const context = audio.current
    if (!context) return

    let nextTime = context.currentTime + 0.06
    let position = 0
    const booked: { time: number; beat: number }[] = []
    let frame = 0

    const click = (time: number, first: boolean) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = first ? 1320 : 880
      gain.gain.setValueAtTime(first ? 0.9 : 0.55, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(time)
      oscillator.stop(time + 0.06)
    }

    const schedule = () => {
      const { bpm: tempo, beats: perBar, accent: accented } = settings.current
      while (nextTime < context.currentTime + SCHEDULE_AHEAD_S) {
        const inBar = position % perBar
        click(nextTime, accented && inBar === 0)
        booked.push({ time: nextTime, beat: inBar + 1 })
        nextTime += 60 / tempo
        position = inBar + 1
      }
    }

    const draw = () => {
      let shown = 0
      while (booked.length > 0 && booked[0]!.time <= context.currentTime) shown = booked.shift()!.beat
      if (shown) {
        setBeat(shown)
        settings.current.onBeat?.(shown)
      }
      frame = requestAnimationFrame(draw)
    }

    schedule()
    const timer = window.setInterval(schedule, LOOKAHEAD_MS)
    frame = requestAnimationFrame(draw)
    return () => {
      window.clearInterval(timer)
      cancelAnimationFrame(frame)
      setBeat(0)
    }
  }, [playing])

  useEffect(() => () => void audio.current?.close(), [])

  const toggle = async () => {
    if (playing) {
      setPlaying(false)
      setStatus('Stopped')
      return
    }
    const AudioContextClass =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    if (!AudioContextClass) {
      setError('This browser cannot play audio, so the metronome cannot start.')
      return
    }
    try {
      audio.current ??= new AudioContextClass()
      if (audio.current.state === 'suspended') await audio.current.resume()
      setError(null)
      setPlaying(true)
      setStatus(`Playing at ${bpm} beats per minute in ${signature}`)
    } catch {
      setError('Sound could not be started. Check that this page is allowed to play audio.')
    }
  }

  const tap = () => {
    const now = performance.now()
    const recent = taps.current.filter((time) => now - time < 2000)
    recent.push(now)
    taps.current = recent.slice(-5)
    if (taps.current.length < 2) return
    const gaps = taps.current.slice(1).map((time, index) => time - taps.current[index]!)
    setBpm(60000 / (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== ' ' || event.defaultPrevented) return
    const target = event.target as HTMLElement
    // Space already presses a button, opens a select, or types into a field.
    if (target.closest('button, [role="combobox"], [role="listbox"], textarea, input:not([type="range"])')) return
    event.preventDefault()
    void toggle()
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={hintId}
      // Focusable itself, so Space has somewhere to be pressed that is not already a control.
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn('flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5', className)}
    >
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Text as="span" size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
            Tempo
          </Text>
          <Text as="span" size="display" tabular>
            {bpm}
            <span className="ml-1.5 text-[13px] font-bold text-ink-faint">BPM</span>
          </Text>
        </div>
        {reducedMotion ? (
          <Text as="span" size="stat" tabular aria-hidden="true" className="pb-1">
            {playing && beat ? `Beat ${beat} of ${beats}` : `${beats} beats a bar`}
          </Text>
        ) : (
          <div aria-hidden="true" className="flex items-center gap-1.5 pb-2">
            {Array.from({ length: beats }, (_, index) => (
              <span
                key={index}
                className={cn(
                  'rounded-full transition-[background-color,transform] duration-75',
                  index === 0 && accent ? 'size-4' : 'size-3',
                  beat === index + 1
                    ? 'scale-125 bg-accent-strong'
                    : index === 0 && accent
                      ? 'bg-line-strong'
                      : 'bg-surface-muted',
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={sliderId} className="sr-only">
          Tempo in beats per minute
        </label>
        <Slider
          id={sliderId}
          min={min}
          max={max}
          value={bpm}
          aria-valuetext={`${bpm} beats per minute`}
          onChange={(event) => setBpm(Number(event.target.value))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NumberInput
          aria-label="Beats per minute"
          value={bpm}
          min={min}
          max={max}
          onValueChange={setBpm}
          inputSize="sm"
          containerClassName="w-[132px]"
        />
        <Select
          label="Time signature"
          size="sm"
          value={signature}
          onValueChange={setSignature}
          options={SIGNATURES.map((option) => ({ value: option, label: option }))}
        />
        <Button variant="outline" size="sm" onClick={tap}>
          Tap tempo
        </Button>
        <Button size="sm" onClick={() => void toggle()} className="ml-auto min-w-[84px]">
          {playing ? 'Stop' : 'Start'}
        </Button>
      </div>

      <Text id={hintId} size="caption" tone="faint">
        Space starts and stops while the metronome has focus.
      </Text>

      {error && (
        <InlineMessage tone="danger" live>
          {error}
        </InlineMessage>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  )
}
