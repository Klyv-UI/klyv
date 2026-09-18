'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { Switch } from '../Switch'
import { gifRecorderEncode, type GifRecorderFrame } from './gif'

export interface GifRecorderProps {
  /** What to record: a canvas, video or image is copied directly; any other element is rasterised through SVG. */
  source: RefObject<HTMLElement | null>
  /** Frames captured per second. */
  fps?: number
  /** Recording stops by itself after this many seconds. */
  maxDuration?: number
  /** Frames are scaled down to at most this width, in pixels. */
  maxWidth?: number
  /** Called with the finished GIF. */
  onRecord?: (blob: Blob) => void
  /** Suggested download name. */
  fileName?: string
  /** Merged last, so it wins. */
  className?: string
}

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`)

/**
 * Any element as an image: cloned with its computed styles written inline,
 * wrapped in an SVG foreignObject and decoded. Canvases inside are swapped
 * for their current pixels, since a clone of a canvas is blank.
 */
async function rasterise(element: HTMLElement, width: number, height: number): Promise<CanvasImageSource> {
  const clone = element.cloneNode(true) as HTMLElement
  const copy = (from: Element, to: Element) => {
    const style = getComputedStyle(from)
    for (const name of Array.from(style)) (to as HTMLElement).style.setProperty(name, style.getPropertyValue(name))
    Array.from(from.children).forEach((child, index) => to.children[index] && copy(child, to.children[index]))
    if (from instanceof HTMLCanvasElement) {
      const image = document.createElement('img')
      image.src = from.toDataURL()
      image.setAttribute('style', (to as HTMLElement).getAttribute('style') ?? '')
      to.replaceWith(image)
    }
  }
  copy(element, clone)
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const markup = new XMLSerializer().serializeToString(clone)
  const box = element.getBoundingClientRect()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${box.width} ${box.height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  return image
}

/**
 * Records a canvas or an element to an animated GIF, with the encoder written here.
 *
 * GIF is still the format that plays everywhere without a video player —
 * issue trackers, email, chat, docs — so a bug reproduction or a UI demo can
 * be captured and pasted without leaving the page. Frames are captured on a
 * timer with their real spacing, so the GIF plays at the speed it was
 * recorded even if the page dropped frames.
 *
 * The encoder is complete: median-cut quantisation to one 256-colour table
 * (or one per frame, for animations whose colours change), optional
 * Floyd–Steinberg dithering, variable-width LZW, and the NETSCAPE loop block.
 * It yields between frames and shows progress, so encoding a few seconds of
 * animation does not freeze the page.
 */
export function GifRecorder({ source, fps = 12, maxDuration = 4, maxWidth = 320, onRecord, fileName = 'recording.gif', className }: GifRecorderProps) {
  const [palette, setPalette] = useState<'global' | 'local'>('global')
  const [dither, setDither] = useState(true)
  const [loop, setLoop] = useState(true)
  const [phase, setPhase] = useState<'idle' | 'recording' | 'encoding'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ url: string; size: number; frames: number; width: number; height: number } | null>(null)
  const [error, setError] = useState('')
  const frames = useRef<GifRecorderFrame[]>([])
  const timer = useRef<number>(0)
  const busy = useRef(false)

  useEffect(() => () => window.clearInterval(timer.current), [])
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result])

  const finish = async () => {
    // Stop can arrive twice — from the button and from the time limit — so only the first one encodes.
    if (!timer.current) return
    window.clearInterval(timer.current)
    timer.current = 0
    const captured = frames.current
    if (!captured.length) {
      setPhase('idle')
      return
    }
    setPhase('encoding')
    setProgress(0)
    try {
      const blob = await gifRecorderEncode(captured, { palette, dither, loop }, (done, total) => setProgress(done / total))
      setResult({ url: URL.createObjectURL(blob), size: blob.size, frames: captured.length, width: captured[0].width, height: captured[0].height })
      onRecord?.(blob)
    } catch (reason) {
      setError((reason as Error).message)
    }
    setPhase('idle')
  }

  const start = () => {
    const element = source.current
    if (!element) return setError('There is nothing to record.')
    const box = element.getBoundingClientRect()
    const naturalWidth = element instanceof HTMLCanvasElement ? element.width : element instanceof HTMLVideoElement ? element.videoWidth : box.width
    const naturalHeight = element instanceof HTMLCanvasElement ? element.height : element instanceof HTMLVideoElement ? element.videoHeight : box.height
    const scale = Math.min(1, maxWidth / Math.max(1, naturalWidth))
    const width = Math.max(1, Math.round(naturalWidth * scale))
    const height = Math.max(1, Math.round(naturalHeight * scale))
    const scratch = document.createElement('canvas')
    scratch.width = width
    scratch.height = height
    const context = scratch.getContext('2d', { willReadFrequently: true })
    if (!context) return setError('This browser cannot draw on a canvas, so it cannot record.')
    const direct = element instanceof HTMLCanvasElement || element instanceof HTMLVideoElement || element instanceof HTMLImageElement

    frames.current = []
    setError('')
    setResult(null)
    setElapsed(0)
    setPhase('recording')
    const began = performance.now()
    let last = began

    const capture = async () => {
      if (busy.current) return
      busy.current = true
      try {
        const now = performance.now()
        const image = direct ? (element as CanvasImageSource) : await rasterise(element, width, height)
        context.clearRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height)
        // The previous frame lasts until this one was taken.
        const previous = frames.current[frames.current.length - 1]
        if (previous) previous.delay = now - last
        last = now
        frames.current.push({ data: pixels.data, width, height, delay: 1000 / fps })
        setElapsed((now - began) / 1000)
        if (now - began >= maxDuration * 1000) void finish()
      } catch {
        window.clearInterval(timer.current)
        timer.current = 0
        setError('This element could not be captured — it may contain images from another origin.')
        setPhase('idle')
      } finally {
        busy.current = false
      }
    }
    timer.current = window.setInterval(capture, 1000 / fps)
    void capture()
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-3">
        {phase === 'recording' ? (
          <Button size="sm" variant="accent" onClick={() => void finish()}>
            <span aria-hidden="true" className="size-2 rounded-full bg-danger motion-safe:animate-pulse" />
            Stop · {elapsed.toFixed(1)} s
          </Button>
        ) : (
          <Button size="sm" variant="accent" loading={phase === 'encoding'} onClick={start}>
            Record GIF
          </Button>
        )}
        <SegmentedControl
          label="Palette"
          size="sm"
          value={palette}
          onValueChange={setPalette}
          options={[
            { value: 'global', label: 'One palette' },
            { value: 'local', label: 'Per frame' },
          ]}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={dither} onChange={(event) => setDither(event.target.checked)} disabled={phase !== 'idle'} />
          Dither
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={loop} onChange={(event) => setLoop(event.target.checked)} disabled={phase !== 'idle'} />
          Loop
        </label>
      </div>

      {phase !== 'idle' && (
        <div
          role="progressbar"
          aria-label={phase === 'recording' ? 'Recording' : 'Encoding'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((phase === 'recording' ? elapsed / maxDuration : progress) * 100)}
          className="h-1.5 w-full overflow-hidden rounded-full bg-track"
        >
          <div
            className={cn('h-full rounded-full', phase === 'recording' ? 'bg-danger' : 'bg-accent-strong')}
            style={{ width: `${Math.min(100, (phase === 'recording' ? elapsed / maxDuration : progress) * 100)}%` }}
          />
        </div>
      )}

      <p role="status" className="m-0 text-[12px] font-medium text-ink-faint">
        {error ||
          (phase === 'recording'
            ? `Recording at ${fps} fps, up to ${maxDuration} s…`
            : phase === 'encoding'
              ? `Encoding frame ${Math.round(progress * frames.current.length)} of ${frames.current.length}…`
              : result
                ? `${result.frames} frames · ${result.width}×${result.height} · ${kb(result.size)}`
                : `Records up to ${maxDuration} s at ${fps} fps, ${maxWidth} px wide.`)}
      </p>

      {result && (
        <div className="flex flex-wrap items-end gap-3">
          <img src={result.url} alt="Recorded animation" width={result.width} height={result.height} className="max-w-full rounded-[var(--radius-glyph)] border border-line" />
          <a
            href={result.url}
            download={fileName}
            className="inline-flex h-8 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[12px] font-bold text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Download GIF
          </a>
        </div>
      )}
    </div>
  )
}
