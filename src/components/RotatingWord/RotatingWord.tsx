'use client'

import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface RotatingWordProps {
  /** Words to cycle through. */
  words: string[]
  /** Milliseconds each word is held. */
  interval?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Cycles a word inside a headline.
 *
 * The strip is announced politely once per change rather than continuously, and
 * it holds the first word under reduced motion. The container is sized to the
 * longest word so the surrounding line never reflows as it cycles.
 */
export function RotatingWord({ words, interval = 2200, className }: RotatingWordProps) {
  const [index, setIndex] = useState(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced || words.length < 2) return
    const timer = setInterval(() => setIndex((previous) => (previous + 1) % words.length), interval)
    return () => clearInterval(timer)
  }, [words.length, interval, reduced])

  const longest = words.reduce((a, b) => (a.length >= b.length ? a : b), '')

  return (
    <span className={cn('relative inline-grid overflow-hidden align-bottom', className)}>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {longest}
      </span>
      {words.map((word, wordIndex) => (
        <span
          key={word}
          aria-hidden={wordIndex !== index}
          className={cn(
            'col-start-1 row-start-1 transition-all duration-[var(--duration-slow)] ease-out',
            wordIndex === index ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
          )}
        >
          {word}
        </span>
      ))}
      <span role="status" aria-live="polite" className="sr-only">
        {words[index]}
      </span>
    </span>
  )
}
