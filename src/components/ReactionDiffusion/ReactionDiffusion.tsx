'use client'

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useThemeVersion } from '../../lib/image-data'
import { usePrefersReducedMotion } from '../../lib/motion'
import {
  SIM_PRECISION,
  blit,
  createPair,
  createQuad,
  createSimContext,
  createSimLoop,
  createSimProgram,
  cssColourRgb,
  deletePair,
  type SimPair,
} from '../internal/gl-sim'

export type ReactionDiffusionPreset = 'coral' | 'mitosis' | 'fingerprints' | 'maze' | 'spots' | 'worms'
export type ReactionDiffusionStatus = 'starting' | 'running' | 'unsupported'

export interface ReactionDiffusionHandle {
  /** Clear the dish and seed it again — the text, or random drops. */
  reset: () => void
  /** Drop a blob of chemical B at a point (0–1, y down), or at random when no point is given. */
  seed: (x?: number, y?: number) => void
}

export interface ReactionDiffusionProps {
  /** Feed and kill rates known to grow a recognisable pattern. Changing it morphs smoothly to the new pair. */
  preset?: ReactionDiffusionPreset
  /** Feed rate of chemical A. Overrides the preset’s. Useful range 0.01–0.1. */
  feed?: number
  /** Kill rate of chemical B. Overrides the preset’s. Useful range 0.045–0.07. */
  kill?: number
  /** Simulation steps per frame. Higher grows faster and costs more. */
  speed?: number
  /** Text drawn into the seed in the theme font, so it grows into the pattern. Use `\n` for a second line. */
  seedText?: string
  /** With `seedText`, keep the pattern inside the letters so the words stay readable. */
  contain?: boolean
  /** Pseudo-3D lighting on the concentration field, 0–1. */
  emboss?: number
  /** Brush radius for painting chemical B, as a fraction of the shorter side. */
  brushSize?: number
  /** Freeze the simulation on its current frame. */
  paused?: boolean
  /** Describe the image for assistive tech. Without it the canvas is decorative and hidden. */
  label?: string
  /** Called when the simulation starts, or when it falls back. */
  onStatusChange?: (status: ReactionDiffusionStatus) => void
  /** Content drawn on top. */
  children?: ReactNode
  /** Merged last, so it wins. Give the component a size here. */
  className?: string
}

/** Feed and kill for each preset, from the Pearson and Karl Sims maps of the Gray–Scott parameter space. */
export const REACTION_DIFFUSION_PRESETS: Record<ReactionDiffusionPreset, { feed: number; kill: number }> = {
  coral: { feed: 0.0545, kill: 0.062 },
  mitosis: { feed: 0.0367, kill: 0.0649 },
  fingerprints: { feed: 0.037, kill: 0.06 },
  maze: { feed: 0.029, kill: 0.057 },
  spots: { feed: 0.03, kill: 0.062 },
  worms: { feed: 0.078, kill: 0.061 },
}

const HEAD = `${SIM_PRECISION}
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform vec2 uTexel;
`

// State texel: x = chemical A, y = chemical B, z = where the pattern may live (1 everywhere unless contained).
const SEED = `${HEAD}
uniform sampler2D uMask;
uniform float uContain;
uniform float uSalt;
float hash (vec2 p) { return fract(sin(dot(p + uSalt, vec2(127.1, 311.7))) * 43758.5453); }
void main () {
  float mask = texture2D(uMask, vUv).a;
  float b = mask * step(0.45, hash(floor(vUv / uTexel)));
  gl_FragColor = vec4(1.0 - b * 0.5, b * 0.9, mix(1.0, step(0.5, mask), uContain), 1.0);
}`

const STEP = `${HEAD}
uniform sampler2D uState;
uniform float uFeed;
uniform float uKill;
void main () {
  vec4 c = texture2D(uState, vUv);
  vec2 lap = -c.xy
    + 0.2 * (texture2D(uState, vL).xy + texture2D(uState, vR).xy + texture2D(uState, vT).xy + texture2D(uState, vB).xy)
    + 0.05 * (texture2D(uState, vec2(vL.x, vT.y)).xy + texture2D(uState, vec2(vR.x, vT.y)).xy
      + texture2D(uState, vec2(vL.x, vB.y)).xy + texture2D(uState, vec2(vR.x, vB.y)).xy);
  // Outside the region, B is killed faster than it can feed, so the pattern stops at the edge of the letters.
  float kill = uKill + (1.0 - c.z) * 0.014;
  float reaction = c.x * c.y * c.y;
  float a = c.x + lap.x - reaction + uFeed * (1.0 - c.x);
  float b = c.y + 0.5 * lap.y + reaction - (kill + uFeed) * c.y;
  gl_FragColor = vec4(clamp(a, 0.0, 1.0), clamp(b, 0.0, 1.0), c.z, 1.0);
}`

const PAINT = `${HEAD}
uniform sampler2D uState;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform float uRadius;
uniform float uAspect;
void main () {
  vec4 c = texture2D(uState, vUv);
  vec2 s = vec2(uAspect, 1.0);
  vec2 p = vUv * s - uFrom * s;
  vec2 d = (uTo - uFrom) * s;
  float along = clamp(dot(p, d) / max(dot(d, d), 0.000001), 0.0, 1.0);
  float distance = length(p - d * along);
  float brush = 1.0 - smoothstep(uRadius * 0.5, uRadius, distance);
  c.y = max(c.y, brush * 0.9);
  c.x = min(c.x, 1.0 - brush * 0.5);
  c.z = max(c.z, 1.0 - smoothstep(uRadius * 2.0, uRadius * 3.5, distance));
  gl_FragColor = c;
}`

const DISPLAY = `${HEAD}
uniform sampler2D uState;
uniform vec3 uSurface;
uniform vec3 uAccent;
uniform vec3 uInk;
uniform float uEmboss;
float sampleB (vec2 uv) {
#ifdef MANUAL_FILTERING
  vec2 st = uv / uTexel - 0.5;
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = texture2D(uState, (i + vec2(0.5, 0.5)) * uTexel).y;
  float b = texture2D(uState, (i + vec2(1.5, 0.5)) * uTexel).y;
  float c = texture2D(uState, (i + vec2(0.5, 1.5)) * uTexel).y;
  float d = texture2D(uState, (i + vec2(1.5, 1.5)) * uTexel).y;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
#else
  return texture2D(uState, uv).y;
#endif
}
void main () {
  float b = sampleB(vUv);
  float t = smoothstep(0.04, 0.42, b);
  vec3 colour = t < 0.5 ? mix(uSurface, uAccent, t * 2.0) : mix(uAccent, uInk, (t - 0.5) * 1.7);
  float dx = sampleB(vR) - sampleB(vL);
  float dy = sampleB(vT) - sampleB(vB);
  vec3 normal = normalize(vec3(-dx * 7.0, -dy * 7.0, 1.0));
  vec3 light = normalize(vec3(-0.55, 0.65, 0.9));
  float diffuse = dot(normal, light);
  float specular = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  colour *= mix(1.0, 0.72 + 0.34 * diffuse, uEmboss);
  colour += specular * uEmboss * 0.3 * smoothstep(0.02, 0.2, b);
  float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(colour + (noise - 0.5) / 255.0, 1.0);
}`

/**
 * Gray–Scott reaction–diffusion: two chemicals on a grid of float texels, one feeding and one consuming the other,
 * stepped several times a frame on the GPU until coral, fingerprints, mazes or dividing cells emerge.
 *
 * A headline can be the seed. `seedText` is drawn in the theme font into a mask, and with `contain` the kill rate
 * rises outside the letters, so the pattern grows inside the words and they stay legible instead of being overrun.
 * The pointer paints chemical B, and a painted stroke opens a little room around itself to grow into. Presets are
 * points on the feed/kill map; switching between them glides across the map rather than jumping, so one pattern
 * visibly turns into the next. Concentration is coloured on a ramp from the surface through the accent to ink, with
 * optional emboss lighting, and the ramp is re-read whenever the theme changes.
 *
 * Under reduced motion it grows the pattern off screen in chunks and shows the finished still. Without float-texture
 * WebGL, a static pattern drawn with an SVG filter stands in, with a note.
 */
export const ReactionDiffusion = forwardRef<ReactionDiffusionHandle, ReactionDiffusionProps>(function ReactionDiffusion(
  {
    preset = 'coral',
    feed,
    kill,
    speed = 12,
    seedText,
    contain = true,
    emboss = 0.6,
    brushSize = 0.03,
    paused = false,
    label,
    onStatusChange,
    children,
    className,
  },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const themeVersion = useThemeVersion()
  const [status, setStatus] = useState<ReactionDiffusionStatus>('starting')
  const filterId = `rd${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const target = REACTION_DIFFUSION_PRESETS[preset]
  const settings = useRef({ feed: 0, kill: 0, speed, emboss, brushSize, paused, reducedMotion })
  settings.current = {
    feed: feed ?? target.feed,
    kill: kill ?? target.kill,
    speed,
    emboss,
    brushSize,
    paused,
    reducedMotion,
  }
  const engine = useRef<{ reset: () => void; seed: ReactionDiffusionHandle['seed']; recolour: () => void; resume: () => void } | null>(null)
  const statusCallback = useRef(onStatusChange)
  statusCallback.current = onStatusChange

  useEffect(() => statusCallback.current?.(status), [status])

  useImperativeHandle(
    ref,
    () => ({ reset: () => engine.current?.reset(), seed: (x, y) => engine.current?.seed(x, y) }),
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return
    const sim = createSimContext(canvas, { full: true })
    if (!sim) {
      setStatus('unsupported')
      return
    }
    const { gl } = sim
    const manual = sim.linear ? '' : '#define MANUAL_FILTERING\n'
    let programs: { seed: ReturnType<typeof createSimProgram>; step: ReturnType<typeof createSimProgram>; paint: ReturnType<typeof createSimProgram>; display: ReturnType<typeof createSimProgram> }
    try {
      programs = {
        seed: createSimProgram(gl, SEED),
        step: createSimProgram(gl, STEP),
        paint: createSimProgram(gl, PAINT),
        display: createSimProgram(gl, manual + DISPLAY),
      }
    } catch {
      setStatus('unsupported')
      return
    }
    const disposeQuad = createQuad(gl)
    const maskTexture = gl.createTexture()
    let state: SimPair | null = null
    let aspect = 1
    let disposed = false
    let growing = 0
    const current = { feed: settings.current.feed, kill: settings.current.kill }

    const colours = { surface: [1, 1, 1], accent: [0.5, 0.5, 0.5], ink: [0, 0, 0] }
    const recolour = () => {
      colours.surface = cssColourRgb('var(--color-surface)', wrapper)
      colours.accent = cssColourRgb('var(--color-accent)', wrapper)
      colours.ink = cssColourRgb('var(--color-ink)', wrapper)
    }

    const texel = (program: typeof programs.step) => {
      program.use()
      gl.uniform2f(program.uniforms.uTexel!, 1 / state!.width, 1 / state!.height)
      return program.uniforms
    }

    // The seed mask is drawn on a 2D canvas: the text in the theme font, or a scatter of drops.
    const drawMask = () => {
      const mask = document.createElement('canvas')
      mask.width = state!.width
      mask.height = state!.height
      const context = mask.getContext('2d')!
      if (seedText) {
        const family = getComputedStyle(wrapper).getPropertyValue('--font-sans').trim() || getComputedStyle(wrapper).fontFamily
        const lines = seedText.split('\n')
        context.font = `800 100px ${family}`
        const widest = Math.max(...lines.map((line) => context.measureText(line).width), 1)
        const size = Math.min((mask.width * 0.86 * 100) / widest, (mask.height * 0.78) / (lines.length * 1.05))
        context.font = `800 ${size}px ${family}`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.lineJoin = 'round'
        context.lineWidth = size * 0.07
        lines.forEach((line, index) => {
          const y = mask.height / 2 + (index - (lines.length - 1) / 2) * size * 1.05
          context.fillText(line, mask.width / 2, y)
          context.strokeText(line, mask.width / 2, y)
        })
      } else {
        const count = Math.round((mask.width * mask.height) / 9000) + 6
        for (let index = 0; index < count; index++) {
          context.beginPath()
          context.arc(Math.random() * mask.width, Math.random() * mask.height, 3 + Math.random() * 7, 0, Math.PI * 2)
          context.fill()
        }
      }
      return mask
    }

    const reseed = () => {
      if (!state) return
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, maskTexture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, drawMask())
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      const u = texel(programs.seed)
      gl.uniform1i(u.uMask!, 0)
      gl.uniform1f(u.uContain!, seedText && contain ? 1 : 0)
      gl.uniform1f(u.uSalt!, Math.random() * 100)
      blit(gl, state.read)
    }

    const step = (count: number) => {
      if (!state) return
      const u = texel(programs.step)
      gl.uniform1f(u.uFeed!, current.feed)
      gl.uniform1f(u.uKill!, current.kill)
      for (let index = 0; index < count; index++) {
        gl.uniform1i(u.uState!, state.read.attach(0))
        blit(gl, state.write)
        state.swap()
      }
    }

    const paint = (from: readonly [number, number], to: readonly [number, number], scale = 1) => {
      if (!state) return
      const u = texel(programs.paint)
      gl.uniform2f(u.uFrom!, from[0], from[1])
      gl.uniform2f(u.uTo!, to[0], to[1])
      gl.uniform1f(u.uRadius!, settings.current.brushSize * scale * (aspect > 1 ? aspect : 1))
      gl.uniform1f(u.uAspect!, aspect)
      gl.uniform1i(u.uState!, state.read.attach(0))
      blit(gl, state.write)
      state.swap()
    }

    const render = () => {
      if (!state) return
      const u = texel(programs.display)
      gl.uniform3fv(u.uSurface!, colours.surface)
      gl.uniform3fv(u.uAccent!, colours.accent)
      gl.uniform3fv(u.uInk!, colours.ink)
      gl.uniform1f(u.uEmboss!, settings.current.emboss)
      gl.uniform1i(u.uState!, state.read.attach(0))
      blit(gl, null)
    }

    // Grow a still off screen, a chunk per frame so the page never freezes, then show it once.
    const grow = (steps: number) => {
      const run = ++growing
      let left = steps
      const chunk = () => {
        if (disposed || run !== growing) return
        step(Math.min(300, left))
        left -= 300
        if (left > 0) requestAnimationFrame(chunk)
        else {
          render()
          setStatus('running')
        }
      }
      chunk()
    }

    const frame = (dt: number) => {
      if (settings.current.paused) return
      const ease = 1 - Math.exp(-dt * 1.4)
      current.feed += (settings.current.feed - current.feed) * ease
      current.kill += (settings.current.kill - current.kill) * ease
      step(Math.max(1, Math.round(settings.current.speed)))
      render()
    }
    const loop = createSimLoop(canvas, frame)
    const resume = () => {
      if (settings.current.reducedMotion || settings.current.paused || !state) loop.stop()
      else loop.start()
    }

    const start = () => {
      if (disposed || !state) return
      reseed()
      if (settings.current.reducedMotion) {
        current.feed = settings.current.feed
        current.kill = settings.current.kill
        grow(seedText ? 5000 : 7000)
      } else {
        step(seedText ? 0 : 200)
        render()
        setStatus('running')
      }
      resume()
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * ratio))
      canvas.height = Math.max(1, Math.round(rect.height * ratio))
      aspect = canvas.width / canvas.height
      // One cell per two CSS pixels: patterns about 20px across, which reads at any size and keeps steps cheap.
      const scale = Math.min(0.5, 720 / Math.max(rect.width, rect.height, 1))
      const width = Math.max(16, Math.round(rect.width * scale))
      const height = Math.max(16, Math.round(rect.height * scale))
      if (state && state.width === width && state.height === height) return false
      if (state) deletePair(sim, state)
      state = createPair(sim, width, height, sim.rgba, sim.linear ? gl.LINEAR : gl.NEAREST)
      return true
    }

    recolour()
    resize()
    // The theme font may still be loading; seeding with a fallback face would bake the wrong letters in.
    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    void fontsReady.then(start)

    const uv = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height] as const
    }
    const strokes = new Map<number, readonly [number, number]>()
    const onDown = (event: PointerEvent) => {
      canvas.setPointerCapture?.(event.pointerId)
      const point = uv(event)
      strokes.set(event.pointerId, point)
      paint(point, point)
      if (settings.current.reducedMotion) grow(400)
      else if (settings.current.paused) render()
    }
    const onMove = (event: PointerEvent) => {
      const from = strokes.get(event.pointerId)
      if (!from || settings.current.reducedMotion) return
      const to = uv(event)
      paint(from, to)
      strokes.set(event.pointerId, to)
      if (settings.current.paused) render()
    }
    const onEnd = (event: PointerEvent) => strokes.delete(event.pointerId)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove, { passive: true })
    canvas.addEventListener('pointerup', onEnd)
    canvas.addEventListener('pointercancel', onEnd)

    const resizeObserver = new ResizeObserver(() => {
      if (resize()) start()
    })
    resizeObserver.observe(canvas)

    const onLost = (event: Event) => {
      event.preventDefault()
      loop.stop()
      setStatus('unsupported')
    }
    canvas.addEventListener('webglcontextlost', onLost)

    engine.current = {
      reset: () => start(),
      seed: (x, y) => {
        const point = [x ?? 0.15 + Math.random() * 0.7, 1 - (y ?? 0.15 + Math.random() * 0.7)] as const
        paint(point, point, 1.6)
        if (settings.current.reducedMotion) grow(600)
        else render()
      },
      recolour: () => {
        recolour()
        render()
      },
      resume,
    }

    return () => {
      disposed = true
      engine.current = null
      loop.dispose()
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onEnd)
      canvas.removeEventListener('pointercancel', onEnd)
      canvas.removeEventListener('webglcontextlost', onLost)
      if (state) deletePair(sim, state)
      gl.deleteTexture(maskTexture)
      for (const program of Object.values(programs)) gl.deleteProgram(program.program)
      disposeQuad()
    }
  }, [seedText, contain, reducedMotion])

  useEffect(() => engine.current?.recolour(), [themeVersion])
  useEffect(() => engine.current?.resume(), [paused, reducedMotion])

  const drawing = status === 'running'
  // Text grown into a pattern is still text: without a label, the seed words are the canvas’s name.
  const name = label ?? seedText?.split('\n').join(' ')

  return (
    <div ref={wrapperRef} className={cn('relative isolate overflow-hidden bg-surface', className)}>
      {!drawing && (
        // A still of the same family of pattern, drawn by an SVG noise filter, while starting or without WebGL.
        <svg aria-hidden="true" className="absolute inset-0 -z-10 size-full">
          <filter id={filterId} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves={2} seed={7} />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" />
            <feComponentTransfer result="bands">
              <feFuncA type="table" tableValues="0 0 1 0 0 1 0 0 1 0 0" />
            </feComponentTransfer>
            <feFlood style={{ floodColor: 'var(--color-accent)' }} />
            <feComposite operator="in" in2="bands" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity={status === 'unsupported' ? 0.85 : 0.25} />
        </svg>
      )}
      <canvas
        ref={canvasRef}
        role={name ? 'img' : undefined}
        aria-label={name}
        aria-hidden={name ? undefined : true}
        className={cn('absolute inset-0 -z-10 block size-full touch-none', !drawing && 'invisible')}
      />
      {status === 'unsupported' && (
        <p className="absolute bottom-2 right-3 z-10 text-[11px] font-medium text-ink-faint">
          Reaction–diffusion needs WebGL with float textures; showing a still pattern.
        </p>
      )}
      {children}
    </div>
  )
})
