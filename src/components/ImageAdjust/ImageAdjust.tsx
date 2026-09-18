'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { loadPixels } from '../../lib/image-data'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { Slider } from '../Slider'
import {
  IMAGE_ADJUST_DEFAULTS,
  imageAdjustLuts,
  imageAdjustSpline,
  type ImageAdjustChannel,
  type ImageAdjustCurvePoint,
  type ImageAdjustSettings,
} from './pipeline'

export interface ImageAdjustProps {
  /** Image URL — a data: or blob: URL, or any same-origin or CORS-enabled address. */
  src: string
  /** Settings, controlled. */
  value?: ImageAdjustSettings
  /** Settings to start from, uncontrolled. */
  defaultValue?: ImageAdjustSettings
  /** Called whenever any control changes. */
  onValueChange?: (value: ImageAdjustSettings) => void
  /** Called with the adjusted image, rotated and flipped, when Export is pressed. */
  onExport?: (blob: Blob) => void
  /** Encoding for the export. */
  exportType?: 'image/png' | 'image/jpeg' | 'image/webp'
  /** Longest side the image is processed at, in pixels. Larger images are scaled down first. */
  maxSize?: number
  /** Accessible name for the preview. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

type Histogram = [Uint32Array, Uint32Array, Uint32Array, Uint32Array]

const CHANNELS: { value: ImageAdjustChannel; label: string }[] = [
  { value: 'rgb', label: 'RGB' },
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'b', label: 'Blue' },
]
const HISTOGRAM_INDEX: Record<ImageAdjustChannel, number> = { rgb: 3, r: 0, g: 1, b: 2 }

function CurveEditor({
  points,
  onChange,
  histogram,
  channel,
}: {
  points: ImageAdjustCurvePoint[]
  onChange: (points: ImageAdjustCurvePoint[]) => void
  histogram?: Uint32Array
  channel: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<number | null>(null)
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const curve = imageAdjustSpline(sorted)
  let line = ''
  for (let x = 0; x <= 256; x += 4) line += `${x ? 'L' : 'M'}${x} ${256 - Math.min(255, Math.max(0, curve(x)))}`
  let bars = ''
  if (histogram) {
    const peak = Math.max(1, ...histogram)
    bars = `M0 256${Array.from(histogram, (count, x) => `L${x} ${256 - Math.sqrt(count / peak) * 240}`).join('')}L255 256Z`
  }

  const place = (index: number, x: number, y: number) => {
    const low = index === 0 ? 0 : sorted[index - 1].x + 1
    const high = index === sorted.length - 1 ? 255 : sorted[index + 1].x - 1
    const next = sorted.map((point) => ({ ...point }))
    next[index] = { x: Math.round(Math.min(high, Math.max(low, x))), y: Math.round(Math.min(255, Math.max(0, y))) }
    onChange(next)
  }
  const local = (event: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    // The view box has an 8-unit margin so the end points are not clipped at the edges.
    return { x: ((event.clientX - box.left) / box.width) * 272 - 8, y: 256 - (((event.clientY - box.top) / box.height) * 272 - 8) }
  }
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const at = local(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    const hit = (event.target as SVGElement).dataset.index
    if (hit !== undefined) {
      dragging.current = Number(hit)
      return
    }
    if (sorted.some((point) => Math.abs(point.x - at.x) < 3)) return
    const next = [...sorted, { x: Math.round(at.x), y: Math.round(at.y) }].sort((a, b) => a.x - b.x)
    dragging.current = next.findIndex((point) => point.x === Math.round(at.x))
    onChange(next)
  }
  const onKeyDown = (event: KeyboardEvent<SVGElement>, index: number) => {
    const step = event.shiftKey ? 8 : 1
    const point = sorted[index]
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    if (moves[event.key]) {
      event.preventDefault()
      place(index, point.x + moves[event.key][0], point.y + moves[event.key][1])
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && index > 0 && index < sorted.length - 1) {
      event.preventDefault()
      onChange(sorted.filter((_, at) => at !== index))
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox="-8 -8 272 272"
      role="group"
      aria-label={`${channel} tone curve. Click to add a point; focus a point and use arrows to move it, Delete to remove it.`}
      className="block aspect-square w-full touch-none rounded-[var(--radius-glyph)] bg-surface-sunken"
      onPointerDown={onPointerDown}
      onPointerMove={(event) => {
        if (dragging.current === null) return
        const at = local(event)
        place(dragging.current, at.x, at.y)
      }}
      onPointerUp={() => (dragging.current = null)}
      onPointerCancel={() => (dragging.current = null)}
    >
      {bars && <path d={bars} className="pointer-events-none fill-[color-mix(in_oklab,var(--color-ink)_14%,transparent)]" />}
      {[64, 128, 192].map((at) => (
        <g key={at} className="pointer-events-none stroke-line" strokeWidth="1">
          <line x1={at} y1="0" x2={at} y2="256" />
          <line x1="0" y1={at} x2="256" y2={at} />
        </g>
      ))}
      <line x1="0" y1="256" x2="256" y2="0" className="pointer-events-none stroke-line-strong" strokeDasharray="4 4" />
      <path d={line} fill="none" className="pointer-events-none stroke-accent-strong" strokeWidth="2.5" />
      {sorted.map((point, index) => (
        <circle
          key={index}
          data-index={index}
          cx={point.x}
          cy={256 - point.y}
          r="7"
          role="button"
          tabIndex={0}
          aria-label={`Curve point: input ${point.x}, output ${point.y}`}
          onKeyDown={(event) => onKeyDown(event, index)}
          className="cursor-grab fill-surface stroke-ink outline-none focus-visible:fill-accent"
          strokeWidth="2"
        />
      ))}
    </svg>
  )
}

/**
 * Photo adjustments that run on the pixels: exposure, contrast, saturation and
 * white balance, levels, and tone curves per channel.
 *
 * Every per-channel control folds into one 256-entry lookup table per channel,
 * so the pixel loop costs the same with one slider moved or all of them. Curve
 * points are joined by a monotone cubic spline, which cannot overshoot — the
 * familiar failure where lifting the shadows darkens the quarter-tones next to
 * them. The loop runs a slice of rows per frame and restarts when a control
 * moves, so dragging a curve never locks the page on a large photo.
 *
 * The histogram under the curve is of the result, not the original, so it
 * answers the question being asked while dragging: is anything clipping.
 * Rotation and flips are applied when drawing, not in the pixels, so they
 * are free and exact.
 */
export function ImageAdjust({
  src,
  value,
  defaultValue = IMAGE_ADJUST_DEFAULTS,
  onValueChange,
  onExport,
  exportType = 'image/png',
  maxSize = 1600,
  label = 'Adjusted image',
  className,
}: ImageAdjustProps) {
  const [inner, setInner] = useState(defaultValue)
  const settings = value ?? inner
  const [source, setSource] = useState<ImageData | null>(null)
  const [error, setError] = useState('')
  const [processed, setProcessed] = useState<{ image: ImageData; histogram: Histogram } | null>(null)
  const [busy, setBusy] = useState(false)
  const [original, setOriginal] = useState(false)
  const [channel, setChannel] = useState<ImageAdjustChannel>('rgb')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseId = useId()

  const update = (patch: Partial<ImageAdjustSettings>) => {
    const next = { ...settings, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  useEffect(() => {
    let cancelled = false
    setSource(null)
    setError('')
    if (!src) return
    loadPixels(src, maxSize).then(
      (loaded) => !cancelled && setSource(loaded.pixels),
      (reason: Error) => !cancelled && setError(reason.message),
    )
    return () => {
      cancelled = true
    }
  }, [src, maxSize])

  const { exposure, contrast, saturation, temperature, curves, levels } = settings
  useEffect(() => {
    if (!source) return
    const luts = imageAdjustLuts(settings)
    const input = source.data
    const output = new ImageData(source.width, source.height)
    const out = output.data
    const histogram: Histogram = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
    const mix = 1 + saturation / 100
    const [lr, lg, lb] = luts
    let pixel = 0
    let handle = 0
    const total = source.width * source.height
    const slice = () => {
      const started = performance.now()
      while (pixel < total) {
        const end = Math.min(total, pixel + 16384)
        for (; pixel < end; pixel += 1) {
          const at = pixel * 4
          let r = lr[input[at]]
          let g = lg[input[at + 1]]
          let b = lb[input[at + 2]]
          if (mix !== 1) {
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            r = Math.min(255, Math.max(0, luma + (r - luma) * mix))
            g = Math.min(255, Math.max(0, luma + (g - luma) * mix))
            b = Math.min(255, Math.max(0, luma + (b - luma) * mix))
          }
          out[at] = r
          out[at + 1] = g
          out[at + 2] = b
          out[at + 3] = input[at + 3]
          histogram[0][out[at]] += 1
          histogram[1][out[at + 1]] += 1
          histogram[2][out[at + 2]] += 1
          histogram[3][Math.round(0.2126 * out[at] + 0.7152 * out[at + 1] + 0.0722 * out[at + 2])] += 1
        }
        if (performance.now() - started > 8) {
          handle = window.setTimeout(slice, 0)
          return
        }
      }
      setProcessed({ image: output, histogram })
      setBusy(false)
    }
    setBusy(true)
    handle = window.setTimeout(slice, 0)
    return () => window.clearTimeout(handle)
    // The settings object is read through its parts, so an unrelated re-render does not restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, exposure, contrast, saturation, temperature, curves, levels])

  /** Draw an image into a canvas with the rotation and flips applied. */
  const paint = (target: HTMLCanvasElement, image: ImageData) => {
    const scratch = document.createElement('canvas')
    scratch.width = image.width
    scratch.height = image.height
    scratch.getContext('2d')?.putImageData(image, 0, 0)
    const quarter = settings.rotation === 90 || settings.rotation === 270
    target.width = quarter ? image.height : image.width
    target.height = quarter ? image.width : image.height
    const context = target.getContext('2d')
    if (!context) return
    context.save()
    context.translate(target.width / 2, target.height / 2)
    context.rotate((settings.rotation * Math.PI) / 180)
    context.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1)
    context.drawImage(scratch, -image.width / 2, -image.height / 2)
    context.restore()
  }

  useEffect(() => {
    const shown = original ? source : processed?.image
    if (canvasRef.current && shown) paint(canvasRef.current, shown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, source, processed, settings.rotation, settings.flipX, settings.flipY])

  const exportImage = () => {
    if (!processed) return
    const canvas = document.createElement('canvas')
    paint(canvas, processed.image)
    canvas.toBlob((blob) => blob && onExport?.(blob), exportType, 0.92)
  }

  const slider = (key: 'exposure' | 'contrast' | 'saturation' | 'temperature', text: string, min: number, max: number, step: number) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={`${baseId}-${key}`} className="text-[12px] font-semibold text-ink-soft">
          {text}
        </label>
        <span className="text-[12px] font-bold text-ink tabular">{settings[key] > 0 ? `+${settings[key]}` : settings[key]}</span>
      </div>
      <Slider id={`${baseId}-${key}`} min={min} max={max} step={step} value={settings[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} />
    </div>
  )
  const level = (key: 'black' | 'gamma' | 'white', text: string, min: number, max: number, step: number) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={`${baseId}-${key}`} className="text-[11px] font-semibold text-ink-faint">
        {text} <span className="font-bold text-ink tabular">{levels[key]}</span>
      </label>
      <Slider
        id={`${baseId}-${key}`}
        min={min}
        max={max}
        step={step}
        value={levels[key]}
        onChange={(event) => {
          const next = { ...levels, [key]: Number(event.target.value) }
          if (next.black >= next.white) return
          update({ levels: next })
        }}
      />
    </div>
  )

  return (
    <div className={cn('grid w-full gap-4 md:grid-cols-[minmax(0,1fr)_280px]', className)}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-2">
          {source ? (
            <canvas ref={canvasRef} role="img" aria-label={`${label}${original ? ', showing the original' : ''}`} className="block max-h-[480px] max-w-full" />
          ) : (
            <p className="m-0 p-6 text-center text-[13px] font-medium text-ink-soft">{error || (src ? 'Loading image…' : 'No image to adjust.')}</p>
          )}
          {busy && (
            <span className="absolute right-2 top-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              Processing
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => update({ rotation: (((settings.rotation + 270) % 360) as ImageAdjustSettings['rotation']) })}>
            Rotate left
          </Button>
          <Button size="sm" variant="outline" onClick={() => update({ rotation: (((settings.rotation + 90) % 360) as ImageAdjustSettings['rotation']) })}>
            Rotate right
          </Button>
          <Button size="sm" variant="outline" aria-pressed={settings.flipX} onClick={() => update({ flipX: !settings.flipX })}>
            Flip horizontal
          </Button>
          <Button size="sm" variant="outline" aria-pressed={settings.flipY} onClick={() => update({ flipY: !settings.flipY })}>
            Flip vertical
          </Button>
          <Button size="sm" variant={original ? 'accent' : 'muted'} aria-pressed={original} onClick={() => setOriginal(!original)}>
            {original ? 'Showing before' : 'Show before'}
          </Button>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => update(IMAGE_ADJUST_DEFAULTS)}>
            Reset
          </Button>
          {onExport && (
            <Button size="sm" variant="accent" disabled={!processed || busy} onClick={exportImage}>
              Export
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {slider('exposure', 'Exposure', -2, 2, 0.1)}
        {slider('contrast', 'Contrast', -100, 100, 1)}
        {slider('saturation', 'Saturation', -100, 100, 1)}
        {slider('temperature', 'Temperature', -100, 100, 1)}
        <div className="flex flex-col gap-2">
          <SegmentedControl label="Curve channel" size="sm" fullWidth value={channel} onValueChange={setChannel} options={CHANNELS} />
          <CurveEditor
            channel={CHANNELS.find((option) => option.value === channel)!.label}
            points={curves[channel]}
            histogram={processed?.histogram[HISTOGRAM_INDEX[channel]]}
            onChange={(points) => update({ curves: { ...curves, [channel]: points } })}
          />
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-[12px] font-semibold text-ink-soft">Levels</legend>
          <div className="flex gap-3">
            {level('black', 'Black', 0, 254, 1)}
            {level('gamma', 'Gamma', 0.1, 3, 0.05)}
            {level('white', 'White', 1, 255, 1)}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
