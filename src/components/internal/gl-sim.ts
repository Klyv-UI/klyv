'use client'

/**
 * GPU feedback plumbing for simulations that live in textures — fluids, reaction–diffusion.
 *
 * A single-pass shader (ShaderCanvas) needs none of this. A simulation does: its state is a float texture it reads
 * and writes every step, so it needs a pair of render targets to ping-pong between, float or half-float formats the
 * device can actually render to, and a copy when the canvas resizes. The format probe is the part worth sharing:
 * WebGL2 needs EXT_color_buffer_float to render to any float target, WebGL1 needs OES_texture_half_float and, for
 * smooth sampling, its linear-filter extension — and a target that reports success but is not renderable only shows
 * up as a black canvas, so every format is tried on a real framebuffer first.
 */

export type SimGL = WebGLRenderingContext | WebGL2RenderingContext

export interface SimFormat {
  internal: number
  format: number
  type: number
}

export interface SimContext {
  gl: SimGL
  webgl2: boolean
  /** Four, two and one channel formats. On WebGL1 all three are RGBA. */
  rgba: SimFormat
  rg: SimFormat
  r: SimFormat
  /** Whether the float format can be sampled with LINEAR filtering. */
  linear: boolean
  /** 32-bit float rather than half float. */
  full: boolean
}

export interface SimTarget {
  texture: WebGLTexture
  fbo: WebGLFramebuffer
  width: number
  height: number
  /** Bind to a texture unit and return the unit, for `uniform1i`. */
  attach: (unit: number) => number
}

export interface SimPair {
  read: SimTarget
  write: SimTarget
  width: number
  height: number
  swap: () => void
}

export interface SimProgram {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation>
  use: () => void
}

const renderable = (gl: SimGL, f: SimFormat) => {
  const texture = gl.createTexture()
  const fbo = gl.createFramebuffer()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, 4, 4, 0, f.format, f.type, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.deleteFramebuffer(fbo)
  gl.deleteTexture(texture)
  return ok
}

/**
 * Get a context that can render to float textures, or null. `full` asks for 32-bit floats (reaction–diffusion
 * drifts in half float); it falls back to half float when the device cannot.
 */
export function createSimContext(canvas: HTMLCanvasElement, options: { full?: boolean } = {}): SimContext | null {
  const attributes: WebGLContextAttributes = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  }
  const gl2 = canvas.getContext('webgl2', attributes)
  if (gl2) {
    if (!gl2.getExtension('EXT_color_buffer_float')) gl2.getExtension('EXT_color_buffer_half_float')
    const tries = options.full ? [gl2.FLOAT, gl2.HALF_FLOAT] : [gl2.HALF_FLOAT, gl2.FLOAT]
    for (const type of tries) {
      const full = type === gl2.FLOAT
      const rgba = { internal: full ? gl2.RGBA32F : gl2.RGBA16F, format: gl2.RGBA, type }
      if (!renderable(gl2, rgba)) continue
      const rg = { internal: full ? gl2.RG32F : gl2.RG16F, format: gl2.RG, type }
      const r = { internal: full ? gl2.R32F : gl2.R16F, format: gl2.RED, type }
      const linear = !full || Boolean(gl2.getExtension('OES_texture_float_linear'))
      return {
        gl: gl2,
        webgl2: true,
        rgba,
        rg: renderable(gl2, rg) ? rg : rgba,
        r: renderable(gl2, r) ? r : rgba,
        linear,
        full,
      }
    }
    return null
  }

  const gl = (canvas.getContext('webgl', attributes) ??
    canvas.getContext('experimental-webgl', attributes)) as WebGLRenderingContext | null
  if (!gl) return null
  const float = gl.getExtension('OES_texture_float')
  const half = gl.getExtension('OES_texture_half_float')
  const candidates: [number, boolean, string][] = []
  if (options.full && float) candidates.push([gl.FLOAT, true, 'OES_texture_float_linear'])
  if (half) candidates.push([half.HALF_FLOAT_OES, false, 'OES_texture_half_float_linear'])
  if (!options.full && float) candidates.push([gl.FLOAT, true, 'OES_texture_float_linear'])
  for (const [type, full, linearName] of candidates) {
    const rgba = { internal: gl.RGBA, format: gl.RGBA, type }
    if (!renderable(gl, rgba)) continue
    return { gl, webgl2: false, rgba, rg: rgba, r: rgba, linear: Boolean(gl.getExtension(linearName)), full }
  }
  return null
}

export function createTarget(sim: SimContext, width: number, height: number, f: SimFormat, filter: number): SimTarget {
  const { gl } = sim
  const texture = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, width, height, 0, f.format, f.type, null)
  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  return {
    texture,
    fbo,
    width,
    height,
    attach: (unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      return unit
    },
  }
}

export function createPair(sim: SimContext, width: number, height: number, f: SimFormat, filter: number): SimPair {
  const pair: SimPair = {
    read: createTarget(sim, width, height, f, filter),
    write: createTarget(sim, width, height, f, filter),
    width,
    height,
    swap: () => {
      const read = pair.read
      pair.read = pair.write
      pair.write = read
    },
  }
  return pair
}

export function deleteTarget(sim: SimContext, target: SimTarget) {
  sim.gl.deleteTexture(target.texture)
  sim.gl.deleteFramebuffer(target.fbo)
}

export function deletePair(sim: SimContext, pair: SimPair) {
  deleteTarget(sim, pair.read)
  deleteTarget(sim, pair.write)
}

/** Fragment precision: high where the device has it, which simulation state needs. */
export const SIM_PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`

/**
 * The shared vertex shader: a full-screen quad with the UV and its four neighbours precomputed, which every stencil
 * pass (divergence, pressure, curl, Laplacian) needs and which is cheaper here than in each fragment.
 */
export const SIM_VERTEX = `
precision highp float;
attribute vec2 aPosition;
uniform vec2 uTexel;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

/** Compile and link, or throw with the driver’s log. Uniform locations are collected by name. */
export function createSimProgram(gl: SimGL, fragment: string, vertex = SIM_VERTEX): SimProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = (gl.getShaderInfoLog(shader) ?? '').replace(/[^\x20-\x7e\n]/g, '').trim()
      gl.deleteShader(shader)
      throw new Error(log || 'A shader did not compile.')
    }
    return shader
  }
  const program = gl.createProgram()!
  const vs = compile(gl.VERTEX_SHADER, vertex)
  const fs = compile(gl.FRAGMENT_SHADER, fragment)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.bindAttribLocation(program, 0, 'aPosition')
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program)?.trim() || 'A shader did not link.')
  }
  const uniforms: Record<string, WebGLUniformLocation> = {}
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
  for (let index = 0; index < count; index++) {
    const name = gl.getActiveUniform(program, index)!.name
    uniforms[name] = gl.getUniformLocation(program, name)!
  }
  return { program, uniforms, use: () => gl.useProgram(program) }
}

/** Bind the full-screen quad to attribute 0. Call once after the context is made. */
export function createQuad(gl: SimGL) {
  const vertices = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW)
  const indices = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(0)
  return () => {
    gl.deleteBuffer(vertices)
    gl.deleteBuffer(indices)
  }
}

/** Draw the quad into a target, or onto the canvas when the target is null. */
export function blit(gl: SimGL, target: SimTarget | null) {
  if (target) {
    gl.viewport(0, 0, target.width, target.height)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
  } else {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
}

/**
 * Resolve any CSS colour — a token, `var()`, `oklch()`, `color-mix()` — to 0–1 RGB, by letting the element compute it
 * and painting the result into one pixel. Resolving against the element keeps scoped themes working.
 */
export function cssColourRgb(value: string, host: HTMLElement): [number, number, number] {
  const previous = host.style.color
  host.style.color = value
  const computed = getComputedStyle(host).color
  host.style.color = previous
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const context = probe.getContext('2d', { willReadFrequently: true })
  if (!context) return [0.5, 0.5, 0.5]
  context.fillStyle = computed
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return [r! / 255, g! / 255, b! / 255]
}

/** Relative luminance, for telling a dark surface from a light one without asking which mode is set. */
export const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * A frame loop that only runs while the canvas is on screen and the tab is visible. `frame` gets the seconds since
 * the last frame, capped so a long pause does not arrive as one enormous step.
 */
export function createSimLoop(canvas: Element, frame: (dt: number) => void) {
  let handle = 0
  let last = 0
  let wanted = false
  let visible = true
  const tick = (now: number) => {
    const dt = last ? Math.min(1 / 30, (now - last) / 1000) : 1 / 60
    last = now
    frame(dt)
    handle = requestAnimationFrame(tick)
  }
  const sync = () => {
    cancelAnimationFrame(handle)
    handle = 0
    last = 0
    if (wanted && visible && !document.hidden) handle = requestAnimationFrame(tick)
  }
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          visible = Boolean(entry?.isIntersecting)
          sync()
        })
  observer?.observe(canvas)
  document.addEventListener('visibilitychange', sync)
  return {
    start: () => {
      wanted = true
      sync()
    },
    stop: () => {
      wanted = false
      sync()
    },
    dispose: () => {
      wanted = false
      sync()
      observer?.disconnect()
      document.removeEventListener('visibilitychange', sync)
    },
  }
}
