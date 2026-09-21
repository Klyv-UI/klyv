'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { onModeChange, onThemeChange } from '../../theme'
import {
  blurRainGlassImage,
  coverRainGlassImage,
  paintRainGlassScene,
  type RainGlassPalette,
  type RainGlassRgb,
  type RainGlassScene,
} from './scene'
import { RainGlassSimulation } from './simulation'

export type RainGlassStatus = 'starting' | 'running' | 'unsupported'

export interface RainGlassProps {
  /**
   * What is behind the glass: `city` or `bokeh` (drawn in code), an image URL, or a canvas. The glass refracts this
   * image — not the live page underneath it.
   */
  background?: RainGlassScene | string | HTMLCanvasElement
  /** How hard it is raining, from 0 (dry: the drops already there stay put) to 1 (a downpour). */
  intensity?: number
  /** Multiplier for the size of the drops. */
  dropSize?: number
  /** How strongly the glass fogs, from 0 (clear) to 1 (frosted). */
  fog?: number
  /** Seconds for a wiped patch to fog over again. */
  fogReturn?: number
  /** Freeze the rain. Wiping still works. */
  paused?: boolean
  /** Let pointer drags wipe the fog like a finger. Sets `touch-action: none` on the pane. */
  wipe?: boolean
  /** Describe the scene for assistive tech. Without it the pane is decorative and hidden. */
  label?: string
  /** Called when rendering starts, or when it falls back. */
  onStatusChange?: (status: RainGlassStatus) => void
  /** Content drawn on top of the glass. */
  children?: ReactNode
  /** Merged last, so it wins. Give the component a size here. */
  className?: string
}

/** Imperative controls, for a keyboard route to the effects a pointer gets by dragging. */
export interface RainGlassHandle {
  /** Wipe the whole pane clear of fog. It fogs over again at the `fogReturn` rate. */
  wipe: () => void
  /** Wipe a horizontal band across the pane, as a sleeve would. `at` is 0 (top) to 1 (bottom). */
  wipeBand: (at: number) => void
}

const VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`

const FRAGMENT = `
precision mediump float;
uniform sampler2D u_bg;
uniform sampler2D u_blur;
uniform sampler2D u_drops;
uniform sampler2D u_fog;
uniform vec2 u_res;
uniform float u_scale;
uniform float u_rmax;
uniform float u_fogAmount;
uniform vec3 u_veil;
uniform float u_dark;

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 sharp = texture2D(u_bg, uv).rgb;
  vec3 soft = texture2D(u_blur, uv).rgb;
  float fog = texture2D(u_fog, uv).r * u_fogAmount;
  // Condensation scatters light: the blurred scene, lifted towards the veil colour.
  vec3 frosted = mix(soft, u_veil, 0.2 + 0.12 * (1.0 - u_dark)) + 0.03;
  vec3 glass = mix(sharp, frosted, fog);

  vec4 d = texture2D(u_drops, uv);
  float cover = smoothstep(0.2, 0.8, d.a);
  if (cover > 0.001) {
    vec2 p = d.rg * 2.0 - 1.0;
    p.y = -p.y;
    float l2 = min(dot(p, p), 1.0);
    float l = sqrt(l2);
    float h = sqrt(1.0 - l2);
    float radius = d.b * u_rmax * u_scale;
    // A drop is a lens: the view through it is the scene around its centre, flipped and squeezed.
    vec2 offset = -p * radius * 1.55 / u_res;
    vec3 seen = texture2D(u_bg, clamp(uv + offset, 0.001, 0.999)).rgb;
    seen = mix(seen, vec3(1.0), 0.06);
    vec3 n = normalize(vec3(p * 0.9, h + 0.2));
    vec3 light = normalize(vec3(-0.5, 0.62, 0.62));
    float spec = pow(max(dot(n, light), 0.0), 42.0);
    float rim = smoothstep(0.5, 1.0, l);
    float caustic = smoothstep(0.55, 0.95, l) * smoothstep(0.1, 0.8, -p.y) * (1.0 - smoothstep(0.95, 1.0, l));
    vec3 drop = seen * (1.0 - rim * (0.5 + 0.2 * (1.0 - u_dark)));
    drop += seen * caustic * 0.55;
    drop += vec3(spec) * (0.55 + 0.35 * u_dark);
    glass = mix(glass, drop, cover);
  }
  gl_FragColor = vec4(glass, 1.0);
}
`

/** Radius buckets encoded in the drop map’s blue channel. */
const BUCKETS = 24
const SPRITE = 64

/** A drop, as a sprite: the lens normal in red and green, its radius bucket in blue, coverage in alpha. */
function makeSprites(): HTMLCanvasElement[] {
  const sprites: HTMLCanvasElement[] = []
  for (let bucket = 0; bucket < BUCKETS; bucket++) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SPRITE
    const context = canvas.getContext('2d')
    if (!context) return sprites
    const image = context.createImageData(SPRITE, SPRITE)
    const blue = Math.round(((bucket + 0.5) / BUCKETS) * 255)
    for (let y = 0; y < SPRITE; y++) {
      for (let x = 0; x < SPRITE; x++) {
        const px = ((x + 0.5) / SPRITE) * 2 - 1
        const py = ((y + 0.5) / SPRITE) * 2 - 1
        const d = Math.hypot(px, py)
        const o = (y * SPRITE + x) * 4
        image.data[o] = Math.round((px * 0.5 + 0.5) * 255)
        image.data[o + 1] = Math.round((py * 0.5 + 0.5) * 255)
        image.data[o + 2] = blue
        image.data[o + 3] = Math.round(Math.min(1, Math.max(0, (1 - d) * (SPRITE / 3))) * 255)
      }
    }
    context.putImageData(image, 0, 0)
    sprites.push(canvas)
  }
  return sprites
}

/** Resolve any CSS colour — a token, oklab, color-mix — to 0–255 RGB by painting one pixel. */
function resolveColour(value: string, host: HTMLElement, probe: CanvasRenderingContext2D | null): RainGlassRgb {
  host.style.color = value
  const computed = getComputedStyle(host).color
  host.style.color = ''
  if (!probe) return [128, 128, 128]
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = computed
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r!, g!, b!]
}

const BUILT_IN = new Set<string>(['city', 'bokeh'])

/**
 * Rain on a window, refracting a picture of what is behind it.
 *
 * The drops are simulated, not animated: a CPU model spawns them, grows them by swallowing the mist, merges them
 * when they touch and lets the heavy ones slide in stick–slip runs that leave trails of beads and wipe the fog as
 * they go. Each frame the drops are stamped into a map that holds every drop’s lens normal and size, and a WebGL
 * shader turns that into optics — each drop samples the scene flipped and squeezed around its centre, with a
 * highlight and a dark rim — over a fogged layer that is the scene blurred, cleared wherever a drop ran or a finger
 * wiped, and slowly fogging over again.
 *
 * It refracts an image, not the page: the background is a picture you pass (or one of two scenes drawn in code),
 * because a browser will not hand a shader the pixels of live DOM. Under reduced motion the rain is simulated ahead
 * of time and shown still, and wiping still works. Without WebGL the fogged, blurred scene is shown instead, with a
 * note saying why. The loop stops off screen and in hidden tabs.
 */
export const RainGlass = forwardRef<RainGlassHandle, RainGlassProps>(function RainGlass(
  {
    background = 'city',
    intensity = 0.5,
    dropSize = 1,
    fog = 0.75,
    fogReturn = 14,
    paused = false,
    wipe = true,
    label,
    onStatusChange,
    children,
    className,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fallbackRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [status, setStatus] = useState<RainGlassStatus>('starting')
  const statusCallback = useRef(onStatusChange)
  statusCallback.current = onStatusChange
  const live = useRef({ intensity, dropSize, fog, fogReturn, paused, reducedMotion })
  live.current = { intensity, dropSize, fog, fogReturn, paused, reducedMotion }
  const api = useRef({ wipeStroke: (_points: [number, number][], _width: number) => {}, clearAll: () => {}, sync: () => {} })

  useImperativeHandle(
    ref,
    () => ({
      wipe: () => api.current.clearAll(),
      wipeBand: (at: number) => {
        const box = rootRef.current?.getBoundingClientRect()
        if (!box) return
        const y = Math.min(1, Math.max(0, at)) * box.height
        api.current.wipeStroke(
          [
            [-20, y],
            [box.width + 20, y],
          ],
          Math.max(40, box.height * 0.16),
        )
      },
    }),
    [],
  )

  useEffect(() => {
    statusCallback.current?.(status)
  }, [status])

  useEffect(() => {
    api.current.sync()
  }, [paused, reducedMotion, intensity, dropSize, fog])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return

    const probeCanvas = document.createElement('canvas')
    probeCanvas.width = probeCanvas.height = 1
    const probe = probeCanvas.getContext('2d', { willReadFrequently: true })
    const scene = document.createElement('canvas')
    const blurred = document.createElement('canvas')
    const dropMap = document.createElement('canvas')
    const fogMap = document.createElement('canvas')
    const dropContext = dropMap.getContext('2d')
    const fogContext = fogMap.getContext('2d')
    let image: HTMLImageElement | null = null
    let palette: RainGlassPalette | null = null
    let veil: RainGlassRgb = [255, 255, 255]
    let cssWidth = 0
    let cssHeight = 0
    let scale = 1
    let mapScale = 1
    let fogScale = 0.25
    // Set once the WebGL pipeline exists; an image that loads before then, or without it, goes to the fallback.
    let ready = false

    const readPalette = () => {
      const read = (token: string) => resolveColour(`var(${token})`, root, probe)
      const surface = read('--color-surface')
      const lum = (0.2126 * surface[0] + 0.7152 * surface[1] + 0.0722 * surface[2]) / 255
      palette = {
        dark: lum < 0.45,
        surface,
        ink: read('--color-ink'),
        accent: read('--color-accent'),
        warning: read('--color-warning'),
        danger: read('--color-danger'),
        success: read('--color-success'),
      }
      veil = palette.dark ? read('--color-surface-muted') : surface
    }

    /** Paint the background and its blur at the current size. */
    const paintBackground = () => {
      if (!palette) readPalette()
      const context = scene.getContext('2d')
      if (!context || !palette) return
      if (typeof background === 'string' && BUILT_IN.has(background)) {
        paintRainGlassScene(scene, background as RainGlassScene, palette)
      } else {
        context.fillStyle = `rgb(${palette.surface.join(',')})`
        context.fillRect(0, 0, scene.width, scene.height)
        if (typeof background !== 'string') coverRainGlassImage(scene, background, background.width, background.height)
        else if (image?.complete && image.naturalWidth) coverRainGlassImage(scene, image, image.naturalWidth, image.naturalHeight)
      }
      blurRainGlassImage(scene, blurred, 5)
    }

    if (typeof background === 'string' && !BUILT_IN.has(background)) {
      image = new Image()
      image.decoding = 'async'
      image.crossOrigin = 'anonymous'
      image.onload = () => {
        paintBackground()
        if (ready) {
          uploadBackground()
          requestRender()
        } else drawFallback()
      }
      image.src = background
    }

    const simulation = new RainGlassSimulation()

    const wipeFog = (x0: number, y0: number, x1: number, y1: number, r: number) => {
      if (!fogContext) return
      fogContext.strokeStyle = 'black'
      fogContext.lineCap = 'round'
      fogContext.lineWidth = Math.max(1, r * 2 * fogScale)
      fogContext.beginPath()
      fogContext.moveTo(x0 * fogScale, y0 * fogScale)
      fogContext.lineTo(x1 * fogScale, y1 * fogScale)
      fogContext.stroke()
    }

    const resetFog = () => {
      if (!fogContext) return
      fogContext.globalAlpha = 1
      fogContext.fillStyle = 'white'
      fogContext.fillRect(0, 0, fogMap.width, fogMap.height)
    }

    // ------------------------------------------------------------------ WebGL
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false })
    const sprites = makeSprites()

    const drawFallback = () => {
      const target = fallbackRef.current
      if (!target) return
      target.width = blurred.width
      target.height = blurred.height
      const context = target.getContext('2d')
      if (!context || !palette) return
      context.drawImage(blurred, 0, 0)
      context.fillStyle = `rgba(${veil.join(',')},${0.28 * live.current.fog})`
      context.fillRect(0, 0, target.width, target.height)
    }

    const sizeAll = () => {
      const box = root.getBoundingClientRect()
      cssWidth = Math.max(1, box.width)
      cssHeight = Math.max(1, box.height)
      scale = Math.min(1.5, window.devicePixelRatio || 1)
      // The drop map needs roughly a pixel per CSS pixel; beyond a large pane it is capped to keep uploads cheap.
      mapScale = Math.min(1, Math.sqrt(900000 / (cssWidth * cssHeight)))
      fogScale = 0.25
      const width = Math.round(cssWidth * scale)
      const height = Math.round(cssHeight * scale)
      canvas.width = scene.width = width
      canvas.height = scene.height = height
      blurred.width = Math.max(1, Math.round(width / 2))
      blurred.height = Math.max(1, Math.round(height / 2))
      dropMap.width = Math.max(1, Math.round(cssWidth * mapScale))
      dropMap.height = Math.max(1, Math.round(cssHeight * mapScale))
      fogMap.width = Math.max(1, Math.round(cssWidth * fogScale))
      fogMap.height = Math.max(1, Math.round(cssHeight * fogScale))
      simulation.resize(cssWidth, cssHeight)
      resetFog()
    }

    if (!gl) {
      readPalette()
      sizeAll()
      paintBackground()
      drawFallback()
      setStatus('unsupported')
      const observer = new ResizeObserver(() => {
        sizeAll()
        paintBackground()
        drawFallback()
      })
      observer.observe(root)
      return () => observer.disconnect()
    }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
    }
    const vertex = compile(gl.VERTEX_SHADER, VERTEX)
    const pixel = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()!
    if (vertex && pixel) {
      gl.attachShader(program, vertex)
      gl.attachShader(program, pixel)
      gl.linkProgram(program)
    }
    if (!vertex || !pixel || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
      readPalette()
      sizeAll()
      paintBackground()
      drawFallback()
      setStatus('unsupported')
      return
    }
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const uniform = (name: string) => gl.getUniformLocation(program, name)

    const textures = ['u_bg', 'u_blur', 'u_drops', 'u_fog'].map((name, unit) => {
      const texture = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.uniform1i(uniform(name), unit)
      return texture
    })
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    const upload = (unit: number, source: HTMLCanvasElement) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, textures[unit]!)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    }
    function uploadBackground() {
      upload(0, scene)
      upload(1, blurred)
    }

    const uRes = uniform('u_res')
    const uScale = uniform('u_scale')
    const uRmax = uniform('u_rmax')
    const uFog = uniform('u_fogAmount')
    const uVeil = uniform('u_veil')
    const uDark = uniform('u_dark')

    const paintDrops = () => {
      if (!dropContext) return
      const maxR = simulation.maxRadius(live.current.dropSize) * 1.7
      dropContext.setTransform(1, 0, 0, 1, 0, 0)
      dropContext.clearRect(0, 0, dropMap.width, dropMap.height)
      dropContext.setTransform(mapScale, 0, 0, mapScale, 0, 0)
      const bucketOf = (r: number) => Math.min(BUCKETS - 1, Math.floor((r / maxR) * BUCKETS))
      const { droplets, dropletCount } = simulation
      for (let i = 0; i < dropletCount; i++) {
        const r = droplets[i * 3 + 2]!
        if (r <= 0) continue
        dropContext.drawImage(sprites[bucketOf(r)]!, droplets[i * 3]! - r, droplets[i * 3 + 1]! - r, r * 2, r * 2)
      }
      for (const drop of simulation.drops) {
        // A running drop stretches along its run and narrows a touch.
        const stretch = Math.min(0.45, drop.vy / 500)
        const w = drop.r * 2 * (1 - stretch * 0.25)
        const h = drop.r * 2 * (1 + stretch)
        dropContext.drawImage(sprites[bucketOf(drop.r)]!, drop.x - w / 2, drop.y - h / 2 - stretch * drop.r * 0.4, w, h)
      }
    }

    const render = () => {
      if (!palette) return
      paintDrops()
      upload(2, dropMap)
      upload(3, fogMap)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uScale, scale)
      gl.uniform1f(uRmax, simulation.maxRadius(live.current.dropSize) * 1.7)
      gl.uniform1f(uFog, Math.min(1, Math.max(0, live.current.fog)))
      gl.uniform3f(uVeil, veil[0] / 255, veil[1] / 255, veil[2] / 255)
      gl.uniform1f(uDark, palette.dark ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const step = (dt: number) => {
      const { intensity: rain, dropSize: size, fogReturn: back } = live.current
      simulation.step(dt, { intensity: Math.min(1, Math.max(0, rain)), dropSize: Math.max(0.3, size), wipe: wipeFog })
      if (fogContext && back > 0) {
        fogContext.globalAlpha = Math.min(1, dt / back)
        fogContext.fillStyle = 'white'
        fogContext.fillRect(0, 0, fogMap.width, fogMap.height)
        fogContext.globalAlpha = 1
      }
    }

    /** Rain that has been falling for a while, for the first frame and for the reduced-motion still. */
    const prime = (seconds: number) => {
      const { intensity: rain } = live.current
      const warm = Math.max(0.35, rain)
      for (let t = 0; t < seconds; t += 1 / 30) {
        simulation.step(1 / 30, { intensity: warm, dropSize: Math.max(0.3, live.current.dropSize), wipe: wipeFog })
      }
    }

    let frame = 0
    let pending = 0
    let visible = true
    let last = 0
    const loop = (now: number) => {
      const dt = last ? Math.min(1 / 20, (now - last) / 1000) : 1 / 60
      last = now
      step(dt)
      render()
      frame = requestAnimationFrame(loop)
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
    }
    function requestRender() {
      if (frame || pending) return
      pending = requestAnimationFrame(() => {
        pending = 0
        render()
      })
    }
    const sync = () => {
      const { paused: still, reducedMotion: calm } = live.current
      const run = !still && !calm && visible && !document.hidden
      if (run && !frame) frame = requestAnimationFrame(loop)
      else if (!run) {
        stop()
        requestRender()
      }
    }

    let primed = false
    const rebuild = () => {
      sizeAll()
      paintBackground()
      uploadBackground()
      if (!primed || live.current.reducedMotion) {
        primed = true
        prime(live.current.reducedMotion ? 16 : 9)
      }
      render()
    }

    readPalette()
    rebuild()
    ready = true
    setStatus('running')
    sync()

    api.current = {
      wipeStroke: (points, width) => {
        for (let i = 1; i < points.length; i++) {
          const [x0, y0] = points[i - 1]!
          const [x1, y1] = points[i]!
          wipeFog(x0, y0, x1, y1, width / 2)
        }
        requestRender()
      },
      clearAll: () => {
        if (!fogContext) return
        fogContext.fillStyle = 'black'
        fogContext.fillRect(0, 0, fogMap.width, fogMap.height)
        requestRender()
      },
      sync,
    }

    let resizeFrame = 0
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(rebuild)
    })
    resizeObserver.observe(root)

    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting)
            sync()
          })
    intersection?.observe(root)
    const onVisibility = () => sync()
    document.addEventListener('visibilitychange', onVisibility)

    const onTheme = () => {
      readPalette()
      paintBackground()
      uploadBackground()
      requestRender()
    }
    const offTheme = onThemeChange(onTheme)
    const offMode = onModeChange(onTheme)
    const themeObserver = new MutationObserver(onTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
    scheme?.addEventListener?.('change', onTheme)

    const onLost = (event: Event) => {
      event.preventDefault()
      stop()
      drawFallback()
      setStatus('unsupported')
    }
    canvas.addEventListener('webglcontextlost', onLost)

    return () => {
      stop()
      cancelAnimationFrame(pending)
      cancelAnimationFrame(resizeFrame)
      api.current = { wipeStroke: () => {}, clearAll: () => {}, sync: () => {} }
      resizeObserver.disconnect()
      intersection?.disconnect()
      themeObserver.disconnect()
      offTheme()
      offMode()
      scheme?.removeEventListener?.('change', onTheme)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onLost)
      if (image) image.onload = null
      for (const texture of textures) gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(pixel)
    }
  }, [background])

  // A finger on the glass: pointer drags wipe a soft stroke, except over the content's own controls.
  const finger = useRef<{ id: number; x: number; y: number } | null>(null)
  const pointAt = (event: ReactPointerEvent) => {
    const box = rootRef.current?.getBoundingClientRect()
    return box ? { x: event.clientX - box.left, y: event.clientY - box.top } : null
  }
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!wipe || (event.target as Element).closest('a, button, input, textarea, select, label, [contenteditable]')) return
    const point = pointAt(event)
    if (!point) return
    finger.current = { id: event.pointerId, ...point }
    api.current.wipeStroke([[point.x, point.y], [point.x, point.y + 0.1]], event.pointerType === 'touch' ? 44 : 36)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = finger.current
    if (!from || from.id !== event.pointerId) return
    const point = pointAt(event)
    if (!point) return
    api.current.wipeStroke([[from.x, from.y], [point.x, point.y]], event.pointerType === 'touch' ? 44 : 36)
    finger.current = { id: event.pointerId, ...point }
  }
  const onPointerEnd = () => {
    finger.current = null
  }

  const unsupported = status === 'unsupported'

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      className={cn('relative isolate overflow-hidden bg-surface-sunken', wipe && 'touch-none', className)}
    >
      <canvas
        ref={canvasRef}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cn('absolute inset-0 -z-10 block size-full', unsupported && 'invisible')}
      />
      <canvas
        ref={fallbackRef}
        aria-hidden="true"
        className={cn('absolute inset-0 -z-10 block size-full', !unsupported && 'hidden')}
      />
      {unsupported && (
        <>
          <p className="absolute bottom-2 left-2 z-10 rounded-[var(--radius-6)] bg-surface/85 px-2 py-1 text-[11px] font-medium text-ink-soft">
            Rain needs WebGL, which this browser has turned off. Showing the fogged glass instead.
          </p>
        </>
      )}
      {children}
    </div>
  )
})
