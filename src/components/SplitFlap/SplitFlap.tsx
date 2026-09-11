'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'
import { usePrefersReducedMotion } from '../../lib/motion'

const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:-+$£€%'

export type SplitFlapSize = 'sm' | 'md' | 'lg'

const SIZES: Record<SplitFlapSize, string> = {
  sm: 'h-7 w-5 text-[13px]',
  md: 'h-9 w-6 text-[16px]',
  lg: 'h-12 w-8 text-[22px]',
}

export interface SplitFlapProps {
  /** The text to display. Changing it re-runs the flap. */
  children: string
  size?: SplitFlapSize
  /** Milliseconds per flap step. */
  step?: number
  /** Pad to this many cells, so the board keeps a fixed width. */
  length?: number
  /** Accessible text. Defaults to the value. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A split-flap board: each cell riffles through the alphabet until it reaches
 * its target character.
 *
 * The cells are aria-hidden and the final string is exposed once, so assistive
 * tech reads the value rather than the noise. Under reduced motion the board
 * simply shows its text.
 */
export function SplitFlap({
  children,
  size = 'md',
  step = 45,
  length,
  label,
  className,
}: SplitFlapProps) {
  const reduced = usePrefersReducedMotion()
  const target = children.toUpperCase().padEnd(length ?? children.length, ' ')
  const [display, setDisplay] = useState(reduced ? target : ' '.repeat(target.length))
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (reduced) {
      setDisplay(target)
      return
    }

    let current = ' '.repeat(target.length).split('')
    const run = () => {
      let settled = true
      current = current.map((character, index) => {
        const goal = target[index]
        if (character === goal) return character
        settled = false
        const next = ALPHABET.indexOf(character) + 1
        return ALPHABET[next % ALPHABET.length]
      })
      setDisplay(current.join(''))
      if (!settled) timer.current = window.setTimeout(run, step)
    }
    run()

    return () => window.clearTimeout(timer.current)
  }, [target, step, reduced])

  return (
    <span className={cn('inline-flex gap-0.5', className)}>
      <VisuallyHidden>{label ?? children}</VisuallyHidden>
      {[...display].map((character, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            'tabular flex items-center justify-center rounded-[4px] bg-ink font-bold text-ink-inverse',
            'shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]',
            SIZES[size],
          )}
        >
          {character}
        </span>
      ))}
    </span>
  )
}
