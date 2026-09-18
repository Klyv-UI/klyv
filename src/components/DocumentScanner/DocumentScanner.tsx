'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { loadPixels, tokenRgb, useThemeVersion } from '../../lib/image-data'
import { Button } from '../Button'
import { Switch } from '../Switch'
import {
  documentScannerEdges,
  documentScannerFindQuad,
  documentScannerHomography,
  documentScannerThreshold,
  documentScannerWarpRows,
  type DocumentScannerPoint,
  type DocumentScannerQuad,
} from './scan'

export interface DocumentScannerProps {
  /** Photo of the page — a data: or blob: URL, or any same-origin or CORS-enabled address. */
  src: string
  /** Alt text for the photo. */
  alt: string
  /** Called with the flattened page when Export is pressed. */
  onExport?: (blob: Blob) => void
  /** Start with the black-and-white scanned look on. */
  defaultScanLook?: boolean
  /** Longest side of the exported page, in pixels. */
  maxOutputSize?: number
  /** Merged last, so it wins. */
  className?: string
}

const CORNERS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left']
const FALLBACK: DocumentScannerQuad = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
]
const dist = (a: DocumentScannerPoint, b: DocumentScannerPoint) => Math.hypot(a.x - b.x, a.y - b.y)

/** Warp in slices of rows so a large page never blocks input; resolves with the flat page. */
function warp(source: ImageData, quad: DocumentScannerQuad, maxSide: number, cancelled: () => boolean): Promise<ImageData | null> {
  const pixelQuad = quad.map((point) => ({ x: point.x * source.width, y: point.y * source.height })) as DocumentScannerQuad
  const width = Math.max(dist(pixelQuad[0], pixelQuad[1]), dist(pixelQuad[3], pixelQuad[2]))
  const height = Math.max(dist(pixelQuad[0], pixelQuad[3]), dist(pixelQuad[1], pixelQuad[2]))
  const scale = Math.min(1, maxSide / Math.max(width, height, 1))
  const target = new ImageData(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)))
  const h = documentScannerHomography(pixelQuad, target.width, target.height)
  return new Promise((resolve) => {
    let row = 0
    const slice = () => {
      if (cancelled()) return resolve(null)
      const started = performance.now()
      while (row < target.height && performance.now() - started < 10) {
        documentScannerWarpRows(source, target, h, row, Math.min(target.height, row + 8))
        row += 8
      }
      if (row < target.height) setTimeout(slice, 0)
      else resolve(target)
    }
    slice()
  })
}

/**
 * Turns a photo of a page into a flat, square-on scan.
 *
 * The page is found the way a scanning app does it: blur, Canny-style edges,
 * the largest connected contour, its convex hull, and the four hull corners
 * that enclose the most area. Detection is a guess, so the corners stay
 * draggable — and focusable, with arrows to nudge — because a wrong corner is
 * fixed faster by hand than by any threshold slider.
 *
 * The flattening is a true perspective correction: a homography solved from
 * the four corners, sampled bilinearly, in slices so the page stays
 * responsive. The optional scanned look is an adaptive threshold, which
 * survives the uneven lighting of a phone photo where a single cut-off would
 * black out one corner.
 */
export function DocumentScanner({ src, alt, onExport, defaultScanLook = false, maxOutputSize = 2000, className }: DocumentScannerProps) {
  const [full, setFull] = useState<ImageData | null>(null)
  const [edges, setEdges] = useState<{ map: Uint8Array; width: number; height: number } | null>(null)
  const [quad, setQuad] = useState<DocumentScannerQuad | null>(null)
  const [detected, setDetected] = useState<DocumentScannerQuad | null>(null)
  const [error, setError] = useState('')
  const [scanLook, setScanLook] = useState(defaultScanLook)
  const [showEdges, setShowEdges] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const frameRef = useRef<HTMLDivElement>(null)
  const edgeRef = useRef<HTMLCanvasElement>(null)
  const resultRef = useRef<HTMLCanvasElement>(null)
  const dragging = useRef<number | null>(null)
  const theme = useThemeVersion()

  useEffect(() => {
    let cancelled = false
    setFull(null)
    setQuad(null)
    setError('')
    if (!src) return
    Promise.all([loadPixels(src, 1600), loadPixels(src, 420)]).then(
      ([large, small]) => {
        if (cancelled) return
        const { width, height } = small.pixels
        const map = documentScannerEdges(small.pixels)
        const found = documentScannerFindQuad(map, width, height)
        const corners = found ? (found.map((point) => ({ x: point.x / width, y: point.y / height })) as DocumentScannerQuad) : FALLBACK
        setFull(large.pixels)
        setEdges({ map, width, height })
        setQuad(corners)
        setDetected(corners)
        setMessage(found ? 'Page found. Adjust the corners if needed.' : 'No page edge was found; place the corners by hand.')
      },
      (reason: Error) => !cancelled && setError(reason.message),
    )
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    const canvas = edgeRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !edges || !showEdges) return
    canvas.width = edges.width
    canvas.height = edges.height
    const [r, g, b] = tokenRgb(canvas, '--color-accent-strong', [60, 140, 40])
    const image = context.createImageData(edges.width, edges.height)
    edges.map.forEach((on, index) => on && image.data.set([r, g, b, 255], index * 4))
    context.putImageData(image, 0, 0)
  }, [edges, showEdges, theme])

  useEffect(() => {
    if (!full || !quad) return
    let cancelled = false
    warp(full, quad, 720, () => cancelled).then((page) => {
      const canvas = resultRef.current
      if (!page || !canvas || cancelled) return
      const shown = scanLook ? documentScannerThreshold(page, Math.max(6, Math.round(page.width / 40))) : page
      canvas.width = shown.width
      canvas.height = shown.height
      canvas.getContext('2d')?.putImageData(shown, 0, 0)
    })
    return () => {
      cancelled = true
    }
  }, [full, quad, scanLook])

  const moveCorner = (index: number, to: DocumentScannerPoint) => {
    if (!quad) return
    const next = [...quad] as DocumentScannerQuad
    next[index] = { x: Math.min(1, Math.max(0, to.x)), y: Math.min(1, Math.max(0, to.y)) }
    setQuad(next)
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current === null) return
    const box = frameRef.current!.getBoundingClientRect()
    moveCorner(dragging.current, { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height })
  }

  const onCornerKey = (event: KeyboardEvent<SVGElement>, index: number) => {
    if (!quad) return
    const step = event.shiftKey ? 0.02 : 0.004
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    moveCorner(index, { x: quad[index].x + move[0], y: quad[index].y + move[1] })
  }

  const exportPage = async () => {
    if (!full || !quad || !onExport) return
    setExporting(true)
    const page = await warp(full, quad, maxOutputSize, () => false)
    if (page) {
      const canvas = document.createElement('canvas')
      const shown = scanLook ? documentScannerThreshold(page, Math.max(6, Math.round(page.width / 40))) : page
      canvas.width = shown.width
      canvas.height = shown.height
      canvas.getContext('2d')?.putImageData(shown, 0, 0)
      canvas.toBlob((blob) => {
        setExporting(false)
        if (blob) onExport(blob)
      }, scanLook ? 'image/png' : 'image/jpeg', 0.92)
    } else setExporting(false)
  }

  const w = full?.width ?? 1
  const h = full?.height ?? 1
  const radius = Math.max(w, h) * 0.018
  const pct = (value: number) => `${Math.round(value * 1000) / 10}%`

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={scanLook} onChange={(event) => setScanLook(event.target.checked)} />
          Scanned look
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={showEdges} onChange={(event) => setShowEdges(event.target.checked)} />
          Show detected edges
        </label>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" disabled={!detected} onClick={() => detected && setQuad(detected)}>
          Reset corners
        </Button>
        {onExport && (
          <Button size="sm" variant="accent" disabled={!quad} loading={exporting} onClick={exportPage}>
            Export page
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div
          ref={frameRef}
          className="relative w-full overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken"
          style={full ? { aspectRatio: `${w} / ${h}` } : { minHeight: 220 }}
        >
          {src && <img src={src} alt={alt} draggable={false} className="absolute inset-0 size-full object-fill" />}
          <canvas ref={edgeRef} aria-hidden="true" className={cn('absolute inset-0 size-full bg-[color-mix(in_oklab,var(--color-surface)_80%,transparent)]', !showEdges && 'hidden')} />
          {quad && full && (
            <svg
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
              role="group"
              aria-label="Page corners"
              className="absolute inset-0 size-full touch-none"
              onPointerMove={onPointerMove}
              onPointerUp={() => (dragging.current = null)}
              onPointerCancel={() => (dragging.current = null)}
            >
              <polygon
                points={quad.map((point) => `${point.x * w},${point.y * h}`).join(' ')}
                className="pointer-events-none fill-[color-mix(in_oklab,var(--color-accent)_18%,transparent)] stroke-accent-strong"
                strokeWidth={radius / 3}
                strokeLinejoin="round"
              />
              {quad.map((point, index) => (
                <circle
                  key={CORNERS[index]}
                  cx={point.x * w}
                  cy={point.y * h}
                  r={radius}
                  role="button"
                  tabIndex={0}
                  aria-label={`${CORNERS[index]} corner at ${pct(point.x)} across, ${pct(point.y)} down. Arrows move it.`}
                  onPointerDown={(event) => {
                    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
                    dragging.current = index
                  }}
                  onKeyDown={(event) => onCornerKey(event, index)}
                  className="cursor-grab fill-surface stroke-accent-strong outline-none focus-visible:fill-accent"
                  strokeWidth={radius / 3}
                />
              ))}
            </svg>
          )}
          {!full && (
            <p className="absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-[13px] font-medium text-ink-soft">
              {error || (src ? 'Looking for the page…' : 'No photo to scan.')}
            </p>
          )}
        </div>
        <div className="flex min-h-[220px] items-center justify-center rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3">
          {full ? (
            <canvas ref={resultRef} role="img" aria-label={`Flattened page${scanLook ? ', scanned look' : ''}`} className="block max-h-[520px] max-w-full shadow-[var(--shadow-tile)]" />
          ) : (
            <p className="m-0 text-[13px] font-medium text-ink-faint">The flattened page appears here.</p>
          )}
        </div>
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
