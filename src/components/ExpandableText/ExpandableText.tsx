'use client'

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ExpandableTextProps {
  /** The text. Prose reads best; the clamp counts rendered lines. */
  children: ReactNode
  /** Lines shown while collapsed. */
  lines?: number
  /** Controlled state. Omit it to let the component own the toggle. */
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  moreLabel?: string
  lessLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Long text, clamped to a few lines, with a toggle to read the rest.
 *
 * The toggle only appears when the text is actually clamped — a "Show more"
 * that reveals nothing is a broken promise. It is a button with aria-expanded
 * and aria-controls, so the relationship is announced, and the full text stays
 * in the DOM throughout, so find-in-page and screen readers still reach it.
 */
export function ExpandableText({
  children,
  lines = 3,
  expanded,
  onExpandedChange,
  moreLabel = 'Show more',
  lessLabel = 'Show less',
  className,
}: ExpandableTextProps) {
  const id = useId()
  const body = useRef<HTMLDivElement>(null)
  const [own, setOwn] = useState(false)
  const [clamped, setClamped] = useState(false)
  const open = expanded ?? own

  // Measured only while collapsed: once open there is nothing to compare with.
  // The observer catches the text reflowing when its container resizes.
  useLayoutEffect(() => {
    const node = body.current
    if (!node || open) return
    const measure = () => setClamped(node.scrollHeight > node.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [open, lines])

  const toggle = () => {
    const next = !open
    if (expanded === undefined) setOwn(next)
    onExpandedChange?.(next)
  }

  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      <div
        id={id}
        ref={body}
        style={
          open
            ? undefined
            : {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: lines,
                overflow: 'hidden',
              }
        }
      >
        {children}
      </div>

      {(clamped || open) && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={toggle}
          className="rounded-md text-[12px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
        >
          {open ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  )
}
