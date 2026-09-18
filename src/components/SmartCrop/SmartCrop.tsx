'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { loadPixels, nextFrame, tokenRgb, useThemeVersion } from '../../lib/image-data'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { Switch } from '../Switch'
import {
  smartCropSaliency,
  smartCropScoreSize,
  smartCropSizes,
  type SmartCropMap,
  type SmartCropRect,
  type SmartCropSuggestion,
} from './saliency'

export interface SmartCropProps {
  /** Image URL — a data: or blob: URL, or any same-origin or CORS-enabled address. */
  src: string
  /** Alt text for the image. */
  alt: string
  /** Aspect ratios to suggest crops for, written width:height. */
  aspects?: string[]
  /** Called when a crop is accepted, with the rectangle as fractions of the image. */
  onAccept?: (aspect: string, crop: SmartCropRect) => void
  /** Called whenever a crop moves — suggested or adjusted — with every current crop. */
  onCropsChange?: (crops: Record<string, SmartCropRect>) => void
  /** Show the interest map over the image at first. */
  defaultShowMap?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const ratio = (aspect: string) => {
  const [w, h] = aspect.split(':').map(Number)
  return w > 0 && h > 0 ? w / h : 1
}
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const pct = (value: number) => `${(value * 100).toFixed(1)}%`
const fraction = (value: number) => value.toFixed(4)

/**
 * Crops that keep the subject, for every aspect ratio a layout needs.
 *
 * Each image is scored on a coarse grid — edge energy, skin tones and strong
 * colour — and every candidate crop of each size is searched, rewarding
 * interest that lands on a third line and penalising interest cut off. A
 * centre crop decapitates a portrait shot off-centre; this finds the face.
 *
 * The suggestion is a starting point, not a verdict: drag the crop or its
 * corner, or focus it and use arrows and plus/minus, then accept. The score
 * map can be shown over the image so the reason for a suggestion is visible.
 * Results are fractions of the image, so they apply at any resolution.
 */
export function SmartCrop({
  src,
  alt,
  aspects = ['1:1', '4:5', '16:9'],
  onAccept,
  onCropsChange,
  defaultShowMap = false,
  className,
}: SmartCropProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [map, setMap] = useState<SmartCropMap | null>(null)
  const [error, setError] = useState('')
  const [suggested, setSuggested] = useState<Record<string, SmartCropSuggestion>>({})
  const [crops, setCrops] = useState<Record<string, SmartCropRect>>({})
  const [accepted, setAccepted] = useState<Record<string, SmartCropRect>>({})
  const [aspect, setAspect] = useState(aspects[0])
  const [showMap, setShowMap] = useState(defaultShowMap)
  const [message, setMessage] = useState('')
  const frameRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; start: SmartCropRect } | null>(null)
  const theme = useThemeVersion()
  const aspectKey = aspects.join('|')

  useEffect(() => {
    let cancelled = false
    setMap(null)
    setSuggested({})
    setCrops({})
    setError('')
    if (!src) return
    loadPixels(src, 480).then(
      async ({ pixels, naturalWidth, naturalHeight }) => {
        if (cancelled) return
        setSize({ width: naturalWidth, height: naturalHeight })
        const scored = smartCropSaliency(pixels)
        setMap(scored)
        let total = 0
        for (const value of scored.values) total += value
        const found: Record<string, SmartCropSuggestion> = {}
        for (const name of aspectKey.split('|')) {
          const target = ratio(name)
          for (const [w, h] of smartCropSizes(scored, target)) {
            // One size per frame: the whole search is tens of millions of reads on a large grid.
            await nextFrame()
            if (cancelled) return
            const best = smartCropScoreSize(scored, w, h, total)
            if (!found[name] || best.score > found[name].score) found[name] = best
          }
          // Recompute the height from the true aspect, so rounding on the grid does not skew it.
          const best = found[name]
          const height = clamp((best.width * naturalWidth) / (naturalHeight * target), 0, 1)
          found[name] = { ...best, height, y: clamp(best.y, 0, 1 - height) }
          setSuggested({ ...found })
          setCrops((current) => ({ ...current, [name]: found[name] }))
        }
        setMessage('Crop suggestions ready.')
      },
      (reason: Error) => !cancelled && setError(reason.message),
    )
    return () => {
      cancelled = true
    }
  }, [src, aspectKey])

  useEffect(() => {
    if (Object.keys(crops).length) onCropsChange?.(crops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crops])

  useEffect(() => {
    const canvas = mapRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !map) return
    canvas.width = map.width
    canvas.height = map.height
    const [r, g, b] = tokenRgb(canvas, '--color-accent', [120, 200, 80])
    const image = context.createImageData(map.width, map.height)
    for (let cell = 0; cell < map.values.length; cell += 1) {
      image.data.set([r, g, b, Math.round(Math.sqrt(map.values[cell]) * 230)], cell * 4)
    }
    context.putImageData(image, 0, 0)
  }, [map, showMap, theme])

  const crop = crops[aspect]
  const imageRatio = size ? size.width / size.height : 1
  /** Height fraction that keeps the crop at its aspect ratio for a given width fraction. */
  const heightFor = (width: number) => (width * imageRatio) / ratio(aspect)

  const setCrop = (next: SmartCropRect) => {
    const width = clamp(next.width, 0.05, Math.min(1, ratio(aspect) / imageRatio))
    const height = heightFor(width)
    setCrops((current) => ({
      ...current,
      [aspect]: { width, height, x: clamp(next.x, 0, 1 - width), y: clamp(next.y, 0, 1 - height) },
    }))
    // Moving a crop un-accepts it: what was accepted is no longer what is on screen.
    setAccepted((current) => {
      const rest = { ...current }
      delete rest[aspect]
      return rest
    })
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    if (!crop) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { mode, x: event.clientX, y: event.clientY, start: crop }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    const box = frameRef.current?.getBoundingClientRect()
    if (!state || !box) return
    const dx = (event.clientX - state.x) / box.width
    const dy = (event.clientY - state.y) / box.height
    if (state.mode === 'move') setCrop({ ...state.start, x: state.start.x + dx, y: state.start.y + dy })
    else setCrop({ ...state.start, width: Math.max(state.start.width + dx, (state.start.height + dy) * (ratio(aspect) / imageRatio)) })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!crop) return
    const step = event.shiftKey ? 0.05 : 0.01
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) setCrop({ ...crop, x: crop.x + moves[event.key][0], y: crop.y + moves[event.key][1] })
    else if (event.key === '+' || event.key === '=') setCrop({ ...crop, width: crop.width + 0.02, x: crop.x - 0.01 })
    else if (event.key === '-') setCrop({ ...crop, width: crop.width - 0.02, x: crop.x + 0.01 })
    else if (event.key === 'Enter') accept()
    else return
    event.preventDefault()
  }

  const accept = () => {
    if (!crop) return
    setAccepted((current) => ({ ...current, [aspect]: crop }))
    onAccept?.(aspect, crop)
    setMessage(`${aspect} crop accepted.`)
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Aspect ratio"
          size="sm"
          value={aspect}
          onValueChange={setAspect}
          options={aspects.map((name) => ({ value: name, label: accepted[name] ? `${name} ✓` : name }))}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={showMap} onChange={(event) => setShowMap(event.target.checked)} />
          Score map
        </label>
      </div>

      <div
        ref={frameRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken"
        style={size ? { aspectRatio: `${size.width} / ${size.height}` } : { minHeight: 200 }}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {src && <img src={src} alt={alt} draggable={false} className="absolute inset-0 size-full object-fill" />}
        <canvas ref={mapRef} aria-hidden="true" className={cn('absolute inset-0 size-full mix-blend-multiply', !showMap && 'hidden')} />
        {crop && (
          <>
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* The scrim token twice: once reads as a modal backdrop, which is too light to frame a crop. */}
              {[0, 1].map((layer) => (
                <path
                  key={layer}
                  fillRule="evenodd"
                  className="fill-scrim"
                  d={`M0 0H100V100H0Z M${crop.x * 100} ${crop.y * 100}h${crop.width * 100}v${crop.height * 100}h${-crop.width * 100}Z`}
                />
              ))}
            </svg>
            <div
              role="group"
              aria-roledescription="crop"
              tabIndex={0}
              aria-label={`${aspect} crop: left ${pct(crop.x)}, top ${pct(crop.y)}, ${pct(crop.width)} wide. Arrows move it, plus and minus resize it, Enter accepts.`}
              onPointerDown={(event) => onPointerDown(event, 'move')}
              onKeyDown={onKeyDown}
              className="absolute cursor-move border-2 border-accent outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.width), height: pct(crop.height) }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, index) => (
                  <span key={index} className="border border-[color-mix(in_oklab,var(--color-accent)_45%,transparent)]" />
                ))}
              </span>
              <span
                aria-hidden="true"
                onPointerDown={(event) => onPointerDown(event, 'resize')}
                className="absolute -bottom-2 -right-2 size-4 cursor-nwse-resize rounded-full border-2 border-accent bg-surface"
              />
            </div>
          </>
        )}
        {!crop && (
          <p className="absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-[13px] font-medium text-ink-soft">
            {error || (src ? 'Finding the subject…' : 'No image to crop.')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="accent" disabled={!crop} onClick={accept}>
          Accept {aspect}
        </Button>
        <Button size="sm" variant="ghost" disabled={!suggested[aspect]} onClick={() => suggested[aspect] && setCrop(suggested[aspect])}>
          Back to suggestion
        </Button>
        {suggested[aspect] && (
          <span className="text-[12px] font-medium text-ink-faint">Suggestion score {suggested[aspect].score.toFixed(2)}</span>
        )}
      </div>

      <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {aspects.map((name) => {
          const shown = crops[name]
          return (
            <div key={name} className="flex flex-col gap-1 rounded-[var(--radius-glyph)] bg-surface-sunken p-2.5">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                {name} {accepted[name] ? '· accepted' : shown ? '· suggested' : ''}
              </dt>
              <dd className="m-0 font-mono text-[11px] font-semibold text-ink">
                {shown ? `x ${fraction(shown.x)} y ${fraction(shown.y)} w ${fraction(shown.width)} h ${fraction(shown.height)}` : '—'}
              </dd>
            </div>
          )
        })}
      </dl>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
