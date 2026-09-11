'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'
import { usePrefersReducedMotion } from '../../lib/motion'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export interface TextScrambleProps {
  /** The final text. Changing it replays the scramble. */
  children: string
  /** Milliseconds per frame. */
  frame?: number
  /** Frames each character scrambles before settling. */
  settle?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Settles into its text from a run of random glyphs.
 *
 * The real string is exposed once through VisuallyHidden while the scrambling
 * characters are aria-hidden, so assistive tech never reads the noise. It skips
 * straight to the final text under reduced motion.
 */
export function TextScramble({ children, frame = 40, settle = 8, className }: TextScrambleProps) {
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState(reduced ? children : '')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (reduced) {
      setDisplay(children)
      return
    }

    let tick = 0
    const run = () => {
      const settled = Math.floor(tick / settle)
      setDisplay(
        [...children]
          .map((character, index) => {
            if (index < settled || character === ' ') return character
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          })
          .join(''),
      )
      tick += 1
      if (settled <= children.length) timer.current = window.setTimeout(run, frame)
    }
    run()

    return () => window.clearTimeout(timer.current)
  }, [children, frame, settle, reduced])

  return (
    <span className={cn('tabular', className)}>
      <VisuallyHidden>{children}</VisuallyHidden>
      <span aria-hidden="true">{display}</span>
    </span>
  )
}
