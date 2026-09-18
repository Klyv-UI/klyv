'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { Text } from '../Text'
import { formatMediaTime } from '../VideoPlayer/VideoPlayer'

export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'recorded' | 'denied' | 'unavailable' | 'error'

export interface VoiceRecorderResult {
  blob: Blob
  /** Length in seconds, measured while recording — MediaRecorder files often carry none. */
  duration: number
  mimeType: string
}

export interface VoiceRecorderProps {
  /** Called when a recording stops, with the audio and its length. */
  onRecordingComplete?: (result: VoiceRecorderResult) => void
  /** Called when the person throws the recording away. */
  onDiscard?: () => void
  /** Recording stops by itself after this many seconds. */
  maxDuration?: number
  /** Preferred container. Falls back to whatever the browser can record. */
  mimeType?: string
  /** Names the recorder. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

const EXPLAIN: Partial<Record<VoiceRecorderStatus, string>> = {
  denied: 'Microphone access is blocked. Allow it from the icon in the address bar, then try again.',
  unavailable: 'Recording is not available here: no microphone was found, or the browser cannot record audio.',
  error: 'The microphone could not start. Another app may be using it.',
}

/**
 * Record a voice note without leaving the page.
 *
 * The level meter is the part that earns its place. A recording that captured
 * silence — wrong input, muted headset — is only discovered on playback, after
 * the person has said everything once. A live meter, computed as the RMS of
 * the analyser's waveform rather than a guessed animation, shows in the first
 * second that the microphone is hearing them.
 *
 * Duration is timed here, excluding pauses, because Chrome's WebM recordings
 * have no duration in their header and report `Infinity` to an audio element.
 * The microphone is released as soon as recording stops, and on unmount.
 */
export function VoiceRecorder({
  onRecordingComplete,
  onDiscard,
  maxDuration = 120,
  mimeType,
  label = 'Voice recorder',
  className,
}: VoiceRecorderProps) {
  const reduced = usePrefersReducedMotion()
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState<(VoiceRecorderResult & { url: string }) | null>(null)
  const meter = useRef<HTMLDivElement>(null)
  const parts = useRef<{
    stream?: MediaStream
    recorder?: MediaRecorder
    context?: AudioContext
    frame?: number
    timer?: ReturnType<typeof setInterval>
    chunks: Blob[]
    /** Time recorded before the current run, and when the current run began. */
    banked: number
    since: number
  }>({ chunks: [], banked: 0, since: 0 })
  const alive = useRef(true)
  const urlRef = useRef<string | null>(null)

  const measure = () => {
    const p = parts.current
    return p.banked + (p.recorder?.state === 'recording' ? (performance.now() - p.since) / 1000 : 0)
  }

  const release = () => {
    const p = parts.current
    if (p.frame) cancelAnimationFrame(p.frame)
    clearInterval(p.timer)
    p.stream?.getTracks().forEach((track) => track.stop())
    void p.context?.close().catch(() => undefined)
    p.stream = undefined
    p.context = undefined
    if (meter.current) meter.current.style.transform = 'scaleX(0)'
  }

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return setStatus('unavailable')
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (!alive.current) return stream.getTracks().forEach((track) => track.stop())
      const type = [mimeType, ...CANDIDATES].find((candidate) => candidate && MediaRecorder.isTypeSupported(candidate))
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
      const p = parts.current
      Object.assign(p, { stream, recorder, chunks: [], banked: 0, since: performance.now() })

      recorder.ondataavailable = (event) => event.data.size && p.chunks.push(event.data)
      recorder.onstop = () => {
        const duration = p.banked
        release()
        if (!alive.current) return
        const blob = new Blob(p.chunks, { type: recorder.mimeType || type || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        const result = { blob, duration, mimeType: blob.type }
        setRecording({ ...result, url })
        setElapsed(duration)
        setStatus('recorded')
        onRecordingComplete?.(result)
      }

      // The meter reads the analyser's waveform; nothing is routed to the speakers.
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      context.createMediaStreamSource(stream).connect(analyser)
      p.context = context
      const samples = new Float32Array(analyser.fftSize)
      let last = 0
      const tick = (now: number) => {
        p.frame = requestAnimationFrame(tick)
        // Under reduced motion the bar steps a few times a second instead of streaming.
        if (reducedRef.current && now - last < 250) return
        last = now
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) sum += sample * sample
        const rms = Math.sqrt(sum / samples.length)
        // -60 dBFS reads as empty, 0 dBFS as full: a linear bar would sit near zero for speech.
        const level = recorder.state === 'recording' ? Math.max(0, Math.min(1, (20 * Math.log10(rms || 1e-8) + 60) / 60)) : 0
        if (meter.current) meter.current.style.transform = `scaleX(${level})`
      }
      p.frame = requestAnimationFrame(tick)
      p.timer = setInterval(() => {
        const now = measure()
        setElapsed(now)
        if (now >= maxDuration && recorder.state !== 'inactive') stopRecording()
      }, 200)

      recorder.start(250)
      setElapsed(0)
      setStatus('recording')
    } catch (error) {
      release()
      const name = (error as DOMException)?.name
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error')
    }
  }

  const pause = () => {
    const p = parts.current
    if (p.recorder?.state !== 'recording') return
    p.banked = measure()
    p.recorder.pause()
    setElapsed(p.banked)
    setStatus('paused')
  }

  const resume = () => {
    const p = parts.current
    if (p.recorder?.state !== 'paused') return
    p.since = performance.now()
    p.recorder.resume()
    setStatus('recording')
  }

  function stopRecording() {
    const p = parts.current
    if (!p.recorder || p.recorder.state === 'inactive') return
    p.banked = Math.min(maxDuration, measure())
    p.recorder.stop()
  }

  const discard = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setRecording(null)
    setElapsed(0)
    setStatus('idle')
    onDiscard?.()
  }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      const recorder = parts.current.recorder
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      release()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const live = status === 'recording' || status === 'paused'
  const explanation = EXPLAIN[status]

  return (
    <div role="group" aria-label={label} className={cn('flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4', className)}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'size-2.5 shrink-0 rounded-full',
            status === 'recording' ? 'bg-danger motion-safe:animate-pulse' : status === 'paused' ? 'bg-warning' : 'bg-line-strong',
          )}
        />
        <Text as="span" size="stat" tabular className="min-w-[4.5ch]">
          {formatMediaTime(elapsed)}
        </Text>
        <Text as="span" size="caption" tone="faint" tabular>
          / {formatMediaTime(maxDuration)}
        </Text>
        <div aria-hidden="true" className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
          <div ref={meter} className="absolute inset-0 origin-left scale-x-0 rounded-full bg-accent-strong" />
        </div>
      </div>

      <Text as="p" role="status" size="caption" tone={explanation ? 'danger' : 'soft'} leading="normal">
        {explanation ??
          (status === 'requesting'
            ? 'Waiting for microphone permission…'
            : status === 'recording'
              ? 'Recording. The bar shows how loudly the microphone hears you.'
              : status === 'paused'
                ? 'Paused. Resume to keep adding to this recording.'
                : status === 'recorded'
                  ? `Recorded ${formatMediaTime(elapsed)}. Listen back, or discard and try again.`
                  : 'Press Record. Your browser will ask for the microphone the first time.')}
      </Text>

      {recording && status === 'recorded' && (
        <audio controls src={recording.url} aria-label="Your recording" className="h-10 w-full" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!live && status !== 'recorded' && (
          <Button size="sm" onClick={start} disabled={status === 'requesting' || status === 'unavailable'}>
            {status === 'denied' || status === 'error' ? 'Try again' : 'Record'}
          </Button>
        )}
        {status === 'recording' && (
          <Button size="sm" variant="muted" onClick={pause}>
            Pause
          </Button>
        )}
        {status === 'paused' && (
          <Button size="sm" variant="muted" onClick={resume}>
            Resume
          </Button>
        )}
        {live && (
          <Button size="sm" onClick={stopRecording}>
            Stop
          </Button>
        )}
        {status === 'recorded' && (
          <>
            <Button size="sm" variant="outline" onClick={discard}>
              Discard
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                discard()
                void start()
              }}
            >
              Record again
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
