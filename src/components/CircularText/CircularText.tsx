'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface CircularTextProps {
  /** The words to set around the ring. Read once, as written, by assistive tech. */
  text: string
  /** How many times the text goes around. Repeats are decoration and are not read out. */
  repeat?: number
  /** Drawn between repeats, and after the last one so the join is invisible. */
  separator?: string
  /** Outer diameter in pixels. */
  size?: number
  /** Letter size in pixels. */
  fontSize?: number
  /** Turn slowly. Pauses while hovered or focused, and never runs under reduced motion. */
  rotate?: boolean
  /** Seconds per full turn. */
  duration?: number
  /** Turn anticlockwise instead. */
  reverse?: boolean
  /** Centre slot — an icon, a logo, or a round button. Stays upright while the ring turns. */
  children?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/** Half a circle as a relative SVG arc, heading right (1) or back left (-1). */
const arc = (radius: number, direction: 1 | -1) => `a ${radius},${radius} 0 1,1 ${radius * 2 * direction},0`

/**
 * Text set around a circle, with room in the middle for an icon or a button.
 *
 * The letters are an SVG `textPath` stretched to the exact circumference with
 * `textLength`, so any phrase closes its own loop without hand-tuned letter
 * spacing. The ring is hidden from assistive tech and the phrase is given once
 * in plain text beside it — a screen reader should hear “Book a call”, not the
 * same words three times round with bullets between.
 *
 * The turn is a Web Animation on the ring alone, so the centre slot keeps still
 * and stays clickable. It pauses while the pointer or focus is on the
 * component, because moving text is hard to read and harder to aim at, and it
 * is never started at all when the reader has asked for reduced motion.
 */
export function CircularText({
  text,
  repeat = 2,
  separator = ' • ',
  size = 160,
  fontSize = 13,
  rotate = true,
  duration = 18,
  reverse = false,
  children,
  className,
}: CircularTextProps) {
  const pathId = `klyv-circular-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const ringRef = useRef<SVGSVGElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [held, setHeld] = useState(false)
  const animation = useRef<Animation | null>(null)

  const radius = size / 2 - fontSize
  const circumference = 2 * Math.PI * radius
  const centre = size / 2
  const ring = Array.from({ length: Math.max(1, repeat) }, () => `${text}${separator}`).join('')

  useEffect(() => {
    const node = ringRef.current
    if (!node || !rotate || reducedMotion || typeof node.animate !== 'function') return
    const turn = reverse ? -360 : 360
    animation.current = node.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${turn}deg)` }], {
      duration: duration * 1000,
      iterations: Infinity,
    })
    return () => {
      animation.current?.cancel()
      animation.current = null
    }
  }, [rotate, reducedMotion, duration, reverse])

  useEffect(() => {
    if (held) animation.current?.pause()
    else animation.current?.play()
  }, [held])

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false)
      }}
    >
      <span className="sr-only">{text}</span>
      <svg
        ref={ringRef}
        aria-hidden="true"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="absolute inset-0 origin-center text-ink"
      >
        <defs>
          <path
            id={pathId}
            d={`M ${centre - radius},${centre} ${arc(radius, 1)} ${arc(radius, -1)}`}
          />
        </defs>
        <text
          fill="currentColor"
          fontSize={fontSize}
          fontWeight={700}
          className="uppercase tracking-[0.12em]"
          dominantBaseline="middle"
        >
          <textPath href={`#${pathId}`} textLength={circumference - 1} lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
      </svg>
      {children && <span className="relative flex items-center justify-center">{children}</span>}
    </span>
  )
}
