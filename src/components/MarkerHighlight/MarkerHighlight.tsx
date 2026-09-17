'use client'

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useInView, usePrefersReducedMotion } from '../../lib/motion'

export type MarkerHighlightVariant = 'underline' | 'highlight' | 'circle' | 'box'

interface Stroke {
  /** Where the drawing sits relative to the words. */
  frame: string
  /** One path per pass of the pen. */
  paths: string[]
  /** Stroke width in CSS pixels, or in viewBox units for the fat highlighter. */
  width: number
  /** Whether the width scales with the box. The highlighter's does; a pen line does not. */
  scales: boolean
  /** Default strength of the accent mix. */
  tint: number
}

const STROKES: Record<MarkerHighlightVariant, Stroke> = {
  underline: {
    frame: 'inset-x-[-0.08em] bottom-[-0.28em] h-[0.5em]',
    paths: ['M2 11C22 7 48 8 72 7.5S94 8 98 9'],
    width: 3,
    scales: false,
    tint: 100,
  },
  highlight: {
    frame: 'inset-x-[-0.14em] top-[0.12em] bottom-[-0.02em]',
    paths: ['M1 11C20 9.5 45 11.5 70 10.5S92 10 99 11'],
    width: 15,
    scales: true,
    tint: 35,
  },
  circle: {
    frame: 'inset-x-[-0.45em] inset-y-[-0.3em]',
    paths: ['M56 2.5C80 2 97 5.5 98 10.5S80 18.5 48 18.5 2.5 15 2 10 22 2.5 60 3.5'],
    width: 2.25,
    scales: false,
    tint: 100,
  },
  box: {
    frame: 'inset-x-[-0.3em] inset-y-[-0.2em]',
    paths: ['M2.5 3C35 2 68 2.5 97.5 2.5 98 8 97 14 97.5 17.5 64 18 32 17.5 2 18 2.5 12 3 7 2 2.5'],
    width: 2.25,
    scales: false,
    tint: 100,
  },
}

export interface MarkerHighlightProps {
  /** The words to mark. Keep it to a short phrase — the mark does not wrap across lines. */
  children: ReactNode
  /** Underline, a highlighter swipe behind the words, a loose circle, or a box. */
  variant?: MarkerHighlightVariant
  /** Strength of the accent, 0–100. The highlighter defaults lighter so the words stay readable. */
  tint?: number
  /** Draw the mark in when it scrolls into view. False draws it straight away. */
  animate?: boolean
  /** How long the pen takes, in ms. */
  duration?: number
  /** Wait before drawing, in ms — to follow a heading's own entrance. */
  delay?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Words marked the way a person would mark them on paper.
 *
 * A flat background or a colour change says "emphasis" but not "look here";
 * a stroke that is slightly off-level, overshoots its ends and is drawn in
 * front of the reader does. The mark is an SVG behind or around the text, so
 * the text itself is untouched — it stays selectable, copies cleanly and
 * reads the same to a screen reader, which is told nothing about the drawing.
 *
 * The colour is the accent mixed toward transparent, so it follows any accent
 * and either theme. The highlighter is mixed lighter than the pen marks
 * because the words sit on top of it. The drawing waits until it is on
 * screen, plays once, and under reduced motion it is simply there.
 */
export function MarkerHighlight({
  children,
  variant = 'underline',
  tint,
  animate = true,
  duration = 700,
  delay = 0,
  className,
}: MarkerHighlightProps) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.6)
  const reduced = usePrefersReducedMotion()
  const stroke = STROKES[variant]
  const still = !animate || reduced
  const drawn = still || inView
  const strength = Math.min(100, Math.max(0, tint ?? stroke.tint))

  // The pen is a wipe from the leading edge rather than a dash offset: dashes
  // measured with `pathLength` go wrong once the stroke is non-scaling, and a
  // wipe reads as the same left-to-right stroke.
  const reveal: CSSProperties = {
    clipPath: drawn ? 'inset(-50% -10% -50% -10%)' : 'inset(-50% 110% -50% -10%)',
    transition: still ? undefined : `clip-path ${duration}ms cubic-bezier(.45,.05,.25,1) ${delay}ms`,
  }
  const colour = `color-mix(in oklab, var(--color-accent) ${strength}%, transparent)`

  return (
    <span ref={ref} className={cn('relative isolate whitespace-nowrap', className)}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        className={cn('pointer-events-none absolute -z-10 overflow-visible select-none', stroke.frame)}
        style={reveal}
      >
        {stroke.paths.map((path) => (
          <path
            key={path}
            d={path}
            fill="none"
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect={stroke.scales ? undefined : 'non-scaling-stroke'}
            style={{ stroke: colour }}
          />
        ))}
      </svg>
      {children}
    </span>
  )
}
