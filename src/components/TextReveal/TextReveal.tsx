'use client'

import { useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export interface TextRevealProps {
  /** The passage. Split on whitespace, so punctuation stays attached. */
  text: string
  /** Element for the passage. Use a heading level where one is right. */
  as?: ElementType
  /** Scroll container. Defaults to the window. */
  scrollRef?: React.RefObject<HTMLElement | null>
  /** How much of the pass is spent lighting words, 0–1. Lower finishes sooner. */
  span?: number
  /** How many words are mid-fade at once. */
  softness?: number
  /** Colour of a word that has not been reached. */
  dimClassName?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A passage whose words light up one by one as it scrolls through the view.
 *
 * Unlike `Reveal`, which fires once when an element crosses a threshold, this
 * is scroll-linked: the reader controls it, and scrolling back up unlights the
 * words again. That is the difference between an entrance animation and a
 * reading pace, and it is why it belongs on a manifesto paragraph rather than
 * on a card.
 *
 * Progress is read in a `requestAnimationFrame` coalesced from the scroll
 * event, and each word's opacity is a plain interpolation of that single
 * number — so a 60-word passage costs one measurement a frame, not sixty.
 */
export function TextReveal({
  text,
  as,
  scrollRef,
  span = 0.72,
  softness = 6,
  dimClassName = 'text-ink-faint/35',
  className,
}: TextRevealProps) {
  const Component = (as ?? 'p') as ElementType
  const ref = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text])

  useEffect(() => {
    if (reducedMotion) {
      setProgress(1)
      return
    }

    const container = scrollRef?.current
    let frame = 0

    const measure = () => {
      frame = 0
      const node = ref.current
      if (!node) return

      const box = node.getBoundingClientRect()
      const viewTop = container ? container.getBoundingClientRect().top : 0
      const viewHeight = container ? container.clientHeight : window.innerHeight

      // 0 when the passage's top reaches the bottom of the view, 1 once it has
      // travelled its own height plus most of the view above that point.
      const travelled = viewTop + viewHeight - box.top
      const distance = box.height + viewHeight * 0.55
      setProgress(Math.min(1, Math.max(0, travelled / distance)))
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    const target: HTMLElement | Window = container ?? window
    target.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    measure()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      target.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [reducedMotion, scrollRef])

  // Words lit so far, as a fractional index, so the edge fades rather than snaps.
  const head = (progress / Math.max(0.05, span)) * (words.length + softness)

  return (
    <Component ref={ref} className={cn('flex flex-wrap', className)}>
      {words.map((word, index) => {
        const lit = Math.min(1, Math.max(0, (head - index) / softness))
        return (
          <span
            key={`${word}-${index}`}
            className={cn('transition-colors duration-[var(--duration-fast)]', lit < 0.5 && dimClassName)}
            style={{ opacity: 0.28 + lit * 0.72, marginRight: '0.28em' }}
          >
            {word}
          </span>
        )
      })}
    </Component>
  )
}
