'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { onModeChange, onThemeChange } from '../../theme'
import { castRay, visibilityPolygon, type LightCasterPolygon } from './visibility'

export interface LightCasterLight {
  /** Stable key for the light and its handle. */
  id: string
  /** Horizontal position, from 0 (left edge of the region) to 1 (right edge). */
  x: number
  /** Vertical position, from 0 (top) to 1 (bottom). */
  y: number
  /** Any CSS colour or token. Defaults to a warm white tinted by the accent. */
  color?: string
  /** Brightness multiplier. 1 is a full light; above 1 overexposes. */
  intensity?: number
  /** Distance in pixels at which the light has faded out. Unset, it reaches across the whole region. */
  radius?: number
  /** Accessible name of the light’s handle. Defaults to “Light 1”, “Light 2”… */
  label?: string
}

/** `over` multiplies the light onto the content itself; `under` lights only the floor the content stands on. */
export type LightCasterLayer = 'over' | 'under'

/** `sway` is a lamp’s gentle drift, `orbit` carries each light round the centre like the sun. */
export type LightCasterMotion = 'none' | 'sway' | 'orbit'

export interface LightCasterProps {
  /** The region’s content. Its elements are the occluders, measured from the live layout. */
  children: ReactNode
  /** Controlled lights. Positions are fractions of the region, so they survive resizes. */
  lights?: LightCasterLight[]
  /** Lights for uncontrolled use. */
  defaultLights?: LightCasterLight[]
  /** Called with the new lights whenever one is dragged, nudged with the keyboard or follows the pointer. */
  onLightsChange?: (lights: LightCasterLight[]) => void
  /** Light that reaches everywhere, shadow included, from 0 (black shadows) to 1 (no shadows). Darker on dark themes. */
  ambient?: number
  /** Size in pixels of the light’s body: it sets how wide the soft penumbra at a shadow’s edge is. 0 is a point. */
  softness?: number
  /** Jittered positions per light used to build the penumbra, from 1 to 8. More is smoother and costs more. */
  samples?: number
  /** Whether the light falls on the content (`over`) or only on the floor beneath it (`under`). */
  layer?: LightCasterLayer
  /** Selector for the elements that cast shadows. When nothing matches, every direct child casts one. */
  occluders?: string
  /** The first light follows the pointer while it is over the region. */
  followPointer?: boolean
  /** Motion of the lights on their own. Ignored under reduced motion; dragging always works. */
  motion?: LightCasterMotion
  /** Multiplier for `motion`. */
  speed?: number
  /** Show the draggable, focusable handles. Without them the lights can only be set by props or `followPointer`. */
  showHandles?: boolean
  /** Merged last, so it wins. The region needs a size and usually a background for shadows to fall on. */
  className?: string
}

const DEFAULT_LIGHTS: LightCasterLight[] = [{ id: 'lamp', x: 0.3, y: 0.25 }]
const DEFAULT_COLOUR = 'color-mix(in oklab, var(--color-accent) 22%, white)'
const MAX_SAMPLES = 8
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

type Rgb = [number, number, number]

interface Occluder {
  left: number
  top: number
  right: number
  bottom: number
  radius: number
}

/** Resolve any CSS colour — a token, oklab, color-mix — to 0–255 RGB by painting one pixel. */
function resolveColour(value: string, host: HTMLElement, probe: CanvasRenderingContext2D | null): Rgb {
  host.style.color = ''
  host.style.color = value
  const computed = getComputedStyle(host).color
  host.style.color = ''
  if (!probe) return [255, 255, 255]
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = computed
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r!, g!, b!]
}

const luminance = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/** A fixed, well-spread pattern of points in the unit disc (a golden-angle spiral), so penumbrae do not shimmer. */
const JITTER = Array.from({ length: MAX_SAMPLES }, (_, i) => {
  const r = Math.sqrt((i + 0.5) / MAX_SAMPLES)
  const a = i * 2.399963
  return [Math.cos(a) * r, Math.sin(a) * r] as const
})

/**
 * Real light and shadow across real elements.
 *
 * A glow that follows the pointer (Spotlight) is a wash: it brightens a patch and knows nothing about what is under
 * it. This one reads the layout. Every occluder’s box is measured with getBoundingClientRect and kept current with a
 * ResizeObserver and on scroll, its four edges become walls, and for each light the 2D visibility polygon is cast
 * against them — a ray at every corner and one either side of it — so shadows start exactly at an element’s edge and
 * stretch away from the light. The penumbra is not a blur: each light is sampled at up to eight points across its
 * body and the polygons are summed, which is why a shadow is sharp near its caster and soft far from it.
 *
 * Coloured lights add, as light does, then the sum is multiplied onto the content with a faint screen glow on top,
 * so a card in a red and a blue light turns magenta where both reach it. Drawing happens only when something
 * moved; the loop runs only for `motion`, stops off screen and in hidden tabs, and reduced motion keeps the lights
 * where they were put. Each light has a focusable handle that the arrow keys move.
 */
export function LightCaster({
  children,
  lights: controlled,
  defaultLights = DEFAULT_LIGHTS,
  onLightsChange,
  ambient = 0.42,
  softness = 14,
  samples = 6,
  layer = 'over',
  occluders = '[data-occluder]',
  followPointer = false,
  motion = 'none',
  speed = 1,
  showHandles = true,
  className,
}: LightCasterProps) {
  const regionRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<HTMLCanvasElement>(null)
  const handleRefs = useRef(new Map<string, HTMLButtonElement>())
  const reducedMotion = usePrefersReducedMotion()
  const [uncontrolled, setUncontrolled] = useState(defaultLights)
  const lights = controlled ?? uncontrolled
  const dragging = useRef<string | null>(null)
  const redraw = useRef<() => void>(() => {})

  // Everything the renderer reads lives in one ref, so changing a prop redraws without rebuilding the observers.
  const live = useRef({ lights, ambient, softness, samples, motion, speed, reducedMotion })
  live.current = { lights, ambient, softness, samples, motion, speed, reducedMotion }

  const commit = useCallback(
    (next: LightCasterLight[]) => {
      if (controlled === undefined) setUncontrolled(next)
      onLightsChange?.(next)
    },
    [controlled, onLightsChange],
  )

  const moveLight = useCallback(
    (id: string, x: number, y: number) => {
      commit(live.current.lights.map((light) => (light.id === id ? { ...light, x: clamp01(x), y: clamp01(y) } : light)))
    },
    [commit],
  )

  useEffect(() => {
    redraw.current()
  }, [lights, ambient, softness, samples, motion, speed, reducedMotion])

  useEffect(() => {
    const region = regionRef.current
    const content = contentRef.current
    const mask = maskRef.current
    const glow = glowRef.current
    if (!region || !content || !mask) return
    const maskContext = mask.getContext('2d')
    const glowContext = glow?.getContext('2d') ?? null
    const accumulator = document.createElement('canvas')
    const light = accumulator.getContext('2d')
    const floorCanvas = layer === 'under' ? document.createElement('canvas') : null
    const floor = floorCanvas?.getContext('2d') ?? null
    const probeCanvas = document.createElement('canvas')
    probeCanvas.width = probeCanvas.height = 1
    const probe = probeCanvas.getContext('2d', { willReadFrequently: true })
    if (!maskContext || !light) return

    let width = 0
    let height = 0
    let scale = 1
    let boxes: Occluder[] = []
    let observed: Element[] = []
    let frame = 0
    let loopFrame = 0
    let visible = true
    let elapsed = 0
    let last = 0
    let palette = { dark: false, floor: [0, 0, 0] as Rgb, colours: new Map<string, Rgb>() }

    // Buffers sized for the current occluder count; reallocated only when it grows.
    let segments = new Float64Array(0)
    let scratch = { angles: new Float64Array(0), xs: new Float64Array(0), ys: new Float64Array(0), order: [] as number[] }
    let polygon: LightCasterPolygon = { xs: new Float64Array(0), ys: new Float64Array(0), count: 0 }

    /** Resolve colours once and cache them; a theme change empties the cache. */
    const readTheme = (fresh: boolean) => {
      if (fresh) {
        const surface = resolveColour('var(--color-surface)', region, probe)
        const background = getComputedStyle(region).backgroundColor
        const bare = background === 'transparent' || /,\s*0\)$/.test(background)
        const floorColour = resolveColour(bare ? 'var(--color-surface-sunken)' : background, region, probe)
        palette = { dark: luminance(surface) < 0.45, floor: floorColour, colours: new Map() }
      }
      for (const entry of live.current.lights) {
        const key = entry.color ?? DEFAULT_COLOUR
        if (!palette.colours.has(key)) palette.colours.set(key, resolveColour(key, region, probe))
      }
    }

    const measure = () => {
      const box = region.getBoundingClientRect()
      width = box.width
      height = box.height
      scale = Math.min(1.5, window.devicePixelRatio || 1)
      const pixelWidth = Math.max(1, Math.round(width * scale))
      const pixelHeight = Math.max(1, Math.round(height * scale))
      for (const canvas of [mask, glow, accumulator, floorCanvas]) {
        if (canvas && (canvas.width !== pixelWidth || canvas.height !== pixelHeight)) {
          canvas.width = pixelWidth
          canvas.height = pixelHeight
        }
      }
      let nodes = Array.from(content.querySelectorAll<HTMLElement>(occluders))
      if (!nodes.length) nodes = Array.from(content.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
      boxes = []
      for (const node of nodes) {
        const rect = node.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) continue
        const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0
        boxes.push({
          left: rect.left - box.left,
          top: rect.top - box.top,
          right: rect.right - box.left,
          bottom: rect.bottom - box.top,
          radius: Math.min(radius, rect.width / 2, rect.height / 2),
        })
      }
      const segmentCount = boxes.length * 4 + 4
      if (segments.length < segmentCount * 4) {
        segments = new Float64Array(segmentCount * 4)
        const points = segmentCount * 6
        scratch = { angles: new Float64Array(points), xs: new Float64Array(points), ys: new Float64Array(points), order: [] }
        polygon = { xs: new Float64Array(points), ys: new Float64Array(points), count: 0 }
      }
      const same = nodes.length === observed.length && nodes.every((node, i) => node === observed[i])
      if (!same) {
        for (const node of observed) resizeObserver.unobserve(node)
        for (const node of nodes) resizeObserver.observe(node)
        observed = nodes
      }
    }

    /** Walls for one light: the region’s border plus every box the light is not inside. */
    const buildSegments = (lx: number, ly: number) => {
      let n = 0
      const push = (ax: number, ay: number, bx: number, by: number) => {
        const o = n * 4
        segments[o] = ax
        segments[o + 1] = ay
        segments[o + 2] = bx
        segments[o + 3] = by
        n++
      }
      push(-1, -1, width + 1, -1)
      push(width + 1, -1, width + 1, height + 1)
      push(width + 1, height + 1, -1, height + 1)
      push(-1, height + 1, -1, -1)
      const owners: number[] = []
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i]!
        // A light set down on top of an element lights it; it casts no shadow from its own base.
        if (lx > b.left && lx < b.right && ly > b.top && ly < b.bottom) {
          owners.push(-1)
          continue
        }
        owners.push(n)
        push(b.left, b.top, b.right, b.top)
        push(b.right, b.top, b.right, b.bottom)
        push(b.right, b.bottom, b.left, b.bottom)
        push(b.left, b.bottom, b.left, b.top)
      }
      return { count: n, owners }
    }

    const positionOf = (entry: LightCasterLight, index: number) => {
      const { motion: kind, speed: rate, reducedMotion: still } = live.current
      let x = entry.x
      let y = entry.y
      let flicker = 1
      if (!still && dragging.current !== entry.id) {
        const t = elapsed * rate
        if (kind === 'sway') {
          x += Math.sin(t * 0.9 + index * 1.7) * 0.014 + Math.sin(t * 2.3 + index) * 0.004
          y += Math.cos(t * 0.7 + index * 2.1) * 0.01
          flicker = 1 + Math.sin(t * 7.1 + index) * 0.02 + Math.sin(t * 12.7) * 0.015
        } else if (kind === 'orbit') {
          const dx = (entry.x - 0.5) * width
          const dy = (entry.y - 0.5) * height
          const r = Math.hypot(dx, dy)
          const a = Math.atan2(dy, dx) + t * 0.35
          x = 0.5 + (Math.cos(a) * r) / Math.max(1, width)
          y = 0.5 + (Math.sin(a) * r) / Math.max(1, height)
        }
      }
      return { x: clamp01(x) * width, y: clamp01(y) * height, flicker }
    }

    const gradient = (context: CanvasRenderingContext2D, x: number, y: number, reach: number, rgb: Rgb, alpha: number) => {
      const fill = context.createRadialGradient(x, y, 0, x, y, reach)
      const [r, g, b] = rgb
      // Roughly 1 / (1 + kd²), cut to zero at the edge so the reach is honest.
      const stops: [number, number][] = [[0, 1], [0.12, 0.86], [0.3, 0.56], [0.55, 0.26], [0.8, 0.08], [1, 0]]
      for (const [at, strength] of stops) fill.addColorStop(at, `rgba(${r},${g},${b},${strength * alpha})`)
      return fill
    }

    const draw = () => {
      frame = 0
      if (!width || !height) return
      const { lights: current, ambient: base, softness: spread, samples: wanted } = live.current
      const sampleCount = Math.max(1, Math.min(MAX_SAMPLES, Math.round(wanted)))
      const diagonal = Math.hypot(width, height)

      light.setTransform(1, 0, 0, 1, 0, 0)
      light.globalCompositeOperation = 'source-over'
      light.fillStyle = 'black'
      light.fillRect(0, 0, accumulator.width, accumulator.height)
      light.setTransform(scale, 0, 0, scale, 0, 0)
      light.globalCompositeOperation = 'lighter'

      current.forEach((entry, index) => {
        const { x, y, flicker } = positionOf(entry, index)
        const handle = handleRefs.current.get(entry.id)
        if (handle) {
          handle.style.transform = `translate(${x - entry.x * width}px, ${y - entry.y * height}px) translate(-50%, -50%)`
        }
        const rgb = palette.colours.get(entry.color ?? DEFAULT_COLOUR) ?? [255, 255, 255]
        const strength = (entry.intensity ?? 1) * flicker
        const reach = entry.radius ?? diagonal * 1.25
        const { count, owners } = buildSegments(x, y)

        // The penumbra: the same light from several points across its body, each a fraction of the whole.
        const n = spread > 0 ? sampleCount : 1
        light.globalAlpha = 1
        for (let s = 0; s < n; s++) {
          const [jx, jy] = n === 1 ? [0, 0] : JITTER[s]!
          const sx = x + jx * spread
          const sy = y + jy * spread
          visibilityPolygon(sx, sy, segments, count, scratch, polygon)
          if (polygon.count < 3) continue
          light.beginPath()
          light.moveTo(polygon.xs[0]!, polygon.ys[0]!)
          for (let i = 1; i < polygon.count; i++) light.lineTo(polygon.xs[i]!, polygon.ys[i]!)
          light.closePath()
          light.fillStyle = gradient(light, sx, sy, reach, rgb, strength / n)
          light.fill()
        }

        // The tops of the occluders: lit by how much of each one the light can see past the others.
        boxes.forEach((b, i) => {
          const own = owners[i]!
          const inset = Math.min(3, (b.right - b.left) / 4, (b.bottom - b.top) / 4)
          const probes = [
            [(b.left + b.right) / 2, (b.top + b.bottom) / 2],
            [b.left + inset, b.top + inset],
            [b.right - inset, b.top + inset],
            [b.right - inset, b.bottom - inset],
            [b.left + inset, b.bottom - inset],
          ]
          let seen = 0
          for (const [px, py] of probes) {
            const dx = px! - x
            const dy = py! - y
            const distance = Math.hypot(dx, dy)
            if (distance < 1e-3) {
              seen++
              continue
            }
            const hit = castRay(x, y, dx / distance, dy / distance, segments, count, own, own < 0 ? -1 : own + 4)
            if (hit >= distance - 0.5) seen++
          }
          if (!seen) return
          light.beginPath()
          if (b.radius > 0 && typeof light.roundRect === 'function') {
            light.roundRect(b.left, b.top, b.right - b.left, b.bottom - b.top, b.radius)
          } else light.rect(b.left, b.top, b.right - b.left, b.bottom - b.top)
          light.fillStyle = gradient(light, x, y, reach, rgb, (strength * seen) / probes.length)
          light.fill()
        })
      })

      // Shadows deepen on a dark theme: the same ambient setting lets through less.
      const level = Math.round(clamp01(base) * (palette.dark ? 0.62 : 1) * 255)
      const glowAlpha = palette.dark ? 0.34 : 0.12

      if (layer === 'over') {
        maskContext.globalCompositeOperation = 'source-over'
        maskContext.fillStyle = `rgb(${level},${level},${level})`
        maskContext.fillRect(0, 0, mask.width, mask.height)
        maskContext.globalCompositeOperation = 'lighter'
        maskContext.drawImage(accumulator, 0, 0)
        if (glowContext && glow) {
          glowContext.clearRect(0, 0, glow.width, glow.height)
          glowContext.globalAlpha = glowAlpha
          glowContext.drawImage(accumulator, 0, 0)
          glowContext.globalAlpha = 1
        }
      } else if (floor && floorCanvas) {
        // Under the content: the floor colour, multiplied by the light, then the same glow screened on.
        floor.globalCompositeOperation = 'source-over'
        floor.fillStyle = `rgb(${level},${level},${level})`
        floor.fillRect(0, 0, floorCanvas.width, floorCanvas.height)
        floor.globalCompositeOperation = 'lighter'
        floor.drawImage(accumulator, 0, 0)
        const [r, g, b] = palette.floor
        maskContext.globalCompositeOperation = 'source-over'
        maskContext.fillStyle = `rgb(${r},${g},${b})`
        maskContext.fillRect(0, 0, mask.width, mask.height)
        maskContext.globalCompositeOperation = 'multiply'
        maskContext.drawImage(floorCanvas, 0, 0)
        maskContext.globalCompositeOperation = 'screen'
        maskContext.globalAlpha = glowAlpha
        maskContext.drawImage(accumulator, 0, 0)
        maskContext.globalAlpha = 1
        maskContext.globalCompositeOperation = 'source-over'
      }
    }

    const request = () => {
      if (!frame && !loopFrame) frame = requestAnimationFrame(draw)
    }
    redraw.current = () => {
      readTheme(false)
      syncLoop()
      request()
    }

    const loop = (now: number) => {
      if (last) elapsed += Math.min(0.1, (now - last) / 1000)
      last = now
      draw()
      loopFrame = requestAnimationFrame(loop)
    }
    const stopLoop = () => {
      cancelAnimationFrame(loopFrame)
      loopFrame = 0
      last = 0
    }
    function syncLoop() {
      const { motion: kind, reducedMotion: still } = live.current
      const wanted = kind !== 'none' && !still && visible && !document.hidden
      if (wanted && !loopFrame) loopFrame = requestAnimationFrame(loop)
      else if (!wanted) stopLoop()
    }

    const resizeObserver = new ResizeObserver(() => {
      measure()
      request()
    })
    resizeObserver.observe(region)
    readTheme(true)
    measure()
    draw()
    syncLoop()

    const onScroll = () => {
      measure()
      request()
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    const mutations = new MutationObserver(onScroll)
    mutations.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-occluder'] })

    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting)
            syncLoop()
          })
    intersection?.observe(region)
    const onVisibility = () => syncLoop()
    document.addEventListener('visibilitychange', onVisibility)

    const onTheme = () => {
      readTheme(true)
      request()
    }
    const offTheme = onThemeChange(onTheme)
    const offMode = onModeChange(onTheme)
    const themeObserver = new MutationObserver(onTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
    scheme?.addEventListener?.('change', onTheme)

    return () => {
      cancelAnimationFrame(frame)
      stopLoop()
      redraw.current = () => {}
      resizeObserver.disconnect()
      mutations.disconnect()
      intersection?.disconnect()
      themeObserver.disconnect()
      offTheme()
      offMode()
      scheme?.removeEventListener?.('change', onTheme)
      window.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [layer, occluders])

  const pointFor = (event: { clientX: number; clientY: number }) => {
    const box = regionRef.current?.getBoundingClientRect()
    if (!box || !box.width || !box.height) return null
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
  }

  const onHandleDown = (id: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = id
  }
  const onHandleMove = (id: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragging.current !== id) return
    const point = pointFor(event)
    if (point) moveLight(id, point.x, point.y)
  }
  const onHandleUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragging.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const onHandleKey = (entry: LightCasterLight) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    moveLight(entry.id, entry.x + move[0], entry.y + move[1])
  }

  const onRegionMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!followPointer || dragging.current || event.pointerType === 'touch') return
    const first = lights[0]
    const point = pointFor(event)
    if (first && point) moveLight(first.id, point.x, point.y)
  }

  const handleLabel = (entry: LightCasterLight, index: number) =>
    `${entry.label ?? `Light ${index + 1}`}: ${Math.round(entry.x * 100)}% across, ${Math.round(entry.y * 100)}% down`

  return (
    <div ref={regionRef} onPointerMove={onRegionMove} className={cn('relative isolate overflow-hidden', className)}>
      <canvas
        ref={maskRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 block size-full',
          layer === 'over' ? 'z-10 mix-blend-multiply' : '-z-10',
        )}
      />
      {layer === 'over' && (
        <canvas ref={glowRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 block size-full mix-blend-screen" />
      )}
      <div ref={contentRef} className="contents">
        {children}
      </div>
      {showHandles &&
        lights.map((entry, index) => (
          <button
            key={entry.id}
            ref={(node) => {
              if (node) handleRefs.current.set(entry.id, node)
              else handleRefs.current.delete(entry.id)
            }}
            type="button"
            aria-label={handleLabel(entry, index)}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            onPointerDown={onHandleDown(entry.id)}
            onPointerMove={onHandleMove(entry.id)}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            onKeyDown={onHandleKey(entry)}
            style={{
              color: entry.color ?? DEFAULT_COLOUR,
              left: `${clamp01(entry.x) * 100}%`,
              top: `${clamp01(entry.y) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={cn(
              'absolute z-20 grid size-9 cursor-grab touch-none place-items-center rounded-full',
              'active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            )}
          >
            <span aria-hidden="true" className="absolute size-7 rounded-full bg-current opacity-50 blur-md" />
            <span
              aria-hidden="true"
              className="relative size-4 rounded-full border-2 border-surface bg-current ring-1 ring-line-strong"
            />
          </button>
        ))}
    </div>
  )
}
