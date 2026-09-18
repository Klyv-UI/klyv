'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { Slider } from '../Slider'

export type ImageDiffMode = 'side-by-side' | 'diff' | 'onion' | 'blink'

export interface ImageDiffResult {
  /** Pixels over the threshold. */
  changed: number
  /** Pixels compared. */
  total: number
  /** changed / total × 100. */
  percent: number
}

export interface ImageDiffProps {
  /** The baseline image URL. Cross-origin images need CORS headers for their pixels to be readable. */
  before: string
  /** The candidate image URL, compared at the baseline’s size. */
  after: string
  /** Accessible name for the comparison. */
  label: string
  /** 0 to 1. How different two pixels must be, perceptually, to count as changed. */
  threshold?: number
  /** Controlled view. */
  mode?: ImageDiffMode
  /** Initial view when uncontrolled. */
  defaultMode?: ImageDiffMode
  onModeChange?: (mode: ImageDiffMode) => void
  beforeLabel?: string
  afterLabel?: string
  /** Called once the images are compared. */
  onDiff?: (result: ImageDiffResult) => void
  /** Merged last, so it wins. */
  className?: string
}

/** The largest YIQ distance two pixels can be apart, as in pixelmatch. */
const MAX_DELTA = 35215
const MAX_SIDE = 1200

/**
 * Perceptual distance between two RGBA pixels in YIQ space: brightness weighs
 * most, then the orange–blue axis, then purple–green — close to how the eye
 * ranks differences. Pixels are blended onto white first so transparency counts.
 */
function yiqDelta(a: Uint8ClampedArray, b: Uint8ClampedArray, i: number) {
  const blend = (data: Uint8ClampedArray, c: number) => 255 + ((data[i + c] - 255) * data[i + 3]) / 255
  const r1 = blend(a, 0)
  const g1 = blend(a, 1)
  const b1 = blend(a, 2)
  const r2 = blend(b, 0)
  const g2 = blend(b, 1)
  const b2 = blend(b, 2)
  const y = (r1 - r2) * 0.29889531 + (g1 - g2) * 0.58662247 + (b1 - b2) * 0.11448223
  const iq = (r1 - r2) * 0.59597799 - (g1 - g2) * 0.2741761 - (b1 - b2) * 0.32180189
  const q = (r1 - r2) * 0.21147017 - (g1 - g2) * 0.52261711 + (b1 - b2) * 0.31114694
  return 0.5053 * y * y + 0.299 * iq * iq + 0.1957 * q * q
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('load'))
    image.src = src
  })
}

const MODES: { value: ImageDiffMode; label: string }[] = [
  { value: 'side-by-side', label: 'Side by side' },
  { value: 'diff', label: 'Diff' },
  { value: 'onion', label: 'Onion skin' },
  { value: 'blink', label: 'Blink' },
]

/**
 * Two versions of an image, compared pixel by pixel.
 *
 * Eyeballing two screenshots misses a 2px shift and flags a re-encode as a
 * change. This reads both images into canvases, measures every pixel pair with
 * the YIQ perceptual distance (the one pixelmatch uses), and paints the ones
 * over the threshold in the danger colour on a faded copy of the original, with
 * the share of changed pixels stated as a number.
 *
 * Four views, because each catches something different: side by side for
 * layout, diff for exactly what moved, onion skin for alignment, blink for
 * small shifts. Blink stops after a while and has a pause control; under
 * reduced motion it never flips on its own and becomes a manual toggle.
 * Where pixels cannot be read — no canvas, or a cross-origin image without
 * CORS — it says so and the visual views still work.
 */
export function ImageDiff({
  before,
  after,
  label,
  threshold = 0.1,
  mode: modeProp,
  defaultMode = 'diff',
  onModeChange,
  beforeLabel = 'Before',
  afterLabel = 'After',
  onDiff,
  className,
}: ImageDiffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()
  const [ownMode, setOwnMode] = useState(defaultMode)
  const [result, setResult] = useState<ImageDiffResult | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [size, setSize] = useState<[number, number] | null>(null)
  const [mix, setMix] = useState(50)
  const [showAfter, setShowAfter] = useState(false)
  const [blinking, setBlinking] = useState(true)
  const mode = modeProp ?? ownMode
  const onDiffRef = useRef(onDiff)
  onDiffRef.current = onDiff

  const setMode = (next: ImageDiffMode) => {
    if (modeProp === undefined) setOwnMode(next)
    onModeChange?.(next)
  }

  useEffect(() => {
    let cancelled = false
    setResult(null)
    setProblem(null)
    Promise.all([load(before), load(after)])
      .then(([a, b]) => {
        if (cancelled) return
        const fit = Math.min(1, MAX_SIDE / Math.max(a.naturalWidth, a.naturalHeight, 1))
        const width = Math.max(1, Math.round(a.naturalWidth * fit))
        const height = Math.max(1, Math.round(a.naturalHeight * fit))
        setSize([width, height])
        const canvas = canvasRef.current
        const read = (image: HTMLImageElement) => {
          const scratch = document.createElement('canvas')
          scratch.width = width
          scratch.height = height
          const context = scratch.getContext('2d', { willReadFrequently: true })
          if (!context) return null
          context.drawImage(image, 0, 0, width, height)
          return context.getImageData(0, 0, width, height)
        }
        const output = canvas?.getContext('2d')
        const first = read(a)
        const second = read(b)
        if (!canvas || !output || !first || !second) {
          setProblem('This browser cannot read image pixels, so the diff view is unavailable. The other views still work.')
          return
        }
        canvas.width = width
        canvas.height = height
        const danger = getComputedStyle(canvas).getPropertyValue('--color-danger').trim() || 'red'
        output.fillStyle = danger
        output.fillRect(0, 0, 1, 1)
        const [dr, dg, db] = output.getImageData(0, 0, 1, 1).data
        const diff = output.createImageData(width, height)
        const limit = MAX_DELTA * threshold * threshold
        let changed = 0
        for (let i = 0; i < first.data.length; i += 4) {
          if (yiqDelta(first.data, second.data, i) > limit) {
            changed += 1
            diff.data.set([dr, dg, db, 255], i)
          } else {
            // Unchanged pixels become a pale grey copy, so the red has context.
            const grey = 0.299 * first.data[i] + 0.587 * first.data[i + 1] + 0.114 * first.data[i + 2]
            const faded = 255 - (255 - grey) * 0.18
            diff.data.set([faded, faded, faded, first.data[i + 3] * 0.9], i)
          }
        }
        output.putImageData(diff, 0, 0)
        const total = width * height
        const next = { changed, total, percent: (changed / total) * 100 }
        setResult(next)
        onDiffRef.current?.(next)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setProblem(
          error instanceof Error && error.message === 'load'
            ? 'One of the images could not be loaded.'
            : 'The image pixels could not be read — usually a cross-origin image served without CORS headers. The visual views still work.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [before, after, threshold])

  // Blink flips every 700ms, stops itself after ten seconds, and never runs under reduced motion.
  useEffect(() => {
    if (mode !== 'blink' || reduced || !blinking) return
    const timer = window.setInterval(() => setShowAfter((value) => !value), 700)
    const stop = window.setTimeout(() => setBlinking(false), 10_000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(stop)
    }
  }, [mode, reduced, blinking])

  const percent = result ? (result.percent < 0.01 && result.changed > 0 ? '<0.01' : result.percent.toFixed(2)) : null
  const summary = problem ?? (result ? `${percent}% of pixels changed (${result.changed.toLocaleString()} of ${result.total.toLocaleString()})` : 'Comparing…')
  const frame = 'relative overflow-hidden rounded-[var(--radius-glyph)] border border-line bg-[repeating-conic-gradient(var(--color-surface-muted)_0%_25%,var(--color-surface)_0%_50%)] bg-[length:16px_16px]'
  const ratio = size ? `${size[0]} / ${size[1]}` : '16 / 10'
  const img = (src: string, alt: string, extra?: string, style?: CSSProperties) => (
    <img src={src} alt={alt} draggable={false} className={cn('block h-full w-full object-contain', extra)} style={style} />
  )

  return (
    <div role="group" aria-label={label} className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl size="sm" label="Comparison view" options={MODES} value={mode} onValueChange={setMode} />
        <p aria-live="polite" className={cn('text-[12px] font-semibold', problem ? 'text-danger' : 'text-ink-soft')}>
          {result && !problem && <span className="font-extrabold text-ink tabular-nums">{percent}%</span>}
          {result && !problem ? ' changed' : summary}
        </p>
      </div>

      {mode === 'side-by-side' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            [before, beforeLabel],
            [after, afterLabel],
          ].map(([src, name]) => (
            <figure key={name} className="flex flex-col gap-1.5">
              <div className={frame} style={{ aspectRatio: ratio }}>{img(src, name)}</div>
              <figcaption className="text-[11px] font-bold text-ink-faint">{name}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className={cn(frame, mode !== 'diff' && 'hidden')} style={{ aspectRatio: ratio }}>
        <canvas ref={canvasRef} role="img" aria-label={`Changed pixels between ${beforeLabel} and ${afterLabel}: ${summary}`} className="block h-full w-full object-contain" />
      </div>

      {mode === 'onion' && (
        <div className="flex flex-col gap-2">
          <div className={frame} style={{ aspectRatio: ratio }}>
            {img(before, beforeLabel, 'absolute inset-0')}
            {img(after, `${afterLabel}, at ${mix}% opacity over ${beforeLabel}`, 'absolute inset-0', { opacity: mix / 100 })}
          </div>
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[11px] font-bold text-ink-faint">{beforeLabel}</span>
            <Slider min={0} max={100} value={mix} onChange={(event) => setMix(Number(event.target.value))} aria-label={`Opacity of ${afterLabel}`} aria-valuetext={`${mix}% ${afterLabel}`} />
            <span className="shrink-0 text-[11px] font-bold text-ink-faint">{afterLabel}</span>
          </div>
        </div>
      )}

      {mode === 'blink' && (
        <div className="flex flex-col gap-2">
          <div className={frame} style={{ aspectRatio: ratio }}>
            {img(showAfter ? after : before, showAfter ? afterLabel : beforeLabel)}
            <span className="absolute left-2 top-2 rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-ink shadow-[var(--shadow-tile)]">
              {showAfter ? afterLabel : beforeLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAfter((value) => !value)}>
              {`Show ${showAfter ? beforeLabel : afterLabel}`}
            </Button>
            {!reduced && (
              <Button size="sm" variant="ghost" onClick={() => setBlinking((value) => !value)}>
                {blinking ? 'Pause blinking' : 'Blink'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
