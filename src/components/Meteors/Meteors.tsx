'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export type MeteorsTone = 'accent' | 'ink'

export interface MeteorsProps {
  /** How many streaks. A dozen reads as a shower; forty starts to look like rain. */
  count?: number
  /** Multiplies how fast they fall. 2 is twice as fast. */
  speed?: number
  /** Direction of travel in degrees, clockwise from pointing right. 145 falls down and to the left. */
  angle?: number
  /** Length of each tail in pixels. */
  length?: number
  /** Streak colour, from the theme. */
  tone?: MeteorsTone
  /** Freeze the shower. */
  paused?: boolean
  /** Merged last, so it wins. Place the layer inside a positioned container. */
  className?: string
}

const TONES: Record<MeteorsTone, string> = {
  accent: 'var(--color-accent-strong)',
  ink: 'var(--color-ink-soft)',
}

/** Deterministic noise, so server and client draw the same shower. */
const noise = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Thin streaks crossing a surface on a diagonal, drawn behind content as a
 * layer that fills its positioned parent.
 *
 * Each meteor is one span moved by the Web Animations API along its own
 * rotated x axis — a transform and an opacity, nothing that triggers layout —
 * with its own duration and delay, so the shower never falls in step. Start
 * positions come from a seeded hash rather than `Math.random`, so the server
 * render and the first client render agree.
 *
 * The animations pause while the layer is scrolled out of view, and the layer
 * is `aria-hidden` and ignores the pointer, so it never gets between a reader
 * and the content on top. Under reduced motion nothing moves: the meteors are
 * drawn as faint fixed streaks, which keeps the texture without the motion.
 */
export function Meteors({
  count = 14,
  speed = 1,
  angle = 145,
  length = 90,
  tone = 'ink',
  paused = false,
  className,
}: MeteorsProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [travel, setTravel] = useState(900)
  const [visible, setVisible] = useState(true)
  const animations = useRef<Animation[]>([])
  const color = TONES[tone]

  const meteors = Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => ({
    left: noise(index, 1) * 130,
    top: noise(index, 2) * 60 - 25,
    duration: (2.4 + noise(index, 3) * 4) / Math.max(0.1, speed),
    delay: noise(index, 4) * 6,
    scale: 0.6 + noise(index, 5) * 0.6,
  }))

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const measure = () => {
      const box = layer.getBoundingClientRect()
      setTravel(Math.max(400, Math.hypot(box.width, box.height) * 1.3))
    }
    measure()
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resize?.observe(layer)
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer?.observe(layer)
    return () => {
      resize?.disconnect()
      observer?.disconnect()
    }
  }, [])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer || reducedMotion) return
    const spans = [...layer.children] as HTMLElement[]
    animations.current = spans.flatMap((span, index) => {
      if (typeof span.animate !== 'function') return []
      const meteor = meteors[index]
      return [
        span.animate(
          [
            { transform: `rotate(${angle}deg) translateX(0px)`, opacity: 0 },
            { opacity: 1, offset: 0.1 },
            { opacity: 1, offset: 0.7 },
            { transform: `rotate(${angle}deg) translateX(${travel}px)`, opacity: 0 },
          ],
          { duration: meteor.duration * 1000, delay: meteor.delay * 1000, iterations: Infinity, easing: 'linear' },
        ),
      ]
    })
    return () => {
      animations.current.forEach((animation) => animation.cancel())
      animations.current = []
    }
    // meteors derives from count and speed.
  }, [count, speed, angle, travel, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Paused rather than cancelled, so the shower resumes mid-fall instead of restarting.
    for (const animation of animations.current) {
      if (paused || !visible) animation.pause()
      else animation.play()
    }
  }, [paused, visible, count, speed, angle, travel, reducedMotion])

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {meteors.map((meteor, index) => (
        <span
          key={index}
          className="absolute block h-px rounded-full"
          style={{
            left: `${meteor.left}%`,
            top: `${meteor.top}%`,
            width: length * meteor.scale,
            transformOrigin: 'right center',
            background: `linear-gradient(to left, ${color}, transparent)`,
            opacity: reducedMotion ? 0.28 : 0,
            transform: `rotate(${angle}deg) translateX(${reducedMotion ? travel * noise(index, 6) * 0.6 : 0}px)`,
          }}
        >
          <span
            className="absolute right-0 top-1/2 size-[3px] -translate-y-1/2 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px 1px ${color}` }}
          />
        </span>
      ))}
    </div>
  )
}
