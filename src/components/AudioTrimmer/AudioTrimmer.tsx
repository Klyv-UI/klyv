'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { Text } from '../Text'

export interface AudioTrimmerRange {
  /** Seconds from the start of the audio. */
  start: number
  end: number
}

export interface AudioTrimmerProps {
  /** The audio to trim — a File from an input or drop, or any Blob. */
  file?: Blob | null
  /** Show a “Choose audio” picker so people can load their own file. */
  allowPick?: boolean
  /** The selection, when controlled. */
  value?: AudioTrimmerRange
  /** The starting selection when uncontrolled. Defaults to the whole file. */
  defaultValue?: AudioTrimmerRange
  /** Called as the handles move. */
  onValueChange?: (range: AudioTrimmerRange) => void
  /** Called with the trimmed WAV when it is exported. */
  onExport?: (wav: Blob, range: AudioTrimmerRange) => void
  /** File name for the download, without extension. */
  exportName?: string
  /** Shortest selection allowed, in seconds. */
  minLength?: number
  /** Waveform height in pixels. */
  height?: number
  /** Names the trimmer. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const BUCKETS = 600

/**
 * 16-bit PCM WAV from per-channel samples in −1…1.
 *
 * WAV because it is the one format every browser can both write without a
 * codec and play back: a 44-byte header, then the samples interleaved.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const count = channels.length
  const length = channels[0]?.length ?? 0
  const dataBytes = length * count * 2
  const view = new DataView(new ArrayBuffer(44 + dataBytes))
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * 2, true) // bytes per second
  view.setUint16(32, count * 2, true) // bytes per frame
  view.setUint16(34, 16, true) // bits per sample
  text(36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < count; c += 1) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true)
      offset += 2
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' })
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`

/**
 * Cut a clip out of an audio file in the browser — for a ringtone, a podcast
 * teaser, a voice note with the fumbling start removed.
 *
 * The file is decoded with Web Audio, so the waveform is the real signal: each
 * column is the minimum and maximum sample in its slice, which is how a
 * transient a few milliseconds long stays visible at any zoom. The handles are
 * sliders — arrow keys nudge by a tenth of a second, Shift by a second — so a
 * cut can be placed without a pointer.
 *
 * Export writes WAV directly from the decoded samples. No server and no
 * encoder library: trimming should not upload someone's recording anywhere.
 */
export function AudioTrimmer({
  file,
  allowPick = true,
  value,
  defaultValue,
  onValueChange,
  onExport,
  exportName = 'trimmed',
  minLength = 0.1,
  height = 96,
  label = 'Audio trimmer',
  className,
}: AudioTrimmerProps) {
  const reduced = usePrefersReducedMotion()
  const [picked, setPicked] = useState<Blob | null>(null)
  const source = picked ?? file ?? null
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [status, setStatus] = useState<'empty' | 'decoding' | 'ready' | 'error'>('empty')
  const [inner, setInner] = useState<AudioTrimmerRange>({ start: 0, end: 0 })
  const range = value ?? inner
  const [playhead, setPlayhead] = useState<number | null>(null)
  const context = useRef<AudioContext | null>(null)
  const player = useRef<{ node?: AudioBufferSourceNode; frame?: number }>({})
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<'start' | 'end' | null>(null)
  const clipId = `trim-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const duration = buffer?.duration ?? 0

  useEffect(() => {
    setPicked(null)
  }, [file])

  useEffect(() => {
    if (!source) return setStatus('empty')
    if (typeof AudioContext === 'undefined') return setStatus('error')
    let cancelled = false
    setStatus('decoding')
    context.current ??= new AudioContext()
    source
      .arrayBuffer()
      .then((bytes) => context.current!.decodeAudioData(bytes))
      .then((decoded) => {
        if (cancelled) return
        setBuffer(decoded)
        const initial = defaultValue ?? { start: 0, end: decoded.duration }
        setInner({ start: Math.max(0, initial.start), end: Math.min(decoded.duration, initial.end) })
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
    }
    // defaultValue is read once per file, as a default should be.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const peaks = useMemo(() => {
    if (!buffer) return ''
    const data = buffer.getChannelData(0)
    const other = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null
    const step = Math.max(1, Math.floor(data.length / BUCKETS))
    let d = ''
    for (let b = 0; b < BUCKETS; b += 1) {
      let min = 0
      let max = 0
      for (let i = b * step; i < Math.min(data.length, (b + 1) * step); i += 1) {
        const sample = other ? (data[i] + other[i]) / 2 : data[i]
        if (sample < min) min = sample
        if (sample > max) max = sample
      }
      const top = 50 - max * 48
      const bottom = Math.max(top + 0.6, 50 - min * 48)
      d += `M${b} ${top.toFixed(2)}h0.72V${bottom.toFixed(2)}h-0.72Z`
    }
    return d
  }, [buffer])

  const stopPreview = () => {
    try {
      player.current.node?.stop()
    } catch {
      /* already ended */
    }
    if (player.current.frame) cancelAnimationFrame(player.current.frame)
    player.current = {}
    setPlayhead(null)
  }

  useEffect(
    () => () => {
      stopPreview()
      void context.current?.close().catch(() => undefined)
      context.current = null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const update = (next: AudioTrimmerRange) => {
    if (playhead !== null) stopPreview()
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const moveHandle = (which: 'start' | 'end', seconds: number) => {
    const at = Math.round(seconds * 100) / 100
    if (which === 'start') update({ start: Math.max(0, Math.min(at, range.end - minLength)), end: range.end })
    else update({ start: range.start, end: Math.min(duration, Math.max(at, range.start + minLength)) })
  }

  const timeAt = (clientX: number) => {
    const box = track.current!.getBoundingClientRect()
    return (Math.max(0, Math.min(box.width, clientX - box.left)) / box.width) * duration
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!duration) return
    const at = timeAt(event.clientX)
    const handle = (event.target as HTMLElement).dataset.handle as 'start' | 'end' | undefined
    drag.current = handle ?? (Math.abs(at - range.start) < Math.abs(at - range.end) ? 'start' : 'end')
    event.currentTarget.setPointerCapture(event.pointerId)
    moveHandle(drag.current, at)
    event.preventDefault()
    // preventDefault stops the text selection a drag would start, and focus with it; give focus to the handle in hand.
    track.current?.querySelector<HTMLElement>(`[role="slider"][data-handle="${drag.current}"]`)?.focus()
  }

  const onKeyDown = (which: 'start' | 'end') => (event: KeyboardEvent) => {
    const current = range[which]
    const step = event.shiftKey ? 1 : 0.1
    const moves: Record<string, number> = {
      ArrowLeft: current - step,
      ArrowDown: current - step,
      ArrowRight: current + step,
      ArrowUp: current + step,
      PageDown: current - 5,
      PageUp: current + 5,
      Home: 0,
      End: duration,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    moveHandle(which, moves[event.key])
  }

  const preview = async () => {
    if (!buffer || !context.current) return
    if (playhead !== null) return stopPreview()
    await context.current.resume()
    const node = context.current.createBufferSource()
    node.buffer = buffer
    node.connect(context.current.destination)
    const startedAt = context.current.currentTime
    node.start(0, range.start, range.end - range.start)
    node.onended = () => player.current.node === node && stopPreview()
    player.current = { node }
    let last = 0
    const tick = (now: number) => {
      player.current.frame = requestAnimationFrame(tick)
      // Under reduced motion the playhead steps four times a second instead of gliding.
      if (reduced && now - last < 250) return
      last = now
      setPlayhead(range.start + (context.current!.currentTime - startedAt))
    }
    player.current.frame = requestAnimationFrame(tick)
    setPlayhead(range.start)
  }

  const exportClip = () => {
    if (!buffer) return
    const from = Math.floor(range.start * buffer.sampleRate)
    const to = Math.floor(range.end * buffer.sampleRate)
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).subarray(from, to))
    const wav = encodeWav(channels, buffer.sampleRate)
    onExport?.(wav, range)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(wav)
    link.download = `${exportName}.wav`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const pct = (seconds: number) => `${duration ? (seconds / duration) * 100 : 0}%`
  const handle = (which: 'start' | 'end') => (
    <div
      role="slider"
      tabIndex={0}
      data-handle={which}
      aria-label={which === 'start' ? 'Selection start' : 'Selection end'}
      aria-valuemin={which === 'start' ? 0 : Number((range.start + minLength).toFixed(2))}
      aria-valuemax={which === 'start' ? Number((range.end - minLength).toFixed(2)) : Number(duration.toFixed(2))}
      aria-valuenow={Number(range[which].toFixed(2))}
      aria-valuetext={clock(range[which])}
      onKeyDown={onKeyDown(which)}
      style={{ left: pct(range[which]) }}
      className="absolute inset-y-0 z-10 -ml-2 flex w-4 cursor-ew-resize touch-none justify-center rounded-[4px] outline-offset-2"
    >
      <span data-handle={which} className="h-full w-1 rounded-full bg-accent-strong shadow-[var(--shadow-float)]" />
    </div>
  )

  return (
    <section aria-label={label} className={cn('flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4', className)}>
      {allowPick && (
        <label className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink-soft">
          Choose audio
          <input type="file" accept="audio/*" className="text-[12px]" onChange={(event) => setPicked(event.target.files?.[0] ?? null)} />
        </label>
      )}

      {status !== 'ready' || !buffer ? (
        <Text size="caption" tone={status === 'error' ? 'danger' : 'faint'} className="grid place-items-center rounded-[var(--radius-tile)] border border-dashed border-line text-center" style={{ height }}>
          {status === 'decoding'
            ? 'Decoding audio…'
            : status === 'error'
              ? 'This audio could not be decoded here. Try a WAV, MP3 or Ogg file in a browser with Web Audio.'
              : 'Choose an audio file to trim.'}
        </Text>
      ) : (
        <div ref={track} onPointerDown={onPointerDown} onPointerMove={(event) => drag.current && moveHandle(drag.current, timeAt(event.clientX))} onPointerUp={() => (drag.current = null)} className="relative touch-none select-none" style={{ height }}>
          <svg viewBox={`0 0 ${BUCKETS} 100`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full rounded-[var(--radius-tile)] bg-surface-sunken">
            <defs>
              <clipPath id={clipId}>
                <rect x={(range.start / duration) * BUCKETS} width={((range.end - range.start) / duration) * BUCKETS} y="0" height="100" />
              </clipPath>
            </defs>
            <path d={peaks} className="fill-line-strong" />
            <path d={peaks} clipPath={`url(#${clipId})`} className="fill-accent-strong" />
          </svg>
          <div aria-hidden="true" className="absolute inset-y-0 left-0 bg-[color-mix(in_oklab,var(--color-surface)_55%,transparent)]" style={{ width: pct(range.start) }} />
          <div aria-hidden="true" className="absolute inset-y-0 right-0 bg-[color-mix(in_oklab,var(--color-surface)_55%,transparent)]" style={{ left: pct(range.end) }} />
          {playhead !== null && <div aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(playhead) }} />}
          {handle('start')}
          {handle('end')}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Text as="span" size="caption" tone="soft" tabular>
          {clock(range.start)} – {clock(range.end)} · {(range.end - range.start).toFixed(1)}s of {duration.toFixed(1)}s
        </Text>
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="muted" onClick={preview} disabled={!buffer}>
            {playhead !== null ? 'Stop' : 'Play selection'}
          </Button>
          <Button size="sm" onClick={exportClip} disabled={!buffer}>
            Export WAV
          </Button>
        </span>
      </div>
    </section>
  )
}
