'use client'

import { useEffect, useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { contrastRatio, readableInk } from '../../lib/contrast'
import { loadPixels, nextFrame } from '../../lib/image-data'
import { hexToOklch, type Oklch } from '../../lib/oklch'
import { CopyButton } from '../CopyButton'
import { SegmentedControl } from '../SegmentedControl'
import { Slider } from '../Slider'
import { Switch } from '../Switch'
import {
  paletteExtractorAssign,
  paletteExtractorMedianCut,
  paletteExtractorRefine,
  paletteExtractorSamples,
  type PaletteExtractorRgb,
} from './quantize'

/** One colour of the extracted palette. */
export interface PaletteExtractorColor {
  hex: string
  rgb: PaletteExtractorRgb
  oklch: Oklch
  /** Fraction of the image’s pixels nearest this colour, 0–1. */
  share: number
  /** Black or white — whichever reads on this colour. */
  ink: string
  /** Contrast of `ink` on this colour, 1–21. */
  contrast: number
}

export interface PaletteExtractorProps {
  /** Image URL — a data: or blob: URL, or any same-origin or CORS-enabled address. */
  src: string
  /** Alt text for the image. */
  alt: string
  /** How many colours to extract at first. */
  defaultCount?: number
  /** Refine the median-cut colours with k-means at first. */
  defaultRefine?: boolean
  /** Prefix for the copied CSS custom properties. */
  variablePrefix?: string
  /** Called with the palette, most common colour first, whenever it is recomputed. */
  onPaletteChange?: (colors: PaletteExtractorColor[]) => void
  /** Merged last, so it wins. */
  className?: string
}

const toHex = (rgb: PaletteExtractorRgb) => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
const oklchCss = ({ l, c, h }: Oklch) => `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${c < 0.002 ? 0 : h.toFixed(1)})`

/**
 * The dominant colours of an image, with how much of it each one covers.
 *
 * Median cut finds the colours — it splits colour space where the pixels
 * actually are, so a small bright logo does not steal a slot from a large
 * muted background — and an optional few rounds of k-means pull each colour to
 * the true centre of its cluster. Shares come from assigning every sampled
 * pixel to its nearest colour, and the palette is sorted by them.
 *
 * Each swatch carries its hex, its OKLCH coordinates, and a text colour
 * chosen by WCAG contrast rather than by eye, so a palette pulled from a
 * product shot can go straight into a theme as CSS variables.
 */
export function PaletteExtractor({
  src,
  alt,
  defaultCount = 6,
  defaultRefine = true,
  variablePrefix = 'palette',
  onPaletteChange,
  className,
}: PaletteExtractorProps) {
  const [samples, setSamples] = useState<Uint8Array | null>(null)
  const [error, setError] = useState('')
  const [count, setCount] = useState(defaultCount)
  const [refine, setRefine] = useState(defaultRefine)
  const [format, setFormat] = useState<'hex' | 'oklch'>('hex')
  const [colors, setColors] = useState<PaletteExtractorColor[]>([])
  const [working, setWorking] = useState(false)
  const countId = useId()

  useEffect(() => {
    let cancelled = false
    setSamples(null)
    setError('')
    if (!src) return
    loadPixels(src, 240).then(
      ({ pixels }) => !cancelled && setSamples(paletteExtractorSamples(pixels)),
      (reason: Error) => !cancelled && setError(reason.message),
    )
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    if (!samples || samples.length === 0) return
    let cancelled = false
    setWorking(true)
    ;(async () => {
      let centroids = paletteExtractorMedianCut(samples, count)
      if (refine) {
        // A frame between rounds: each one reads every sample against every colour.
        for (let round = 0; round < 8; round += 1) {
          await nextFrame()
          if (cancelled) return
          const step = paletteExtractorRefine(samples, centroids)
          centroids = step.centroids
          if (step.shift < 0.5) break
        }
      }
      const labels = paletteExtractorAssign(samples, centroids)
      const population = new Array(centroids.length).fill(0)
      labels.forEach((label) => (population[label] += 1))
      const next = centroids
        .map((rgb, index) => {
          const hex = toHex(rgb)
          const ink = readableInk(hex)
          return { hex, rgb: rgb.map(Math.round) as PaletteExtractorRgb, oklch: hexToOklch(hex), share: population[index] / labels.length, ink, contrast: contrastRatio(ink, hex) }
        })
        .filter((color) => color.share > 0)
        .sort((a, b) => b.share - a.share)
      if (cancelled) return
      setColors(next)
      setWorking(false)
      onPaletteChange?.(next)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, count, refine])

  const css = `:root {\n${colors
    .map((color, index) => `  --${variablePrefix}-${index + 1}: ${format === 'hex' ? color.hex : oklchCss(color.oklch)}; /* ${Math.round(color.share * 100)}% */`)
    .join('\n')}\n}`

  return (
    <div className={cn('grid w-full gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]', className)}>
      <div className="flex flex-col gap-3">
        <div className="flex min-h-[160px] items-center justify-center overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken">
          {src ? <img src={src} alt={alt} className="block h-auto w-full" /> : <p className="m-0 p-6 text-[13px] font-medium text-ink-soft">No image.</p>}
        </div>
        {/* Share of the image as one stacked bar: the palette’s proportions at a glance. */}
        {colors.length > 0 && (
          <div aria-hidden="true" className="flex h-3 w-full overflow-hidden rounded-full">
            {colors.map((color, index) => (
              <span key={index} style={{ width: `${color.share * 100}%`, background: color.hex }} />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor={countId} className="text-[12px] font-semibold text-ink-soft">
              Colours
            </label>
            <span className="text-[12px] font-bold text-ink tabular">{count}</span>
          </div>
          <Slider id={countId} min={2} max={12} step={1} value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </div>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={refine} onChange={(event) => setRefine(event.target.checked)} />
          Refine with k-means
        </label>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {colors.length === 0 ? (
          <p className="m-0 text-[13px] font-medium text-ink-soft">{error || (samples ? 'Finding colours…' : src ? 'Reading the image…' : 'Nothing to read.')}</p>
        ) : (
          <ul aria-label="Palette, most common first" aria-busy={working} className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
            {colors.map((color, index) => (
              <li key={`${color.hex}-${index}`} className="flex flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface">
                <div className="flex h-16 items-end justify-between p-2" style={{ background: color.hex, color: color.ink }}>
                  <span className="font-mono text-[12px] font-bold">{color.hex}</span>
                  <span className="text-[11px] font-bold tabular">{Math.round(color.share * 100)}%</span>
                </div>
                <div className="flex items-center gap-1 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate font-mono text-[10px] font-semibold text-ink-soft">{oklchCss(color.oklch)}</p>
                    <p className="m-0 text-[10px] font-medium text-ink-faint">
                      {color.ink.endsWith('000000') ? 'Black' : 'White'} text · {color.contrast.toFixed(1)}:1
                    </p>
                  </div>
                  <CopyButton value={color.hex} label={`Copy ${color.hex}`} copiedLabel={`${color.hex} copied`} iconOnly size="sm" className="shrink-0" />
                </div>
              </li>
            ))}
          </ul>
        )}
        {colors.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl
                label="Variable format"
                size="sm"
                value={format}
                onValueChange={setFormat}
                options={[
                  { value: 'hex', label: 'Hex' },
                  { value: 'oklch', label: 'OKLCH' },
                ]}
              />
              <CopyButton value={css} label="Copy as CSS variables" copiedLabel="CSS variables copied" size="sm" />
            </div>
            <pre className="m-0 overflow-x-auto rounded-[var(--radius-glyph)] bg-surface-sunken p-3 font-mono text-[11px] font-semibold leading-relaxed text-ink">{css}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
