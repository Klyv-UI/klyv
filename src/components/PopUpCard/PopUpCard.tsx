'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { useInView, usePrefersReducedMotion } from '../../lib/motion'

export interface PopUpCardPiece {
  /** Stable key. */
  id: string
  /**
   * `parallel`: a panel that stays parallel to the back page and rises off the base — a parallelogram linkage.
   * `v`: a piece folded down its spine and glued across the gutter, whose pose is solved from the opening angle.
   */
  kind: 'parallel' | 'v'
  /** Centre of the piece along the fold, in px from the middle of the card. */
  x?: number
  /** Width of the panel. For a V-fold, the flat width of both halves together. */
  width: number
  /** Parallel: how far up the back page the piece is glued. V-fold: the length of its spine. */
  height: number
  /** Parallel only: how far from the fold the panel stands on the base page. Keep `height + depth` under the page depth, or it pokes out when shut. */
  depth?: number
  /** Parallel only: draw the roof that ties the panel to the back page. Turn it off for a hidden support, as for a candle. */
  roof?: boolean
  /** V-fold only: angle in degrees between the gutter and each glue line. */
  glue?: number
  /** V-fold only: angle in degrees between the spine and each glue line on the flat piece. Must exceed `glue`, or it never stands. */
  spine?: number
  /** V-fold only: glue the V to the other side of its spine. */
  flip?: boolean
  /** 0 to 0.9 — how late in the opening this piece lifts. Past 90° every piece is exactly where its linkage puts it. */
  delay?: number
  /** Paper colour, any CSS colour. Defaults to the surface token. */
  paper?: string
  /** What is printed on the panel. */
  children?: ReactNode
  /** What the piece shows, for assistive technology — the paper itself is hidden from it. */
  label?: string
}

export interface PopUpCardProps {
  /** The pop-up pieces, drawn in order. */
  pieces: PopUpCardPiece[]
  /** Accessible name of the card. */
  label: string
  /** Opening angle in degrees, 0 (shut) to 180 (flat). Omit for uncontrolled. */
  angle?: number
  /** Starting angle when uncontrolled. */
  defaultAngle?: number
  onAngleChange?: (angle: number) => void
  /** Angle a click or Enter opens to. 90 stands parallel folds straight up. */
  openAngle?: number
  /** Open by itself the first time it scrolls into view. */
  openOnView?: boolean
  /** Width of the card along its fold, px. */
  width?: number
  /** Depth of each page from the fold, px. */
  depth?: number
  /** Camera elevation in degrees. */
  pitch?: number
  /** Camera turn in degrees. Drag sideways to look around it. */
  yaw?: number
  /** Printed on the outside, seen while the card is shut. */
  cover?: ReactNode
  /** Printed on the inside of the back page. */
  inside?: ReactNode
  /** Printed on the base page, under the pieces. */
  base?: ReactNode
  /** Paper of the pages. */
  paper?: string
  /** Paper of the cover. */
  coverPaper?: string
  /** Merged last, so it wins. */
  className?: string
}

type Vec = [number, number, number]
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: Vec): Vec => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const RAD = Math.PI / 180
const X: Vec = [1, 0, 0]
const LIGHT = unit([-0.4, 0.75, 0.7])
const r4 = (n: number) => Math.round(n * 1e4) / 1e4

interface Face {
  key: string
  transform: string
  w: number
  h: number
  paper: string
  shade: number
  hidden?: boolean
  /** Visible outline in the face's own px, for V-fold halves. */
  clip?: [number, number][]
  art?: ReactNode
  artLeft?: number
  artWidth?: number
}

/**
 * A folded card that opens like a pop-up book.
 *
 * Every panel is placed by real fold geometry, not by a tween per piece. A
 * parallel fold is a parallelogram: glued `height` up the back page and
 * `depth` out on the base, its panel stays parallel to the back page and its
 * roof parallel to the base, whatever the angle. A V-fold is a spherical
 * linkage — two glue lines at `glue` degrees from the gutter and a spine
 * `spine` degrees from each — and its spine direction has a closed-form
 * solution, so it is computed, not approximated. Lighting and the soft shadow
 * on the base come from the same normals, which is why the paper reads as
 * paper while it moves.
 *
 * Pieces may lag the opening (`delay`) so they lift one after another, but only
 * below 90°: from there every piece sits exactly where the linkage puts it.
 */
export function PopUpCard({
  pieces,
  label,
  angle,
  defaultAngle = 0,
  onAngleChange,
  openAngle = 100,
  openOnView = false,
  width = 460,
  depth = 250,
  pitch = 24,
  yaw = -14,
  cover,
  inside,
  base,
  paper = 'var(--color-surface)',
  coverPaper = 'var(--color-accent)',
  className,
}: PopUpCardProps) {
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>(0.4)
  const filterId = useId().replace(/:/g, '')
  const [inner, setInner] = useState(defaultAngle)
  const target = clamp(angle ?? inner, 0, 180)
  const [shown, setShown] = useState(target)
  const [turn, setTurn] = useState(0)
  const [fit, setFit] = useState(1)
  const shownRef = useRef(shown)
  const drag = useRef<{ x: number; y: number; angle: number; turn: number; moved: boolean } | null>(null)

  const commit = (next: number) => {
    const value = Math.round(clamp(next, 0, 180) * 10) / 10
    if (angle === undefined) setInner(value)
    onAngleChange?.(value)
  }

  // A tween rather than a spring: paper opening has no overshoot.
  useEffect(() => {
    if (reduced || drag.current?.moved) {
      shownRef.current = target
      setShown(target)
      return
    }
    const from = shownRef.current
    const span = Math.abs(target - from)
    if (span < 0.01) return
    const duration = 380 + span * 9
    let start = 0
    let raf = requestAnimationFrame(function step(now) {
      start ||= now
      const p = Math.min(1, (now - start) / duration)
      const eased = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2
      shownRef.current = from + (target - from) * eased
      setShown(shownRef.current)
      if (p < 1) raf = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])

  const opened = useRef(false)
  useEffect(() => {
    if (!openOnView || !inView || opened.current) return
    opened.current = true
    commit(openAngle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnView, inView])

  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setFit(Math.min(1, entry.contentRect.width / (width * 1.18))))
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, width])

  /* ------------------------------------------------------------ geometry */
  const theta = Math.max(0.6, shown) * RAD
  const cp = Math.cos(pitch * RAD)
  const sp = Math.sin(pitch * RAD)
  const cyw = Math.cos((yaw + turn) * RAD)
  const syw = Math.sin((yaw + turn) * RAD)
  const pivot: Vec = [0, depth * 0.22, depth * 0.3]
  const view = (v: Vec): Vec => {
    const x = v[0] * cyw + v[2] * syw
    const z = -v[0] * syw + v[2] * cyw
    return [x, v[1] * cp - z * sp, v[1] * sp + z * cp]
  }
  const toCss = (v: Vec): Vec => [v[0], -v[1], v[2]]
  const W = width
  const D = depth
  const lift = (pieces.length + 2) * 0.5
  const hinge: Vec = [0, lift * (1 - shown / 180), 0]
  const uB: Vec = [0, 0, 1]
  const uT = (t: number): Vec => [0, Math.sin(t), Math.cos(t)]

  const faces: Face[] = []
  const shadows: Vec[][] = []

  const place = (o: Vec, ex: Vec, ey: Vec) => {
    const a = toCss(view(ex))
    const b = toCss(view(ey))
    const n = cross(a, b)
    const p = toCss(view(add(o, mul(pivot, -1))))
    return `matrix3d(${[...a, 0, ...b, 0, ...n, 0, ...p, 1].map(r4).join(',')})`
  }
  // Two-sided paper: light the side that faces the camera.
  const shadeOf = (ex: Vec, ey: Vec) => {
    let n = unit(mul(cross(ex, ey), -1))
    if (view(n)[2] < 0) n = mul(n, -1)
    return clamp((1 - Math.max(0, dot(n, LIGHT))) * 0.4, 0, 0.4)
  }
  const face = (key: string, o: Vec, ex: Vec, ey: Vec, w: number, h: number, colour: string, extra: Partial<Face> = {}) =>
    faces.push({ key, transform: place(o, ex, ey), w, h, paper: colour, shade: shadeOf(ex, ey), ...extra })
  // A printed face and the plain back of the same sheet, a hair behind it so the edge shows as thickness.
  const sheet = (key: string, o: Vec, ex: Vec, ey: Vec, w: number, h: number, colour: string, extra: Partial<Face>) => {
    face(`${key}-front`, o, ex, ey, w, h, colour, { hidden: true, ...extra })
    const behind = mul(unit(cross(ex, ey)), 1.4)
    face(`${key}-back`, add(add(o, mul(ex, w)), behind), mul(ex, -1), ey, w, h, `color-mix(in oklab, ${colour} 84%, black)`, {
      hidden: true,
      clip: extra.clip?.map(([x, y]) => [w - x, y]),
    })
  }
  const floor = (p: Vec): Vec => add(p, mul(LIGHT, -p[1] / LIGHT[1]))

  // Pages. The base lies still; the back page swings about the hinge.
  face('base', [-W / 2, 0, 0], X, uB, W, D, paper, { art: base })
  const top = uT(theta)
  face('base-edge', [-W / 2, 0, D], X, [0, -1, 0], W, 2.5, `color-mix(in oklab, ${paper} 78%, black)`)
  // The back page is card stock: the cover sits its thickness behind the inside.
  const behind = mul(cross(X, top), -2.5)
  face('inside', add(add(hinge, [-W / 2, 0, 0]), mul(top, D)), X, mul(top, -1), W, D, paper, { hidden: true, art: inside })
  face('cover', add(add(hinge, [-W / 2, 0, 0]), behind), X, top, W, D, coverPaper, { hidden: true, art: cover })
  face('edge', add(add(hinge, [-W / 2, 0, 0]), mul(top, D)), X, unit(behind), W, 2.5, `color-mix(in oklab, ${paper} 78%, black)`)
  shadows.push([
    add(hinge, [-W / 2, 0, 0]),
    add(hinge, [W / 2, 0, 0]),
    floor(add(add(hinge, [W / 2, 0, 0]), mul(top, D))),
    floor(add(add(hinge, [-W / 2, 0, 0]), mul(top, D))),
  ])

  pieces.forEach((piece, index) => {
    const delay = clamp(piece.delay ?? 0, 0, 0.9)
    const start = delay * 80
    const own = shown >= 90 ? shown : shown <= start ? 0 : ((shown - start) / (90 - start)) * 90
    const t = Math.max(0.6, own) * RAD
    const up: Vec = [0, (index + 1) * 0.5, 0]
    const colour = piece.paper ?? paper
    const cx = piece.x ?? 0

    if (piece.kind === 'parallel') {
      const a = piece.height
      const b = piece.depth ?? Math.min(D - a, a)
      const x0: Vec = [cx - piece.width / 2, 0, 0]
      const x1: Vec = [cx + piece.width / 2, 0, 0]
      const A = add(add(hinge, up), mul(uT(t), a))
      const P = add(A, mul(uB, b))
      const Bp = add(up, mul(uB, b))
      sheet(piece.id, add(P, x0), X, mul(uT(t), -1), piece.width, a, colour, { art: piece.children })
      shadows.push([add(Bp, x0), add(Bp, x1), floor(add(P, x1)), floor(add(P, x0))])
      if (piece.roof === false) return
      face(`${piece.id}-roof`, add(A, x0), X, uB, piece.width, b, colour)
      shadows.push([floor(add(A, x0)), floor(add(A, x1)), floor(add(P, x1)), floor(add(P, x0))])
      return
    }

    // V-fold. Glue lines d on each page at `glue` from the gutter; the spine c
    // lies in the plane bisecting the pages and makes `spine` with both, so
    // c·d = cos(spine). With c = p·x + q·m that is p·cosα + q·sinα·cos(θ/2) = cosβ.
    const sx = piece.flip ? -1 : 1
    const alpha = clamp(piece.glue ?? 50, 5, 85) * RAD
    const beta = clamp(piece.spine ?? 70, (piece.glue ?? 50) + 5, 175) * RAD
    const m: Vec = [0, Math.sin(t / 2), Math.cos(t / 2)]
    const k1 = Math.cos(alpha)
    const k2 = Math.sin(alpha) * Math.cos(t / 2)
    const psi = Math.atan2(k2, k1) + Math.acos(clamp(Math.cos(beta) / Math.hypot(k1, k2), -1, 1))
    const c = unit(add(mul(X, sx * Math.cos(psi)), mul(m, Math.sin(psi))))
    const origin = add(add(hinge, up), [cx, 0, 0])
    const hw = piece.width / 2
    const h = piece.height
    const glueDir = [add(mul(X, sx * Math.cos(alpha)), mul(uB, Math.sin(alpha))), add(mul(X, sx * Math.cos(alpha)), mul(uT(t), Math.sin(alpha)))]
    const outs = glueDir.map((d) => unit(add(d, mul(c, -dot(d, c)))))
    const reach = Math.min(hw, h * Math.tan(beta))
    const tip = Math.max(0, h - reach / Math.tan(beta))
    const topPoint = add(origin, mul(c, h))
    outs.forEach((out, half) => {
      const other = outs[1 - half]
      const inward = unit(cross(c, out))
      const concave = dot(inward, other) > 0 ? inward : mul(inward, -1)
      // Pick the local x that puts the printed side on the inside of the V.
      const forward = dot(cross(out, c), concave) > 0
      const ex = forward ? out : mul(out, -1)
      const o = forward ? topPoint : add(topPoint, mul(out, hw))
      const poly: [number, number][] = forward
        ? [[0, 0], [reach, 0], [reach, tip], [0, h]]
        : [[hw - reach, 0], [hw, 0], [hw, h], [hw - reach, tip]]
      sheet(`${piece.id}-${half}`, o, ex, mul(c, -1), hw, h, colour, {
        art: piece.children,
        artLeft: forward ? -hw : 0,
        artWidth: piece.width,
        clip: poly,
      })
      const corner = (s: number, v: number) => add(add(origin, mul(out, s)), mul(c, v))
      shadows.push([origin, floor(corner(0, h)), floor(corner(reach, h)), floor(corner(reach, h - tip))])
    })
  })

  const hint = pieces.filter((piece) => piece.label).map((piece) => piece.label).join('. ')
  const angleNow = Math.round(target)
  const state = angleNow < 3 ? 'shut' : angleNow > 177 ? 'flat open' : 'open'
  const height = Math.round((D * (cp + sp) + D * 0.55) * fit)

  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 30, PageDown: -30 }
    if (event.key in steps) commit(target + steps[event.key])
    else if (event.key === 'Home') commit(0)
    else if (event.key === 'End') commit(180)
    else if (event.key === 'Enter' || event.key === ' ') commit(target > 2 ? 0 : openAngle)
    else return
    event.preventDefault()
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, angle: target, turn, moved: false }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 5) return
    d.moved = true
    setTurn(clamp(d.turn + dx * 0.25, -40, 40))
    commit(d.angle - dy * 0.6)
  }
  const onPointerUp = () => {
    const d = drag.current
    if (d && !d.moved) commit(target > 2 ? 0 : openAngle)
    drag.current = null
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={180}
      aria-valuenow={angleNow}
      aria-valuetext={`${angleNow}°, ${state}`}
      aria-describedby={`${filterId}-hint`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ height, perspective: 1500, perspectiveOrigin: '50% 30%' }}
      className={cn(
        'relative w-full cursor-grab touch-none select-none rounded-[var(--radius-card)] active:cursor-grabbing',
        className,
      )}
    >
      <span id={`${filterId}-hint`} className="sr-only">
        Drag up or down, or use the arrow keys, to open and close the card. Enter toggles it. {hint}
      </span>
      <div
        aria-hidden="true"
        className="absolute left-1/2 [transform-style:preserve-3d]"
        style={{ top: Math.round((D * cp + D * 0.18) * fit), transform: `scale(${fit})` }}
      >
        {faces.map((f, i) => (
          <div
            key={f.key}
            className="absolute left-0 top-0 origin-top-left overflow-hidden"
            style={{
              width: f.w,
              height: f.h,
              transform: f.transform,
              background: f.paper,
              backfaceVisibility: f.hidden ? 'hidden' : undefined,
              clipPath: f.clip && `polygon(${f.clip.map(([x, y]) => `${r4(x)}px ${r4(y)}px`).join(', ')})`,
            }}
          >
            {f.art != null && (
              <div className="absolute top-0 h-full" style={{ left: f.artLeft ?? 0, width: f.artWidth ?? f.w }}>
                {f.art}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: f.shade }} />
            {i === 0 && (
              <svg className="absolute inset-0" width={W} height={D} style={{ overflow: 'visible' }}>
                <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="7" />
                </filter>
                <g filter={`url(#${filterId})`} opacity={0.26 * Math.min(1, 0.35 + shown / 90)}>
                  {shadows.map((poly, n) => (
                    <polygon key={n} fill="black" points={poly.map((p) => `${r4(p[0] + W / 2)},${r4(p[2])}`).join(' ')} />
                  ))}
                </g>
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

