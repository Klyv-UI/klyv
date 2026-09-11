'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface TypewriterProps {
  /** Phrases, typed in order. One phrase and `loop={false}` types once. */
  words: string[]
  /** Milliseconds per character while typing. */
  typeSpeed?: number
  /** Milliseconds per character while deleting. */
  deleteSpeed?: number
  /** Milliseconds held on a finished phrase. */
  pause?: number
  loop?: boolean
  /** Show the blinking caret. */
  caret?: boolean
  /** Reserve the width of the longest phrase so nothing beside it reflows. */
  reserveSpace?: boolean
  /** What a screen reader hears instead of the typing. Defaults to every phrase. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

type Phase = 'typing' | 'holding' | 'deleting'

/**
 * Text that types itself, deletes, and moves to the next phrase.
 *
 * Two things separate this from the usual version. It is announced once, as
 * static text in a visually hidden node, while the animated glyphs are hidden
 * from the accessibility tree — a screen reader hearing a phrase re-announced
 * character by character is unusable. And `reserveSpace` sizes the element to
 * the longest phrase up front, so a headline beside it does not reflow on
 * every keystroke.
 *
 * Under `prefers-reduced-motion` it renders the first phrase and stops.
 */
export function Typewriter({
  words,
  typeSpeed = 62,
  deleteSpeed = 32,
  pause = 1600,
  loop = true,
  caret = true,
  reserveSpace = false,
  label,
  className,
}: TypewriterProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const timer = useRef<number | undefined>(undefined)

  const word = words[index % words.length] ?? ''
  const done = !loop && index === words.length - 1 && count === word.length

  useEffect(() => {
    if (reducedMotion || words.length === 0 || done) return

    const schedule = (delay: number, run: () => void) => {
      timer.current = window.setTimeout(run, delay)
    }

    if (phase === 'typing') {
      if (count < word.length) schedule(typeSpeed, () => setCount((value) => value + 1))
      else schedule(pause, () => setPhase(loop || index < words.length - 1 ? 'deleting' : 'holding'))
    } else if (phase === 'deleting') {
      if (count > 0) schedule(deleteSpeed, () => setCount((value) => value - 1))
      else {
        setIndex((value) => (value + 1) % words.length)
        setPhase('typing')
      }
    }

    return () => window.clearTimeout(timer.current)
  }, [count, deleteSpeed, done, index, loop, pause, phase, reducedMotion, typeSpeed, word.length, words.length])

  const longest = words.reduce((best, entry) => (entry.length > best.length ? entry : best), '')
  const visible = reducedMotion ? words[0] ?? '' : word.slice(0, count)

  return (
    <span className={cn('relative inline-flex items-baseline', className)}>
      {reserveSpace && (
        // An invisible copy of the longest phrase holds the box open, and the
        // typed text is laid over it — so the line never reflows mid-word.
        <span aria-hidden="true" className="pointer-events-none invisible">
          {longest}
        </span>
      )}
      <span aria-hidden="true" className={cn(reserveSpace && 'absolute left-0 top-0')}>
        {visible}
        {caret && !reducedMotion && (
          <span
            className="motion-safe-only ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.12em] rounded-full bg-accent-strong align-middle"
            style={{ animation: 'caret-blink 1.1s step-end infinite' }}
          />
        )}
      </span>
      <VisuallyHidden>{label ?? words.join('. ')}</VisuallyHidden>
    </span>
  )
}
