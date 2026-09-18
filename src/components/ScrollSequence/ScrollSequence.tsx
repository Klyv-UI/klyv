'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export type ScrollSequenceFit = 'cover' | 'contain'

export type ScrollSequenceDrawFrame = (context: CanvasRenderingContext2D, index: number, width: number, height: number) => void

export interface ScrollSequenceProps {
  /** Image URLs, one per frame, in order. Use this or `frameCount` with `drawFrame`. */
  frames?: string[]
  /** Number of generated frames, for `drawFrame`. */
  frameCount?: number
  /** Paints frame `index` into a blank canvas. Called once per frame up front, not on scroll. */
  drawFrame?: ScrollSequenceDrawFrame
  /** Pixel size generated frames are painted at. */
  frameSize?: { width: number; height: number }
  /** How far the reader scrolls to play the whole sequence, as a CSS length. */
  length?: string
  /** Height of the pinned stage, as a CSS length. `100vh` for a full-screen hero. */
  pinHeight?: string
  /** `cover` fills the stage and crops; `contain` shows the whole frame. */
  fit?: ScrollSequenceFit
  /** The frame shown under reduced motion. Defaults to the middle one. */
  stillFrame?: number
  /** Describes the sequence for assistive tech. */
  label: string
  /** Laid over the stage. A function receives scroll progress from 0 to 1. */
  children?: ReactNode | ((progress: number) => ReactNode)
  /** Called with scroll progress from 0 to 1. */
  onProgress?: (progress: number) => void
  /** Merged last, so it wins. */
  className?: string
}

/** The nearest ancestor that scrolls vertically, or null for the page itself. */
function scrollParent(node: HTMLElement | null): HTMLElement | null {
  for (let current = node?.parentElement; current; current = current.parentElement) {
    const { overflowY } = getComputedStyle(current)
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) return current
  }
  return null
}

/** Draw an image into a box the way `object-fit` would: scale to cover or contain, then centre. */
function drawFitted(context: CanvasRenderingContext2D, image: CanvasImageSource, source: { width: number; height: number }, width: number, height: number, fit: ScrollSequenceFit) {
  const scale = (fit === 'cover' ? Math.max : Math.min)(width / source.width, height / source.height)
  const drawWidth = source.width * scale
  const drawHeight = source.height * scale
  context.clearRect(0, 0, width, height)
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

/**
 * A pinned stage that plays a sequence of frames as the reader scrolls through it — the product-page turntable.
 *
 * Scrubbing a `<video>` by scroll position is unreliable: seeking lands on keyframes, so it stutters, and some
 * browsers will not seek at all until the video is playing. Individual frames drawn to a canvas are exact, and the
 * frame for any position is just `round(progress × (n − 1))`. So every frame is loaded (or painted, for generated
 * frames) before scrubbing starts, with the progress shown, and scrolling afterwards only ever draws a frame that is
 * already in memory — once per animation frame at most, and only when the index changes.
 *
 * Frames are fitted with the same maths as `object-fit`, so the stage can be any shape. Progress is measured against
 * the nearest scrolling ancestor, so it works inside a scrolling panel as well as the page. Under reduced motion the
 * scroll track collapses, and one still frame is shown instead of animation driven by scrolling.
 */
export function ScrollSequence({
  frames,
  frameCount = 0,
  drawFrame,
  frameSize = { width: 960, height: 540 },
  length = '300vh',
  pinHeight = '100vh',
  fit = 'cover',
  stillFrame,
  label,
  children,
  onProgress,
  className,
}: ScrollSequenceProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [sources, setSources] = useState<CanvasImageSource[]>([])
  const [loaded, setLoaded] = useState(0)
  const [progress, setProgress] = useState(0)
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  const total = frames ? frames.length : frameCount
  const frameKey = frames ? frames.join('\n') : `${frameCount}:${frameSize.width}x${frameSize.height}`
  const ready = total > 0 && loaded >= total

  // Preload or pre-paint every frame. Generated frames are painted in small batches so the page stays responsive.
  useEffect(() => {
    let cancelled = false
    setLoaded(0)
    setSources([])
    if (frames) {
      const images = frames.map((src) => {
        const image = new Image()
        image.decoding = 'async'
        const done = () => !cancelled && setLoaded((count) => count + 1)
        image.onload = done
        image.onerror = done
        image.src = src
        return image
      })
      setSources(images)
      return () => {
        cancelled = true
      }
    }
    const painted: HTMLCanvasElement[] = []
    let index = 0
    let timer = 0
    const batch = () => {
      const end = Math.min(frameCount, index + 6)
      for (; index < end; index += 1) {
        const canvas = document.createElement('canvas')
        canvas.width = frameSize.width
        canvas.height = frameSize.height
        const context = canvas.getContext('2d')
        if (context && drawFrame) drawFrame(context, index, frameSize.width, frameSize.height)
        painted.push(canvas)
      }
      if (cancelled) return
      setLoaded(index)
      if (index < frameCount) timer = window.setTimeout(batch, 0)
      else setSources(painted)
    }
    batch()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // drawFrame is read when painting starts; pass a new frameCount or frames to repaint.
  }, [frameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!section || !stage || !canvas || !context || !ready || sources.length === 0) return

    let frame = 0
    let drawn = -1
    let width = 0
    let height = 0
    const parent = scrollParent(section)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      drawn = -1
    }

    const paint = (index: number) => {
      if (index === drawn) return
      const source = sources[index]
      if (!source) return
      const size =
        source instanceof HTMLImageElement
          ? { width: source.naturalWidth, height: source.naturalHeight }
          : { width: frameSize.width, height: frameSize.height }
      if (!size.width || !size.height) return
      drawFitted(context, source, size, width, height, fit)
      drawn = index
    }

    const update = () => {
      frame = 0
      if (reducedMotion) {
        paint(Math.min(total - 1, Math.max(0, stillFrame ?? Math.floor(total / 2))))
        onProgressRef.current?.(total > 1 ? Math.max(0, stillFrame ?? Math.floor(total / 2)) / (total - 1) : 0)
        return
      }
      const rootTop = parent ? parent.getBoundingClientRect().top : 0
      const box = section.getBoundingClientRect()
      const travel = box.height - stage.offsetHeight
      const next = travel > 0 ? Math.min(1, Math.max(0, (rootTop - box.top) / travel)) : 0
      setProgress(next)
      onProgressRef.current?.(next)
      paint(Math.round(next * (total - 1)))
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    resize()
    update()
    const target: HTMLElement | Window = parent ?? window
    target.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(() => {
      resize()
      schedule()
    })
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(frame)
      target.removeEventListener('scroll', schedule)
      observer.disconnect()
    }
  }, [ready, sources, total, fit, stillFrame, reducedMotion, frameSize.width, frameSize.height])

  const still = Math.min(total - 1, Math.max(0, stillFrame ?? Math.floor(total / 2)))
  const percent = total ? Math.round((Math.min(loaded, total) / total) * 100) : 0

  return (
    <div ref={sectionRef} className={cn('relative w-full', className)} style={{ height: reducedMotion ? pinHeight : length }}>
      <div ref={stageRef} className={cn('top-0 w-full overflow-hidden', !reducedMotion && 'sticky')} style={{ height: pinHeight }}>
        <canvas ref={canvasRef} role="img" aria-label={label} className="absolute inset-0 block size-full" />
        {!ready && total > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-sunken">
            <div
              role="progressbar"
              aria-label="Loading frames"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 w-40 overflow-hidden rounded-full bg-track"
            >
              <div className="h-full rounded-full bg-accent-strong" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-[12px] font-semibold tabular-nums text-ink-soft">
              {Math.min(loaded, total)} of {total} frames
            </span>
          </div>
        )}
        {children !== undefined && (
          <div className="pointer-events-none absolute inset-0 [&_*]:pointer-events-auto">
            {typeof children === 'function' ? children(reducedMotion ? (total > 1 ? still / (total - 1) : 0) : progress) : children}
          </div>
        )}
      </div>
    </div>
  )
}
