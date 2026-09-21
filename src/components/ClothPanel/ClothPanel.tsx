'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { onModeChange, onThemeChange } from '../../theme'
import { buildMesh, pullToRest, resetMesh, shadeMesh, stepMesh, type ClothMesh, type ClothPanelPins } from './cloth'

export type { ClothPanelPins } from './cloth'

export interface ClothPanelProps {
  /** The panel itself: real text, real buttons. It is what hangs. */
  children: ReactNode
  /** Where the cloth is held: the whole top edge, its two top corners, the left edge (a flag), or nowhere. */
  pins?: ClothPanelPins
  /** Points across. Kept under the clone budget of 140 triangles together with `rows`. */
  cols?: number
  /** Points down. */
  rows?: number
  /** Downward pull, in px per step². */
  gravity?: number
  /** Velocity kept each step. Lower is more damped. */
  damping?: number
  /** Constraint passes per step. More is stiffer and less stretchy. */
  iterations?: number
  /** Wind strength, 0 (still) to 1 (a gale). */
  wind?: number
  /** Direction the wind blows towards, in degrees: 0 is right, 90 is down. */
  windDirection?: number
  /** Blow in gusts with calm spells between them, rather than steadily. */
  gusts?: boolean
  /** Let links break when stretched past `tearLimit`. */
  tearable?: boolean
  /** Stretch ratio at which a link breaks. */
  tearLimit?: number
  /** Called with the running count of broken links whenever the cloth tears. */
  onTear?: (broken: number) => void
  /** Called with true when the clones take over, and false when the real content is back. */
  onMotionChange?: (moving: boolean) => void
  /** Drop the wind while a pointer is over the panel, so it settles and can be used. */
  calmOnHover?: boolean
  /** How strongly folds are shaded, 0 to 1. */
  shading?: number
  /** Extra room, in px, drawn around each edge so a shadow or border travels with the cloth. */
  bleed?: number
  /** Freeze the simulation where it is. */
  paused?: boolean
  /** Names the panel in the handle’s accessible label, as in “Shake the offer”. */
  label?: string
  /** Merged last onto the outer element, so it wins. */
  className?: string
}

export interface ClothPanelRef {
  /** Mend every tear and lay the cloth flat. */
  reset: () => void
  /** Throw a ripple through the cloth. */
  shake: () => void
  /** Stop the wind’s hold and let the cloth settle into the panel. */
  settle: () => void
}

const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role=button],[role=link],[contenteditable],[tabindex]'
const STEP = 1000 / 60

/** A colour token resolved to RGB by painting it, so any colour syntax the theme uses works. */
function resolveRgb(probe: HTMLElement, token: string, context: CanvasRenderingContext2D) {
  probe.style.color = `var(${token})`
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = getComputedStyle(probe).color
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return [r, g, b] as const
}

/**
 * A panel that hangs like fabric: the real card, with its real text and buttons,
 * pinned and moving in the wind.
 *
 * The cloth is a coarse Verlet mesh — about ten by seven points — and every
 * cell is drawn as two triangles. Each triangle is a clone of the content,
 * clipped to that triangle in the content’s own coordinates and moved by the 2D
 * affine map from its rest corners to its current ones. Triangles rather than
 * quads because an affine map is exact on three points and a quad needs four:
 * two neighbours agree exactly along the edge they share, so there are no
 * seams, where a per-quad transform tears at every corner.
 *
 * Clones are pictures, so they are inert and hidden from assistive technology.
 * The real content stays in the flow the whole time; while the cloth moves it
 * is transparent, and the moment the cloth comes to rest the clones go and the
 * real DOM is back — which is why the button in a hanging card still works.
 * Reaching for it (hovering, or focusing anything inside) calms the wind so
 * it settles on its own.
 */
export const ClothPanel = forwardRef<ClothPanelRef, ClothPanelProps>(function ClothPanel(
  {
    children,
    pins = 'top',
    cols = 10,
    rows = 7,
    gravity = 0.32,
    damping = 0.985,
    iterations = 8,
    wind = 0,
    windDirection = 0,
    gusts = true,
    tearable = false,
    tearLimit = 1.9,
    onTear,
    onMotionChange,
    calmOnHover = true,
    shading = 1,
    bleed = 24,
    paused = false,
    label = 'panel',
    className,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [moving, setMoving] = useState(false)
  const [torn, setTorn] = useState(false)
  const motionListener = useRef(onMotionChange)
  motionListener.current = onMotionChange
  useEffect(() => motionListener.current?.(moving), [moving])

  const live = useRef({ gravity, damping, iterations, wind, windDirection, gusts, tearable, tearLimit, onTear, calmOnHover, shading, bleed, paused })
  live.current = { gravity, damping, iterations, wind, windDirection, gusts, tearable, tearLimit, onTear, calmOnHover, shading, bleed, paused }
  const api = useRef<ClothPanelRef & { wake: () => void; nudge: (dx: number, dy: number) => void }>({
    reset: () => {},
    shake: () => {},
    settle: () => {},
    wake: () => {},
    nudge: () => {},
  })
  useImperativeHandle(ref, () => ({
    reset: () => api.current.reset(),
    shake: () => api.current.shake(),
    settle: () => api.current.settle(),
  }))

  useEffect(() => {
    const root = rootRef.current
    const content = contentRef.current
    const layer = layerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!root || !content || !layer || !canvas || !context || reducedMotion) return
    layer.setAttribute('inert', '')

    let mesh: ClothMesh = buildMesh(content.offsetWidth, content.offsetHeight, cols, rows, pins)
    let shade = new Float32Array(mesh.count)
    let sx = new Float32Array(mesh.count)
    let sy = new Float32Array(mesh.count)
    let pieces: HTMLDivElement[] = []
    let stale = true
    let phase: 'rest' | 'moving' | 'settling' | 'still' = 'rest'
    let frame = 0
    let last = 0
    let carry = 0
    let clock = 0
    let calmSteps = 0
    let settleSteps = 0
    let quietSteps = 0
    let hovering = false
    let focusedInside = false
    let letGo = false
    let visible = true
    let resized = false
    const grab = { index: -1, x: 0, y: 0, pointer: -1 }
    let offsetX = 0
    let offsetY = 0
    let dark: readonly number[] = [0, 0, 0]
    let light: readonly number[] = [255, 255, 255]
    let margin = 0
    let dpr = 1

    const probeCanvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    const refreshColours = () => {
      if (!probeCanvas) return
      const a = resolveRgb(root, '--color-ink', probeCanvas)
      const b = resolveRgb(root, '--color-ink-inverse', probeCanvas)
      root.style.color = ''
      const lum = (c: readonly number[]) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
      dark = lum(a) < lum(b) ? a : b
      light = lum(a) < lum(b) ? b : a
    }

    const sizeCanvas = () => {
      margin = Math.round(Math.max(mesh.width, mesh.height) * 0.3)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.style.left = `${-margin}px`
      canvas.style.top = `${-margin}px`
      canvas.style.width = `${mesh.width + margin * 2}px`
      canvas.style.height = `${mesh.height + margin * 2}px`
      canvas.width = Math.round((mesh.width + margin * 2) * dpr)
      canvas.height = Math.round((mesh.height + margin * 2) * dpr)
    }

    // One snapshot of the real DOM, cloned once per triangle. Ids and names are
    // stripped so a clone can never answer for the original — a cloned radio
    // with the same name would uncheck the real one.
    const buildPieces = () => {
      const template = content.cloneNode(true) as HTMLElement
      const realFields = content.querySelectorAll<HTMLInputElement>('input,textarea,select')
      template.querySelectorAll<HTMLInputElement>('input,textarea,select').forEach((field, index) => {
        const real = realFields[index]
        if (field instanceof HTMLTextAreaElement) field.textContent = real.value
        else if (field instanceof HTMLSelectElement) field.querySelectorAll('option')[(real as unknown as HTMLSelectElement).selectedIndex]?.setAttribute('selected', '')
        else {
          field.setAttribute('value', real.value)
          if (real.checked) field.setAttribute('checked', '')
          else field.removeAttribute('checked')
        }
      })
      template.querySelectorAll('[id],[name],[autofocus],[autoplay],[for]').forEach((node) => {
        for (const attribute of ['id', 'name', 'autofocus', 'autoplay', 'for']) node.removeAttribute(attribute)
      })
      template.removeAttribute('style')
      template.style.cssText = `width:${mesh.width}px;height:${mesh.height}px;margin:0`
      const realCanvases = content.querySelectorAll('canvas')

      const pad = live.current.bleed
      const fragment = document.createDocumentFragment()
      pieces = []
      for (let t = 0; t < mesh.triAlive.length; t += 1) {
        const piece = document.createElement('div')
        piece.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform'
        // Clip in rest coordinates: outer edges pushed out by the bleed so a
        // shadow travels too, and every corner nudged half a pixel away from
        // the centre so neighbours overlap instead of leaving an anti-aliased hairline.
        const corners: number[] = []
        let cx = 0
        let cy = 0
        for (let k = 0; k < 3; k += 1) {
          const p = mesh.tri[t * 3 + k]
          cx += mesh.rx[p] / 3
          cy += mesh.ry[p] / 3
        }
        for (let k = 0; k < 3; k += 1) {
          const p = mesh.tri[t * 3 + k]
          let u = mesh.rx[p]
          let v = mesh.ry[p]
          const d = Math.hypot(u - cx, v - cy) || 1
          u += ((u - cx) / d) * 0.5
          v += ((v - cy) / d) * 0.5
          if (mesh.rx[p] === 0) u -= pad
          if (mesh.rx[p] === mesh.width) u += pad
          if (mesh.ry[p] === 0) v -= pad
          if (mesh.ry[p] === mesh.height) v += pad
          corners.push(u, v)
        }
        piece.style.clipPath = `polygon(${corners[0]}px ${corners[1]}px, ${corners[2]}px ${corners[3]}px, ${corners[4]}px ${corners[5]}px)`
        const copy = t === 0 ? template : (template.cloneNode(true) as HTMLElement)
        copy.querySelectorAll('canvas').forEach((target, index) => {
          const source = realCanvases[index]
          if (!source || !source.width) return
          target.width = source.width
          target.height = source.height
          target.getContext('2d')?.drawImage(source, 0, 0)
        })
        piece.appendChild(copy)
        fragment.appendChild(piece)
        pieces.push(piece)
      }
      layer.replaceChildren(fragment)
      stale = false
    }

    const project = () => {
      // A gentle perspective, so cloth billowing towards you grows a little.
      const focal = Math.max(mesh.width, mesh.height) * 2.6
      const cx = mesh.width / 2
      const cy = mesh.height / 2
      for (let i = 0; i < mesh.count; i += 1) {
        const scale = focal / (focal - mesh.z[i])
        sx[i] = cx + (mesh.x[i] - cx) * scale
        sy[i] = cy + (mesh.y[i] - cy) * scale
      }
    }

    const colour = (value: number, strength: number) =>
      value < 0
        ? `rgba(${dark[0]},${dark[1]},${dark[2]},${Math.min(0.5, -value * 0.42 * strength)})`
        : `rgba(${light[0]},${light[1]},${light[2]},${Math.min(0.4, value * 0.3 * strength)})`

    const draw = () => {
      project()
      const { tri, rx, ry } = mesh
      for (let t = 0; t < pieces.length; t += 1) {
        const piece = pieces[t]
        if (!mesh.triAlive[t]) {
          if (piece.style.display !== 'none') piece.style.display = 'none'
          continue
        }
        if (piece.style.display === 'none') piece.style.display = ''
        const i = tri[t * 3]
        const j = tri[t * 3 + 1]
        const k = tri[t * 3 + 2]
        // The affine map taking the rest triangle (u, v) onto the screen (x, y).
        const du1 = rx[j] - rx[i]
        const dv1 = ry[j] - ry[i]
        const du2 = rx[k] - rx[i]
        const dv2 = ry[k] - ry[i]
        const det = du1 * dv2 - du2 * dv1
        const dx1 = sx[j] - sx[i]
        const dy1 = sy[j] - sy[i]
        const dx2 = sx[k] - sx[i]
        const dy2 = sy[k] - sy[i]
        const a = (dx1 * dv2 - dx2 * dv1) / det
        const c = (dx2 * du1 - dx1 * du2) / det
        const b = (dy1 * dv2 - dy2 * dv1) / det
        const d = (dy2 * du1 - dy1 * du2) / det
        const e = sx[i] - a * rx[i] - c * ry[i]
        const f = sy[i] - b * rx[i] - d * ry[i]
        piece.style.transform = `matrix(${a.toFixed(5)},${b.toFixed(5)},${c.toFixed(5)},${d.toFixed(5)},${e.toFixed(3)},${f.toFixed(3)})`
      }

      // Shading is linear across each triangle, and an affine map keeps it
      // linear, so one linear gradient per triangle reproduces smooth
      // per-vertex light exactly — no facets.
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      const strength = live.current.shading
      if (strength <= 0) return
      shadeMesh(mesh, shade)
      context.setTransform(dpr, 0, 0, dpr, margin * dpr, margin * dpr)
      for (let t = 0; t < mesh.triAlive.length; t += 1) {
        if (!mesh.triAlive[t]) continue
        const i = tri[t * 3]
        const j = tri[t * 3 + 1]
        const k = tri[t * 3 + 2]
        const s0 = shade[i]
        const s1 = shade[j]
        const s2 = shade[k]
        const low = Math.min(s0, s1, s2)
        const high = Math.max(s0, s1, s2)
        if (high - low < 0.01 && Math.abs(s0) < 0.02) continue
        const e1x = sx[j] - sx[i]
        const e1y = sy[j] - sy[i]
        const e2x = sx[k] - sx[i]
        const e2y = sy[k] - sy[i]
        const det = e1x * e2y - e2x * e1y
        const ds1 = s1 - s0
        const ds2 = s2 - s0
        const gx = Math.abs(det) > 0.01 ? (ds1 * e2y - ds2 * e1y) / det : 0
        const gy = Math.abs(det) > 0.01 ? (e1x * ds2 - e2x * ds1) / det : 0
        const g2 = gx * gx + gy * gy
        if (g2 < 1e-9 || high - low < 0.01) {
          context.fillStyle = colour((s0 + s1 + s2) / 3, strength)
        } else {
          const gradient = context.createLinearGradient(
            sx[i] + (gx * (low - s0)) / g2,
            sy[i] + (gy * (low - s0)) / g2,
            sx[i] + (gx * (high - s0)) / g2,
            sy[i] + (gy * (high - s0)) / g2,
          )
          gradient.addColorStop(0, colour(low, strength))
          if (low < 0 && high > 0) {
            const zero = -low / (high - low)
            gradient.addColorStop(zero, colour(-0.0001, 0))
            gradient.addColorStop(zero, colour(0, 0))
          }
          gradient.addColorStop(1, colour(high, strength))
          context.fillStyle = gradient
        }
        const cx = (sx[i] + sx[j] + sx[k]) / 3
        const cy = (sy[i] + sy[j] + sy[k]) / 3
        context.beginPath()
        for (const p of [i, j, k]) {
          const d = Math.hypot(sx[p] - cx, sy[p] - cy) || 1
          context.lineTo(sx[p] + ((sx[p] - cx) / d) * 0.5, sy[p] + ((sy[p] - cy) / d) * 0.5)
        }
        context.fill()
      }

      if (grab.index >= 0) {
        context.beginPath()
        context.arc(sx[grab.index], sy[grab.index], 7, 0, Math.PI * 2)
        context.fillStyle = `rgba(${light[0]},${light[1]},${light[2]},0.55)`
        context.fill()
        context.lineWidth = 2
        context.strokeStyle = `rgba(${dark[0]},${dark[1]},${dark[2]},0.55)`
        context.stroke()
      }
    }

    // Gusts: two slow sines, thresholded, so there are real calm spells in which
    // the cloth settles and the panel becomes usable.
    const gust = (time: number) => {
      if (!live.current.gusts) return 1
      const n = 0.5 + 0.5 * (0.62 * Math.sin(time * 0.52) + 0.38 * Math.sin(time * 0.91 + 1.7))
      const edge = Math.min(1, Math.max(0, (n - 0.38) / 0.4))
      return edge * edge * (3 - 2 * edge)
    }
    const windNow = (time: number) => {
      const { wind: strength, calmOnHover: calmable } = live.current
      if (strength <= 0 || letGo || (calmable && (hovering || focusedInside))) return 0
      return strength * gust(time)
    }

    const show = (cloth: boolean) => {
      content.style.opacity = cloth ? '0' : ''
      content.style.pointerEvents = cloth ? 'none' : ''
      layer.style.display = cloth ? '' : 'none'
      canvas.style.display = cloth ? '' : 'none'
    }

    const start = () => {
      if (frame || !visible || live.current.paused || phase === 'rest') return
      last = performance.now()
      carry = 0
      frame = requestAnimationFrame(tick)
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }

    // Rest → cloth. The clones are laid exactly over the real content before it
    // is hidden, in the same task, so the swap is invisible.
    const wake = () => {
      letGo = false
      calmSteps = 0
      quietSteps = 0
      if (phase === 'rest') {
        if (stale || pieces.length !== mesh.triAlive.length) buildPieces()
        draw()
        show(true)
        setMoving(true)
      }
      phase = 'moving'
      settleSteps = 0
      start()
    }

    // Cloth → rest: back to the real DOM, and no frames at all until something moves it.
    const rest = () => {
      resetMesh(mesh)
      show(false)
      stop()
      phase = 'rest'
      setMoving(false)
      if (resized) rebuild()
    }

    const rebuild = () => {
      resized = false
      const width = content.offsetWidth
      const height = content.offsetHeight
      if (!width || !height) return
      mesh = buildMesh(width, height, cols, rows, pins)
      shade = new Float32Array(mesh.count)
      sx = new Float32Array(mesh.count)
      sy = new Float32Array(mesh.count)
      stale = true
      sizeCanvas()
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      carry = Math.min(carry + (now - last), STEP * 4)
      last = now
      const settings = live.current
      const radians = (settings.windDirection * Math.PI) / 180
      let tore = 0
      while (carry >= STEP) {
        carry -= STEP
        clock += STEP / 1000
        const w = windNow(clock) * 0.9
        const flutter = 0.8 + 0.2 * Math.sin(clock * 3.1)
        const result = stepMesh(mesh, {
          gravity: settings.gravity,
          damping: settings.damping,
          iterations: settings.iterations,
          windX: Math.cos(radians) * w * flutter,
          windY: Math.sin(radians) * w * flutter,
          windZ: w * 1.3,
          time: clock,
          tearLimit: settings.tearable ? settings.tearLimit : 0,
          grab: grab.index,
          grabX: grab.x,
          grabY: grab.y,
          margin: Math.max(margin - 8, 0),
        })
        tore += result.tore
        const busy = grab.index >= 0 || w > 0.01
        calmSteps = busy ? 0 : calmSteps + 1
        quietSteps = result.fastest < 0.004 && !busy ? quietSteps + 1 : 0

        if (mesh.broken > 0) {
          // A torn cloth cannot become the panel again; it just comes to a stop.
          if (quietSteps > 45) phase = 'still'
        } else if (phase === 'moving' && (letGo || calmSteps > 80)) {
          phase = 'settling'
          settleSteps = 0
        } else if (phase === 'settling') {
          if (busy && !letGo) phase = 'moving'
          else {
            settleSteps += 1
            const far = pullToRest(mesh, Math.min(0.22, 0.012 + settleSteps * 0.0035))
            if (far < 0.35) {
              draw()
              rest()
              return
            }
          }
        }
      }
      if (tore) {
        setTorn(true)
        settings.onTear?.(mesh.broken)
      }
      draw()
      if (phase === 'still') stop()
    }

    const local = (event: PointerEvent) => {
      const box = root.getBoundingClientRect()
      return { x: event.clientX - box.left, y: event.clientY - box.top }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || live.current.paused) return
      const target = event.target as Element
      if (phase === 'rest' && target.closest(INTERACTIVE)) return
      if (!content.contains(target) && target !== root) return
      const point = local(event)
      project()
      let best = -1
      let bestDistance = (Math.max(mesh.width / (mesh.cols - 1), mesh.height / (mesh.rows - 1)) + 24) ** 2
      for (let i = 0; i < mesh.count; i += 1) {
        if (mesh.inv[i] === 0) continue
        const distance = (sx[i] - point.x) ** 2 + (sy[i] - point.y) ** 2
        if (distance < bestDistance) {
          bestDistance = distance
          best = i
        }
      }
      if (best < 0) return
      event.preventDefault()
      grab.index = best
      grab.pointer = event.pointerId
      // Hold the point where it was grabbed, offset by where the pointer landed.
      grab.x = mesh.x[best]
      grab.y = mesh.y[best]
      offsetX = point.x - sx[best]
      offsetY = point.y - sy[best]
      root.setPointerCapture(event.pointerId)
      root.dataset.grabbing = ''
      wake()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== grab.pointer) return
      const point = local(event)
      grab.x = point.x - offsetX
      grab.y = point.y - offsetY
    }
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== grab.pointer) return
      grab.index = -1
      grab.pointer = -1
      delete root.dataset.grabbing
      if (phase === 'still') {
        phase = 'moving'
        start()
      }
    }
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') hovering = true
    }
    const onLeave = () => {
      hovering = false
      if (live.current.wind > 0) wake()
    }
    const onFocusIn = (event: FocusEvent) => {
      if (!content.contains(event.target as Node)) return
      focusedInside = true
      // A keyboard user has arrived at the real content: bring it back now.
      if (phase === 'moving') letGo = true
    }
    const onFocusOut = (event: FocusEvent) => {
      if (content.contains(event.relatedTarget as Node | null)) return
      focusedInside = false
    }

    api.current.reset = () => {
      resetMesh(mesh)
      setTorn(false)
      live.current.onTear?.(0)
      if (phase !== 'rest') rest()
      if (live.current.wind > 0) wake()
    }
    api.current.shake = () => {
      wake()
      for (let r = 0; r < mesh.rows; r += 1) {
        for (let c = 0; c < mesh.cols; c += 1) {
          const i = r * mesh.cols + c
          if (mesh.inv[i] === 0) continue
          const reach = pins === 'left' ? c / (mesh.cols - 1) : r / (mesh.rows - 1)
          mesh.px[i] -= Math.sin(c * 0.9 + r * 0.4) * 5 * reach
          mesh.pz[i] -= Math.cos(c * 0.7 - r * 0.8) * 9 * reach
        }
      }
    }
    api.current.settle = () => {
      if (phase === 'rest') return
      if (mesh.broken > 0) return
      letGo = true
      phase = 'settling'
      start()
    }
    api.current.nudge = (dx: number, dy: number) => {
      wake()
      for (let i = 0; i < mesh.count; i += 1) {
        if (mesh.inv[i] === 0) continue
        const reach = pins === 'left' ? mesh.rx[i] / mesh.width : pins === 'none' ? 1 : mesh.ry[i] / mesh.height
        mesh.px[i] -= dx * reach
        mesh.py[i] -= dy * reach
      }
    }
    api.current.wake = wake

    refreshColours()
    sizeCanvas()
    show(false)

    const mutations = new MutationObserver(() => (stale = true))
    mutations.observe(content, { subtree: true, childList: true, attributes: true, characterData: true })
    const onInput = () => (stale = true)
    content.addEventListener('input', onInput)
    content.addEventListener('change', onInput)

    const sizes = new ResizeObserver(() => {
      if (content.offsetWidth === mesh.width && content.offsetHeight === mesh.height) return
      if (phase === 'rest') rebuild()
      else resized = true
    })
    sizes.observe(content)

    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting)
            if (visible) start()
            else stop()
          })
    intersection?.observe(root)
    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)

    // Watch the page's theme so shading stays dark-on-light and light-on-dark.
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', refreshColours)
    const offTheme = onThemeChange(refreshColours)
    const offMode = onModeChange(() => requestAnimationFrame(refreshColours))
    const themeWatch = new MutationObserver(refreshColours)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })

    // Wind at rest: check a few times a second for the next gust.
    const gustWatch = window.setInterval(() => {
      if (phase === 'rest' && visible && !document.hidden && !live.current.paused && windNow(clock) > 0.02) wake()
      if (phase === 'rest') clock += 0.25
    }, 250)

    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerup', onPointerUp)
    root.addEventListener('pointercancel', onPointerUp)
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)

    return () => {
      stop()
      window.clearInterval(gustWatch)
      mutations.disconnect()
      sizes.disconnect()
      intersection?.disconnect()
      themeWatch.disconnect()
      scheme.removeEventListener('change', refreshColours)
      offTheme()
      offMode()
      document.removeEventListener('visibilitychange', onVisibility)
      content.removeEventListener('input', onInput)
      content.removeEventListener('change', onInput)
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', onPointerUp)
      root.removeEventListener('pointercancel', onPointerUp)
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
      layer.replaceChildren()
      show(false)
      setMoving(false)
    }
  }, [reducedMotion, cols, rows, pins])

  // Paused → frozen where it is; unpaused → carry on.
  useEffect(() => {
    if (!paused && moving) api.current.wake()
  }, [paused, moving])

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-4, 0],
      ArrowRight: [4, 0],
      ArrowUp: [0, -4],
      ArrowDown: [0, 4],
    }
    const nudge = nudges[event.key]
    if (nudge) {
      event.preventDefault()
      api.current.nudge(...nudge)
    } else if (event.key === 'Escape' && moving) {
      event.preventDefault()
      api.current.settle()
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'group/cloth relative isolate touch-none select-none',
        !reducedMotion && 'cursor-grab data-[grabbing]:cursor-grabbing',
        className,
      )}
    >
      <div
        ref={contentRef}
        style={reducedMotion && pins === 'left' ? { transform: 'skewY(2deg)', transformOrigin: 'left top' } : undefined}
        className="relative select-text"
      >
        {children}
      </div>
      <div ref={layerRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-[1]" style={{ display: 'none' }} />
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute z-[2]" style={{ display: 'none' }} />

      {pins === 'top' && (
        <span aria-hidden="true" className="pointer-events-none absolute -left-3 -right-3 -top-1.5 z-[3] h-1.5 rounded-full bg-ink-soft shadow-[var(--shadow-float)]" />
      )}
      {pins === 'left' && (
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-2 -top-4 z-[3] w-1.5 rounded-full bg-ink-soft shadow-[var(--shadow-float)]" />
      )}
      {pins === 'corners' &&
        ['left-0', 'right-0'].map((side) => (
          <span
            key={side}
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute -top-1.5 z-[3] size-3 rounded-full bg-accent ring-2 ring-surface shadow-[var(--shadow-float)]',
              side === 'left-0' ? '-left-1.5' : '-right-1.5',
            )}
          />
        ))}

      {!reducedMotion && (
        <button
          type="button"
          onClick={() => (moving && !torn ? api.current.settle() : api.current.shake())}
          onKeyDown={onHandleKey}
          aria-label={`${moving && !torn ? 'Let go of' : 'Shake'} the ${label}`}
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Escape"
          title="Arrow keys nudge the cloth"
          className={cn(
            'absolute -top-9 right-0 z-[4] inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-2.5',
            'text-[11px] font-semibold text-ink-soft shadow-[var(--shadow-float)] transition-colors hover:text-ink',
          )}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3" fill="currentColor">
            {[2, 6, 10].map((cx) => [3.5, 8.5].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" />))}
          </svg>
          {moving && !torn ? 'Let go' : 'Shake'}
        </button>
      )}
    </div>
  )
})
