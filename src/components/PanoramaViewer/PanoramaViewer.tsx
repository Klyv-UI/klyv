'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import type { IconComponent } from '../../lib/types'
import { IconButton } from '../IconButton'
import { MinusIcon, PlusIcon } from '../internal/icons'

export interface PanoramaViewerProps {
  /** An equirectangular image: 360° across, 180° top to bottom, twice as wide as tall. */
  src: string
  /** What the scene is. Names the viewer and the flat fallback image. */
  alt: string
  /** Starting heading in degrees. 0 is the centre of the image; 90 is a quarter to the right. */
  initialYaw?: number
  /** Starting tilt in degrees, positive looking up. */
  initialPitch?: number
  /** Starting field of view in degrees. Smaller is more zoomed in. */
  initialFov?: number
  minFov?: number
  maxFov?: number
  /** Turn slowly on its own. `true` is 6°/s; a number is degrees per second. Never under reduced motion. */
  autoRotate?: boolean | number
  /** Viewer height in pixels. */
  height?: number
  /** Merged last, so it wins. */
  className?: string
}

const VERTEX = 'attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}'

/* Each pixel is a ray: build it from the field of view, turn it by pitch then
   yaw, and read the equirectangular image at that ray's longitude and latitude. */
const FRAGMENT = `precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform float yaw;
uniform float pitch;
uniform float tanHalf;
uniform float aspect;
const float PI = 3.141592653589793;
void main() {
  vec3 d = normalize(vec3(v.x * tanHalf * aspect, v.y * tanHalf, -1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x * cy - d.z * sy, d.y, d.x * sy + d.z * cy);
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  gl_FragColor = texture2D(tex, vec2(fract(lon / (2.0 * PI) + 0.5), 0.5 - lat / PI));
}`

const ResetIcon: IconComponent = ({ size = 16 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8a5 5 0 105-5H5.5M5.5 1v2.5H8" />
  </svg>
)
const RotateIcon: IconComponent = ({ size = 16 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <ellipse cx="8" cy="8" rx="6" ry="2.75" />
    <path d="M11.5 3.5l2.5 2-2.9 1.3" strokeLinejoin="round" />
  </svg>
)

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
const rad = (degrees: number) => (degrees * Math.PI) / 180
const heading = (yaw: number) => ((Math.round(yaw) % 360) + 360) % 360

/**
 * A 360° photo you can look around in, rendered as a real perspective view.
 *
 * Panning a flat equirectangular image sideways is the common shortcut, and it
 * is wrong everywhere but the horizon: straight lines bow, and looking up
 * shows a stretched smear instead of the sky. Here a fragment shader casts a
 * ray for every pixel and samples the image at that ray's longitude and
 * latitude, so the view is a true projection at any tilt, with no geometry to
 * build and no seam at the back.
 *
 * Drag, or pinch, with a pointer; arrow keys look around and plus and minus
 * zoom when it has focus. Auto-rotation stops the moment someone takes over,
 * and never runs under reduced motion. Without WebGL the flat image is shown
 * instead, scrollable, with a line saying why.
 */
export function PanoramaViewer({
  src,
  alt,
  initialYaw = 0,
  initialPitch = 0,
  initialFov = 75,
  minFov = 30,
  maxFov = 100,
  autoRotate = false,
  height = 360,
  className,
}: PanoramaViewerProps) {
  const reduced = usePrefersReducedMotion()
  const canvas = useRef<HTMLCanvasElement>(null)
  const view = useRef({ yaw: rad(initialYaw), pitch: rad(initialPitch), fov: initialFov })
  const draw = useRef<() => void>(() => {})
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [mode, setMode] = useState<'loading' | 'ready' | 'nogl' | 'error'>('loading')
  const [rotating, setRotating] = useState(Boolean(autoRotate))
  const [facing, setFacing] = useState(heading(initialYaw))
  const [announcement, setAnnouncement] = useState('')
  const hintId = useId()

  const describe = () => {
    const degrees = heading((view.current.yaw * 180) / Math.PI)
    return `Facing ${POINTS[Math.round(degrees / 45) % 8]}, ${degrees}°`
  }

  const look = (dYaw: number, dPitch: number, zoom = 1) => {
    const current = view.current
    current.yaw += dYaw
    current.pitch = Math.max(-rad(85), Math.min(rad(85), current.pitch + dPitch))
    current.fov = Math.max(minFov, Math.min(maxFov, current.fov * zoom))
    setFacing(heading((current.yaw * 180) / Math.PI))
    draw.current()
  }

  useEffect(() => {
    const node = canvas.current
    const gl = node?.getContext('webgl', { antialias: false, preserveDrawingBuffer: false }) ?? null
    if (!node || !gl) return setMode('nogl')

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return shader
    }
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return setMode('nogl')
    gl.useProgram(program)

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const uniform = (name: string) => gl.getUniformLocation(program, name)
    const [uYaw, uPitch, uTan, uAspect] = ['yaw', 'pitch', 'tanHalf', 'aspect'].map(uniform)

    // Non-power-of-two textures are allowed in WebGL 1 only without mipmaps and repeat.
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    let loaded = false
    draw.current = () => {
      if (!loaded) return
      const { yaw, pitch, fov } = view.current
      gl.viewport(0, 0, node.width, node.height)
      gl.uniform1f(uYaw, yaw)
      gl.uniform1f(uPitch, pitch)
      gl.uniform1f(uTan, Math.tan(rad(fov) / 2))
      gl.uniform1f(uAspect, node.width / Math.max(1, node.height))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      node.width = Math.round(node.clientWidth * scale)
      node.height = Math.round(node.clientHeight * scale)
      draw.current()
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(node)

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      let pixels: TexImageSource = image
      if (image.naturalWidth > max) {
        // Phone panoramas are often wider than the GPU allows; shrink to fit.
        const shrink = document.createElement('canvas')
        shrink.width = max
        shrink.height = Math.round((image.naturalHeight * max) / image.naturalWidth)
        shrink.getContext('2d')?.drawImage(image, 0, 0, shrink.width, shrink.height)
        pixels = shrink
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      loaded = true
      setMode('ready')
      draw.current()
    }
    image.onerror = () => setMode('error')
    image.src = src

    return () => {
      observer?.disconnect()
      image.onload = null
      draw.current = () => {}
      gl.deleteTexture(texture)
      gl.deleteProgram(program)
    }
  }, [src])

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const node = canvas.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      look(0, 0, Math.exp(event.deltaY * 0.0012))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minFov, maxFov])

  const spin = rotating && !reduced && mode === 'ready'
  useEffect(() => {
    if (!spin) return
    const speed = rad(typeof autoRotate === 'number' ? autoRotate : 6)
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      look(((now - last) / 1000) * speed, 0)
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin, autoRotate])

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    setRotating(false)
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId)
    if (others.length === 1) {
      // Pinch: the change in finger spread is the change in field of view.
      const [, other] = others[0]
      const before = Math.hypot(previous.x - other.x, previous.y - other.y)
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y)
      if (before > 0 && after > 0) look(0, 0, before / after)
    } else {
      // Grab-and-drag: one screen pixel turns the view by one pixel's worth of angle.
      const perPixel = rad(view.current.fov) / event.currentTarget.clientHeight
      look(-(event.clientX - previous.x) * perPixel, (event.clientY - previous.y) * perPixel)
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }
  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId)
    if (!pointers.current.size) setAnnouncement(describe())
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const step = rad(event.shiftKey ? 15 : 5)
    const moves: Record<string, [number, number, number]> = {
      ArrowLeft: [-step, 0, 1],
      ArrowRight: [step, 0, 1],
      ArrowUp: [0, step, 1],
      ArrowDown: [0, -step, 1],
      '+': [0, 0, 0.85],
      '=': [0, 0, 0.85],
      '-': [0, 0, 1 / 0.85],
    }
    if (event.key === 'Home') {
      view.current = { yaw: rad(initialYaw), pitch: rad(initialPitch), fov: initialFov }
      look(0, 0)
    } else if (event.key in moves) look(...moves[event.key])
    else return
    event.preventDefault()
    setRotating(false)
    setAnnouncement(describe())
  }

  if (mode === 'nogl' || mode === 'error') {
    return (
      <figure className={cn('flex w-full flex-col gap-2', className)}>
        <div className="w-full overflow-x-auto rounded-[var(--radius-card)] border border-line" style={{ height }}>
          {/* The flat image is the next best thing: every direction, side by side. */}
          <img src={src} alt={alt} className="h-full max-w-none" />
        </div>
        <figcaption className="text-[12px] font-medium text-ink-faint">
          {mode === 'nogl' ? 'The 360° view needs WebGL, which is off or missing here. Showing the flat panorama.' : 'The panorama could not be loaded.'}
        </figcaption>
      </figure>
    )
  }

  return (
    <div className={cn('relative w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-sunken', className)} style={{ height }}>
      <canvas
        ref={canvas}
        tabIndex={0}
        role="application"
        aria-roledescription="360° panorama"
        aria-label={alt}
        aria-describedby={hintId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="block size-full cursor-grab touch-none outline-offset-[-3px] active:cursor-grabbing"
      />
      <p id={hintId} className="sr-only">
        Drag or use the arrow keys to look around. Plus and minus zoom; Home resets the view.
      </p>
      <div role="status" className="sr-only">
        {announcement}
      </div>
      {mode === 'loading' && <p className="absolute inset-0 grid place-items-center text-[12px] font-semibold text-ink-soft">Loading panorama…</p>}
      <span aria-hidden="true" className="absolute left-3 top-3 rounded-full bg-shell px-2.5 py-1 text-[11px] font-bold tabular-nums text-ink shadow-[var(--shadow-float)]">
        {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(facing / 45) % 8]} {facing}°
      </span>
      <div className="absolute bottom-3 right-3 flex gap-1.5">
        <IconButton icon={PlusIcon} tone="white" size="sm" label="Zoom in" onClick={() => look(0, 0, 0.8)} />
        <IconButton icon={MinusIcon} tone="white" size="sm" label="Zoom out" onClick={() => look(0, 0, 1.25)} />
        <IconButton
          icon={ResetIcon}
          tone="white"
          size="sm"
          label="Reset view"
          onClick={() => {
            view.current = { yaw: rad(initialYaw), pitch: rad(initialPitch), fov: initialFov }
            look(0, 0)
          }}
        />
        {!reduced && <IconButton icon={RotateIcon} tone="white" size="sm" label="Auto-rotate" selected={rotating} aria-pressed={rotating} onClick={() => setRotating(!rotating)} />}
      </div>
    </div>
  )
}
