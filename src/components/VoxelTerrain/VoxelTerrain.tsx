'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { nextFrame, tokenRgb, useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import type { IconComponent } from '../../lib/types'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { SegmentedControl } from '../SegmentedControl'
import {
  buildTerrain,
  createScratch,
  elevationAt,
  MAP_BITS,
  MAP_SIZE,
  pack,
  paintSky,
  paintTerrain,
  renderVoxels,
  terrainPalette,
  vantage,
  type Terrain,
  type TerrainColours,
  type VoxelCamera,
  type VoxelScratch,
  type VoxelTerrainTone,
} from './terrain'

export type { VoxelTerrainTone }
export type VoxelTerrainQuality = 'low' | 'medium' | 'high'

export interface VoxelTerrainHandle {
  /** Generate a new map — from `seed`, or from a random one — and return to its vantage point. */
  regenerate: (seed?: number) => void
}

export interface VoxelTerrainProps {
  /** The terrain's seed. The same seed always makes the same map; changing it generates a new one. */
  seed?: number
  /** Called with the new seed when the map is regenerated from the button or the handle. */
  onSeedChange?: (seed: number) => void
  /** 0–1. Low rolls like downland; high is all crags. Sets the Hurst exponent of the diamond–square noise. */
  roughness?: number
  /** 0–1. The fraction of the height range under water. */
  waterLevel?: number
  /** `terrain` bands water, sand, grass, rock and snow from the accent and ink; `accent` is one hue; `ink` is greyscale. */
  tone?: VoxelTerrainTone
  /** Distance fog, 0–1. At 0 only the far edge fades, so the draw distance never shows as a line. */
  fog?: number
  /** Multiplies the flight speed. 1 is a steady cruise. */
  speed?: number
  /** Controlled quality: internal resolution, draw distance and how fine the far samples are. */
  quality?: VoxelTerrainQuality
  /** Uncontrolled starting quality. */
  defaultQuality?: VoxelTerrainQuality
  /** Called when the quality buttons change it. */
  onQualityChange?: (quality: VoxelTerrainQuality) => void
  /** Steer by dragging and, when focused, with the keyboard. Off, it is a picture that flies itself. */
  interactive?: boolean
  /** Fly on its own along a weaving, terrain-following path. Off, the camera hovers until steered. Ignored under reduced motion. */
  autoFly?: boolean
  /** Hold the flight still. The view can still be turned by hand. */
  paused?: boolean
  /** Show the overview map with your position and heading. */
  map?: boolean
  /** Accessible name for the view. An empty string on a non-interactive terrain makes it decorative. */
  label?: string
  /** Show the pause, regenerate and quality controls under the view. */
  controls?: boolean
  /** CSS aspect ratio of the view. */
  aspectRatio?: string
  /** Content drawn on top — a headline in the sky. It does not take the pointer unless it asks for it. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Per quality: the widest internal buffer (it is scaled up to the element's
 * size), the draw distance in map cells, and how fast the sample step grows
 * with distance. Width dominates cost — every pixel is written once — and the
 * y-buffer makes distance nearly free, so the high setting spends it on both.
 */
const QUALITY = {
  low: { width: 320, distance: 420, growth: 0.022 },
  medium: { width: 480, distance: 640, growth: 0.014 },
  high: { width: 720, distance: 900, growth: 0.009 },
} as const

/** Horizontal field of view: tan(38.7°), a little under 80° across. */
const TAN_HALF_FOV = 0.8
/** Height kept above the highest ground in the lookahead, in world units. */
const CLEARANCE = 30

type Action = 'left' | 'right' | 'up' | 'down' | 'forward' | 'back' | 'climb' | 'descend'

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  '+': 'forward',
  '=': 'forward',
  '-': 'back',
  _: 'back',
  PageUp: 'climb',
  PageDown: 'descend',
}

const PlayIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
    <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" />
  </svg>
)
const PauseIcon: IconComponent = ({ size = 16, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
    <rect x="3.5" y="3" width="3" height="10" rx="1" />
    <rect x="9.5" y="3" width="3" height="10" rx="1" />
  </svg>
)
const VantageIcon: IconComponent = ({ size = 16, strokeWidth = 2, className }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M1.5 13l4.5-7 3 4.5 2-3 3.5 5.5z" />
    <circle cx="11.5" cy="3.5" r="1.3" />
  </svg>
)

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const wrap = (v: number) => ((v % MAP_SIZE) + MAP_SIZE) % MAP_SIZE
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/** Compass bearing: yaw 0 faces east and the map's y axis points south. */
const bearing = (yaw: number) => Math.round((((yaw * 180) / Math.PI + 90) % 360 + 360) % 360)

/**
 * Terrain you fly over, drawn the way Comanche drew it in 1992: no polygons,
 * one ray per screen column, a y-buffer, and a heightmap.
 *
 * The map is diamond–square noise generated on a torus, so it has no edge to
 * fly off: position simply wraps. Height and slope pick each cell's colour from
 * bands built out of the theme's accent and ink, and a lambert term from the
 * heightmap's gradient shades it, so ridges facing the sun catch the light.
 * The renderer walks each column front to back, drawing only what the y-buffer
 * says is still uncovered, with a sample step that lengthens with distance and
 * fog that hides where it stops. See `terrain.ts` for the details.
 *
 * Left alone it flies itself — heading weaving on two slow incommensurate sines,
 * altitude following the highest ground a few seconds ahead, banking into its
 * own turns. A drag or a key takes over; a few seconds after you let go the
 * autopilot eases back in from wherever you left it. Under reduced motion there
 * is no flight: one still from a chosen vantage, turned by hand.
 */
export const VoxelTerrain = forwardRef<VoxelTerrainHandle, VoxelTerrainProps>(function VoxelTerrain(
  {
    seed: seedProp,
    onSeedChange,
    roughness = 0.5,
    waterLevel = 0.26,
    tone = 'terrain',
    fog = 0.35,
    speed = 1,
    quality: qualityProp,
    defaultQuality = 'medium',
    onQualityChange,
    interactive = true,
    autoFly = true,
    paused = false,
    map = true,
    label = 'Voxel terrain flyover',
    controls = true,
    aspectRatio = '16 / 9',
    children,
    className,
  },
  ref,
) {
  const reduced = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const hintId = useId()
  const [seed, setSeed] = useState(seedProp ?? 1337)
  const [innerQuality, setInnerQuality] = useState<VoxelTerrainQuality>(defaultQuality)
  const quality = qualityProp ?? innerQuality
  const [stopped, setStopped] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const markerRef = useRef<HTMLSpanElement>(null)
  const hudRef = useRef<HTMLSpanElement>(null)

  const sim = useRef({
    alive: true,
    terrain: null as Terrain | null,
    colours: null as TerrainColours | null,
    builtKey: '',
    buildingKey: '',
    image: null as ImageData | null,
    pixels: null as Uint32Array | null,
    scratch: null as VoxelScratch | null,
    cam: { x: 0, y: 0, z: 80, yaw: 0, pitch: -0.08, roll: 0 } as VoxelCamera,
    lift: 0,
    clock: 0,
    lastInput: -Infinity,
    held: new Set<Action>(),
    drag: null as { id: number; x: number; y: number } | null,
    frame: 0,
    last: 0,
    visible: false,
    hudTick: 0,
    announce: false,
  })
  const live = useRef({ seed, roughness, waterLevel, tone, fog, speed, quality, autoFly, paused, stopped, reduced })
  live.current = { seed, roughness, waterLevel, tone, fog, speed, quality, autoFly, paused, stopped, reduced }

  useEffect(() => {
    if (seedProp !== undefined) setSeed(seedProp)
  }, [seedProp])

  /* ------------------------------------------------------------ drawing */

  /** The overview map: the colour map sampled every eighth cell. Painted once per terrain or theme. */
  const paintMap = useCallback(() => {
    const s = sim.current
    const canvas = mapRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !s.colours) return
    const M = 128
    const stride = MAP_SIZE / M
    canvas.width = canvas.height = M
    const image = context.createImageData(M, M)
    const pixels = new Uint32Array(image.data.buffer)
    const { r, g, b } = s.colours
    for (let y = 0; y < M; y++) {
      for (let x = 0; x < M; x++) {
        const k = ((y * stride) << MAP_BITS) | (x * stride)
        pixels[y * M + x] = pack(r[k], g[k], b[k])
      }
    }
    context.putImageData(image, 0, 0)
  }, [])

  /** Resolve the tokens and recolour the map. Runs per terrain and per theme change, never per frame. */
  const paint = useCallback(() => {
    const s = sim.current
    const host = frameRef.current
    if (!s.terrain || !host) return
    const tokens = {
      ink: tokenRgb(host, '--color-ink', [23, 25, 28]),
      inkInverse: tokenRgb(host, '--color-ink-inverse', [255, 255, 255]),
      accent: tokenRgb(host, '--color-accent', [200, 242, 78]),
      canvas: tokenRgb(host, '--color-canvas', [244, 247, 240]),
    }
    s.colours = paintTerrain(s.terrain, terrainPalette(tokens, live.current.tone))
    if (s.scratch && s.image) paintSky(s.scratch, s.image.height, s.colours)
    paintMap()
  }, [paintMap])

  const draw = useCallback(() => {
    const s = sim.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!context || !s.image || !s.pixels || !s.scratch || !s.terrain || !s.colours) return
    const state = live.current
    const q = QUALITY[state.quality]
    renderVoxels(s.pixels, s.image.width, s.image.height, s.terrain, s.colours, s.cam, { distance: q.distance, growth: q.growth, fog: state.fog, tanHalfFov: TAN_HALF_FOV }, s.scratch)
    context.putImageData(s.image, 0, 0)
    const marker = markerRef.current
    if (marker) {
      marker.style.left = `${(s.cam.x / MAP_SIZE) * 100}%`
      marker.style.top = `${(s.cam.y / MAP_SIZE) * 100}%`
      marker.style.transform = `translate(-50%, -50%) rotate(${s.cam.yaw}rad)`
    }
    // Text is the one DOM write that costs layout, so it changes a few times a second, not every frame.
    const hud = hudRef.current
    if (hud && s.hudTick++ % 12 === 0) {
      const ground = elevationAt(s.terrain, s.cam.x, s.cam.y)
      hud.textContent = `${String(bearing(s.cam.yaw)).padStart(3, '0')}° · ${Math.round(s.cam.z - ground)} above ground`
    }
  }, [])

  /* --------------------------------------------------------------- flight */

  /** Put the camera at the terrain's vantage point, facing its highest peak. */
  const resetView = useCallback(() => {
    const s = sim.current
    if (!s.terrain) return
    const v = vantage(s.terrain)
    s.cam = { x: v.x, y: v.y, z: v.z, yaw: v.yaw, pitch: -0.08, roll: 0 }
    s.lift = 0
    s.clock = 0
  }, [])

  /** Advance the camera by dt seconds. Returns whether anything is still moving. */
  const advance = useCallback((dt: number, now: number) => {
    const s = sim.current
    const state = live.current
    const t = s.terrain
    const c = s.cam
    if (!t) return false
    const flying = state.autoFly && !state.paused && !state.stopped && !state.reduced
    const handsOn = s.held.size > 0 || s.drag !== null
    if (handsOn) s.lastInput = now
    const has = (action: Action) => (s.held.has(action) ? 1 : 0)
    // The autopilot yields to any input and eases back in 2.5–4 s after it stops.
    const pilot = flying ? smooth(2.5, 4, (now - s.lastInput) / 1000) : 0
    if (flying) s.clock += dt
    // Two sines with incommensurate periods (57 s and 22 s): a heading that
    // weaves smoothly and does not visibly repeat.
    const autoYaw = pilot * (0.2 * Math.sin(s.clock * 0.11) + 0.12 * Math.sin(s.clock * 0.29 + 1.7))
    const yawRate = autoYaw + (has('right') - has('left')) * 1.1
    c.yaw += yawRate * dt
    c.pitch = clamp(c.pitch + (has('up') - has('down')) * 0.5 * dt, -0.45, 0.35)
    s.lift = clamp(s.lift + (has('climb') - has('descend')) * 40 * dt, -20, 160)

    const cruise = flying ? 26 * state.speed : 0
    const forward = cruise + (has('forward') - has('back')) * 45
    const cos = Math.cos(c.yaw)
    const sin = Math.sin(c.yaw)
    c.x = wrap(c.x + cos * forward * dt)
    c.y = wrap(c.y + sin * forward * dt)

    // Terrain following: hold a clearance over the highest ground a few
    // seconds ahead, discounted with distance, so it climbs before a ridge
    // rather than at it, and never lets the ground come closer than 6 units.
    const here = elevationAt(t, c.x, c.y)
    let ahead = here
    for (const d of [25, 60, 120, 200]) ahead = Math.max(ahead, elevationAt(t, c.x + cos * d, c.y + sin * d) - d * 0.12)
    const target = ahead + CLEARANCE + s.lift
    const ease = state.reduced ? 1 : 1 - Math.exp(-dt * 1.4)
    const climb = (target - c.z) * ease
    c.z = Math.max(c.z + climb, here + 6)
    if (pilot > 0) {
      const nose = clamp(-0.1 + (climb / Math.max(dt, 1e-3)) * 0.004, -0.2, 0.05)
      c.pitch += (nose - c.pitch) * (1 - Math.exp(-dt * 1.5 * pilot))
    }
    // Bank into the turn, as an aircraft does; roll is purely a consequence of yaw rate.
    const bank = state.reduced ? 0 : clamp(-yawRate * 0.45, -0.35, 0.35)
    c.roll += (bank - c.roll) * (state.reduced ? 1 : 1 - Math.exp(-dt * 2.5))
    return flying || handsOn || Math.abs(target - c.z) > 0.05 || Math.abs(bank - c.roll) > 0.002
  }, [])

  const loop = useCallback(
    (now: number) => {
      const s = sim.current
      s.frame = 0
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60
      s.last = now
      const moving = advance(dt, now)
      draw()
      if (moving && s.visible && !document.hidden && s.alive) s.frame = requestAnimationFrame(loop)
      else s.last = 0
    },
    [advance, draw],
  )

  /** Schedule a frame. The loop keeps itself going only while something moves. */
  const wake = useCallback(() => {
    const s = sim.current
    if (!s.frame && s.visible && !document.hidden && s.alive) s.frame = requestAnimationFrame(loop)
  }, [loop])

  /* ------------------------------------------------------------- terrain */

  /**
   * Generate the map for the current seed — once the view is on screen, and
   * only where a 2D canvas exists — yielding between passes. A newer request
   * abandons an older one at its next yield.
   */
  const build = useCallback(async () => {
    const s = sim.current
    const { seed: current, roughness: r, waterLevel: w } = live.current
    const key = `${current}:${r}:${w}`
    if (!s.visible || s.builtKey === key || s.buildingKey === key) return
    if (!canvasRef.current?.getContext('2d')) return
    s.buildingKey = key
    const terrain = await buildTerrain(current, r, w, async () => {
      await nextFrame()
      return s.alive && s.buildingKey === key
    })
    if (!terrain || s.buildingKey !== key) return
    s.buildingKey = ''
    s.builtKey = key
    s.terrain = terrain
    paint()
    resetView()
    if (s.announce) setAnnouncement(`New terrain from seed ${current}.`)
    s.announce = true
    wake()
  }, [paint, resetView, wake])

  // The first map is built at once; later ones wait for a slider to settle, so
  // a drag across roughness is one rebuild at the end rather than one per step.
  useEffect(() => {
    const timer = setTimeout(() => void build(), sim.current.terrain ? 140 : 0)
    return () => clearTimeout(timer)
  }, [seed, roughness, waterLevel, build])

  useEffect(() => {
    paint()
    wake()
  }, [tone, themeVersion, paint, wake])

  useEffect(() => {
    if (reduced) setStopped(false)
    wake()
  }, [autoFly, paused, stopped, reduced, speed, fog, wake])

  // Internal resolution: the element's size at up to 2× device pixels, capped by quality.
  useEffect(() => {
    const frame = frameRef.current
    const canvas = canvasRef.current
    if (!frame || !canvas) return
    const resize = () => {
      const s = sim.current
      const w = frame.clientWidth
      const h = frame.clientHeight
      if (!w || !h) return
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(64, Math.min(QUALITY[quality].width, Math.round(w * ratio)))
      const height = Math.max(36, Math.round((width * h) / w))
      if (canvas.width !== width || canvas.height !== height || !s.image) {
        const context = canvas.getContext('2d')
        if (!context) return
        canvas.width = width
        canvas.height = height
        s.image = context.createImageData(width, height)
        s.pixels = new Uint32Array(s.image.data.buffer)
        s.scratch = createScratch(width, height)
        if (s.colours) paintSky(s.scratch, height, s.colours)
      }
      wake()
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(frame)
    return () => observer?.disconnect()
  }, [quality, wake])

  // Nothing is generated or animated until the view is on screen; the loop parks off screen and in hidden tabs.
  useEffect(() => {
    const frame = frameRef.current
    const s = sim.current
    s.alive = true
    const onVisibility = () => {
      s.last = 0
      wake()
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            s.visible = entry.isIntersecting
            if (s.visible) {
              void build()
              wake()
            }
          })
    if (observer && frame) observer.observe(frame)
    else {
      s.visible = true
      void build()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      s.alive = false
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(s.frame)
      s.frame = 0
    }
  }, [build, wake])

  /* ------------------------------------------------------------- controls */

  const regenerate = useCallback(
    (next?: number) => {
      const value = next ?? Math.floor(Math.random() * 100000)
      if (value === live.current.seed) {
        resetView()
        wake()
      } else setSeed(value)
      onSeedChange?.(value)
    },
    [onSeedChange, resetView, wake],
  )

  useImperativeHandle(ref, () => ({ regenerate }), [regenerate])

  const chooseQuality = (next: VoxelTerrainQuality) => {
    if (qualityProp === undefined) setInnerQuality(next)
    onQualityChange?.(next)
    setAnnouncement(`Quality ${next}: up to ${QUALITY[next].width} pixels across, ${QUALITY[next].distance} cells deep.`)
  }

  const touch = () => {
    sim.current.lastInput = performance.now()
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    sim.current.drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    touch()
    wake()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = sim.current
    if (!s.drag || s.drag.id !== event.pointerId) return
    // Right turns right; up looks up. Yaw in radians per pixel, pitch in screen heights per pixel.
    s.cam.yaw += (event.clientX - s.drag.x) * 0.005
    s.cam.pitch = clamp(s.cam.pitch - (event.clientY - s.drag.y) * 0.003, -0.45, 0.35)
    s.drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    touch()
    wake()
  }

  const endDrag = () => {
    sim.current.drag = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const s = sim.current
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    if (key === 'Home') resetView()
    else if (key === ' ') {
      if (reduced || !autoFly || paused) return
      setStopped((value) => !value)
    } else {
      const action = KEYS[key]
      if (!action) return
      if (reduced) {
        // A step per key press, not a held glide: under reduced motion the
        // view changes only by exactly as much as each press asks for.
        const c = s.cam
        if (action === 'left' || action === 'right') c.yaw += action === 'right' ? 0.12 : -0.12
        else if (action === 'up' || action === 'down') c.pitch = clamp(c.pitch + (action === 'up' ? 0.04 : -0.04), -0.45, 0.35)
        else if (action === 'climb' || action === 'descend') s.lift = clamp(s.lift + (action === 'climb' ? 10 : -10), -20, 160)
        else {
          const step = action === 'forward' ? 16 : -16
          c.x = wrap(c.x + Math.cos(c.yaw) * step)
          c.y = wrap(c.y + Math.sin(c.yaw) * step)
        }
      } else s.held.add(action)
    }
    event.preventDefault()
    touch()
    wake()
  }

  const onKeyUp = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const action = KEYS[key]
    if (action) sim.current.held.delete(action)
  }

  const flying = autoFly && !paused && !stopped && !reduced
  const decorative = !interactive && !label

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div
        ref={frameRef}
        className="relative isolate w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-sunken"
        style={{ aspectRatio }}
      >
        <canvas
          ref={canvasRef}
          role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : label}
          aria-hidden={decorative || undefined}
          aria-describedby={interactive ? hintId : undefined}
          tabIndex={interactive ? 0 : undefined}
          onPointerDown={interactive ? onPointerDown : undefined}
          onPointerMove={interactive ? onPointerMove : undefined}
          onPointerUp={interactive ? endDrag : undefined}
          onPointerCancel={interactive ? endDrag : undefined}
          onKeyDown={interactive ? onKeyDown : undefined}
          onKeyUp={interactive ? onKeyUp : undefined}
          onBlur={() => sim.current.held.clear()}
          className={cn(
            'absolute inset-0 size-full rounded-[var(--radius-card)]',
            // Touch: horizontal drags steer, vertical drags still scroll the page past it.
            interactive && 'cursor-grab touch-pan-y select-none active:cursor-grabbing',
            'focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-focus',
          )}
        />
        {interactive ? (
          <span id={hintId} className="sr-only">
            Drag, or use the arrow keys or W A S D, to turn and to look up and down. Plus and minus fly forward and back, Page Up and Page Down change
            altitude, Home returns to the starting view{reduced || !autoFly ? '' : ', and Space pauses the flight'}.
          </span>
        ) : null}

        {children ? <div className="pointer-events-none absolute inset-0">{children}</div> : null}

        {map ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-3 size-[88px] overflow-hidden rounded-[var(--radius-10)] border border-line-strong bg-surface shadow-[var(--shadow-tile)]"
          >
            <canvas ref={mapRef} className="size-full" />
            <span ref={markerRef} className="absolute left-1/2 top-1/2 flex size-3.5 items-center justify-center">
              <svg viewBox="0 0 14 14" width="14" height="14" className="overflow-visible">
                <path d="M13 7L2 12.5 4.5 7 2 1.5z" fill="var(--color-accent)" stroke="var(--color-accent-ink)" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        ) : null}

        {controls ? (
          <span
            ref={hudRef}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[color-mix(in_oklab,var(--color-surface)_80%,transparent)] px-2.5 py-1 font-mono text-[11px] tabular-nums text-ink-soft"
          />
        ) : null}
      </div>

      {controls ? (
        <div className="flex flex-wrap items-center gap-2">
          {!reduced && autoFly ? (
            <IconButton
              icon={flying ? PauseIcon : PlayIcon}
              label={flying ? 'Pause the flight' : 'Resume the flight'}
              size="sm"
              tone="muted"
              disabled={paused}
              onClick={() => setStopped((value) => !value)}
            />
          ) : null}
          <IconButton
            icon={VantageIcon}
            label="Back to the vantage point"
            size="sm"
            tone="muted"
            onClick={() => {
              resetView()
              touch()
              wake()
            }}
          />
          <Button size="sm" variant="outline" onClick={() => regenerate()}>
            New terrain
          </Button>
          <span className="font-mono text-[12px] tabular-nums text-ink-faint">seed {seed}</span>
          <SegmentedControl
            label="Quality"
            size="sm"
            className="ml-auto"
            value={quality}
            onValueChange={chooseQuality}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
})
