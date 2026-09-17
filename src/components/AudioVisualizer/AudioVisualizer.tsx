'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export type VisualizerShape = 'bars' | 'radial' | 'wave'

export interface AudioVisualizerProps {
  /** The element to listen to. Its audio is routed through the analyser. */
  audioRef?: React.RefObject<HTMLAudioElement | null>
  /** Use the microphone instead. Asks permission on the first start. */
  microphone?: boolean
  /** What it is listening to — announced, since the picture is decorative. */
  label: string
  shape?: VisualizerShape
  /** FFT size. Must be a power of two; higher is more bars and more latency. */
  fftSize?: number
  /** How much of the spectrum to draw, 0 to 1. Music lives in the bottom half. */
  range?: number
  /** Any CSS colour for the bars. Defaults to the accent. */
  color?: string
  /** Canvas height in pixels. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A real spectrum, from real audio.
 *
 * `getByteFrequencyData` returns the FFT bins, and the bins are not linear in
 * anything a listener perceives — almost all musical content sits in the
 * bottom quarter of them, so drawing all 1024 gives a tall spike on the left
 * and a flat line for the rest of the width. `range` trims to the part with
 * something in it, which is why this looks like a visualiser rather than a
 * graph of silence.
 *
 * One `AudioContext` and one `MediaElementSource` per element, kept in a ref.
 * Calling `createMediaElementSource` twice on the same element throws, and
 * once an element is routed through a context its sound only comes out if the
 * graph is connected back to the destination — the two mistakes that make
 * people conclude Web Audio has muted their page.
 *
 * Browsers refuse to start a context without a gesture, so it resumes on the
 * first play rather than on mount.
 */
export function AudioVisualizer({
  audioRef,
  microphone = false,
  label,
  shape = 'bars',
  fftSize = 512,
  range = 0.55,
  color = 'var(--color-accent-strong)',
  height = 140,
  className,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null)
  /** The microphone itself. Held so it can be let go of. */
  const streamRef = useRef<MediaStream | null>(null)
  const unmountedRef = useRef(false)
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Built on the first gesture — a context created earlier starts suspended. */
  const connect = async () => {
    if (analyserRef.current) {
      await contextRef.current?.resume()
      setLive(true)
      return
    }
    try {
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = fftSize
      analyser.smoothingTimeConstant = 0.78

      if (microphone) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Unmounted while the permission prompt was up: the cleanup has already
        // run and will not run again, so release what just arrived ourselves.
        if (unmountedRef.current) {
          for (const track of stream.getTracks()) track.stop()
          void context.close()
          return
        }
        streamRef.current = stream
        sourceRef.current = context.createMediaStreamSource(stream)
        sourceRef.current.connect(analyser)
        // Deliberately not connected to the destination: that is a feedback loop.
      } else {
        const element = audioRef?.current
        if (!element) throw new Error('No audio element')
        sourceRef.current = context.createMediaElementSource(element)
        sourceRef.current.connect(analyser)
        // Without this the element is routed into the graph and goes silent.
        analyser.connect(context.destination)
      }

      contextRef.current = context
      analyserRef.current = analyser
      await context.resume()
      setLive(true)
    } catch {
      setError(microphone ? 'Microphone permission was refused.' : 'Could not read that audio.')
    }
  }

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      sourceRef.current?.disconnect()
      // Closing the AudioContext does not release the microphone. Only stopping
      // the stream's tracks does — until then the browser keeps recording, and
      // keeps its recording indicator lit, long after the user has left.
      for (const track of streamRef.current?.getTracks() ?? []) track.stop()
      void contextRef.current?.close()
      // A closed context cannot be resumed. Clearing these makes a remount —
      // React's Strict Mode does one on purpose — build a fresh graph.
      streamRef.current = null
      sourceRef.current = null
      analyserRef.current = null
      contextRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context2d = canvas?.getContext('2d')
    if (!canvas || !context2d) return

    const resolved = color.startsWith('var(')
      ? getComputedStyle(canvas).getPropertyValue(color.slice(4, -1)).trim() || '#b9e93a'
      : color

    let width = 0
    let boxHeight = 0
    let frame = 0

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = box.width
      boxHeight = box.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(boxHeight * dpr)
      context2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = () => {
      const analyser = analyserRef.current
      context2d.clearRect(0, 0, width, boxHeight)

      if (analyser) {
        if (shape === 'wave') {
          const data = new Uint8Array(analyser.fftSize)
          analyser.getByteTimeDomainData(data)
          context2d.strokeStyle = resolved
          context2d.lineWidth = 2
          context2d.beginPath()
          for (let i = 0; i < data.length; i += 1) {
            const x = (i / data.length) * width
            const y = (data[i] / 255) * boxHeight
            if (i === 0) context2d.moveTo(x, y)
            else context2d.lineTo(x, y)
          }
          context2d.stroke()
        } else {
          const bins = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(bins)
          // Almost all musical content is in the bottom of the spectrum.
          const used = Math.max(8, Math.floor(bins.length * range))
          context2d.fillStyle = resolved

          if (shape === 'radial') {
            const cx = width / 2
            const cy = boxHeight / 2
            const inner = Math.min(width, boxHeight) * 0.18
            const reach = Math.min(width, boxHeight) * 0.32
            for (let i = 0; i < used; i += 1) {
              const angle = (i / used) * Math.PI * 2 - Math.PI / 2
              const length = inner + (bins[i] / 255) * reach
              context2d.lineWidth = 2
              context2d.strokeStyle = resolved
              context2d.beginPath()
              context2d.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
              context2d.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length)
              context2d.stroke()
            }
          } else {
            const barWidth = width / used
            for (let i = 0; i < used; i += 1) {
              const value = (bins[i] / 255) * boxHeight
              context2d.fillRect(i * barWidth, boxHeight - value, Math.max(1, barWidth - 1.5), value)
            }
          }
        }
      }

      frame = requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [color, range, shape])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className="overflow-hidden rounded-[var(--radius-glyph)] bg-surface-sunken"
        style={{ height }}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void connect()}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-surface-muted"
        >
          {live ? 'Listening' : microphone ? 'Use the microphone' : 'Connect the audio'}
        </button>
        {error && (
          <Text as="span" size="caption" tone="danger">
            {error}
          </Text>
        )}
      </div>

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {label}
          {live ? ' — visualiser running' : ' — visualiser idle'}
        </p>
      </VisuallyHidden>
    </div>
  )
}
