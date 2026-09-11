'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface CollapseProps {
  open: boolean
  /** Content revealed when open. */
  children: ReactNode
  /** Transition length in milliseconds. */
  duration?: number
  /** Id, so a trigger can point at it with aria-controls. */
  id?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Animates between zero and content height. It measures the content rather than
 * taking a fixed height, and releases back to `auto` once open — so a section
 * whose content grows later is not trapped at the height it was measured at.
 *
 * While closed it is `hidden`, which keeps the collapsed content out of the tab
 * order. The attribute is applied only after the transition finishes, so it
 * never cuts the animation short.
 */
export function Collapse({ open, children, duration = 220, id, className }: CollapseProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0)
  const [closed, setClosed] = useState(!open)

  useEffect(() => {
    const element = contentRef.current
    if (!element) return
    const measured = element.scrollHeight

    if (open) {
      setClosed(false)
      // Start from 0 so the very first open still animates.
      setHeight(measured)
      const timer = setTimeout(() => setHeight(undefined), duration)
      return () => clearTimeout(timer)
    }

    // Pin the current height, then collapse on the next frame so the browser
    // has two distinct values to interpolate between.
    setHeight(measured)
    const frame = requestAnimationFrame(() => setHeight(0))
    const timer = setTimeout(() => setClosed(true), duration)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [open, duration])

  return (
    <div
      id={id}
      hidden={closed && !open}
      style={{ height, transitionDuration: `${duration}ms` }}
      className={cn('overflow-hidden transition-[height] ease-out', className)}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  )
}
