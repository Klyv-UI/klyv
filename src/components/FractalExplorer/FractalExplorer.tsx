'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { SegmentedControl } from '../SegmentedControl'
import { Slider } from '../Slider'
import { MinusIcon, PlusIcon } from '../internal/icons'

export type FractalExplorerMode = 'mandelbrot' | 'julia'

/** A point on the complex plane. */
export interface FractalExplorerPoint {
  re: number
  im: number
}

export interface FractalExplorerProps {
  /** Which set is shown first. */
  defaultMode?: FractalExplorerMode
  /** Escape-time iterations per pixel when it first renders. The slider changes it after that. */
  defaultIterations?: number
  /** The constant c the Julia set is drawn for, until one is picked from the Mandelbrot view. */
  defaultJuliaConstant?: FractalExplorerPoint
  /** Called when a new Julia constant is picked. */
  onJuliaConstantChange?: (point: FractalExplorerPoint) => void
  /** Height of the canvas, in pixels. The width fills the container. */
  height?: number
  /** Accessible name for the canvas. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

interface View extends FractalExplorerPoint {
  /** Width of the view on the complex plane. */
  span: number
}

const HOME: Record<FractalExplorerMode, View> = {
  mandelbrot: { re: -0.6, im: 0, span: 3.4 },
  julia: { re: 0, im: 0, span: 3.6 },
}

const STOPS = ['--color-surface-sunken', '--color-accent-soft', '--color-accent-strong', '--color-ink-soft']

/** Resolves colour tokens to RGB by painting each one into a single pixel. */
function readRamp(element: Element): { ramp: Uint8ClampedArray; inside: number[] } {
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const context = probe.getContext('2d', { willReadFrequently: true })
  const style = getComputedStyle(element)
  const rgb = (name: string, fallback: number[]) => {
    const value = style.getPropertyValue(name).trim()
    if (!context || !value) return fallback
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
  }
  const stops = STOPS.map((name, index) => rgb(name, [60 * index, 60 * index, 60 * index]))
  // A cyclic ramp, so deep zooms keep banding through the palette rather than washing out.
  const ramp = new Uint8ClampedArray(256 * 3)
  for (let index = 0; index < 256; index += 1) {
    const t = (index / 256) * stops.length
    const from = stops[Math.floor(t)]
    const to = stops[(Math.floor(t) + 1) % stops.length]
    const mix = t - Math.floor(t)
    for (let channel = 0; channel < 3; channel += 1) ramp[index * 3 + channel] = from[channel] + (to[channel] - from[channel]) * mix
  }
  // The set itself is drawn in the ink that sits on the accent: dark in both themes, like the classic black.
  return { ramp, inside: rgb('--color-accent-ink', [20, 20, 20]) }
}

const fmt = (value: number, digits = 5) => (value < 0 ? '−' : '') + Math.abs(value).toFixed(digits)
const complex = (point: FractalExplorerPoint) => `${fmt(point.re)} ${point.im < 0 ? '−' : '+'} ${Math.abs(point.im).toFixed(5)}i`

/**
 * The Mandelbrot and Julia sets, drawn by escape time on a canvas you can fly through.
 *
 * Rendering is chunked across animation frames with a budget of a few
 * milliseconds each, so a thousand iterations over a large canvas never locks
 * the page: a blocky pass lands first, then the full-resolution pass refines it
 * top to bottom, and any change cancels the render in flight. Under reduced
 * motion the blocky pass is skipped, since the snap from coarse to sharp is a
 * flash the reader did not ask for.
 *
 * The ramp is read from the colour tokens, so the set follows the theme and the
 * accent. Clicking the Mandelbrot view picks the Julia constant, which is how
 * the two sets are meant to be explored together — every point of one is a
 * whole picture of the other. Drag pans, the wheel zooms about the pointer, and
 * the canvas is one tab stop where arrows pan, + and − zoom, and Enter picks
 * the centre as the constant.
 */
export function FractalExplorer({
  defaultMode = 'mandelbrot',
  defaultIterations = 160,
  defaultJuliaConstant = { re: -0.8, im: 0.156 },
  onJuliaConstantChange,
  height = 360,
  label = 'Fractal explorer',
  className,
}: FractalExplorerProps) {
  const reduced = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null)
  const [mode, setMode] = useState<FractalExplorerMode>(defaultMode)
  const [views, setViews] = useState(HOME)
  const [iterations, setIterations] = useState(defaultIterations)
  const [constant, setConstant] = useState(defaultJuliaConstant)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<FractalExplorerPoint | null>(null)
  const [rendering, setRendering] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [theme, setTheme] = useState(0)
  const [message, setMessage] = useState('')
  const iterationsId = useId()
  const view = views[mode]

  const setView = (next: View) => setViews((current) => ({ ...current, [mode]: next }))

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => setWidth(frame.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    // Theme and accent are written on the root; repaint when they change.
    const themeWatch = new MutationObserver(() => setTheme((value) => value + 1))
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => setTheme((value) => value + 1)
    scheme.addEventListener('change', onScheme)
    return () => {
      observer.disconnect()
      themeWatch.disconnect()
      scheme.removeEventListener('change', onScheme)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      setUnsupported(true)
      return
    }
    if (width === 0) return
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const W = Math.max(1, Math.round(width * dpr))
    const H = Math.max(1, Math.round(height * dpr))
    canvas.width = W
    canvas.height = H
    const { ramp, inside } = readRamp(canvas)
    const image = context.createImageData(W, H)
    const data = image.data
    const scale = view.span / W
    const julia = mode === 'julia'
    const passes = reduced ? [1] : [6, 1]
    let pass = 0
    let row = 0
    let handle = 0

    const escape = (x0: number, y0: number) => {
      let x = julia ? x0 : 0
      let y = julia ? y0 : 0
      const cx = julia ? constant.re : x0
      const cy = julia ? constant.im : y0
      if (!julia) {
        // Skip the main cardioid and the period-2 bulb, where every point runs to the limit.
        const q = (x0 - 0.25) ** 2 + y0 * y0
        if (q * (q + x0 - 0.25) <= 0.25 * y0 * y0 || (x0 + 1) ** 2 + y0 * y0 <= 0.0625) return -1
      }
      for (let n = 0; n < iterations; n += 1) {
        const xx = x * x
        const yy = y * y
        if (xx + yy > 256) return n + 1 - Math.log2(Math.log2(xx + yy) / 2)
        y = 2 * x * y + cy
        x = xx - yy + cx
      }
      return -1
    }

    const work = () => {
      const started = performance.now()
      while (pass < passes.length) {
        const block = passes[pass]
        while (row < H) {
          const im = view.im - (row + block / 2 - H / 2) * scale
          for (let column = 0; column < W; column += block) {
            const mu = escape(view.re + (column + block / 2 - W / 2) * scale, im)
            const offset = (Math.floor(Math.max(0, mu) * 6) % 256) * 3
            const r = mu < 0 ? inside[0] : ramp[offset]
            const g = mu < 0 ? inside[1] : ramp[offset + 1]
            const b = mu < 0 ? inside[2] : ramp[offset + 2]
            for (let y = row; y < Math.min(H, row + block); y += 1)
              for (let x = column; x < Math.min(W, column + block); x += 1) {
                const at = (y * W + x) * 4
                data[at] = r
                data[at + 1] = g
                data[at + 2] = b
                data[at + 3] = 255
              }
          }
          row += block
          if (performance.now() - started > 10) {
            context.putImageData(image, 0, 0)
            handle = requestAnimationFrame(work)
            return
          }
        }
        context.putImageData(image, 0, 0)
        pass += 1
        row = 0
      }
      setRendering(false)
    }

    setRendering(true)
    canvas.style.transform = ''
    handle = requestAnimationFrame(work)
    return () => cancelAnimationFrame(handle)
  }, [mode, view, iterations, constant, width, height, reduced, theme])

  // The wheel has to be a non-passive listener to stop the page scrolling under the zoom.
  const wheelRef = useRef<(event: WheelEvent) => void>()
  wheelRef.current = (event: WheelEvent) => {
    event.preventDefault()
    const box = canvasRef.current!.getBoundingClientRect()
    zoomAt(Math.exp(event.deltaY * 0.0015), event.clientX - box.left, event.clientY - box.top)
  }
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => wheelRef.current?.(event)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // Before the first measurement there is no width to scale by; one pixel keeps the maths finite.
  const across = width || 1
  const toPoint = (x: number, y: number): FractalExplorerPoint => ({
    re: view.re + (x - across / 2) * (view.span / across),
    im: view.im - (y - height / 2) * (view.span / across),
  })

  const zoomAt = (factor: number, x = across / 2, y = height / 2) => {
    const anchor = toPoint(x, y)
    const span = Math.min(8, Math.max(1e-13, view.span * factor))
    setView({
      re: anchor.re - (x - across / 2) * (span / across),
      im: anchor.im + (y - height / 2) * (span / across),
      span,
    })
    return span
  }

  const pick = (point: FractalExplorerPoint) => {
    setConstant(point)
    onJuliaConstantChange?.(point)
    setMessage(`Julia constant set to ${complex(point)}.`)
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, dx: 0, dy: 0, moved: false }
  }
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    setHover(toPoint(event.clientX - box.left, event.clientY - box.top))
    const state = drag.current
    if (!state) return
    state.dx = event.clientX - state.x
    state.dy = event.clientY - state.y
    if (Math.hypot(state.dx, state.dy) > 3) state.moved = true
    // The last frame slides with the pointer; the render happens once, on release.
    if (state.moved) event.currentTarget.style.transform = `translate(${state.dx}px, ${state.dy}px)`
  }
  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current
    drag.current = null
    if (!state) return
    if (state.moved) {
      const unit = view.span / across
      setView({ ...view, re: view.re - state.dx * unit, im: view.im + state.dy * unit })
    } else if (mode === 'mandelbrot') {
      const box = event.currentTarget.getBoundingClientRect()
      pick(toPoint(event.clientX - box.left, event.clientY - box.top))
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const step = view.span * 0.1
    const keys: Record<string, () => string> = {
      ArrowLeft: () => (setView({ ...view, re: view.re - step }), 'Panned left'),
      ArrowRight: () => (setView({ ...view, re: view.re + step }), 'Panned right'),
      ArrowUp: () => (setView({ ...view, im: view.im + step }), 'Panned up'),
      ArrowDown: () => (setView({ ...view, im: view.im - step }), 'Panned down'),
      '+': () => `Zoom ${(HOME[mode].span / zoomAt(0.5)).toFixed(1)}×`,
      '=': () => `Zoom ${(HOME[mode].span / zoomAt(0.5)).toFixed(1)}×`,
      '-': () => `Zoom ${(HOME[mode].span / zoomAt(2)).toFixed(1)}×`,
      Home: () => (setView(HOME[mode]), 'View reset'),
      Enter: () => {
        if (mode !== 'mandelbrot') return 'Enter picks a constant in the Mandelbrot view'
        pick({ re: view.re, im: view.im })
        return ''
      },
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    const said = handler()
    if (said) setMessage(said)
  }

  const zoom = HOME[mode].span / view.span
  const marker = mode === 'mandelbrot' && width > 0 && {
    left: ((constant.re - view.re) / view.span + 0.5) * width,
    top: height / 2 - ((constant.im - view.im) / view.span) * width,
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Set"
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'mandelbrot', label: 'Mandelbrot' },
            { value: 'julia', label: 'Julia' },
          ]}
        />
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <label htmlFor={iterationsId} className="shrink-0 text-[12px] font-semibold text-ink-soft">
            Iterations
          </label>
          <Slider
            id={iterationsId}
            min={32}
            max={1000}
            step={8}
            value={iterations}
            onChange={(event) => setIterations(Number(event.target.value))}
          />
          <span className="w-10 text-right text-[12px] font-bold text-ink tabular">{iterations}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={PlusIcon} label="Zoom in" size="sm" tone="plain" onClick={() => zoomAt(0.5)} />
          <IconButton icon={MinusIcon} label="Zoom out" size="sm" tone="plain" onClick={() => zoomAt(2)} />
          <Button size="sm" variant="ghost" onClick={() => setView(HOME[mode])}>
            Reset
          </Button>
        </div>
      </div>

      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          role="application"
          aria-roledescription="fractal viewer"
          tabIndex={0}
          aria-label={`${label}: ${mode === 'mandelbrot' ? 'Mandelbrot set' : `Julia set for c = ${complex(constant)}`}, centred on ${complex(view)} at ${zoom.toFixed(1)}× zoom. Arrows pan, plus and minus zoom${mode === 'mandelbrot' ? ', Enter picks the centre as the Julia constant' : ''}.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onPointerLeave={() => setHover(null)}
          onDoubleClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect()
            zoomAt(event.shiftKey ? 2 : 0.5, event.clientX - box.left, event.clientY - box.top)
          }}
          onKeyDown={onKeyDown}
          className="block size-full cursor-grab touch-none outline-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
        />
        {marker && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-[0_0_0_1.5px_var(--color-ink)]"
            style={{ left: marker.left, top: marker.top }}
          />
        )}
        {unsupported && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] font-medium text-ink-soft">
            This browser cannot draw on a canvas, so the fractal cannot be rendered here.
          </p>
        )}
        {rendering && !unsupported && (
          <span className="absolute right-2 top-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Rendering
          </span>
        )}
      </div>

      <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-2 text-[12px] sm:grid-cols-4">
        {[
          ['Centre', complex(view)],
          ['Zoom', `${zoom < 1000 ? zoom.toFixed(1) : zoom.toExponential(2)}×`],
          ['Pointer', hover ? complex(hover) : '—'],
          ['Julia c', complex(constant)],
        ].map(([term, detail]) => (
          <div key={term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{term}</dt>
            <dd className="m-0 truncate font-semibold text-ink tabular">{detail}</dd>
          </div>
        ))}
      </dl>
      {mode === 'mandelbrot' && (
        <Button size="sm" variant="outline" className="self-start" onClick={() => setMode('julia')}>
          Show the Julia set for this c
        </Button>
      )}

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
