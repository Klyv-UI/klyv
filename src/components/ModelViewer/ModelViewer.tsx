'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { tokenRgb, useThemeVersion } from '../../lib/image-data'
import { Button } from '../Button'
import { Switch } from '../Switch'
import { modelViewerEdges, modelViewerParse, type ModelViewerMesh } from './mesh'

export interface ModelViewerProps {
  /** The model: an STL as bytes (binary or ASCII), or an OBJ as text or bytes. */
  data: ArrayBuffer | string
  /** Skip format detection. */
  format?: 'stl' | 'obj'
  /** Accessible name for the viewer. */
  label?: string
  /** Canvas height, in pixels. */
  height?: number
  /** Start in wireframe. */
  defaultWireframe?: boolean
  /** Draw the bounding box. */
  showBounds?: boolean
  /** Unit shown with the dimensions. */
  unit?: string
  /** Merged last, so it wins. */
  className?: string
}

type Quat = [number, number, number, number]
type Mat4 = Float32Array

/** A three-quarter view from above, which reads as 3D at once; straight-on hides depth. */
const HOME: Quat = [0.28, -0.35, -0.1, 0.89]

const normalise = (q: Quat): Quat => {
  const length = Math.hypot(...q) || 1
  return q.map((value) => value / length) as Quat
}
const multiply = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const axisAngle = (x: number, y: number, z: number, angle: number): Quat => {
  const s = Math.sin(angle / 2)
  return [x * s, y * s, z * s, Math.cos(angle / 2)]
}
/** Column-major rotation matrix from a unit quaternion. */
function rotation([x, y, z, w]: Quat): Mat4 {
  return new Float32Array([
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1,
  ])
}
function perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fov / 2)
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0])
}

/** A point on the virtual trackball under the pointer: on the sphere inside, on a hyperbolic sheet outside. */
function ballPoint(x: number, y: number): [number, number, number] {
  const d = x * x + y * y
  const z = d < 0.5 ? Math.sqrt(1 - d) : 0.5 / Math.sqrt(d)
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

const VERTEX = `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 rotation;
uniform mat4 projection;
uniform vec3 centre;
uniform float scale;
uniform float distance;
varying vec3 shade;
void main() {
  vec4 turned = rotation * vec4((position - centre) * scale, 1.0);
  shade = (rotation * vec4(normal, 0.0)).xyz;
  gl_Position = projection * vec4(turned.xy, turned.z - distance, 1.0);
}`
const FRAGMENT = `
precision mediump float;
uniform vec3 colour;
uniform float lit;
varying vec3 shade;
void main() {
  vec3 n = normalize(shade);
  if (!gl_FrontFacing) n = -n;
  float diffuse = max(dot(n, normalize(vec3(0.4, 0.7, 0.9))), 0.0);
  float rim = pow(1.0 - max(n.z, 0.0), 2.0) * 0.25;
  gl_FragColor = vec4(mix(colour, colour * (0.32 + 0.68 * diffuse) + rim, lit), 1.0);
}`

function compile(gl: WebGLRenderingContext) {
  const program = gl.createProgram()!
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  return program
}

const buffer = (gl: WebGLRenderingContext, data: Float32Array) => {
  const handle = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, handle)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  return handle
}

function boxLines({ min, max }: ModelViewerMesh): Float32Array {
  const corner = (i: number) => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]
  const pairs = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]
  return Float32Array.from(pairs.flatMap(corner))
}

const format = (value: number) => (Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2))

/**
 * A WebGL viewer for STL and OBJ models, with the parsers built in.
 *
 * The model is centred and scaled to fit, whatever units it was drawn in, so
 * a 2 mm bracket and a 2 m chassis open the same size; the true dimensions
 * are printed under it. Rotation is a quaternion arcball — drag and the model
 * turns as if the pointer were on a ball in front of it, with no gimbal lock
 * and no axis that stops working at the poles.
 *
 * The canvas is one tab stop: arrows rotate, plus and minus zoom, W toggles
 * the wireframe and 0 resets. Colours come from the theme tokens at draw
 * time, so the model follows the accent and dark mode. Nothing animates on
 * its own; frames are drawn only when something changes.
 */
export function ModelViewer({
  data,
  format: forced,
  label = '3D model',
  height = 360,
  defaultWireframe = false,
  showBounds = true,
  unit = 'mm',
  className,
}: ModelViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [orientation, setOrientation] = useState<Quat>(HOME)
  const [zoom, setZoom] = useState(1)
  const [wireframe, setWireframe] = useState(defaultWireframe)
  const [unsupported, setUnsupported] = useState(false)
  const [size, setSize] = useState(0)
  const drag = useRef<{ from: [number, number, number]; start: Quat } | null>(null)
  const gpu = useRef<{ gl: WebGLRenderingContext; program: WebGLProgram; mesh: ModelViewerMesh; tris: WebGLBuffer | null; normals: WebGLBuffer | null; wire: WebGLBuffer | null; wireCount: number; box: WebGLBuffer | null } | null>(null)
  const theme = useThemeVersion()

  const parsed = useMemo(() => {
    try {
      return { mesh: modelViewerParse(data, forced), error: '' }
    } catch (error) {
      return { mesh: null, error: (error as Error).message }
    }
  }, [data, forced])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const measure = () => setSize(canvas.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const mesh = parsed.mesh
    if (!canvas || !mesh) return
    const gl = canvas.getContext('webgl', { antialias: true })
    if (!gl) {
      setUnsupported(true)
      return
    }
    const program = compile(gl)
    const wire = modelViewerEdges(mesh)
    gpu.current = {
      gl,
      program,
      mesh,
      tris: buffer(gl, mesh.positions),
      normals: buffer(gl, mesh.normals),
      wire: buffer(gl, wire),
      wireCount: wire.length / 3,
      box: buffer(gl, boxLines(mesh)),
    }
    return () => {
      const current = gpu.current
      if (!current) return
      for (const handle of [current.tris, current.normals, current.wire, current.box]) gl.deleteBuffer(handle)
      gl.deleteProgram(program)
      gpu.current = null
    }
  }, [parsed])

  useEffect(() => {
    const state = gpu.current
    const canvas = canvasRef.current
    if (!state || !canvas || !size) return
    const { gl, program, mesh } = state
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(height * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)
    const rgb = (name: string, fallback: [number, number, number]) => tokenRgb(canvas, name, fallback).map((value) => value / 255)
    const [br, bg, bb] = rgb('--color-surface-sunken', [240, 240, 240])
    gl.clearColor(br, bg, bb, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.useProgram(program)

    const radius = Math.hypot(mesh.max[0] - mesh.min[0], mesh.max[1] - mesh.min[1], mesh.max[2] - mesh.min[2]) / 2 || 1
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'rotation'), false, rotation(orientation))
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projection'), false, perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 20))
    gl.uniform3fv(gl.getUniformLocation(program, 'centre'), mesh.min.map((value, axis) => (value + mesh.max[axis]) / 2))
    gl.uniform1f(gl.getUniformLocation(program, 'scale'), 1 / radius)
    gl.uniform1f(gl.getUniformLocation(program, 'distance'), 2.8 / zoom)

    const position = gl.getAttribLocation(program, 'position')
    const normal = gl.getAttribLocation(program, 'normal')
    const colour = gl.getUniformLocation(program, 'colour')
    const lit = gl.getUniformLocation(program, 'lit')
    const draw = (vertices: WebGLBuffer | null, mode: number, count: number, fill: number[], shaded: boolean) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0)
      if (shaded) {
        gl.bindBuffer(gl.ARRAY_BUFFER, state.normals)
        gl.enableVertexAttribArray(normal)
        gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 0, 0)
      } else {
        gl.disableVertexAttribArray(normal)
        gl.vertexAttrib3f(normal, 0, 0, 1)
      }
      gl.uniform3fv(colour, fill)
      gl.uniform1f(lit, shaded ? 1 : 0)
      gl.drawArrays(mode, 0, count)
    }
    if (!wireframe) draw(state.tris, gl.TRIANGLES, mesh.triangles * 3, rgb('--color-accent', [120, 200, 80]), true)
    else draw(state.wire, gl.LINES, state.wireCount, rgb('--color-ink-soft', [90, 90, 90]), false)
    if (showBounds) draw(state.box, gl.LINES, 24, rgb('--color-line-strong', [200, 200, 200]), false)
  }, [parsed, orientation, zoom, wireframe, showBounds, size, height, theme])

  // Wheel zoom needs a non-passive listener so the page does not scroll underneath.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setZoom((value) => Math.min(6, Math.max(0.4, value * Math.exp(-event.deltaY * 0.0015))))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const toBall = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const scale = Math.min(box.width, box.height) / 2
    return ballPoint((event.clientX - box.left - box.width / 2) / scale, -(event.clientY - box.top - box.height / 2) / scale)
  }
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current
    if (!state) return
    const [ax, ay, az] = state.from
    const [bx, by, bz] = toBall(event)
    // The rotation carrying one ball point to the other: axis from the cross product, angle from the dot.
    const axis: [number, number, number] = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
    const length = Math.hypot(...axis)
    if (length < 1e-6) return
    const angle = Math.acos(Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz)))
    setOrientation(normalise(multiply(axisAngle(axis[0] / length, axis[1] / length, axis[2] / length, angle * 1.4), state.start)))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const step = (event.shiftKey ? 45 : 10) * (Math.PI / 180)
    const turns: Record<string, Quat> = {
      ArrowLeft: axisAngle(0, 1, 0, -step),
      ArrowRight: axisAngle(0, 1, 0, step),
      ArrowUp: axisAngle(1, 0, 0, -step),
      ArrowDown: axisAngle(1, 0, 0, step),
    }
    if (turns[event.key]) setOrientation((current) => normalise(multiply(turns[event.key], current)))
    else if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(6, value * 1.2))
    else if (event.key === '-') setZoom((value) => Math.max(0.4, value / 1.2))
    else if (event.key === 'w' || event.key === 'W') setWireframe((value) => !value)
    else if (event.key === '0' || event.key === 'Home') {
      setOrientation(HOME)
      setZoom(1)
    } else return
    event.preventDefault()
  }

  const mesh = parsed.mesh
  const dimensions = mesh ? mesh.max.map((value, axis) => value - mesh.min[axis]) : null

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="relative overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken" style={{ height }}>
        <canvas
          ref={canvasRef}
          role="application"
          aria-roledescription="3D viewer"
          tabIndex={0}
          aria-label={`${label}${mesh ? `, ${mesh.triangles.toLocaleString()} triangles` : ''}. Drag or use arrows to rotate, plus and minus to zoom, W for wireframe, 0 to reset.`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { from: toBall(event), start: orientation }
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
          className="block size-full cursor-grab touch-none outline-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
        />
        {(unsupported || parsed.error) && (
          <p role="alert" className="absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-[13px] font-medium text-ink-soft">
            {parsed.error || 'This browser has no WebGL, so the model cannot be drawn here.'}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={wireframe} onChange={(event) => setWireframe(event.target.checked)} />
          Wireframe
        </label>
        <Button size="sm" variant="ghost" onClick={() => (setOrientation(HOME), setZoom(1))}>
          Reset view
        </Button>
        <dl className="m-0 ml-auto flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
          {[
            ['Triangles', mesh ? mesh.triangles.toLocaleString() : '—'],
            ['Size', dimensions ? `${dimensions.map(format).join(' × ')} ${unit}` : '—'],
            ['Format', mesh ? { 'stl-binary': 'Binary STL', 'stl-ascii': 'ASCII STL', obj: 'OBJ' }[mesh.format] : '—'],
          ].map(([term, detail]) => (
            <div key={term} className="flex items-baseline gap-1.5">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{term}</dt>
              <dd className="m-0 font-semibold text-ink tabular">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
