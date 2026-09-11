'use client'

import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface GlobeMarker {
  /** Degrees, −90 (south) to 90 (north). */
  lat: number
  /** Degrees, −180 to 180. */
  lng: number
  label: string
  /** Draw a pulse around it — for the one place that matters most. */
  pulse?: boolean
}

export interface DotGlobeProps {
  /** Accessible name — what the globe is showing. */
  label: string
  markers?: GlobeMarker[]
  /** Pixel size of the square canvas. */
  size?: number
  /** Dots on the sphere. Higher looks denser, not larger. */
  dots?: number
  /** Seconds for one full rotation. */
  duration?: number
  /** Axial tilt in degrees, so it does not read as a flat ring of dots. */
  tilt?: number
  /** Any CSS colour for the land dots. */
  dotColor?: string
  /** Any CSS colour for the marked points. */
  markerColor?: string
  /** Merged last, so it wins. */
  className?: string
}

/** Evenly spread points on a sphere — the golden-angle spiral. */
function fibonacciSphere(count: number) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const points: [number, number, number][] = []
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    points.push([Math.cos(theta) * radius, y, Math.sin(theta) * radius])
  }
  return points
}

function toVector(lat: number, lng: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return [
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ]
}

/**
 * A slowly turning sphere of dots, with places marked on it.
 *
 * The dots are a golden-angle spiral rather than a latitude/longitude grid,
 * because a grid bunches its points at the poles and the crowding is obvious
 * the moment the globe turns. The spiral spreads them evenly over the surface,
 * which is the whole reason the shape reads as a sphere at all.
 *
 * Rotation is a single Y-axis matrix applied per frame, and depth is spent on
 * two things only: dots behind the sphere are dimmed rather than culled, so the
 * silhouette stays solid, and dot radius grows slightly towards the viewer.
 * That is enough for the eye; a real 3D pipeline is not.
 *
 * The markers are the content, so they are also listed as text — the picture
 * is never the only place the information exists.
 */
export function DotGlobe({
  label,
  markers = [],
  size = 260,
  dots = 900,
  duration = 26,
  tilt = 18,
  dotColor = 'var(--color-ink-faint)',
  markerColor = 'var(--color-accent-strong)',
  className,
}: DotGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const styles = getComputedStyle(canvas)
    const resolve = (value: string) =>
      value.startsWith('var(') ? styles.getPropertyValue(value.slice(4, -1)).trim() : value
    const dotFill = resolve(dotColor) || '#9ca1a5'
    const markerFill = resolve(markerColor) || '#b9e93a'

    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(size * ratio)
    canvas.height = Math.round(size * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    const points = fibonacciSphere(dots)
    const placed = markers.map((marker) => ({ marker, vector: toVector(marker.lat, marker.lng) }))
    const radius = size / 2 - 6
    const centre = size / 2
    const tiltRadians = tilt * (Math.PI / 180)

    let frame = 0
    let start = performance.now()

    const project = ([x, y, z]: [number, number, number], spin: number) => {
      // Spin about Y, then tilt about X. Two rotations, no matrix library.
      const sx = x * Math.cos(spin) + z * Math.sin(spin)
      const sz = -x * Math.sin(spin) + z * Math.cos(spin)
      const ty = y * Math.cos(tiltRadians) - sz * Math.sin(tiltRadians)
      const tz = y * Math.sin(tiltRadians) + sz * Math.cos(tiltRadians)
      return { x: centre + sx * radius, y: centre - ty * radius, z: tz }
    }

    const draw = (spin: number) => {
      context.clearRect(0, 0, size, size)

      for (const point of points) {
        const { x, y, z } = project(point, spin)
        // Behind the sphere: dimmed, never culled, so the disc stays solid.
        context.globalAlpha = z < 0 ? 0.16 : 0.3 + z * 0.55
        context.fillStyle = dotFill
        context.beginPath()
        context.arc(x, y, 1 + Math.max(0, z) * 0.7, 0, Math.PI * 2)
        context.fill()
      }

      for (const { marker, vector } of placed) {
        const { x, y, z } = project(vector, spin)
        if (z < -0.15) continue
        context.globalAlpha = z < 0 ? 0.35 : 1
        context.fillStyle = markerFill
        context.beginPath()
        context.arc(x, y, 3.4, 0, Math.PI * 2)
        context.fill()

        if (marker.pulse && z > 0) {
          const phase = (performance.now() % 1800) / 1800
          context.globalAlpha = (1 - phase) * 0.5
          context.strokeStyle = markerFill
          context.lineWidth = 1.5
          context.beginPath()
          context.arc(x, y, 3.4 + phase * 14, 0, Math.PI * 2)
          context.stroke()
        }
      }
      context.globalAlpha = 1
    }

    if (reducedMotion) {
      draw(0)
      return
    }

    const step = (now: number) => {
      const spin = (((now - start) / 1000) % duration) / duration * Math.PI * 2
      draw(spin)
      frame = requestAnimationFrame(step)
    }
    start = performance.now()
    frame = requestAnimationFrame(step)

    return () => cancelAnimationFrame(frame)
  }, [dotColor, dots, duration, markerColor, markers, reducedMotion, size, tilt])

  return (
    <div className={cn('relative inline-block', className)} style={{ width: size, height: size }}>
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: size, height: size }} />
      <VisuallyHidden>
        <p>{label}</p>
        {markers.length > 0 && (
          <ul>
            {markers.map((marker) => (
              <li key={marker.label}>{marker.label}</li>
            ))}
          </ul>
        )}
      </VisuallyHidden>
    </div>
  )
}
