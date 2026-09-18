'use client'

import { useRef, useState, type ElementType } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'

export interface FitTextProps {
  /** The line to fit. It never wraps. */
  children: string
  /** Smallest font size, in px. Below this the line is allowed to overflow and clip. */
  min?: number
  /** Largest font size, in px, however wide the container gets. */
  max?: number
  /** Element to render — `h1` for a hero headline. */
  as?: ElementType
  /** Called with the fitted size in px after each fit. */
  onFit?: (fontSize: number) => void
  /** Merged onto the element. Set weight, family and tracking here; they are measured. */
  className?: string
}

/**
 * One line of display text sized to fill its container exactly.
 *
 * Viewport units get close but not exact: they follow the window, not the
 * column the headline sits in, and a longer word in another language
 * overflows. This measures the text at a known size, scales by the ratio of
 * the container width to the text width, then checks the result and corrects
 * once for anything that does not scale linearly — tracking in pixels, hinting.
 * It refits when the container resizes and again when web fonts finish
 * loading, because a fallback font’s width is not the real one’s.
 *
 * The text stays real text — selectable, translatable, read normally — and
 * clamps between `min` and `max` so a narrow phone does not get 9px type.
 */
export function FitText({ children, min = 16, max = 160, as: Tag = 'div', onFit, className }: FitTextProps) {
  const outer = useRef<HTMLElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState<number | null>(null)
  const onFitRef = useRef(onFit)
  onFitRef.current = onFit

  useIsomorphicLayoutEffect(() => {
    const box = outer.current
    const line = inner.current
    if (!box || !line) return
    let lastWidth = -1
    let frame = 0

    const fit = (force = false) => {
      const style = getComputedStyle(box)
      const width = box.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      if (width <= 0 || (!force && width === lastWidth)) return
      lastWidth = width
      const reference = 100
      line.style.fontSize = `${reference}px`
      const measured = line.getBoundingClientRect().width
      if (measured <= 0) {
        line.style.fontSize = ''
        return
      }
      let next = (reference * width) / measured
      line.style.fontSize = `${next}px`
      const check = line.getBoundingClientRect().width
      if (check > width) next *= width / check
      next = Math.min(max, Math.max(min, Math.floor(next * 4) / 4))
      line.style.fontSize = `${next}px`
      setSize(next)
      onFitRef.current?.(next)
    }

    fit(true)
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => fit())
          })
    observer?.observe(box)
    let live = true
    const refit = () => live && fit(true)
    document.fonts?.ready.then(refit)
    document.fonts?.addEventListener?.('loadingdone', refit)
    return () => {
      live = false
      cancelAnimationFrame(frame)
      observer?.disconnect()
      document.fonts?.removeEventListener?.('loadingdone', refit)
    }
  }, [children, min, max, className])

  return (
    <Tag ref={outer} className={cn('block w-full min-w-0 overflow-hidden', className)}>
      <span
        ref={inner}
        className="inline-block whitespace-nowrap leading-[1.05]"
        style={size === null ? undefined : { fontSize: `${size}px` }}
      >
        {children}
      </span>
    </Tag>
  )
}
