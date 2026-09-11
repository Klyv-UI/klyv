'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface BlobMorphProps {
  /** Rendered over the blob, centred. */
  children?: ReactNode
  /** Width and height in pixels. The blob is square. */
  size?: number
  /** How far the outline wanders from a circle, 0 to 1. */
  wobble?: number
  /** Seconds for one full cycle of the slowest wave. */
  duration?: number
  /** Control points. More gives a busier outline; 6 to 10 reads best. */
  points?: number
  /** Fill. A gradient is what stops it looking like a puddle. */
  fill?: string
  /** Follow the pointer — the blob bulges towards it. */
  reactive?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * An organic shape that never stops moving and never repeats.
 *
 * The outline is a ring of control points whose radius is driven by two sine
 * waves at unrelated frequencies. Because the frequencies share no common
 * factor, the shape has no period a viewer can catch — which is the difference
 * between an organic blob and a looping animation of one.
 *
 * The points are joined with Catmull–Rom converted to cubic Béziers, so the
 * curve passes *through* every control point with continuous tangents. Joining
 * them with quadratics is the usual shortcut and it leaves visible flat spots
 * where the segments meet.
 *
 * `reactive` adds a Gaussian bulge towards the pointer, falling off with
 * angular distance, so the blob leans rather than deforming all at once.
 */
export function BlobMorph({
  children,
  size = 220,
  wobble = 0.18,
  duration = 9,
  points = 8,
  fill = 'linear-gradient(135deg, #c8f24e, #7fd4ff 55%, #b06ab3)',
  reactive = true,
  className,
}: BlobMorphProps) {
  // Unique per instance: two blobs on a page would otherwise share a clip.
  const clipId = `blob-${useId().replace(/:/g, '')}`
  const [path, setPath] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ angle: number; strength: number }>({ angle: 0, strength: 0 })
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const centre = size / 2
    const base = centre * 0.78
    let frame = 0

    const build = (time: number) => {
      const nodes: [number, number][] = []
      for (let i = 0; i < points; i += 1) {
        const angle = (Math.PI * 2 * i) / points
        // Two unrelated frequencies: no period anyone can catch.
        const wave =
          Math.sin(angle * 3 + time * 0.9) * 0.6 + Math.sin(angle * 5 - time * 0.53) * 0.4

        let radius = base * (1 + wave * wobble)

        if (reactive && pointer.current.strength > 0) {
          // Angular distance, wrapped, so the bulge is local to one side.
          let gap = Math.abs(angle - pointer.current.angle)
          if (gap > Math.PI) gap = Math.PI * 2 - gap
          radius += base * 0.16 * pointer.current.strength * Math.exp(-(gap * gap) * 2.2)
        }

        nodes.push([centre + Math.cos(angle) * radius, centre + Math.sin(angle) * radius])
      }

      // Catmull–Rom → cubic: the curve passes through every point, with no
      // flat spots where segments meet.
      let d = `M ${nodes[0][0].toFixed(2)},${nodes[0][1].toFixed(2)}`
      for (let i = 0; i < nodes.length; i += 1) {
        const p0 = nodes[(i - 1 + nodes.length) % nodes.length]
        const p1 = nodes[i]
        const p2 = nodes[(i + 1) % nodes.length]
        const p3 = nodes[(i + 2) % nodes.length]
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
        d += ` C ${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
      }
      setPath(`${d} Z`)
    }

    if (reducedMotion) {
      build(0)
      return
    }

    // Paint one frame synchronously, so the blob is never an empty path
    // while waiting for the first animation frame.
    build(0)

    const started = performance.now()
    const step = (now: number) => {
      build(((now - started) / 1000) * (9 / duration))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [duration, points, reactive, reducedMotion, size, wobble])

  return (
    <div
      ref={wrapRef}
      onPointerMove={(event) => {
        if (!reactive) return
        const box = wrapRef.current?.getBoundingClientRect()
        if (!box) return
        const x = event.clientX - box.left - box.width / 2
        const y = event.clientY - box.top - box.height / 2
        pointer.current = { angle: Math.atan2(y, x), strength: 1 }
      }}
      onPointerLeave={() => {
        pointer.current = { ...pointer.current, strength: 0 }
      }}
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={path} />
          </clipPath>
        </defs>
        <foreignObject width={size} height={size} clipPath={`url(#${clipId})`}>
          <div style={{ width: size, height: size, background: fill }} />
        </foreignObject>
      </svg>

      <div className="relative z-10 px-6 text-center">{children}</div>
    </div>
  )
}
